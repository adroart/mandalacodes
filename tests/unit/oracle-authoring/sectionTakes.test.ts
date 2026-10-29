import 'fake-indexeddb/auto';
import {beforeEach,expect,it,vi} from 'vitest';
import {AuthoringStore} from '../../../lib/oracle/authoring/storage';
import {SectionDraftStore,createSectionDraftSession} from '../../../lib/oracle/authoring/sectionDrafts';
import {cardSections} from '../../../lib/oracle/authoring/cardSections';
import {createSession,sourceSnapshot} from '../../../lib/oracle/authoring/workflow';
import {assimilateSections} from '../../../src/mobile/authoring/sectionAssimilation';
import {discardSectionTake,getTakeSession,queueSectionTake,restoreSectionTake,resumeSectionTakes,type TakeSession} from '../../../src/mobile/authoring/sectionTakes';
vi.mock('../../../src/mobile/authoring/sectionAssimilation',()=>({assimilateSections:vi.fn()}));
const assimilate=vi.mocked(assimilateSections),audio=new AuthoringStore(),drafts=new SectionDraftStore();
beforeEach(async()=>{vi.clearAllMocks();vi.stubGlobal('window',new EventTarget());const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)});for(const name of ['oracle-section-drafts-v1','oracle-working-cards-v1','oracle-authoring-v1'])await new Promise<void>((resolve,reject)=>{const req=indexedDB.deleteDatabase(name);req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error);});});
async function fixture(count=1){
 const markdown='### The drive — Gate 2\nFirst original drive.\n\n### Where it lives\nThe centre remains.';
 const source=await sourceSnapshot(2,'original',markdown,[{id:'DESIGN',title:'Human Design',start:0,end:markdown.length}]),sections=cardSections(source),session=createSession(source);
 session.captures=Array.from({length:count},(_,index)=>({id:`clip-${index+1}`,recordedAt:session.createdAt,mimeType:'audio/wav',durationMs:1000,status:'ready' as const,origin:'microphone' as const,visibleCardNumber:2}));
 await audio.save(session,0);for(const capture of session.captures)await audio.appendChunk(session.id,capture.id,0,new Blob([`Audio ${capture.id}`],{type:'audio/wav'}),1000);
 const draft=await drafts.save({...createSectionDraftSession(source,sections),captureSessionId:session.id,captureId:'clip-1'},0);
 return {source,sections,session,draft};
}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};}
const response=(text:string)=>({provider:'provider',segments:[{text,startMs:0,endMs:1000,timing:'provider' as const,sectionId:'DESIGN'}]});
const result=(sectionId:string,text:string)=>({sections:[{sectionId,text,evidenceQuotes:[text],changes:[],warnings:[]}],unassigned:[]});
async function waitState(id:string,captureId:string,state:string){await vi.waitFor(async()=>expect((await getTakeSession(id))?.takes?.find(t=>t.captureId===captureId)?.state).toBe(state));return (await getTakeSession(id))!;}
it('returns a durable queued take immediately and preserves another active recording during processing',async()=>{
 const {source,sections,session,draft}=await fixture(2),pending=deferred<ReturnType<typeof response>>();
 const saved=(await audio.load(session.id))!;await audio.save({...saved.session,captures:saved.session.captures.map(c=>c.id==='clip-2'?{...c,status:'recording'}:c)},saved.version);
 const transcribe=vi.fn((_session:unknown,_capture:{id:string})=>pending.promise);assimilate.mockResolvedValue(result(sections[0].id,'My direction.'));
 const registered=await queueSectionTake(draft.id,'clip-1',sections[0].id,{loadSource:async()=>source,transcribe});
 expect(registered.takes?.[0].state).toBe('queued');await waitState(draft.id,'clip-1','transcribing');
 pending.resolve(response('My direction.'));const completed=await waitState(draft.id,'clip-1','review');
 expect(transcribe).toHaveBeenCalledTimes(1);expect(transcribe.mock.calls[0][1].id).toBe('clip-1');expect(completed.state).toBe('recording');expect(completed.results[0].takeIds).toEqual(['clip-1']);
 expect((await audio.load(session.id))!.session.captures[1].status).toBe('recording');expect(await(await audio.audio(session.id,'clip-2')).text()).toBe('Audio clip-2');
});
it('merges parallel takes into separate named sections and aggregates original speech chronologically',async()=>{
 const {source,sections,draft}=await fixture(2);const transcribe=vi.fn(async(_session,capture)=>response(capture.id==='clip-1'?'My drive.':'My centre.'));
 assimilate.mockImplementation(async input=>result(input.startSectionId,input.words));const services={loadSource:async()=>source,transcribe};
 await Promise.all([queueSectionTake(draft.id,'clip-1',sections[0].id,services),queueSectionTake(draft.id,'clip-2',sections[1].id,services)]);
 await waitState(draft.id,'clip-1','review');const completed=await waitState(draft.id,'clip-2','review');
 expect(completed.results.map(r=>r.text)).toEqual(['My drive.','My centre.']);expect(completed.results.every(r=>!r.checked&&!r.applied)).toBe(true);expect(completed.rawTranscript).toBe('My drive.\nMy centre.');
 await queueSectionTake(draft.id,'clip-1',sections[0].id,services);expect(transcribe).toHaveBeenCalledTimes(2);expect(assimilate).toHaveBeenCalledTimes(2);
});
it('protects a section edited while its replacement is being prepared',async()=>{
 const {source,sections,draft}=await fixture();const pending=deferred<ReturnType<typeof result>>();assimilate.mockReturnValue(pending.promise);
 await queueSectionTake(draft.id,'clip-1',sections[0].id,{loadSource:async()=>source,transcribe:async()=>response('Spoken revision.')});await waitState(draft.id,'clip-1','assimilating');
 const current=(await getTakeSession(draft.id))!;await drafts.save({...current,results:[{...result(sections[0].id,'New manual words.').sections[0],checked:true}]},current.version);
 pending.resolve(result(sections[0].id,'Spoken revision.'));const failed=await waitState(draft.id,'clip-1','failed');expect(failed.results[0].text).toBe('New manual words.');expect(failed.takes?.[0].error).toContain('edited or integrated');
});
it('keeps discarded in-flight takes discarded, retains audio, and restores from their cached transcript',async()=>{
 const {source,sections,session,draft}=await fixture();const pending=deferred<ReturnType<typeof result>>(),transcribe=vi.fn(async()=>response('My direction.'));assimilate.mockReturnValueOnce(pending.promise).mockResolvedValue(result(sections[0].id,'My direction.'));const services={loadSource:async()=>source,transcribe};
 await queueSectionTake(draft.id,'clip-1',sections[0].id,services);await waitState(draft.id,'clip-1','assimilating');await discardSectionTake(draft.id,'clip-1');pending.resolve(result(sections[0].id,'My direction.'));
 await vi.waitFor(async()=>{expect((await getTakeSession(draft.id))!.takes?.[0].state).toBe('discarded');expect((await getTakeSession(draft.id))!.results).toEqual([]);});
 // Let the completed background promise release its in-flight key before restoring.
 await new Promise(resolve=>setTimeout(resolve,20));await queueSectionTake(draft.id,'clip-1',sections[0].id,services);expect((await getTakeSession(draft.id))!.takes?.[0].state).toBe('discarded');
 await restoreSectionTake(draft.id,'clip-1',services);const restored=await waitState(draft.id,'clip-1','review');expect(restored.results[0].text).toBe('My direction.');expect(transcribe).toHaveBeenCalledTimes(1);expect(await(await audio.audio(session.id,'clip-1')).text()).toBe('Audio clip-1');
});
it('persists failures and retries AI from cached speech without transcribing again',async()=>{
 const {source,sections,draft}=await fixture();const transcribe=vi.fn(async()=>response('My direction.'));assimilate.mockRejectedValueOnce(Error('AI temporarily unavailable')).mockResolvedValue(result(sections[0].id,'My direction.'));const services={loadSource:async()=>source,transcribe};
 await queueSectionTake(draft.id,'clip-1',sections[0].id,services);const failed=await waitState(draft.id,'clip-1','failed');expect(failed.takes?.[0].error).toContain('temporarily unavailable');
 await queueSectionTake(draft.id,'clip-1',sections[0].id,services);await waitState(draft.id,'clip-1','review');expect(transcribe).toHaveBeenCalledTimes(1);
});
it('resumes persisted queued jobs and refuses to discard integrated words',async()=>{
 const {source,sections,draft}=await fixture();await drafts.save({...draft,takes:[{id:'clip-1',captureId:'clip-1',startSectionId:sections[0].id,markers:[],state:'queued',createdAt:draft.createdAt}]} as TakeSession,draft.version);
 assimilate.mockResolvedValue(result(sections[0].id,'My direction.'));await resumeSectionTakes({loadSource:async()=>source,transcribe:async()=>response('My direction.')});const reviewed=await waitState(draft.id,'clip-1','review');
 await drafts.save({...reviewed,results:reviewed.results.map(r=>({...r,checked:true,applied:true,appliedText:r.text}))},reviewed.version);await expect(discardSectionTake(draft.id,'clip-1')).rejects.toThrow('integrated');expect((await getTakeSession(draft.id))!.results[0].applied).toBe(true);
});
it('safely discards one legacy test take but preserves ambiguous multi-take drafts',async()=>{
 const {sections,session,draft}=await fixture();const edited=await drafts.save({...draft,rawTranscript:'Testing.',results:[{...result(sections[0].id,'Testing.').sections[0],checked:false}]},draft.version);
 const discarded=await discardSectionTake(edited.id,'clip-1');expect(discarded.results).toEqual([]);expect(discarded.rawTranscript).toBe('');expect(discarded.takes?.[0].state).toBe('discarded');expect(await(await audio.audio(session.id,'clip-1')).text()).toBe('Audio clip-1');
 const multiple=await fixture(2);await expect(discardSectionTake(multiple.draft.id,'clip-1')).rejects.toThrow('several recordings');
});
