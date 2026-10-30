import React,{useEffect,useMemo,useRef} from 'react';
import {Volume2,Pencil} from 'lucide-react';
import {buildPassageComparison,comparisonRows,readingParagraphs,type PassageChoice,type PassageComparison,type ComparisonRow} from '../../../lib/oracle/authoring/passageComparison';
import type {ReplayWord} from '../../../lib/oracle/authoring/wordReplay';
import EditableText from './EditableText';
import WordReplay from './WordReplay';
interface Props {
 original:string;text:string;intent?:'replace'|'add'|'revise';comparison?:PassageComparison;choices?:Record<string,PassageChoice>;disabled:boolean;replayDisabled:boolean;sessionKey:string;
 replay:{text:string;words:ReplayWord[];captureId:string}|null;activeWord:number;
 /** Character offset in text to return the cursor to after listening. */
 caret?:number;cleanupCount?:number;onCleanup?:()=>void;onChoose?:(key:string,choice:PassageChoice)=>void;
 onSelection?:(from:number,to:number,text:string,baseText:string)=>void;onReplay:(from?:number,to?:number)=>void;onSeek:(word:ReplayWord)=>void;onEdit:(index:number,replacement:string)=>Promise<void>;
}
const state=(row:ComparisonRow)=>row.kind==='unspoken'?(row.choice==='original'?['Stays','Remove']:['Removed','Keep it']):row.kind==='new'?(row.choice==='mine'?['New here','Leave out']:['Left out','Add it back']):(row.choice==='mine'?['Your words','Keep original']:['Original kept','Use my words']);
/** Matched recordings are reviewed passage by passage: what was spoken about is replaced, what was not stays.
 * Unmatched recordings fall back honestly to the whole section, and say how much of it goes. */
