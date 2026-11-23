import type {VoiceStudio} from './types';

export type PassageEditorProps=Pick<VoiceStudio,
 'nodes'|'paragraphAim'|'passageOperation'|'passageCapture'|'recordingTarget'|'active'|'pathFor'|'scopeFor'|'references'|'results'|'queued'|
 'aimConflict'|'waitingTakes'
>;

/**
 * One destination and one operation stay visible while recording. The manuscript is a separate screen.
 * Other passages of the same section may already be saved: they wait their turn, and only an edit of
 * these same words holds this one back.
 */
export default function PassageEditor({nodes,paragraphAim,passageOperation,passageCapture,recordingTarget,active,pathFor,scopeFor,references,results,queued,aimConflict,waitingTakes}:PassageEditorProps){
 const chosen=active?passageCapture.current?.focus:paragraphAim;
 const node=nodes.find(item=>item.id===(active?recordingTarget.current:paragraphAim?.sectionId));
 const operation=active?passageCapture.current?.operation:passageOperation;
 if(!node||!chosen)return <div className="vs-stage vs-passage-editor"><p>Choose a passage in the card to begin.</p></div>;
 const current=references[node.id]??node.text;
 const valid=current.slice(chosen.start,chosen.end)===chosen.text;
 const otherEdits=results.filter(r=>r.sectionId===node.id&&!r.applied).length+queued.filter(t=>t.startSectionId===node.id).length+waitingTakes.filter(t=>t.startSectionId===node.id).length;
 return <div className="vs-stage vs-passage-editor" aria-label="Selected passage editor">
  <small className="vs-passage-path">Card {node.cardNumber} · {pathFor(node)} · {scopeFor(node,chosen)}</small>
  <p className="vs-passage-selected">{chosen.text}</p>
  {!active&&!aimConflict&&valid&&<>
   <p className="vs-passage-instruction">{passageOperation==='add'?'Add after: this passage stays and your new words follow it.':passageOperation==='replace'?'Replace: speak the whole passage. In review you keep your new words or the old ones, sentence by sentence.':'Tap Replace to speak this passage again, or Add after to follow it with new words. Recording starts at once.'}</p>
   {otherEdits>0&&<p className="vs-passage-queue" role="note">{otherEdits===1?'Another edit in this section is':`${otherEdits} other edits in this section are`} saved. Each waits its turn for review.</p>}
  </>}
  {!active&&!valid&&<p className="vs-passage-stale" role="alert">This passage changed. Choose it again in the card.</p>}
  {!active&&valid&&aimConflict&&<p className="vs-passage-pending" role="note">{aimConflict}</p>}
  {active&&<p className="vs-passage-effect">{operation==='add'?'Adding after this passage':'Replacing this passage'}. Choose Next passage to keep going while these words are prepared.</p>}
 </div>;
}
