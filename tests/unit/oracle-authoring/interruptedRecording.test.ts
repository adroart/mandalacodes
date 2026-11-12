import 'fake-indexeddb/auto';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {AuthoringStore} from '../../../lib/oracle/authoring/storage';
import {SectionDraftStore,createSectionDraftSession} from '../../../lib/oracle/authoring/sectionDrafts';
import {cardSections} from '../../../lib/oracle/authoring/cardSections';
import {createSession,sourceSnapshot} from '../../../lib/oracle/authoring/workflow';
import {assimilateSections} from '../../../src/mobile/authoring/sectionAssimilation';
import {getTakeSession,queueSectionTake,recoverInterruptedRecordings,retryableTakeFailure,withRecordingDestination,type TakeSession} from '../../../src/mobile/authoring/sectionTakes';
vi.mock('../../../src/mobile/authoring/sectionAssimilation',()=>({assimilateSections:vi.fn()}));
const assimilate=vi.mocked(assimilateSections),audio=new AuthoringStore(),drafts=new SectionDraftStore();
beforeEach(async()=>{vi.clearAllMocks();vi.stubGlobal('window',new EventTarget());const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)});for(const name of ['oracle-section-drafts-v1','oracle-working-cards-v1','oracle-authoring-v1'])await new Promise<void>((resolve,reject)=>{const req=indexedDB.deleteDatabase(name);req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error);});});
const failure=(status:number|undefined,extra:Record<string,unknown>={})=>Object.assign(Error('Plain words.'),status===undefined?{}:{status},extra);
const response=(text:string)=>({provider:'provider',segments:[{text,startMs:0,endMs:1000,timing:'provider' as const,sectionId:'DESIGN'}]});
const result=(sectionId:string,text:string)=>({sections:[{sectionId,text,evidenceQuotes:[text],changes:[],warnings:[]}],unassigned:[]});
async function waitState(id:string,captureId:string,state:string){await vi.waitFor(async()=>expect((await getTakeSession(id))?.takes?.find(t=>t.captureId===captureId)?.state).toBe(state));return (await getTakeSession(id))!;}
/** A session cut off mid-recording: the capture still says 'recording' and has the chunks saved before the reload. */
async function interrupted({chunks=2,destination=true,status='recording' as 'recording'|'interrupted'}={}){
 const markdown='### The drive \u2014 Gate 2\nFirst original drive.\n\n### Where it lives\nThe centre remains.';
 const source=await sourceSnapshot(2,'original',markdown,[{id:'DESIGN',title:'Human Design',start:0,end:markdown.length}]),sections=cardSections(source),session=createSession(source);
 session.captures=[{id:'cut',recordedAt:session.createdAt,mimeType:'audio/webm',durationMs:0,status,origin:'microphone',visibleCardNumber:2}];
 await audio.save(session,0);for(let i=0;i<chunks;i++)await audio.appendChunk(session.id,'cut',i,new Blob([`part ${i}`],{type:'audio/webm'}),(i+1)*1000);
 const draft=await drafts.save({...createSectionDraftSession(source,sections),captureSessionId:session.id,captureId:'cut',state:'recording',...(destination?{recording:{captureId:'cut',sectionId:sections[1].id,markers:[{atMs:0,sectionId:sections[1].id}],intent:'replace'}}:{})} as TakeSession,0);
 return {source,sections,session,draft};
}

describe('retry by status, not by message',()=>{
 it.each([429,502,504,0])('retries a passing failure (%i)',status=>expect(retryableTakeFailure(failure(status))).toBe(true));
 it.each([400,401,403,413,422,503])('never retries what the speaker must act on (%i)',status=>expect(retryableTakeFailure(failure(status))).toBe(false));
 it('lets the server flag win over the status',()=>{expect(retryableTakeFailure(failure(502,{retryable:false}))).toBe(false);expect(retryableTakeFailure(failure(400,{retryable:true}))).toBe(true);});
 it('retries a dropped connection or client timeout with no status',()=>{expect(retryableTakeFailure(new TypeError('Failed to fetch'))).toBe(true);expect(retryableTakeFailure(new TypeError('Load failed'))).toBe(true);expect(retryableTakeFailure(new DOMException('signal timed out','TimeoutError'))).toBe(true);});
 it('a failed take keeps its status as a quiet detail and schedules a retry only when passing',async()=>{
  const {source,sections,session,draft}=await interrupted({destination:false,status:'interrupted'});
  const saved=(await audio.load(session.id))!;await audio.save({...saved.session,captures:saved.session.captures.map(c=>({...c,durationMs:2000}))},saved.version);
  const busy=vi.fn().mockRejectedValueOnce(Object.assign(Error('Too many recordings are being prepared right now. Yours is saved and will be tried again shortly.'),{status:429,detail:'429',retryable:true}));
  await queueSectionTake(draft.id,'cut',sections[0].id,{loadSource:async()=>source,transcribe:busy});
  const failed=await waitState(draft.id,'cut','failed');const take=failed.takes![0];
  expect(take.errorDetail).toBe('429');expect(take.retryAt).toBeGreaterThan(Date.now());
  const {draft:other,sections:s2,source:src2}=await interrupted({destination:false,status:'interrupted'});
  const silent=vi.fn().mockRejectedValueOnce(Object.assign(Error('No speech was heard in this recording. It is saved on this device. Record the section again.'),{status:422,detail:'422'}));
  await queueSectionTake(other.id,'cut',s2[0].id,{loadSource:async()=>src2,transcribe:silent});
  const final=await waitState(other.id,'cut','failed');expect(final.takes![0].retryAt).toBeUndefined();expect(final.takes![0].errorDetail).toBe('422');
 });
});

