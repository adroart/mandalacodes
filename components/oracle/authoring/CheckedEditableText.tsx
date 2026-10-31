import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {placeReviewChecks,type InlineWordCheck,type PlacedWordCheck} from '../../../lib/oracle/authoring/reviewPresentation';

interface CheckActions {disabled?:boolean;onHearCheck?:(key:string)=>void;onConfirmCheck?:(key:string)=>void;onReopenCheck?:(key:string)=>void}
interface Props extends CheckActions {label:string;value:string;checks:InlineWordCheck[];caret?:number;save:(text:string)=>Promise<void>;onSelection?:(from:number,to:number,text:string,value:string)=>void}

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

export function WordCheckActions({check,disabled,onHearCheck,onConfirmCheck,onReopenCheck}:{check:InlineWordCheck}&CheckActions){
 return <span className="vs-word-check-actions" data-check-controls="true" contentEditable={false}>
  {check.done?<button type="button" disabled={disabled} onClick={()=>onReopenCheck?.(check.key)}>Check again</button>:<>
   {onHearCheck&&<button type="button" disabled={disabled} onClick={()=>onHearCheck(check.key)}>{check.canHear?'Hear it':'Listen to recording'}</button>}
   <button type="button" disabled={disabled} onClick={()=>onConfirmCheck?.(check.key)}>{check.quote?'It’s right':'I’ve checked this'}</button>
  </>}
 </span>;
}

export function UnplacedWordCheck(props:{check:InlineWordCheck}&CheckActions){
 return <div className="vs-word-check-note" data-check-key={props.check.key}>
  <span>{props.check.quote?`“${props.check.quote}”`:props.check.message}</span>
  <WordCheckActions {...props}/>
 </div>;
}

