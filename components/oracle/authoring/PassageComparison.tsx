import React,{useEffect,useRef,useState} from 'react';
import type {AuthoringServices,Transcript} from '../../../lib/oracle/authoring/types';
import {WorkingCardStore} from '../../../lib/oracle/authoring/humanDrafts';
import {passagesFromText,type PassageAnchor} from '../../../lib/oracle/authoring/passageContext';
import {plainSection} from '../../../src/mobile/authoring/passageActions';
import {compareHumanPassage} from '../../../src/mobile/authoring/passageComparison';
import {applyComparedPassage,type HumanJob} from '../../../src/mobile/authoring/humanCaptureJobs';
import './PassageComparison.css';
interface Props{job:HumanJob;transcript:Transcript;cardNumber:number;services:AuthoringServices;children:React.ReactNode;beforeApply:()=>Promise<Transcript>;onReplay:()=>void}
const titles:Record<string,string>={CODE:'Universal Language',ICHING:'I Ching',KEYS:'Gene Keys',DESIGN:'Human Design',BODY:'Body',RELATIONS:'Relations'};
export default function PassageComparison({job,transcript,cardNumber,services,children,beforeApply,onReplay}:Props){
 const [candidates,setCandidates]=useState<PassageAnchor[]>([]),[ids,setIds]=useState<string[]>([]),[operation,setOperation]=useState<'replace'|'append'>('replace'),[explanation,setExplanation]=useState(''),[warnings,setWarnings]=useState<string[]>([]),[busy,setBusy]=useState(false),[applying,setApplying]=useState(false),[error,setError]=useState('');
 const epoch=useRef(0),mounted=useRef(true),comparisonInput=useRef(transcript.corrected);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++;};},[]);
 useEffect(()=>{let alive=true;epoch.current++;setCandidates([]);setIds([]);setExplanation('');setWarnings([]);setError('');setBusy(false);
 void(async()=>{const source=await services.loadSource(transcript.cardNumber??cardNumber),store=new WorkingCardStore(),all:PassageAnchor[]=[];
 for(const section of source.sections){const working=await store.get(source.cardNumber,section.id);all.push(...passagesFromText(source.cardNumber,section.id,working?.text??plainSection(source,section.id),working?.revision,source.hash));}
 // Keep references from other cards and selected sentence spans available to AI.
 const connected=[...(job.passageMatches??[]),...(job.anchors??[])];
 for(const anchor of connected){if(!all.some(a=>a.id===anchor.id))all.push(anchor);}
 if(!alive)return;setCandidates(all);
 const selected=(job.selectedPassageIds?.length?connected.filter(a=>job.selectedPassageIds!.includes(a.id)):connected.filter(a=>a.cardNumber===(transcript.cardNumber??cardNumber)&&a.sectionId===transcript.sectionId));
 if(selected.length===1)setIds([selected[0].id]);
 })().catch(e=>{if(alive)setError(e instanceof Error?e.message:'The original reading could not be loaded.');});return()=>{alive=false;};
 },[job.id,transcript.id,transcript.cardNumber,transcript.sectionId]);
 useEffect(()=>{if(comparisonInput.current!==transcript.corrected){epoch.current++;setBusy(false);}setExplanation('');setWarnings([]);},[transcript.corrected]);
 const targets=candidates.filter(c=>ids.includes(c.id)).sort((a,b)=>a.start-b.start),first=targets[0],last=targets.at(-1),original=first&&last?first.sectionText.slice(first.start,last.end):'';
 const adjacent=!!first&&targets.every((a,index)=>a.cardNumber===first.cardNumber&&a.sectionId===first.sectionId&&a.sectionText===first.sectionText&&(!index||a.start>=targets[index-1].end&&!first.sectionText.slice(targets[index-1].end,a.start).trim()));
 const canApply=adjacent&&!!transcript.corrected.trim()&&(operation==='replace'||targets.length===1);
 const compare=async()=>{let request=epoch.current;setBusy(true);setError('');try{(document.activeElement as HTMLElement)?.blur();const current=await beforeApply();comparisonInput.current=current.corrected;request=++epoch.current;const result=await compareHumanPassage({words:current.corrected,candidates});if(request!==epoch.current||!mounted.current)return;setIds(result.matches.map(match=>match.passageId));setExplanation([result.explanation,...result.matches.map(match=>match.reason)].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' '));setWarnings(result.warnings);if(result.operation!=='unclear')setOperation(result.operation);else setWarnings(w=>[...w,'Choose whether your words replace or follow the original.']);}catch(e){if(request===epoch.current)setError(e instanceof Error?e.message:'Comparison could not finish. You can choose the passage yourself.');}finally{if(request===epoch.current&&mounted.current)setBusy(false);}};
 const apply=async()=>{setApplying(true);setError('');try{const current=await beforeApply();await applyComparedPassage(job,current,targets,operation,services);}catch(e){setError(e instanceof Error?e.message:'Your words could not be applied.');}finally{if(mounted.current)setApplying(false);}};
 const reading=original||candidates.find(a=>a.sectionId===transcript.sectionId)?.sectionText||'';
 return <section className="passage-comparison" aria-label="Compare your words with the reading">
  <div className="comparison-pair">
   <section className="comparison-original" aria-label="Original reading">
    <header><span>Original</span><span className="comparison-destination">Code {first?.cardNumber??transcript.cardNumber??cardNumber} · {titles[first?.sectionId??transcript.sectionId??'']??'Choose section'}</span></header>
    <div className="comparison-reading">{reading||'Loading reading…'}</div>
   </section>
   <section className="comparison-human" aria-label="Your version"><header><span>Your words</span><button className="comparison-replay" onClick={onReplay}>Replay</button></header>{children}</section>
  </div>
  <footer className="comparison-controls">
   <button className="comparison-ai" disabled={busy||applying||!candidates.length} onClick={()=>void compare()}>{busy?'Comparing…':'Compare with AI'}</button>
   <select aria-label="How to apply your words" value={operation} onChange={e=>setOperation(e.target.value as 'replace'|'append')}><option value="replace">Replace</option><option value="append">Add after</option></select>
   <button className="comparison-save" disabled={!canApply||busy||applying} onClick={()=>void apply()}>{applying?'Saving…':operation==='replace'?'Use my words here':'Add my words here'}</button>
   <details className="comparison-picker"><summary>Passage{explanation?' · matched':''}</summary><label>Original passage<select aria-label="Original passage to change" value={ids.length===1?ids[0]:''} onChange={e=>{epoch.current++;setBusy(false);setIds(e.target.value?[e.target.value]:[]);setExplanation('');setWarnings([]);}}><option value="">Choose a passage</option>{candidates.map(a=><option key={a.id} value={a.id}>{titles[a.sectionId]??a.sectionId} · {a.cardNumber} · {a.text.slice(0,100)}</option>)}</select></label>{explanation&&<p className="comparison-reason">{explanation}</p>}</details>
  </footer>
  {warnings.map((warning,i)=><p className="comparison-warning" key={i}>{warning}</p>)}
  {!!targets.length&&!adjacent&&<p className="comparison-warning">Choose one passage or adjacent passages to replace together.</p>}
  {error&&<p className="comparison-warning" role="alert">{error}</p>}
 </section>;
}