describe('a recording cut off by a reload',()=>{
 it('is closed with its saved audio and prepared for its section exactly once',async()=>{
  const {source,sections,session,draft}=await interrupted();
  const transcribe=vi.fn(async()=>response('Words said before the reload.'));assimilate.mockResolvedValue(result(sections[1].id,'Words said before the reload.'));
  const services={loadSource:async()=>source,transcribe};
  const first=await recoverInterruptedRecordings(draft.id,services);
  expect(first).toMatchObject({queued:1,saved:0});
  const capture=(await audio.load(session.id))!.session.captures[0];expect(capture.status).toBe('interrupted');expect(capture.durationMs).toBe(2000);
  const reviewed=await waitState(draft.id,'cut','review');
  expect(reviewed.takes).toHaveLength(1);expect(reviewed.takes![0]).toMatchObject({startSectionId:sections[1].id,intent:'replace'});
  expect(reviewed.state).not.toBe('recording');expect(reviewed.recording).toBeUndefined();
  const again=await recoverInterruptedRecordings(draft.id,services);
  expect(again).toMatchObject({queued:0,saved:0});expect(transcribe).toHaveBeenCalledTimes(1);
 });
 it('finishes a recording closed earlier whose queueing was itself cut off',async()=>{
  const {source,sections,draft}=await interrupted({status:'interrupted'});
  const transcribe=vi.fn(async()=>response('Kept words.'));assimilate.mockResolvedValue(result(sections[1].id,'Kept words.'));
  expect(await recoverInterruptedRecordings(draft.id,{loadSource:async()=>source,transcribe})).toMatchObject({queued:1});
  await waitState(draft.id,'cut','review');expect(transcribe).toHaveBeenCalledTimes(1);
 });
 it('stays saved with the other recordings when its section is not known',async()=>{
  const {source,session,draft}=await interrupted({destination:false});const transcribe=vi.fn();
  const recovered=await recoverInterruptedRecordings(draft.id,{loadSource:async()=>source,transcribe});
  expect(recovered).toMatchObject({queued:0,saved:1});expect(recovered.session?.takes??[]).toHaveLength(0);expect(recovered.session?.state).toBe('ready');
  expect((await audio.load(session.id))!.session.captures[0].status).toBe('interrupted');expect(transcribe).not.toHaveBeenCalled();
 });
 it('queues a finished recording whose queueing failed, from the destination kept when the next one started',async()=>{
  const {source,sections,session,draft}=await interrupted({status:'interrupted'});
  // The take finished ('ready') and the next take of the pass started before it could be queued.
  const saved=(await audio.load(session.id))!;await audio.save({...saved.session,captures:saved.session.captures.map(c=>({...c,status:'ready' as const,durationMs:2000}))},saved.version);
  const moved=withRecordingDestination((await getTakeSession(draft.id))!,{captureId:'next',sectionId:sections[0].id,markers:[{atMs:0,sectionId:sections[0].id}]});
  expect(moved.recording?.captureId).toBe('next');expect(moved.earlierRecordings?.map(item=>item.captureId)).toEqual(['cut']);
  await drafts.save(moved,(await getTakeSession(draft.id))!.version);
  const transcribe=vi.fn(async()=>response('Words of the first take.'));assimilate.mockResolvedValue(result(sections[1].id,'Words of the first take.'));
  const services={loadSource:async()=>source,transcribe};
  expect(await recoverInterruptedRecordings(draft.id,services)).toMatchObject({queued:1,saved:0});
  const reviewed=await waitState(draft.id,'cut','review');expect(reviewed.takes![0]).toMatchObject({startSectionId:sections[1].id,intent:'replace'});
  expect(withRecordingDestination(reviewed,undefined).earlierRecordings).toBeUndefined();
  expect(await recoverInterruptedRecordings(draft.id,services)).toMatchObject({queued:0,saved:0});expect(transcribe).toHaveBeenCalledTimes(1);
 });
 it('leaves a finished recording with no known section listed with the saved recordings',async()=>{
  const {source,session,draft}=await interrupted({destination:false,status:'interrupted'});const transcribe=vi.fn();
  const saved=(await audio.load(session.id))!;await audio.save({...saved.session,captures:saved.session.captures.map(c=>({...c,durationMs:2000}))},saved.version);
  expect(await recoverInterruptedRecordings(draft.id,{loadSource:async()=>source,transcribe})).toMatchObject({queued:0,saved:0});
  expect((await audio.load(session.id))!.session.captures[0]).toMatchObject({status:'interrupted'});expect(transcribe).not.toHaveBeenCalled();
 });
 it('drops a recording that saved no audio and never touches the live one',async()=>{
  const empty=await interrupted({chunks:0});const transcribe=vi.fn();
  expect(await recoverInterruptedRecordings(empty.draft.id,{loadSource:async()=>empty.source,transcribe})).toMatchObject({queued:0,saved:0});
  expect((await audio.load(empty.session.id))!.session.captures[0].status).toBe('empty');
  const live=await interrupted();
  expect(await recoverInterruptedRecordings(live.draft.id,{loadSource:async()=>live.source,transcribe},'cut')).toMatchObject({queued:0,saved:0});
  expect((await audio.load(live.session.id))!.session.captures[0].status).toBe('recording');expect((await getTakeSession(live.draft.id))!.state).toBe('recording');
  expect(transcribe).not.toHaveBeenCalled();
 });
});
