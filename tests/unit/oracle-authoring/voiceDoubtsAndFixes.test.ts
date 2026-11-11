import 'fake-indexeddb/auto';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import {AuthoringStore} from '../../../lib/oracle/authoring/storage';
import {SectionDraftStore,createSectionDraftSession,transcriptionReviewIssues} from '../../../lib/oracle/authoring/sectionDrafts';
import {reconcileHumanPassages} from '../../../lib/oracle/authoring/humanDrafts';
import {cardSections} from '../../../lib/oracle/authoring/cardSections';
import {addTranscript,createSession,sourceSnapshot,uncertainWord} from '../../../lib/oracle/authoring/workflow';
import {buildWordReplay} from '../../../lib/oracle/authoring/wordReplay';
import type {Transcript} from '../../../lib/oracle/authoring/types';
import {assimilateSections} from '../../../src/mobile/authoring/sectionAssimilation';
import {KNOWN_WORD_REASON,correctedSpeech,rawSpan,restoreSpokenWords} from '../../../src/mobile/authoring/knownWordFixes';
import {restoreDocumentedCleanup} from '../../../src/mobile/authoring/speechCleanupReview';
import {getTakeSession,queueSectionTake,retryableTakeFailure,startSectionTakeRecovery,takeRetryAt,type TakeSession} from '../../../src/mobile/authoring/sectionTakes';
vi.mock('../../../src/mobile/authoring/sectionAssimilation',()=>({assimilateSections:vi.fn()}));
const assimilate=vi.mocked(assimilateSections),audio=new AuthoringStore(),drafts=new SectionDraftStore();
beforeEach(async()=>{vi.clearAllMocks();vi.stubGlobal('window',new EventTarget());for(const name of ['oracle-section-drafts-v1','oracle-working-cards-v1','oracle-authoring-v1'])await new Promise<void>((resolve,reject)=>{const req=indexedDB.deleteDatabase(name);req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error);});});
async function fixture(count=1,durationMs=4000){
 const markdown='### The drive \u2014 Gate 2\nFirst original drive.\n\n### Where it lives\nThe centre remains.';
 const source=await sourceSnapshot(2,'original',markdown,[{id:'DESIGN',title:'Human Design',start:0,end:markdown.length}]),sections=cardSections(source),session=createSession(source);
 session.captures=Array.from({length:count},(_,index)=>({id:`clip-${index+1}`,recordedAt:session.createdAt,mimeType:'audio/wav',durationMs,status:'ready' as const,origin:'microphone' as const,visibleCardNumber:2}));
 await audio.save(session,0);for(const capture of session.captures)await audio.appendChunk(session.id,capture.id,0,new Blob([`Audio ${capture.id}`],{type:'audio/wav'}),durationMs);
 const draft=await drafts.save({...createSectionDraftSession(source,sections),captureSessionId:session.id,captureId:'clip-1'},0);
 return {source,sections,session,draft};
}
async function waitState(id:string,captureId:string,state:string){await vi.waitFor(async()=>expect((await getTakeSession(id))?.takes?.find(t=>t.captureId===captureId)?.state).toBe(state));return (await getTakeSession(id))!;}
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return {promise,resolve};}
const result=(sectionId:string,text:string)=>({sections:[{sectionId,text,evidenceQuotes:[text],changes:[],warnings:[]}],unassigned:[]});

