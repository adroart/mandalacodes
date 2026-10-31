import React,{useMemo,useRef} from 'react';
import {Pencil} from 'lucide-react';
import {buildPassageComparison,comparisonRows,readingParagraphs,type PassageChoice,type PassageComparison,type ComparisonRow} from '../../../lib/oracle/authoring/passageComparison';
import {initialReviewOrder,placeReviewChecks,type InlineWordCheck} from '../../../lib/oracle/authoring/reviewPresentation';
import type {ReplayWord} from '../../../lib/oracle/authoring/wordReplay';
import EditableText from './EditableText';
import CheckedEditableText,{UnplacedWordCheck} from './CheckedEditableText';
import WordReplay from './WordReplay';
import './passage-review.css';
interface Props {
 original:string;text:string;intent?:'replace'|'add'|'revise';comparison?:PassageComparison;choices?:Record<string,PassageChoice>;disabled:boolean;replayDisabled:boolean;sessionKey:string;
 replay:{text:string;words:ReplayWord[];captureId:string}|null;activeWord:number;
 /** Character offset in text to return the cursor to after listening. */
 caret?:number;cleanupCount?:number;onCleanup?:()=>void;onChoose?:(key:string,choice:PassageChoice)=>void;
 checks?:InlineWordCheck[];onHearCheck?:(key:string)=>void;onConfirmCheck?:(key:string)=>void;onReopenCheck?:(key:string)=>void;
 onSelection?:(from:number,to:number,text:string,baseText:string)=>void;onReplay:(from?:number,to?:number)=>void;onSeek:(word:ReplayWord)=>void;onEdit:(index:number,replacement:string)=>Promise<void>;
}
const state=(row:ComparisonRow)=>row.kind==='unspoken'?(row.choice==='original'?['Stays','Remove']:['Removed','Keep it']):row.kind==='new'?(row.choice==='mine'?['Your words','Leave out']:['Left out','Add it back']):(row.choice==='mine'?['Your words','Keep original']:['Original kept','Use my words']);
/** Display proposed human passages first while edit indices and final source order remain untouched. */
export default function SectionPassageReview(props:Props){
 const view=useMemo(()=>buildPassageComparison(props.original,props.text,props.intent==='add'?undefined:props.comparison),[props.original,props.text,props.comparison,props.intent]);
 const rows=useMemo(()=>comparisonRows(view,props.choices),[view,props.choices]);
 const add=props.intent==='add',passages=view.kind==='matched'&&!add&&rows.length>1;
 const order=useRef<{session:string;keys:string[]}>({session:props.sessionKey,keys:initialReviewOrder(rows)});
 if(order.current.session!==props.sessionKey)order.current={session:props.sessionKey,keys:initialReviewOrder(rows)};
 for(const row of rows)if(!order.current.keys.includes(row.key))order.current.keys.push(row.key);
 const ordered=order.current.keys.flatMap(key=>{const index=rows.findIndex(row=>row.key===key);return index<0?[]:[{row:rows[index],index}];});
 const checkedRows=useRef<{session:string;keys:Set<string>}>({session:props.sessionKey,keys:new Set()});
 if(checkedRows.current.session!==props.sessionKey)checkedRows.current={session:props.sessionKey,keys:new Set()};
 const editable=rows.filter(row=>row.kind!=='unspoken'&&row.choice==='mine').length,paragraphs=readingParagraphs(props.original).length;
 const checks=placeReviewChecks(props.text,props.checks??[]),firstEditable=ordered.find(({row})=>row.kind!=='unspoken'&&row.choice==='mine')?.index;
 const checkRow=(check:typeof checks[number])=>check.from!==undefined?rows.findIndex(row=>row.kind!=='unspoken'&&row.choice==='mine'&&check.from!>=row.textStart&&check.to!<=row.textEnd):-1;
 const actions={onHearCheck:props.onHearCheck,onConfirmCheck:props.onConfirmCheck,onReopenCheck:props.onReopenCheck};
 return <section className="vs-compare vs-compare--human-first" aria-label="Compare with the original" data-mode={passages?'passages':'whole'}>
  {ordered.map(({row,index})=>{
   const tokens=props.replay?.words.flatMap((word,global)=>{const from=Math.max(row.textStart,word.from),to=Math.min(row.textEnd,word.to);return to>from?[{...word,text:word.text.slice(from-word.from,to-word.from),from:from-row.textStart,to:to-row.textStart,global}]:[]})??[];
   const active=tokens.findIndex(word=>word.global===props.activeWord);
   const caret=props.caret!==undefined&&props.caret>=row.textStart&&props.caret<=row.textEnd?props.caret-row.textStart:undefined;
   const [label,action]=state(row),label2=editable===1?'Your section words':`Your words for passage ${index+1}`;
   const rowChecks=checks.filter(check=>checkRow(check)===index||(checkRow(check)<0&&index===firstEditable));
   if(rowChecks.length)checkedRows.current.keys.add(row.key);
   const original=<section key="original" data-review-pane="original" aria-label={!passages?'Original section':`Original passage ${index+1}`}>
    {row.kind!=='unspoken'&&<h4>{add?'Already in the reading':'Original'}</h4>}
    <div className="vs-original">{row.original}</div>
   </section>;
   const human=row.kind!=='unspoken'?<section key="words" data-review-pane="words" aria-label={!passages?'Your section words':`Your words for passage ${index+1}`}>
    {(!passages||row.choice!=='mine')&&<h4>{row.choice!=='mine'?'Not being used':add?'Your addition':'Your words'}{row.choice==='mine'&&<Pencil size={12} aria-hidden="true"/>}{!passages&&!add&&<span className="vs-replacement-scope">{paragraphs>1?`Replaces all ${paragraphs} paragraphs`:'Replaces this paragraph'}</span>}</h4>}
    {row.choice!=='mine'?<p className="vs-unused">{row.text}</p>:props.replay?<WordReplay text={row.text} words={tokens} activeIndex={active} onSeek={props.onSeek}/>:checkedRows.current.keys.has(row.key)?<CheckedEditableText key={props.sessionKey+'/'+index} label={label2} value={row.text} checks={rowChecks.map(check=>({...check,unanchored:checkRow(check)<0}))} disabled={props.disabled} caret={caret} save={replacement=>props.onEdit(index,replacement)} onSelection={(from,to,text,value)=>props.onSelection?.(row.textStart+from,row.textStart+to,text,props.text.slice(0,row.textStart)+value+props.text.slice(row.textEnd))} {...actions}/>:<EditableText autoSize="content" hideLabel caret={caret} onSelection={(from,to,text,value)=>props.onSelection?.(row.textStart+from,row.textStart+to,text,props.text.slice(0,row.textStart)+value+props.text.slice(row.textEnd))} key={props.sessionKey+'/'+index} label={label2} value={row.text} disabled={props.disabled} save={replacement=>props.onEdit(index,replacement)}/>}
   </section>:null;
   return <div className="vs-pair" role="group" key={`${props.sessionKey}/${row.key}`} data-passage-index={index} data-kind={passages?row.kind:'whole'} data-choice={row.choice} aria-label={passages?`${row.kind==='new'?'New passage':`Passage ${index+1}`}: ${label}`:undefined}>
    {passages&&<header className="vs-pair-head"><span>{row.kind==='new'?'New passage':`Passage ${index+1}`}<b data-tone={row.choice==='mine'&&row.kind!=='unspoken'?'mine':row.kind==='unspoken'&&row.choice==='mine'?'removed':'kept'}>{label}</b></span>{props.onChoose&&<button type="button" className="vs-row-action" disabled={props.disabled} onClick={()=>props.onChoose!(row.key,row.choice==='mine'?'original':'mine')}>{action}</button>}</header>}
    {row.choice==='mine'?[human,...(row.original.trim()?[original]:[])]:[...(row.original.trim()?[original]:[]),human]}
   </div>;
  })}
  {firstEditable===undefined&&checks.map(check=><UnplacedWordCheck key={check.key} check={check} disabled={props.disabled} {...actions}/>)}
  {!!props.cleanupCount&&<button type="button" className="vs-mini vs-cleanup-link" onClick={props.onCleanup}>{props.cleanupCount===1?'1 stumble tidied':`${props.cleanupCount} stumbles tidied`}</button>}
 </section>;
}
