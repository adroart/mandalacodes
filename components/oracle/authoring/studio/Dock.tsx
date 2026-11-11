import React from 'react';
import {time} from './format';
import {HEALTH_COPY} from './useRecordingHealth';
import type {VoiceStudio} from './types';
import './dock.css';

export type DockProps=Pick<VoiceStudio,
 'active'|'stopping'|'opening'|'monitor'|'recordingNode'|'phraseCapture'|'captureFocus'|'upcoming'|'continuous'|
 'togglePause'|'stop'|'pathFor'|'scopeFor'|'queued'|'target'|'shownTitle'|'spanLabel'|'paragraphAim'|'waiting'|
 'reviewArrival'|'explicitChoice'|'openView'|'results'|'record'|'health'|'nodes'
>;

/**
 * The work screen's dock. While recording: the clock and level, where the words are going, the
 * next destination, and Pause or Resume, Stop & review and Send & next. At the end of the card or
 * while re-recording selected words there is no Send, and Stop & review is the main action.
 * Otherwise: where Record will aim, Review, and Record.
 */
export default function Dock({active,stopping,opening,monitor,recordingNode,phraseCapture,captureFocus,upcoming,continuous,togglePause,stop,pathFor,scopeFor,queued,target,shownTitle,spanLabel,paragraphAim,waiting,reviewArrival,explicitChoice,openView,results,record,health,nodes}:DockProps){
 const interrupted=!stopping&&health.microphone==='interrupted';
 // A title shared by several sections (several are called "Reading") is shown with its full path.
 const idleName=target?(nodes.filter(n=>shownTitle(n)===shownTitle(target)).length>1?pathFor(target):shownTitle(target)):'Opening…';
 return <footer className="vs-dock" data-recording={!!active||undefined}>
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
    <strong>{pathFor(recordingNode)}</strong>
    <span>{phraseCapture.current?'Selected words':scopeFor(recordingNode,captureFocus.current)}</span>
   </div>
   {upcoming&&<p className="vs-recording-next">{continuous?'Next, recording continues':'Next'} · {pathFor(upcoming)}</p>}
   {health.listening&&<p className="vs-dock-listening">{health.listening}</p>}
   <div className="vs-recording-actions">
    <button className="vs-btn" disabled={stopping} onClick={togglePause}>{monitor.paused?'Resume':'Pause'}</button>
    <button className={`vs-btn${upcoming?'':' vs-btn--primary'}`} disabled={stopping} onClick={()=>stop('review')}>Stop &amp; review</button>
    {upcoming&&<button className="vs-btn vs-btn--primary" disabled={stopping} aria-label={`Send this recording and ${continuous?'keep recording in':'go to'} ${pathFor(upcoming)}`} onClick={()=>stop('next')}>Send &amp; next</button>}
   </div>
   <span className="vs-dock-announce" role="status" aria-live="polite">{health.announcement}</span>
  </>:<>
   <div className="vs-dock-target">
    <small>Record over{queued.length?<span> · {queued.length} processing</span>:null}</small>
    <strong>{idleName}<span className="vs-span">{target?spanLabel(target,paragraphAim?.sectionId===target.id?paragraphAim:undefined):''}</span></strong>
   </div>
   {waiting>0&&<button className="vs-btn" onClick={()=>{reviewArrival.current=true;explicitChoice.current=false;openView(results.some(r=>!r.applied)?'review':'unplaced');}}>Review {waiting}</button>}
   <button className="vs-record" disabled={opening||stopping||!target} onClick={()=>void record(null,target?.id)}>{opening?'Opening microphone…':'Record'}</button>
  </>}
 </footer>;
}
