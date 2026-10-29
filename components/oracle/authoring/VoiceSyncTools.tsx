import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useAccount} from '../../../lib/account/useAccount';
import {AuthoringStore,type SavedSession} from '../../../lib/oracle/authoring/storage';
import {SectionDraftStore,type SectionDraftSession} from '../../../lib/oracle/authoring/sectionDrafts';
import {WorkingCardStore} from '../../../lib/oracle/authoring/humanDrafts';
import {sourceSnapshot} from '../../../lib/oracle/authoring/workflow';
import {currentSectionTexts} from '../../../src/mobile/authoring/sectionWorkflow';
import {PrivateAuthoringSync,acknowledgePrivateSync,loadPrivateSyncLink,type ResumePosition} from '../../../src/mobile/authoring/privateSync';
import {QuietContinuity,voiceWorkspace,readVoiceWorkspace,workingSyncChoices,remapLinkedVoiceReviews,remapWorkspaceEvidence,linkedVoiceIds,voicePeers,validateVoiceWorkspaceAudio,safeResume,type WorkingSyncChoice,type VoiceWorkspace} from '../../../src/mobile/authoring/voiceWorkspaceSync';
import './VoiceSyncTools.css';
export interface VoiceSyncToolsProps {draft:SectionDraftSession;savedAudio?:SavedSession;resume:{sectionId:string;mode:string;positionMs:number};onRestored:(draft:SectionDraftSession,saved:SavedSession,resume:ResumePosition|null)=>void}
const audio=new AuthoringStore(),drafts=new SectionDraftStore(),working=new WorkingCardStore();
interface Candidate {draft:SectionDraftSession;linked:SectionDraftSession[];saved:SavedSession;workspace:VoiceWorkspace;resume:ResumePosition|null;choices:WorkingSyncChoice[]}
export default function VoiceSyncTools({draft,savedAudio,resume,onRestored}:VoiceSyncToolsProps){
 const account=useAccount(),sync=useMemo(()=>new PrivateAuthoringSync(account.fetchAuthed),[account.fetchAuthed]);
 const [automatic,setAutomatic]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState(''),[tick,setTick]=useState(0);
 const [remote,setRemote]=useState<{id:string;revision:string;updatedAt:string}[]>([]),[cursor,setCursor]=useState<string|null>(null),[listed,setListed]=useState(false),[candidate,setCandidate]=useState<Candidate|null>(null);
 const gate=useRef(new QuietContinuity()),lock=useRef(false),latest=useRef({draft,savedAudio,resume});latest.current={draft,savedAudio,resume};
 const optKey=`oracle.voice.continuity.v1/${account.userId??'guest'}`;
 useEffect(()=>{try{setAutomatic(localStorage.getItem(optKey)==='true');}catch{setAutomatic(false);}gate.current=new QuietContinuity();setCandidate(null);setRemote([]);setListed(false);setError('');setNotice('');},[optKey]);
 useEffect(()=>{const stopWorking=working.subscribe(()=>setTick(n=>n+1)),stopDrafts=drafts.subscribe(()=>setTick(n=>n+1));return()=>{stopWorking();stopDrafts();};},[]);
 async function perform(action:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Private sync could not finish. Your local copy is safe.');}finally{lock.current=false;setBusy(false);}}
 async function save(){
  if(!account.userId)throw Error('Sign in to sync private work.');
  const current=latest.current,sessionId=current.draft.captureSessionId??current.savedAudio?.session.id;
  if(!sessionId)throw Error('Record a take before syncing this Voice session.');
  const saved=await audio.load(sessionId);if(!saved)throw Error('The saved audio session could not be found.');
  if(saved.session.captures.some(c=>c.status==='recording'))throw Error('Finish the current take before syncing.');
  const link=loadPrivateSyncLink(account.userId,current.draft.id);
  const linked=[];const seen=new Set([current.draft.id]),queue=[...linkedVoiceIds(current.draft)];
  while(queue.length){const id=queue.shift()!;if(seen.has(id))continue;if(seen.size>64)throw Error('This Voice workspace has too many linked cards.');seen.add(id);const peer=await drafts.get(id);if(!peer)throw Error('A linked card draft is missing. Keep this local copy before syncing.');if(peer.captureSessionId!==current.draft.captureSessionId)throw Error('A linked card uses a different audio session. Save it separately before syncing.');linked.push({draft:peer,working:await working.list(peer.cardNumber)});queue.push(...linkedVoiceIds(peer));}
  const workspace=readVoiceWorkspace({voice:voiceWorkspace(current.draft,await working.list(current.draft.cardNumber),linked)});
  validateVoiceWorkspaceAudio(workspace,saved);
  const position:ResumePosition={...current.resume,cardNumber:current.draft.cardNumber,captureId:current.draft.captureId};
  const remoteId=link?.remoteId??saved.session.id;
  const revision=await sync.save(audio,saved.session.id,link?.revision??null,position,{voice:workspace},remoteId);
  acknowledgePrivateSync(account.userId,current.draft.id,{remoteId,revision});gate.current.acknowledge(JSON.stringify({draft:current.draft,savedVersion:current.savedAudio?.version,resume:current.resume,tick}));setNotice('Private copy saved to your account.');
 }
 useEffect(()=>{
  if(!automatic||!account.isSignedIn||busy)return;
  const fingerprint=JSON.stringify({draft,savedVersion:savedAudio?.version,resume,tick});
  const timeout=setTimeout(()=>{void gate.current.run(automatic,draft.state==='recording'||!!savedAudio?.session.captures.some(c=>c.status==='recording'),fingerprint,async()=>{await perform(save);});},1800);
  return()=>clearTimeout(timeout);
 },[automatic,account.isSignedIn,busy,draft,savedAudio?.version,resume.sectionId,resume.mode,resume.positionMs,tick]);
 async function list(more=false){const value=await sync.list(more?cursor??undefined:undefined);setRemote(previous=>more?[...previous,...value.documents]:value.documents);setCursor(value.cursor);setListed(true);setNotice('Private session list loaded.');}
 async function restore(id:string){
  if(!account.userId)return;
  const restored=await sync.restore(audio,id),workspace=readVoiceWorkspace(restored.workspace);
  validateVoiceWorkspaceAudio(workspace,restored.saved);
  const peers=voicePeers(workspace),baselines:Record<string,Record<string,string>>={};
  for(const peer of peers){const source=peer.draft.source,checked=await sourceSnapshot(source.cardNumber,source.revision,source.markdown,source.sections);if(checked.hash!==source.hash)throw Error('A linked card source hash does not match its original snapshot.');baselines[peer.draft.id]=await currentSectionTexts(peer.draft);}
  const [fresh,...linked]=remapLinkedVoiceReviews(workspace,restored.saved,baselines);
  acknowledgePrivateSync(account.userId,fresh.id,{remoteId:id,revision:restored.revision});
  setCandidate({draft:fresh,linked,saved:restored.saved,workspace,resume:safeResume(restored.resume,fresh,restored.saved),choices:workingSyncChoices(peers.flatMap(peer=>peer.working),await working.list())});
  setNotice('A separate review copy is ready to open. Your current writing is unchanged.');
 }
 async function persistCandidate(withTitles:boolean):Promise<Candidate>{
  if(!candidate)throw Error('Choose a saved copy first.');
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
  window.dispatchEvent(new Event('oracle:passage-applied'));setNotice('Synced writing saved. The earlier local version remains in history.');
 }
 async function openReview(){const next=await persistCandidate(true);onRestored(next.draft,next.saved,next.resume);setCandidate(null);}
 if(!account.isSignedIn)return <section className="voice-sync-tools" aria-label="Private continuity"><h2>Private continuity</h2><p>Keep your audio, writing, titles and place across your devices.</p><a href="/account">Sign in to sync</a><p>Your local work stays on this device.</p></section>;
 return <section className="voice-sync-tools" aria-label="Private continuity"><h2>Private continuity</h2><p>Audio, draft history references, titles, private writing and your place travel with this session.</p>
  <div className="voice-sync-actions"><button disabled={busy||draft.state==='recording'||!draft.captureSessionId} onClick={()=>void perform(save)}>Sync now</button><button disabled={busy} onClick={()=>void perform(()=>list())}>Load saved sessions</button></div>
  <label className="voice-sync-opt"><input type="checkbox" checked={automatic} onChange={e=>{const enabled=e.target.checked;setAutomatic(enabled);localStorage.setItem(optKey,String(enabled));}}/>Automatically save changes to my private account</label>
  <p className="voice-sync-note">Automatic saves wait until recording stops. Conflicts keep both versions for your review.</p>
  {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
  {listed&&<div className="voice-sync-sessions"><h3>Saved sessions</h3>{remote.length?remote.map(item=><div className="voice-sync-session" key={item.id}><span>{new Date(item.updatedAt).toLocaleString()}</span><button disabled={busy} onClick={()=>void perform(()=>restore(item.id))}>Compare saved copy</button></div>):<p>No private Voice sessions are saved yet.</p>}{cursor&&<button disabled={busy} onClick={()=>void perform(()=>list(true))}>Load more sessions</button>}</div>}
  {candidate&&<div className="voice-sync-candidate"><h3>Card {candidate.draft.cardNumber}: choose what to keep</h3><p>Open a separate unchecked review, or explicitly replace a private reading below. Original audio, transcript and prior application receipts remain in the review copy.</p>{candidate.linked.length>0&&<p>Includes linked cards: {candidate.linked.map(peer=>peer.cardNumber).join(', ')}.</p>}{[candidate.draft,...candidate.linked].flatMap(peer=>Object.entries(peer.titleEdits??{}).map(([id,edit])=><p className="voice-sync-title" key={id}>Saved title: <strong>{edit.text}</strong>{draft.titleEdits?.[id]?.text&&draft.titleEdits[id].text!==edit.text?` · This device: ${draft.titleEdits[id].text}`:''}</p>))}<button disabled={busy} onClick={()=>void perform(openReview)}>Open review copy{[candidate.draft,...candidate.linked].some(peer=>Object.keys(peer.titleEdits??{}).length)?' with synced titles':''}</button>
   {candidate.choices.map(choice=><section className="voice-sync-comparison" key={choice.remote.key}><h4>Card {choice.remote.cardNumber} · {choice.remote.sectionId}</h4>{choice.different?<><div className="voice-sync-texts"><div><strong>This device</strong><p>{choice.local?.text||'No private writing saved.'}</p></div><div><strong>Synced writing</strong><p>{choice.remote.text}</p></div></div><button disabled={busy} onClick={()=>void perform(()=>useWriting(choice))}>Use synced writing for {choice.remote.sectionId}</button></>:<p>Private writing matches this device.</p>}</section>)}
  </div>}
 </section>;
}
