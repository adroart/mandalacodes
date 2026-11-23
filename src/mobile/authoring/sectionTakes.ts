import {AuthoringStore,type SavedSession} from '../../../lib/oracle/authoring/storage';
import {focusedComparison} from '../../../lib/oracle/authoring/passageComparison';
import {addTranscript} from '../../../lib/oracle/authoring/workflow';
import type {AuthoringServices,AuthoringSession} from '../../../lib/oracle/authoring/types';
import {SectionDraftStore,type SectionDraftResult,type SectionDraftSession,createSectionDraftSession,transcriptionReviewIssues} from '../../../lib/oracle/authoring/sectionDrafts';
import {assimilateSections} from './sectionAssimilation';
import {correctedSpeech,restoreSpokenWords} from './knownWordFixes';
import {cardSections} from '../../../lib/oracle/authoring/cardSections';
import {currentSectionTexts} from './sectionWorkflow';
import {recoverCapture} from '../../../lib/oracle/authoring/recorder';
import {rebasePassageEdit,spansOverlap} from '../../../lib/oracle/authoring/passageSpans';
import {defaultSentenceChoices,sentenceComparison} from '../../../lib/oracle/authoring/passageSentences';

export interface SectionTake {
 id:string;captureId:string;startSectionId:string;markers:{atMs:number;sectionId:string}[];
 /** `waiting`: its words are ready, but another edit in the same section is still under review. They take their turn when it is applied. */
 state:'queued'|'transcribing'|'assimilating'|'review'|'waiting'|'discarded'|'failed';
 /** The prepared review a `waiting` take holds until its section is free. */
 heldResult?:TakeResult;
 error?:string;resultSectionIds?:string[];createdAt:string;
 /** The status code (or offline/timeout) behind `error`, kept so the speaker can report what failed. */
 errorDetail?:string;
 /** Review fingerprints at queue time prevent a late result overwriting newer work. */
 baseline?:Record<string,string>;continuationOf?:string;
 /** The exact passage of the start section this take was aimed at. Only that passage may change. */
 focus?:{start:number;end:number;text:string};passageEdit?:NonNullable<SectionDraftResult['passageEdit']>;preparedFingerprints?:Record<string,string>;comparisonOriginals?:Record<string,string>;intent?:'replace'|'add'|'revise';retryAttempts?:number;retryAt?:number;
 /** The server asked for a pause (Retry-After) when this failed: no other recording is retried before `retryAt` either. */
 serverPause?:boolean;
}
export interface TakeResult extends SectionDraftResult {takeIds?:string[];
 /** true: a second listening checked every recording behind these words. false: at least one was not checked, so no doubt list means
  * nothing. Absent: the words came by a path that never double-checks (the Mac uses its own confidence instead). */
 doubtsAvailable?:boolean;
}
export interface RecordingDestination {captureId:string;sectionId:string;markers:{atMs:number;sectionId:string}[];intent?:'replace'|'add'|'revise';focus?:{start:number;end:number;text:string};passageEdit?:NonNullable<SectionDraftResult['passageEdit']>;continuationOf?:string}
export interface TakeSession extends SectionDraftSession {
 takes?:SectionTake[];linkedSessionIds?:string[];
 /** Where the live recording is going, saved as it starts, so a recording cut off by a reload or a killed app still reaches its section. */
 recording?:RecordingDestination;
 /** Earlier recordings of the same pass not yet queued when the next one started, so recovery still knows their sections. */
 earlierRecordings?:RecordingDestination[];
 results:TakeResult[];
 unassigned:{text:string;reason:string;takeId?:string}[];
}
const drafts=new SectionDraftStore(),audio=new AuthoringStore();
const running=new Map<string,Promise<void>>();
const fingerprint=(result:SectionDraftResult|undefined)=>result?JSON.stringify(result):'';
const key=(sessionId:string,captureId:string)=>`${sessionId}/${captureId}`;
export async function getTakeSession(id:string):Promise<TakeSession|undefined>{return await drafts.get(id) as TakeSession|undefined;}
async function change(id:string,update:(value:TakeSession)=>TakeSession):Promise<TakeSession>{
 for(let attempt=0;attempt<6;attempt++){
  const current=await getTakeSession(id);if(!current)throw Error('The saved section session could not be found.');
  try{return await drafts.save(update(current),current.version) as TakeSession;}
  catch(error){if(attempt===5||!/Another tab/.test(String(error)))throw error;}
 }
 throw Error('This recording changed in another window. Reopen it.');
}
async function changeAudio(id:string,update:(value:AuthoringSession)=>AuthoringSession):Promise<SavedSession>{
 for(let attempt=0;attempt<6;attempt++){
  const saved=await audio.load(id);if(!saved)throw Error('The original audio session could not be found.');
  const next=update(saved.session);if(next===saved.session)return saved;
  try{return {session:next,version:await audio.save(next,saved.version)};}
  catch(error){if(attempt===5||!/another tab/i.test(String(error)))throw error;}
 }
 throw Error('The recording changed while its transcript was being saved.');
}
function updateTake(session:TakeSession,captureId:string,values:Partial<SectionTake>):TakeSession{
 // Clearing the sentence clears its quiet detail too.
 const update='error' in values&&values.error===undefined?{...values,errorDetail:undefined}:values;
 return {...session,takes:(session.takes??[]).map(take=>take.captureId===captureId?{...take,...update}:take)};
}
const retryableStatuses=new Set([0,408,429,500,502,504]);
/** Retry a passing failure (busy, provider failure, timeout, no connection), never one the speaker must act on
 * (signed out, not allowed, too large, no speech, bad request, not set up). An explicit `retryable: false` always wins;
 * then the server's `retryable: true`; then the HTTP status, where a 409 means the speech service is still working on it;
 * an older error with neither is judged by its message. */
