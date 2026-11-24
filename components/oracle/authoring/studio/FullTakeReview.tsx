import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {flushSync} from 'react-dom';
import {placeReviewChecks} from '../../../../lib/oracle/authoring/reviewPresentation';
import {withChosenPassageText} from '../../../../lib/oracle/authoring/passageSentences';
import type {SectionDraftResult} from '../../../../lib/oracle/authoring/sectionDrafts';
import {WordCheckActions,type CheckActions,type ReviewWordCheck} from '../CheckedEditableText';
import WordReplay from '../WordReplay';
import type {VoiceStudio} from './types';

const quiet='btn btn-quiet btn-sm';
type Pane='draft'|'original'|'preview'|'sentences';
interface Props extends CheckActions {
 result:SectionDraftResult;
 checks:ReviewWordCheck[];
 comparison:ReactNode;
 tools:ReactNode;
 operation:ReactNode;
 occupied:boolean;
 activeWord:VoiceStudio['activeWord'];
 replay:VoiceStudio['replay'];
 onSeek:Parameters<typeof WordReplay>[0]['onSeek'];
 onEditing:(editing:boolean)=>void;
 onSelection:(from:number,to:number,text:string,baseText:string)=>void;
 save:(before:string,text:string,range?:{from:number;to:number})=>Promise<void>;
}

