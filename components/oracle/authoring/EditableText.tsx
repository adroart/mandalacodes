import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
interface Props { label:string; value:string; disabled?:boolean; autoSize?:boolean; onSelection?:(from:number,to:number,text:string,value:string)=>void; save:(text:string)=>Promise<void>; split?:(position:number,text:string)=>Promise<void> }
export default function EditableText({label,value,disabled,save,split,autoSize=false,onSelection}:Props) {
 const [text,setText]=useState(value),[failed,setFailed]=useState(false);
 const committed=useRef(value),timer=useRef<ReturnType<typeof setTimeout>>(),input=useRef<HTMLTextAreaElement>(null),callback=useRef(save),latest=useRef(text),dirty=useRef(false);
 callback.current=save;latest.current=text;
 const commit=async(value:string)=>{try{await callback.current(value);committed.current=value;if(latest.current===value)dirty.current=false;setFailed(false);}catch{setFailed(true);}};
 useEffect(()=>{if(!dirty.current&&value!==committed.current){committed.current=value;latest.current=value;setText(value);}},[value]);
 useEffect(()=>()=>{clearTimeout(timer.current);if(dirty.current&&latest.current!==committed.current)void callback.current(latest.current).catch(()=>undefined);},[]);
 useLayoutEffect(()=>{if(!autoSize||!input.current)return;const el=input.current;el.style.height='auto';el.style.height=`${Math.min(Math.max(90,window.innerHeight*(window.innerWidth>760?.38:.25)),Math.max(64,el.scrollHeight))}px`;},[text,autoSize]);
 const flush=()=>{clearTimeout(timer.current);if(dirty.current&&latest.current!==committed.current)void commit(latest.current);};
 useEffect(()=>{if(!dirty.current||text===committed.current)return;timer.current=setTimeout(()=>void commit(text),600);return()=>clearTimeout(timer.current);},[text]);
 return <div className="ov-text-editor"><label>{label}<textarea aria-label={label} ref={input} value={text} disabled={disabled} onChange={e=>{onSelection?.(0,0,'',e.currentTarget.value);dirty.current=true;setText(e.target.value);e.currentTarget.style.height='auto';e.currentTarget.style.height=`${Math.min(600,Math.max(110,e.currentTarget.scrollHeight))}px`;}} onSelect={e=>{const el=e.currentTarget;onSelection?.(el.selectionStart,el.selectionEnd,el.value.slice(el.selectionStart,el.selectionEnd),el.value);}} onBlur={flush}/></label>{failed&&<button onClick={()=>void commit(text)}>Retry saving these words</button>}{split&&<button disabled={disabled||failed} onMouseDown={e=>e.preventDefault()} onClick={()=>void split(input.current?.selectionStart??0,text).catch(()=>setFailed(true))}>Split at cursor</button>}</div>;
}
