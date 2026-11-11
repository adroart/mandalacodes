import {ChevronRight} from 'lucide-react';
import {displaySectionTitle} from '../../../../lib/oracle/authoring/cardSections';
import type {SectionDraftResult,SectionDraftSession} from '../../../../lib/oracle/authoring/sectionDrafts';
import {BridgeConnection} from '../../../../src/mobile/authoring/MacBridgeConnection';
import {queueSectionTake,restoreSectionTake} from '../../../../src/mobile/authoring/sectionTakes';
import {restoreDocumentedCleanup} from '../../../../src/mobile/authoring/speechCleanupReview';
import CaptureShelf from '../CaptureShelf';
import VoiceSyncTools from '../VoiceSyncTools';
import SectionIndex,{type SectionIndexProps} from './SectionIndex';
import {plural} from './format';
import type {VoiceStudio} from './types';

export type SectionsPickerProps=Omit<SectionIndexProps,'onPick'|'mode'>&Pick<VoiceStudio,
 'placing'|'draft'|'place'|'pickerReturn'|'results'|'reviewAt'|'setView'|'aim'
>;

/** The Sections screen: jump to a section, or choose where unplaced words go. */
export function SectionsPicker(props:SectionsPickerProps){
 const {placing,draft,place,pickerReturn,results,reviewAt,setView,aim}=props;
 return <div className="vs-stage vs-screen">
  {placing!==null&&draft?.unassigned[placing]&&<blockquote className="vs-quote">{draft.unassigned[placing].text}</blockquote>}
  <SectionIndex {...props} onPick={node=>{if(placing!==null)void place(placing,node.id);else if(pickerReturn.current==='review'&&results.some(r=>r.sectionId===node.id)){reviewAt(node.id);}else{setView('work');aim(node.id,true);}}} mode="screen"/>
 </div>;
}

export type UnplacedScreenProps=Pick<VoiceStudio,'setPlacing'|'pickerReturn'|'setView'>&{draft:SectionDraftSession};

/** Words from a recording that did not clearly belong to a section. */
export function UnplacedScreen({draft,setPlacing,pickerReturn,setView}:UnplacedScreenProps){
 return <section className="vs-stage vs-screen" aria-label="Unplaced words">
  <p className="vs-lead">These words are saved, but they did not clearly belong to a section. Choose where each one goes. You will compare it before anything changes.</p>
  {draft.unassigned.map((u,i)=><section className="vs-unplaced" key={`${i}/${u.text}`}>
   <blockquote className="vs-quote">{u.text}</blockquote>
   {u.reason&&<small>{u.reason}</small>}
   <button className="vs-btn" onClick={()=>{setPlacing(i);pickerReturn.current='unplaced';setView('sections');}}>Choose a section<ChevronRight size={15}/></button>
  </section>)}
  {!draft.unassigned.length&&<p className="vs-lead">Everything is placed.</p>}
 </section>;
}

export type CleanupScreenProps=Pick<VoiceStudio,'section'|'shownTitle'|'integrating'|'patch'|'report'>&{result:SectionDraftResult};

/** The tidied stumbles and repeated starts of one section, each with Keep what I said. */
export function CleanupScreen({result,section,shownTitle,integrating,patch,report}:CleanupScreenProps){
 return <section className="vs-stage vs-screen" aria-label="Speech cleanup review">
  <p className="vs-lead">Stumbles and repeated starts were tidied in {shownTitle(section!)}. Your recording and every original word are kept.</p>
  {result.changes.map((change,i)=><section className="vs-row" key={i}>
   <div>
    <p><del>{change.before}</del>{change.after&&<> → {change.after}</>}</p>
    <small>{change.reason}</small>
   </div>
   <button className="vs-btn" disabled={integrating||!!result.applied} onClick={()=>void patch(s=>({...s,results:s.results.map(r=>r.sectionId===section?.id?restoreDocumentedCleanup(r,i):r)})).catch(report)}>Keep what I said</button>
  </section>)}
  <h3>What you said</h3>
  <pre className="vs-pre">{result.evidenceQuotes.join('\n\n')}</pre>
 </section>;
}