export default function FullTakeReview({result,checks,comparison,tools,operation,occupied,replay,activeWord,onSeek,onEditing,onSelection,save,...actions}:Props){
 const [view,setPane]=useState<Pane>('draft');
 const pane=view==='sentences'&&!result.comparison?'draft':view;
 const [edit,setEdit]=useState<{before:string;initial:string;text:string}|null>(null);
 const [checkKey,setCheckKey]=useState<string>();
 const [undo,setUndo]=useState<{before:string;after:string;key:string;from:number;to:number}>();
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const input=useRef<HTMLTextAreaElement>(null),editButton=useRef<HTMLButtonElement>(null);
 const selected=result.passageEdit!;
 const chosen=withChosenPassageText(result).text;
 const placed=placeReviewChecks(result.text,checks)
  .map(item=>({...checks.find(check=>check.key===item.key)!,...item}))
  .filter(check=>!check.done);
 const active=placed.find(check=>check.key===checkKey);
 const choices=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{choices.current?.scrollIntoView({block:'nearest'});},[checkKey]);
 const marked=placed.filter(check=>check.from!==undefined&&check.to!==undefined).sort((a,b)=>a.from!-b.from!);
 const disabled=actions.disabled||saving;
 const change=async(before:string,text:string,afterSave:()=>void,range?:{from:number;to:number})=>{
  setSaving(true);setError('');
  try{if(before!==text)await save(before,text,range);afterSave();}
  catch{setError('Could not save your words. Try again.');}
  finally{setSaving(false);}
 };
 const startEdit=()=>{
  onSelection(0,0,'',result.text);
  // Focus inside the tap so iOS can open the software keyboard.
  flushSync(()=>{setError('');setEdit({before:result.text,initial:chosen,text:chosen});onEditing(true);});
  const field=input.current;
  field?.focus({preventScroll:true});
  field?.setSelectionRange(0,0);
 };
 const done=()=>{if(!edit||saving)return;
  void change(edit.before,edit.initial===edit.text?edit.before:edit.text,()=>{
   flushSync(()=>{setEdit(null);setUndo(undefined);onEditing(false);});
   editButton.current?.focus({preventScroll:true});
  });
 };
 if(edit)return <div className="vs-take-editor" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();done();}}}>
  <textarea ref={input} aria-label="Edit recorded passage" value={edit.text} readOnly={saving}
   onChange={event=>setEdit({...edit,text:event.target.value})}/>
  <div className="vs-take-done">
   {error&&<span role="alert">{error}</span>}
   <button type="button" className="btn btn-primary btn-sm" onClick={done} disabled={saving}>Done</button>
  </div>
 </div>;
 const useAlternate=()=>{
  if(!active?.heardAlso||active.from===undefined||active.to===undefined)return;
  const {from,to,heardAlso}=active;
  onSelection(0,0,'',result.text);
  const before=result.text,after=before.slice(0,from)+heardAlso+before.slice(to);
  void change(before,after,()=>{actions.onConfirmCheck?.(active.key);setUndo({before,after,key:active.key,from,to:from+heardAlso.length});setCheckKey(undefined);},{from,to});
 };
 const undoAlternate=()=>{
  if(!undo)return;
  void change(undo.after,undo.before,()=>{actions.onReopenCheck?.(undo.key);setCheckKey(undo.key);setUndo(undefined);},{from:undo.from,to:undo.to});
 };
 const switchPane=(next:Pane)=>{setPane(next);setCheckKey(undefined);onSelection(0,0,'',result.text);};
 const selectWords=(element:HTMLElement)=>{
  const selection=window.getSelection(),range=selection?.rangeCount?selection.getRangeAt(0):undefined;
  if(!range||!element.contains(range.startContainer)||!element.contains(range.endContainer))return;
  const prefix=range.cloneRange();
  prefix.selectNodeContents(element);prefix.setEnd(range.startContainer,range.startOffset);
  const start=prefix.toString().length,text=range.toString();
  onSelection(start,start+text.length,text,result.text);
 };
 let cursor=0;
 const prose=marked.map(check=>{
  const plain=result.text.slice(cursor,check.from);
  cursor=check.to!;
  return <span key={check.key}>{plain}<button type="button" className="btn btn-quiet btn-sm vs-take-word"
   aria-label={`Check “${check.quote}”`} aria-pressed={checkKey===check.key}
   onClick={()=>setCheckKey(checkKey===check.key?undefined:check.key)}>{result.text.slice(check.from,check.to)}</button></span>;
 });
 return <section className="vs-full-take" aria-label="Review recorded passage">
  {!replay&&<nav className="vs-take-tools" aria-label="Passage views">
   <button type="button" className={quiet} aria-pressed={pane==='draft'} onClick={()=>switchPane('draft')}>Draft</button>
   <button type="button" className={quiet} aria-pressed={pane==='original'} onClick={()=>switchPane('original')}>Original</button>
   <button type="button" className={quiet} aria-pressed={pane==='preview'} onClick={()=>switchPane('preview')}>Preview</button>
   {pane==='draft'&&<button type="button" ref={editButton} className={quiet+' vs-take-edit'} disabled={disabled||occupied} onClick={startEdit}>Edit</button>}
  </nav>}
  {replay?<div className="vs-take-text" data-review-pane="words"><WordReplay text={replay.text} words={replay.words} activeIndex={activeWord} onSeek={onSeek}/></div>
   :pane==='original'?<p className="vs-take-text" data-review-pane="original">{selected.focus.text}</p>
   :pane==='preview'?<p className="vs-take-text" data-review-pane="preview">{selected.operation==='add'?selected.focus.text+'\n\n':''}{chosen}</p>
   :pane==='sentences'?comparison
   :<div className="vs-take-text" data-review-pane="words" onPointerUp={event=>selectWords(event.currentTarget)} onKeyUp={event=>selectWords(event.currentTarget)}>{prose}{result.text.slice(cursor)}</div>}
  {pane==='draft'&&!replay&&<>
   {placed.filter(check=>check.from===undefined).map(check=><button type="button" key={check.key}
    className={quiet} aria-pressed={checkKey===check.key} onClick={()=>setCheckKey(checkKey===check.key?undefined:check.key)}>
    {check.quote?`Check “${check.quote}”`:'Review transcription'}
   </button>)}
   {active&&<div ref={choices} className="vs-take-check" role="group" aria-label="Word correction">
    <span>{active.quote?`Heard “${active.quote}”`:active.message}</span>
    <WordCheckActions {...actions} compact disabled={disabled} check={active} onUse={active.from===undefined?undefined:useAlternate}/>
   </div>}
   {undo&&undo.after===result.text&&<div className="vs-take-check" role="status">
    <span>Word replaced</span>
    <button type="button" className={quiet} disabled={disabled} onClick={undoAlternate}>Undo</button>
   </div>}
  </>}
  {error&&<p role="alert">{error}</p>}
  {!replay&&operation}
  {!replay&&<nav className="vs-take-tools vs-take-tools--secondary" aria-label="Review tools">
   {selected.operation==='replace'&&result.comparison&&<button type="button" className={quiet} aria-pressed={pane==='sentences'}
    onClick={()=>switchPane(pane==='sentences'?'draft':'sentences')}>Compare sentences</button>}
   {tools}
  </nav>}
 </section>;
}
