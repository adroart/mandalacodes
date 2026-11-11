import {ChevronRight,Mic} from 'lucide-react';
import {readingParagraphs} from '../../../../lib/oracle/authoring/passageComparison';
import {plural} from './format';
import type {VoiceStudio} from './types';

export type ManuscriptProps=Pick<VoiceStudio,
 'active'|'opening'|'monitor'|'phraseCapture'|'manuscript'|'initialAnchors'|'nodes'|'chip'|'recordingTarget'|'targetId'|
 'captureFocus'|'paragraphAim'|'shownTitle'|'references'|'aim'|'aimParagraph'|'reviewAt'|'openApplied'|'report'|
 'draft'|'openView'
>;

/**
 * The work screen: the scrolling card with its section headings and paragraphs, or, while a selected
 * phrase is being recorded, the prompt with those words. Tapping a heading or a paragraph aims the
 * next recording there.
 */
export default function Manuscript({active,opening,monitor,phraseCapture,manuscript,initialAnchors,nodes,chip,recordingTarget,targetId,captureFocus,paragraphAim,shownTitle,references,aim,aimParagraph,reviewAt,openApplied,report,draft,openView}:ManuscriptProps){
 if(active&&phraseCapture.current)return <section className="vs-prompt" aria-label="Selected phrase recording">
  <small>Say these words again</small>
  <p>{phraseCapture.current.text}</p>
  <span>Everything around them stays as it is.</span>
 </section>;
 return <div ref={manuscript} className="vs-stage vs-manuscript" aria-label="Card manuscript">
  {!!initialAnchors?.length&&<p className="vs-lead">Your selected {initialAnchors.length>1?'passages':'passage'}. Only these words are replaced.</p>}
  {nodes.map((node,i)=>{
   const state=chip(node),aimed=(active?recordingTarget.current:targetId)===node.id;
   return <section key={node.id} className="vs-section" data-paragraph-aim={(active?!!captureFocus.current&&recordingTarget.current===node.id:paragraphAim?.sectionId===node.id)||undefined} data-section-id={node.id} aria-label={node.path.join(' · ')} aria-current={aimed?'step':undefined} data-recording={active&&!monitor.paused&&recordingTarget.current===node.id||undefined}>
    {node.lensId!==nodes[i-1]?.lensId&&node.path.length>1&&<p className="vs-lens">{node.path[0]}</p>}
    <button className="vs-section-head" aria-pressed={aimed} aria-label={`${shownTitle(node)}${aimed?', recording destination':', make this the recording destination'}`} disabled={!!active||opening} onClick={()=>aim(node.id)}>
     <span className="vs-aim" aria-hidden="true"><Mic size={14}/></span>
     <span className="vs-section-title">{shownTitle(node)}</span>
     {state&&<span className="vs-chip" data-tone={state.tone}>{state.label}</span>}
    </button>
    {(()=>{
     const text=references[node.id]??node.text,paragraphs=readingParagraphs(text),focus=(active?captureFocus.current&&recordingTarget.current===node.id?captureFocus.current:undefined:paragraphAim?.sectionId===node.id?paragraphAim:undefined);
     if(paragraphs.length<2)return <div className="vs-section-text">{text}</div>;
     return <div className="vs-section-text vs-section-text--paragraphs">
      {paragraphs.map((p,i)=>{
       const on=!!focus&&focus.start===p.start&&focus.text===p.text;
       return <p key={p.start} className="vs-para" data-aimed={on||undefined} role="button" tabIndex={active||opening?-1:0} aria-pressed={on} aria-disabled={!!active||opening||undefined} aria-label={`Paragraph ${i+1}${on?', recording destination':', record over only this paragraph'}`} onClick={()=>{if(!active&&!opening)aimParagraph(node.id,p);}} onKeyDown={e=>{if((e.key==='Enter'||e.key===' ')&&!active&&!opening){e.preventDefault();aimParagraph(node.id,p);}}}>
        {on&&<span className="vs-para-tag">{active?'Recording over this paragraph':'Only this paragraph will change'}</span>}
        {p.text}
       </p>;
      })}
     </div>;
    })()}
    {(state?.tone==='ready'||state?.tone==='check')&&<button className="vs-link" onClick={()=>reviewAt(node.id)}>Review your words<ChevronRight size={15}/></button>}
    {state?.tone==='human'&&<button className="vs-link vs-link--quiet" onClick={()=>void openApplied(node.id).catch(report)}>See what changed<ChevronRight size={15}/></button>}
   </section>;
  })}
  {!!draft?.unassigned.length&&<button className="vs-link vs-link--block" onClick={()=>openView('unplaced')}>{plural(draft.unassigned.length,'passage')} not placed yet<ChevronRight size={15}/></button>}
 </div>;
}
