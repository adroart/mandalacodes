import React from 'react';
import {Mic} from 'lucide-react';
import {time} from './format';
import {HEALTH_COPY} from './useRecordingHealth';
import type {VoiceStudio} from './types';
import './dock.css';

export type DockProps=Pick<VoiceStudio,
 'active'|'stopping'|'opening'|'monitor'|'recordingNode'|'phraseCapture'|'captureFocus'|'upcoming'|'continuous'|
 'togglePause'|'stop'|'pathFor'|'scopeFor'|'queued'|'target'|'shownTitle'|'spanLabel'|'paragraphAim'|'waiting'|
 'reviewArrival'|'explicitChoice'|'openView'|'reviewAt'|'results'|'record'|'health'|'nodes'|'passageOperation'|'paragraphAim'|'wholeSection'|'passageCapture'|'draft'|'view'|'references'|'aimConflict'
>;

/**
 * The work screen's dock. While recording: the clock and level, where the words are going, the
 * next destination, and Pause or Resume, Stop & review and Send & next. At the end of the card or
 * while re-recording selected words there is no Send, and Stop & review is the main action.
 * Otherwise: where Record will aim, Review, and Record.
 */
export default function Dock({active,stopping,opening,monitor,recordingNode,phraseCapture,captureFocus,upcoming,continuous,togglePause,stop,pathFor,scopeFor,queued,target,shownTitle,spanLabel,paragraphAim,waiting,reviewArrival,explicitChoice,openView,reviewAt,results,record,health,nodes,passageOperation,wholeSection,passageCapture,draft,view,references,aimConflict}:DockProps){
 const interrupted=!stopping&&health.microphone==='interrupted';
 // A title shared by several sections (several are called "Reading") is shown with its full path.
 const idleName=target?(nodes.filter(n=>shownTitle(n)===shownTitle(target)).length>1?pathFor(target):shownTitle(target)):'Opening…';
 const compactName=target&&paragraphAim?.sectionId===target.id?shownTitle(target):idleName;
 const ready=results.filter(r=>!r.applied).length,unplaced=draft?.unassigned.length??0;
 // A chosen passage is held back only by an edit of the same words; other passages of its section can wait their turn.
 const aimedPassage=!!target&&paragraphAim?.sectionId===target.id;
 // With nothing chosen the dock stays free, so the next passage can be tapped while earlier ones are prepared.
 const pending=!!target&&(aimedPassage?!!aimConflict&&results.some(r=>r.sectionId===target.id&&!r.applied):wholeSection&&results.some(r=>r.sectionId===target.id&&!r.applied));
 const preparing=!!target&&(aimedPassage?!!aimConflict&&!pending:wholeSection&&queued.some(t=>t.startSectionId===target.id));
 const stale=!!target&&!!paragraphAim&&paragraphAim.sectionId===target.id&&(references[target.id]??target.text).slice(paragraphAim.start,paragraphAim.end)!==paragraphAim.text;
 const reviewCount=[ready?`${ready} ${ready===1?'edit':'edits'}`:'',unplaced?`${unplaced} unplaced`:''].filter(Boolean).join(' · ');
 return <footer className={`vs-dock${active?'':' vs-dock--idle'}${view==='passage'?' vs-dock--passage':''}${view==='work'&&paragraphAim?' vs-dock--aimed':''}${pending||preparing?' vs-dock--blocked':''}`} data-recording={!!active||undefined}>
  {active?<>
   <div className="vs-recording-status" data-health={interrupted?'interrupted':undefined}>
    <span className="vs-dot" data-paused={monitor.paused||interrupted||undefined}/>
    {/* Two sentences, two lines: a 390 px phone never leaves one word on a line of its own. */}
    <span>{stopping?'Saving recording…':interrupted?HEALTH_COPY.interrupted.split(/(?<=\.) /).map(line=><span key={line} className="vs-dock-health-line">{line} </span>):`${monitor.paused?'Paused':'Recording'} · ${time(monitor.elapsed)}`}</span>
    {!stopping&&!monitor.paused&&health.microphone==='changed'&&<span className="vs-dock-health">{HEALTH_COPY.changed}</span>}
    {interrupted?null:health.meterUnavailable
     ?<span className="vs-level-note">{HEALTH_COPY.meter}</span>
     :<span className="vs-level" aria-hidden="true" style={{'--level':monitor.paused?0:monitor.level??0} as React.CSSProperties}/>}
   </div>
   <div className="vs-dock-target" aria-live="polite">
    <strong>{passageCapture.current?`Card ${recordingNode.cardNumber} · `:''}{pathFor(recordingNode)}</strong>
    <span>{passageCapture.current?`${passageCapture.current.operation==='add'?'Add after':'Replace'} · ${scopeFor(recordingNode,passageCapture.current.focus)}`:phraseCapture.current?'Selected words':scopeFor(recordingNode,captureFocus.current)}</span>
   </div>
   {upcoming&&<p className="vs-recording-next">{continuous?'Next, recording continues':'Next'} · {pathFor(upcoming)}</p>}
   {health.listening&&<p className="vs-dock-listening">{health.listening}</p>}
   <div className="vs-recording-actions">
    <button className="vs-btn" disabled={stopping} onClick={togglePause}>{monitor.paused?'Resume':'Pause'}</button>
    <button className={`vs-btn${upcoming||passageCapture.current?'':' vs-btn--primary'}`} disabled={stopping} onClick={()=>stop('review')}>Stop &amp; review</button>
    {passageCapture.current&&<button className="vs-btn vs-btn--primary" disabled={stopping} onClick={()=>stop('save')}>Next passage</button>}
    {upcoming&&<button className="vs-btn vs-btn--primary" disabled={stopping} aria-label={`Send this recording and ${continuous?'keep recording in':'go to'} ${pathFor(upcoming)}`} onClick={()=>stop('next')}>Send &amp; next</button>}
   </div>
   <span className="vs-dock-announce" role="status" aria-live="polite">{health.announcement}</span>
  </>:preparing?<span className="vs-dock-preparing" role="status">Preparing saved recording…</span>
   :pending?<button className="vs-record" onClick={()=>reviewAt(target!.id)}>Review saved words</button>
   :<>
    {view==='work'&&<div className="vs-dock-target">
     {wholeSection&&!paragraphAim&&<small>Whole section recording{queued.length?<span> · {queued.length} processing</span>:null}</small>}
     <strong>{target&&(paragraphAim||wholeSection)?compactName:'Tap a passage to edit'}<span className="vs-span">{target&&(paragraphAim||wholeSection)?spanLabel(target,paragraphAim?.sectionId===target.id?paragraphAim:undefined):''}</span></strong>
    </div>}
    {waiting>0&&view==='work'&&<button className="vs-btn vs-dock-review" aria-label={`${ready?'Review':'Place'} ${waiting}: ${reviewCount}`} onClick={()=>{reviewArrival.current=true;explicitChoice.current=false;openView(ready?'review':'unplaced');}}>{ready?'Review':'Place'} {waiting}</button>}
    {view==='work'&&paragraphAim?<button className="vs-record" onClick={()=>openView('passage')}>Edit passage</button>
    :view==='passage'&&paragraphAim?<div className="vs-dock-choice" role="group" aria-label="Record for this passage">
     {/* One tap chooses what the words do and starts the microphone. */}
     <button type="button" className="vs-btn vs-dock-choice-add" aria-pressed={passageOperation==='add'} disabled={opening||stopping||stale} onClick={()=>void record(null,target?.id,undefined,false,'add')}><Mic size={16} aria-hidden="true"/>Add after</button>
     <button type="button" className="vs-record" aria-pressed={passageOperation==='replace'} disabled={opening||stopping||stale} onClick={()=>void record(null,target?.id,undefined,false,'replace')}><Mic size={17} aria-hidden="true"/>{opening?'Opening microphone…':stale?'Choose passage again':'Replace'}</button>
    </div>
    :<button className="vs-record" disabled={opening||stopping||stale||!target||!wholeSection&&!passageOperation} onClick={()=>void record(null,target?.id)}>{opening?'Opening microphone…':stale?'Choose passage again':passageOperation==='add'?'Record addition':passageOperation==='replace'?'Record replacement':'Record'}</button>}
   </>}
 </footer>;
}