describe('one rule for a word that needs checking',()=>{
 it('is true for a second listening doubt, for the Mac path below 0.6, and false otherwise',()=>{
  expect(uncertainWord({doubt:true})).toBe(true);
  expect(uncertainWord({probability:.5})).toBe(true);
  expect(uncertainWord({doubt:true,probability:.99})).toBe(true);
  expect(uncertainWord({probability:.6})).toBe(false);
  expect(uncertainWord({})).toBe(false);
  expect(uncertainWord(undefined)).toBe(false);
 });
 it('turns a doubtful word into a review issue that says what else was heard',()=>{
  const raw='I trust my direction today.';
  const issues=transcriptionReviewIssues(raw,[{raw,captureId:'clip-1',words:[{text:'I',startMs:0,endMs:200},{text:'trust',startMs:200,endMs:800},{text:'my',startMs:800,endMs:1000},{text:'direction',startMs:1000,endMs:1800,doubt:true,heardAlso:'election'},{text:'today.',startMs:1800,endMs:2400}]}],[raw]);
  expect(issues).toEqual([{kind:'transcription',quote:'direction',start:11,end:20,scope:'rawTranscript',message:'Check this word against the saved audio.',startMs:1000,endMs:1800,captureId:'clip-1',heardAlso:'election'}]);
 });
 it('still flags the Mac path by probability, with no heardAlso',()=>{
  const raw='My chest opens.';
  const [issue]=transcriptionReviewIssues(raw,[{raw,captureId:'c',words:[{text:'My',startMs:0,endMs:100,probability:.9},{text:'chest',startMs:100,endMs:500,probability:.3},{text:'opens.',startMs:500,endMs:900,probability:.9}]}],[raw]);
  expect(issue).toMatchObject({quote:'chest',probability:.3});expect(issue).not.toHaveProperty('heardAlso');
 });
 it('maps top-level doubts on a passage without word timings to exact quotes, and stores whether it was checked',async()=>{
  const {session}=await fixture();
  const next=addTranscript(session,'clip-1',[{startMs:0,endMs:4000,text:'I feel it in my chest and my gut.',sectionId:null,timing:'recording'}],'cloudflare:@cf/openai/whisper-large-v3-turbo',{doubts:[{text:'my chest',startMs:0,endMs:4000,heardAlso:'the chest'},{text:'not in here',startMs:0,endMs:4000,heardAlso:'x'}],doubtsAvailable:true});
  const [t]=next.transcript;expect(t.doubtsAvailable).toBe(true);expect(t.doubts).toEqual([{text:'my chest',startMs:0,endMs:4000,heardAlso:'the chest'}]);
  const issues=transcriptionReviewIssues(t.raw,[t],[t.raw]);
  expect(issues).toEqual([{kind:'transcription',quote:'my chest',start:13,end:21,scope:'rawTranscript',message:'Check these words against the saved audio.',startMs:0,endMs:4000,captureId:'clip-1',heardAlso:'the chest'}]);
  const unchecked=addTranscript(session,'clip-1',[{startMs:0,endMs:4000,text:'Words.',sectionId:null,timing:'recording'}],'groq',{doubts:[],doubtsAvailable:false});
  expect(unchecked.transcript[0].doubtsAvailable).toBe(false);
  expect(addTranscript(session,'clip-1',[{startMs:0,endMs:4000,text:'Words.',sectionId:null,timing:'recording'}],'mac').transcript[0]).not.toHaveProperty('doubtsAvailable');
 });
 it('asks for a check in the older human draft path when one word was heard differently',async()=>{
  const {source}=await fixture();const sectionId=source.sections[0].id;
  const passage:Transcript={id:'t1',captureId:'clip-1',startMs:0,endMs:1000,raw:'My direction.',corrected:'My direction.',sectionId,assignment:'manual',timing:'provider',provider:'groq',receivedAt:'',words:[{text:'My',startMs:0,endMs:200},{text:'direction.',startMs:200,endMs:900,doubt:true,heardAlso:'election'}]};
  expect(reconcileHumanPassages(undefined,source,[passage],'s').issues.map(i=>i.code)).toContain('confidence');
  expect(reconcileHumanPassages(undefined,source,[{...passage,words:[{text:'My',startMs:0,endMs:200,probability:.55},{text:'direction.',startMs:200,endMs:900,probability:.9}]}],'s').issues.map(i=>i.code)).not.toContain('confidence');
 });
});