export function retryableTakeFailure(error:unknown):boolean{
 const value=error&&typeof error==='object'?error as {retryable?:unknown;status?:unknown;name?:unknown}:{};
 if(value.retryable===false)return false;
 if(value.retryable===true||value.status===409)return true;
 if(typeof value.status==='number'&&Number.isFinite(value.status)&&value.status!==202)return retryableStatuses.has(value.status);
 if(value.name==='TimeoutError'||value.name==='AbortError')return true;
 return /network|offline|failed to fetch|load failed|connection|temporar|timed? ?out|unavailable|\b50[234]\b/i.test(error instanceof Error?error.message:String(error??''));
}
/** How long the server asked to be left alone (Retry-After), in milliseconds; 0 when it did not ask. */
export function retryAfterMs(error:unknown):number{const value=error&&typeof error==='object'?(error as {retryAfterMs?:unknown}).retryAfterMs:undefined;return typeof value==='number'&&Number.isFinite(value)&&value>0?Math.min(value,24*60*60*1000):0;}
/** A take the speech service is still working on (409) is asked about again only after this long, times the attempt. */
const STILL_WORKING_MS=30_000;
/** The next attempt: doubling from 2 seconds to a minute, never sooner than the server asked. Undefined when it must not be retried. */
export function takeRetryAt(error:unknown,retryAttempts:number,now=Date.now()):number|undefined{
 if(retryAttempts>4||!retryableTakeFailure(error))return undefined;
 const status=error&&typeof error==='object'?(error as {status?:unknown}).status:undefined;
 return Math.max(now+Math.min(60000,2000*2**(retryAttempts-1)),now+retryAfterMs(error),status===409?now+STILL_WORKING_MS*retryAttempts:0);
}
const failureDetail=(error:unknown)=>{const detail=error&&typeof error==='object'&&'detail' in error?(error as {detail?:unknown}).detail:undefined;return typeof detail==='string'&&detail?detail:undefined;};
function rawSpeech(session:AuthoringSession,discarded:Set<string>){
 const order=new Map(session.captures.map((capture,index)=>[capture.id,index]));
 return session.transcript.filter(t=>!t.referenceOnly&&!discarded.has(t.captureId)).sort((a,b)=>(order.get(a.captureId)??0)-(order.get(b.captureId)??0)||a.startMs-b.startMs).map(t=>t.raw).join('\n');
}
const stateAfter=(session:TakeSession,hasActiveAudio=false):TakeSession['state']=>session.state==='recording'||hasActiveAudio?'recording':session.results.length?'review':'ready';
async function setPhase(id:string,captureId:string,state:SectionTake['state']){
 return change(id,session=>{
  const take=session.takes?.find(t=>t.captureId===captureId);
  return take&&take.state!=='discarded'?updateTake(session,captureId,{state,error:undefined}):session;
 });
}

function continuationChain(session:TakeSession,captureId:string):SectionTake[]{
 const chain:SectionTake[]=[],seen=new Set<string>();let next:string|undefined=captureId;
 while(next){if(seen.has(next))throw Error('This recording continuation contains a cycle. Keep its saved audio and reopen it.');seen.add(next);const take=session.takes?.find(t=>t.captureId===next);if(!take||take.state==='discarded')throw Error('An earlier part of this recording is unavailable or discarded. Restore it before continuing.');chain.unshift(take);next=take.continuationOf;}
 return chain;
}
function preservesIntegration(prior:TakeResult|undefined,result:TakeResult):TakeResult {
 return prior?.appliedText&&(prior.text!==result.text||prior.editIntent!==result.editIntent||JSON.stringify(prior.takeIds??[])!==JSON.stringify(result.takeIds??[]))?{...result,applied:false,appliedText:prior.appliedText,beforeText:prior.beforeText,appliedAt:prior.appliedAt,appliedRevision:prior.appliedRevision,integrationId:prior.integrationId,beforeWorking:prior.beforeWorking}:result;
}

type PreparedSection=Omit<TakeResult,"checked">&{checked?:boolean};
/** A passage take's review, built the same way as any take's, for a passage edit that may be held or rebased. */
function passageResult(result:PreparedSection,rootTake:SectionTake,chainIds:string[],edit:NonNullable<SectionDraftResult['passageEdit']>,words:string,transcript:Parameters<typeof transcriptionReviewIssues>[1],listening:{doubtsAvailable?:boolean},intent:'replace'|'add'|'revise'):TakeResult{
 const heardIssues=transcriptionReviewIssues(words,transcript,result.evidenceQuotes),uncertain=heardIssues.map(issue=>issue.quote.trim());
 // Spoken over a whole passage: lined up with it sentence by sentence, so each sentence can keep the old words or use the new.
 const sentencesCompared=edit.operation==='replace'?sentenceComparison(edit.focus.text,result.text):undefined;
 return {...result,...listening,comparison:sentencesCompared,rowChoices:defaultSentenceChoices(sentencesCompared),passageEdit:edit,editIntent:intent,reviewTranscript:words,comparisonOriginal:edit.sectionText,reviewIssues:[...(result.reviewIssues??[]),...heardIssues],takeIds:chainIds,checked:false,warnings:[...new Set([...result.warnings,...(uncertain.length?[`Check possible mishearings against your audio: ${[...new Set(uncertain)].join(', ')}`]:[])])]};
}
/** Whether two passage edits of one section could touch the same words. Different section versions compare by their words. */
function passagesClash(a:NonNullable<SectionDraftResult['passageEdit']>,b:NonNullable<SectionDraftResult['passageEdit']>):boolean{
 if(a.sectionText===b.sectionText)return spansOverlap(a.focus,b.focus)||(a.operation==='add'||b.operation==='add')&&a.focus.start===b.focus.start;
 return a.focus.text.includes(b.focus.text)||b.focus.text.includes(a.focus.text);
}
/**
 * Why a new passage recording cannot go to this section yet, or '' when it can. Several passages of one
 * section may be recorded one after another: each waits its turn for review. Only words that another edit
 * is already changing, or a whole-section review, stand in the way.
 */
