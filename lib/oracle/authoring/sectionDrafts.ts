import {applyComparisonEdits,buildPassageComparison,comparisonEdits,comparisonRows,type PassageChoice,type PassageComparison} from './passageComparison';
import type {AuthoringServices,SourceSnapshot,Transcript,TranscriptDoubt} from './types';
import type {CardSection} from './cardSections';
import {WorkingCardStore,type WorkingSection} from './humanDrafts';
import {sha256,uncertainWord} from './workflow';
import {AuthoringStore} from './storage';
import {applyPassageAddition,applyPassageEdits,applyPassageReplacement,plainSection} from '../../../src/mobile/authoring/passageActions';

export interface SectionDraftResult {
 comparison?:PassageComparison;
 /** Comparison baseline is independent of the earlier undo receipt. */
 editIntent?:'replace'|'add'|'revise';
 /** Present only for the new explicit, single-passage recorder. Older reviews keep their saved meaning. */
 passageEdit?:{operation:'add'|'replace';focus:{start:number;end:number;text:string};sectionText:string};
 /** The complete candidate remains available after a selected range is prepared. */
 rangeSelection?:{candidateText:string;original:{start:number;end:number;text:string};candidate:{start:number;end:number;text:string};unplacedKey:string};
 /** Restored history uses an exact minimal edit so unchanged provenance survives Apply. */
 historyRestore?:{baselineText:string};
 comparisonOriginal?:string;reviewTranscript?:string;reviewIssues?:SectionReviewIssue[];
 /** Per compared passage, keyed by its original span: keep the written words or use the spoken ones. */
 rowChoices?:Record<string,PassageChoice>;
 sectionId:string;text:string;evidenceQuotes:string[];changes:{before:string;after:string;reason:string}[];warnings:string[];checked:boolean;applied?:boolean;takeIds?:string[];
 /** Applied text remains a reference while a later revision is being reviewed. */
 appliedText?:string;beforeText?:string;appliedAt?:string;appliedRevision?:number;integrationId?:string;beforeWorking?:WorkingSection;
}
export interface SectionReviewIssue {
 kind:'transcription'|'ambiguity';quote:string;start:number;end:number;message:string;
 /** Character offsets refer to rawTranscript, never inferred cleaned text. */
 scope:'rawTranscript';probability?:number;startMs?:number;endMs?:number;captureId?:string;
 /** What a second listening heard here instead ('' when it heard nothing). Absent when only one listening was made. */
 heardAlso?:string;
}
/** Surface only actionable exceptions; no audio confidence is inferred from an AI warning. */
export function sectionReviewExceptions(result:SectionDraftResult){return {issues:result.reviewIssues??[],warnings:result.warnings,changes:result.changes,needsReview:!!(result.reviewIssues?.length||result.warnings.length)};}
export function sectionComparisonOriginal(result:SectionDraftResult,fallback:string):string{return result.comparisonOriginal??result.comparison?.originalText??result.appliedText??fallback;}
/** Locate provider words within their real transcript segment, including repeated words. A word is flagged by `uncertainWord`;
 * a passage without word timings is flagged by its own exact doubt runs. */
