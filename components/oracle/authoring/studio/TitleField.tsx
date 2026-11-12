import {useEffect,useRef,useState} from 'react';

/** The section title on the review screen, saved on blur or Enter. */
export default function TitleField({value,label,disabled,save}:{value:string;label:string;disabled?:boolean;save:(text:string)=>Promise<void>}){
 const [text,setText]=useState(value),[error,setError]=useState('');const latest=useRef(value),dirty=useRef(false),callback=useRef(save);callback.current=save;
 useEffect(()=>{if(!dirty.current){setText(value);latest.current=value;}},[value]);
 const commit=()=>{if(!dirty.current)return;const next=latest.current.trim();if(!next){setError('Enter a title.');return;}dirty.current=false;void callback.current(next).then(()=>setError('')).catch(()=>{dirty.current=true;setError('Title not saved. Retry.');});};
 useEffect(()=>()=>{if(dirty.current&&latest.current.trim())void callback.current(latest.current.trim()).catch(()=>undefined);},[]);
 return <><input className="vs-title-input" aria-label={label} title="Edit the section title" maxLength={240} value={text} disabled={disabled} onChange={e=>{dirty.current=true;latest.current=e.target.value;setText(e.target.value);}} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}}}/>{error&&<button className="vs-btn vs-btn--quiet" onClick={commit}>{error}</button>}</>;
}
