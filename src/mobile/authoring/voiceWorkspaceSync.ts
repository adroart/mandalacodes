import type {SectionDraftSession} from '../../../lib/oracle/authoring/sectionDrafts';
import type {WorkingSection} from '../../../lib/oracle/authoring/humanDrafts';
import type {SavedSession} from '../../../lib/oracle/authoring/storage';
import type {ResumePosition} from './privateSync';
export interface VoicePeer {draft:SectionDraftSession;working:WorkingSection[]}
export interface VoiceWorkspace extends VoicePeer {schema:1;linked?:VoicePeer[]}
export interface WorkingSyncChoice {remote:WorkingSection;local?:WorkingSection;expectedRevision:number;different:boolean}
export const linkedVoiceIds=(draft:SectionDraftSession):string[]=>(draft as SectionDraftSession&{linkedSessionIds?:string[]}).linkedSessionIds??[];
export const voicePeers=(workspace:VoiceWorkspace):VoicePeer[]=>[workspace,...workspace.linked??[]];
export function voiceWorkspace(draft:SectionDraftSession,working:WorkingSection[],linked:VoicePeer[]=[]):VoiceWorkspace{
 return {schema:1,draft:structuredClone(draft),working:structuredClone(working.filter(section=>section.cardNumber===draft.cardNumber)),...(linked.length?{linked:structuredClone(linked)}:{})};
}
export function readVoiceWorkspace(value:Record<string,unknown>):VoiceWorkspace {
 const workspace=value.voice as VoiceWorkspace;
 if(workspace?.schema!==1||workspace.linked!==undefined&&(!Array.isArray(workspace.linked)||workspace.linked.length>64))throw Error('This private copy has no compatible Voice workspace.');
 const peers=voicePeers(workspace),ids=new Set(peers.map(p=>p.draft?.id));
 if(ids.size!==peers.length)throw Error('Duplicate linked Voice drafts.');
 for(const peer of peers){const draft=peer.draft;
  if(!draft?.id||draft.source?.cardNumber!==draft.cardNumber||draft.sourceHash!==draft.source.hash||!Array.isArray(draft.sections)||!Array.isArray(draft.results)||!Array.isArray(peer.working)||peer.working.some(s=>s.cardNumber!==draft.cardNumber||s.sourceHash!==draft.sourceHash||s.source?.hash!==draft.sourceHash)||draft.sections.some(s=>s.cardNumber!==draft.cardNumber||s.sourceHash!==draft.sourceHash)||linkedVoiceIds(draft).some(id=>!ids.has(id)))throw Error('This private copy has an invalid or missing linked card source.');
 }
 return workspace;
}
export function workingSyncChoices(remote:WorkingSection[],local:WorkingSection[]):WorkingSyncChoice[]{return remote.map(section=>{const current=local.find(s=>s.key===section.key);return {remote:section,local:current,expectedRevision:current?.revision??0,different:(current?.text??'')!==section.text};});}
interface VoiceAudioTake {id:string;captureId:string;captureSessionId?:string}
/** A successful copy must contain every recording needed by its review evidence. */
export function validateVoiceWorkspaceAudio(workspace:VoiceWorkspace,saved:SavedSession):void {
 const originalAudioId=workspace.draft.captureSessionId;
 const captures=new Set(saved.session.captures.filter(c=>c.status==='ready'||c.status==='interrupted').map(c=>c.id));
 for(const peer of voicePeers(workspace)){
  const draft=peer.draft,takes=(draft as SectionDraftSession&{takes?:VoiceAudioTake[]}).takes??[];
  if(draft.captureSessionId&&draft.captureSessionId!==originalAudioId&&draft.captureSessionId!==saved.session.id)throw Error('A linked card uses an external recording that is not included. Sync its audio before copying this workspace.');
  const requireCapture=(captureId:string|undefined,audioId:string|undefined)=>{
   if(!captureId||!captures.has(captureId)||audioId&&audioId!==originalAudioId&&audioId!==saved.session.id)throw Error('This workspace references a recording that is not included in this audio copy. Keep the local originals and sync all recording evidence first.');
  };
  for(const take of takes)requireCapture(take.captureId,take.captureSessionId??draft.captureSessionId);
  for(const result of draft.results){
   if(result.takeIds?.length)for(const id of result.takeIds){const take=takes.find(t=>t.id===id);if(!take)throw Error('A section references a missing recording take. Keep the local originals before syncing.');requireCapture(take.captureId,take.captureSessionId??draft.captureSessionId);}
   else if(draft.captureId)requireCapture(draft.captureId,draft.captureSessionId);
  }
 }
}
/** Original snapshots and transcript stay exact; imported decisions require a new local review. */
export function remapVoiceReview(workspace:VoiceWorkspace,saved:SavedSession,baselines:Record<string,string>,id:string=crypto.randomUUID()):SectionDraftSession {
 validateVoiceWorkspaceAudio(workspace,saved);
 const original=workspace.draft;
 const results=original.results.map(result=>{const {appliedText,beforeText,appliedAt,appliedRevision,integrationId,beforeWorking,...review}=result;return {...review,editIntent:'replace' as const,text:appliedText??result.text,checked:false,applied:false,comparison:undefined,comparisonOriginal:baselines[result.sectionId]??original.sections.find(s=>s.id===result.sectionId)?.text??'',warnings:[...new Set([...result.warnings,'Restored copy: compare these words with this device’s writing before integrating.'])]};});
 const takes=(original as SectionDraftSession&{takes?:any[]}).takes;
 return {...structuredClone(original),id,version:0,captureSessionId:saved.session.id,state:results.length?'review':'ready',error:undefined,results,
  ...(takes?{takes:takes.map(t=>({...t,captureSessionId:saved.session.id,state:['transcribing','assimilating'].includes(t.state)?'queued':t.state,baseline:Object.fromEntries(results.map(r=>[r.sectionId,JSON.stringify(r)])),error:undefined}))}:{}),
  ...((original as SectionDraftSession&{phrasePatches?:any[]}).phrasePatches?{phrasePatches:(original as SectionDraftSession&{phrasePatches:any[]}).phrasePatches.map(patch=>({...patch,...(saved.session.captures.some(c=>c.id===patch.captureId)?{captureSessionId:saved.session.id}:{})}))}:{}),
  // Immutable history travels with the review without pretending it was applied on this device.
  syncedAppliedReceipts:structuredClone(original.results.filter(r=>r.appliedText)),syncedFromDraftId:original.id} as SectionDraftSession;
}
export function remapLinkedVoiceReviews(workspace:VoiceWorkspace,saved:SavedSession,baselines:Record<string,Record<string,string>>,ids:Record<string,string>=Object.fromEntries(voicePeers(workspace).map(p=>[p.draft.id,crypto.randomUUID()]))):SectionDraftSession[]{
 return voicePeers(workspace).map(peer=>{
  const links=linkedVoiceIds(peer.draft).map(id=>{if(!ids[id])throw Error('A linked card draft is missing.');return ids[id];});
  return {...remapVoiceReview({schema:1,...peer},saved,baselines[peer.draft.id]??{},ids[peer.draft.id]),linkedSessionIds:links} as SectionDraftSession;
 });
}
export function remapWorkspaceEvidence(section:WorkingSection,ids:Record<string,string>):WorkingSection{return {...structuredClone(section),blocks:section.blocks.map(block=>({...structuredClone(block),evidence:block.evidence.map(e=>({...e,sessionId:ids[e.sessionId]??e.sessionId}))}))};}
export function remapWorkingEvidence(section:WorkingSection,oldDraftId:string,newDraftId:string):WorkingSection{return {...structuredClone(section),blocks:section.blocks.map(block=>({...structuredClone(block),evidence:block.evidence.map(e=>({...e,sessionId:e.sessionId===oldDraftId?newDraftId:e.sessionId}))}))};}
export function safeResume(resume:ResumePosition|null,draft:SectionDraftSession,saved:SavedSession):ResumePosition|null {
 if(!resume||resume.cardNumber!==draft.cardNumber||!Number.isFinite(resume.positionMs)||resume.positionMs<0||resume.sectionId&&!draft.sections.some(s=>s.id===resume.sectionId))return null;
 const capture=saved.session.captures.find(c=>c.id===resume.captureId);return {...resume,positionMs:capture?Math.min(resume.positionMs,capture.durationMs):0,captureId:capture?.id};
}
/** Debounced callers keep this gate per mounted account. No polling or unchanged retries. */
export class QuietContinuity {
 private attempted='';private busy=false;
 acknowledge(fingerprint:string){this.attempted=fingerprint;}
 async run(enabled:boolean,recording:boolean,fingerprint:string,save:()=>Promise<void>):Promise<boolean>{
  if(!enabled||recording||this.busy||fingerprint===this.attempted)return false;
  this.attempted=fingerprint;this.busy=true;try{await save();return true;}finally{this.busy=false;}
 }
}
