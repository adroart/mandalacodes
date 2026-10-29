import React,{useEffect,useRef} from 'react';
import type {ReplayWord} from '../../../lib/oracle/authoring/wordReplay';
import './WordReplay.css';
interface Props {text:string;words:ReplayWord[];activeIndex:number;onSeek:(word:ReplayWord)=>void}
const timed=(word:ReplayWord)=>!!word.captureId&&word.startMs!==undefined&&word.endMs!==undefined&&word.endMs>word.startMs;
/** Readable playback text; only genuinely timestamped words can seek the audio. */
export default function WordReplay({text,words,activeIndex,onSeek}:Props){
 const root=useRef<HTMLDivElement>(null),active=useRef<HTMLButtonElement>(null);
 const exact=words.map(word=>word.text).join('')===text&&words.every((word,index)=>word.from===(index?words[index-1].to:0)&&word.to===word.from+word.text.length&&text.slice(word.from,word.to)===word.text);
 useEffect(()=>{
  const container=root.current,word=active.current;if(!container||!word||!exact)return;
  // Do not use scrollIntoView: that can move the whole reading or the page.
  const box=container.getBoundingClientRect(),current=word.getBoundingClientRect();
  const top=box.top+container.clientTop,bottom=top+container.clientHeight;
  if(container.scrollHeight<=container.clientHeight||container.clientHeight<=0)return;
  if(current.top<top)container.scrollTop-=top-current.top+8;
  else if(current.bottom>bottom)container.scrollTop+=current.bottom-bottom+8;
 },[activeIndex,exact]);
 return <div ref={root} className="word-replay" role="region" aria-label="Recording transcript">{exact?words.map((word,index)=>timed(word)?<button key={`${word.from}/${index}`} type="button" className="word-replay__word" ref={index===activeIndex?active:undefined} aria-current={index===activeIndex?'true':undefined} aria-label={word.text} title="Replay from this word" onClick={()=>onSeek(word)}>{index===activeIndex?<mark>{word.text}</mark>:word.text}</button>:<React.Fragment key={`${word.from}/${index}`}>{word.text}</React.Fragment>):text}</div>;
}