export type SettingsScreenProps=Pick<VoiceStudio,
 'view'|'continuous'|'setContinuous'|'handle'|'voiceCommands'|'setVoiceCommands'|'routingStatus'|'intent'|'setIntent'|
 'active'|'readyClean'|'integrating'|'integrate'|'openView'|'draft'|'savedAudio'|'focusId'|'player'|'source'|'onClose'|
 'onNavigateCard'|'accept'|'setSavedAudio'|'setFocusId'|'resumePlayback'|'setView'
>;

/**
 * Recording settings. Unlike every other screen it stays mounted and is only hidden, so the sync
 * tools inside keep their state.
 */
export function SettingsScreen({view,continuous,setContinuous,handle,voiceCommands,setVoiceCommands,routingStatus,intent,setIntent,active,readyClean,integrating,integrate,openView,draft,savedAudio,focusId,player,source,onClose,onNavigateCard,accept,setSavedAudio,setFocusId,resumePlayback,setView}:SettingsScreenProps){
 return <section className="vs-stage vs-screen" aria-label="Recording settings" hidden={view!=='settings'}>
  <h3>While recording</h3>
  <label className="vs-switch">
   <span><strong>Keep recording after Next</strong><small>Sends this section and keeps the microphone on for the next one.</small></span>
   <input type="checkbox" role="switch" checked={continuous} onChange={e=>{setContinuous(e.target.checked);handle.current?.setContinuous(e.target.checked);localStorage.setItem('oracle.voice.continuous',String(e.target.checked));}}/>
  </label>
  <label className="vs-switch">
   <span><strong>Move when I say a section’s name</strong><small>{routingStatus==='unsupported'?'Not available on this device. The Next button always works.':'Uses your browser’s speech service where available. The Next button always works.'}</small></span>
   <input type="checkbox" role="switch" checked={voiceCommands} disabled={!!active} onChange={e=>{setVoiceCommands(e.target.checked);localStorage.setItem('oracle.voice.commands',String(e.target.checked));}}/>
  </label>
  <fieldset className="vs-choice">
   <legend><strong>When a section already has my words</strong></legend>
   {([['auto','Decide from what I say'],['replace','Replace them'],['add','Add after them']] as const).map(([value,label])=><label key={value}><input type="radio" name="vs-intent" value={value} checked={intent===value||intent==='revise'&&value==='auto'} disabled={!!active} onChange={()=>setIntent(value)}/>{label}</label>)}
  </fieldset>
  {readyClean.length>1&&<>
   <h3>Review</h3>
   <div className="vs-row">
    <div><p>{plural(readyClean.length,'section')} checked and ready</p><small>Each is saved to your reading with its recording, and each can be undone.</small></div>
    <button className="vs-btn" disabled={integrating} onClick={()=>void integrate(true)}>Use all {readyClean.length}</button>
   </div>
  </>}
  <h3>Files</h3>
  <button className="vs-row vs-row--nav" onClick={()=>openView('audio')}><div><p>Recordings and transcript</p><small>Listen, add an audio file, discard or restore a take</small></div><ChevronRight size={18}/></button>
  <button className="vs-row vs-row--nav" onClick={()=>openView('sessions')}><div><p>Sessions</p><small>Earlier sessions for this card and the Mac connection</small></div><ChevronRight size={18}/></button>
  <div className="vs-sync">{draft&&<VoiceSyncTools draft={draft} savedAudio={savedAudio} resume={{sectionId:focusId,mode:view,positionMs:(player.current?.currentTime??0)*1000}} onRestored={(value,saved,resume)=>{if(value.cardNumber!==source.cardNumber){onClose();onNavigateCard?.(value.cardNumber,value.id);return;}accept(value);setSavedAudio(saved);setFocusId(resume?.sectionId??value.startSectionId);if(resume?.captureId)resumePlayback.current={captureId:resume.captureId,positionMs:resume.positionMs};setView(resume?.mode==='work'?'work':'review');}}/>}</div>
 </section>;
}

