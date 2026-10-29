import 'fake-indexeddb/auto';
import {beforeEach,expect,it,vi} from 'vitest';
import {AuthoringStore} from '../../../lib/oracle/authoring/storage';
import {SectionDraftStore,createSectionDraftSession,integrateSectionDraft} from '../../../lib/oracle/authoring/sectionDrafts';
import {WorkingCardStore} from '../../../lib/oracle/authoring/humanDrafts';
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
it('loads only explicit destination cards and saves their drafts under the correct source',async()=>{
 const {source,sections,draft}=await fixture();
 const markdown='### The drive — Gate 14\nFourteen original.';
 const other=await sourceSnapshot(14,'original',markdown,[{id:'DESIGN',title:'Human Design',start:0,end:markdown.length}]),destination=cardSections(other)[0];
 const words='My drive. Next card fourteen. My fourteen words.';
 const loadSource=vi.fn(async(number:number)=>number===14?other:source);
 assimilate.mockImplementation(async input=>{
  expect(input.relatedSources?.[0].cardNumber).toBe(14);expect(input.relatedSources?.[0].sections[0].text).toBe('Fourteen original.');
  return {sections:[...result(sections[0].id,'My drive.').sections,...result(destination.id,'My fourteen words.').sections],unassigned:[]};
 });
 await queueSectionTake(draft.id,'clip-1',sections[0].id,{loadSource,transcribe:async()=>response(words)});
 const saved=await waitState(draft.id,'clip-1','review');expect(loadSource).toHaveBeenCalledWith(14);
 expect(saved.results.map(r=>r.sectionId)).toEqual([sections[0].id]);expect(saved.linkedSessionIds).toHaveLength(1);
 const linked=(await drafts.get(saved.linkedSessionIds![0]))!;expect((await audio.load(saved.captureSessionId!))!.session.relatedSources?.map(source=>source.cardNumber)).toEqual([14]);expect((linked as TakeSession).takes?.every(take=>take.state==='review')).toBe(true);expect(linked.cardNumber).toBe(14);expect(linked.sourceHash).toBe(other.hash);expect(linked.results[0].comparisonOriginal).toBe('Fourteen original.');expect(linked.captureSessionId).toBe(saved.captureSessionId);expect(linked.rawTranscript).toBe(words);
 const resumedTranscribe=vi.fn(async()=>response(words));await resumeSectionTakes({loadSource,transcribe:resumedTranscribe});await new Promise(resolve=>setTimeout(resolve,30));expect(assimilate).toHaveBeenCalledTimes(1);expect(resumedTranscribe).not.toHaveBeenCalled();expect((await getTakeSession(linked.id))!.takes?.every(take=>take.state==='review')).toBe(true);
 await expect(discardSectionTake(draft.id,'clip-1')).rejects.toThrow('another card');
});
it('does not load a card from an incidental gate reference and records the exact latest comparison baseline',async()=>{
 const {source,sections,draft}=await fixture();
 const integrated=await drafts.save({...draft,results:[{...result(sections[0].id,'My earlier human writing.').sections[0],checked:true,applied:true,appliedText:'My earlier human writing.',beforeText:sections[0].text,appliedAt:new Date().toISOString()}]},draft.version);
 const loadSource=vi.fn(async()=>source);assimilate.mockImplementation(async input=>{expect(input.sections[0].text).toBe('My earlier human writing.');return result(sections[0].id,'A connection with gate fourteen.');});
 await queueSectionTake(integrated.id,'clip-1',sections[0].id,{loadSource,transcribe:async()=>response('A connection with gate fourteen.')});
 const saved=await waitState(draft.id,'clip-1','review');expect(loadSource).not.toHaveBeenCalled();expect(saved.results[0].comparisonOriginal).toBe('My earlier human writing.');expect(saved.results[0].beforeText).toBe(sections[0].text);
});
it('persists a bounded transient retry deadline and resumes from cached speech when online',async()=>{
 const {source,sections,draft}=await fixture();const transcribe=vi.fn(async()=>response('My direction.'));assimilate.mockRejectedValueOnce(Error('Network temporarily unavailable')).mockResolvedValue(result(sections[0].id,'My direction.'));
 const services={loadSource:async()=>source,transcribe};await queueSectionTake(draft.id,'clip-1',sections[0].id,services);
 const failed=await waitState(draft.id,'clip-1','failed');expect(failed.takes?.[0].retryAttempts).toBe(1);expect(failed.takes?.[0].retryAt).toBeGreaterThan(Date.now());
 await drafts.save({...failed,takes:failed.takes?.map(t=>({...t,retryAt:Date.now()-1}))} as TakeSession,failed.version);
 const {startSectionTakeRecovery}=await import('../../../src/mobile/authoring/sectionTakes');const stop=startSectionTakeRecovery(services);
 try{const reviewed=await waitState(draft.id,'clip-1','review');expect(reviewed.takes?.[0].retryAt).toBeUndefined();expect(transcribe).toHaveBeenCalledTimes(1);}finally{stop();}
});
it('infers only an opening spoken edit command and respects the explicit chosen intent',async()=>{
 const {source,sections,draft}=await fixture(2);const services={loadSource:async()=>source,transcribe:async()=>response('Add this. My further words.')};
 assimilate.mockImplementation(async input=>result(input.startSectionId,input.words));
 await queueSectionTake(draft.id,'clip-1',sections[0].id,services);const auto=await waitState(draft.id,'clip-1','review');expect(auto.results[0].editIntent).toBe('add');expect(assimilate.mock.calls[0][0].intent).toBe('add');
 await queueSectionTake(draft.id,'clip-2',sections[1].id,services,[],{intent:'replace'});const explicit=await waitState(draft.id,'clip-2','review');expect(explicit.results.find(result=>result.sectionId===sections[1].id)?.editIntent).toBe('replace');expect(assimilate.mock.calls[1][0].intent).toBe('replace');
});
it('accumulates same-section safety rolls when later transcription finishes before the earlier AI review',async()=>{
 const {source,sections,draft}=await fixture(2),first=deferred<ReturnType<typeof result>>();
 const transcribe=vi.fn(async(_session,capture)=>response(capture.id==='clip-1'?'First spoken sentence.':'Second spoken sentence.'));
 assimilate.mockReturnValueOnce(first.promise).mockImplementation(async input=>result(input.startSectionId,input.words));const services={loadSource:async()=>source,transcribe};
 await queueSectionTake(draft.id,'clip-1',sections[0].id,services);await waitState(draft.id,'clip-1','assimilating');
 await queueSectionTake(draft.id,'clip-2',sections[0].id,services,[],{continuationOf:'clip-1'});
 await vi.waitFor(()=>expect(transcribe).toHaveBeenCalledTimes(2));expect(assimilate).toHaveBeenCalledTimes(1);
 first.resolve(result(sections[0].id,'First spoken sentence.'));
 const completed=await waitState(draft.id,'clip-2','review');expect(completed.results[0].text).toBe('First spoken sentence.\nSecond spoken sentence.');expect(completed.results[0].takeIds).toEqual(['clip-1','clip-2']);expect(completed.results[0].comparisonOriginal).toBe(sections[0].text);expect(assimilate.mock.calls[1][0].sections[0].text).toBe(sections[0].text);expect(assimilate.mock.calls[1][0].segments).toEqual([{text:'First spoken sentence.',startMs:0,endMs:1000},{text:'Second spoken sentence.',startMs:1000,endMs:2000}]);
 const checked=await drafts.save({...completed,results:completed.results.map(result=>({...result,checked:true}))},completed.version);await integrateSectionDraft(checked.id,sections[0].id,services);
 const working=(await new WorkingCardStore().get(2,'DESIGN'))!;expect(working.text).toContain('First spoken sentence.\nSecond spoken sentence.');expect(working.blocks.filter(block=>block.origin==='human').flatMap(block=>block.evidence.map(item=>item.captureId))).toEqual(['clip-1','clip-2']);
});
it('holds an accumulated candidate if a person changes the auto-prepared earlier segment',async()=>{
 const {source,sections,draft}=await fixture(2),later=deferred<ReturnType<typeof result>>();assimilate.mockResolvedValueOnce(result(sections[0].id,'First sentence.')).mockReturnValueOnce(later.promise);
 const services={loadSource:async()=>source,transcribe:async(_session,capture)=>response(capture.id==='clip-1'?'First sentence.':'Second sentence.')};
 await queueSectionTake(draft.id,'clip-1',sections[0].id,services);await waitState(draft.id,'clip-1','review');await queueSectionTake(draft.id,'clip-2',sections[0].id,services,[],{continuationOf:'clip-1'});await waitState(draft.id,'clip-2','assimilating');
 const current=(await getTakeSession(draft.id))!;await drafts.save({...current,results:current.results.map(result=>({...result,text:'My newer manual sentence.'}))},current.version);
 later.resolve(result(sections[0].id,'First sentence.\nSecond sentence.'));const failed=await waitState(draft.id,'clip-2','failed');expect(failed.results[0].text).toBe('My newer manual sentence.');expect(failed.takes?.find(take=>take.captureId==='clip-2')?.error).toContain('edited or integrated');
});
it('rejects a late earlier AI response when another window already saved the newer accumulated candidate',async()=>{
 const {source,sections,draft}=await fixture(2),earlier=deferred<ReturnType<typeof result>>();assimilate.mockReturnValue(earlier.promise);
 const services={loadSource:async()=>source,transcribe:async()=>response('First sentence.')};await queueSectionTake(draft.id,'clip-1',sections[0].id,services);await waitState(draft.id,'clip-1','assimilating');
 const current=(await getTakeSession(draft.id))!,newer={...result(sections[0].id,'First sentence. Second sentence.').sections[0],checked:false,takeIds:['clip-1','clip-2']};
 await drafts.save({...current,results:[newer],takes:[...(current.takes??[]),{id:'clip-2',captureId:'clip-2',continuationOf:'clip-1',startSectionId:sections[0].id,markers:[],state:'review',createdAt:current.createdAt,preparedFingerprints:{[sections[0].id]:JSON.stringify(newer)}}]} as TakeSession,current.version);
 earlier.resolve(result(sections[0].id,'First sentence.'));const held=await waitState(draft.id,'clip-1','failed');expect(held.results[0].text).toBe('First sentence. Second sentence.');expect(held.results[0].takeIds).toEqual(['clip-1','clip-2']);
});
it('carries the initial focus and offsets every marker when a safety roll follows a spoken section change',async()=>{
 const {source,sections,draft}=await fixture(2);assimilate.mockImplementation(async input=>result(sections[0].id,input.words));const services={loadSource:async()=>source,transcribe:async(_session,capture)=>response(capture.id==='clip-1'?'Opening words. Next section.':'Centre words.')};
 await queueSectionTake(draft.id,'clip-1',sections[0].id,services,[{atMs:0,sectionId:sections[0].id},{atMs:500,sectionId:sections[1].id}]);await waitState(draft.id,'clip-1','review');
 await queueSectionTake(draft.id,'clip-2',sections[1].id,services,[{atMs:0,sectionId:sections[1].id}],{continuationOf:'clip-1'});await waitState(draft.id,'clip-2','review');
 expect(assimilate.mock.calls[1][0].startSectionId).toBe(sections[0].id);expect(assimilate.mock.calls[1][0].markers).toEqual([{atMs:0,sectionId:sections[0].id},{atMs:500,sectionId:sections[1].id},{atMs:1000,sectionId:sections[1].id}]);
});
it('keeps issue word times local to their capture while rolling AI segment times are cumulative',async()=>{
 const {source,sections,draft}=await fixture(2);const services={loadSource:async()=>source,transcribe:async(_session,capture)=>({provider:'provider',segments:[{text:capture.id==='clip-1'?'First sentence.':'Second uncertain sentence.',startMs:0,endMs:1000,timing:'provider' as const,sectionId:'DESIGN',words:capture.id==='clip-1'?[]:[{text:'uncertain',startMs:100,endMs:300,probability:.2}]}]})};
 assimilate.mockImplementation(async input=>result(input.startSectionId,input.words));
 await queueSectionTake(draft.id,'clip-1',sections[0].id,services);await waitState(draft.id,'clip-1','review');await queueSectionTake(draft.id,'clip-2',sections[0].id,services,[],{continuationOf:'clip-1'});const reviewed=await waitState(draft.id,'clip-2','review');
 expect(assimilate.mock.calls[1][0].segments?.[1].startMs).toBe(1000);expect(reviewed.results[0].reviewIssues?.[0]).toMatchObject({captureId:'clip-2',quote:'uncertain',startMs:100,endMs:300,probability:.2});
});
it('refuses changed duplicate related sources while preserving cached audio metadata and speech',async()=>{
 const {source,sections,session,draft}=await fixture(),original='### Reading\nEarlier fourteen.',changed='### Reading\nChanged fourteen.';
 const related=await sourceSnapshot(14,'original',original,[{id:'CODE',title:'Universal Language',start:0,end:original.length}]),updated=await sourceSnapshot(14,'new',changed,[{id:'CODE',title:'Universal Language',start:0,end:changed.length}]);
 const saved=(await audio.load(session.id))!;await audio.save({...saved.session,relatedSources:[related]},saved.version);
 await queueSectionTake(draft.id,'clip-1',sections[0].id,{loadSource:async number=>number===14?updated:source,transcribe:async()=>response('Next card fourteen. My words.')});const failed=await waitState(draft.id,'clip-1','failed');
 expect(failed.takes?.[0].error).toContain('related card changed');expect(assimilate).not.toHaveBeenCalled();const preserved=(await audio.load(session.id))!.session;expect(preserved.relatedSources?.[0].hash).toBe(related.hash);expect(preserved.captures).toHaveLength(1);expect(preserved.transcript[0].raw).toBe('Next card fourteen. My words.');
});
