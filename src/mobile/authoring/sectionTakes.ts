import {AuthoringStore,type SavedSession} from '../../../lib/oracle/authoring/storage';
import {addTranscript} from '../../../lib/oracle/authoring/workflow';
import type {AuthoringServices,AuthoringSession} from '../../../lib/oracle/authoring/types';
import {SectionDraftStore,type SectionDraftResult,type SectionDraftSession} from '../../../lib/oracle/authoring/sectionDrafts';
import {assimilateSections} from './sectionAssimilation';
import {currentSectionTexts} from './sectionWorkflow';

export interface SectionTake {
 id:string;captureId:string;startSectionId:string;markers:{atMs:number;sectionId:string}[];
 state:'queued'|'transcribing'|'assimilating'|'review'|'discarded'|'failed';
 error?:string;resultSectionIds?:string[];createdAt:string;
 /** Review fingerprints at queue time prevent a late result overwriting newer work. */
 baseline?:Record<string,string>;
}
export interface TakeResult extends SectionDraftResult {takeIds?:string[]}
export interface TakeSession extends SectionDraftSession {
 takes?:SectionTake[];
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
 return {...session,takes:(session.takes??[]).map(take=>take.captureId===captureId?{...take,...values}:take)};
}
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
function launch(id:string,captureId:string,services:AuthoringServices){
 const jobKey=key(id,captureId);if(running.has(jobKey))return;
 const task=(async()=>{try{
  let session=await getTakeSession(id),take=session?.takes?.find(t=>t.captureId===captureId);
  if(!session||!take||take.state==='discarded'||take.state==='review')return;
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
    return addTranscript(adjusted,captureId,response.segments,response.provider);
   });
  }
  session=await getTakeSession(id);take=session?.takes?.find(t=>t.captureId===captureId);
  if(!session||!take||take.state==='discarded')return;
  const transcript=saved.session.transcript.filter(t=>t.captureId===captureId&&!t.referenceOnly).sort((a,b)=>a.startMs-b.startMs);
  const words=transcript.map(t=>t.raw).join('\n');if(!words.trim())throw Error('No speech was found in this take. Your audio is saved.');
  await change(id,current=>{
   const own=current.takes?.find(t=>t.captureId===captureId);if(!own||own.state==='discarded')return current;
   const discarded=new Set((current.takes??[]).filter(t=>t.state==='discarded').map(t=>t.captureId));
   return updateTake({...current,rawTranscript:rawSpeech(saved!.session,discarded)},captureId,{state:'assimilating',error:undefined});
  });
  const references=await currentSectionTexts(session);
  const prepared=await assimilateSections({words,sections:session.sections.map(({id,title,path,text})=>({id,title,path,text:references[id]??text})),startSectionId:take.startSectionId,markers:take.markers,segments:transcript.map(t=>({text:t.raw,startMs:t.startMs,endMs:t.endMs}))});
  const latestAudio=await audio.load(saved.session.id);if(!latestAudio)throw Error('The saved audio session could not be read.');
  await change(id,current=>{
   const own=current.takes?.find(t=>t.captureId===captureId);if(!own||own.state==='discarded')return current;
   for(const result of prepared.sections){
    if(fingerprint(current.results.find(r=>r.sectionId===result.sectionId))!==(own.baseline?.[result.sectionId]??''))throw Error('This section was edited or integrated after the take was sent. Keep those newer words and retry this take when ready.');
   }
   const resultIds=new Set(prepared.sections.map(result=>result.sectionId));
   const discarded=new Set((current.takes??[]).filter(t=>t.state==='discarded').map(t=>t.captureId));
   const results:TakeResult[]=[...current.results.filter(result=>!resultIds.has(result.sectionId)),...prepared.sections.map(result=>{
    const uncertain=transcript.filter(t=>result.evidenceQuotes.some(q=>q.includes(t.raw)||t.raw.includes(q))).flatMap(t=>(t.words??[]).filter(w=>w.probability!==undefined&&w.probability<.6).map(w=>w.text));
    return {...result,takeIds:[captureId],checked:false,warnings:[...new Set([...result.warnings,...(uncertain.length?[`Check possible mishearings against your audio: ${[...new Set(uncertain)].join(', ')}`]:[])])]};
   })];
   const order=new Map(current.sections.map((section,index)=>[section.id,index]));results.sort((a,b)=>(order.get(a.sectionId)??0)-(order.get(b.sectionId)??0));
   const next=updateTake({...current,results,unassigned:[...current.unassigned.filter(u=>u.takeId!==captureId),...prepared.unassigned.map(u=>({...u,takeId:captureId}))],rawTranscript:rawSpeech(latestAudio.session,discarded)},captureId,{state:'review',resultSectionIds:[...resultIds],error:undefined});
   return {...next,state:stateAfter(current,latestAudio.session.captures.some(c=>c.status==='recording'))==='recording'?'recording':'review'};
  });
 }catch(error){
  await change(id,session=>{
   const take=session.takes?.find(t=>t.captureId===captureId);if(!take||take.state==='discarded')return session;
   const next=updateTake(session,captureId,{state:'failed',error:error instanceof Error?error.message:'This take could not finish. Its audio is saved.'});
   return {...next,state:stateAfter(next)};
  }).catch(()=>undefined);
 }})().finally(()=>running.delete(jobKey));
 running.set(jobKey,task);
}
/** Persist the job before returning; transcription and AI continue independently. */
export async function queueSectionTake(sessionId:string,captureId:string,startSectionId:string,services:AuthoringServices,markers:{atMs:number;sectionId:string}[]=[]):Promise<TakeSession>{
 const registered=await change(sessionId,session=>{
  if(!session.sections.some(section=>section.id===startSectionId)||markers.some(m=>!Number.isFinite(m.atMs)||m.atMs<0||!session.sections.some(s=>s.id===m.sectionId)))throw Error('Choose an existing section before sending this take.');
  const existing=session.takes?.find(t=>t.captureId===captureId);
  if(existing&&['queued','transcribing','assimilating','review','discarded'].includes(existing.state))return session;
  const baseline=Object.fromEntries(session.results.map(result=>[result.sectionId,fingerprint(result)]));
  const take:SectionTake={id:captureId,captureId,startSectionId,markers:markers.length?structuredClone(markers):[{atMs:0,sectionId:startSectionId}],state:'queued',createdAt:existing?.createdAt??new Date().toISOString(),baseline};
  return {...session,takes:[...(session.takes??[]).filter(t=>t.captureId!==captureId),take]};
 });
 const take=registered.takes?.find(t=>t.captureId===captureId);if(take&&['queued','transcribing','assimilating'].includes(take.state))launch(sessionId,captureId,services);
 return registered;
}
export async function resumeSectionTakes(services:AuthoringServices){
 for(const session of await drafts.list() as TakeSession[])for(const take of session.takes??[])if(['queued','transcribing','assimilating'].includes(take.state))launch(session.id,take.captureId,services);
}
/** Discard is recoverable. Audio and source transcripts remain in their original store. */
export async function discardSectionTake(sessionId:string,captureId:string):Promise<TakeSession>{
 const original=await getTakeSession(sessionId);if(!original)throw Error('This recording session could not be found.');
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
