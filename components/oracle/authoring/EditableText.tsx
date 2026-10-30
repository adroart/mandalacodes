import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
interface Props { label:string; value:string; disabled?:boolean; autoSize?:boolean|'content'; hideLabel?:boolean; caret?:number; onSelection?:(from:number,to:number,text:string,value:string)=>void; save:(text:string)=>Promise<void>; split?:(position:number,text:string)=>Promise<void> }
/** autoSize='content' grows with the words so the surrounding page is the only scroll. */
export default function EditableText({label,value,disabled,save,split,autoSize=false,hideLabel=false,caret,onSelection}:Props) {
 const [text,setText]=useState(value),[failed,setFailed]=useState(false);
 const committed=useRef(value),timer=useRef<ReturnType<typeof setTimeout>>(),input=useRef<HTMLTextAreaElement>(null),callback=useRef(save),latest=useRef(text),dirty=useRef(false);
 callback.current=save;latest.current=text;
 const commit=async(value:string)=>{try{await callback.current(value);committed.current=value;if(latest.current===value)dirty.current=false;setFailed(false);}catch{setFailed(true);}};
 const fit=(el:HTMLTextAreaElement,typing=false)=>{el.style.height='auto';el.style.height=autoSize==='content'?`${Math.max(64,el.scrollHeight+2)}px`:typing?`${Math.min(600,Math.max(110,el.scrollHeight))}px`:`${Math.min(Math.max(90,window.innerHeight*(window.innerWidth>760?.38:.25)),Math.max(64,el.scrollHeight))}px`;};
 useEffect(()=>{if(!dirty.current&&value!==committed.current){committed.current=value;latest.current=value;setText(value);}},[value]);
 useEffect(()=>()=>{clearTimeout(timer.current);if(dirty.current&&latest.current!==committed.current)void callback.current(latest.current).catch(()=>undefined);},[]);
 useLayoutEffect(()=>{if(autoSize&&input.current)fit(input.current);},[text,autoSize]);
 useEffect(()=>{if(autoSize!=='content'||!input.current)return;const el=input.current,observer=new ResizeObserver(()=>fit(el));observer.observe(el);return()=>observer.disconnect();},[autoSize]);
 // Return the cursor where listening stopped. Touch screens are left alone so no keyboard jumps up.
 useEffect(()=>{const el=input.current;if(caret===undefined||!el||!matchMedia('(pointer: fine)').matches)return;el.focus({preventScroll:true});el.setSelectionRange(caret,caret);},[caret]);
 const flush=()=>{clearTimeout(timer.current);if(dirty.current&&latest.current!==committed.current)void commit(latest.current);};
 useEffect(()=>{if(!dirty.current||text===committed.current)return;timer.current=setTimeout(()=>void commit(text),600);return()=>clearTimeout(timer.current);},[text]);
 return <div className="ov-text-editor"><label>{hideLabel?<span className="ov-text-editor__label-hidden">{label}</span>:label}<textarea aria-label={label} ref={input} value={text} disabled={disabled} onChange={e=>{onSelection?.(0,0,'',e.currentTarget.value);dirty.current=true;setText(e.target.value);fit(e.currentTarget,true);}} onSelect={e=>{const el=e.currentTarget;onSelection?.(el.selectionStart,el.selectionEnd,el.value.slice(el.selectionStart,el.selectionEnd),el.value);}} onBlur={flush}/></label>{failed&&<button onClick={()=>void commit(text)}>Retry saving these words</button>}{split&&<button disabled={disabled||failed} onMouseDown={e=>e.preventDefault()} onClick={()=>void split(input.current?.selectionStart??0,text).catch(()=>setFailed(true))}>Split at cursor</button>}</div>;
}
