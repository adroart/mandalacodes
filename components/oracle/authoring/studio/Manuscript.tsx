import {ChevronRight,Mic} from 'lucide-react';
import {readingParagraphs} from '../../../../lib/oracle/authoring/passageComparison';
import {plural} from './format';
import type {VoiceStudio} from './types';

export type ManuscriptProps=Pick<VoiceStudio,
 'active'|'opening'|'monitor'|'phraseCapture'|'manuscript'|'initialAnchors'|'nodes'|'chip'|'recordingTarget'|'targetId'|
 'captureFocus'|'paragraphAim'|'passageOperation'|'wholeSection'|'aimWholeSection'|'shownTitle'|'references'|'aim'|'aimParagraph'|'reviewAt'|'openApplied'|'report'|
 'draft'|'openView'|'health'|'selectionParagraph'|'passageStates'
>;

/** The first few words of a paragraph, for its accessible name while it can be chosen. */
const opening=(text:string)=>{const words=text.trim().split(/\s+/);return words.slice(0,6).join(' ')+(words.length>6?'…':'');};

/**
 * The work screen: the scrolling card with its section headings and paragraphs, or, while a selected
 * phrase is being recorded, the prompt with those words. Tapping a heading aims the next recording at
 * that whole section. Paragraph text is only ever read: in the aimed section alone, "Record one
 * paragraph only" makes its paragraphs choosable, and choosing one aims at it.
 */
export default function Manuscript({active,opening:starting,monitor,phraseCapture,manuscript,nodes,chip,recordingTarget,targetId,captureFocus,paragraphAim,passageOperation,wholeSection,aimWholeSection,shownTitle,references,aim,aimParagraph,reviewAt,openApplied,report,draft,openView,health,passageStates}:ManuscriptProps){
 if(active&&phraseCapture.current)return <section className="vs-prompt" aria-label="Selected phrase recording">
  <small>Say these words again</small>
  <p>{phraseCapture.current.text}</p>
  <span>Everything around them stays as it is.</span>
 </section>;
 const locked=!!active||starting;
 // Red means the microphone is hearing him: an interrupted or muted capture is shown neutral.
 const live=!!active&&!monitor.paused&&health.microphone!=='interrupted';
 return <div ref={manuscript} className="vs-stage vs-manuscript" aria-label="Card manuscript">
  <p className="vs-lead">Tap the passage you want to edit, then choose what happens to it. You can record one passage after another: each is prepared in the background and waits for your review.</p>
  {nodes.map((node,i)=>{
   const state=chip(node),aimed=(active?recordingTarget.current:targetId)===node.id;
   const text=references[node.id]??node.text,paragraphs=readingParagraphs(text),states=passageStates(node);
   const focus=active?captureFocus.current&&recordingTarget.current===node.id?captureFocus.current:undefined:paragraphAim?.sectionId===node.id?paragraphAim:undefined;
   const tag=(on:boolean)=>on&&<span className="vs-para-tag">{active?'Recording for this passage':passageOperation==='add'?'Add after this passage':passageOperation==='replace'?'Replace this passage':'Selected passage'}</span>;
   return <section key={node.id} className="vs-section" data-paragraph-aim={!!focus||undefined} data-section-id={node.id} aria-label={node.path.join(' · ')} aria-current={aimed?'step':undefined} data-recording={active&&!monitor.paused&&recordingTarget.current===node.id||undefined} data-live={live&&recordingTarget.current===node.id||undefined}>
    {node.lensId!==nodes[i-1]?.lensId&&node.path.length>1&&<p className="vs-lens">{node.path[0]}</p>}
    <button className="vs-section-head" aria-pressed={aimed&&wholeSection} aria-label={`${shownTitle(node)}, choose this section`} disabled={locked} onClick={()=>aim(node.id)}>
     <span className="vs-aim" aria-hidden="true"><Mic size={14}/></span>
     <span className="vs-section-title">{shownTitle(node)}</span>
     {state&&<span className="vs-chip" data-tone={state.tone}>{state.label}</span>}
    </button>
    <div className="vs-section-text vs-section-text--paragraphs">
     {paragraphs.map((p,n)=>{
      const on=!!focus&&p.start<=focus.start&&focus.start+focus.text.length<=p.end;
      // Recordings already saved for this paragraph, so the next one can be started without waiting for them.
      const own=states.filter(state=>p.start<=state.start&&state.start<p.end);
      const status=own.length?<span className="vs-para-states">{[...new Set(own.map(state=>state.label))].map(label=><span key={label} className="vs-chip" data-tone={own.find(state=>state.label===label)!.tone}>{label}</span>)}</span>:null;
      return locked?<p key={p.start} className="vs-para" data-aimed={on||undefined}>{tag(on)}{status}{p.text}</p>
       :<button type="button" key={p.start} className="vs-para vs-para--choice" data-aimed={on||undefined} aria-pressed={on} aria-label={`Edit paragraph ${n+1}: ${opening(p.text)}${own.length?` (${[...new Set(own.map(state=>state.label))].join(', ')})`:''}`} onClick={()=>aimParagraph(node.id,p)}>{tag(on)}{status}{p.text}</button>;
     })}
    </div>
    {!locked&&aimed&&!focus&&<button type="button" className="vs-narrow" onClick={()=>aimWholeSection(node.id)}>Record whole section</button>}
    {(state?.tone==='ready'||state?.tone==='check')&&<button className="vs-link" onClick={()=>reviewAt(node.id)}>Review your words<ChevronRight size={15}/></button>}
    {state?.tone==='human'&&<button className="vs-link vs-link--quiet" onClick={()=>void openApplied(node.id).catch(report)}>See what changed<ChevronRight size={15}/></button>}
   </section>;
  })}
  {!!draft?.unassigned.length&&<button className="vs-link vs-link--block" onClick={()=>openView('unplaced')}>{plural(draft.unassigned.length,'passage')} not placed yet<ChevronRight size={15}/></button>}
 </div>;
}
