import {AuthoringStore} from '../../../lib/oracle/authoring/storage';
import {addTranscript} from '../../../lib/oracle/authoring/workflow';
import {recoverCapture} from '../../../lib/oracle/authoring/recorder';
import type {AuthoringServices} from '../../../lib/oracle/authoring/types';
import {SectionDraftStore,type SectionDraftSession} from '../../../lib/oracle/authoring/sectionDrafts';
import {assimilateSections} from './sectionAssimilation';
const drafts=new SectionDraftStore(),audio=new AuthoringStore();
const running=new Map<string,Promise<void>>();
/** Read the newest version before each field-level update. Never overwrite another editor. */
export async function changeSectionSession(id:string,change:(value:SectionDraftSession)=>SectionDraftSession){
 for(let attempt=0;attempt<4;attempt++){const value=await drafts.get(id);if(!value)throw Error('Your section recording could not be found.');try{return await drafts.save(change(value),value.version);}catch(error){if(attempt===3||!/Another tab/.test(String(error)))throw error;}}
 throw Error('The section recording changed. Reopen it.');
}
/** A recording is transport. Only AI review or explicit markers establish editorial sections. */
export function processSectionSession(id:string,services:AuthoringServices):Promise<void>{
 const existing=running.get(id);if(existing)return existing;
 const task=(async()=>{try{
  const before=await drafts.get(id);if(before?.results.some(r=>r.applied))throw Error('Start a new recording session to revise integrated sections. Your integrated words are saved.');
  const draft=await changeSectionSession(id,s=>({...s,state:'transcribing',error:undefined}));
  if(!draft.captureSessionId||!services.transcribe)throw Error('Record or import audio before preparing the sections.');
  let saved=await audio.load(draft.captureSessionId);if(!saved)throw Error('The original audio session is unavailable.');
  for(const capture of saved.session.captures){
   if(capture.status==='empty')continue;
   if(capture.status==='recording'){saved=await recoverCapture(audio,saved,capture.id);if(saved.session.captures.find(c=>c.id===capture.id)?.status==='empty')continue;}
   if(saved.session.transcript.some(t=>t.captureId===capture.id))continue;
   const current=saved.session.captures.find(c=>c.id===capture.id)!;
   const response=await services.transcribe(saved.session,current,await audio.audio(saved.session.id,current.id));
   const latest=await audio.load(saved.session.id);if(!latest)throw Error('The saved audio session is unavailable.');
   if(latest.session.transcript.some(t=>t.captureId===capture.id)){saved=latest;continue;}
   const adjusted={...latest.session,captures:latest.session.captures.map(c=>c.id===capture.id?{...c,durationMs:Math.max(c.durationMs,response.durationMs??0),...(response.arCreate?{arCreate:response.arCreate}:{})}:c)};
   const next=addTranscript(adjusted,capture.id,response.segments,response.provider);
   saved={session:next,version:await audio.save(next,latest.version)};
  }
  const captures=saved.session.captures;let elapsed=0;const offsets=new Map<string,number>();for(const capture of captures){offsets.set(capture.id,elapsed);elapsed+=capture.durationMs;}
  const transcript=saved.session.transcript.filter(t=>!t.referenceOnly).sort((a,b)=>(offsets.get(a.captureId)??0)+a.startMs-((offsets.get(b.captureId)??0)+b.startMs));
  const words=transcript.map(t=>t.raw).join('\n');if(!words.trim())throw Error('No speech was found. Your original audio is saved; try another take.');
  const latest=await changeSectionSession(id,s=>({...s,state:'assimilating',rawTranscript:words,error:undefined}));
  const references=await currentSectionTexts(latest);
  const result=await assimilateSections({words,sections:latest.sections.map(({id,title,path,text})=>({id,title,path,text:references[id]??text})),startSectionId:latest.startSectionId,markers:latest.markers,segments:transcript.map(t=>({text:t.raw,startMs:(offsets.get(t.captureId)??0)+t.startMs,endMs:(offsets.get(t.captureId)??0)+t.endMs}))});
  await changeSectionSession(id,s=>({...s,state:'review',results:result.sections.map(r=>{const uncertain=transcript.filter(t=>r.evidenceQuotes.some(q=>q.includes(t.raw)||t.raw.includes(q))).flatMap(t=>(t.words??[]).filter(w=>w.probability!==undefined&&w.probability<.6).map(w=>w.text));return {...r,checked:false,warnings:[...new Set([...r.warnings,...(uncertain.length?[`Check possible mishearings against your audio: ${[...new Set(uncertain)].join(', ')}`]:[])])]};}),unassigned:result.unassigned,error:undefined}));
 }catch(error){await changeSectionSession(id,s=>({...s,state:s.results.length?'review':'ready',error:error instanceof Error?error.message:'Section processing stopped. Your audio is saved.'}));throw error;}})().finally(()=>running.delete(id));
 running.set(id,task);return task;
}
export async function resumeSectionWorkflows(services:AuthoringServices){for(const session of await drafts.list())if(['transcribing','assimilating'].includes(session.state))void processSectionSession(session.id,services).catch(()=>undefined);}

/** Private replacements provide current comparison context without changing source anchors. */
export async function currentSectionTexts(session:SectionDraftSession):Promise<Record<string,string>>{
 const values=(await drafts.list(session.cardNumber)).filter(s=>s.sourceHash===session.sourceHash).flatMap(s=>s.results.filter(r=>r.appliedText&&r.appliedAt).map(r=>({id:r.sectionId,text:r.appliedText!,at:r.appliedAt!}))).sort((a,b)=>a.at.localeCompare(b.at));return Object.fromEntries(values.map(v=>[v.id,v.text]));
}
