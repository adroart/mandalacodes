import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {placeReviewChecks,type InlineWordCheck,type PlacedWordCheck} from '../../../lib/oracle/authoring/reviewPresentation';

/**
 * Optional playback facts for one check. The studio does not report them yet; when it does,
 * the row shows `Stop clip`, `Audio unavailable` or `Audio could not play.` without further changes here.
 */
export interface ReviewWordCheck extends InlineWordCheck {playing?:boolean;audio?:'unavailable'|'failed'}
export interface CheckActions {disabled?:boolean;onHearCheck?:(key:string)=>void;onStopCheck?:(key:string)=>void;onConfirmCheck?:(key:string)=>void;onReopenCheck?:(key:string)=>void}
interface Props extends CheckActions {label:string;value:string;checks:ReviewWordCheck[];caret?:number;save:(text:string)=>Promise<void>;onSelection?:(from:number,to:number,text:string,value:string)=>void}

/** Read only prose, never non-editable annotation labels. Handles browser-created line breaks too. */
export function checkedEditorText(root:Node):string {
 let text='';
 for(const node of Array.from(root.childNodes)){
  if(node.nodeType===Node.TEXT_NODE){text+=node.textContent??'';continue;}
  if(node.nodeType!==Node.ELEMENT_NODE)continue;
  const element=node as HTMLElement;
  if(element.hasAttribute('data-check-controls'))continue;
  if(element.tagName==='BR'){text+='\n';continue;}
  const block=/^(DIV|P)$/.test(element.tagName);
  if(block&&text&&!text.endsWith('\n'))text+='\n';
  const emptyBlock=block&&element.childNodes.length===1&&element.firstChild?.nodeName==='BR';
  text+=emptyBlock?'':checkedEditorText(element);
  if(block&&node.nextSibling&&!text.endsWith('\n'))text+='\n';
 }
 return text;
}

/** The actions for one check, in the order the design gives them. Never rendered inside prose. */
export function WordCheckActions({check,disabled,onHearCheck,onStopCheck,onConfirmCheck,onReopenCheck}:{check:ReviewWordCheck}&CheckActions){
 if(check.done)return <span className="vs-word-check-actions"><button type="button" disabled={disabled} onClick={()=>onReopenCheck?.(check.key)}>Check again</button></span>;
 const listen=check.canHear?'Hear it':'Listen to recording';
 return <span className="vs-word-check-actions">
  {check.audio==='unavailable'?<span className="vs-word-check-status">Audio unavailable</span>
   :check.audio==='failed'?<><span className="vs-word-check-status" role="status">Audio could not play.</span>{onHearCheck&&<button type="button" disabled={disabled} onClick={()=>onHearCheck(check.key)}>Try audio again</button>}</>
   :check.playing?<button type="button" disabled={disabled} onClick={()=>(onStopCheck??onHearCheck)?.(check.key)}>Stop clip</button>
   :onHearCheck&&<button type="button" disabled={disabled} onClick={()=>onHearCheck(check.key)}>{listen}</button>}
  <button type="button" disabled={disabled} onClick={()=>onConfirmCheck?.(check.key)}>{check.quote?'It’s right':'I’ve checked this'}</button>
 </span>;
}

/** One compact row below the passage: the quoted word, then its actions. */
export function WordCheckRow({check,onShow,...actions}:{check:PlacedWordCheck;onShow?:(key:string)=>void}&CheckActions){
 const placed=check.from!==undefined&&!!onShow;
 return <div className={placed?'vs-word-check-row':'vs-word-check-row vs-word-check-note'} data-check-key={check.key} data-done={check.done||undefined}>
  {placed?<button type="button" className="vs-word-check-quote" aria-label={`“${check.quote}”: show it in your words`} onClick={()=>onShow!(check.key)}>“{check.quote}”</button>
   :<span className="vs-word-check-quote">{check.quote?`“${check.quote}”`:check.message}</span>}
  <WordCheckActions check={check} {...actions}/>
 </div>;
}

export function UnplacedWordCheck(props:{check:ReviewWordCheck}&CheckActions){
 return <WordCheckRow {...props} check={{...props.check,from:undefined,to:undefined}}/>;
}

