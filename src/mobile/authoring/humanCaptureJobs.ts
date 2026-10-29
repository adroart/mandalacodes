import type { AuthoringServices, AuthoringSession, Transcript } from '../../../lib/oracle/authoring/types';
import { AuthoringStore } from '../../../lib/oracle/authoring/storage';
import { addTranscript, correctTranscript, sessionSources, transcriptCard } from '../../../lib/oracle/authoring/workflow';
import { organizeCapture, spokenProse } from '../../../lib/oracle/authoring/organization';
import { WorkingCardStore, reconcileHumanPassages, type HumanIssue, type HumanMode } from '../../../lib/oracle/authoring/humanDrafts';
import {interpretPassageSpeech} from '../../../lib/oracle/authoring/passageContext';
import {findBookPassages} from './bookPassages';
import {splitSpokenThoughts} from '../../../lib/oracle/authoring/passageContext';
import { passagesFromText, type PassageAnchor } from '../../../lib/oracle/authoring/passageContext';
import { decideSpokenPassage, passageSpeechNeedsCheck } from './spokenPassageContext';
import { applyPassageReplacement, applyPassageAddition, savePassageConnection, plainSection } from './passageActions';
export interface HumanJob {id:string;continuationId?:string;sessionId:string;captureId:string;state:'queued'|'transcribing'|'organizing'|'applying'|'ready'|'attention'|'failed';message:string;issues:HumanIssue[];organized?:boolean;reviewed?:Record<string,string>;mode?:HumanMode;resolveIds?:string[];destinations?:{cardNumber:number;sectionId:string}[];anchors?:PassageAnchor[];passageMatches?:PassageAnchor[];selectedPassageIds?:string[];appliedPassageIds?:string[];updatedAt:string}
const KEY='oracle.human.jobs.v1',listeners=new Set<()=>void>(),running=new Set<string>();let tail=Promise.resolve();
const store=new AuthoringStore(),cards=new WorkingCardStore();
export function humanJobs():HumanJob[]{try{const value=JSON.parse(localStorage.getItem(KEY)??'[]');return Array.isArray(value)?value.filter(j=>j&&typeof j.id==='string'&&typeof j.sessionId==='string'&&typeof j.captureId==='string'):[];}catch{return[];}}
export function subscribeHumanJobs(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
function put(job:HumanJob){const list=humanJobs().filter(j=>j.id!==job.id);localStorage.setItem(KEY,JSON.stringify([...list,{...job,updatedAt:new Date().toISOString()}]));listeners.forEach(fn=>fn());}
async function updateSession(id:string,change:(s:AuthoringSession)=>AuthoringSession|Promise<AuthoringSession>){for(let attempt=0;attempt<4;attempt++){const saved=await store.load(id);if(!saved)throw new Error('The recording session could not be found.');const next=await change(saved.session);try{await store.save(next,saved.version);return next;}catch(e){if(attempt===3||!/another tab/i.test(String(e)))throw e;}}throw new Error('The recording changed while saving. Try again.');}
export async function editJobPassage(sessionId:string,id:string,text:string,cardNumber?:number,sectionId?:string,loadSource?:AuthoringServices['loadSource']){return updateSession(sessionId,async s=>{let next=s;if(cardNumber&&!sessionSources(s).some(src=>src.cardNumber===cardNumber)){if(!loadSource)throw new Error('Choose a recorded card destination.');next={...s,relatedSources:[...(s.relatedSources??[]),await loadSource(cardNumber)]};}return correctTranscript(next,id,{corrected:text,...(cardNumber?{cardNumber}:{}),...(sectionId!==undefined?{sectionId:sectionId||null}: {})});});}
export function queueHumanCapture(sessionId:string,captureId:string,services:AuthoringServices,options:{continuationId?:string;mode?:HumanMode;reviewed?:Record<string,string>;resolveIds?:string[];anchors?:PassageAnchor[];selectedPassageIds?:string[]}={}){
 const id=`${sessionId}/${captureId}`;if(running.has(id))return;
 const previous=humanJobs().find(j=>j.id===id);const job:HumanJob={id,continuationId:options.continuationId??previous?.continuationId,sessionId,captureId,state:'queued',message:'Recording saved. Processing your words…',issues:[],organized:previous?.organized,reviewed:options.reviewed??previous?.reviewed,mode:options.mode??'auto',resolveIds:options.resolveIds,anchors:options.anchors??previous?.anchors,selectedPassageIds:options.selectedPassageIds??previous?.selectedPassageIds,appliedPassageIds:previous?.appliedPassageIds,destinations:previous?.destinations,updatedAt:new Date().toISOString()};
 put(job);running.add(id);tail=tail.catch(()=>undefined).then(async()=>{try{
  let saved=await store.load(sessionId);if(!saved)throw new Error('The recording session is unavailable.');const capture=saved.session.captures.find(c=>c.id===captureId);if(!capture||capture.status==='recording'||capture.status==='empty')throw new Error('Finish a recording with received audio before processing.');
  if(!saved.session.transcript.some(t=>t.captureId===captureId)){
   if(!services.transcribe)throw new Error('Transcription is not connected. Your audio remains saved.');put({...job,state:'transcribing',message:'Transcribing. You can continue reading or recording.'});
   const response=await services.transcribe(saved.session,capture,await store.audio(sessionId,captureId));
   await updateSession(sessionId,s=>{if(s.transcript.some(t=>t.captureId===captureId))return s;const adjusted={...s,captures:s.captures.map(c=>c.id===captureId?{...c,durationMs:Math.max(c.durationMs,response.durationMs??0),...(response.arCreate?{arCreate:response.arCreate}:{})}:c)};return addTranscript(adjusted,captureId,response.segments,response.provider);});
  }
  if(!job.organized){put({...job,state:'organizing',message:'Placing your words in the cards.'});await updateSession(sessionId,async s=>{let next=await organizeCapture(s,captureId,services.loadSource);for(const t of next.transcript.filter(t=>t.captureId===captureId&&!t.referenceOnly)){const thoughts=splitSpokenThoughts(t.corrected);if(thoughts.length<2)continue;next={...next,transcript:next.transcript.map(item=>item.id===t.id?{...item,referenceOnly:true}:item)};for(const [index,text] of thoughts.entries())next=addTranscript(next,captureId,[{text,startMs:t.startMs,endMs:t.endMs,timing:'recording',sectionId:t.sectionId,cardNumber:t.cardNumber,parentId:t.parentId??t.id,order:(t.order??s.transcript.indexOf(t))+index/thoughts.length}],t.provider);}return next;});job.organized=true;}
  saved=await store.load(sessionId);const s=saved!.session;const passages=s.transcript.filter(t=>t.captureId===captureId&&!t.referenceOnly).sort((a,b)=>(a.order??s.transcript.indexOf(a))-(b.order??s.transcript.indexOf(b)));
  const issues:HumanIssue[]=[];const destinations:{cardNumber:number;sectionId:string}[]=[...(job.destinations??[])];const unresolved=passages.filter(t=>!t.sectionId&&!job.appliedPassageIds?.includes(t.id));if(unresolved.length)issues.push({code:'assignment',message:'Which section do these words belong to?',transcriptIds:unresolved.map(t=>t.id)});
  put({...job,state:'applying',message:'Saving your words to the working cards.'});
  // Build candidates from the exact working reading where one exists, otherwise
  // the bundled source. Captured anchors remain immutable context for this audio.
  const candidates:PassageAnchor[]=[];
  for(const source of sessionSources(s))for(const section of source.sections){
   const working=await cards.get(source.cardNumber,section.id);
   candidates.push(...passagesFromText(source.cardNumber,section.id,working?.text??plainSection(source,section.id),working?.revision,source.hash));
  }
  let focus=job.anchors??[];
  if(job.continuationId){const earlier=humanJobs().filter(j=>j.id!==job.id&&j.continuationId===job.continuationId&&j.state==='ready').sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt)).at(-1);if(earlier?.anchors){for(let index=0;index<focus.length;index++){const old=focus[index],rebased=earlier.anchors.find(a=>a.cardNumber===old.cardNumber&&a.sectionId===old.sectionId&&a.text.includes(old.text));if(rebased&&(await cards.get(old.cardNumber,old.sectionId))?.revision===rebased.revision)focus[index]=rebased;}}job.anchors=focus;}

  focus=focus.filter((a,index)=>!focus.some((b,other)=>other!==index&&a.cardNumber===b.cardNumber&&a.sectionId===b.sectionId&&a.revision===b.revision&&b.start<=a.start&&b.end>=a.end&&(b.end-b.start>a.end-a.start||other<index)));
  let all=[...focus,...candidates.filter(a=>!focus.some(f=>f.id===a.id))];
  const contextualIds=new Set<string>();
  for(const transcript of passages){
   if(job.appliedPassageIds?.includes(transcript.id)){contextualIds.add(transcript.id);continue;}
   const targetFocus=/\b(?:connect|these two|both of these|together)\b/i.test(transcript.corrected)?focus:focus.filter(a=>a.cardNumber===transcriptCard(s,transcript)&&a.sectionId===transcript.sectionId);
   let decision=decideSpokenPassage(transcript.corrected,all,targetFocus,job.selectedPassageIds);
   if(decision.contextual&&!decision.targets.length&&!decision.needsReview){const reference=interpretPassageSpeech(transcript.corrected).reference;if(reference.trim().split(/\s+/).length>=3){const found=await findBookPassages(reference,s.source.cardNumber,services.loadSource);all=[...all,...found.map(hit=>hit.anchor).filter(a=>!all.some(b=>b.id===a.id))];job.anchors=[...(job.anchors??[]),...found.map(hit=>hit.anchor).filter(a=>!job.anchors?.some(b=>b.id===a.id))];decision=decideSpokenPassage(transcript.corrected,all,targetFocus,job.selectedPassageIds);}}
   if(!decision.contextual)continue;
   contextualIds.add(transcript.id);
   job.passageMatches=decision.candidates;
   const issue=(message:string)=>issues.push({code:'revision',message,transcriptIds:[transcript.id]});
   if(decision.needsReview){issue(decision.needsReview);continue;}
   if(!decision.targets.length){issue(decision.message??'Choose the passage these words refer to.');continue;}
   const reviewed=job.reviewed?.[transcript.id]===transcript.corrected;
   if(passageSpeechNeedsCheck(transcript.corrected,reviewed,(transcript.words??[]).flatMap(w=>w.probability===undefined?[]:[w.probability]))){issues.push({code:'uncertain',message:'Check the uncertain words before changing this passage.',transcriptIds:[transcript.id]});continue;}
   if(decision.kind==='connect'){
    if(decision.targets.length<2){issue('Select at least two passages to connect.');continue;}
    await savePassageConnection(decision.targets,decision.words||transcript.corrected);
   }else{
    if(!decision.words.trim()){issue('The passage is connected. Speak or type the words you want to use.');continue;}
    if(decision.targets.length!==1){issue('Choose one passage for these words, or use Re-record for a combined passage.');continue;}
    const evidence={sessionId,captureId,transcriptId:transcript.id};
    if(decision.kind==='replace'){
     if(!reviewed){issue('Check your words, then replace only the linked passage.');continue;}
     await applyPassageReplacement(decision.targets,decision.words,services,evidence);
    }else if(decision.kind==='append'||decision.words.trim()!==transcript.corrected.trim()){
     await applyPassageAddition(decision.targets[0],decision.words,services,evidence);
    }else{issue('The passage is connected. Use Re-record to replace it, or begin with “Add this after that passage:” for an addition.');continue;}
   }
   if(decision.kind!=='connect'){
    // Rebase only changes made by this job, so the next spoken thought follows
    // the previous one rather than inserting in reverse order at an old offset.
    const target=decision.targets[0],latest=await cards.get(target.cardNumber,target.sectionId);
    if(latest){
     const text=decision.kind==='replace'?decision.words:`${target.text}\n\n${decision.words}`;
     const start=latest.text.indexOf(text);
     if(start>=0&&latest.text.indexOf(text,start+1)<0){
      const next={...target,id:`${target.cardNumber}/${target.sectionId}/${start}-${start+text.length}`,text,start,end:start+text.length,sectionText:latest.text,revision:latest.revision};
      const affected=(a:PassageAnchor)=>a.cardNumber===target.cardNumber&&a.sectionId===target.sectionId;
      focus=[...focus.filter(a=>!affected(a)),next];job.anchors=focus;
      all=[...all.filter(a=>!affected(a)),...passagesFromText(target.cardNumber,target.sectionId,latest.text,latest.revision,latest.sourceHash)];
      // The duplicate last entry is the full connected span, not a separate
      // destination. Keep it only when a paragraph candidate does not cover it.
      all=all.filter((a,index,list)=>list.findIndex(b=>b.id===a.id&&b.text===a.text)===index);
      job.selectedPassageIds=undefined;
     }
    }
   }
   job.appliedPassageIds=[...(job.appliedPassageIds??[]),transcript.id];
   for(const target of decision.targets)destinations.push({cardNumber:target.cardNumber,sectionId:target.sectionId});
   put({...job,state:'applying',issues,destinations});
  }
  const ordinary=passages.filter(t=>!contextualIds.has(t.id));
  const keys=[...new Set(ordinary.filter(t=>t.sectionId).map(t=>`${transcriptCard(s,t)}:${t.sectionId}`))];
  for(const key of keys){const [cardValue,sectionId]=key.split(':'),cardNumber=Number(cardValue);const source=sessionSources(s).find(src=>src.cardNumber===cardNumber)!;
   const originals=ordinary.filter(t=>transcriptCard(s,t)===cardNumber&&t.sectionId===sectionId);const evidence=originals.map(t=>({...t,corrected:spokenProse(t.corrected)}));
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
export function resumeHumanJobs(services:AuthoringServices){for(const job of humanJobs().filter(j=>['queued','transcribing','organizing','applying'].includes(j.state)))queueHumanCapture(job.sessionId,job.captureId,services,{continuationId:job.continuationId,mode:job.mode,reviewed:job.reviewed,resolveIds:job.resolveIds,anchors:job.anchors,selectedPassageIds:job.selectedPassageIds});}

/** Apply only the visible, checked transcript to its explicitly previewed reading. */
export async function applyComparedPassage(job:HumanJob,transcript:Transcript,anchors:PassageAnchor[],operation:'replace'|'append',services:AuthoringServices){
 if(running.has(job.id))throw new Error('This recording is still processing. Wait for its check.');
 const latest=await store.load(job.sessionId),current=latest?.session.transcript.find(t=>t.id===transcript.id);
 if(!current||current.corrected!==transcript.corrected)throw new Error('Your words changed. Compare the saved transcript again.');
 if(!anchors.length||!current.corrected.trim())throw new Error('Choose the original passage and check your words first.');
 const evidence={sessionId:job.sessionId,captureId:current.captureId,transcriptId:current.id};
 if(operation==='replace')await applyPassageReplacement(anchors,current.corrected,services,evidence);
 else {if(anchors.length!==1)throw new Error('Choose one passage for this addition.');await applyPassageAddition(anchors[0],current.corrected,services,evidence);}
 const fresh=humanJobs().find(j=>j.id===job.id)??job;
 put({...fresh,destinations:[...(fresh.destinations??[]),{cardNumber:anchors[0].cardNumber,sectionId:anchors[0].sectionId}],appliedPassageIds:[...new Set([...(fresh.appliedPassageIds??[]),current.id])],reviewed:{...fresh.reviewed,[current.id]:current.corrected}});
 queueHumanCapture(job.sessionId,job.captureId,services,{reviewed:{...fresh.reviewed,[current.id]:current.corrected}});
}