export default function SectionPassageReview(props:Props){
 const view=useMemo(()=>buildPassageComparison(props.original,props.text,props.intent==='add'?undefined:props.comparison),[props.original,props.text,props.comparison,props.intent]);
 const rows=useMemo(()=>comparisonRows(view,props.choices),[view,props.choices]);
 const add=props.intent==='add',passages=view.kind==='matched'&&!add&&rows.length>1,root=useRef<HTMLElement>(null);
 const editable=rows.filter(row=>row.kind!=='unspoken'&&row.choice==='mine').length,spoken=rows.filter(row=>row.kind!=='unspoken').length,paragraphs=readingParagraphs(props.original).length;
 // Phone, whole section: the pinned original follows how far you have read through your own words.
 useEffect(()=>{const host=root.current,stage=host?.closest<HTMLElement>('.vs-stage');if(!host||!stage||passages)return;const sync=()=>{if(matchMedia('(min-width: 900px)').matches)return;const bottom=stage.getBoundingClientRect().bottom;for(const pair of host.querySelectorAll<HTMLElement>('.vs-pair')){const pane=pair.querySelector<HTMLElement>('[data-review-pane=original]'),original=pane?.querySelector<HTMLElement>('.vs-original'),words=pair.querySelector<HTMLElement>('[data-review-pane=words]');if(!pane||!original||!words||original.scrollHeight<=original.clientHeight+1)continue;const pin=pane.getBoundingClientRect().bottom,box=words.getBoundingClientRect(),progress=Math.min(1,Math.max(0,(pin-box.top)/Math.max(1,box.height-(bottom-pin))));original.scrollTop=progress*(original.scrollHeight-original.clientHeight);}};stage.addEventListener('scroll',sync,{passive:true});return()=>stage.removeEventListener('scroll',sync);},[view,passages]);
 return <section ref={root} className="vs-compare" aria-label="Compare with the original" data-mode={passages?'passages':'whole'}>
  {passages?<p className="vs-compare-summary">{spoken>=rows.length?`Your words for all ${rows.length} passages.`:`You spoke about ${spoken} of ${rows.filter(row=>row.kind!=='new').length} passages. The rest stay as written.`}{!!props.cleanupCount&&<button type="button" className="vs-mini" onClick={props.onCleanup}>{props.cleanupCount===1?'1 stumble tidied':`${props.cleanupCount} stumbles tidied`}</button>}</p>
   :!add&&paragraphs>1?<p className="vs-compare-summary" data-tone="whole">Your words replace the whole section, all {paragraphs} paragraphs. To change one paragraph, tap it on the card before recording.{!!props.cleanupCount&&<button type="button" className="vs-mini" onClick={props.onCleanup}>{props.cleanupCount===1?'1 stumble tidied':`${props.cleanupCount} stumbles tidied`}</button>}</p>
   :props.cleanupCount?<p className="vs-compare-summary"><button type="button" className="vs-mini" onClick={props.onCleanup}>{props.cleanupCount===1?'1 stumble tidied':`${props.cleanupCount} stumbles tidied`}</button></p>:null}
  {rows.map((row,index)=>{
   const tokens=props.replay?.words.flatMap((word,global)=>{const from=Math.max(row.textStart,word.from),to=Math.min(row.textEnd,word.to);return to>from?[{...word,text:word.text.slice(from-word.from,to-word.from),from:from-row.textStart,to:to-row.textStart,global}]:[]})??[];
   const active=tokens.findIndex(word=>word.global===props.activeWord);
   const caret=props.caret!==undefined&&props.caret>=row.textStart&&props.caret<=row.textEnd?props.caret-row.textStart:undefined;
   const [label,action]=state(row),label2=editable===1?'Your section words':`Your words for passage ${index+1}`;
   return <div className="vs-pair" role="group" key={`${props.sessionKey}/${row.key}`} data-passage-index={index} data-kind={passages?row.kind:'whole'} data-choice={row.choice} aria-label={passages?`Passage ${index+1}: ${label}`:undefined}>
    {passages&&<header className="vs-pair-head"><span>Passage {index+1}<b data-tone={row.choice==='mine'&&row.kind!=='unspoken'?'mine':row.kind==='unspoken'&&row.choice==='mine'?'removed':'kept'}>{label}</b></span>{props.onChoose&&!props.disabled&&<button type="button" className="vs-row-action" onClick={()=>props.onChoose!(row.key,row.choice==='mine'?'original':'mine')}>{action}</button>}</header>}
    <section data-review-pane="original" aria-label={index===0&&!passages?'Original section':`Original passage ${index+1}`} hidden={passages&&row.kind==='new'}>
     {!passages&&<h4>{add?'Stays in the reading':'Original'}</h4>}
     <div className="vs-original">{row.original}</div>
    </section>
    {!(passages&&row.kind==='unspoken')&&<section data-review-pane="words" aria-label={index===0&&!passages?'Your section words':`Your words for passage ${index+1}`}>
     {!passages&&<h4>{add?'Your addition':'Your words'}<Pencil size={12} aria-hidden="true"/></h4>}
     {row.choice!=='mine'?<p className="vs-unused">{row.text}</p>:props.replay?<WordReplay text={row.text} words={tokens} activeIndex={active} onSeek={props.onSeek}/>:<>
      {passages&&editable>1&&<button type="button" className="vs-mini vs-mini--hear" disabled={props.replayDisabled} onClick={()=>props.onReplay(row.textStart,row.textEnd)}><Volume2 size={14}/>Hear</button>}
      <EditableText autoSize="content" hideLabel caret={caret} onSelection={(from,to,text,value)=>props.onSelection?.(row.textStart+from,row.textStart+to,text,props.text.slice(0,row.textStart)+value+props.text.slice(row.textEnd))} key={props.sessionKey+'/'+index} label={label2} value={row.text} disabled={props.disabled} save={replacement=>props.onEdit(index,replacement)}/>
     </>}
    </section>}
   </div>;
  })}
 </section>;
}
