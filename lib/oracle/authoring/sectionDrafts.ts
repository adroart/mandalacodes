import type {PassageComparison} from './passageComparison';
import type {AuthoringServices,SourceSnapshot,Transcript} from './types';
import type {CardSection} from './cardSections';
import {WorkingCardStore,type WorkingSection} from './humanDrafts';
import {sha256} from './workflow';
import {AuthoringStore} from './storage';
import {applyPassageAddition,applyPassageReplacement,plainSection} from '../../../src/mobile/authoring/passageActions';

export interface SectionDraftResult {
 comparison?:PassageComparison;
 /** Comparison baseline is independent of the earlier undo receipt. */
 editIntent?:'replace'|'add'|'revise';
 comparisonOriginal?:string;reviewTranscript?:string;reviewIssues?:SectionReviewIssue[];
 sectionId:string;text:string;evidenceQuotes:string[];changes:{before:string;after:string;reason:string}[];warnings:string[];checked:boolean;applied?:boolean;takeIds?:string[];
 /** Applied text remains a reference while a later revision is being reviewed. */
 appliedText?:string;beforeText?:string;appliedAt?:string;appliedRevision?:number;integrationId?:string;beforeWorking?:WorkingSection;
}
export interface SectionReviewIssue {
 kind:'transcription'|'ambiguity';quote:string;start:number;end:number;message:string;
 /** Character offsets refer to rawTranscript, never inferred cleaned text. */
 scope:'rawTranscript';probability?:number;startMs?:number;endMs?:number;captureId?:string;
}
/** Surface only actionable exceptions; no audio confidence is inferred from an AI warning. */
export function sectionReviewExceptions(result:SectionDraftResult){return {issues:result.reviewIssues??[],warnings:result.warnings,changes:result.changes,needsReview:!!(result.reviewIssues?.length||result.warnings.length)};}
export function sectionComparisonOriginal(result:SectionDraftResult,fallback:string):string{return result.comparisonOriginal??result.comparison?.originalText??result.appliedText??fallback;}
/** Locate provider words within their real transcript segment, including repeated words. */
export function transcriptionReviewIssues(rawTranscript:string,transcripts:Pick<Transcript,'raw'|'words'|'captureId'>[],evidenceQuotes:string[]):SectionReviewIssue[]{
 const issues:SectionReviewIssue[]=[];let segmentCursor=0;
 for(const transcript of transcripts){
  const segmentStart=rawTranscript.indexOf(transcript.raw,segmentCursor);if(segmentStart<0)continue;segmentCursor=segmentStart+transcript.raw.length;
  let wordCursor=0;
  for(const word of transcript.words??[]){
   const local=transcript.raw.indexOf(word.text,wordCursor);if(local<0)continue;wordCursor=local+word.text.length;
   if(word.probability===undefined||!Number.isFinite(word.probability)||word.probability<0||word.probability>=.6)continue;
   const start=segmentStart+local,end=start+word.text.length;
   // Exact evidence containment avoids assigning a warning to an unrelated section.
   const belongs=evidenceQuotes.some(quote=>{let at=rawTranscript.indexOf(quote);while(at>=0){if(start>=at&&end<=at+quote.length)return true;at=rawTranscript.indexOf(quote,at+1);}return false;});
   if(belongs)issues.push({kind:'transcription',quote:rawTranscript.slice(start,end),start,end,scope:'rawTranscript',message:'Check this word against the saved audio.',probability:word.probability,startMs:word.startMs,endMs:word.endMs,captureId:transcript.captureId});
  }
 }
 return issues;
}
export interface SectionDraftSession {
 id:string;cardNumber:number;sourceHash:string;createdAt:string;updatedAt:string;version:number;source:SourceSnapshot;sections:CardSection[];startSectionId:string;
 titleEdits?:Record<string,{text:string;updatedAt:string}>;
 resume?:{sectionId:string;mode:string;positionMs:number};
 captureSessionId?:string;captureId?:string;markers:{atMs:number;sectionId:string}[];rawTranscript:string;results:SectionDraftResult[];unassigned:{text:string;reason:string}[];
 state:'ready'|'recording'|'transcribing'|'assimilating'|'review'|'complete';error?:string;
}
/** Titles are hand-edited metadata; they never enter the spoken passage or its evidence. */
export function sectionTitleEdits(sessions:SectionDraftSession[],sourceHash:string):Record<string,string>{
 const edits:Record<string,{text:string;updatedAt:string}>={};
 for(const session of sessions)if(session.sourceHash===sourceHash)for(const [id,edit]of Object.entries(session.titleEdits??{}))if(!edits[id]||edits[id].updatedAt<edit.updatedAt)edits[id]=edit;
 return Object.fromEntries(Object.entries(edits).map(([id,edit])=>[id,edit.text]));
}
export function createSectionDraftSession(source:SourceSnapshot,sections:CardSection[],startSectionId=sections[0]?.id):SectionDraftSession {
 if(!startSectionId||!sections.some(section=>section.id===startSectionId))throw new Error('Choose a named card section before recording.');
 const now=new Date().toISOString();return {id:crypto.randomUUID(),cardNumber:source.cardNumber,sourceHash:source.hash,createdAt:now,updatedAt:now,version:0,source:structuredClone(source),sections:structuredClone(sections),startSectionId,markers:[],rawTranscript:'',results:[],unassigned:[],state:'ready'};
}
const listeners=new Map<string,Set<()=>void>>();
/** Private drafts and a durable version history, separate from saved audio and manuscripts. */
export class SectionDraftStore {
 constructor(private readonly name='oracle-section-drafts-v1'){}
 private open():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open(this.name,1);request.onupgradeneeded=()=>{const sessions=request.result.createObjectStore('sessions',{keyPath:'id'});sessions.createIndex('cardNumber','cardNumber');const history=request.result.createObjectStore('history',{keyPath:['id','version']});history.createIndex('id','id');};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error??new Error('Cannot open your section drafts.'));});}
 private async run<T>(names:string[],mode:IDBTransactionMode,body:(tx:IDBTransaction,done:(value:T)=>void,fail:(error:Error)=>void)=>void):Promise<T>{const db=await this.open();return new Promise((resolve,reject)=>{const tx=db.transaction(names,mode);let result:T;let failure:Error|undefined;tx.oncomplete=()=>{db.close();resolve(result);};tx.onabort=()=>{db.close();reject(failure??tx.error??new Error('Your section draft could not be saved.'));};try{body(tx,value=>{result=value;},error=>{failure=error;tx.abort();});}catch(error){failure=error as Error;tx.abort();}});}
 get(id:string):Promise<SectionDraftSession|undefined>{return this.run(['sessions'],'readonly',(tx,done)=>{const request=tx.objectStore('sessions').get(id);request.onsuccess=()=>done(request.result);});}
 list(cardNumber?:number):Promise<SectionDraftSession[]>{return this.run(['sessions'],'readonly',(tx,done)=>{const store=tx.objectStore('sessions'),request=cardNumber===undefined?store.getAll():store.index('cardNumber').getAll(cardNumber);request.onsuccess=()=>done((request.result as SectionDraftSession[]).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)));});}
 versions(id:string):Promise<SectionDraftSession[]>{return this.run(['history'],'readonly',(tx,done)=>{const request=tx.objectStore('history').index('id').getAll(id);request.onsuccess=()=>done((request.result as SectionDraftSession[]).sort((a,b)=>a.version-b.version));});}
 subscribe(listener:()=>void):()=>void {const group=listeners.get(this.name)??new Set();listeners.set(this.name,group);group.add(listener);return()=>{group.delete(listener);};}
 async save(next:SectionDraftSession,expectedVersion:number):Promise<SectionDraftSession>{
  if(!next.id||!Number.isInteger(next.cardNumber)||next.cardNumber<1||next.cardNumber>64||next.source.cardNumber!==next.cardNumber||next.sourceHash!==next.source.hash||!next.sections.length||new Set(next.sections.map(s=>s.id)).size!==next.sections.length||!next.sections.some(s=>s.id===next.startSectionId))throw new Error('This section draft does not match its card.');
  if(!Number.isInteger(expectedVersion)||expectedVersion<0||typeof next.rawTranscript!=='string'||next.sections.some(section=>section.cardNumber!==next.cardNumber||section.sourceHash!==next.sourceHash||section.start<0||section.end<section.start||section.sectionText.slice(section.start,section.end)!==section.text)||next.markers.some(marker=>!Number.isFinite(marker.atMs)||marker.atMs<0||!next.sections.some(section=>section.id===marker.sectionId)))throw new Error('This draft contains invalid section boundaries or recording markers.');
  if(Object.entries(next.titleEdits??{}).some(([id,edit])=>!next.sections.some(section=>section.id===id)||!edit.text.trim()||edit.text.length>240||/[\r\n]/.test(edit.text)||!Number.isFinite(Date.parse(edit.updatedAt))))throw new Error('Use a title between 1 and 240 characters on one line.');
  if(next.results.some(result=>!next.sections.some(section=>section.id===result.sectionId))||new Set(next.results.map(result=>result.sectionId)).size!==next.results.length)throw new Error('A draft result has an unknown or duplicate section.');
  const saved=await this.run<SectionDraftSession>(['sessions','history'],'readwrite',(tx,done,fail)=>{const store=tx.objectStore('sessions'),request=store.get(next.id);request.onsuccess=()=>{const previous=request.result as SectionDraftSession|undefined;if((previous?.version??0)!==expectedVersion)return fail(new Error('Another tab changed this section draft. Reopen it before editing.'));if(previous&&(previous.cardNumber!==next.cardNumber||previous.sourceHash!==next.sourceHash))return fail(new Error('A saved draft cannot change its source card.'));
   const results=next.results.map(result=>{const prior=previous?.results.find(r=>r.sectionId===result.sectionId);return prior?.appliedText&&(prior.text!==result.text||prior.editIntent!==result.editIntent||JSON.stringify(prior.takeIds??[])!==JSON.stringify(result.takeIds??[]))?{...result,applied:false,appliedText:prior.appliedText,beforeText:prior.beforeText,appliedAt:prior.appliedAt,appliedRevision:prior.appliedRevision,integrationId:prior.integrationId,beforeWorking:prior.beforeWorking}:result;});
   const value=structuredClone({...next,results,version:expectedVersion+1,updatedAt:new Date().toISOString()});store.put(value);tx.objectStore('history').add(value);done(value);};});
  for(const listener of listeners.get(this.name)??[]){try{listener();}catch{/* Readers cannot invalidate committed drafts. */}}
  if(typeof window!=='undefined')window.dispatchEvent(new Event('oracle:section-draft-changed'));return saved;
 }
}
const drafts=new SectionDraftStore(),workingCards=new WorkingCardStore(),audioStore=new AuthoringStore();
function baseline(source:SourceSnapshot,lensId:string,text:string):WorkingSection{return {key:`${source.cardNumber}/${lensId}`,cardNumber:source.cardNumber,sectionId:lensId,text,revision:0,sourceHash:source.hash,source,savedAt:'',blocks:[{id:'published',text,origin:'ai',evidence:[]}],humanWords:0,totalWords:(text.match(/\S+/g)??[]).length};}
function uniquePosition(text:string,needle:string){const at=text.indexOf(needle);return at>=0&&text.indexOf(needle,at+1)<0?at:-1;}
async function appliedReference(cardNumber:number,sectionId:string,sourceHash:string){const sessions=await drafts.list(cardNumber);return sessions.filter(s=>s.sourceHash===sourceHash).flatMap(session=>session.results.filter(result=>result.sectionId===sectionId&&result.appliedText&&result.appliedAt).map(result=>({session,result}))).sort((a,b)=>b.result.appliedAt!.localeCompare(a.result.appliedAt!))[0];}
async function patchResult(id:string,sectionId:string,change:(result:SectionDraftResult,session:SectionDraftSession)=>SectionDraftResult):Promise<SectionDraftSession>{for(let attempt=0;attempt<4;attempt++){const current=await drafts.get(id);if(!current)throw new Error('This saved section draft could not be found.');const next={...current,results:current.results.map(result=>result.sectionId===sectionId?change(result,current):result)};next.state=next.results.length>0&&next.results.every(result=>result.applied)&&!next.unassigned.length?'complete':'review';try{return await drafts.save(next,current.version);}catch(error){if(attempt===3||!/Another tab/.test(String(error)))throw error;}}throw new Error('Your draft changed while saving. Try again.');}
interface TakeEvidence {id:string;captureId:string;captureSessionId?:string;state:string}
/** Take evidence belongs to the reviewed words, never the session's newest microphone. */
async function evidenceCaptures(session:SectionDraftSession,result:SectionDraftResult):Promise<string[]>{
 if(!result.takeIds?.length)return [session.captureId??session.id];
 const takes=(session as SectionDraftSession&{takes?:TakeEvidence[]}).takes??[];
 const selected=result.takeIds.map(id=>takes.find(take=>take.id===id));
 if(selected.some(take=>!take))throw new Error('The recording evidence for this section is unavailable. Review the saved take again.');
 if(selected.some(take=>take!.state==='discarded'))throw new Error('This recording was discarded. Restore it before integrating its words.');
 const audioIds=[...new Set(selected.map(take=>take!.captureSessionId??session.captureSessionId))];
 if(audioIds.some(id=>!id))throw new Error('The original audio session is unavailable. Review the saved take again.');
 const recordings=new Map(await Promise.all(audioIds.map(async id=>[id,await audioStore.load(id!)] as const)));
 if(selected.some(take=>{const audio=recordings.get(take!.captureSessionId??session.captureSessionId);return !audio||!audio.session.captures.some(capture=>capture.id===take!.captureId&&capture.status!=='empty'&&capture.status!=='recording');}))throw new Error('The original recording is unavailable or unfinished. Review the saved take again.');
 return [...new Set(selected.map(take=>take!.captureId))];
}
/** Apply only the complete named section that was reviewed; all adjacent text survives. */
export async function integrateSectionDraft(sessionId:string,sectionId:string,services:AuthoringServices):Promise<SectionDraftSession>{
 const session=await drafts.get(sessionId),section=session?.sections.find(s=>s.id===sectionId),result=session?.results.find(r=>r.sectionId===sectionId);
 if(!session||!section||!result)throw new Error('Choose a saved named section to integrate.');if(!result.checked||!result.text.trim())throw new Error('Check your words before integrating this section.');if(result.applied&&(result.takeIds?.length??0)<=1&&(result.editIntent==='add'||result.appliedText===result.text))return session;
 const captureIds=await evidenceCaptures(session,result),captureId=captureIds[0];
 const source=await services.loadSource(session.cardNumber);if(source.hash!==session.sourceHash)throw new Error('The original card changed. Reopen the section and compare it again.');
 const integrationId=`${sectionId}/${await sha256((result.editIntent==='add'?'add/':'')+result.text)}`;let expectedWorkingText:string|undefined;let appliedText=result.text,beforeText=section.text,appliedRevision:number|undefined,beforeWorking:WorkingSection|undefined;
 if(section.kind==='intro'){const previous=await getIntegratedIntro(session.cardNumber);beforeText=previous??section.text;if(result.editIntent==='add')appliedText=prepareSectionEdit(beforeText,result.text,'add');}
 else {
  const existing=await workingCards.get(session.cardNumber,section.lensId),currentText=existing?.text??plainSection(source,section.lensId);
  const evidenceDone=existing?.blocks.some(block=>block.evidence.some(e=>e.sessionId===session.id&&e.transcriptId===integrationId));
  if(!evidenceDone){
   beforeWorking=existing??baseline(source,section.lensId,currentText);
   const prior=await appliedReference(session.cardNumber,section.id,session.sourceHash);beforeText=prior?.result.appliedText??section.text;
   let start:number;if(currentText===section.sectionText&&section.sectionText.slice(section.start,section.end)===section.text&&!prior)start=section.start;else start=uniquePosition(currentText,beforeText);
   if(start<0)throw new Error('This section has changed or is no longer unique. Compare its current words before integrating.');
   expectedWorkingText=currentText.slice(0,result.editIntent==='add'?start+beforeText.length:start)+(result.editIntent==='add'?'\n\n':'')+result.text+currentText.slice(start+beforeText.length);
   const anchor={id:section.id,cardNumber:session.cardNumber,sectionId:section.lensId,text:beforeText,sectionText:currentText,start,end:start+beforeText.length,sourceHash:session.sourceHash,revision:existing?.revision??0};
   if(result.editIntent==='add'){await applyPassageAddition(anchor,result.text,services,{sessionId:session.id,captureId,transcriptId:integrationId});appliedText=beforeText+'\n\n'+result.text;}
   else await applyPassageReplacement([anchor],result.text,services,{sessionId:session.id,captureId,transcriptId:integrationId});
  }else {beforeText=existing!.blocks.find(block=>block.evidence.some(e=>e.sessionId===session.id&&e.transcriptId===integrationId))?.replacedText??section.text;const history=await workingCards.versions(session.cardNumber,section.lensId),firstApplied=history.find(version=>version.blocks.some(block=>block.evidence.some(e=>e.sessionId===session.id&&e.transcriptId===integrationId)));expectedWorkingText=firstApplied?.text;beforeWorking=firstApplied?.revision===1?baseline(source,section.lensId,plainSection(source,section.lensId)):history.find(version=>version.revision===(firstApplied?.revision??0)-1);}
  if(result.editIntent==='add'&&evidenceDone){const block=existing!.blocks.find(block=>block.evidence.some(e=>e.sessionId===session.id&&e.transcriptId===integrationId));beforeText=block?.attachedTo??section.text;appliedText=beforeText+'\n\n'+result.text;}
  // The passage helper inserts one evidence record. Preserve every contributing take
  // on that same block without changing its words or promoting adjacent AI prose.
  for(let attempt=0;attempt<4;attempt++){
   const latest=await workingCards.get(session.cardNumber,section.lensId);if(expectedWorkingText!==undefined&&latest?.text!==expectedWorkingText)throw Error('This reading has newer edits. Keep them and review its recording evidence again.');if(!latest)throw Error('The integrated recording evidence could not be found.');
   const relevant=latest.blocks.filter(block=>block.evidence.some(e=>e.sessionId===session.id&&e.transcriptId===integrationId));
   if(!relevant.length)throw Error('The integrated words changed before their recording evidence could be saved.');
   const missing=captureIds.filter(id=>!relevant.some(block=>block.evidence.some(e=>e.sessionId===session.id&&e.transcriptId===integrationId&&e.captureId===id)));
   if(!missing.length){appliedRevision=latest.revision;break;}
   const blocks=latest.blocks.map(block=>block===relevant[0]?{...block,evidence:[...block.evidence,...missing.map(id=>({sessionId:session.id,transcriptId:integrationId,captureId:id,signature:result.text}))]}:block);
   try{appliedRevision=(await workingCards.save({...latest,blocks},latest.revision)).revision;break;}catch(error){if(attempt===3||!/Another tab/.test(String(error)))throw error;}
  }
 }
 return patchResult(session.id,section.id,current=>({...current,applied:current.text===result.text,appliedText,beforeText,appliedAt:new Date().toISOString(),appliedRevision,integrationId,beforeWorking}));
}
/** Latest integrated intro only; a pending correction never hides the current reading. */
export async function getIntegratedIntro(cardNumber:number):Promise<string|undefined>{const sessions=await drafts.list(cardNumber);return sessions.flatMap(session=>session.results.filter(result=>session.sections.some(section=>section.id===result.sectionId&&section.kind==='intro')&&result.appliedText&&result.appliedAt)).sort((a,b)=>b.appliedAt!.localeCompare(a.appliedAt!))[0]?.appliedText;}
/** Undo only while the section and lens version still match this integration. */
export async function undoIntegratedSection(sessionId:string,sectionId:string,services:AuthoringServices):Promise<SectionDraftSession>{
 const session=await drafts.get(sessionId),section=session?.sections.find(s=>s.id===sectionId),result=session?.results.find(r=>r.sectionId===sectionId);if(!session||!section||!result?.appliedText||result.beforeText===undefined)throw new Error('This section has no integrated version to undo.');
 const source=await services.loadSource(session.cardNumber);if(source.hash!==session.sourceHash)throw new Error('The original card changed. Use the section history to restore it.');
 if(section.kind==='intro')return patchResult(session.id,section.id,current=>({...current,applied:false,appliedText:result.beforeText,appliedAt:new Date().toISOString(),appliedRevision:undefined}));
 const existing=await workingCards.get(session.cardNumber,section.lensId);if(!existing||existing.revision!==result.appliedRevision)throw new Error('This reading has newer edits. Use its history to restore an earlier version.');const start=uniquePosition(existing.text,result.appliedText);if(start<0)throw new Error('The integrated section has changed. Use its history to restore it.');
 if(!result.beforeWorking)throw new Error('The earlier section provenance is unavailable. Restore it from the reading history.');await workingCards.save(result.beforeWorking,existing.revision);if(typeof window!=='undefined')window.dispatchEvent(new Event('oracle:passage-applied'));
 return patchResult(session.id,section.id,current=>({...current,applied:false,appliedText:result.beforeText,appliedAt:new Date().toISOString(),appliedRevision:(existing.revision+1),integrationId:undefined}));
}

/** Build a complete review candidate before applying an explicit add or selected-span revision. */
export function prepareSectionEdit(original:string,spoken:string,intent:'replace'|'add'|'revise'='replace',selection?:{start:number;end:number;text:string}):string {
 if(!spoken.trim())throw Error('Keep some spoken words before preparing this edit.');
 if(selection){if(!Number.isInteger(selection.start)||!Number.isInteger(selection.end)||selection.start<0||selection.end<=selection.start||original.slice(selection.start,selection.end)!==selection.text)throw Error('The selected words changed. Select them again.');if(intent==='add')throw Error('Choose the whole section before adding words.');return original.slice(0,selection.start)+spoken+original.slice(selection.end);}
 if(intent==='add')return original.trimEnd()+'\n\n'+spoken.trim();
 if(intent==='revise')throw Error('Select the exact words to revise, or choose Replace for the complete section.');
 return spoken;
}
