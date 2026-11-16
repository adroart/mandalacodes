import 'fake-indexeddb/auto';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {AuthoringStore} from '../../../lib/oracle/authoring/storage';
import {SectionDraftStore,createSectionDraftSession} from '../../../lib/oracle/authoring/sectionDrafts';
import {cardSections} from '../../../lib/oracle/authoring/cardSections';
import {createSession,sourceSnapshot} from '../../../lib/oracle/authoring/workflow';
import {assimilateSections} from '../../../src/mobile/authoring/sectionAssimilation';
import {KNOWN_WORD_REASON,correctedQuote,correctedSpeech,restoreSpokenWords} from '../../../src/mobile/authoring/knownWordFixes';
import {getTakeSession,queueSectionTake,startSectionTakeRecovery} from '../../../src/mobile/authoring/sectionTakes';
import {processSectionSession} from '../../../src/mobile/authoring/sectionWorkflow';
vi.mock('../../../src/mobile/authoring/sectionAssimilation',()=>({assimilateSections:vi.fn()}));
const assimilate=vi.mocked(assimilateSections),audio=new AuthoringStore(),drafts=new SectionDraftStore();
beforeEach(async()=>{vi.clearAllMocks();vi.stubGlobal('window',new EventTarget());for(const name of ['oracle-section-drafts-v1','oracle-working-cards-v1','oracle-authoring-v1'])await new Promise<void>((resolve,reject)=>{const req=indexedDB.deleteDatabase(name);req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error);});});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
async function fixture(){
 const markdown='### The drive \u2014 Gate 2\nFirst original drive.\n\n### Where it lives\nThe centre remains.';
 const source=await sourceSnapshot(2,'original',markdown,[{id:'DESIGN',title:'Human Design',start:0,end:markdown.length}]),sections=cardSections(source),session=createSession(source);
 session.captures=[{id:'clip-1',recordedAt:session.createdAt,mimeType:'audio/wav',durationMs:4000,status:'ready',origin:'microphone',visibleCardNumber:2}];
 await audio.save(session,0);await audio.appendChunk(session.id,'clip-1',0,new Blob(['Audio'],{type:'audio/wav'}),4000);
 const draft=await drafts.save({...createSectionDraftSession(source,sections),captureSessionId:session.id,captureId:'clip-1'},0);
 return {source,sections,session,draft};
}

describe('a doubt on a word the shared word library fixed',()=>{
 it('is placed on the fixed wording in the proposed text, never settled by its raw word being absent',()=>{
  const speech=correctedSpeech([{raw:'My jean keys open.',corrected:'My Gene Keys open.'}]);
  const restored=restoreSpokenWords({sections:[{sectionId:'s',text:'My Gene Keys open.',evidenceQuotes:['My Gene Keys open.'],changes:[],warnings:[]}],unassigned:[]},speech).sections[0];
  expect(restored.changes).toEqual([{before:'jean keys',after:'Gene Keys',reason:KNOWN_WORD_REASON}]);
  expect(correctedQuote(restored.changes,'jean')).toBe('Gene Keys');
  expect(correctedQuote(restored.changes,'my jean keys')).toBe('my Gene Keys');
  expect(correctedQuote(restored.changes,'open')).toBeUndefined();
 });
 it('names only the words a fix changed when it was widened by its neighbours',()=>{
  expect(correctedQuote([{before:'the jean and',after:'the Gene and',reason:KNOWN_WORD_REASON}],'jean')).toBe('Gene');
  expect(correctedQuote([{before:'jean',after:'Gene',reason:'Tidied a stumble.'}],'jean')).toBeUndefined();
 });
});

describe('the possible mishearings warning',()=>{
 it('names only words inside its own section when one transcript without word timings covers two sections',async()=>{
  const {source,sections,draft}=await fixture();
  const first='I ate an apple today.',second='Then a banana later.';
  assimilate.mockResolvedValue({sections:[{sectionId:sections[0].id,text:first,evidenceQuotes:[first],changes:[],warnings:[]},{sectionId:sections[1].id,text:second,evidenceQuotes:[second],changes:[],warnings:[]}],unassigned:[]});
  const transcribe=async()=>({provider:'groq',doubtsAvailable:true,doubts:[{text:'apple',startMs:0,endMs:4000,heardAlso:'ample'},{text:'banana',startMs:0,endMs:4000,heardAlso:'bandana'}],segments:[{text:`${first} ${second}`,startMs:0,endMs:4000,timing:'recording' as const,sectionId:null}]});
  await queueSectionTake(draft.id,'clip-1',sections[0].id,{loadSource:async()=>source,transcribe});
  await vi.waitFor(async()=>expect((await getTakeSession(draft.id))?.takes?.[0].state).toBe('review'));
  const results=(await getTakeSession(draft.id))!.results;
  const warning=(id:string)=>results.find(r=>r.sectionId===id)!.warnings.filter(w=>/^Check possible mishearings/.test(w));
  expect(warning(sections[0].id)).toEqual(['Check possible mishearings against your audio: apple']);
  expect(warning(sections[1].id)).toEqual(['Check possible mishearings against your audio: banana']);
 });
 it('does the same on the older whole-session path',async()=>{
  const {source,sections,draft}=await fixture();
  const first='I ate an apple today.',second='Then a banana later.';
  assimilate.mockResolvedValue({sections:[{sectionId:sections[0].id,text:first,evidenceQuotes:[first],changes:[],warnings:[]},{sectionId:sections[1].id,text:'Nothing doubtful here.',evidenceQuotes:['Nothing doubtful here.'],changes:[],warnings:[]}],unassigned:[]});
  const transcribe=async()=>({provider:'groq',doubtsAvailable:true,doubts:[{text:'apple',startMs:0,endMs:4000,heardAlso:'ample'}],segments:[{text:`${first} Nothing doubtful here. ${second}`,startMs:0,endMs:4000,timing:'recording' as const,sectionId:null}]});
  await processSectionSession(draft.id,{loadSource:async()=>source,transcribe});
  const results=(await drafts.get(draft.id))!.results;
  expect(results.find(r=>r.sectionId===sections[1].id)!.warnings).toEqual([]);
  expect(results.find(r=>r.sectionId===sections[0].id)!.warnings).toEqual(['Check possible mishearings against your audio: apple']);
 });
});

describe('recovery that cannot read the saved drafts',()=>{
 it('logs a safe category and tries again on its own a few seconds later',async()=>{
  const warn=vi.spyOn(console,'warn').mockImplementation(()=>undefined);
  const list=vi.spyOn(SectionDraftStore.prototype,'list').mockRejectedValueOnce(new Error('private detail')).mockResolvedValue([]);
  vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});
  const stop=startSectionTakeRecovery({loadSource:vi.fn()});
  await vi.advanceTimersByTimeAsync(10);
  expect(list).toHaveBeenCalledTimes(1);
  expect(warn).toHaveBeenCalledWith(expect.any(String),'Error');expect(JSON.stringify(warn.mock.calls)).not.toContain('private detail');
  await vi.advanceTimersByTimeAsync(5000);
  expect(list).toHaveBeenCalledTimes(2);
  stop();
 });
});