describe('known-word fixes are used and can be undone',()=>{
 const raw='I study the jean keys daily.',corrected='I study the Gene Keys daily.';
 it('maps a span of the fixed words back to the raw words, widening to whole fixes',()=>{
  const speech=correctedSpeech([{raw,corrected},{raw:'Second line.'}]);
  expect(speech.raw).toBe(`${raw}\nSecond line.`);expect(speech.corrected).toBe(`${corrected}\nSecond line.`);
  const at=speech.corrected.indexOf('Gene Keys');expect(speech.raw.slice(...Object.values(rawSpan(speech,at,at+9)) as [number,number])).toBe('jean keys');
  const keys=speech.corrected.indexOf('Keys daily');expect(speech.raw.slice(...Object.values(rawSpan(speech,keys,keys+10)) as [number,number])).toBe('jean keys daily');
  const second=speech.corrected.indexOf('Second');expect(rawSpan(speech,second,second+6)).toEqual({from:speech.raw.indexOf('Second'),to:speech.raw.indexOf('Second')+6});
 });
 it('keeps evidence on the raw words and lists each fix as a restorable change',()=>{
  const speech=correctedSpeech([{raw,corrected}]);
  const back=restoreSpokenWords({sections:[{sectionId:'S',text:corrected,evidenceQuotes:[corrected],changes:[],warnings:[]}],unassigned:[{text:'Gene Keys',reason:'r'}]},speech);
  const section=back.sections[0];
  expect(section.evidenceQuotes).toEqual([raw]);expect(section.text).toBe(corrected);
  expect(section.changes).toEqual([{before:'jean keys',after:'Gene Keys',reason:KNOWN_WORD_REASON}]);
  expect(back.unassigned[0].text).toBe('jean keys');
  const restored=restoreDocumentedCleanup({...section,checked:false},0);
  expect(restored.text).toBe(raw);expect(restored.changes).toEqual([]);
 });
 it('makes a repeated fix unique by its neighbouring words, so each one can be undone alone',()=>{
  const r='jean keys first, then jean keys again.',c='Gene Keys first, then Gene Keys again.';
  const section=restoreSpokenWords({sections:[{sectionId:'S',text:c,evidenceQuotes:[c],changes:[],warnings:[]}],unassigned:[]},correctedSpeech([{raw:r,corrected:c}])).sections[0];
  expect(section.changes.length).toBe(2);
  const full={...section,checked:false};
  expect(restoreDocumentedCleanup(full,0).text).toBe('jean keys first, then Gene Keys again.');
  expect(restoreDocumentedCleanup(full,1).text).toBe('Gene Keys first, then jean keys again.');
 });
 it('leaves a review with nothing fixed exactly as it was',()=>{
  const value={sections:[{sectionId:'S',text:'x',evidenceQuotes:['x'],changes:[],warnings:[]}],unassigned:[]};
  expect(restoreSpokenWords(value,correctedSpeech([{raw:'x',corrected:'x'}]))).toBe(value);
 });
 it('matches sections on the fixed words, proposes them, and keeps raw speech, audio replay and issues valid',async()=>{
  const {source,sections,session,draft}=await fixture();
  const transcribe=vi.fn(async()=>({provider:'groq:whisper-large-v3-turbo',doubtsAvailable:true,doubts:[{text:'daily.',startMs:2600,endMs:3400,heardAlso:'gaily.'}],segments:[{text:raw,corrected,startMs:0,endMs:3400,timing:'provider' as const,sectionId:null,words:[{text:'I',startMs:0,endMs:200},{text:'study',startMs:200,endMs:800},{text:'the',startMs:800,endMs:1000},{text:'jean',startMs:1000,endMs:1600},{text:'keys',startMs:1600,endMs:2600},{text:'daily.',startMs:2600,endMs:3400,doubt:true as const,heardAlso:'gaily.'}]}]}));
  assimilate.mockImplementation(async input=>result(input.startSectionId,input.words));
  await queueSectionTake(draft.id,'clip-1',sections[0].id,{loadSource:async()=>source,transcribe});
  const done=await waitState(draft.id,'clip-1','review');
  expect(assimilate.mock.calls[0][0].words).toBe(corrected);expect(assimilate.mock.calls[0][0].segments?.[0].text).toBe(corrected);
  const section=done.results[0];
  expect(section.text).toBe(corrected);expect(section.evidenceQuotes).toEqual([raw]);expect(section.reviewTranscript).toBe(raw);expect(done.rawTranscript).toBe(raw);
  expect(section.changes).toEqual([{before:'jean keys',after:'Gene Keys',reason:KNOWN_WORD_REASON}]);
  expect(section.doubtsAvailable).toBe(true);
  expect(section.reviewIssues).toEqual([expect.objectContaining({quote:'daily.',heardAlso:'gaily.',startMs:2600,captureId:'clip-1'})]);
  expect(section.warnings.join(' ')).toContain('daily.');
  const saved=(await audio.load(session.id))!.session.transcript[0];expect(saved.raw).toBe(raw);expect(saved.corrected).toBe(corrected);expect(saved.doubtsAvailable).toBe(true);
  expect(await(await audio.audio(session.id,'clip-1')).text()).toBe('Audio clip-1');
  const replay=buildWordReplay(restoreDocumentedCleanup({...section,checked:false},0).text,[saved],section.evidenceQuotes);
  expect(replay.find(w=>w.text==='jean')).toMatchObject({startMs:1000,endMs:1600});
  expect(buildWordReplay(section.text,[saved],section.evidenceQuotes).find(w=>w.text==='daily')).toMatchObject({startMs:2600});
 });
 it('says a recording was not double-checked when the second listening was unavailable',async()=>{
  const {source,sections,draft}=await fixture();
  assimilate.mockImplementation(async input=>result(input.startSectionId,input.words));
  await queueSectionTake(draft.id,'clip-1',sections[0].id,{loadSource:async()=>source,transcribe:async()=>({provider:'groq',doubts:[],doubtsAvailable:false,segments:[{text:'Plain words.',startMs:0,endMs:1000,timing:'provider' as const,sectionId:null}]})});
  expect((await waitState(draft.id,'clip-1','review')).results[0].doubtsAvailable).toBe(false);
 });
});