export function passageRecordingConflict(session:TakeSession,sectionId:string,edit:NonNullable<SectionDraftResult['passageEdit']>,options:{captureId?:string;sameReview?:boolean}={}):string{
 const prior=session.results.find(result=>result.sectionId===sectionId&&!result.applied);
 if(prior&&!options.sameReview){
  if(!prior.passageEdit)return 'This section has a whole-section review waiting. Review it before recording a passage here.';
  if(passagesClash(prior.passageEdit,edit))return 'These words already have an edit waiting for review. Review it, or re-record it from review.';
 }
 for(const take of session.takes??[]){
  if(take.captureId===options.captureId||take.startSectionId!==sectionId||!['queued','transcribing','assimilating','waiting'].includes(take.state))continue;
  if(!take.passageEdit)return 'A whole-section recording for this section is still being prepared. Wait for it before recording a passage here.';
  if(passagesClash(take.passageEdit,edit))return 'A recording for these words is already being prepared. Wait for it, then review it.';
 }
 return '';
}
/** A passage recorded earlier in the same section that is still being prepared: it is reviewed first. */
const earlierInFlight=(session:TakeSession,take:SectionTake)=>(session.takes??[]).some(other=>other.captureId!==take.captureId&&other.startSectionId===take.startSectionId&&!!other.passageEdit&&['queued','transcribing','assimilating'].includes(other.state)&&other.createdAt<take.createdAt);
/** Waiting takes that can move into review now: their section is free and nothing recorded before them there is still being prepared. */
function promotable(session:TakeSession,keep?:string):SectionTake[]{
 const free=new Set<string>();
 return (session.takes??[]).filter(take=>take.state==='waiting'&&take.heldResult&&take.startSectionId!==keep).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).filter(take=>{
  if(free.has(take.startSectionId)||session.results.some(r=>r.sectionId===take.startSectionId&&!r.applied)||earlierInFlight(session,take))return false;
  free.add(take.startSectionId);return true;
 });
}
/** Writes a finished passage take: into review when its section is free, held when another edit there is under review. */
function placePassageTake(current:TakeSession,captureId:string,rootTake:SectionTake,chainIds:string[],sections:PreparedSection[],context:{words:string;transcript:Parameters<typeof transcriptionReviewIssues>[1];listening:{doubtsAvailable?:boolean};intent:'replace'|'add'|'revise';latestAudio:AuthoringSession;passageNow:string;unassigned:{text:string;reason:string}[]}):TakeSession{
 const sectionId=rootTake.startSectionId,edit=rootTake.passageEdit!,prepared=sections.find(result=>result.sectionId===sectionId);
 const discarded=new Set((current.takes??[]).filter(t=>t.state==='discarded').map(t=>t.captureId));
 const base={...current,rawTranscript:rawSpeech(context.latestAudio,discarded),unassigned:[...current.unassigned.filter(u=>!u.takeId||!chainIds.includes(u.takeId)),...context.unassigned.map(u=>({...u,takeId:captureId}))]};
 const done=(session:TakeSession,values:Partial<SectionTake>)=>{const next=updateTake(session,captureId,{preparedFingerprints:undefined,resultSectionIds:[sectionId],error:undefined,retryAt:undefined,retryAttempts:0,...values});return {...next,state:stateAfter(current,context.latestAudio.captures.some(c=>c.status==='recording'))==='recording'?'recording' as const:next.results.length?'review' as const:'ready' as const};};
 if(!prepared)return done(base,{state:'review'});
 const prior=current.results.find(result=>result.sectionId===sectionId);
 const sameReview=!!prior?.passageEdit&&JSON.stringify(prior.passageEdit)===JSON.stringify(edit);
 const own=current.takes?.find(t=>t.captureId===captureId);
 if(prior&&!prior.applied&&!sameReview||own&&earlierInFlight(current,own))return done(base,{state:'waiting',heldResult:passageResult(prepared,rootTake,chainIds,edit,context.words,context.transcript,context.listening,context.intent)});
 const rebased=rebasePassageEdit(edit,context.passageNow);
 if(!rebased)return done({...base,unassigned:[...base.unassigned,{text:prepared.text,reason:'The passage these words were for has changed. Place them again.',takeId:captureId}]},{state:'review'});
 const result=preservesIntegration(prior,passageResult(prepared,rootTake,chainIds,rebased,context.words,context.transcript,context.listening,context.intent));
 const order=new Map(current.sections.map((section,index)=>[section.id,index]));
 const results=[...base.results.filter(r=>r.sectionId!==sectionId),result].sort((a,b)=>(order.get(a.sectionId)??0)-(order.get(b.sectionId)??0));
 return done({...base,results},{state:'review',preparedFingerprints:{[sectionId]:fingerprint(result)}});
}
/**
 * Moves the earliest waiting passage of each free section into review, carried onto the section's current
 * words. `keep` names a section whose just-applied review should stay on screen (its Undo lives there).
 * Words whose passage is no longer there word for word go to the unplaced words instead.
 */