/** A prose editor whose check controls are excluded from saving, copying and phrase offsets. */
export default function CheckedEditableText({label,value,checks,disabled,caret,save,onSelection,...actions}:Props){
 const root=useRef<HTMLDivElement>(null),latest=useRef(value),committed=useRef(value),dirty=useRef(false),focused=useRef(false),timer=useRef<ReturnType<typeof setTimeout>>(),callback=useRef(save);
 const [display,setDisplay]=useState(value),[failed,setFailed]=useState(false);callback.current=save;
 const placed=placeReviewChecks(display,checks),anchored=placed.filter((check):check is PlacedWordCheck&{from:number;to:number}=>check.from!==undefined&&check.to!==undefined).sort((a,b)=>a.from-b.from);
 const flush=async()=>{clearTimeout(timer.current);const text=latest.current;if(!dirty.current||text===committed.current)return;try{await callback.current(text);committed.current=text;if(latest.current===text)dirty.current=false;setFailed(false);}catch{setFailed(true);}};
 const select=()=>{const el=root.current,selection=window.getSelection();if(!el||!selection?.rangeCount)return;const range=selection.getRangeAt(0);if(!el.contains(range.startContainer)||!el.contains(range.endContainer))return;const prefix=range.cloneRange();prefix.selectNodeContents(el);prefix.setEnd(range.startContainer,range.startOffset);const from=checkedEditorText(prefix.cloneContents()),selected=checkedEditorText(range.cloneContents());onSelection?.(from.length,from.length+selected.length,selected,checkedEditorText(el));};
 const input=()=>{if(!root.current)return;latest.current=checkedEditorText(root.current);dirty.current=true;onSelection?.(0,0,'',latest.current);clearTimeout(timer.current);timer.current=setTimeout(()=>void flush(),600);};
 const insert=(text:string)=>{const el=root.current,selection=window.getSelection();if(!el||!selection?.rangeCount)return;const range=selection.getRangeAt(0);if(!el.contains(range.commonAncestorContainer))return;range.deleteContents();const node=document.createTextNode(text);range.insertNode(node);range.setStart(node,text.length);range.collapse(true);selection.removeAllRanges();selection.addRange(range);input();};
 useEffect(()=>{if(!dirty.current){latest.current=value;committed.current=value;if(!focused.current)setDisplay(value);}},[value]);
 useEffect(()=>()=>{clearTimeout(timer.current);if(dirty.current&&latest.current!==committed.current)void callback.current(latest.current).catch(()=>undefined);},[]);
 useEffect(()=>{if(caret===undefined||!root.current||!matchMedia('(pointer: fine)').matches)return;const el=root.current;el.focus({preventScroll:true});const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,{acceptNode:node=>(node.parentElement?.closest('[data-check-controls]')?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT)});let remaining=caret,node:Node|null;while((node=walker.nextNode())){if(remaining<=(node.textContent?.length??0)){const range=document.createRange();range.setStart(node,remaining);range.collapse(true);const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range);break;}remaining-=node.textContent?.length??0;}},[caret]);
 // React never reconciles the browser-owned editable children. Rebuild only after focus leaves;
 // while typing, update the mark without moving the caret or rewriting prose.
 useLayoutEffect(()=>{
  const el=root.current;if(!el)return;
  const updateActions=(span:HTMLElement,check:PlacedWordCheck)=>{
   span.querySelector('[data-check-controls]')?.remove();
   const controls=document.createElement('span');controls.className='vs-word-check-actions';controls.dataset.checkControls='true';controls.contentEditable='false';
   const button=(label:string,action:()=>void)=>{const node=document.createElement('button');node.type='button';node.textContent=label;node.disabled=!!disabled;node.onclick=action;controls.appendChild(node);};
   if(check.done)button('Check again',()=>actions.onReopenCheck?.(check.key));
   else {
    if(actions.onHearCheck)button('Hear it',()=>actions.onHearCheck?.(check.key));
    button('It’s right',()=>actions.onConfirmCheck?.(check.key));
   }
   span.appendChild(controls);
  };
  if(focused.current){
   for(const span of Array.from(el.querySelectorAll<HTMLElement>('.vs-inline-word-check'))){
    const check=placed.find(item=>item.key===span.dataset.checkKey);
    if(check){span.toggleAttribute('data-done',check.done);updateActions(span,check);}
   }
   return;
  }
  const fragment=document.createDocumentFragment();let cursor=0;
  for(const check of anchored){
   if(check.from>cursor)fragment.appendChild(document.createTextNode(display.slice(cursor,check.from)));
   const span=document.createElement('span');span.className='vs-inline-word-check';span.dataset.checkKey=check.key;if(check.done)span.dataset.done='true';
   const word=document.createElement('span');word.className='vs-checked-word';word.textContent=display.slice(check.from,check.to);span.appendChild(word);updateActions(span,check);fragment.appendChild(span);cursor=check.to;
  }
  if(cursor<display.length)fragment.appendChild(document.createTextNode(display.slice(cursor)));
  el.replaceChildren(fragment);
 },[display,checks,disabled,actions.onHearCheck]);
 return <div className="vs-checked-editor">
  <div ref={root} role="textbox" aria-label={label} aria-multiline="true" aria-disabled={disabled||undefined} tabIndex={disabled?-1:0} contentEditable={!disabled} suppressContentEditableWarning className="vs-checked-prose" onFocus={()=>{focused.current=true;}} onInput={input} onSelect={select} onMouseUp={select} onKeyUp={select} onBlur={e=>{if(e.currentTarget.contains(e.relatedTarget as Node))return;focused.current=false;setDisplay(latest.current);void flush();}} onPaste={e=>{e.preventDefault();insert(e.clipboardData.getData('text/plain'));}} onCopy={e=>{const selection=window.getSelection();if(!selection?.rangeCount)return;e.preventDefault();e.clipboardData.setData('text/plain',checkedEditorText(selection.getRangeAt(0).cloneContents()));}}/>
  {placed.filter(check=>check.from===undefined).map(check=><UnplacedWordCheck key={check.key} check={check} disabled={disabled} {...actions}/>)}
  {failed&&<button type="button" className="vs-link" onClick={()=>void flush()}>Retry saving these words</button>}
 </div>;
}
