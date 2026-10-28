import React, { useCallback, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDarkMode } from '../../DarkModeContext';
import { CARD_BY_NUMBER } from '../../data/oracleData';
import { useJournal } from '../../lib/oracle/journal';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import type { CastResult } from '../../utils/ichingCasting';
import { recordReading } from './journal/store';
import OracleDrawDialog from '../../components/oracle/entry/OracleDrawDialog';
import '../../components/oracle/entry/OracleEntry.scoped.css';
function touchFeedback() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  (window as Window & {webkit?:{messageHandlers?:{oracleFeedback?:{postMessage:(value:string)=>void}}}}).webkit?.messageHandlers?.oracleFeedback?.postMessage('selection');
}
export default function OracleDrawPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { isDarkMode } = useDarkMode();
  const { record } = useJournal();
  const [question,setQuestion] = useState('');
  const [quick,setQuick] = useState(false);
  const [result,setResult] = useState<{number:number;cast?:CastResult;entryId:string}|null>(null);
  const [error,setError] = useState('');
  const eventId = useRef(crypto.randomUUID());
  const returnTo = typeof state?.returnTo === 'string' && state.returnTo.startsWith('/') && state.returnTo !== '/draw' ? state.returnTo : '/home';
  const close = useCallback(() => navigate(returnTo, {replace:true}), [navigate, returnTo]);
  const openReading=(number:number,cast?:CastResult,entryId?:string)=>navigate(`/universal-language/${number}`, {replace:true, state:{entrance:true, oracleCast:cast, journalEntryId:entryId}});
  if (result) return <CardReveal number={result.number} question={question} onClose={close} onRead={()=>openReading(result.number,result.cast,result.entryId)} onJournal={()=>navigate(`/journal?entry=${result.entryId}`,{replace:true})}/>;
  return <div className="oe-root"><OracleDrawDialog theme={isDarkMode ? 'dark' : 'light'} onClose={close} onInteraction={touchFeedback} introduction={<div className="oracle-draw-intention">
    <details><summary>{question ? 'Your question' : 'Bring a question (optional)'}</summary><label className="oracle-draw-sr" htmlFor="draw-question">Your question</label><textarea id="draw-question" placeholder="What would you like to reflect on?" rows={2} maxLength={1000} value={question} onChange={e=>setQuestion(e.target.value)}/></details>
    <label className="oracle-quick-draw"><input type="checkbox" checked={quick} onChange={e=>setQuick(e.target.checked)}/>Skip artwork reveal</label>
  </div>} onOpen={(number, cast) => {
    try {
      const entry=recordReading({cardNumber:number,question,cast,eventId:eventId.current});
      const card = CARD_BY_NUMBER.get(number);
      if (card) record(number, card.card_name);
      touchFeedback();
      if(quick) openReading(number,cast,entry.id); else setResult({number,cast,entryId:entry.id});
    } catch(e) { setError(e instanceof Error ? e.message : 'This reading could not be saved. Please try again.'); }
  }} />{error && <p role="alert" className="oracle-draw-error">{error}</p>}</div>;
}
function CardReveal({number,question,onClose,onRead,onJournal}:{number:number;question:string;onClose:()=>void;onRead:()=>void;onJournal:()=>void}) {
  const ref=useRef<HTMLDivElement>(null);
  useDialogFocus(ref,true,onClose);
  const card=CARD_BY_NUMBER.get(number)!;
  return <div className="oracle-card-reveal" role="dialog" aria-modal="true" aria-label="Your drawn card" tabIndex={-1} ref={ref}>
    <header><span>Your card · {number}</span><button aria-label="Close drawn card" onClick={onClose}>Close ×</button></header>
    <img src={`/oracle-art/${number}.webp`} alt={`Artwork for ${card.card_name}`}/>
    <h1>{card.card_name}</h1>{question && <p className="oracle-reveal-question">{question}</p>}
    <p>{card.gene_keys.gift}</p>
    <div><button className="oracle-reveal-read" onClick={onRead}>Read this card →</button><button onClick={onJournal}>Write a reflection</button></div>
  </div>;
}
