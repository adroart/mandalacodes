import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
vi.mock('../../../functions/api/_lib/auth.ts',()=>({requireAdmin:vi.fn(async()=>({userId:'owner'}))}));
import {requireAdmin} from '../../../functions/api/_lib/auth.ts';
import {onRequestPost as sync} from '../../../functions/api/oracle/authoring/private';
import {onRequestPost as process} from '../../../functions/api/oracle/authoring/process';
import {boundedJson} from '../../../functions/api/oracle/authoring/_shared';
const request=(body:unknown,origin='capacitor://localhost')=>new Request('https://mandalacodes.com/api/oracle/authoring/private',{method:'POST',headers:{Origin:origin},body:JSON.stringify(body)});
describe('private hosted authoring',()=>{
 afterEach(()=>vi.unstubAllGlobals());
 beforeEach(()=>{vi.clearAllMocks();vi.mocked(requireAdmin).mockResolvedValue({userId:'owner'} as any);});
 it('requires authentication before reading private storage',async()=>{vi.mocked(requireAdmin).mockResolvedValue(new Response('',{status:401}));const get=vi.fn();expect((await sync({request:request({operation:'read',id:'session'}),env:{ORACLE_PRIVATE:{get} as any}})).status).toBe(401);expect(get).not.toHaveBeenCalled();});
 it('rejects foreign origins before account access',async()=>{expect((await sync({request:request({},'https://evil.example'),env:{}})).status).toBe(403);expect(requireAdmin).not.toHaveBeenCalled();});
 it('uses conditional revision writes and reports races as conflicts',async()=>{const put=vi.fn().mockResolvedValue(null);const response=await sync({request:request({operation:'save',id:'session',expectedRevision:'previous',document:{session:{schema:1,id:'session'},audio:[]}}),env:{ORACLE_PRIVATE:{put} as any}});expect(response.status).toBe(409);expect(put).toHaveBeenCalledWith('authoring/owner/sessions/session',expect.any(String),expect.objectContaining({onlyIf:{etagMatches:'previous'}}));});
 it('creates with if-none-match, never an unconditional overwrite',async()=>{const put=vi.fn().mockResolvedValue({etag:'first'});expect((await sync({request:request({operation:'save',id:'session',expectedRevision:null,document:{session:{schema:1,id:'session'},audio:[]}}),env:{ORACLE_PRIVATE:{put} as any}})).status).toBe(200);expect(put.mock.calls[0][2].onlyIf).toEqual({etagDoesNotMatch:'*'});});
 it('rejects traversal and missing audio references',async()=>{expect((await sync({request:request({operation:'read',id:'../other'}),env:{ORACLE_PRIVATE:{} as any}})).status).toBe(400);const put=vi.fn();expect((await sync({request:request({operation:'save',id:'session',expectedRevision:null,document:{session:{schema:1,id:'session'},audio:[{captureId:'capture',hash:'a'.repeat(64)}]}}),env:{ORACLE_PRIVATE:{put,head:vi.fn().mockResolvedValue(null)} as any}})).status).toBe(400);expect(put).not.toHaveBeenCalled();});
 it('bounds chunked request bodies without content-length',async()=>{await expect(boundedJson(request({data:'x'.repeat(100)}),20)).rejects.toThrow('body_too_large');});
 it('requests direct JSON review and preserves the exact comparison baseline',async()=>{
  const words='I trust my direction.',original='The original reading.';
  const output={sections:[{sectionId:'2/DESIGN/the-drive',text:words,evidenceQuotes:[words],changes:[],warnings:[]}],unassigned:[]};
  const provider=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(output)}}]}),{headers:{'Content-Type':'application/json'}}));vi.stubGlobal('fetch',provider);
  const response=await process({request:request({operation:'assimilate-sections',assimilation:{words,sections:[{id:'2/DESIGN/the-drive',title:'The drive',path:['Human Design','The drive'],text:original}],startSectionId:'2/DESIGN/the-drive'}}),env:{OPENAI_API_KEY:'test-server-key',ORACLE_WRITING_MODEL:'configured-model'}});
  expect(response.status).toBe(200);expect((await response.json() as any).assimilation.sections[0].comparisonOriginal).toBe(original);
  const sent=JSON.parse(provider.mock.calls[0][1].body);expect(sent.response_format).toEqual({type:'json_object'});expect(sent.messages[0].content).not.toContain('Return ONLY an artifact');expect(sent.messages[0].content).toContain('Return ONLY a JSON object');expect(sent.model).toBe('configured-model');
 });
 it('fails honestly when hosted providers are not configured',async()=>{const result=await process({request:request({operation:'transcribe'}),env:{}});expect(result.status).toBe(503);expect(await result.json()).toMatchObject({error:expect.stringContaining('not configured')});});
});
describe('private audio details, audio-has, better-get and missingAudio',()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.mocked(requireAdmin).mockResolvedValue({userId:'owner'} as any);});
 const bytes=new TextEncoder().encode('spoken words'),b64=btoa('spoken words');
 const hashOf=async()=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 function bucket(){
  const objects=new Map<string,{value:any;etag:string;httpMetadata?:any;customMetadata?:any}>();let n=0;
  return {objects,
   head:vi.fn(async(key:string)=>{const o=objects.get(key);return o?{key,etag:o.etag,httpMetadata:o.httpMetadata,customMetadata:o.customMetadata}:null;}),
   list:vi.fn(async(o:{prefix:string})=>({objects:[...objects.keys()].filter(k=>k.startsWith(o.prefix)).sort().map(key=>({key})),truncated:false})),
   get:vi.fn(async(key:string)=>{const o=objects.get(key);return o?{json:async()=>JSON.parse(o.value)}:null;}),
   put:vi.fn(async(key:string,value:any,options:any={})=>{const old=objects.get(key);if(options.onlyIf?.etagDoesNotMatch==='*'&&old)return null;if(options.onlyIf?.etagMatches&&old?.etag!==options.onlyIf.etagMatches)return null;objects.set(key,{value,etag:`e${++n}`,httpMetadata:options.httpMetadata,customMetadata:options.customMetadata});return {etag:`e${n}`};}),
  };
 }
 it('stores valid take details as metadata and drops invalid ones',async()=>{
  const b=bucket(),hash=await hashOf();
  const response=await sync({request:request({operation:'audio-put',hash,mimeType:'audio/mp4',audioBase64:b64,details:{durationMs:4200,cardNumber:12,sectionId:'12/CODE',captureId:'cap-1',recordedAt:'2026-11-01T08:00:00Z',extra:'x'.repeat(5000)}}),env:{ORACLE_PRIVATE:b as any}});
  expect(response.status).toBe(200);
  expect(b.objects.get(`authoring/owner/audio/${hash}`)!.customMetadata).toEqual({v:'1',durationMs:'4200',cardNumber:'12',sectionId:'12/CODE',captureId:'cap-1',recordedAt:'2026-11-01T08:00:00.000Z'});
  b.objects.clear();
  await sync({request:request({operation:'audio-put',hash,mimeType:'audio/mp4',audioBase64:b64,details:{durationMs:'long',cardNumber:0,captureId:'../x',sectionId:7}}),env:{ORACLE_PRIVATE:b as any}});
  expect(b.objects.get(`authoring/owner/audio/${hash}`)!.customMetadata).toEqual({v:'1'});
  b.objects.clear();
  await sync({request:request({operation:'audio-put',hash,mimeType:'audio/mp4',audioBase64:b64}),env:{ORACLE_PRIVATE:b as any}});
  expect(b.objects.get(`authoring/owner/audio/${hash}`)!.customMetadata).toBeUndefined();
 });
 it('gives details to audio kept before they existed, and never rewrites audio that has them',async()=>{
  const b=bucket(),hash=await hashOf(),key=`authoring/owner/audio/${hash}`;
  b.objects.set(key,{value:bytes,etag:'old',httpMetadata:{contentType:'audio/webm'}});
  await sync({request:request({operation:'audio-put',hash,mimeType:'audio/mp4',audioBase64:b64,details:{cardNumber:3}}),env:{ORACLE_PRIVATE:b as any}});
  expect(b.objects.get(key)).toMatchObject({customMetadata:{v:'1',cardNumber:'3'},httpMetadata:{contentType:'audio/webm'}});
  b.put.mockClear();
  await sync({request:request({operation:'audio-put',hash,mimeType:'audio/mp4',audioBase64:b64,details:{cardNumber:4}}),env:{ORACLE_PRIVATE:b as any}});
  expect(b.put).toHaveBeenCalledTimes(1);expect(b.objects.get(key)!.customMetadata.cardNumber).toBe('3');
 });
 it('flags a save that references audio not uploaded',async()=>{
  const b=bucket(),response=await sync({request:request({operation:'save',id:'session',expectedRevision:null,document:{session:{schema:1,id:'session'},audio:[{captureId:'capture',hash:'a'.repeat(64)}]}}),env:{ORACLE_PRIVATE:b as any}});
  expect(response.status).toBe(400);expect(await response.json()).toMatchObject({missingAudio:true,code:'invalid_request',error:'Upload all private audio before saving.'});
 });
 it('audio-has answers which hashes the caller holds, from its own prefix, at most 100',async()=>{
  const b=bucket();b.objects.set(`authoring/owner/audio/${'a'.repeat(64)}`,{value:'',etag:'1'});b.objects.set(`authoring/other/audio/${'b'.repeat(64)}`,{value:'',etag:'2'});
  const response=await sync({request:request({operation:'audio-has',hashes:['a'.repeat(64),'b'.repeat(64),'c'.repeat(64)]}),env:{ORACLE_PRIVATE:b as any}});
  expect(await response.json()).toEqual({present:['a'.repeat(64)]});
  for(const key of b.head.mock.calls.map(c=>c[0]))expect(key).toMatch(/^authoring\/owner\/audio\//);
  expect((await sync({request:request({operation:'audio-has',hashes:Array.from({length:101},(_,i)=>i.toString(16).padStart(64,'0'))}),env:{ORACLE_PRIVATE:b as any}})).status).toBe(400);
  expect((await sync({request:request({operation:'audio-has',hashes:['../x']}),env:{ORACLE_PRIVATE:b as any}})).status).toBe(400);
 });
 it('better-get returns only the caller\'s own results',async()=>{
  const b=bucket(),mine='a'.repeat(64),theirs='b'.repeat(64);
  const record=(hash:string,text:string)=>JSON.stringify({format:'oracle-take-better',version:1,audioHash:hash,outcome:'improved',receivedAt:'2026-11-02T00:00:00.000Z',resultHash:'c'.repeat(64),engine:'ar-create',engineVersion:null,text,segments:[],words:[{text:'I',startMs:0,endMs:100,probability:0.3}],speakers:[]});
  b.objects.set(`authoring/owner/better/${mine}.json`,{value:record(mine,'Mine.'),etag:'1'});
  b.objects.set(`authoring/other/better/${theirs}.json`,{value:record(theirs,'Theirs.'),etag:'2'});
  b.objects.set(`authoring/owner/better/${'d'.repeat(64)}.json`,{value:JSON.stringify({format:'oracle-take-better',version:1,audioHash:'d'.repeat(64),outcome:'skipped',receivedAt:'x',reason:'no speech'}),etag:'3'});
  const body:any=await (await sync({request:request({operation:'better-get',hashes:[mine,theirs,'d'.repeat(64)]}),env:{ORACLE_PRIVATE:b as any}})).json();
  expect(body.results).toEqual([expect.objectContaining({hash:mine,text:'Mine.',engine:'ar-create',resultHash:'c'.repeat(64)})]);
  expect(body.skipped).toEqual(['d'.repeat(64)]);expect(JSON.stringify(body)).not.toContain('Theirs');
  for(const key of b.get.mock.calls.map(c=>c[0]))expect(key).toMatch(/^authoring\/owner\/better\/[a-f0-9]{64}\.json$/);
  vi.mocked(requireAdmin).mockResolvedValue({userId:'other'} as any);
  const other:any=await (await sync({request:request({operation:'better-get',hashes:[mine]}),env:{ORACLE_PRIVATE:b as any}})).json();
  expect(other.results).toEqual([]);
  expect((await sync({request:request({operation:'better-get',hashes:Array.from({length:51},(_,i)=>i.toString(16).padStart(64,'0'))}),env:{ORACLE_PRIVATE:b as any}})).status).toBe(400);
  vi.mocked(requireAdmin).mockResolvedValue(new Response('',{status:401}));
  expect((await sync({request:request({operation:'better-get',hashes:[mine]}),env:{ORACLE_PRIVATE:b as any}})).status).toBe(401);
 });
 it('accepts 101 and 600 audio references, refuses 601 with 413 too_many_recordings, and keeps malformed documents at 400',async()=>{
  const refs=(n:number)=>Array.from({length:n},(_,i)=>({captureId:'c'+i,hash:String(i%10).repeat(64)}));
  const env=()=>({ORACLE_PRIVATE:{put:vi.fn().mockResolvedValue({etag:'e'}),head:vi.fn().mockResolvedValue({}),list:vi.fn().mockResolvedValue({objects:Array.from({length:10},(_,i)=>({key:`authoring/owner/audio/${String(i).repeat(64)}`})),truncated:false})} as any});
  const save=(document:unknown)=>sync({request:request({operation:'save',id:'session',expectedRevision:null,document}),env:env()});
  for(const n of [101,600])expect((await save({session:{schema:1,id:'session'},audio:refs(n)})).status).toBe(200);
  const many=await save({session:{schema:1,id:'session'},audio:refs(601)});
  expect(many.status).toBe(413);expect(await many.json()).toEqual({error:expect.stringMatching(/^[^.]+\. Your local work is safe\.$/),code:'too_many_recordings',retryable:false});
  const bad=await save({session:{schema:1,id:'session'},audio:'nope'});expect(bad.status).toBe(400);expect(await bad.json()).toMatchObject({code:'invalid_request',error:'Invalid document.'});
 });
 it('refuses a document over 6 MiB with 413 document_too_large',async()=>{
  const response=await sync({request:request({operation:'save',id:'session',expectedRevision:null,document:{session:{schema:1,id:'session',pad:'x'.repeat(6*1024*1024)},audio:[]}}),env:{ORACLE_PRIVATE:{put:vi.fn(),head:vi.fn()} as any}});
  expect(response.status).toBe(413);expect(await response.json()).toMatchObject({code:'document_too_large',retryable:false});
 });
 describe('save confirms audio with a bounded listing',()=>{
  const hex=(i:number)=>i.toString(16).padStart(64,'0');
  const refs=(n:number)=>Array.from({length:n},(_,i)=>({captureId:'c'+i,hash:hex(i)}));
  const fake=(held:string[],pageSize=1000)=>{
   const keys=held.map(h=>`authoring/owner/audio/${h}`).sort();
   return {
    put:vi.fn().mockResolvedValue({etag:'e'}),head:vi.fn(async(key:string)=>keys.includes(key)?{key}:null),
    list:vi.fn(async(o:{prefix:string;cursor?:string})=>{const rest=keys.filter(k=>k.startsWith(o.prefix)&&(!o.cursor||k>o.cursor));const page=rest.slice(0,pageSize);const truncated=rest.length>page.length;return {objects:page.map(key=>({key})),truncated,cursor:truncated?page[page.length-1]:undefined};}),
   };
  };
  const save=(b:any,n:number)=>sync({request:request({operation:'save',id:'session',expectedRevision:null,document:{session:{schema:1,id:'session'},audio:refs(n)}}),env:{ORACLE_PRIVATE:b}});
  it('saves 600 references with a handful of calls and never lists outside the user prefix',async()=>{
   const b=fake(refs(600).map(r=>r.hash));
   expect((await save(b,600)).status).toBe(200);
   expect(b.list.mock.calls.length+b.head.mock.calls.length).toBeLessThanOrEqual(10);
   expect(b.head).not.toHaveBeenCalled();
   for(const [o] of b.list.mock.calls)expect(o.prefix).toBe('authoring/owner/audio/');
  });
  it('refuses and flags a document with a missing reference',async()=>{
   const b=fake(refs(600).slice(1).map(r=>r.hash));
   const response=await save(b,600);
   expect(response.status).toBe(400);expect(await response.json()).toMatchObject({missingAudio:true});
   expect(b.put).not.toHaveBeenCalled();expect(b.head).not.toHaveBeenCalled();
  });
  it('past the list cap heads only a few remaining references, and refuses when too many remain',async()=>{
   const all=refs(600).map(r=>r.hash);
   const few=fake(all,10);// 600 keys at 10 per page need 60 pages: the 10-call cap is reached first
   expect((await save(few,600)).status).toBe(400);
   expect(few.list).toHaveBeenCalledTimes(10);expect(few.head).not.toHaveBeenCalled();
   const near=fake(all,10);
   expect((await save(near,100)).status).toBe(200);
   expect(near.list.mock.calls.length+near.head.mock.calls.length).toBeLessThanOrEqual(10+40);
   const heads=fake(all,10);
   expect((await save(heads,140)).status).toBe(200);
   expect(heads.list).toHaveBeenCalledTimes(10);expect(heads.head.mock.calls.length).toBeLessThanOrEqual(40);
  });
 });
});
