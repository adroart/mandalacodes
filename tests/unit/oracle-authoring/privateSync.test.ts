import 'fake-indexeddb/auto';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {AuthoringStore} from '../../../lib/oracle/authoring/storage';
import {createSession,sourceSnapshot} from '../../../lib/oracle/authoring/workflow';
import {PrivateAuthoringSync,PrivateSyncConflict,PrivateCopyStopped,PRIVATE_COPY_LIMIT_LINE,knownPrivateAudio,forgetPrivateAudio,audioDetails} from '../../../src/mobile/authoring/privateSync';
/** `current` answers audio-has and flags missing audio as the server now does; without it the server is the older one. */
function server(current=false){
 const audio=new Set<string>(),calls:any[]=[];let conflict=false,revision=0;
 const transport=vi.fn(async(_path:string,init?:RequestInit)=>{
  const body=JSON.parse(String(init!.body));calls.push(body);
  if(body.operation==='audio-put'){audio.add(body.hash);return Response.json({ok:true,hash:body.hash});}
  if(current&&body.operation==='audio-has')return Response.json({present:body.hashes.filter((hash:string)=>audio.has(hash))});
  if(body.operation==='save'){
   if(body.document.audio.some((a:any)=>!audio.has(a.hash)))return Response.json(current?{error:'Some recordings are not stored yet.',missingAudio:true}:{error:'Upload all private audio before saving.'},{status:400});
   if(conflict)return Response.json({error:'changed',conflict:true},{status:409});
   return Response.json({revision:`r${++revision}`});
  }
  return Response.json({error:'Unknown operation.'},{status:400});
 });
 return {audio,calls,transport,setConflict:(value:boolean)=>{conflict=value;},puts:()=>calls.filter(c=>c.operation==='audio-put'),saves:()=>calls.filter(c=>c.operation==='save')};
}
function store(captures:{id:string;status:string}[]=[{id:'a',status:'ready'},{id:'b',status:'interrupted'},{id:'c',status:'empty'}]){
 return {load:vi.fn(async(id:string)=>({session:{id,schema:1,captures:captures.map(c=>({...c,mimeType:'audio/webm',durationMs:c.status==='empty'?0:1000}))},version:1})),audio:vi.fn(async(_id:string,captureId:string)=>new Blob([`bytes of ${captureId}`],{type:'audio/webm'})),receipts:vi.fn(async()=>[])} as any;
}
describe('private copy audio by hash',()=>{
 beforeEach(()=>{const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)});});
 it('uploads each capture once across repeated saves, one capture per request, then the small document',async()=>{
  const s=server(),sync=new PrivateAuthoringSync(s.transport),local=store();
  const first=await sync.save(local,'session',null,null,{},'session','owner');
  expect(s.puts().map(p=>p.hash).length).toBe(2);expect(s.puts().every(p=>typeof p.audioBase64==='string'&&!('audio' in p)&&atob(p.audioBase64).startsWith('bytes of '))).toBe(true);
  expect(s.calls.at(-1).operation).toBe('save');expect(s.saves()[0].document.audio.map((a:any)=>a.captureId)).toEqual(['a','b']);expect(s.saves()[0].document.audio.every((a:any)=>!('base64' in a))).toBe(true);
  expect(knownPrivateAudio('owner').size).toBe(2);
  const second=await sync.save(local,'session',first,null,{},'session','owner');await sync.save(local,'session',second,null,{},'session','owner');
  expect(s.puts().length).toBe(2);expect(s.saves().map(save=>save.expectedRevision)).toEqual([null,'r1','r2']);
 });
 it('keeps the record per account',async()=>{const s=server(),sync=new PrivateAuthoringSync(s.transport),local=store();await sync.save(local,'session',null,null,{},'session','owner');await sync.save(local,'session',null,null,{},'session','other');expect(s.puts().length).toBe(4);expect(knownPrivateAudio('other').size).toBe(2);});
 it('a lost local record only causes a harmless re-upload',async()=>{
  const s=server(),sync=new PrivateAuthoringSync(s.transport),local=store();
  const first=await sync.save(local,'session',null,null,{},'session','owner');forgetPrivateAudio('owner');
  await sync.save(local,'session',first,null,{},'session','owner');expect(s.puts().length).toBe(4);expect(s.saves().length).toBe(2);
 });
 it('a record the server contradicts is forgotten and the audio is sent again before the same save',async()=>{
  const s=server(),sync=new PrivateAuthoringSync(s.transport),local=store();
  const first=await sync.save(local,'session',null,null,{},'session','owner');s.audio.clear();
  expect(await sync.save(local,'session',first,null,{},'session','owner')).toBe('r2');
  expect(s.puts().length).toBe(4);expect(s.saves().map(save=>save.expectedRevision)).toEqual([null,'r1','r1']);
 });
 it('stops on a conflict, never retries or overwrites',async()=>{
  const s=server(),sync=new PrivateAuthoringSync(s.transport),local=store();
  const first=await sync.save(local,'session',null,null,{},'session','owner');s.setConflict(true);
  await expect(sync.save(local,'session',first,null,{},'session','owner')).rejects.toBeInstanceOf(PrivateSyncConflict);
  expect(s.saves().length).toBe(2);expect(s.saves()[1].expectedRevision).toBe('r1');expect(s.puts().length).toBe(2);
 });
 it('does nothing while a take is recording',async()=>{
  const s=server(),sync=new PrivateAuthoringSync(s.transport),local=store([{id:'a',status:'ready'},{id:'b',status:'recording'}]);
  await expect(sync.save(local,'session',null,null,{},'session','owner')).rejects.toThrow('Finish the current take');
  expect(s.transport).not.toHaveBeenCalled();expect(local.audio).not.toHaveBeenCalled();
 });
 it('a saved copy restores through the existing importer with the same audio',async()=>{
  const bytes=new Map<string,string>();let saved:any;
  const transport=async(_path:string,init?:RequestInit)=>{const body=JSON.parse(String(init!.body));
   if(body.operation==='audio-put'){bytes.set(body.hash,body.audioBase64);return Response.json({ok:true,hash:body.hash});}
   if(body.operation==='audio-get')return Response.json({audioBase64:bytes.get(body.hash)});
   if(body.operation==='save'){saved=body.document;return Response.json({revision:'r1'});}
   return Response.json({revision:'r1',document:saved});};
  const local=new AuthoringStore('private-sync-'+crypto.randomUUID()),session=createSession(await sourceSnapshot(2,'original','Original.',[{id:'CODE',title:'Code',start:0,end:9}]));
  await local.save(session,0);session.captures.push({id:'clip',recordedAt:session.createdAt,mimeType:'audio/webm',durationMs:1000,status:'ready',origin:'microphone'} as any);
  await local.addImportedAudio(session,1,'clip',new Blob(['spoken words'],{type:'audio/webm'}),1000);
  const sync=new PrivateAuthoringSync(transport);await sync.save(local,session.id,null,null,{},session.id,'owner');
  const restored=await sync.restore(local,session.id,'owner');expect(restored.saved.session.id).not.toBe(session.id);
  expect(await (await local.audio(restored.saved.session.id,'clip')).text()).toBe('spoken words');
 });
 it('without an account uploads every capture, as before',async()=>{const s=server(),sync=new PrivateAuthoringSync(s.transport),local=store();await sync.save(local,'session',null,null,{},'session');await sync.save(local,'session','r1',null,{},'session');expect(s.puts().length).toBe(4);});
 it('sends what the Mac needs with each upload',async()=>{
  const s=server(),sync=new PrivateAuthoringSync(s.transport),local=store();await sync.save(local,'session',null,null,{},'session','owner');
  expect(s.puts()[0].details).toEqual({captureId:'a',durationMs:1000});
  expect(audioDetails({source:{cardNumber:12} as any,markers:[{captureId:'a',atMs:0,sectionId:'12/CODE'},{captureId:'a',atMs:50,sectionId:'12/CODE'},{captureId:'b',atMs:0,sectionId:'12/OTHER'}]},{id:'a',durationMs:4200,recordedAt:'2026-11-01T08:00:00.000Z'}))
   .toEqual({captureId:'a',durationMs:4200,cardNumber:12,sectionId:'12/CODE',recordedAt:'2026-11-01T08:00:00.000Z'});
  expect(audioDetails({source:{cardNumber:12} as any,markers:[{captureId:'a',atMs:0,sectionId:'12/CODE'},{captureId:'a',atMs:50,sectionId:'12/OTHER'}]},{id:'a',durationMs:0,recordedAt:'',visibleCardNumber:7})).toEqual({captureId:'a',cardNumber:7});
 });
 it('asks the account which audio it holds when the local record is lost, and sends none again',async()=>{
  const s=server(true),sync=new PrivateAuthoringSync(s.transport),local=store();
  const first=await sync.save(local,'session',null,null,{},'session','owner');forgetPrivateAudio('owner');
  await sync.save(local,'session',first,null,{},'session','owner');
  expect(s.puts().length).toBe(2);expect(s.calls.filter(c=>c.operation==='audio-has').length).toBe(2);expect(knownPrivateAudio('owner').size).toBe(2);
  await sync.save(local,'session','r2',null,{},'session','owner');expect(s.calls.filter(c=>c.operation==='audio-has').length).toBe(2);
 });
 it('a stale record sends only what the account does not hold',async()=>{
  const s=server(true),sync=new PrivateAuthoringSync(s.transport),local=store();
  const first=await sync.save(local,'session',null,null,{},'session','owner');s.audio.delete([...s.audio][0]);forgetPrivateAudio('owner');
  expect(await sync.save(local,'session',first,null,{},'session','owner')).toBe('r2');expect(s.puts().length).toBe(3);
 });
 it('recognises missing audio by the flag, whatever the words',async()=>{
  const s=server(true),sync=new PrivateAuthoringSync(s.transport),local=store();
  const first=await sync.save(local,'session',null,null,{},'session','owner');s.audio.clear();
  expect(await sync.save(local,'session',first,null,{},'session','owner')).toBe('r2');expect(s.puts().length).toBe(4);
 });
 it('stops after a too_many_recordings answer: no retry, no audio again, until the content changes; hashes are not repeated',async()=>{
  const s=server(true),inner=s.transport;let refuse=true;
  const transport=vi.fn(async(path:string,init?:RequestInit)=>{const body=JSON.parse(String(init!.body));if(body.operation==='save'&&refuse){s.calls.push(body);return Response.json({error:'Too many.',code:'too_many_recordings',retryable:false},{status:413});}return inner(path,init);});
  const sync=new PrivateAuthoringSync(transport),local=store([{id:'h1',status:'ready'},{id:'h2',status:'ready'}]);
  await expect(sync.save(local,'hs',null,null,{},'hs','owner')).rejects.toBeInstanceOf(PrivateCopyStopped);
  const audioReads=local.audio.mock.calls.length,calls=s.calls.length,puts=s.puts().length;
  for(let n=0;n<3;n++)await expect(sync.save(local,'hs',null,{positionMs:n} as any,{},'hs','owner')).rejects.toMatchObject({reason:'too_many_recordings'});
  expect(s.calls.length).toBe(calls);expect(s.puts().length).toBe(puts);expect(local.audio.mock.calls.length).toBe(audioReads);
  refuse=false;const changed=await sync.save(local,'hs',null,null,{voice:'changed'},'hs','owner');expect(changed).toBe('r1');
  expect(local.audio.mock.calls.filter(c=>c[0]==='hs').length).toBe(audioReads);// hashed once per capture; upload did not read anything new either
 });
 it('stops on document_too_large the same way',async()=>{
  const s=server(true),sync=new PrivateAuthoringSync(async()=>Response.json({error:'Big.',code:'document_too_large',retryable:false},{status:413}));void s;
  const local=store([{id:'d1',status:'ready'}]);
  await expect(sync.save(local,'ds',null,null,{},'ds','owner')).rejects.toMatchObject({reason:'document_too_large'});
 });
 it('the stopped lines are plain: they name the way forward and never show a status, "document" or the raw server text',()=>{
  expect(PRIVATE_COPY_LIMIT_LINE.too_many_recordings).toBe('This card has more recordings than one private copy can hold. Everything is still saved on this phone. Start a new session for this card to keep copying.');
  for(const line of Object.values(PRIVATE_COPY_LIMIT_LINE)){expect(line).toMatch(/still saved on this phone\. Start a new session/);expect(line).not.toMatch(/document|Invalid|\b4\d\d\b/i);}
 });
});
