import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useAccount} from '../../../lib/account/useAccount';
import {AuthoringStore,type SavedSession} from '../../../lib/oracle/authoring/storage';
import {SectionDraftStore,type SectionDraftSession} from '../../../lib/oracle/authoring/sectionDrafts';
import {WorkingCardStore} from '../../../lib/oracle/authoring/humanDrafts';
import {sourceSnapshot} from '../../../lib/oracle/authoring/workflow';
import {currentSectionTexts} from '../../../src/mobile/authoring/sectionWorkflow';
import {PrivateAuthoringSync,acknowledgePrivateSync,loadPrivateSyncLink,type ResumePosition} from '../../../src/mobile/authoring/privateSync';
import {QuietContinuity,voiceWorkspace,readVoiceWorkspace,workingSyncChoices,remapLinkedVoiceReviews,remapWorkspaceEvidence,linkedVoiceIds,voicePeers,validateVoiceWorkspaceAudio,safeResume,privateCopyEnabled,PRIVATE_COPY_QUIET_MS,type WorkingSyncChoice,type VoiceWorkspace} from '../../../src/mobile/authoring/voiceWorkspaceSync';
import {requestPersistence,storageUsage,storageLine} from '../../../src/mobile/authoring/storageHealth';
import './VoiceSyncTools.css';
export interface VoiceSyncToolsProps {draft:SectionDraftSession;savedAudio?:SavedSession;resume:{sectionId:string;mode:string;positionMs:number};onRestored:(draft:SectionDraftSession,saved:SavedSession,resume:ResumePosition|null)=>void}
const audio=new AuthoringStore(),drafts=new SectionDraftStore(),working=new WorkingCardStore();
interface Candidate {draft:SectionDraftSession;linked:SectionDraftSession[];saved:SavedSession;workspace:VoiceWorkspace;resume:ResumePosition|null;choices:WorkingSyncChoice[]}
function savedAgo(at:number,now:number){const minutes=Math.floor((now-at)/60000);if(minutes<1)return 'just now';if(minutes<60)return minutes===1?'1 minute ago':`${minutes} minutes ago`;const hours=Math.floor(minutes/60);return hours<24?(hours===1?'1 hour ago':`${hours} hours ago`):new Date(at).toLocaleString();}
/** A reading's plain name from the card's own sections, never its internal id. */
function readingName(rows:SectionDraftSession[],cardNumber:number,lensId:string){const section=rows.flatMap(row=>row.sections).find(s=>s.cardNumber===cardNumber&&s.lensId===lensId);return section?.path?.[0]??section?.title??'this reading';}
export default function VoiceSyncTools({draft,savedAudio,resume,onRestored}:VoiceSyncToolsProps){
 const account=useAccount(),sync=useMemo(()=>new PrivateAuthoringSync(account.fetchAuthed),[account.fetchAuthed]);
 const [automatic,setAutomatic]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState(''),[tick,setTick]=useState(0);
 const [remote,setRemote]=useState<{id:string;revision:string;updatedAt:string}[]>([]),[cursor,setCursor]=useState<string|null>(null),[listed,setListed]=useState(false),[candidate,setCandidate]=useState<Candidate|null>(null);
 const [space,setSpace]=useState(''),[savedAt,setSavedAt]=useState<number|null>(null),[now,setNow]=useState(()=>Date.now());
 const gate=useRef(new QuietContinuity()),lock=useRef(false),latest=useRef({draft,savedAudio,resume});latest.current={draft,savedAudio,resume};
 const optKey=`oracle.voice.continuity.v1/${account.userId??'guest'}`;
 useEffect(()=>{let stored:string|null=null;try{stored=localStorage.getItem(optKey);}catch{}setAutomatic(privateCopyEnabled(account.isSignedIn&&!!account.userId,stored));gate.current=new QuietContinuity();setCandidate(null);setRemote([]);setListed(false);setError('');setNotice('');setSavedAt(null);},[optKey,account.isSignedIn]);
 useEffect(()=>{const stopWorking=working.subscribe(()=>setTick(n=>n+1)),stopDrafts=drafts.subscribe(()=>setTick(n=>n+1));return()=>{stopWorking();stopDrafts();};},[]);
 useEffect(()=>{let live=true;void requestPersistence().then(()=>storageUsage()).then(usage=>{if(live&&usage)setSpace(storageLine(usage));});return()=>{live=false;};},[savedAudio?.version]);
 useEffect(()=>{if(savedAt===null)return;const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer);},[savedAt]);
 async function perform(action:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'The copy could not be saved. Everything is still on this phone.');}finally{lock.current=false;setBusy(false);}}
 async function save(){
  if(!account.userId)throw Error('Sign in to keep a private copy.');
  const current=latest.current,sessionId=current.draft.captureSessionId??current.savedAudio?.session.id;
  if(!sessionId)throw Error('Record a take before saving a copy.');
  const saved=await audio.load(sessionId);if(!saved)throw Error('The recordings for this card could not be found on this phone.');
  if(saved.session.captures.some(c=>c.status==='recording'))throw Error('Finish the current take before saving a copy.');
  const link=loadPrivateSyncLink(account.userId,current.draft.id);
  const linked=[];const seen=new Set([current.draft.id]),queue=[...linkedVoiceIds(current.draft)];
  while(queue.length){const id=queue.shift()!;if(seen.has(id))continue;if(seen.size>64)throw Error('This recording is linked to too many cards to copy at once.');seen.add(id);const peer=await drafts.get(id);if(!peer)throw Error('A linked card is missing on this phone, so no copy was saved. Everything is still on this phone.');if(peer.captureSessionId!==current.draft.captureSessionId)throw Error('A linked card uses a different recording. Save a copy from that card first.');linked.push({draft:peer,working:await working.list(peer.cardNumber)});queue.push(...linkedVoiceIds(peer));}
  const workspace=readVoiceWorkspace({voice:voiceWorkspace(current.draft,await working.list(current.draft.cardNumber),linked)});
  validateVoiceWorkspaceAudio(workspace,saved);
  const position:ResumePosition={...current.resume,cardNumber:current.draft.cardNumber,captureId:current.draft.captureId};
  const remoteId=link?.remoteId??saved.session.id;
  const revision=await sync.save(audio,saved.session.id,link?.revision??null,position,{voice:workspace},remoteId,account.userId);
  acknowledgePrivateSync(account.userId,current.draft.id,{remoteId,revision});gate.current.acknowledge(JSON.stringify({draft:current.draft,savedVersion:current.savedAudio?.version,resume:current.resume,tick}));setNotice('');const at=Date.now();setSavedAt(at);setNow(at);
 }
 const recording=draft.state==='recording'||!!savedAudio?.session.captures.some(c=>c.status==='recording');
 useEffect(()=>{
  // Several quiet seconds after the last change, and never while a take is recording.
  if(!automatic||!account.isSignedIn||busy||recording)return;
  const fingerprint=JSON.stringify({draft,savedVersion:savedAudio?.version,resume,tick});
  const timeout=setTimeout(()=>{const current=latest.current;void gate.current.run(automatic,current.draft.state==='recording'||!!current.savedAudio?.session.captures.some(c=>c.status==='recording'),fingerprint,async()=>{await perform(save);});},PRIVATE_COPY_QUIET_MS);
  return()=>clearTimeout(timeout);
 },[automatic,account.isSignedIn,busy,recording,draft,savedAudio?.version,resume.sectionId,resume.mode,resume.positionMs,tick]);
 async function list(more=false){const value=await sync.list(more?cursor??undefined:undefined);setRemote(previous=>more?[...previous,...value.documents]:value.documents);setCursor(value.cursor);setListed(true);setNotice('');}
 async function restore(id:string){
  if(!account.userId)return;
  const restored=await sync.restore(audio,id,account.userId),workspace=readVoiceWorkspace(restored.workspace);
  validateVoiceWorkspaceAudio(workspace,restored.saved);
  const peers=voicePeers(workspace),baselines:Record<string,Record<string,string>>={};
  for(const peer of peers){const source=peer.draft.source,checked=await sourceSnapshot(source.cardNumber,source.revision,source.markdown,source.sections);if(checked.hash!==source.hash)throw Error('This copy was made from a different version of the card, so it cannot be opened here.');baselines[peer.draft.id]=await currentSectionTexts(peer.draft);}
  const [fresh,...linked]=remapLinkedVoiceReviews(workspace,restored.saved,baselines);
  acknowledgePrivateSync(account.userId,fresh.id,{remoteId:id,revision:restored.revision});
  setCandidate({draft:fresh,linked,saved:restored.saved,workspace,resume:safeResume(restored.resume,fresh,restored.saved),choices:workingSyncChoices(peers.flatMap(peer=>peer.working),await working.list())});
  setNotice('The copy from your account is ready to open on its own. Your writing on this phone is unchanged.');
 }
 async function persistCandidate(withTitles:boolean):Promise<Candidate>{
  if(!candidate)throw Error('Choose a copy first.');
  let next=candidate;const rows=[next.draft,...next.linked];
  for(let index=0;index<rows.length;index++){
   const row=rows[index];if(row.version!==0&&!withTitles)continue;
   const baselines=await currentSectionTexts(row);
   const persisted=await drafts.save({...row,titleEdits:withTitles?row.titleEdits:{},results:row.results.map(r=>({...r,comparison:undefined,comparisonOriginal:baselines[r.sectionId]??r.comparisonOriginal}))},row.version);
   rows[index]={...persisted,titleEdits:row.titleEdits};next={...next,draft:rows[0],linked:rows.slice(1)};setCandidate(next);
  }
  return next;
 }
 async function useWriting(choice:WorkingSyncChoice){
  const next=await persistCandidate(false),peers=voicePeers(next.workspace);
  const ids=Object.fromEntries([next.draft,...next.linked].map(row=>[(row as SectionDraftSession&{syncedFromDraftId:string}).syncedFromDraftId,row.id]));
  await working.save(remapWorkspaceEvidence(choice.remote,ids),choice.expectedRevision);
  setCandidate({...next,choices:workingSyncChoices(peers.flatMap(peer=>peer.working),await working.list())});
  window.dispatchEvent(new Event('oracle:passage-applied'));setNotice('The writing from your account is now on this phone. The earlier version is kept in its history.');
 }
 async function openReview(){const next=await persistCandidate(true);onRestored(next.draft,next.saved,next.resume);setCandidate(null);}
 const spaceLine=space&&<p className="voice-sync-space">{space}</p>;
 if(!account.available)return <section className="voice-sync-tools" aria-label="Private copy"><h2>Private copy</h2><p>Recordings are kept only on this phone.</p>{spaceLine}</section>;
 if(!account.isSignedIn)return <section className="voice-sync-tools" aria-label="Private copy"><h2>Private copy</h2><p>Recordings are kept only on this phone. Sign in to keep a private copy in your account as well.</p><a href="/account">Sign in</a>{spaceLine}</section>;
 const rows=candidate?[candidate.draft,...candidate.linked]:[];
 return <section className="voice-sync-tools" aria-label="Private copy"><h2>Private copy</h2>
  <p>{automatic?'Your recordings and writing are copied to your account as you work, so this phone is not the only copy.':'Recordings are kept only on this phone.'}</p>
  <label className="voice-sync-opt"><input type="checkbox" role="switch" checked={automatic} onChange={e=>{const enabled=e.target.checked;setAutomatic(enabled);try{localStorage.setItem(optKey,String(enabled));}catch{}}}/>Copy my recordings to my account</label>
  {automatic&&<p className="voice-sync-note">Copies wait until you stop recording. If another device changed this card, both versions are kept for you to choose.</p>}
  {savedAt!==null&&<p className="voice-sync-saved" role="status">Saved to your account {savedAgo(savedAt,now)}</p>}
  {spaceLine}
  <div className="voice-sync-actions"><button disabled={busy||recording||!draft.captureSessionId} onClick={()=>void perform(save)}>Save a copy now</button><button disabled={busy} onClick={()=>void perform(()=>list())}>Show copies in my account</button></div>
  {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
  {listed&&<div className="voice-sync-sessions"><h3>Copies in your account</h3>{remote.length?remote.map(item=><div className="voice-sync-session" key={item.id}><span>Saved {new Date(item.updatedAt).toLocaleString()}</span><button disabled={busy} onClick={()=>void perform(()=>restore(item.id))}>Compare with this phone</button></div>):<p>No copies are saved in your account yet.</p>}{cursor&&<button disabled={busy} onClick={()=>void perform(()=>list(true))}>Show more</button>}</div>}
  {candidate&&<div className="voice-sync-candidate"><h3>Card {candidate.draft.cardNumber}: choose what to keep</h3><p>Open the copy on its own to review it, or choose below which writing to keep. Its recordings, transcripts and the record of what was applied come with it.</p>{candidate.linked.length>0&&<p>Also includes cards {candidate.linked.map(peer=>peer.cardNumber).join(', ')}.</p>}{rows.flatMap(peer=>Object.entries(peer.titleEdits??{}).map(([id,edit])=><p className="voice-sync-title" key={id}>Title in your account: <strong>{edit.text}</strong>{draft.titleEdits?.[id]?.text&&draft.titleEdits[id].text!==edit.text?`. On this phone: ${draft.titleEdits[id].text}`:''}</p>))}<button disabled={busy} onClick={()=>void perform(openReview)}>Open the copy{rows.some(peer=>Object.keys(peer.titleEdits??{}).length)?' with its titles':''}</button>
   {candidate.choices.map(choice=>{const name=readingName(rows,choice.remote.cardNumber,choice.remote.sectionId);return <section className="voice-sync-comparison" key={choice.remote.key}><h4>Card {choice.remote.cardNumber}, {name}</h4>{choice.different?<><div className="voice-sync-texts"><div><strong>On this phone</strong><p>{choice.local?.text||'No writing saved on this phone.'}</p></div><div><strong>In your account</strong><p>{choice.remote.text}</p></div></div><button disabled={busy} onClick={()=>void perform(()=>useWriting(choice))}>Use the writing from your account</button></>:<p>This writing is the same on this phone.</p>}</section>;})}
  </div>}
 </section>;
}