describe('retry advice',()=>{
 const failure=(status:number|undefined,extra:Record<string,unknown>={})=>Object.assign(Error('Plain words.'),status===undefined?{}:{status},extra);
 it('an explicit retryable false always wins over the status',()=>{for(const status of [429,500,502,504,0])expect(retryableTakeFailure(failure(status,{retryable:false}))).toBe(false);});
 it('never repeats a conflict, even when marked retryable',()=>{expect(retryableTakeFailure(failure(409))).toBe(false);expect(retryableTakeFailure(failure(409,{retryable:true}))).toBe(false);});
 it('waits at least as long as Retry-After asks, beyond the usual backoff',()=>{
  const now=1_000_000;
  expect(takeRetryAt(failure(429,{retryable:true,retryAfterMs:120000}),1,now)).toBe(now+120000);
  expect(takeRetryAt(failure(429,{retryable:true}),1,now)).toBe(now+2000);
  expect(takeRetryAt(failure(429,{retryable:true,retryAfterMs:500}),3,now)).toBe(now+8000);
  expect(takeRetryAt(failure(409),1,now)).toBeUndefined();expect(takeRetryAt(failure(502),5,now)).toBeUndefined();
 });
 it('persists the Retry-After pause on a failed recording',async()=>{
  const {source,sections,draft}=await fixture();
  const before=Date.now();
  await queueSectionTake(draft.id,'clip-1',sections[0].id,{loadSource:async()=>source,transcribe:vi.fn().mockRejectedValue(failure(429,{retryable:true,retryAfterMs:90000}))});
  const take=(await waitState(draft.id,'clip-1','failed')).takes![0];
  expect(take.retryAt).toBeGreaterThanOrEqual(before+90000);expect(take.serverPause).toBe(true);
 });
 it('retries waiting recordings one at a time and none before the server pause',async()=>{
  const {source,sections,draft}=await fixture(2);
  const current=(await getTakeSession(draft.id))!,past=Date.now()-1000;
  const failed=(captureId:string,sectionId:string,extra={})=>({id:captureId,captureId,startSectionId:sectionId,markers:[{atMs:0,sectionId}],state:'failed' as const,createdAt:new Date().toISOString(),baseline:{},retryAttempts:1,retryAt:past,...extra});
  await drafts.save({...current,takes:[failed('clip-1',sections[0].id),failed('clip-2',sections[1].id)]} as TakeSession,current.version);
  const first=deferred<any>(),calls:string[]=[];
  const transcribe=vi.fn((_s:unknown,capture:{id:string})=>{calls.push(capture.id);return capture.id==='clip-1'?first.promise:Promise.resolve({provider:'p',segments:[{text:'My centre.',startMs:0,endMs:1000,timing:'provider' as const,sectionId:null}]});});
  assimilate.mockImplementation(async input=>result(input.startSectionId,input.words));
  const stop=startSectionTakeRecovery({loadSource:async()=>source,transcribe});
  try{
   await vi.waitFor(()=>expect(calls).toEqual(['clip-1']));
   await new Promise(resolve=>setTimeout(resolve,60));expect(calls).toEqual(['clip-1']);
   first.resolve({provider:'p',segments:[{text:'My drive.',startMs:0,endMs:1000,timing:'provider' as const,sectionId:null}]});
   await waitState(draft.id,'clip-1','review');await waitState(draft.id,'clip-2','review');expect(calls).toEqual(['clip-1','clip-2']);
  }finally{stop();}
  const {draft:held,sections:s2,source:src2}=await fixture(2);const latest=(await getTakeSession(held.id))!;
  await drafts.save({...latest,takes:[failed('clip-1',s2[0].id,{retryAt:Date.now()+60000,serverPause:true}),failed('clip-2',s2[1].id)]} as TakeSession,latest.version);
  const waiting=vi.fn();const halt=startSectionTakeRecovery({loadSource:async()=>src2,transcribe:waiting});
  try{await new Promise(resolve=>setTimeout(resolve,150));expect(waiting).not.toHaveBeenCalled();expect((await getTakeSession(held.id))!.takes!.map(t=>t.state)).toEqual(['failed','failed']);}finally{halt();}
 });
});
