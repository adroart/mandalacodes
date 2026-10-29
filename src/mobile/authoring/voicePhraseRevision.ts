import {AuthoringStore} from '../../../lib/oracle/authoring/storage';
import {SectionDraftStore,transcriptionReviewIssues,type SectionDraftResult} from '../../../lib/oracle/authoring/sectionDrafts';
import {addTranscript} from '../../../lib/oracle/authoring/workflow';
import type {AuthoringServices,AuthoringSession} from '../../../lib/oracle/authoring/types';
import {buildPassageComparison,type PassageComparison} from '../../../lib/oracle/authoring/passageComparison';
import {assimilateSections,type SectionAssimilationResult} from './sectionAssimilation';
import type {TakeSession,SectionTake} from './sectionTakes';

export interface VoicePhraseRevisionInput {draftId:string;sectionId:string;from:number;to:number;baseText:string;captureSessionId:string;captureId:string}
export interface VoicePhrasePatch extends VoicePhraseRevisionInput {
 id:string;original:string;rawReplacement:string;replacement?:string;createdAt:string;state:'review'|'held'|'failed';reason?:string;
}
export interface VoicePhraseDraft extends TakeSession {phrasePatches?:VoicePhrasePatch[];pendingPhraseRevisions?:VoicePhraseRevisionInput[]}
export interface VoicePhraseRevisionOutcome {state:'review'|'held'|'failed';session:VoicePhraseDraft;reason?:string}
const drafts=new SectionDraftStore(),audio=new AuthoringStore();
const running=new Map<string,Promise<VoicePhraseRevisionOutcome>>();
async function change(id:string,update:(value:VoicePhraseDraft)=>VoicePhraseDraft):Promise<VoicePhraseDraft>{
 for(let attempt=0;attempt<6;attempt++){
  const current=await drafts.get(id) as VoicePhraseDraft|undefined;if(!current)throw Error('The selected draft could not be found.');
  const next=update(current);
  if(next===current)return current;
  try{return await drafts.save(next,current.version) as VoicePhraseDraft;}catch(error){if(attempt===5||!/another tab/i.test(String(error)))throw error;}
 }
 throw Error('The phrase changed while saving.');
}
const tokens=(text:string):string[]=>text.normalize('NFKC').toLocaleLowerCase().match(/[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*/gu)??[];
/** Cleanup must be reproducible from explicitly documented edits to literal speech.
 * Casing and punctuation may change; adding or paraphrasing lexical words is held. */
function mechanical(words:string,result:SectionAssimilationResult['sections'][number]):boolean{
 let cleaned=words;
 for(const edit of result.changes){
  const at=cleaned.indexOf(edit.before);if(!edit.before||at<0||cleaned.indexOf(edit.before,at+1)>=0)return false;
  const source=tokens(edit.before),target=tokens(edit.after);let cursor=0;
  for(const token of target){const next=source.indexOf(token,cursor);if(next<0)return false;cursor=next+1;}
  cleaned=cleaned.slice(0,at)+edit.after+cleaned.slice(at+edit.before.length);
 }
 return JSON.stringify(tokens(cleaned))===JSON.stringify(tokens(result.text));
}
/** Preserve valid comparison coverage, merging touched linked spans and shifting
 * following offsets. The original source offsets never change. */
function patchComparison(result:SectionDraftResult,from:number,to:number,replacement:string):PassageComparison|undefined{
 const snapshot=result.comparison;if(!snapshot||buildPassageComparison(snapshot.originalText,result.text,snapshot).kind!=='matched')return;
 const delta=replacement.length-(to-from),affected=snapshot.pairs.filter(pair=>pair.textStart<to&&pair.textEnd>from);
 if(!affected.length)return;
 const first=affected[0],last=affected.at(-1)!;
 const pairs=[...snapshot.pairs.filter(pair=>pair.textEnd<=from).map(pair=>({...pair})),{originalStart:first.originalStart,originalEnd:last.originalEnd,textStart:first.textStart,textEnd:last.textEnd+delta},...snapshot.pairs.filter(pair=>pair.textStart>=to).map(pair=>({...pair,textStart:pair.textStart+delta,textEnd:pair.textEnd+delta}))];
 const text=result.text.slice(0,from)+replacement+result.text.slice(to),updated={...snapshot,spokenText:text,pairs};
 return buildPassageComparison(snapshot.originalText,text,updated).kind==='matched'?updated:undefined;
}
async function transcribe(input:VoicePhraseRevisionInput,services:AuthoringServices){
 let saved=await audio.load(input.captureSessionId);if(!saved)throw Error('The replacement recording could not be found.');
 const capture=saved.session.captures.find(item=>item.id===input.captureId);
 if(!capture||!['ready','interrupted'].includes(capture.status))throw Error('Finish the phrase recording before reviewing it.');
 if(!saved.session.transcript.some(item=>item.captureId===input.captureId)){
  if(!services.transcribe)throw Error('Transcription is not connected. Your phrase recording is saved.');
  const response=await services.transcribe(saved.session,capture,await audio.audio(input.captureSessionId,input.captureId));
  for(let attempt=0;attempt<6;attempt++){
   saved=await audio.load(input.captureSessionId);if(!saved)throw Error('The replacement recording could not be reopened.');
   if(saved.session.transcript.some(item=>item.captureId===input.captureId))break;
   const adjusted:AuthoringSession={...saved.session,captures:saved.session.captures.map(item=>item.id===input.captureId?{...item,durationMs:Math.max(item.durationMs,response.durationMs??0),...(response.arCreate?{arCreate:response.arCreate}:{})}:item)};
   const next=addTranscript(adjusted,input.captureId,response.segments,response.provider);
   try{saved={session:next,version:await audio.save(next,saved.version)};break;}catch(error){if(attempt===5||!/another tab/i.test(String(error)))throw error;}
  }
 }
 return saved.session.transcript.filter(item=>item.captureId===input.captureId&&!item.referenceOnly).sort((a,b)=>a.startMs-b.startMs);
}
function run(input:VoicePhraseRevisionInput,services:AuthoringServices):Promise<VoicePhraseRevisionOutcome>{return (async()=>{
 if(!Number.isInteger(input.from)||!Number.isInteger(input.to)||input.from<0||input.to<=input.from||input.to>input.baseText.length)throw Error('Select the exact phrase to record again.');
 const id=`${input.captureSessionId}/${input.captureId}/${input.sectionId}/${input.from}-${input.to}`;
 let words='';
 const initial=await drafts.get(input.draftId) as VoicePhraseDraft|undefined;
 if(!initial?.sections.some(section=>section.id===input.sectionId)||!initial.results.some(result=>result.sectionId===input.sectionId))throw Error('Choose a saved candidate phrase before recording.');
 const previous=initial.phrasePatches?.find(patch=>patch.id===id);
 if(previous?.state==='review'||previous?.state==='held')return{state:previous.state,session:initial,reason:previous.reason};
 const persist=async(state:VoicePhrasePatch['state'],reason?:string,replacement?:SectionAssimilationResult['sections'][number],transcripts:Awaited<ReturnType<typeof transcribe>>=[])=>{
  let finalState=state,finalReason=reason;
  const session=await change(input.draftId,current=>{
   const result=current.results.find(item=>item.sectionId===input.sectionId);
   if(state==='review'&&(!result||result.text!==input.baseText)){
    finalState='held';finalReason='This candidate changed while the phrase was processing. Review the saved replacement before applying it.';
   }
   const patch:VoicePhrasePatch={...input,id,original:input.baseText.slice(input.from,input.to),rawReplacement:words,replacement:replacement?.text,createdAt:previous?.createdAt??new Date().toISOString(),state:finalState,reason:finalReason};
   const prior=current.phrasePatches?.find(item=>item.id===id);
   const rawTranscript=prior?.rawReplacement.trim()?current.rawTranscript:[current.rawTranscript,words].filter(Boolean).join('\n');
   const take:SectionTake&{captureSessionId:string;phrasePatchId:string}={id:input.captureId,captureId:input.captureId,captureSessionId:input.captureSessionId,phrasePatchId:id,startSectionId:input.sectionId,markers:[{atMs:0,sectionId:input.sectionId}],createdAt:patch.createdAt,state:finalState==='failed'?'failed':'review',intent:'revise',resultSectionIds:finalState==='review'?[input.sectionId]:[],error:finalReason};
   const results=current.results.map(item=>{
    if(item.sectionId!==input.sectionId||finalState!=='review'||!replacement)return item;
    const previousReview=item.reviewTranscript??current.rawTranscript,offset=previousReview.length+(previousReview?1:0),reviewTranscript=[previousReview,words].filter(Boolean).join('\n');
    const issues=[...(item.reviewIssues??[]),...(replacement.reviewIssues??[]).map(issue=>({...issue,start:issue.start+offset,end:issue.end+offset})),...transcriptionReviewIssues(words,transcripts,replacement.evidenceQuotes).map(issue=>({...issue,start:issue.start+offset,end:issue.end+offset}))];
    return {...item,text:item.text.slice(0,input.from)+replacement.text+item.text.slice(input.to),comparison:patchComparison(item,input.from,input.to,replacement.text),reviewTranscript,reviewIssues:issues,evidenceQuotes:[...new Set([...item.evidenceQuotes,...replacement.evidenceQuotes])],changes:[...item.changes,...replacement.changes,{before:input.baseText.slice(input.from,input.to),after:replacement.text,reason:'Re-recorded the selected phrase; neighboring candidate words were preserved.'}],warnings:[...new Set([...item.warnings,...replacement.warnings])],takeIds:[...new Set([...(item.takeIds??[]),input.captureId])],checked:false,applied:false};
   });
   return {...current,pendingPhraseRevisions:(current.pendingPhraseRevisions??[]).filter(item=>JSON.stringify(item)!==JSON.stringify(input)),state:current.state==='recording'?'recording':'review',rawTranscript,results,takes:[...(current.takes??[]).filter(item=>item.captureId!==input.captureId),take],phrasePatches:[...(current.phrasePatches??[]).filter(item=>item.id!==id),patch],unassigned:[...current.unassigned.filter(item=>item.takeId!==input.captureId),...(finalState==='review'?[]:[{text:words||patch.original,reason:finalReason??'Review this phrase recording.',takeId:input.captureId}])]};
  });
  return {state:finalState,session,reason:finalReason};
 };
 try{
  const transcript=await transcribe(input,services);words=transcript.map(item=>item.raw).join('\n');
  if(!words.trim())throw Error('No speech was found in this phrase recording. The audio is saved.');
  const latest=await drafts.get(input.draftId);
  if(latest?.results.find(item=>item.sectionId===input.sectionId)?.text!==input.baseText)return persist('held','This candidate changed before the phrase could be reviewed. The replacement recording is saved.',undefined,transcript);
  const section=initial.sections.find(item=>item.id===input.sectionId)!;
  const prepared=await assimilateSections({words,intent:'replace',sections:[{id:section.id,title:section.title,path:section.path,text:input.baseText.slice(input.from,input.to)}],startSectionId:section.id,markers:[{atMs:0,sectionId:section.id}],segments:transcript.map(item=>({text:item.raw,startMs:item.startMs,endMs:item.endMs}))});
  const replacement=prepared.sections[0];
  if(prepared.unassigned.length||prepared.sections.length!==1||replacement?.sectionId!==input.sectionId||replacement.reviewIssues?.some(issue=>issue.kind==='ambiguity'))return persist('held',prepared.unassigned.map(item=>item.reason).join(' ')||'The phrase replacement needs clarification.',replacement,transcript);
  if(!mechanical(words,replacement))return persist('held','The proposed phrase includes wording that is not supported by mechanical cleanup of this recording.',replacement,transcript);
  return persist('review',undefined,replacement,transcript);
 }catch(error){return persist('failed',error instanceof Error?error.message:'The phrase could not be processed. Its audio remains saved.');}
})();}
/** Immutable audio and raw transcripts survive every outcome. This edits only an
 * unchecked draft candidate and never integrates a working card. */
export function processVoicePhraseRevision(input:VoicePhraseRevisionInput,services:AuthoringServices):Promise<VoicePhraseRevisionOutcome>{
 const key=JSON.stringify(input);const active=running.get(key);if(active)return active;
 const job=run(input,services).finally(()=>running.delete(key));running.set(key,job);return job;
}

function launchPhrase(input:VoicePhraseRevisionInput,services:AuthoringServices):void {
 void processVoicePhraseRevision(input,services).catch(async error=>{
  await change(input.draftId,current=>({...current,pendingPhraseRevisions:(current.pendingPhraseRevisions??[]).filter(item=>JSON.stringify(item)!==JSON.stringify(input)),takes:(current.takes??[]).map(take=>take.captureId===input.captureId?{...take,state:'failed' as const,error:error instanceof Error?error.message:'The saved phrase could not be reopened.'}:take)})).catch(()=>undefined);
 });
}
/** Persist the exact selection and audio reference before returning. AI processing
 * runs independently; a page restart can resume from pendingPhraseRevisions. */
export async function enqueueVoicePhraseRevision(input:VoicePhraseRevisionInput,services:AuthoringServices):Promise<VoicePhraseDraft> {
 if(!Number.isInteger(input.from)||!Number.isInteger(input.to)||input.from<0||input.to<=input.from||input.to>input.baseText.length)throw Error('Select the exact phrase to record again.');
 const saved=await audio.load(input.captureSessionId),capture=saved?.session.captures.find(item=>item.id===input.captureId);
 if(!capture||!['ready','interrupted'].includes(capture.status))throw Error('Finish the phrase recording before sending it.');
 const registered=await change(input.draftId,current=>{
  if(!current.sections.some(section=>section.id===input.sectionId)||!current.results.some(result=>result.sectionId===input.sectionId))throw Error('The selected candidate could not be found.');
  const completed=current.phrasePatches?.find(patch=>patch.captureSessionId===input.captureSessionId&&patch.captureId===input.captureId&&patch.sectionId===input.sectionId&&patch.from===input.from&&patch.to===input.to);
  if(completed?.state==='review'||completed?.state==='held')return current;
  const pending=current.pendingPhraseRevisions??[];
  if(pending.some(item=>JSON.stringify(item)===JSON.stringify(input)))return current;
  const existing=current.takes?.find(take=>take.captureId===input.captureId);
  const take:SectionTake&{captureSessionId:string}={...existing,id:input.captureId,captureId:input.captureId,captureSessionId:input.captureSessionId,startSectionId:input.sectionId,markers:[{atMs:0,sectionId:input.sectionId}],state:'queued',intent:'revise',createdAt:existing?.createdAt??new Date().toISOString()};
  return {...current,pendingPhraseRevisions:[...pending,structuredClone(input)],takes:[...(current.takes??[]).filter(item=>item.captureId!==input.captureId),take]};
 });
 if(registered.pendingPhraseRevisions?.some(item=>JSON.stringify(item)===JSON.stringify(input)))launchPhrase(input,services);
 return registered;
}
/** Resume durable phrase work once on startup/connection recovery. No model polling. */
export async function resumeVoicePhraseRevisions(services:AuthoringServices):Promise<void> {
 for(const draft of await drafts.list() as VoicePhraseDraft[])for(const input of draft.pendingPhraseRevisions??[])launchPhrase(input,services);
}
