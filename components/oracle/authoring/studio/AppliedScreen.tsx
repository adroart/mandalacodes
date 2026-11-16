import {Check,Undo2,BookOpen} from 'lucide-react';
import type {CardSection} from '../../../../lib/oracle/authoring/cardSections';
import type {SectionDraftResult} from '../../../../lib/oracle/authoring/sectionDrafts';
import {undoIntegratedSection} from '../../../../lib/oracle/authoring/sectionDrafts';
import type {VoiceStudio} from './types';

export type AppliedPanelProps=Pick<VoiceStudio,
 'authorship'|'nextRecording'|'pathFor'|'references'|'opening'|'stopping'|'setParagraphAim'|'captureFocus'|
 'setTargetId'|'record'|'displayOrigins'
>&{section:CardSection;result:SectionDraftResult};

/** The review screen once a section is applied: what is now in the reading, and the next section to record. */
export function AppliedPanel({section,result,authorship,nextRecording,pathFor,references,opening,stopping,setParagraphAim,captureFocus,setTargetId,record,displayOrigins}:AppliedPanelProps){
 return <section className="vs-applied" aria-label="Now in your reading" data-has-next={!!nextRecording||undefined}>
  <p className="vs-applied-state"><Check size={16}/>{result.editIntent==='add'?'Your words were added to the reading.':authorship?.sections[section.id]==='human'?'Your words are in the reading.':'Your changes are in the reading.'}</p>
  {nextRecording&&<section className="vs-next-recording" aria-label="Next section to record">
   <small>Record next</small>
   <h3>{pathFor(nextRecording)}</h3>
   <p>{references[nextRecording.id]??nextRecording.text}</p>
   <button className="vs-btn vs-btn--primary" disabled={opening||stopping} onClick={()=>{setParagraphAim(null);captureFocus.current=undefined;setTargetId(nextRecording.id);void record(null,nextRecording.id);}}>{opening?'Opening microphone…':'Record this section'}</button>
  </section>}
  <div className="vs-just-applied">
   <h3>Just applied</h3>
   {displayOrigins.map((part,i)=><span key={i} className={part.origin==='human'?'vs-applied-text':'vs-applied-kept'}>{part.text}</span>)}
  </div>
 </section>;
}

export type AppliedActionsProps=Pick<VoiceStudio,
 'integrating'|'draft'|'services'|'accept'|'setNotice'|'report'|'readUpdated'|'nextReview'|'nextRecording'|
 'choose'|'close'|'queued'
>&{section:CardSection};

/**
 * The review dock's buttons once a section is applied: Undo, See in card, and Next to review or Finish.
 * The dock calls this as a plain function, not as `<AppliedActions/>`: its fragment then stands where the
 * dock's other button rows stand, so React keeps the same button nodes when a section is applied or undone.
 */
export function appliedActions({section,integrating,draft,services,accept,setNotice,report,readUpdated,nextReview,nextRecording,choose,close,queued}:AppliedActionsProps){
 return <>
  <button className="vs-btn vs-btn--quiet" disabled={integrating} onClick={()=>void undoIntegratedSection(draft!.id,section.id,services).then(value=>{accept(value);setNotice('Undone. The earlier words are back in your reading.');}).catch(report)}><Undo2 size={16}/>Undo</button>
  <button className="vs-btn vs-btn--quiet" onClick={readUpdated}><BookOpen size={16}/>See in card</button>
  {nextReview
   ?<button className={`vs-btn${nextRecording?' vs-btn--quiet':' vs-btn--primary'}`} onClick={()=>void choose(nextReview.id).catch(report)}>Next to review</button>
   :!nextRecording
    ?<button className="vs-btn vs-btn--primary" onClick={()=>void close()}>Finish</button>
    :queued.length?<span className="vs-processing-count">{queued.length} processing</span>:null}
 </>;
}