/** A prose editor that only marks doubtful words; their actions live in rows below, outside the editable text. */
export default function CheckedEditableText({label,value,checks,disabled,caret,save,onSelection,...actions}:Props){
 const root=useRef<HTMLDivElement>(null),latest=useRef(value),committed=useRef(value),dirty=useRef(false),focused=useRef(false),timer=useRef<ReturnType<typeof setTimeout>>(),callback=useRef(save),built=useRef('');
 const [display,setDisplay]=useState(value),[failed,setFailed]=useState(false);callback.current=save;
 const placed=placeReviewChecks(display,checks) as (PlacedWordCheck&ReviewWordCheck)[],anchored=placed.filter((check):check is PlacedWordCheck&ReviewWordCheck&{from:number;to:number}=>check.from!==undefined&&check.to!==undefined).sort((a,b)=>a.from-b.from);
 // Reading order: marked words by position, then any check whose word could not be found.
 const rows=[...anchored,...placed.filter(check=>check.from===undefined)];
 const flush=async()=>{clearTimeout(timer.current);const text=latest.current;if(!dirty.current||text===committed.current)return;try{await callback.current(text);committed.current=text;if(latest.current===text)dirty.current=false;setFailed(false);}catch{setFailed(true);}};
 const select=()=>{const el=root.current,selection=window.getSelection();if(!el||!selection?.rangeCount)return;const range=selection.getRangeAt(0);if(!el.contains(range.startContainer)||!el.contains(range.endContainer))return;const prefix=range.cloneRange();prefix.selectNodeContents(el);prefix.setEnd(range.startContainer,range.startOffset);const from=checkedEditorText(prefix.cloneContents()),selected=checkedEditorText(range.cloneContents());onSelection?.(from.length,from.length+selected.length,selected,checkedEditorText(el));};
 const input=()=>{if(!root.current)return;latest.current=checkedEditorText(root.current);dirty.current=true;onSelection?.(0,0,'',latest.current);clearTimeout(timer.current);timer.current=setTimeout(()=>void flush(),600);};
 const insert=(text:string)=>{const el=root.current,selection=window.getSelection();if(!el||!selection?.rangeCount)return;const range=selection.getRangeAt(0);if(!el.contains(range.commonAncestorContainer))return;range.deleteContents();const node=document.createTextNode(text);range.insertNode(node);range.setStart(node,text.length);range.collapse(true);selection.removeAllRanges();selection.addRange(range);input();};
 /** Bring a marked word into view and select it, so he can listen, retype or re-record it. */
 const show=(key:string)=>{const el=root.current,word=el?.querySelector<HTMLElement>(`.vs-inline-word-check[data-check-key="${CSS.escape(key)}"] .vs-checked-word`);if(!el||!word)return;word.scrollIntoView({block:'center',behavior:'smooth'});if(disabled)return;el.focus({preventScroll:true});const range=document.createRange();range.selectNodeContents(word);const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range);};
 useEffect(()=>{if(!dirty.current){latest.current=value;committed.current=value;if(!focused.current)setDisplay(value);}},[value]);
 useEffect(()=>()=>{clearTimeout(timer.current);if(dirty.current&&latest.current!==committed.current)void callback.current(latest.current).catch(()=>undefined);},[]);
 useEffect(()=>{if(caret===undefined||!root.current||!matchMedia('(pointer: fine)').matches)return;const el=root.current;el.focus({preventScroll:true});const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,{acceptNode:node=>(node.parentElement?.closest('[data-check-controls]')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT)});let remaining=caret,node:Node|null;while((node=walker.nextNode())){if(remaining<=(node.textContent?.length??0)){const range=document.createRange();range.setStart(node,remaining);range.collapse(true);const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range);break;}remaining-=node.textContent?.length??0;}},[caret]);
 // React never reconciles the browser-owned editable children. Rebuild only after focus leaves;
 // while typing, update the mark without moving the caret or rewriting prose.
 // The editable text holds words and marks only: no button can ever split a sentence or enter copied text.
 useLayoutEffect(()=>{
  const el=root.current;if(!el)return;
  if(focused.current){
   for(const span of Array.from(el.querySelectorAll<HTMLElement>('.vs-inline-word-check'))){
    const check=placed.find(item=>item.key===span.dataset.checkKey);
    if(check)span.toggleAttribute('data-done',check.done);
   }
   return;
  }
  const signature=JSON.stringify([display,anchored.map(check=>[check.key,check.from,check.to,check.done])]);
  if(signature===built.current&&el.childNodes.length)return;built.current=signature;
  const fragment=document.createDocumentFragment();let cursor=0;
  for(const check of anchored){
   if(check.from>cursor)fragment.appendChild(document.createTextNode(display.slice(cursor,check.from)));
   const span=document.createElement('span');span.className='vs-inline-word-check';span.dataset.checkKey=check.key;if(check.done)span.dataset.done='true';
   const word=document.createElement('span');word.className='vs-checked-word';word.textContent=display.slice(check.from,check.to);span.appendChild(word);fragment.appendChild(span);cursor=check.to;
  }
  if(cursor<display.length)fragment.appendChild(document.createTextNode(display.slice(cursor)));
  el.replaceChildren(fragment);
 },[display,checks]);
 return <div className="vs-checked-editor">
  <div ref={root} role="textbox" aria-label={label} aria-multiline="true" aria-disabled={disabled||undefined} tabIndex={disabled?-1:0} contentEditable={!disabled} suppressContentEditableWarning className="vs-checked-prose" onFocus={()=>{focused.current=true;}} onInput={input} onSelect={select} onMouseUp={select} onKeyUp={select} onBlur={e=>{if(e.currentTarget.contains(e.relatedTarget as Node))return;focused.current=false;setDisplay(latest.current);void flush();}} onPaste={e=>{e.preventDefault();insert(e.clipboardData.getData('text/plain'));}} onCopy={e=>{const selection=window.getSelection();if(!selection?.rangeCount)return;e.preventDefault();e.clipboardData.setData('text/plain',checkedEditorText(selection.getRangeAt(0).cloneContents()));}}/>
  {rows.length>0&&<div className="vs-word-check-rows" role="group" aria-label="Words to check">
   {rows.map(check=><WordCheckRow key={check.key} check={check} onShow={show} disabled={disabled} {...actions}/>)}
  </div>}
  {failed&&<button type="button" className="vs-link" onClick={()=>void flush()}>Retry saving these words</button>}
 </div>;
}
