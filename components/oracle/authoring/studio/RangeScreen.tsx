import {useEffect,useRef,useState} from 'react';
import {sectionComparisonOriginal} from '../../../../lib/oracle/authoring/sectionDrafts';
import type {VoiceStudio} from './types';

type Span={start:number;end:number;text:string};
type Props=Pick<VoiceStudio,'section'|'result'|'references'|'draft'|'prepareRange'|'integrating'>;

/** Textareas expose native iOS selection offsets. The first choice is copied into state
 * before the second field takes focus, so changing focus cannot erase the range. */
export default function RangeScreen({section,result,references,draft,prepareRange,integrating}:Props){
 const original=section&&result?result.passageEdit?.sectionText??sectionComparisonOriginal(result,references[section.id]??section.text):'';
 const words=result?.rangeSelection?.candidateText??result?.text??'';
 const baseline=useRef({original,words,version:draft?.version??-1});
 const originalRef=useRef<HTMLTextAreaElement>(null),wordsRef=useRef<HTMLTextAreaElement>(null);
 const pointerOriginal=useRef<Span|null>(null),pointerWords=useRef<Span|null>(null);
 const [chosenOriginal,setOriginal]=useState<Span|null>(null),[chosenWords,setWords]=useState<Span|null>(null);
 const [liveOriginal,setLiveOriginal]=useState<Span|null>(null),[liveWords,setLiveWords]=useState<Span|null>(null);
 const selection=(field:HTMLTextAreaElement|null,text:string):Span|null=>{
  if(!field||field.selectionEnd<=field.selectionStart)return null;
  const start=field.selectionStart,end=field.selectionEnd;
  return text.slice(start,end).trim()?{start,end,text:text.slice(start,end)}:null;
 };
 useEffect(()=>{
  const capture=()=>{
   if(document.activeElement===originalRef.current){const range=selection(originalRef.current,original);if(range)setLiveOriginal(range);}
   if(document.activeElement===wordsRef.current){const range=selection(wordsRef.current,words);if(range)setLiveWords(range);}
  };
  document.addEventListener('selectionchange',capture);
  return ()=>document.removeEventListener('selectionchange',capture);
 },[original,words]);
 const originalChoice=liveOriginal??selection(originalRef.current,original),wordsChoice=liveWords??selection(wordsRef.current,words);
 const stale=original!==baseline.current.original||words!==baseline.current.words||!!chosenOriginal&&original.slice(chosenOriginal.start,chosenOriginal.end)!==chosenOriginal.text||!!chosenWords&&words.slice(chosenWords.start,chosenWords.end)!==chosenWords.text;
 const preview=chosenOriginal&&chosenWords&&!stale?original.slice(0,chosenOriginal.start)+chosenWords.text+original.slice(chosenOriginal.end):'';
 const earlierBreak=chosenOriginal?original.lastIndexOf('\n\n',chosenOriginal.start-1):-1;
 const passageStart=earlierBreak<0?0:earlierBreak+2;
 const passageEnd=chosenOriginal?original.indexOf('\n\n',chosenOriginal.end):-1;
 const previewPassage=preview&&chosenOriginal&&chosenWords?preview.slice(passageStart,passageEnd<0?undefined:passageEnd+chosenWords.text.length-chosenOriginal.text.length):'';
 if(!section||!result||result.applied)return <div className="vs-stage vs-range"><p>Choose a pending review to replace selected words.</p></div>;
 return <div className="vs-stage vs-range" aria-label="Select words to replace">
  <p className="vs-range-intro">Highlight a phrase in each field, then use its selection.</p>
  <section className="vs-range-field" aria-label="Original reading selection">
   <div className="vs-range-heading"><h3>Original reading</h3>{chosenOriginal?<button type="button" className="vs-btn" onClick={()=>{setOriginal(null);setLiveOriginal(null);}}>Change</button>:<button type="button" className="vs-btn" disabled={integrating} onPointerDown={event=>{pointerOriginal.current=selection(originalRef.current,original);event.preventDefault();}} onClick={()=>{const range=pointerOriginal.current??selection(originalRef.current,original)??originalChoice;pointerOriginal.current=null;if(range)setOriginal(range);}}>Use selection</button>}</div>
   {chosenOriginal?<div className="vs-range-locked" data-selected-original>“{chosenOriginal.text}”</div>:<textarea ref={originalRef} aria-label="Select original words" readOnly value={original} onSelect={()=>{const range=selection(originalRef.current,original);if(range)setLiveOriginal(range);}}/>}
   {!chosenOriginal&&<p>Select only the words to replace.</p>}
  </section>
  <section className="vs-range-field" aria-label="Recorded words selection">
   <div className="vs-range-heading"><h3>Your words</h3>{chosenWords?<button type="button" className="vs-btn" onClick={()=>{setWords(null);setLiveWords(null);}}>Change</button>:<button type="button" className="vs-btn" disabled={integrating} onPointerDown={event=>{pointerWords.current=selection(wordsRef.current,words);event.preventDefault();}} onClick={()=>{const range=pointerWords.current??selection(wordsRef.current,words)??wordsChoice;pointerWords.current=null;if(range)setWords(range);}}>Use selection</button>}</div>
   {chosenWords?<div className="vs-range-locked" data-selected-words>“{chosenWords.text}”</div>:<textarea ref={wordsRef} aria-label="Select recorded words" readOnly value={words} onSelect={()=>{const range=selection(wordsRef.current,words);if(range)setLiveWords(range);}}/>}
   {!chosenWords&&<p>The rest of your recording remains available as unplaced words.</p>}
  </section>
  {stale&&<p className="vs-range-alert" role="alert">These words changed. Select both ranges again.</p>}
  {preview&&<section className="vs-range-preview" aria-label="Replacement preview"><h3>Passage preview</h3><p>{previewPassage}</p></section>}
  <button type="button" className="vs-btn vs-btn--primary vs-range-prepare" disabled={!chosenOriginal||!chosenWords||stale||integrating} onClick={()=>void prepareRange(chosenOriginal!,chosenWords!,baseline.current)}>Prepare replacement</button>
  <p className="vs-range-footnote">Review and Apply replacement separately.</p>
 </div>;
}
