import 'fake-indexeddb/auto';
import {beforeEach,expect,it,vi} from 'vitest';
import {AuthoringStore} from '../../../lib/oracle/authoring/storage';
import {SectionDraftStore,createSectionDraftSession} from '../../../lib/oracle/authoring/sectionDrafts';
import {cardSections} from '../../../lib/oracle/authoring/cardSections';
import {createSession,sourceSnapshot} from '../../../lib/oracle/authoring/workflow';
import {assimilateSections} from '../../../src/mobile/authoring/sectionAssimilation';
import {processVoicePhraseRevision,type VoicePhraseDraft} from '../../../src/mobile/authoring/voicePhraseRevision';
vi.mock('../../../src/mobile/authoring/sectionAssimilation',()=>({assimilateSections:vi.fn()}));
const assimilate=vi.mocked(assimilateSections),audio=new AuthoringStore(),drafts=new SectionDraftStore();
beforeEach(async()=>{vi.clearAllMocks();vi.stubGlobal('window',new EventTarget());for(const name of ['oracle-section-drafts-v1','oracle-authoring-v1'])await new Promise<void>((resolve,reject)=>{const request=indexedDB.deleteDatabase(name);request.onsuccess=()=>resolve();request.onerror=()=>reject(request.error);});});
async function fixture(){
 const markdown='### The drive — Gate 2\nOriginal text.';
 const source=await sourceSnapshot(2,'original',markdown,[{id:'DESIGN',title:'Human Design',start:0,end:markdown.length}]),sections=cardSections(source),session=createSession(source);
 session.captures=[{id:'phrase-audio',recordedAt:session.createdAt,mimeType:'audio/wav',durationMs:1000,status:'ready',origin:'microphone'}];
 await audio.save(session,0);await audio.appendChunk(session.id,'phrase-audio',0,new Blob(['replacement audio'],{type:'audio/wav'}),1000);
 const baseText='Before old phrase after.',original='Before original after.';
 const draft=await drafts.save({...createSectionDraftSession(source,sections),captureSessionId:'original-session',rawTranscript:'Original raw speech.',results:[{sectionId:sections[0].id,text:baseText,evidenceQuotes:['Original raw speech.'],changes:[],warnings:[],checked:true,takeIds:['original-audio'],reviewTranscript:'Original raw speech.',comparison:{originalText:original,spokenText:baseText,pairs:[{originalStart:0,originalEnd:7,textStart:0,textEnd:7},{originalStart:7,originalEnd:15,textStart:7,textEnd:17},{originalStart:15,originalEnd:22,textStart:17,textEnd:24}]}}]},0);
 const input={draftId:draft.id,sectionId:sections[0].id,from:7,to:17,baseText,captureSessionId:session.id,captureId:'phrase-audio'};
 const transcribe=vi.fn(async()=>({provider:'provider',segments:[{text:'new phrase',startMs:0,endMs:1000,timing:'provider' as const,sectionId:'DESIGN',words:[{text:'new',startMs:0,endMs:400,probability:.4},{text:'phrase',startMs:400,endMs:1000,probability:.9}]}]}));
 assimilate.mockImplementation(async request=>({sections:[{sectionId:request.startSectionId,text:request.words,evidenceQuotes:[request.words],changes:[],warnings:[]}],unassigned:[]}));
 return{input,source,draft,session,transcribe,services:{loadSource:async()=>source,transcribe}};
}
it('scopes AI to exact phrase, preserves all neighbors and original raw speech, shifts comparison links',async()=>{
 const f=await fixture(),result=await processVoicePhraseRevision(f.input,f.services),candidate=result.session.results[0];
 expect(result.state).toBe('review');expect(candidate.text).toBe('Before new phrase after.');expect(candidate.checked).toBe(false);
 expect(assimilate.mock.calls[0][0].sections).toHaveLength(1);expect(assimilate.mock.calls[0][0].sections[0].text).toBe('old phrase');
 expect(candidate.takeIds).toEqual(['original-audio','phrase-audio']);expect(candidate.evidenceQuotes).toEqual(['Original raw speech.','new phrase']);
 expect(candidate.reviewTranscript).toBe('Original raw speech.\nnew phrase');expect(candidate.reviewIssues?.[0]).toMatchObject({quote:'new',captureId:'phrase-audio',start:21,end:24});
 expect(candidate.comparison?.spokenText).toBe(candidate.text);expect(candidate.comparison?.pairs[2]).toMatchObject({textStart:17,textEnd:24});
 expect(result.session.captureSessionId).toBe('original-session');expect(result.session.takes?.[0]).toMatchObject({captureSessionId:f.session.id,state:'review'});
 expect((await audio.load(f.session.id))?.session.transcript[0].raw).toBe('new phrase');expect(result.session.phrasePatches?.[0]).toMatchObject({original:'old phrase',rawReplacement:'new phrase',replacement:'new phrase'});
 await processVoicePhraseRevision(f.input,f.services);expect(f.transcribe).toHaveBeenCalledTimes(1);
});
it('holds late replacement if candidate changed during AI and never overwrites newer words',async()=>{
 const f=await fixture();let release!:(value:any)=>void;assimilate.mockReturnValue(new Promise(resolve=>{release=resolve;}));
 const processing=processVoicePhraseRevision(f.input,f.services);
 await vi.waitFor(()=>expect(assimilate).toHaveBeenCalledTimes(1));
 const latest=(await drafts.get(f.draft.id))!;await drafts.save({...latest,results:latest.results.map(result=>({...result,text:'New manual candidate.'}))},latest.version);
 release({sections:[{sectionId:f.input.sectionId,text:'new phrase',evidenceQuotes:['new phrase'],changes:[],warnings:[]}],unassigned:[]});
 const held=await processing;expect(held.state).toBe('held');expect(held.session.results[0].text).toBe('New manual candidate.');expect(held.session.unassigned[0]).toMatchObject({text:'new phrase',takeId:'phrase-audio'});
 expect(held.session.phrasePatches?.[0].state).toBe('held');expect(held.session.takes?.[0].state).toBe('review');
});
it('holds unassigned or invented cleanup and retains replacement audio',async()=>{
 const f=await fixture();assimilate.mockResolvedValue({sections:[{sectionId:f.input.sectionId,text:'invented elegant prose',evidenceQuotes:['new phrase'],changes:[],warnings:[]}],unassigned:[]});
 const held=await processVoicePhraseRevision(f.input,f.services);expect(held.state).toBe('held');expect(held.session.results[0].text).toBe(f.input.baseText);expect(await(await audio.audio(f.session.id,'phrase-audio')).text()).toBe('replacement audio');
});
it('persists transcription failures without overwriting or integrating the candidate',async()=>{
 const f=await fixture();f.transcribe.mockRejectedValue(Error('Microphone upload unavailable'));
 const failed=await processVoicePhraseRevision(f.input,f.services);expect(failed.state).toBe('failed');expect(failed.session.takes?.[0].state).toBe('failed');expect(failed.session.results[0].text).toBe(f.input.baseText);expect(assimilate).not.toHaveBeenCalled();
});
it('shifts following comparison offsets when replacement length changes',async()=>{
 const f=await fixture();f.transcribe.mockResolvedValue({provider:'provider',segments:[{text:'short',startMs:0,endMs:1000,timing:'provider',sectionId:'DESIGN',words:[]}]});
 const revised=await processVoicePhraseRevision(f.input,f.services);expect(revised.session.results[0].text).toBe('Before short after.');expect(revised.session.results[0].comparison?.pairs[2]).toMatchObject({textStart:12,textEnd:19});
});
it('holds ambiguous unassigned speech for review without changing the selected phrase',async()=>{
 const f=await fixture();assimilate.mockResolvedValue({sections:[],unassigned:[{text:'new phrase',reason:'The replacement target needs clarification.'}]});
 const held=await processVoicePhraseRevision(f.input,f.services);expect(held.state).toBe('held');expect(held.session.results[0].text).toBe(f.input.baseText);expect(held.session.unassigned[0].reason).toContain('clarification');
});
it('accepts only documented mechanical removal and preserves the literal replacement transcript',async()=>{
 const f=await fixture();f.transcribe.mockResolvedValue({provider:'provider',segments:[{text:'um new phrase',startMs:0,endMs:1000,timing:'provider',sectionId:'DESIGN',words:[]}]});
 assimilate.mockResolvedValue({sections:[{sectionId:f.input.sectionId,text:'New phrase.',evidenceQuotes:['um new phrase'],changes:[{before:'um ',after:'',reason:'Removed a filler.'}],warnings:[]}],unassigned:[]});
 const revised=await processVoicePhraseRevision(f.input,f.services);expect(revised.state).toBe('review');expect(revised.session.results[0].text).toBe('Before New phrase. after.');expect((await audio.load(f.session.id))!.session.transcript[0].raw).toBe('um new phrase');
});
it('does not transcribe unfinished audio',async()=>{
 const f=await fixture(),saved=(await audio.load(f.session.id))!;await audio.save({...saved.session,captures:saved.session.captures.map(capture=>({...capture,status:'recording'}))},saved.version);
 const failed=await processVoicePhraseRevision(f.input,f.services);expect(failed.state).toBe('failed');expect(f.transcribe).not.toHaveBeenCalled();expect(assimilate).not.toHaveBeenCalled();
});
it('queues exact phrase work durably before transcription finishes and clears it after review',async()=>{
 const {enqueueVoicePhraseRevision}=await import('../../../src/mobile/authoring/voicePhraseRevision');
 const f=await fixture();let release!:(value:any)=>void;f.transcribe.mockReturnValue(new Promise(resolve=>{release=resolve;}));
 const queued=await enqueueVoicePhraseRevision(f.input,f.services);
 expect(queued.pendingPhraseRevisions).toEqual([f.input]);expect(queued.takes?.[0].state).toBe('queued');
 await vi.waitFor(()=>expect(f.transcribe).toHaveBeenCalledTimes(1));
 release({provider:'provider',segments:[{text:'new phrase',startMs:0,endMs:1000,timing:'provider',sectionId:'DESIGN'}]});
 await vi.waitFor(async()=>expect((await drafts.get(f.draft.id) as VoicePhraseDraft).phrasePatches?.[0].state).toBe('review'));
 expect((await drafts.get(f.draft.id) as VoicePhraseDraft).pendingPhraseRevisions).toEqual([]);
});
it('resumes persisted phrase jobs after reopening',async()=>{
 const {resumeVoicePhraseRevisions}=await import('../../../src/mobile/authoring/voicePhraseRevision');
 const f=await fixture();await drafts.save({...f.draft,pendingPhraseRevisions:[f.input]} as VoicePhraseDraft,f.draft.version);
 await resumeVoicePhraseRevisions(f.services);
 await vi.waitFor(async()=>expect((await drafts.get(f.draft.id) as VoicePhraseDraft).phrasePatches?.[0].state).toBe('review'));
 expect(f.transcribe).toHaveBeenCalledTimes(1);
});
it('retries failed transcription without losing newly recovered raw speech',async()=>{
 const f=await fixture();f.transcribe.mockRejectedValueOnce(Error('offline'));
 await processVoicePhraseRevision(f.input,f.services);
 const retried=await processVoicePhraseRevision(f.input,f.services);expect(retried.state).toBe('review');expect(retried.session.rawTranscript).toBe('Original raw speech.\nnew phrase');
});
