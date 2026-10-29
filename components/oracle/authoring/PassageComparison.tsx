import React,{useEffect,useRef,useState} from 'react';
import {ArrowDown,ArrowRight,Check,GitCompareArrows,Sparkles} from 'lucide-react';
import type {AuthoringServices,Transcript} from '../../../lib/oracle/authoring/types';
import {WorkingCardStore} from '../../../lib/oracle/authoring/humanDrafts';
import {passagesFromText,type PassageAnchor} from '../../../lib/oracle/authoring/passageContext';
import {plainSection} from '../../../src/mobile/authoring/passageActions';
import {compareHumanPassage} from '../../../src/mobile/authoring/passageComparison';
import {applyComparedPassage,type HumanJob} from '../../../src/mobile/authoring/humanCaptureJobs';
import {CARD_BY_NUMBER} from '../../../data/oracleData';
import WordChanges from './WordChanges';
import './PassageComparison.css';
interface Props{job:HumanJob;transcript:Transcript;cardNumber:number;services:AuthoringServices;children:React.ReactNode;beforeApply:()=>Promise<void>}
const titles:Record<string,string>={CODE:'Universal Language',ICHING:'I Ching',KEYS:'Gene Keys',DESIGN:'Human Design',BODY:'Body',RELATIONS:'Relations'};
export default function PassageComparison({job,transcript,cardNumber,services,children,beforeApply}:Props){
 const [candidates,setCandidates]=useState<PassageAnchor[]>([]),[ids,setIds]=useState<string[]>([]),[operation,setOperation]=useState<'replace'|'append'>('replace'),[explanation,setExplanation]=useState(''),[warnings,setWarnings]=useState<string[]>([]),[busy,setBusy]=useState(false),[applying,setApplying]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState(false);
 const epoch=useRef(0),mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++;};},[]);
 useEffect(()=>{let alive=true;epoch.current++;setCandidates([]);setIds([]);setExplanation('');setWarnings([]);setPreview(false);setError('');setBusy(false);
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
 useEffect(()=>{epoch.current++;setExplanation('');setWarnings([]);setBusy(false);},[transcript.corrected]);
 const targets=candidates.filter(c=>ids.includes(c.id)).sort((a,b)=>a.start-b.start),first=targets[0],last=targets.at(-1),original=first&&last?first.sectionText.slice(first.start,last.end):'';
 const adjacent=!!first&&targets.every((a,index)=>a.cardNumber===first.cardNumber&&a.sectionId===first.sectionId&&a.sectionText===first.sectionText&&(!index||a.start>=targets[index-1].end&&!first.sectionText.slice(targets[index-1].end,a.start).trim()));
 const canApply=adjacent&&!!transcript.corrected.trim()&&(operation==='replace'||targets.length===1);
 const compare=async()=>{const request=++epoch.current;setBusy(true);setError('');setPreview(false);try{(document.activeElement as HTMLElement)?.blur();await beforeApply();const result=await compareHumanPassage({words:transcript.corrected,candidates});if(request!==epoch.current||!mounted.current)return;setIds(result.matches.map(match=>match.passageId));setExplanation([result.explanation,...result.matches.map(match=>match.reason)].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(' '));setWarnings(result.warnings);if(result.operation!=='unclear')setOperation(result.operation);else setWarnings(w=>[...w,'Choose whether your words replace or follow the original.']);}catch(e){if(request===epoch.current)setError(e instanceof Error?e.message:'Comparison could not finish. You can choose the passage yourself.');}finally{if(request===epoch.current&&mounted.current)setBusy(false);}};
 const apply=async()=>{setApplying(true);setError('');try{await beforeApply();await applyComparedPassage(job,transcript,targets,operation,services);}catch(e){setError(e instanceof Error?e.message:'Your words could not be applied.');}finally{if(mounted.current)setApplying(false);}};
 return <section className="passage-comparison" aria-label="Compare your words with the reading">
  <header className="comparison-heading"><div><GitCompareArrows size={19}/><h3>Connect your words</h3></div><button className="comparison-ai" disabled={busy||applying||!candidates.length} onClick={()=>void compare()}><Sparkles size={15}/>{busy?'Comparing…':'Compare with AI'}</button></header>
  <p className="comparison-intro">Find the passage you’re changing, then see your words in the reading.</p>
  <div className="comparison-destination" aria-live="polite"><ArrowRight size={16}/><div><span>Applies to</span><strong>{first?`Code ${first.cardNumber} · ${CARD_BY_NUMBER.get(first.cardNumber)?.card_name??''} · ${titles[first.sectionId]??first.sectionId}`:'Choose a passage below or let AI find the connection'}</strong></div></div>
  <details className="comparison-picker" open={!first}><summary>{first?'Choose another passage':'Choose a passage yourself'}</summary><label className="comparison-passage-picker">Original passage<select aria-label="Original passage to change" value={ids.length===1?ids[0]:''} onChange={e=>{epoch.current++;setBusy(false);setIds(e.target.value?[e.target.value]:[]);setExplanation('');setWarnings([]);setPreview(false);}}><option value="">{ids.length>1?`${ids.length} passages connected by AI`:'Choose the passage you mean'}</option>{candidates.map((a,index)=><option key={a.id} value={a.id}>{titles[a.sectionId]??a.sectionId} · {a.cardNumber} · {a.text.slice(0,100)}</option>)}</select></label></details>
  {(explanation||warnings.length>0)&&<div className="comparison-reason" role="status"><strong>AI comparison</strong>{explanation&&<p>{explanation}</p>}{warnings.map((warning,i)=><p key={i}>{warning}</p>)}<small>Your wording stays exactly as transcribed or edited.</small></div>}
  <div className="comparison-pair"><section className="comparison-original" aria-label="Original reading"><header><span className="comparison-label">Original reading</span><span>{first?titles[first.sectionId]:''}</span></header>{first?<><p className="comparison-neighbor">{first.sectionText.slice(Math.max(0,first.start-160),first.start).trim()}</p><blockquote>{original}</blockquote><p className="comparison-neighbor">{last!.sectionText.slice(last!.end,last!.end+160).trim()}</p></>:<p className="comparison-empty">The exact original will appear here. AI can compare your meaning across this card’s six sections.</p>}</section><section className="comparison-human" aria-label="Your version"><header><span className="comparison-label">Your words</span><span>Editable transcript</span></header>{children}</section></div>
  <div className="comparison-decision"><div className="comparison-operation" role="group" aria-label="How your words change the reading"><button aria-pressed={operation==='replace'} onClick={()=>{setOperation('replace');setPreview(false);}}>Replace passage</button><button aria-pressed={operation==='append'} onClick={()=>{setOperation('append');setPreview(false);}}>Add after it</button></div><button className="comparison-preview-toggle" disabled={!canApply||busy||applying} onClick={()=>setPreview(p=>!p)}><ArrowDown size={15}/>{preview?'Hide preview':'Preview in reading'}</button></div>
  {preview&&canApply&&<section className="comparison-preview" aria-label="Proposed reading"><header><h4>How it will read</h4><span>{operation==='replace'?'Selected passage replaced':'Your words follow this passage'}</span></header><p className="comparison-neighbor">{first.sectionText.slice(Math.max(0,first.start-160),first.start).trim()}</p>{operation==='append'&&<p className="comparison-kept">{original}</p>}<p className="comparison-inserted">{transcript.corrected}</p><p className="comparison-neighbor">{last!.sectionText.slice(last!.end,last!.end+160).trim()}</p>{operation==='replace'&&<details><summary>See word changes</summary><WordChanges original={original} revised={transcript.corrected}/></details>}</section>}
  {!!targets.length&&!adjacent&&<p className="comparison-warning">These passages aren’t adjacent. Choose one passage to edit; the others can stay references.</p>}
  {error&&<p className="comparison-warning" role="alert">{error}</p>}
  <footer className="comparison-apply"><span>{first?`${titles[first.sectionId]??first.sectionId} · ${targets.length} passage${targets.length===1?'':'s'}`:'No passage selected'}</span><button disabled={!canApply||busy||applying||!preview} onClick={()=>void apply()}><Check size={16}/>{applying?'Saving…':operation==='replace'?'Use my words here':'Add my words here'}</button></footer>
 </section>;
}