export async function promoteWaitingTakes(sessionId:string,keep?:string):Promise<TakeSession|undefined>{
 const session=await getTakeSession(sessionId);
 // Nothing is saved when nothing can move, so a caller may ask after every change without a loop.
 if(!session||!promotable(session,keep).length)return session;
 const references=await currentSectionTexts(session);
 return change(sessionId,current=>{
  let next=current,moved=false;
  for(const take of promotable(current,keep)){
   const sectionId=take.startSectionId,prior=next.results.find(result=>result.sectionId===sectionId);
   const held=take.heldResult!,text=references[sectionId]??next.sections.find(section=>section.id===sectionId)?.text??'';
   const edit=held.passageEdit&&rebasePassageEdit(held.passageEdit,text);
   moved=true;
   if(!edit){next=updateTake({...next,unassigned:[...next.unassigned,{text:held.text,reason:'The passage these words were for has changed. Place them again.',takeId:take.captureId}]},take.captureId,{state:'review',heldResult:undefined});continue;}
   // The sentence comparison is against the passage's own words, which moved but did not change.
   const result=preservesIntegration(prior,{...held,passageEdit:edit,comparisonOriginal:edit.sectionText});
   const order=new Map(next.sections.map((section,index)=>[section.id,index]));
   next=updateTake({...next,results:[...next.results.filter(r=>r.sectionId!==sectionId),result].sort((a,b)=>(order.get(a.sectionId)??0)-(order.get(b.sectionId)??0))},take.captureId,{state:'review',heldResult:undefined,preparedFingerprints:{[sectionId]:fingerprint(result)}});
  }
  return moved?{...next,state:next.state==='recording'?'recording':'review'}:current;
 });
}
function launch(id:string,captureId:string,services:AuthoringServices){
 const jobKey=key(id,captureId);if(running.has(jobKey))return;
 const task=(async()=>{try{
  let session=await getTakeSession(id),take=session?.takes?.find(t=>t.captureId===captureId);
  if(!session||!take||take.state==='discarded'||take.state==='review'||take.state==='waiting')return;
  if(!session.captureSessionId||!services.transcribe)throw Error('Transcription is not connected. Your saved take can be retried.');
  let saved=await audio.load(session.captureSessionId);if(!saved)throw Error('The original audio session could not be found.');
  const capture=saved.session.captures.find(c=>c.id===captureId);
  if(!capture||!['ready','interrupted'].includes(capture.status))throw Error('Finish this take before processing it. Other recordings can continue.');
  if(!saved.session.transcript.some(t=>t.captureId===captureId)){
   await setPhase(id,captureId,'transcribing');
   const response=await services.transcribe(saved.session,capture,await audio.audio(saved.session.id,captureId));
   saved=await changeAudio(saved.session.id,current=>{
    if(current.transcript.some(t=>t.captureId===captureId))return current;
    const adjusted={...current,captures:current.captures.map(c=>c.id===captureId?{...c,durationMs:Math.max(c.durationMs,response.durationMs??0),...(response.arCreate?{arCreate:response.arCreate}:{})}:c)};
    return addTranscript(adjusted,captureId,response.segments,response.provider,{doubts:response.doubts,doubtsAvailable:response.doubtsAvailable});
   });
  }
  session=await getTakeSession(id);take=session?.takes?.find(t=>t.captureId===captureId);
  if(!session||!take||take.state==='discarded')return;
  if(take.continuationOf){
   // Own transcription may finish first. Editorial preparation follows the predecessor.
   const predecessor=session.takes?.find(t=>t.captureId===take!.continuationOf);
   if(predecessor&&['queued','transcribing','assimilating'].includes(predecessor.state)){launch(id,predecessor.captureId,services);await running.get(key(id,predecessor.captureId));}
   session=await getTakeSession(id);take=session?.takes?.find(t=>t.captureId===captureId);if(!session||!take||take.state==='discarded')return;
   saved=await audio.load(session.captureSessionId!);if(!saved)throw Error('The saved audio session could not be read.');
  }
  const chain=continuationChain(session,captureId),chainIds=chain.map(t=>t.captureId),rootTake=chain[0];
  if(chain.some(t=>!saved!.session.transcript.some(transcript=>transcript.captureId===t.captureId&&!transcript.referenceOnly)))throw Error('An earlier part of this recording has not finished transcription. Retry after that saved part is ready.');
  let elapsed=0;const offsets=new Map<string,number>();for(const part of chain){offsets.set(part.captureId,elapsed);elapsed+=saved.session.captures.find(c=>c.id===part.captureId)?.durationMs??0;}
  const transcript=chain.flatMap(part=>saved!.session.transcript.filter(t=>t.captureId===part.captureId&&!t.referenceOnly).sort((a,b)=>a.startMs-b.startMs).map(t=>({...t,startMs:t.startMs+(offsets.get(part.captureId)??0),endMs:t.endMs+(offsets.get(part.captureId)??0),words:t.words})));
  // Matching reads the words with known mishearings fixed; evidence and review stay on the raw words.
  const speech=correctedSpeech(transcript),words=speech.raw,heard=speech.corrected;if(!words.trim())throw Error('No speech was found in this take. Your audio is saved.');
  const checked=transcript.some(t=>t.doubtsAvailable===false)?false:transcript.length&&transcript.every(t=>t.doubtsAvailable===true)?true:undefined;
  const listening=checked===undefined?{}:{doubtsAvailable:checked};
  await change(id,current=>{
   const own=current.takes?.find(t=>t.captureId===captureId);if(!own||own.state==='discarded')return current;
   const discarded=new Set((current.takes??[]).filter(t=>t.state==='discarded').map(t=>t.captureId));
   return updateTake({...current,rawTranscript:rawSpeech(saved!.session,discarded)},captureId,{state:'assimilating',error:undefined});
  });
  const latestReferences=await currentSectionTexts(session);
  const references=rootTake.comparisonOriginals??Object.fromEntries(session.sections.map(section=>[section.id,latestReferences[section.id]??section.text]));
  if(!rootTake.comparisonOriginals)await change(id,current=>updateTake(current,rootTake.captureId,{comparisonOriginals:references}));
  const relatedSources=rootTake.passageEdit?[]:await Promise.all(explicitDestinationCards(heard,session.cardNumber).map(async cardNumber=>{const source=await services.loadSource(cardNumber);if(source.cardNumber!==cardNumber)throw Error('The related card source does not match its requested card.');const sections=cardSections(source);const references=await currentSectionTexts(createSectionDraftSession(source,sections));return {cardNumber,source,sections,references};}));
  if(relatedSources.length)await changeAudio(saved.session.id,current=>{
   const sources=[current.source,...(current.relatedSources??[])],additions=relatedSources.map(item=>item.source).filter(source=>{
    const existing=sources.filter(candidate=>candidate.cardNumber===source.cardNumber);
    if(existing.some(candidate=>candidate.hash!==source.hash))throw Error('The related card changed from its saved audio source. Reopen the card before continuing.');
    return !existing.length;
   });
   return additions.length?{...current,relatedSources:[...(current.relatedSources??[]),...additions]}:current;
  });
  const intent=rootTake.passageEdit?.operation??take.intent??inferSpokenEditIntent(heard,!!references[take.startSectionId]);
  // A chosen passage has one destination and one operation. Its transcript is the editable proposal;
  // no model may route, rewrite, or reclassify it as a different section.
  const prepared=rootTake.passageEdit
   ?restoreSpokenWords({sections:[{sectionId:rootTake.startSectionId,text:heard,evidenceQuotes:[heard],changes:[],warnings:[]}],unassigned:[]},speech)
   :restoreSpokenWords(await assimilateSections({words:heard,intent,relatedSources:relatedSources.map(({cardNumber,sections,references})=>({cardNumber,sections:sections.map(({id,title,path,text})=>({id,title,path,text:references[id]??text}))})),sections:session.sections.map(({id,title,path,text})=>({id,title,path,text:references[id]??text})),startSectionId:rootTake.startSectionId,markers:chain.flatMap(part=>part.markers.map(marker=>({...marker,atMs:marker.atMs+(offsets.get(part.captureId)??0)}))),segments:transcript.map(t=>({text:t.corrected||t.raw,startMs:t.startMs,endMs:t.endMs}))}),speech);
  const active=await getTakeSession(id);if(active?.takes?.find(t=>t.captureId===captureId)?.state==='discarded')return;
  const linkedSessionIds:string[]=[];
  for(const destination of relatedSources){
   const foreign=prepared.sections.filter(result=>destination.sections.some(section=>section.id===result.sectionId));if(!foreign.length)continue;
   // Stable IDs make a resumed job idempotent. Never overwrite an edited destination review.
   const linkedId=`${session.id}/${captureId}/card-${destination.cardNumber}`;
   const existing=await drafts.get(linkedId);
   if(!existing){
    const linked=createSectionDraftSession(destination.source,destination.sections,foreign[0].sectionId);
    await drafts.save({...linked,id:linkedId,captureSessionId:session.captureSessionId,captureId,takes:chain.map(part=>({...part,state:'review' as const,error:undefined,retryAt:undefined,retryAttempts:0,resultSectionIds:foreign.map(result=>result.sectionId)})),rawTranscript:words,state:'review',results:foreign.map(result=>({...result,...listening,takeIds:chainIds,editIntent:intent,comparisonOriginal:result.comparisonOriginal??destination.references[result.sectionId]??destination.sections.find(section=>section.id===result.sectionId)?.text,reviewTranscript:words,checked:false,reviewIssues:[...(result.reviewIssues??[]),...transcriptionReviewIssues(words,transcript,result.evidenceQuotes)]})),unassigned:[]} as TakeSession,0);
   }
   linkedSessionIds.push(linkedId);
  }
  const localSections=prepared.sections.filter(result=>session!.sections.some(section=>section.id===result.sectionId));
  const latestAudio=await audio.load(saved.session.id);if(!latestAudio)throw Error('The saved audio session could not be read.');
  const passageNow=rootTake.passageEdit?(await currentSectionTexts(session))[rootTake.startSectionId]??session.sections.find(section=>section.id===rootTake.startSectionId)?.text:undefined;
  await change(id,current=>{
   const own=current.takes?.find(t=>t.captureId===captureId);if(!own||own.state==='discarded')return current;
   // A chosen passage is anchored by its own words, not by the section's state when it was sent: another
   // passage of the same section may have been applied meanwhile. One still under review goes first.
   if(rootTake.passageEdit&&passageNow!==undefined)return placePassageTake(current,captureId,rootTake,chainIds,localSections,{words,transcript,listening,intent,latestAudio:latestAudio.session,passageNow,unassigned:prepared.unassigned});
   for(const result of localSections){
    const prior=current.results.find(r=>r.sectionId===result.sectionId),stamp=fingerprint(prior);
    const initial=continuationChain(current,captureId)[0];
    const unchangedBaseline=stamp===(initial.baseline?.[result.sectionId]??'');
    const generatedByChain=!!prior&&!prior.checked&&!prior.applied&&!!prior.takeIds?.length&&prior.takeIds.every(id=>chainIds.includes(id))&&(current.takes??[]).some(producer=>chainIds.includes(producer.captureId)&&producer.preparedFingerprints?.[result.sectionId]===stamp);
    if(!unchangedBaseline&&!generatedByChain)throw Error('This section was edited or integrated after the take was sent. Keep those newer words and retry this take when ready.');
   }
   const resultIds=new Set(localSections.map(result=>result.sectionId));
   const discarded=new Set((current.takes??[]).filter(t=>t.state==='discarded').map(t=>t.captureId));
   const results:TakeResult[]=[...current.results.filter(result=>!resultIds.has(result.sectionId)),...localSections.map(result=>{
    // Only doubtful words inside this section's own evidence, the same ones its word checks are made from.
    const heardIssues=transcriptionReviewIssues(words,transcript,result.evidenceQuotes),uncertain=heardIssues.map(issue=>issue.quote.trim());
    const comparisonOriginal=rootTake.passageEdit?.sectionText??references[result.sectionId]??session!.sections.find(section=>section.id===result.sectionId)?.text;
    // An aimed take gives every spoken word to its passage; the AI alignment cannot move them elsewhere in the section.
    const aimed=rootTake.focus&&result.sectionId===rootTake.startSectionId&&intent!=='add'&&comparisonOriginal!==undefined?focusedComparison(comparisonOriginal,result.text,rootTake.focus):undefined;
    return {...result,...listening,...(aimed?{comparison:aimed}:{}),...(rootTake.passageEdit?{passageEdit:rootTake.passageEdit}:{}),editIntent:intent,reviewTranscript:words,comparisonOriginal,reviewIssues:[...(result.reviewIssues??[]),...heardIssues],takeIds:chainIds,checked:false,warnings:[...new Set([...result.warnings,...(uncertain.length?[`Check possible mishearings against your audio: ${[...new Set(uncertain)].join(', ')}`]:[])])]};
   })].map(result=>preservesIntegration(current.results.find(prior=>prior.sectionId===result.sectionId),result));
   const order=new Map(current.sections.map((section,index)=>[section.id,index]));results.sort((a,b)=>(order.get(a.sectionId)??0)-(order.get(b.sectionId)??0));
   const next=updateTake({...current,linkedSessionIds:[...new Set([...(current.linkedSessionIds??[]),...linkedSessionIds])],results,unassigned:[...current.unassigned.filter(u=>!u.takeId||!chainIds.includes(u.takeId)),...prepared.unassigned.map(u=>({...u,takeId:captureId}))],rawTranscript:rawSpeech(latestAudio.session,discarded)},captureId,{state:'review',preparedFingerprints:Object.fromEntries(results.filter(result=>resultIds.has(result.sectionId)).map(result=>[result.sectionId,fingerprint(result)])),resultSectionIds:[...resultIds],error:undefined,retryAt:undefined,retryAttempts:0});
   return {...next,state:stateAfter(current,latestAudio.session.captures.some(c=>c.status==='recording'))==='recording'?'recording':'review'};
  });
 }catch(error){
  await change(id,session=>{
   const take=session.takes?.find(t=>t.captureId===captureId);if(!take||take.state==='discarded')return session;
   const message=error instanceof Error?error.message:'This recording could not be prepared. It is saved on this device.';
   const retryAttempts=(take.retryAttempts??0)+1;
   const retryAt=takeRetryAt(error,retryAttempts);
   const next=updateTake(session,captureId,{state:'failed',error:message,errorDetail:failureDetail(error),retryAttempts,retryAt,serverPause:retryAt!==undefined&&retryAfterMs(error)>0?true:undefined});
   return {...next,state:stateAfter(next)};
  }).catch(()=>undefined);
 }})().finally(()=>running.delete(jobKey));
 running.set(jobKey,task);
}
/** Persist the job before returning; transcription and AI continue independently. */
export async function queueSectionTake(sessionId:string,captureId:string,startSectionId:string,services:AuthoringServices,markers:{atMs:number;sectionId:string}[]=[],options:{intent?:'replace'|'add'|'revise';continuationOf?:string;focus?:{start:number;end:number;text:string};passageEdit?:NonNullable<SectionDraftResult['passageEdit']>;reRecordPassage?:boolean}={}):Promise<TakeSession>{
 const registered=await change(sessionId,session=>{
  if(!session.sections.some(section=>section.id===startSectionId)||markers.some(m=>!Number.isFinite(m.atMs)||m.atMs<0||!session.sections.some(s=>s.id===m.sectionId)))throw Error('Choose an existing section before sending this take.');
  const existing=session.takes?.find(t=>t.captureId===captureId);
  if(existing&&['queued','transcribing','assimilating','review','discarded'].includes(existing.state))return session;
  const prior=session.results.find(result=>result.sectionId===startSectionId&&!result.applied);
  const sameReview=!!options.reRecordPassage&&!!prior?.passageEdit&&JSON.stringify(prior.passageEdit)===JSON.stringify(options.passageEdit);
  const conflict=options.passageEdit?passageRecordingConflict(session,startSectionId,options.passageEdit,{captureId,sameReview}):'';
  if(conflict)throw Error(`${conflict} Your saved audio remains available.`);
  const parentId=options.continuationOf??existing?.continuationOf,parent=parentId?session.takes?.find(t=>t.captureId===parentId):undefined;
  if(parentId&&(!parent||parentId===captureId||parent.state==='discarded'))throw Error('Continue only a saved recording for this same section.');
  if(parentId&&continuationChain(session,parentId).some(part=>part.captureId===captureId))throw Error('A recording cannot continue itself.');
  const baseline=Object.fromEntries(session.results.map(result=>[result.sectionId,fingerprint(result)]));
  const take:SectionTake={id:captureId,captureId,startSectionId,markers:markers.length?structuredClone(markers):[{atMs:0,sectionId:startSectionId}],state:'queued',continuationOf:parentId,intent:options.intent??existing?.intent??parent?.intent,focus:options.focus??existing?.focus??parent?.focus,passageEdit:options.passageEdit??existing?.passageEdit??parent?.passageEdit,retryAttempts:existing?.retryAttempts??0,createdAt:existing?.createdAt??new Date().toISOString(),baseline};
  return {...session,takes:[...(session.takes??[]).filter(t=>t.captureId!==captureId),take]};
 });
 const take=registered.takes?.find(t=>t.captureId===captureId);if(take&&['queued','transcribing','assimilating'].includes(take.state))launch(sessionId,captureId,services);
 return registered;
}
export async function resumeSectionTakes(services:AuthoringServices){
 for(const session of await drafts.list() as TakeSession[])for(const take of session.takes??[])if(['queued','transcribing','assimilating'].includes(take.state))launch(session.id,take.captureId,services);
}
/** The session with `destination` as the live recording; the one it replaces is kept until a take refers to it. */
export function withRecordingDestination(session:TakeSession,destination:RecordingDestination|undefined):TakeSession{
 const queued=new Set((session.takes??[]).map(take=>take.captureId));
 const earlier=[...(session.earlierRecordings??[]),...(session.recording?[session.recording]:[])].filter(item=>!queued.has(item.captureId)&&item.captureId!==destination?.captureId).slice(-8);
 return {...session,recording:destination,earlierRecordings:earlier.length?earlier:undefined};
}
export interface InterruptedRecovery {session?:TakeSession;queued:number;saved:number}
/** A recording left mid-way by a reload or a killed app is closed with the audio it saved. When its section is known it
 * is queued exactly like a finished recording; otherwise it stays saved with the other recordings. A finished recording
 * that no take refers to (its queueing failed) is queued the same way when its section is known, and otherwise stays
 * listed with the saved recordings. The take queue dedupes by capture, so the same audio is never prepared twice.
 * `liveCaptureId` is never touched. */
