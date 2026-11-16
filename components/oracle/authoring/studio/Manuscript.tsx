import {useState} from 'react';
import {ChevronRight,Mic} from 'lucide-react';
import {readingParagraphs} from '../../../../lib/oracle/authoring/passageComparison';
import {plural} from './format';
import type {VoiceStudio} from './types';

export type ManuscriptProps=Pick<VoiceStudio,
 'active'|'opening'|'monitor'|'phraseCapture'|'manuscript'|'initialAnchors'|'nodes'|'chip'|'recordingTarget'|'targetId'|
 'captureFocus'|'paragraphAim'|'shownTitle'|'references'|'aim'|'aimParagraph'|'reviewAt'|'openApplied'|'report'|
 'draft'|'openView'|'health'|'selectionParagraph'
>;

/** The first few words of a paragraph, for its accessible name while it can be chosen. */
const opening=(text:string)=>{const words=text.trim().split(/\s+/);return words.slice(0,6).join(' ')+(words.length>6?'…':'');};

/**
 * The work screen: the scrolling card with its section headings and paragraphs, or, while a selected
 * phrase is being recorded, the prompt with those words. Tapping a heading aims the next recording at
 * that whole section. Paragraph text is only ever read: in the aimed section alone, "Record one
 * paragraph only" makes its paragraphs choosable, and choosing one aims at it.
 */
export default function Manuscript({active,opening:starting,monitor,phraseCapture,manuscript,initialAnchors,nodes,chip,recordingTarget,targetId,captureFocus,paragraphAim,shownTitle,references,aim,aimParagraph,reviewAt,openApplied,report,draft,openView,health,selectionParagraph}:ManuscriptProps){
 /** The section whose paragraphs are being offered for choosing, if any. */
 const [choosing,setChoosing]=useState<string|null>(null);
 if(active&&phraseCapture.current)return <section className="vs-prompt" aria-label="Selected phrase recording">
  <small>Say these words again</small>
  <p>{phraseCapture.current.text}</p>
  <span>Everything around them stays as it is.</span>
 </section>;
 const locked=!!active||starting;
 // Red means the microphone is hearing him: an interrupted or muted capture is shown neutral.
 const live=!!active&&!monitor.paused&&health.microphone!=='interrupted';
 return <div ref={manuscript} className="vs-stage vs-manuscript" aria-label="Card manuscript">
  {!!initialAnchors?.length&&<p className="vs-lead">Your selected {initialAnchors.length>1?'passages':'passage'}. Only these words are replaced.</p>}
  {nodes.map((node,i)=>{
   const state=chip(node),aimed=(active?recordingTarget.current:targetId)===node.id;
   const text=references[node.id]??node.text,paragraphs=readingParagraphs(text);
   const focus=active?captureFocus.current&&recordingTarget.current===node.id?captureFocus.current:undefined:paragraphAim?.sectionId===node.id?paragraphAim:undefined;
   // A passage chosen in the reader arrives already aimed at its paragraph.
   const selection=selectionParagraph(node),selected=!!selection&&aimed;
   const picking=!locked&&aimed&&!focus&&choosing===node.id&&paragraphs.length>1;
   const narrowing=!locked&&aimed&&paragraphs.length>1;
   const tag=(on:boolean)=>on&&<span className="vs-para-tag">{active?'Recording over this paragraph':'Only this paragraph will change'}</span>;
   return <section key={node.id} className="vs-section" data-paragraph-aim={!!focus||selected||undefined} data-picking={picking||undefined} data-section-id={node.id} aria-label={node.path.join(' · ')} aria-current={aimed?'step':undefined} data-recording={active&&!monitor.paused&&recordingTarget.current===node.id||undefined} data-live={live&&recordingTarget.current===node.id||undefined}>
    {node.lensId!==nodes[i-1]?.lensId&&node.path.length>1&&<p className="vs-lens">{node.path[0]}</p>}
    <button className="vs-section-head" aria-pressed={aimed} aria-label={`${shownTitle(node)}${aimed?', recording destination':', make this the recording destination'}`} disabled={locked} onClick={()=>{setChoosing(null);aim(node.id);}}>
     <span className="vs-aim" aria-hidden="true"><Mic size={14}/></span>
     <span className="vs-section-title">{shownTitle(node)}</span>
     {state&&<span className="vs-chip" data-tone={state.tone}>{state.label}</span>}
    </button>
    {narrowing&&<button type="button" className="vs-narrow" onClick={()=>{if(focus||picking){setChoosing(null);aim(node.id);}else setChoosing(node.id);}}>{focus||picking?'Record the whole section':'Record one paragraph only'}</button>}
    {picking&&<p className="vs-picking" role="status">Choose the paragraph to replace</p>}
    {paragraphs.length<2
     ?selected?<div className="vs-section-text vs-section-text--paragraphs"><p className="vs-para" data-aimed>{tag(true)}{text}</p></div>:<div className="vs-section-text">{text}</div>
     :<div className="vs-section-text vs-section-text--paragraphs">
      {paragraphs.map((p,n)=>{
       const on=!!focus&&focus.start===p.start&&focus.text===p.text;
       if(picking)return <button type="button" key={p.start} className="vs-para vs-para--choice" aria-pressed={false} aria-label={`Paragraph ${n+1}: ${opening(p.text)}`} onClick={()=>{setChoosing(null);aimParagraph(node.id,p);}}>{p.text}</button>;
       return <p key={p.start} className="vs-para" data-aimed={on||undefined}>{tag(on)}{p.text}</p>;
      })}
     </div>}
    {(state?.tone==='ready'||state?.tone==='check')&&<button className="vs-link" onClick={()=>reviewAt(node.id)}>Review your words<ChevronRight size={15}/></button>}
    {state?.tone==='human'&&<button className="vs-link vs-link--quiet" onClick={()=>void openApplied(node.id).catch(report)}>See what changed<ChevronRight size={15}/></button>}
   </section>;
  })}
  {!!draft?.unassigned.length&&<button className="vs-link vs-link--block" onClick={()=>openView('unplaced')}>{plural(draft.unassigned.length,'passage')} not placed yet<ChevronRight size={15}/></button>}
 </div>;
}
