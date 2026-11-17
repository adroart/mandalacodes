import type {VoiceStudio} from './types';

export type PassageEditorProps=Pick<VoiceStudio,
 'nodes'|'paragraphAim'|'passageOperation'|'setPassageOperation'|'passageCapture'|'recordingTarget'|'active'|'pathFor'|'scopeFor'|'references'|'results'|'queued'
>;

/** One destination and one operation stay visible while recording. The manuscript is a separate screen. */
export default function PassageEditor({nodes,paragraphAim,passageOperation,setPassageOperation,passageCapture,recordingTarget,active,pathFor,scopeFor,references,results,queued}:PassageEditorProps){
 const chosen=active?passageCapture.current?.focus:paragraphAim;
 const node=nodes.find(item=>item.id===(active?recordingTarget.current:paragraphAim?.sectionId));
 const operation=active?passageCapture.current?.operation:passageOperation;
 if(!node||!chosen)return <div className="vs-stage vs-passage-editor"><p>Choose a passage in the card to begin.</p></div>;
 const current=references[node.id]??node.text;
 const valid=current.slice(chosen.start,chosen.end)===chosen.text;
 const pending=results.some(r=>r.sectionId===node.id&&!r.applied),preparing=queued.some(t=>t.startSectionId===node.id);
 return <div className="vs-stage vs-passage-editor" aria-label="Selected passage editor">
  <small className="vs-passage-path">Card {node.cardNumber} · {pathFor(node)} · {scopeFor(node,chosen)}</small>
  <p className="vs-passage-selected">{chosen.text}</p>
  {!active&&!pending&&!preparing&&<>
   <p className="vs-passage-instruction">Choose what your new words will do:</p>
   <div className="vs-passage-actions" role="group" aria-label="Choose how to edit this passage">
    <button type="button" className="vs-btn" aria-pressed={passageOperation==='add'} onClick={()=>setPassageOperation('add')}>Add after</button>
    <button type="button" className="vs-btn" aria-pressed={passageOperation==='replace'} onClick={()=>setPassageOperation('replace')}>Replace</button>
   </div>
   {operation&&<p className="vs-passage-effect">{operation==='add'?'This passage stays. Your new words will follow it.':'Only this passage will be replaced.'} You can edit the transcript before applying.</p>}
  </>}
  {!active&&!valid&&<p className="vs-passage-stale" role="alert">This passage changed. Choose it again in the card.</p>}
  {!active&&pending&&<p className="vs-passage-pending" role="note">Words in this section are saved for review. Review them, or re-record that edit, before starting another passage here.</p>}
  {!active&&!pending&&preparing&&<p className="vs-passage-pending" role="status">A recording for this section is being prepared. Its saved words will be ready for review here.</p>}
  {active&&<p className="vs-passage-effect">{operation==='add'?'Adding after this passage':'Replacing this passage'}. Stop to review your words before they change the reading.</p>}
 </div>;
}
