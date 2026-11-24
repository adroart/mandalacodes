import {CARD_BY_NUMBER} from '../../../../data/oracleData';
import {ChevronLeft,ChevronRight} from 'lucide-react';
import type {View,VoiceStudio} from './types';

export type StudioBarProps=Pick<VoiceStudio,
 'view'|'locked'|'close'|'openView'|'pickerReturn'|'setPlacing'|'source'|'result'|'position'|'reviewList'|'queued'|
 'savedCaptures'|'results'|'active'|'integrating'|'step'|'progressText'|'authorship'|'authorshipFailed'|'screenTitle'|'pendingPassage'|'takes'|'section'|'pathFor'|'scopeFor'|'nodes'
>;

/** The bar across the top of every screen: Close or Back, the screen's title, and its own buttons. The title (`data-screen-title`) takes focus when the screen changes. */
export default function StudioBar({view,locked,close,openView,pickerReturn,setPlacing,source,result,position,reviewList,queued,savedCaptures,results,active,integrating,step,progressText,authorship,authorshipFailed,screenTitle,pendingPassage,takes,section,pathFor,scopeFor,nodes}:StudioBarProps){
 const back=(to:View)=><button className="vs-icon" aria-label="Back" onClick={()=>openView(to)}>Back</button>;
 const pendingNode=pendingPassage&&nodes.find(node=>node.id===pendingPassage.sectionId);
 const resultScope=result?.rangeSelection?'Selected words':result?.passageEdit&&section?scopeFor(section,result.passageEdit.focus):null;
 const passageDestination=pendingPassage&&pendingNode?`Card ${pendingNode.cardNumber} · ${pathFor(pendingNode)} · ${scopeFor(pendingNode,pendingPassage.focus)}`:resultScope&&section?`Card ${section.cardNumber} · ${pathFor(section)} · ${resultScope}`:null;
 const compactPath=(path:string)=>path.replace(/^Universal Language · /,'UL ').replace(/^Gene Keys · /,'GK ').replace(/^Human Design · /,'HD ').replace(/^I Ching · /,'I Ching ');
 const compactScope=(scope:string)=>scope.replace(/^Paragraph (\d+) of (\d+)$/,'para $1/$2').replace(/^Words in paragraph (\d+) of (\d+)$/,'words, para $1/$2');
 const passageShort=pendingPassage&&pendingNode?`Card ${pendingNode.cardNumber} · ${compactPath(pathFor(pendingNode))} · ${compactScope(scopeFor(pendingNode,pendingPassage.focus))}`:resultScope&&section?`Card ${section.cardNumber} · ${compactPath(pathFor(section))} · ${compactScope(resultScope)}`:null;
 const scopeSeparator=passageShort?.lastIndexOf(' · ')??-1;
 const passageOperation=pendingPassage?.operation??result?.passageEdit?.operation;
 let passageTitle:string|null=null;
 if(passageOperation){
  const name=passageOperation==='add'?'addition':'replacement';
  if(pendingPassage)passageTitle=takes.some(t=>t.captureId===pendingPassage.captureId&&t.state==='failed')?`${name} needs attention`:`Preparing ${name}`;
  else if(result?.applied)passageTitle=passageOperation==='add'?'Addition applied':'Replacement applied';
  else passageTitle='Review';
 }
 return <header className="vs-bar" data-card-header={view==='work'||undefined}>
  {view==='work'
   ?<button className="vs-icon" aria-label="Close recording" disabled={locked} onClick={()=>void close()}><span>Close</span></button>
   :view==='review'
    ?back('work')
    :back(view==='passage'?'work':view==='audio'||view==='sessions'?'settings':view==='settings'?'work':view==='sections'?pickerReturn.current:view==='unplaced'&&!results.length?'work':'review')}
  {view==='work'&&<div className="vs-bar-title" tabIndex={-1} data-screen-title><strong>Code {source.cardNumber} · {CARD_BY_NUMBER.get(source.cardNumber)?.card_name??'Oracle'}</strong></div>}
  {view==='review'&&<button className={`vs-bar-title vs-bar-title--button${passageDestination?' vs-bar-title--passage':''}`} data-screen-title aria-label={passageTitle&&passageDestination?`${passageTitle}. ${passageDestination}. Choose a section to review`:'Choose a section to review'} onClick={()=>{pickerReturn.current='review';setPlacing(null);openView('sections');}}>
   <strong>{passageTitle??(pendingPassage?takes.some(t=>t.captureId===pendingPassage.captureId&&t.state==='failed')?'Needs attention':'Preparing review':result?.applied?'Applied':'Review')}</strong>
   <small>{passageShort&&scopeSeparator>=0?<><span className="vs-review-path">{passageShort.slice(0,scopeSeparator)}</span><span>{passageShort.slice(scopeSeparator)}</span></>:passageShort??(pendingPassage?'Saved recording':position>=0?`${position+1} of ${reviewList.length}`:queued.length?'Processing':savedCaptures.length?'Transcript pending':'Nothing to review yet')}</small>
  </button>}
  {view!=='work'&&view!=='review'&&<div className="vs-bar-title" tabIndex={-1} data-screen-title><strong>{screenTitle[view]}</strong></div>}
  <div className="vs-bar-end">
   {view==='work'&&<>
    <button className="vs-icon vs-only-narrow" aria-label="Sections" onClick={()=>{pickerReturn.current='work';setPlacing(null);openView('sections');}}><span>Sections</span></button>
    <button className="vs-icon" aria-label="Recording settings" disabled={!!active} onClick={()=>openView('settings')}><span>Settings</span></button>
   </>}
   {view==='review'&&reviewList.length>1&&(!passageDestination||!pendingPassage)&&<>
    {(!passageDestination||position>0)&&<button className="vs-icon" aria-label="Previous section" disabled={position<=0||integrating} onClick={()=>step(-1)}>{passageDestination?<ChevronLeft size={18}/>:<span>Previous</span>}</button>}
    {(!passageDestination||position<reviewList.length-1)&&<button className="vs-icon" aria-label="Next section" disabled={position<0||position>=reviewList.length-1||integrating} onClick={()=>step(1)}>{passageDestination?<ChevronRight size={18}/>:<span>Next</span>}</button>}
   </>}
  </div>
  {view==='work'&&<div className="vs-card-progress" aria-label="Card authorship">
   <span>{progressText}</span>
   {authorship&&!authorshipFailed&&authorship.total>0&&<div className="vs-authorship-track" role="progressbar" aria-label="Sections entirely in your words" aria-valuemin={0} aria-valuemax={authorship.total} aria-valuenow={authorship.human} aria-valuetext={progressText}><i style={{width:`${authorship.human/authorship.total*100}%`}}/></div>}
  </div>}
 </header>;
}
