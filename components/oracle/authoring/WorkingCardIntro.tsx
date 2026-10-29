import React,{useEffect,useState} from 'react';
import {getIntegratedIntro,SectionDraftStore} from '../../../lib/oracle/authoring/sectionDrafts';
import './WorkingCardReading.css';
const drafts=new SectionDraftStore();
/** The entrance is its own editorial section, outside the six manuscript lenses. */
export default function WorkingCardIntro({cardNumber,original}:{cardNumber:number;original:string}){
 const [loaded,setLoaded]=useState<{card:number;text?:string}>({card:cardNumber}),[published,setPublished]=useState(false);
 useEffect(()=>{let alive=true,request=0;setPublished(false);const refresh=async()=>{const id=++request;try{const text=await getIntegratedIntro(cardNumber);if(alive&&id===request)setLoaded({card:cardNumber,text});}catch{if(alive&&id===request)setLoaded({card:cardNumber});}};void refresh();const off=drafts.subscribe(()=>void refresh());window.addEventListener('focus',refresh);return()=>{alive=false;off();window.removeEventListener('focus',refresh);};},[cardNumber]);
 const text=loaded.card===cardNumber?loaded.text:undefined;
 return <div className="working-card-intro" data-card-section-id={`${cardNumber}/INTRO`}>
  <p className="ul-essence">{text&&!published?text:original}</p>
  {text&&<div className="working-card-intro__toolbar"><span>{published?'Published intro':'Your spoken intro'}</span><button aria-pressed={published} onClick={()=>setPublished(value=>!value)}>{published?'Your words':'Published text'}</button></div>}
 </div>;
}