export function transcriptionReviewIssues(rawTranscript:string,transcripts:(Pick<Transcript,'raw'|'words'|'captureId'>&{doubts?:TranscriptDoubt[]})[],evidenceQuotes:string[]):SectionReviewIssue[]{
 const issues:SectionReviewIssue[]=[];let segmentCursor=0;
 // Exact evidence containment avoids assigning a warning to an unrelated section.
 const belongs=(start:number,end:number)=>evidenceQuotes.some(quote=>{let at=rawTranscript.indexOf(quote);while(at>=0){if(start>=at&&end<=at+quote.length)return true;at=rawTranscript.indexOf(quote,at+1);}return false;});
 const message=(quote:string)=>/\s/.test(quote.trim())?'Check these words against the saved audio.':'Check this word against the saved audio.';
 for(const transcript of transcripts){
  const segmentStart=rawTranscript.indexOf(transcript.raw,segmentCursor);if(segmentStart<0)continue;segmentCursor=segmentStart+transcript.raw.length;
  let wordCursor=0;
  for(const word of transcript.words??[]){
   const local=transcript.raw.indexOf(word.text,wordCursor);if(local<0)continue;wordCursor=local+word.text.length;
   if(!uncertainWord(word))continue;
   const start=segmentStart+local,end=start+word.text.length;
   if(belongs(start,end))issues.push({kind:'transcription',quote:rawTranscript.slice(start,end),start,end,scope:'rawTranscript',message:message(word.text),...(word.probability!==undefined?{probability:word.probability}:{}),startMs:word.startMs,endMs:word.endMs,captureId:transcript.captureId,...(typeof word.heardAlso==='string'?{heardAlso:word.heardAlso}:{})});
  }
  let doubtCursor=0;
  for(const doubt of transcript.doubts??[]){
   if(typeof doubt?.text!=='string'||!doubt.text.trim())continue;
   const local=transcript.raw.indexOf(doubt.text,doubtCursor);if(local<0)continue;doubtCursor=local+doubt.text.length;
   const start=segmentStart+local,end=start+doubt.text.length;
   if(belongs(start,end))issues.push({kind:'transcription',quote:rawTranscript.slice(start,end),start,end,scope:'rawTranscript',message:message(doubt.text),startMs:doubt.startMs,endMs:doubt.endMs,captureId:transcript.captureId,heardAlso:doubt.heardAlso});
  }
 }
 return issues;
}
export interface SectionDraftSession {
 id:string;cardNumber:number;sourceHash:string;createdAt:string;updatedAt:string;version:number;source:SourceSnapshot;sections:CardSection[];startSectionId:string;
 titleEdits?:Record<string,{text:string;updatedAt:string}>;
 resume?:{sectionId:string;mode:string;positionMs:number};
 captureSessionId?:string;captureId?:string;markers:{atMs:number;sectionId:string}[];rawTranscript:string;results:SectionDraftResult[];unassigned:{text:string;reason:string;rangeSelectionKey?:string}[];
 state:'ready'|'recording'|'transcribing'|'assimilating'|'review'|'complete';error?:string;
 historyOrigin?:{kind:'draft'|'working';sessionId:string;version:number;workingRevision?:number};
}
/** Change only the pending proposal's effect; its speech and exact destination remain intact. */
export function switchPendingPassageOperation(session:SectionDraftSession,sectionId:string,operation:'add'|'replace',currentSectionText:string):SectionDraftSession {
 const result=session.results.find(item=>item.sectionId===sectionId),passage=result?.passageEdit;
 if(!passage||result?.applied)throw new Error('Choose a pending passage review before changing Add after or Replace.');
 const activity=session as SectionDraftSession&{recording?:{sectionId:string};takes?:{startSectionId:string;state:string}[]};
 if(activity.state==='recording'&&(!activity.recording||activity.recording.sectionId===sectionId)||activity.takes?.some(take=>take.startSectionId===sectionId&&['queued','transcribing','assimilating'].includes(take.state)))throw new Error('Wait for this passage recording to finish before changing its operation.');
 const {focus,sectionText}=passage;
 if(session.sourceHash!==session.source.hash||currentSectionText!==sectionText||!Number.isInteger(focus.start)||!Number.isInteger(focus.end)||focus.start<0||focus.end<=focus.start||focus.end>sectionText.length||!focus.text.trim()||sectionText.slice(focus.start,focus.end)!==focus.text)throw new Error('This selected passage changed. Select it again before changing its operation.');
 if(passage.operation===operation)return session;
 const {comparison: _comparison,rowChoices: _rowChoices,...rest}=result;
 const changed:SectionDraftResult={...rest,passageEdit:{...passage,operation},editIntent:operation,checked:false,applied:false};
 return {...session,results:session.results.map(item=>item.sectionId===sectionId?changed:item)};
}
export interface ExactTextRange {start:number;end:number;text:string}
export interface SelectedRangeReplacement {
 original:ExactTextRange;candidate:ExactTextRange;
 /** Full baselines prevent a repeated phrase from silently binding to a changed draft. */
 expectedOriginalText:string;expectedCandidateText:string;expectedDraftVersion:number;
}
function exactRange(baseline:string,range:ExactTextRange):boolean{
 const splitSurrogate=(at:number)=>at>0&&at<baseline.length&&/^[\uDC00-\uDFFF]$/.test(baseline[at])&&/^[\uD800-\uDBFF]$/.test(baseline[at-1]);
 return Number.isInteger(range.start)&&Number.isInteger(range.end)&&range.start>=0&&range.end>range.start&&range.end<=baseline.length&&!splitSurrogate(range.start)&&!splitSurrogate(range.end)&&baseline.slice(range.start,range.end)===range.text&&!!range.text.trim();
}
/** Prepare a proposal only. The full recording and unselected candidate words remain available. */
export function prepareSelectedRangeReplacement(session:SectionDraftSession,sectionId:string,selection:SelectedRangeReplacement,currentSectionText:string):SectionDraftSession{
 const result=session.results.find(item=>item.sectionId===sectionId),section=session.sections.find(item=>item.id===sectionId);
 if(!result||!section||result.applied)throw new Error('Choose a pending section review before selecting words.');
 const activity=session as SectionDraftSession&{recording?:{sectionId:string};takes?:{startSectionId:string;state:string}[]};
 if(activity.state==='recording'||activity.state==='transcribing'||activity.state==='assimilating'||activity.takes?.some(take=>take.startSectionId===sectionId&&['queued','transcribing','assimilating'].includes(take.state)))throw new Error('Wait for this passage recording to finish before selecting words.');
 if(session.version!==selection.expectedDraftVersion||session.sourceHash!==session.source.hash||section.sourceHash!==session.sourceHash||currentSectionText!==selection.expectedOriginalText||!exactRange(selection.expectedOriginalText,selection.original)||!exactRange(selection.expectedCandidateText,selection.candidate))throw new Error('The selected words changed. Select both ranges again.');
 const prior=result.rangeSelection;
 if(prior){
  if(prior.candidateText!==selection.expectedCandidateText||result.text!==prior.candidate.text)throw new Error('The recorded words changed. Select the candidate range again.');
  if(JSON.stringify(prior.original)===JSON.stringify(selection.original)&&JSON.stringify(prior.candidate)===JSON.stringify(selection.candidate))return session;
 }else if(result.text!==selection.expectedCandidateText)throw new Error('The recorded words changed. Select the candidate range again.');
 const base=result.passageEdit?.sectionText??sectionComparisonOriginal(result,section.text);
 if(base!==selection.expectedOriginalText)throw new Error('The original reading changed. Select its words again.');
 const key=`${session.id}/${sectionId}/range`;
 const unused=[selection.expectedCandidateText.slice(0,selection.candidate.start),selection.expectedCandidateText.slice(selection.candidate.end)].filter(part=>part.trim());
 const {comparison:_comparison,rowChoices:_rowChoices,reviewIssues:_reviewIssues,changes:_changes,warnings:_warnings,historyRestore:_historyRestore,...rest}=result;
 const changed:SectionDraftResult={...rest,text:selection.candidate.text,editIntent:'replace',passageEdit:{operation:'replace',focus:selection.original,sectionText:selection.expectedOriginalText},comparisonOriginal:selection.original.text,changes:[],warnings:[],checked:false,applied:false,rangeSelection:{candidateText:selection.expectedCandidateText,original:selection.original,candidate:selection.candidate,unplacedKey:key}};
 return {...session,results:session.results.map(item=>item.sectionId===sectionId?changed:item),unassigned:[...session.unassigned.filter(item=>item.rangeSelectionKey!==key),...unused.map(text=>({text,reason:'Unused words from the full saved recording. Place these if needed.',rangeSelectionKey:key}))]};
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
/** Recent versions kept per draft. The live draft row always holds every applied receipt and its undo state. */
export const DRAFT_HISTORY_KEEP=20;
const receiptKeys=(session:SectionDraftSession)=>session.results.filter(result=>result.appliedText&&result.appliedAt).map(result=>`${result.sectionId}\n${result.appliedAt}`);
/** Inside the save transaction: keep the newest versions and the first version of each receipt the draft still carries; drop other older clones. Audio lives elsewhere and is never touched. */
function pruneDraftHistory(history:IDBObjectStore,current:SectionDraftSession){
 const oldest=current.version-DRAFT_HISTORY_KEEP;if(oldest<1)return;
 const live=new Set(receiptKeys(current)),seen=new Set<string>();
 const request=history.openCursor(IDBKeyRange.bound([current.id,-Infinity],[current.id,oldest]));
 request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;
  const origin=receiptKeys(cursor.value as SectionDraftSession).filter(key=>live.has(key)&&!seen.has(key));origin.forEach(key=>seen.add(key));
  if(!origin.length)cursor.delete();cursor.continue();};
}
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
   const value=structuredClone({...next,results,version:expectedVersion+1,updatedAt:new Date().toISOString()});store.put(value);const history=tx.objectStore('history');history.add(value);pruneDraftHistory(history,value);done(value);};});
  for(const listener of listeners.get(this.name)??[]){try{listener();}catch{/* Readers cannot invalidate committed drafts. */}}
  if(typeof window!=='undefined')window.dispatchEvent(new Event('oracle:section-draft-changed'));return saved;
 }
}
const drafts=new SectionDraftStore(),workingCards=new WorkingCardStore(),audioStore=new AuthoringStore();
function baseline(source:SourceSnapshot,lensId:string,text:string):WorkingSection{return {key:`${source.cardNumber}/${lensId}`,cardNumber:source.cardNumber,sectionId:lensId,text,revision:0,sourceHash:source.hash,source,savedAt:'',blocks:[{id:'published',text,origin:'ai',evidence:[]}],humanWords:0,totalWords:(text.match(/\S+/g)??[]).length};}
function uniquePosition(text:string,needle:string){const at=text.indexOf(needle);return at>=0&&text.indexOf(needle,at+1)<0?at:-1;}
async function appliedReference(cardNumber:number,sectionId:string,sourceHash:string){const sessions=await drafts.list(cardNumber);return sessions.filter(s=>s.sourceHash===sourceHash).flatMap(session=>session.results.filter(result=>result.sectionId===sectionId&&result.appliedText&&result.appliedAt).map(result=>({session,result}))).sort((a,b)=>b.result.appliedAt!.localeCompare(a.result.appliedAt!))[0];}
export interface SectionHistoryEntry {
 id:string;kind:'draft'|'working';cardNumber:number;sectionId:string;sourceHash:string;createdAt:string;
 stateLabel:string;contextLabel:string;scopeLabel:string;preview:string;text:string;
 sessionId?:string;version?:number;workingRevision?:number;restoreDisabledReason?:string;
}
/** The list describes only local retained snapshots. A working revision without an exact named-section receipt is viewable but cannot be safely restored here. */
export async function listSectionHistory(cardNumber:number,sectionId:string,sourceHash:string):Promise<SectionHistoryEntry[]>{
 const live=(await drafts.list(cardNumber)).filter(session=>session.sourceHash===sourceHash&&session.sections.some(section=>section.id===sectionId));
 const versions=(await Promise.all(live.map(async session=>({session,versions:await drafts.versions(session.id)})))).flatMap(({session,versions})=>versions.map(version=>({session,version})));
 const entries:SectionHistoryEntry[]=[],seen=new Set<string>();
 for(const {session,version} of versions){const result=version.results.find(item=>item.sectionId===sectionId);if(!result)continue;
  const key=`${session.id}/${result.text}/${result.editIntent??'replace'}/${JSON.stringify(result.passageEdit??null)}/${JSON.stringify(result.comparison??null)}/${JSON.stringify(result.rowChoices??null)}/${!!result.applied}/${JSON.stringify(result.takeIds??[])}`;
  if(seen.has(key))continue;seen.add(key);
  let proposal=result.text,restoreDisabledReason:string|undefined;
  if(result.passageEdit)proposal=result.passageEdit.sectionText.slice(0,result.passageEdit.focus.start)+(result.passageEdit.operation==='add'?result.passageEdit.focus.text+'\n\n'+result.text:result.text)+result.passageEdit.sectionText.slice(result.passageEdit.focus.end);
  else if(result.editIntent==='add')proposal=(result.beforeText??result.comparisonOriginal??version.sections.find(section=>section.id===sectionId)?.text??'').trimEnd()+'\n\n'+result.text.trim();
  else if(result.comparison||result.rowChoices){
   const original=sectionComparisonOriginal(result,version.sections.find(section=>section.id===sectionId)?.text??'');
   try{const plan=sectionReplacementPlan(result,original);if(plan)proposal=plan.text;else restoreDisabledReason='The saved passage choices no longer match their original reading.';}
   catch{restoreDisabledReason='The saved passage choices do not produce a restorable change.';}
  }
  entries.push({id:`draft/${session.id}/${version.version}/${sectionId}`,kind:'draft',cardNumber,sectionId,sourceHash,createdAt:version.updatedAt,stateLabel:result.applied?'Applied proposal':result.checked?'Checked proposal':'Draft proposal',contextLabel:`Saved draft · version ${version.version}`,scopeLabel:'Named passage',preview:proposal.slice(0,240),text:proposal,sessionId:session.id,version:version.version,...(restoreDisabledReason?{restoreDisabledReason}:{})});
 }
 const section=live.flatMap(session=>session.sections).find(item=>item.id===sectionId);
 if(section?.kind==='manuscript'){
  const workingVersions=await workingCards.versions(cardNumber,section.lensId);
  for(const working of workingVersions.filter(item=>item.sourceHash===sourceHash)){
   const exact=versions.find(({session,version})=>version.results.some(result=>result.sectionId===sectionId&&result.applied&&result.appliedRevision===working.revision&&!!result.appliedText&&!!result.integrationId&&uniquePosition(working.text,result.appliedText)>=0&&working.blocks.some(block=>block.evidence.some(evidence=>evidence.sessionId===session.id&&evidence.transcriptId===result.integrationId))));
   const receipt=exact?.version.results.find(result=>result.sectionId===sectionId&&result.appliedRevision===working.revision);
   const restorable=!!receipt&&!!exact;
   const reason=restorable?undefined:'This full-lens reading revision has no exact restorable named-passage proposal.';
   entries.push({id:`working/${cardNumber}/${section.lensId}/${working.revision}/${sectionId}`,kind:'working',cardNumber,sectionId,sourceHash,createdAt:working.savedAt,stateLabel:'Private reading version',contextLabel:`Reading revision ${working.revision}`,scopeLabel:restorable?'Named passage':'Full lens',preview:(restorable?receipt!.appliedText!:working.text).slice(0,240),text:restorable?receipt!.appliedText!:working.text,sessionId:restorable?exact!.session.id:undefined,version:restorable?exact!.version.version:undefined,workingRevision:working.revision,...(reason?{restoreDisabledReason:reason}:{})});
  }
 }
 return entries.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
}
/** Copy a retained proposal into a new pending draft. The old session and private reading are never written. */
export async function restoreSectionHistoryAsDraft(entry:SectionHistoryEntry,current:SectionDraftSession,services:AuthoringServices):Promise<{session:SectionDraftSession;sectionId:string}>{
 if(entry.restoreDisabledReason)throw new Error(entry.restoreDisabledReason);
 const active=current as SectionDraftSession&{recording?:unknown;takes?:{state:string}[]};
 if(['recording','transcribing','assimilating'].includes(current.state)||active.recording||active.takes?.some(take=>['queued','transcribing','assimilating'].includes(take.state)))throw new Error('Wait for the current recording to finish before restoring history.');
 const savedCurrent=await drafts.get(current.id);
 if(!savedCurrent||savedCurrent.version!==current.version||entry.cardNumber!==current.cardNumber||entry.sourceHash!==current.sourceHash||!current.sections.some(section=>section.id===entry.sectionId))throw new Error('The current draft or history destination changed. Reopen it before restoring.');
 const source=await services.loadSource(current.cardNumber);
 if(source.hash!==current.sourceHash)throw new Error('The original card changed. Reopen its history before restoring.');
 const found=(await listSectionHistory(entry.cardNumber,entry.sectionId,entry.sourceHash)).find(item=>item.id===entry.id);
 if(!found||found.restoreDisabledReason||found.kind!==entry.kind||found.sessionId!==entry.sessionId||found.version!==entry.version||found.workingRevision!==entry.workingRevision)throw new Error('That retained history version is unavailable or changed. Reopen history.');
 const origin=found.sessionId&&found.version!==undefined?(await drafts.versions(found.sessionId)).find(item=>item.version===found.version):undefined;
 const historical=origin?.results.find(result=>result.sectionId===entry.sectionId),target=current.sections.find(section=>section.id===entry.sectionId)!;
 if(!origin||!historical||origin.sourceHash!==source.hash||!origin.sections.some(section=>section.id===target.id&&section.lensId===target.lensId&&section.kind===target.kind))throw new Error('The older section mapping is no longer compatible.');
 let baselineText=target.text;
 if(target.kind==='intro')baselineText=await getIntegratedIntro(current.cardNumber)??target.text;
 else{
  const working=await workingCards.get(current.cardNumber,target.lensId),currentReading=working?.text??plainSection(source,target.lensId),prior=await appliedReference(current.cardNumber,target.id,current.sourceHash);
  const candidate=prior?.result.appliedText??target.text;
  if(uniquePosition(currentReading,candidate)<0)throw new Error('The current named passage changed or is ambiguous. Compare it again before restoring.');
  baselineText=candidate;
 }
 const next=createSectionDraftSession(source,current.sections,entry.sectionId);
 const {applied:_applied,appliedText:_appliedText,beforeText:_beforeText,appliedAt:_appliedAt,appliedRevision:_appliedRevision,integrationId:_integrationId,beforeWorking:_beforeWorking,...copy}=historical;
 // A historical selected span may no longer match today's section. Restore its
 // complete named-passage proposal against today's exact named-passage baseline.
 const result:SectionDraftResult={...structuredClone(copy),text:found.text,editIntent:'replace',passageEdit:undefined,rangeSelection:undefined,historyRestore:{baselineText},comparisonOriginal:baselineText,comparison:undefined,rowChoices:undefined,reviewIssues:undefined,changes:[],warnings:[],checked:false,applied:false};
 const historicalActivity=origin as SectionDraftSession&{takes?:{id:string;state:string}[]};
 const referencedTakes=(historicalActivity.takes??[]).filter(take=>result.takeIds?.includes(take.id));
 if(result.takeIds?.some(id=>!referencedTakes.some(take=>take.id===id&&take.state==='review')))throw new Error('The historical recording is unfinished or unavailable.');
 const proposal={...next,state:'review' as const,results:[result],rawTranscript:origin.rawTranscript,unassigned:structuredClone(origin.unassigned),captureSessionId:origin.captureSessionId,captureId:origin.captureId??origin.id,markers:structuredClone(origin.markers),...(referencedTakes.length?{takes:structuredClone(referencedTakes)}:{}),historyOrigin:{kind:found.kind,sessionId:origin.id,version:origin.version,...(found.workingRevision!==undefined?{workingRevision:found.workingRevision}:{})}};
 return {session:await drafts.save(proposal,0),sectionId:entry.sectionId};
}
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
/** Passage by passage when the comparison is matched against this exact baseline; otherwise undefined and the whole section is replaced. */
export function sectionReplacementPlan(result:SectionDraftResult,beforeText:string):{edits:{start:number;end:number;words:string}[];text:string}|undefined{
 if(result.historyRestore){
  if(result.historyRestore.baselineText!==beforeText)throw new Error('The current named passage changed. Reopen history before applying.');
  if(result.text===beforeText)throw new Error('These historical words are already in the reading.');
  const before=[...beforeText],after=[...result.text];let start=0,tail=0,startUnits=0,tailUnits=0;
  while(start<before.length&&start<after.length&&before[start]===after[start]){startUnits+=before[start].length;start++;}
  while(tail<before.length-start&&tail<after.length-start&&before[before.length-1-tail]===after[after.length-1-tail]){tailUnits+=before[before.length-1-tail].length;tail++;}
  const end=beforeText.length-tailUnits,words=result.text.slice(startUnits,result.text.length-tailUnits);
  if(!words)throw new Error('This history proposal only removes words. Its recording evidence cannot be attached safely yet.');
  return {edits:[{start:startUnits,end,words}],text:result.text};
 }
 if(result.editIntent==='add'||sectionComparisonOriginal(result,beforeText)!==beforeText)return;
 const view=buildPassageComparison(beforeText,result.text,result.comparison);if(view.kind!=='matched')return;
 const edits=comparisonEdits(beforeText,comparisonRows(view,result.rowChoices));
 if(!edits.length)throw new Error('Every passage is set to keep its original words. Choose one to replace.');
 return {edits,text:applyComparisonEdits(beforeText,edits)};
}
export async function integrateSectionDraft(sessionId:string,sectionId:string,services:AuthoringServices):Promise<SectionDraftSession>{
 const session=await drafts.get(sessionId),section=session?.sections.find(s=>s.id===sectionId),result=session?.results.find(r=>r.sectionId===sectionId);
 if(!session||!section||!result)throw new Error('Choose a saved named section to integrate.');if(!result.checked||!result.text.trim())throw new Error('Check your words before integrating this section.');if(result.applied&&(result.takeIds?.length??0)<=1&&(result.editIntent==='add'||result.appliedText===result.text))return session;
 const captureIds=await evidenceCaptures(session,result),captureId=captureIds[0];
 const source=await services.loadSource(session.cardNumber);if(source.hash!==session.sourceHash)throw new Error('The original card changed. Reopen the section and compare it again.');
 const integrationId=`${sectionId}/${await sha256((result.editIntent==='add'?'add/':'')+result.text+(result.rowChoices?JSON.stringify(result.rowChoices):'')+(result.passageEdit?JSON.stringify(result.passageEdit):''))}`;let expectedWorkingText:string|undefined;let appliedText=result.text,beforeText=section.text,appliedRevision:number|undefined,beforeWorking:WorkingSection|undefined;
 if(section.kind==='intro'){const previous=await getIntegratedIntro(session.cardNumber);beforeText=previous??section.text;
  if(result.passageEdit){const {focus,operation,sectionText}=result.passageEdit;if(beforeText!==sectionText||beforeText.slice(focus.start,focus.end)!==focus.text)throw Error('This selected passage changed. Select it again before applying.');appliedText=beforeText.slice(0,focus.start)+(operation==='add'?focus.text+'\n\n'+result.text:result.text)+beforeText.slice(focus.end);}
  else if(result.editIntent==='add')appliedText=prepareSectionEdit(beforeText,result.text,'add');else appliedText=sectionReplacementPlan(result,beforeText)?.text??result.text;}
 else {
  const existing=await workingCards.get(session.cardNumber,section.lensId),currentText=existing?.text??plainSection(source,section.lensId);
  const evidenceDone=existing?.blocks.some(block=>block.evidence.some(e=>e.sessionId===session.id&&e.transcriptId===integrationId));
  if(!evidenceDone){
   beforeWorking=existing??baseline(source,section.lensId,currentText);
   const prior=await appliedReference(session.cardNumber,section.id,session.sourceHash);beforeText=result.passageEdit?.sectionText??prior?.result.appliedText??section.text;
   const focus=result.passageEdit?.focus;
   if(focus&&(focus.start<0||focus.end<=focus.start||beforeText.slice(focus.start,focus.end)!==focus.text))throw new Error('The selected passage no longer matches the saved recording. Select it again.');
   let start:number;if(currentText===section.sectionText&&section.sectionText.slice(section.start,section.end)===section.text&&!prior)start=section.start;else start=uniquePosition(currentText,beforeText);
   if(start<0)throw new Error(result.passageEdit?'This selected passage changed or is no longer unique. Select it again before applying.':'This section has changed or is no longer unique. Compare its current words before integrating.');
   expectedWorkingText=currentText.slice(0,result.editIntent==='add'?start+beforeText.length:start)+(result.editIntent==='add'?'\n\n':'')+result.text+currentText.slice(start+beforeText.length);
   const anchor={id:section.id,cardNumber:session.cardNumber,sectionId:section.lensId,text:beforeText,sectionText:currentText,start,end:start+beforeText.length,sourceHash:session.sourceHash,revision:existing?.revision??0};
   if(result.passageEdit){
    const point=start+focus!.start,selected={...anchor,text:focus!.text,start:point,end:point+focus!.text.length};
    const change=result.passageEdit.operation==='add'?focus!.text+'\n\n'+result.text:result.text;
    appliedText=beforeText.slice(0,focus!.start)+change+beforeText.slice(focus!.end);
    expectedWorkingText=currentText.slice(0,start)+appliedText+currentText.slice(start+beforeText.length);
    if(result.passageEdit.operation==='add')await applyPassageAddition(selected,result.text,services,{sessionId:session.id,captureId,transcriptId:integrationId});
    else await applyPassageReplacement([selected],result.text,services,{sessionId:session.id,captureId,transcriptId:integrationId});
   }
   else if(result.editIntent==='add'){await applyPassageAddition(anchor,result.text,services,{sessionId:session.id,captureId,transcriptId:integrationId});appliedText=beforeText+'\n\n'+result.text;}
   else {const plan=sectionReplacementPlan(result,beforeText);if(plan){appliedText=plan.text;expectedWorkingText=currentText.slice(0,start)+plan.text+currentText.slice(start+beforeText.length);await applyPassageEdits({cardNumber:session.cardNumber,sectionId:section.lensId,sectionText:currentText,revision:existing?.revision??0,sourceHash:session.sourceHash},plan.edits.map(edit=>({...edit,start:edit.start+start,end:edit.end+start})),services,{sessionId:session.id,captureId,transcriptId:integrationId});}else await applyPassageReplacement([anchor],result.text,services,{sessionId:session.id,captureId,transcriptId:integrationId});}
  }else {const prior=await appliedReference(session.cardNumber,section.id,session.sourceHash),baselineText=prior?.result.appliedText??section.text,plan=result.passageEdit||result.editIntent==='add'?undefined:sectionReplacementPlan(result,baselineText);beforeText=result.passageEdit?.sectionText??(plan?baselineText:existing!.blocks.find(block=>block.evidence.some(e=>e.sessionId===session.id&&e.transcriptId===integrationId))?.replacedText??section.text);if(plan)appliedText=plan.text;const history=await workingCards.versions(session.cardNumber,section.lensId),firstApplied=history.find(version=>version.blocks.some(block=>block.evidence.some(e=>e.sessionId===session.id&&e.transcriptId===integrationId)));expectedWorkingText=firstApplied?.text;beforeWorking=firstApplied?.revision===1?baseline(source,section.lensId,plainSection(source,section.lensId)):history.find(version=>version.revision===(firstApplied?.revision??0)-1);}
  if(result.passageEdit&&evidenceDone){const {focus,operation}=result.passageEdit;appliedText=beforeText.slice(0,focus.start)+(operation==='add'?focus.text+'\n\n'+result.text:result.text)+beforeText.slice(focus.end);}
  else if(result.editIntent==='add'&&evidenceDone){const block=existing!.blocks.find(block=>block.evidence.some(e=>e.sessionId===session.id&&e.transcriptId===integrationId));beforeText=block?.attachedTo??section.text;appliedText=beforeText+'\n\n'+result.text;}
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