export type AudioScreenProps=Pick<VoiceStudio,
 'savedAudio'|'discarded'|'discard'|'active'|'processing'|'opening'|'integrating'|'clipBounds'|'setReplay'|'playCapture'|
 'report'|'draft'|'accept'|'takes'|'targetId'|'services'|'addAudio'|'nodes'|'prepare'
>;

/** Recordings and transcript: every take, discard and restore, the original transcript. */
export function AudioScreen({savedAudio,discarded,discard,active,processing,opening,integrating,clipBounds,setReplay,playCapture,report,draft,accept,takes,targetId,services,addAudio,nodes,prepare}:AudioScreenProps){
 return <section className="vs-stage vs-screen" aria-label="Audio and transcript">
  {savedAudio&&<CaptureShelf expanded session={{...savedAudio.session,captures:savedAudio.session.captures.filter(c=>!discarded.has(c.id))}} onDiscard={discard} disabled={!!active||processing||opening||integrating} onListen={id=>{clipBounds.current=null;setReplay(null);void playCapture(id).catch(report);}} onTranscribe={async(id)=>{if(draft)accept(await queueSectionTake(draft.id,id,takes.find(t=>t.captureId===id)?.startSectionId??targetId,services));}} onImport={addAudio}/>}
  {takes.filter(t=>t.state==='failed'||t.state==='discarded').map(t=><section className="vs-row" key={t.id}>
   <div><p>{displaySectionTitle(nodes.find(n=>n.id===t.startSectionId)?.title??'')}</p><small>{t.state==='discarded'?'Discarded recording':t.error}</small></div>
   <button className="vs-btn" onClick={()=>void (t.state==='discarded'?restoreSectionTake(draft!.id,t.captureId,services):queueSectionTake(draft!.id,t.captureId,t.startSectionId,services,t.markers)).then(accept).catch(report)}>{t.state==='discarded'?'Restore':'Try again'}</button>
  </section>)}
  {draft?.rawTranscript&&<><h3>Original transcript</h3><pre className="vs-pre">{draft.rawTranscript}</pre></>}
  {!takes.length&&draft?.captureSessionId&&!active&&!!savedAudio?.session.captures.length&&<button className="vs-btn" disabled={processing||draft.results.some(r=>r.applied)} onClick={()=>void prepare(draft.id)}>Prepare sections again</button>}
 </section>;
}

export type SessionsScreenProps=Pick<VoiceStudio,
 'active'|'processing'|'make'|'report'|'history'|'integrating'|'draft'|'flush'|'store'|'accept'|'setFocusId'|
 'setTargetId'|'setView'|'loadAudio'|'onEarlier'
>;

/** Sessions for this card, the earlier recorder, and the Mac connection. */
export function SessionsScreen({active,processing,make,report,history,integrating,draft,flush,store,accept,setFocusId,setTargetId,setView,loadAudio,onEarlier}:SessionsScreenProps){
 return <section className="vs-stage vs-screen" aria-label="Voice setup">
  <button className="vs-btn" disabled={!!active||processing} onClick={()=>void make().catch(report)}>Start a new session</button>
  {history.map(s=><button className="vs-row vs-row--nav" disabled={!!active||processing||integrating} key={s.id} aria-current={s.id===draft?.id?'true':undefined} onClick={()=>void(async()=>{await flush();const latest=await store.get(s.id);if(!latest)return;accept(latest);setFocusId(latest.results[0]?.sectionId??latest.startSectionId);setTargetId(latest.startSectionId);setView('work');await loadAudio(latest);})().catch(report)}>
   <div>
    <p>{new Date(s.createdAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</p>
    <small>{plural(s.results.length,'section')} · {s.results.filter(r=>r.applied).length} used{s.id===draft?.id?' · open now':''}</small>
   </div>
   <ChevronRight size={18}/>
  </button>)}
  <button className="vs-row vs-row--nav" disabled={!!active} onClick={onEarlier}><div><p>Earlier recordings and writing</p><small>The previous recorder, kept for older work</small></div><ChevronRight size={18}/></button>
  <BridgeConnection expanded/>
 </section>;
}