export async function recoverInterruptedRecordings(sessionId:string,services:AuthoringServices,liveCaptureId?:string):Promise<InterruptedRecovery>{
 const draft=await getTakeSession(sessionId);if(!draft?.captureSessionId)return {session:draft,queued:0,saved:0};
 const first=await audio.load(draft.captureSessionId);if(!first)return {session:draft,queued:0,saved:0};
 const destinations=[...(draft.earlierRecordings??[]),...(draft.recording?[draft.recording]:[])].filter(item=>item.captureId!==liveCaptureId);
 const queuedIds=new Set((draft.takes??[]).map(take=>take.captureId));
 // Also catches a recording closed earlier whose queueing was itself cut off or failed.
 const stranded=first.session.captures.filter(c=>c.id!==liveCaptureId&&(c.status==='recording'||['ready','interrupted'].includes(c.status)&&c.durationMs>0&&!queuedIds.has(c.id)&&destinations.some(item=>item.captureId===c.id)));
 let queued=0,saved=0,session:TakeSession|undefined=draft;
 for(const capture of stranded){
  let closed=capture;
  if(closed.status==='recording')for(let attempt=0;attempt<4;attempt++){
   const latest=await audio.load(first.session.id);const own=latest?.session.captures.find(c=>c.id===capture.id);if(!latest||!own)break;
   if(own.status!=='recording'){closed=own;break;}
   try{closed=(await recoverCapture(audio,latest,capture.id)).session.captures.find(c=>c.id===capture.id)!;break;}
   catch(error){if(attempt===3||!/another tab/i.test(String(error)))throw error;}
  }
  if(closed.status==='empty'||closed.status==='recording'||queuedIds.has(capture.id))continue;
  const current=await getTakeSession(sessionId),destination=destinations.find(item=>item.captureId===capture.id);
  if(current&&destination&&current.sections.some(s=>s.id===destination.sectionId)){
   const parent=destination.continuationOf&&current.takes?.some(t=>t.captureId===destination.continuationOf&&t.state!=='discarded')?destination.continuationOf:undefined;
   const markers=destination.markers.filter(m=>m.atMs<=closed.durationMs&&current.sections.some(s=>s.id===m.sectionId));
   session=await queueSectionTake(sessionId,capture.id,destination.sectionId,services,markers.length?markers:[{atMs:0,sectionId:destination.sectionId}],{intent:destination.intent,continuationOf:parent,focus:destination.focus,passageEdit:destination.passageEdit});
   queuedIds.add(capture.id);queued++;
  }else saved++;
 }
 const latest=await getTakeSession(sessionId);
 // Nothing records into this session from a window that was closed: it leaves the recording state it was cut off in.
 // A recording started since this check began (a new capture id) is left alone.
 const stale=(s:TakeSession)=>!liveCaptureId&&s.captureId===draft.captureId&&s.recording?.captureId===draft.recording?.captureId&&(s.state==='recording'||!!s.recording);
 if(latest&&stale(latest))session=await change(sessionId,s=>stale(s)?{...s,recording:undefined,state:s.state==='recording'?(s.results.length?'review':'ready'):s.state}:s);
 else session=latest??session;
 return {session,queued,saved};
}
/** Discard is recoverable. Audio and source transcripts remain in their original store. */
export async function discardSectionTake(sessionId:string,captureId:string):Promise<TakeSession>{
 const original=await getTakeSession(sessionId);if(!original)throw Error('This recording session could not be found.');
 const linked=await Promise.all((original.linkedSessionIds??[]).filter(link=>link.includes(`/${captureId}/card-`)).map(link=>drafts.get(link)));
 if(linked.some(session=>session?.results.length))throw Error('This take also has words on another card. Keep its shared recording and review the linked card first.');
 const saved=original.captureSessionId?await audio.load(original.captureSessionId):null;
 if(saved?.session.captures.find(c=>c.id===captureId)?.status==='recording')throw Error('Stop this take before discarding it.');
 return change(sessionId,session=>{
  let takes=session.takes??[],own=takes.find(t=>t.captureId===captureId);
  if(!own){
   if(!saved?.session.captures.some(c=>c.id===captureId))throw Error('This recording could not be found.');
   const populated=saved.session.captures.filter(c=>c.status!=='empty');
   if(populated.length!==1)throw Error('This older session has several recordings without separate section links. Keep it intact and start a new session.');
   if(session.results.some(r=>r.applied))throw Error('This recording has integrated words. Undo those sections before discarding its draft.');
   own={id:captureId,captureId,startSectionId:session.startSectionId,markers:[{atMs:0,sectionId:session.startSectionId}],state:'review',createdAt:new Date().toISOString(),resultSectionIds:session.results.map(r=>r.sectionId)};
   takes=[own];
  }
  const associated=session.results.filter(result=>result.takeIds?.includes(captureId)||(!result.takeIds?.length&&own!.resultSectionIds?.includes(result.sectionId)));
  if(associated.some(result=>result.applied))throw Error('This take has integrated words. Undo those sections before discarding it.');
  if(associated.some(result=>result.takeIds&&result.takeIds.length>1))throw Error('This section combines several takes. Keep its words intact and review the section first.');
  const ids=new Set(associated.map(r=>r.sectionId));
  const discarded=new Set([...takes.filter(t=>t.state==='discarded').map(t=>t.captureId),captureId]);
  const next=updateTake({...session,takes,results:session.results.filter(r=>!ids.has(r.sectionId)),unassigned:session.unassigned.filter(u=>u.takeId!==captureId&&!(takes.length===1&&!u.takeId)),rawTranscript:saved?rawSpeech(saved.session,discarded):session.rawTranscript},captureId,{state:'discarded',error:undefined});
  return {...next,state:stateAfter(next)};
 });
}
export async function restoreSectionTake(sessionId:string,captureId:string,services:AuthoringServices):Promise<TakeSession>{
 const saved=await change(sessionId,session=>{
  const own=session.takes?.find(t=>t.captureId===captureId);if(!own||own.state!=='discarded')throw Error('Choose a discarded take to restore.');
  return updateTake(session,captureId,{state:'queued',error:undefined,baseline:Object.fromEntries(session.results.map(result=>[result.sectionId,fingerprint(result)]))});
 });
 launch(sessionId,captureId,services);return saved;
}

