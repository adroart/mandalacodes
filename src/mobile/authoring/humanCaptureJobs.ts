import type { AuthoringServices, AuthoringSession, Transcript } from '../../../lib/oracle/authoring/types';
import { AuthoringStore } from '../../../lib/oracle/authoring/storage';
import { addTranscript, correctTranscript, sessionSources, transcriptCard } from '../../../lib/oracle/authoring/workflow';
import { organizeCapture, spokenProse } from '../../../lib/oracle/authoring/organization';
import { WorkingCardStore, reconcileHumanPassages, type HumanIssue, type HumanMode } from '../../../lib/oracle/authoring/humanDrafts';
export interface HumanJob {id:string;sessionId:string;captureId:string;state:'queued'|'transcribing'|'organizing'|'applying'|'ready'|'attention'|'failed';message:string;issues:HumanIssue[];organized?:boolean;reviewed?:Record<string,string>;mode?:HumanMode;resolveIds?:string[];destinations?:{cardNumber:number;sectionId:string}[];updatedAt:string}
const KEY='oracle.human.jobs.v1',listeners=new Set<()=>void>(),running=new Set<string>();let tail=Promise.resolve();
const store=new AuthoringStore(),cards=new WorkingCardStore();
export function humanJobs():HumanJob[]{try{const value=JSON.parse(localStorage.getItem(KEY)??'[]');return Array.isArray(value)?value.filter(j=>j&&typeof j.id==='string'&&typeof j.sessionId==='string'&&typeof j.captureId==='string'):[];}catch{return[];}}
export function subscribeHumanJobs(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
function put(job:HumanJob){const list=humanJobs().filter(j=>j.id!==job.id);localStorage.setItem(KEY,JSON.stringify([...list,{...job,updatedAt:new Date().toISOString()}]));listeners.forEach(fn=>fn());}
async function updateSession(id:string,change:(s:AuthoringSession)=>AuthoringSession|Promise<AuthoringSession>){for(let attempt=0;attempt<4;attempt++){const saved=await store.load(id);if(!saved)throw new Error('The recording session could not be found.');const next=await change(saved.session);try{await store.save(next,saved.version);return next;}catch(e){if(attempt===3||!/another tab/i.test(String(e)))throw e;}}throw new Error('The recording changed while saving. Try again.');}
export async function editJobPassage(sessionId:string,id:string,text:string,cardNumber?:number,sectionId?:string,loadSource?:AuthoringServices['loadSource']){return updateSession(sessionId,async s=>{let next=s;if(cardNumber&&!sessionSources(s).some(src=>src.cardNumber===cardNumber)){if(!loadSource)throw new Error('Choose a recorded card destination.');next={...s,relatedSources:[...(s.relatedSources??[]),await loadSource(cardNumber)]};}return correctTranscript(next,id,{corrected:text,...(cardNumber?{cardNumber}:{}),...(sectionId!==undefined?{sectionId:sectionId||null}: {})});});}
export function queueHumanCapture(sessionId:string,captureId:string,services:AuthoringServices,options:{mode?:HumanMode;reviewed?:Record<string,string>;resolveIds?:string[]}={}){
 const id=`${sessionId}/${captureId}`;if(running.has(id))return;
 const previous=humanJobs().find(j=>j.id===id);const job:HumanJob={id,sessionId,captureId,state:'queued',message:'Recording saved. Processing your words…',issues:[],organized:previous?.organized,reviewed:options.reviewed??previous?.reviewed,mode:options.mode??'auto',resolveIds:options.resolveIds,updatedAt:new Date().toISOString()};
 put(job);running.add(id);tail=tail.catch(()=>undefined).then(async()=>{try{
  let saved=await store.load(sessionId);if(!saved)throw new Error('The recording session is unavailable.');const capture=saved.session.captures.find(c=>c.id===captureId);if(!capture||capture.status==='recording'||capture.status==='empty')throw new Error('Finish a recording with received audio before processing.');
  if(!saved.session.transcript.some(t=>t.captureId===captureId)){
   if(!services.transcribe)throw new Error('Transcription is not connected. Your audio remains saved.');put({...job,state:'transcribing',message:'Transcribing. You can continue reading or recording.'});
   const response=await services.transcribe(saved.session,capture,await store.audio(sessionId,captureId));
   await updateSession(sessionId,s=>{if(s.transcript.some(t=>t.captureId===captureId))return s;const adjusted={...s,captures:s.captures.map(c=>c.id===captureId?{...c,durationMs:Math.max(c.durationMs,response.durationMs??0),...(response.arCreate?{arCreate:response.arCreate}:{})}:c)};return addTranscript(adjusted,captureId,response.segments,response.provider);});
  }
  if(!job.organized){put({...job,state:'organizing',message:'Placing your words in the cards.'});await updateSession(sessionId,s=>organizeCapture(s,captureId,services.loadSource));job.organized=true;}
  saved=await store.load(sessionId);const s=saved!.session;const passages=s.transcript.filter(t=>t.captureId===captureId&&!t.referenceOnly).sort((a,b)=>(a.order??s.transcript.indexOf(a))-(b.order??s.transcript.indexOf(b)));
  const issues:HumanIssue[]=[];const destinations:{cardNumber:number;sectionId:string}[]=[];const unresolved=passages.filter(t=>!t.sectionId);if(unresolved.length)issues.push({code:'assignment',message:'Which section do these words belong to?',transcriptIds:unresolved.map(t=>t.id)});
  put({...job,state:'applying',message:'Saving your words to the working cards.'});
  const keys=[...new Set(passages.filter(t=>t.sectionId).map(t=>`${transcriptCard(s,t)}:${t.sectionId}`))];
  for(const key of keys){const [cardValue,sectionId]=key.split(':'),cardNumber=Number(cardValue);const source=sessionSources(s).find(src=>src.cardNumber===cardNumber)!;
   const originals=passages.filter(t=>transcriptCard(s,t)===cardNumber&&t.sectionId===sectionId);const evidence=originals.map(t=>({...t,corrected:spokenProse(t.corrected)}));
   const reviewedIds=originals.filter(t=>job.reviewed?.[t.id]===t.corrected).map(t=>t.id);
   const doubtful=originals.filter(t=>/\ba chain\b/i.test(t.corrected)&&!reviewedIds.includes(t.id));if(doubtful.length){issues.push({code:'uncertain',message:'Was “a chain” meant to be I Ching? Check this destination.',transcriptIds:doubtful.map(t=>t.id)});continue;}
   if(evidence.every(t=>!t.corrected.trim())){issues.push({code:'uncertain',message:'This passage contains routing words but no card writing yet.',transcriptIds:originals.map(t=>t.id)});continue;}
   for(let attempt=0;attempt<3;attempt++){
    const existing=await cards.get(cardNumber,sectionId);const result=reconcileHumanPassages(existing,source,evidence,sessionId,evidence.some(t=>job.resolveIds?.includes(t.id))?job.mode:'auto',reviewedIds);
    if(result.issues.length){issues.push(...result.issues);break;}
    if(result.alreadyApplied){destinations.push({cardNumber,sectionId});break;}
    try{await cards.save(result.draft,existing?.revision??0);destinations.push({cardNumber,sectionId});break;}catch(e){if(attempt===2||!/another tab/i.test(String(e)))throw e;}
   }
  }
  put({...job,state:issues.length?'attention':'ready',message:issues.length?(destinations.length?'A few words need your check. Other safe sections are saved.':'Check these words before they reach the card.'):'Your words are saved in the cards.',issues,destinations});
 }catch(e){put({...job,state:'failed',message:e instanceof Error?e.message:'Processing stopped. Your recording is still saved.',issues:[]});}finally{running.delete(id);}});
}
export function resumeHumanJobs(services:AuthoringServices){for(const job of humanJobs().filter(j=>['queued','transcribing','organizing','applying'].includes(j.state)))queueHumanCapture(job.sessionId,job.captureId,services,{mode:job.mode,reviewed:job.reviewed,resolveIds:job.resolveIds});}
