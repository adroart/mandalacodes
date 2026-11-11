import {CARD_BY_NUMBER} from '../../../../data/oracleData';
import type {View,VoiceStudio} from './types';

export type StudioBarProps=Pick<VoiceStudio,
 'view'|'locked'|'close'|'openView'|'pickerReturn'|'setPlacing'|'source'|'result'|'position'|'reviewList'|'queued'|
 'savedCaptures'|'results'|'active'|'integrating'|'step'|'progressText'|'authorship'|'authorshipFailed'|'screenTitle'
>;

/** The bar across the top of every screen: Close or Back, the screen's title, and its own buttons. The title (`data-screen-title`) takes focus when the screen changes. */
export default function StudioBar({view,locked,close,openView,pickerReturn,setPlacing,source,result,position,reviewList,queued,savedCaptures,results,active,integrating,step,progressText,authorship,authorshipFailed,screenTitle}:StudioBarProps){
 const back=(to:View)=><button className="vs-icon" aria-label="Back" onClick={()=>openView(to)}>Back</button>;
 return <header className="vs-bar" data-card-header={view==='work'||undefined}>
  {view==='work'
   ?<button className="vs-icon" aria-label="Close recording" disabled={locked} onClick={()=>void close()}><span>Close</span></button>
   :view==='review'
    ?back('work')
    :back(view==='audio'||view==='sessions'?'settings':view==='settings'?'work':view==='sections'?pickerReturn.current:view==='unplaced'&&!results.length?'work':'review')}
  {view==='work'&&<div className="vs-bar-title" tabIndex={-1} data-screen-title><strong>Code {source.cardNumber} · {CARD_BY_NUMBER.get(source.cardNumber)?.card_name??'Oracle'}</strong></div>}
  {view==='review'&&<button className="vs-bar-title vs-bar-title--button" data-screen-title aria-label="Choose a section to review" onClick={()=>{pickerReturn.current='review';setPlacing(null);openView('sections');}}>
   <strong>{result?.applied?'Applied':'Review'}</strong>
   <small>{position>=0?`${position+1} of ${reviewList.length}`:queued.length?'Processing':savedCaptures.length?'Transcript pending':'Nothing to review yet'}</small>
  </button>}
  {view!=='work'&&view!=='review'&&<div className="vs-bar-title" tabIndex={-1} data-screen-title><strong>{screenTitle[view]}</strong></div>}
  <div className="vs-bar-end">
   {view==='work'&&<>
    <button className="vs-icon vs-only-narrow" aria-label="Sections" onClick={()=>{pickerReturn.current='work';setPlacing(null);openView('sections');}}><span>Sections</span></button>
    <button className="vs-icon" aria-label="Recording settings" disabled={!!active} onClick={()=>openView('settings')}><span>Settings</span></button>
   </>}
   {view==='review'&&<>
    <button className="vs-icon" aria-label="Previous section" disabled={position<=0||integrating} onClick={()=>step(-1)}><span>Previous</span></button>
    <button className="vs-icon" aria-label="Next section" disabled={position<0||position>=reviewList.length-1||integrating} onClick={()=>step(1)}><span>Next</span></button>
   </>}
  </div>
  {view==='work'&&<div className="vs-card-progress" aria-label="Card authorship">
   <span>{progressText}</span>
   {authorship&&!authorshipFailed&&authorship.total>0&&<div className="vs-authorship-track" role="progressbar" aria-label="Sections entirely in your words" aria-valuemin={0} aria-valuemax={authorship.total} aria-valuenow={authorship.human} aria-valuetext={progressText}><i style={{width:`${authorship.human/authorship.total*100}%`}}/></div>}
  </div>}
 </header>;
}