/** Only explicit navigation verbs establish another card, never a passing correspondence. */
export function explicitDestinationCards(words:string,currentCard:number):number[]{
 const names=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
 const parse=(value:string)=>{if(/^\d+$/.test(value))return Number(value);const parts=value.toLowerCase().split(/[ -]+/);if(parts.length===1&&names.includes(parts[0]))return names.indexOf(parts[0]);const tens:Record<string,number>={twenty:20,thirty:30,forty:40,fifty:50,sixty:60};return tens[parts[0]]===undefined?NaN:tens[parts[0]]+(parts[1]?names.indexOf(parts[1]):0);};
 const pattern=/\b(?:next\s+|(?:go|move|switch|change)(?:\s+on)?\s+to\s+|(?:now)\s+(?:let(?:'s| us)\s+)?(?:work\s+on\s+)?)(?:card|code|gate)\s+(\d{1,2}|(?:twenty|thirty|forty|fifty|sixty)(?:[ -](?:one|two|three|four|five|six|seven|eight|nine))?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b/gi;
 return [...new Set([...words.matchAll(pattern)].map(match=>parse(match[1])).filter(number=>Number.isInteger(number)&&number>=1&&number<=64&&number!==currentCard))];
}

/** Retries in flight, across every session: one at a time, so a provider that is failing is asked once, not by every waiting recording. */
const retrying=new Set<string>();
const RECOVERY_RETRY_MS=5000;
/** Event-driven recovery with persisted backoff. Timers do no work while offline. Failed recordings are retried one at a
 * time, earliest due first, and none before a pause the server asked for (Retry-After) has passed. */
export function startSectionTakeRecovery(services:AuthoringServices):()=>void {
 let disposed=false,timer:ReturnType<typeof setTimeout>|undefined,checking=false,again=false;
 const recover=async()=>{
  if(disposed)return;if(checking){again=true;return;}checking=true;clearTimeout(timer);
  let nextAt=Infinity;
  try{
   if(typeof navigator!=='undefined'&&navigator.onLine===false)return;
   const due:{sessionId:string;take:SectionTake}[]=[];
   const sessions=await drafts.list() as TakeSession[],now=Date.now();
   const pausedUntil=Math.max(0,...sessions.flatMap(session=>(session.takes??[]).filter(t=>t.state==='failed'&&t.serverPause&&t.retryAt!==undefined).map(t=>t.retryAt!)));
   for(const session of sessions)for(const take of session.takes??[]){
    if(['queued','transcribing','assimilating'].includes(take.state))launch(session.id,take.captureId,services);
    if(take.state==='failed'&&take.retryAt!==undefined){
     const at=Math.max(take.retryAt,pausedUntil);
     if(at<=now)due.push({sessionId:session.id,take});else nextAt=Math.min(nextAt,at);
    }
   }
   due.sort((a,b)=>a.take.retryAt!-b.take.retryAt!);
   const next=retrying.size?undefined:due[0];
   if(next){
    const {sessionId,take}=next,jobKey=key(sessionId,take.captureId);
    await change(sessionId,current=>{const own=current.takes?.find(t=>t.captureId===take.captureId);return own?.state==='failed'&&own.retryAt===take.retryAt?updateTake(current,take.captureId,{state:'queued',retryAt:undefined,serverPause:undefined}):current;});
    launch(sessionId,take.captureId,services);
    const job=running.get(jobKey);
    if(job){retrying.add(jobKey);void job.finally(()=>{retrying.delete(jobKey);void recover();});}
   }else if(due.length)nextAt=Math.min(nextAt,now+1000);
  }catch(error){
   // Reading or changing the saved drafts failed: try again shortly rather than wait for the next focus or change.
   console.warn('Recording recovery could not run; trying again shortly.',error instanceof Error?error.name:'unknown');
   nextAt=Math.min(nextAt,Date.now()+RECOVERY_RETRY_MS);
  }finally{
   if(Number.isFinite(nextAt)&&!disposed){clearTimeout(timer);timer=setTimeout(()=>void recover(),Math.max(1,nextAt-Date.now()));}checking=false;if(again&&!disposed){again=false;void recover();}}
 };
 const onChange=()=>{void recover();};const unsubscribe=drafts.subscribe(onChange);
 if(typeof window!=='undefined'){window.addEventListener('online',onChange);window.addEventListener('focus',onChange);}
 void recover();
 return()=>{disposed=true;clearTimeout(timer);unsubscribe();if(typeof window!=='undefined'){window.removeEventListener('online',onChange);window.removeEventListener('focus',onChange);}};
}

/** Auto mode recognizes only an opening editorial command. Personal prose is never a command. */
export function inferSpokenEditIntent(words:string,hasHumanBaseline:boolean):'add'|'replace'{
 // A human baseline changes comparison context, not the speaker's replacement authority.
 void hasHumanBaseline;
 const opening=words.trimStart().replace(/^(?:please\s+|okay[,.:]?\s+|ok[,.:]?\s+)/i,'');
 if(/^(?:add\s+(?:this\b|these\s+words\b|to\s+(?:this|the)\s+section\b)|append\b)/i.test(opening))return 'add';
 if(/^(?:replace\b|rewrite\b|start\s+over\b)/i.test(opening))return 'replace';
 return 'replace';
}
