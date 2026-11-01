import {AuthoringStore,type SavedSession} from '../../../lib/oracle/authoring/storage';
import {focusedComparison} from '../../../lib/oracle/authoring/passageComparison';
import {addTranscript} from '../../../lib/oracle/authoring/workflow';
import type {AuthoringServices,AuthoringSession} from '../../../lib/oracle/authoring/types';
import {SectionDraftStore,type SectionDraftResult,type SectionDraftSession,createSectionDraftSession,transcriptionReviewIssues} from '../../../lib/oracle/authoring/sectionDrafts';
import {assimilateSections} from './sectionAssimilation';
import {cardSections} from '../../../lib/oracle/authoring/cardSections';
import {currentSectionTexts} from './sectionWorkflow';

export interface SectionTake {
 id:string;captureId:string;startSectionId:string;markers:{atMs:number;sectionId:string}[];
 state:'queued'|'transcribing'|'assimilating'|'review'|'discarded'|'failed';
 error?:string;resultSectionIds?:string[];createdAt:string;
 /** Review fingerprints at queue time prevent a late result overwriting newer work. */
 baseline?:Record<string,string>;continuationOf?:string;
 /** The exact passage of the start section this take was aimed at. Only that passage may change. */
 focus?:{start:number;end:number;text:string};preparedFingerprints?:Record<string,string>;comparisonOriginals?:Record<string,string>;intent?:'replace'|'add'|'revise';retryAttempts?:number;retryAt?:number;
}
export interface TakeResult extends SectionDraftResult {takeIds?:string[]}
export interface TakeSession extends SectionDraftSession {
 takes?:SectionTake[];linkedSessionIds?:string[];
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

function continuationChain(session:TakeSession,captureId:string):SectionTake[]{
 const chain:SectionTake[]=[],seen=new Set<string>();let next:string|undefined=captureId;
 while(next){if(seen.has(next))throw Error('This recording continuation contains a cycle. Keep its saved audio and reopen it.');seen.add(next);const take=session.takes?.find(t=>t.captureId===next);if(!take||take.state==='discarded')throw Error('An earlier part of this recording is unavailable or discarded. Restore it before continuing.');chain.unshift(take);next=take.continuationOf;}
 return chain;
}
function preservesIntegration(prior:TakeResult|undefined,result:TakeResult):TakeResult {
 return prior?.appliedText&&(prior.text!==result.text||prior.editIntent!==result.editIntent||JSON.stringify(prior.takeIds??[])!==JSON.stringify(result.takeIds??[]))?{...result,applied:false,appliedText:prior.appliedText,beforeText:prior.beforeText,appliedAt:prior.appliedAt,appliedRevision:prior.appliedRevision,integrationId:prior.integrationId,beforeWorking:prior.beforeWorking}:result;
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
  const words=transcript.map(t=>t.raw).join('\n');if(!words.trim())throw Error('No speech was found in this take. Your audio is saved.');
  await change(id,current=>{
   const own=current.takes?.find(t=>t.captureId===captureId);if(!own||own.state==='discarded')return current;
   const discarded=new Set((current.takes??[]).filter(t=>t.state==='discarded').map(t=>t.captureId));
   return updateTake({...current,rawTranscript:rawSpeech(saved!.session,discarded)},captureId,{state:'assimilating',error:undefined});
  });
  const latestReferences=await currentSectionTexts(session);
  const references=rootTake.comparisonOriginals??Object.fromEntries(session.sections.map(section=>[section.id,latestReferences[section.id]??section.text]));
  if(!rootTake.comparisonOriginals)await change(id,current=>updateTake(current,rootTake.captureId,{comparisonOriginals:references}));
  const relatedSources=await Promise.all(explicitDestinationCards(words,session.cardNumber).map(async cardNumber=>{const source=await services.loadSource(cardNumber);if(source.cardNumber!==cardNumber)throw Error('The related card source does not match its requested card.');const sections=cardSections(source);const references=await currentSectionTexts(createSectionDraftSession(source,sections));return {cardNumber,source,sections,references};}));
  if(relatedSources.length)await changeAudio(saved.session.id,current=>{
   const sources=[current.source,...(current.relatedSources??[])],additions=relatedSources.map(item=>item.source).filter(source=>{
    const existing=sources.filter(candidate=>candidate.cardNumber===source.cardNumber);
    if(existing.some(candidate=>candidate.hash!==source.hash))throw Error('The related card changed from its saved audio source. Reopen the card before continuing.');
    return !existing.length;
   });
   return additions.length?{...current,relatedSources:[...(current.relatedSources??[]),...additions]}:current;
  });
  const intent=take.intent??inferSpokenEditIntent(words,!!references[take.startSectionId]);
  const prepared=await assimilateSections({words,intent,relatedSources:relatedSources.map(({cardNumber,sections,references})=>({cardNumber,sections:sections.map(({id,title,path,text})=>({id,title,path,text:references[id]??text}))})),sections:session.sections.map(({id,title,path,text})=>({id,title,path,text:references[id]??text})),startSectionId:rootTake.startSectionId,markers:chain.flatMap(part=>part.markers.map(marker=>({...marker,atMs:marker.atMs+(offsets.get(part.captureId)??0)}))),segments:transcript.map(t=>({text:t.raw,startMs:t.startMs,endMs:t.endMs}))});
  const active=await getTakeSession(id);if(active?.takes?.find(t=>t.captureId===captureId)?.state==='discarded')return;
  const linkedSessionIds:string[]=[];
  for(const destination of relatedSources){
   const foreign=prepared.sections.filter(result=>destination.sections.some(section=>section.id===result.sectionId));if(!foreign.length)continue;
   // Stable IDs make a resumed job idempotent. Never overwrite an edited destination review.
   const linkedId=`${session.id}/${captureId}/card-${destination.cardNumber}`;
   const existing=await drafts.get(linkedId);
   if(!existing){
    const linked=createSectionDraftSession(destination.source,destination.sections,foreign[0].sectionId);
    await drafts.save({...linked,id:linkedId,captureSessionId:session.captureSessionId,captureId,takes:chain.map(part=>({...part,state:'review' as const,error:undefined,retryAt:undefined,retryAttempts:0,resultSectionIds:foreign.map(result=>result.sectionId)})),rawTranscript:words,state:'review',results:foreign.map(result=>({...result,takeIds:chainIds,editIntent:intent,comparisonOriginal:result.comparisonOriginal??destination.references[result.sectionId]??destination.sections.find(section=>section.id===result.sectionId)?.text,reviewTranscript:words,checked:false,reviewIssues:[...(result.reviewIssues??[]),...transcriptionReviewIssues(words,transcript,result.evidenceQuotes)]})),unassigned:[]} as TakeSession,0);
   }
   linkedSessionIds.push(linkedId);
  }
  const localSections=prepared.sections.filter(result=>session!.sections.some(section=>section.id===result.sectionId));
  const latestAudio=await audio.load(saved.session.id);if(!latestAudio)throw Error('The saved audio session could not be read.');
  await change(id,current=>{
   const own=current.takes?.find(t=>t.captureId===captureId);if(!own||own.state==='discarded')return current;
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
    const uncertain=transcript.filter(t=>result.evidenceQuotes.some(q=>q.includes(t.raw)||t.raw.includes(q))).flatMap(t=>(t.words??[]).filter(w=>w.probability!==undefined&&w.probability<.6).map(w=>w.text));
    const comparisonOriginal=references[result.sectionId]??session!.sections.find(section=>section.id===result.sectionId)?.text;
    // An aimed take gives every spoken word to its passage; the AI alignment cannot move them elsewhere in the section.
    const aimed=rootTake.focus&&result.sectionId===rootTake.startSectionId&&intent!=='add'&&comparisonOriginal!==undefined?focusedComparison(comparisonOriginal,result.text,rootTake.focus):undefined;
    return {...result,...(aimed?{comparison:aimed}:{}),editIntent:intent,reviewTranscript:words,comparisonOriginal,reviewIssues:[...(result.reviewIssues??[]),...transcriptionReviewIssues(words,transcript,result.evidenceQuotes)],takeIds:chainIds,checked:false,warnings:[...new Set([...result.warnings,...(uncertain.length?[`Check possible mishearings against your audio: ${[...new Set(uncertain)].join(', ')}`]:[])])]};
   })].map(result=>preservesIntegration(current.results.find(prior=>prior.sectionId===result.sectionId),result));
   const order=new Map(current.sections.map((section,index)=>[section.id,index]));results.sort((a,b)=>(order.get(a.sectionId)??0)-(order.get(b.sectionId)??0));
   const next=updateTake({...current,linkedSessionIds:[...new Set([...(current.linkedSessionIds??[]),...linkedSessionIds])],results,unassigned:[...current.unassigned.filter(u=>!u.takeId||!chainIds.includes(u.takeId)),...prepared.unassigned.map(u=>({...u,takeId:captureId}))],rawTranscript:rawSpeech(latestAudio.session,discarded)},captureId,{state:'review',preparedFingerprints:Object.fromEntries(results.filter(result=>resultIds.has(result.sectionId)).map(result=>[result.sectionId,fingerprint(result)])),resultSectionIds:[...resultIds],error:undefined,retryAt:undefined,retryAttempts:0});
   return {...next,state:stateAfter(current,latestAudio.session.captures.some(c=>c.status==='recording'))==='recording'?'recording':'review'};
  });
 }catch(error){
  await change(id,session=>{
   const take=session.takes?.find(t=>t.captureId===captureId);if(!take||take.state==='discarded')return session;
   const message=error instanceof Error?error.message:'This take could not finish. Its audio is saved.';
   const retryAttempts=(take.retryAttempts??0)+1;
   const retryAt=retryAttempts<=4&&/network|offline|fetch|connection|temporar|timed? ?out|unavailable|\b50[234]\b/i.test(message)?Date.now()+Math.min(60000,2000*2**(retryAttempts-1)):undefined;
   const next=updateTake(session,captureId,{state:'failed',error:message,retryAttempts,retryAt});
   return {...next,state:stateAfter(next)};
  }).catch(()=>undefined);
 }})().finally(()=>running.delete(jobKey));
 running.set(jobKey,task);
}
/** Persist the job before returning; transcription and AI continue independently. */
export async function queueSectionTake(sessionId:string,captureId:string,startSectionId:string,services:AuthoringServices,markers:{atMs:number;sectionId:string}[]=[],options:{intent?:'replace'|'add'|'revise';continuationOf?:string;focus?:{start:number;end:number;text:string}}={}):Promise<TakeSession>{
 const registered=await change(sessionId,session=>{
  if(!session.sections.some(section=>section.id===startSectionId)||markers.some(m=>!Number.isFinite(m.atMs)||m.atMs<0||!session.sections.some(s=>s.id===m.sectionId)))throw Error('Choose an existing section before sending this take.');
  const existing=session.takes?.find(t=>t.captureId===captureId);
  if(existing&&['queued','transcribing','assimilating','review','discarded'].includes(existing.state))return session;
  const parentId=options.continuationOf??existing?.continuationOf,parent=parentId?session.takes?.find(t=>t.captureId===parentId):undefined;
  if(parentId&&(!parent||parentId===captureId||parent.state==='discarded'))throw Error('Continue only a saved recording for this same section.');
  if(parentId&&continuationChain(session,parentId).some(part=>part.captureId===captureId))throw Error('A recording cannot continue itself.');
  const baseline=Object.fromEntries(session.results.map(result=>[result.sectionId,fingerprint(result)]));
  const take:SectionTake={id:captureId,captureId,startSectionId,markers:markers.length?structuredClone(markers):[{atMs:0,sectionId:startSectionId}],state:'queued',continuationOf:parentId,intent:options.intent??existing?.intent??parent?.intent,focus:options.focus??existing?.focus??parent?.focus,retryAttempts:existing?.retryAttempts??0,createdAt:existing?.createdAt??new Date().toISOString(),baseline};
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

/** Event-driven recovery with persisted backoff. Timers do no work while offline. */
export function startSectionTakeRecovery(services:AuthoringServices):()=>void {
 let disposed=false,timer:ReturnType<typeof setTimeout>|undefined,checking=false;
 const recover=async()=>{
  if(disposed||checking)return;checking=true;clearTimeout(timer);
  try{
   if(typeof navigator!=='undefined'&&navigator.onLine===false)return;
   let nextAt=Infinity;
   for(const session of await drafts.list() as TakeSession[])for(const take of session.takes??[]){
    if(['queued','transcribing','assimilating'].includes(take.state))launch(session.id,take.captureId,services);
    if(take.state==='failed'&&take.retryAt!==undefined){
     if(take.retryAt<=Date.now()){
      await change(session.id,current=>{const own=current.takes?.find(t=>t.captureId===take.captureId);return own?.state==='failed'&&own.retryAt===take.retryAt?updateTake(current,take.captureId,{state:'queued',retryAt:undefined}):current;});
      launch(session.id,take.captureId,services);
     }else nextAt=Math.min(nextAt,take.retryAt);
    }
   }
   if(Number.isFinite(nextAt)&&!disposed)timer=setTimeout(()=>void recover(),Math.max(1,nextAt-Date.now()));
  }finally{checking=false;}
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
