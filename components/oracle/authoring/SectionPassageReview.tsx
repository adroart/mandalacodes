import React,{useMemo,useRef} from 'react';
import {buildPassageComparison,type PassageComparison} from '../../../lib/oracle/authoring/passageComparison';
import type {ReplayWord} from '../../../lib/oracle/authoring/wordReplay';
import EditableText from './EditableText';
import WordReplay from './WordReplay';
interface Props {
 original:string;text:string;intent?:'replace'|'add'|'revise';comparison?:PassageComparison;disabled:boolean;replayDisabled:boolean;sessionKey:string;
 replay:{text:string;words:ReplayWord[];captureId:string}|null;activeWord:number;linked:boolean;
 onSelection?:(from:number,to:number,text:string,baseText:string)=>void;onReplay:(from?:number,to?:number)=>void;onSeek:(word:ReplayWord)=>void;onEdit:(index:number,replacement:string)=>Promise<void>;
}
/** Every pair is evidence-linked. Old or edited candidates fall back to one honest section comparison. */
export default function SectionPassageReview(props:Props){
 const model=useMemo(()=>buildPassageComparison(props.original,props.text,props.intent==='add'?undefined:props.comparison),[props.original,props.text,props.comparison,props.intent]);
 const syncing=useRef<HTMLElement|null>(null);
 const sync=(event:React.UIEvent<HTMLElement>)=>{const from=event.target as HTMLElement;if(!props.linked||!from.matches('.section-studio-original,textarea,.word-replay'))return;if(syncing.current===from){syncing.current=null;return;}const row=from.closest('.section-studio-pair'),isOriginal=!!from.closest('[data-review-pane="original"]');const to=row?.querySelector<HTMLElement>(isOriginal?'textarea,.word-replay':'.section-studio-original');if(!to)return;const ratio=from.scrollTop/Math.max(1,from.scrollHeight-from.clientHeight),next=ratio*Math.max(0,to.scrollHeight-to.clientHeight);if(Math.abs(to.scrollTop-next)>1){syncing.current=to;to.scrollTop=next;}};
 return <section className="section-studio-passage-review" aria-label="Passage replacements">
  {model.pairs.map((pair,index)=>{
   const tokens=props.replay?.words.flatMap((word,global)=>{const from=Math.max(pair.textStart,word.from),to=Math.min(pair.textEnd,word.to);return to>from?[{...word,text:word.text.slice(from-word.from,to-word.from),from:from-pair.textStart,to:to-pair.textStart,global}]:[]})??[];
   const active=tokens.findIndex(word=>word.global===props.activeWord);
   return <section className="section-studio-pair" key={`${props.sessionKey}/${index}`} data-passage-index={index} onScrollCapture={sync} aria-label={`Replacement ${index+1}`}>
    <span className="section-studio-pair-number">{model.pairs.length>1?`Passage ${index+1}`:null}</span>
    <div className="section-studio-pair-columns">
     <section data-review-pane="original" aria-label={index===0?'Original section':`Original passage ${index+1}`}><header>{props.intent==='add'?'Current reading · kept':'Original reading'}</header><div className="section-studio-original" tabIndex={0}>{pair.original||'New passage. No original words are replaced here.'}</div></section>
     <section data-review-pane="words" aria-label={index===0?'Your section words':`Your words for passage ${index+1}`}><header>{props.intent==='add'?'Your addition':'Your words'} <button disabled={props.replayDisabled} onClick={()=>props.onReplay(props.replay?undefined:pair.textStart,props.replay?undefined:pair.textEnd)}>{props.replay?'Edit words':model.pairs.length===1?'Replay':'Hear passage'}</button></header>{props.replay?<WordReplay text={pair.text} words={tokens} activeIndex={active} onSeek={props.onSeek}/>:<EditableText autoSize onSelection={(from,to,text,value)=>props.onSelection?.(pair.textStart+from,pair.textStart+to,text,props.text.slice(0,pair.textStart)+value+props.text.slice(pair.textEnd))} key={props.sessionKey+'/'+index} label={model.pairs.length===1?'Your section words':`Your words for passage ${index+1}`} value={pair.text} disabled={props.disabled} save={replacement=>props.onEdit(index,replacement)}/>}</section>
    </div>
   </section>;
  })}
 </section>;
}
