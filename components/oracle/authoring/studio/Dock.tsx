import React from 'react';
import {time} from './format';
import type {VoiceStudio} from './types';

export type DockProps=Pick<VoiceStudio,
 'active'|'stopping'|'opening'|'monitor'|'recordingNode'|'phraseCapture'|'captureFocus'|'upcoming'|'continuous'|
 'togglePause'|'stop'|'pathFor'|'scopeFor'|'queued'|'target'|'shownTitle'|'spanLabel'|'paragraphAim'|'waiting'|
 'reviewArrival'|'explicitChoice'|'openView'|'results'|'record'
>;

/**
 * The work screen's dock. While recording: the clock and level, where the words are going, and
 * Pause or Resume, Done and Next. Otherwise: where Record will aim, Review, and Record.
 */
export default function Dock({active,stopping,opening,monitor,recordingNode,phraseCapture,captureFocus,upcoming,continuous,togglePause,stop,pathFor,scopeFor,queued,target,shownTitle,spanLabel,paragraphAim,waiting,reviewArrival,explicitChoice,openView,results,record}:DockProps){
 return <footer className="vs-dock" data-recording={!!active||undefined}>
  {active?<>
   <div className="vs-recording-status">
    <span className="vs-dot" data-paused={monitor.paused||undefined}/>
    <span>{stopping?'Saving recording…':monitor.paused?'Paused':'Recording'} · {time(monitor.elapsed)}</span>
    <span className="vs-level" aria-hidden="true" style={{'--level':monitor.paused?0:monitor.level??0} as React.CSSProperties}/>
   </div>
   <div className="vs-dock-target" aria-live="polite">
    <strong>{pathFor(recordingNode)}</strong>
    <span>{phraseCapture.current?'Selected words':scopeFor(recordingNode,captureFocus.current)}</span>
   </div>
   {upcoming&&<p className="vs-recording-next">{continuous?'Next, recording continues':'Next'} · {pathFor(upcoming)}</p>}
   <div className="vs-recording-actions">
    <button className="vs-btn" disabled={stopping} onClick={togglePause}>{monitor.paused?'Resume':'Pause'}</button>
    <button className={`vs-btn${upcoming?'':' vs-btn--primary'}`} disabled={stopping} onClick={()=>stop('review')}>Done</button>
    {upcoming&&<button className="vs-btn vs-btn--primary" disabled={stopping} aria-label={`Send this recording and ${continuous?'keep recording in':'go to'} ${pathFor(upcoming)}`} onClick={()=>stop('next')}>Next</button>}
   </div>
  </>:<>
   <div className="vs-dock-target">
    <small>Record over{queued.length?<span> · {queued.length} processing</span>:null}</small>
    <strong>{target?shownTitle(target):'Opening…'}<span className="vs-span">{target?spanLabel(target,paragraphAim?.sectionId===target.id?paragraphAim:undefined):''}</span></strong>
   </div>
   {waiting>0&&<button className="vs-btn" onClick={()=>{reviewArrival.current=true;explicitChoice.current=false;openView(results.some(r=>!r.applied)?'review':'unplaced');}}>Review {waiting}</button>}
   <button className="vs-record" disabled={opening||stopping||!target} onClick={()=>void record(null,target?.id)}>{opening?'Opening microphone…':'Record'}</button>
  </>}
 </footer>;
}
