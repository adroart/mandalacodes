import React, { useCallback, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDarkMode } from '../../DarkModeContext';
import { CARD_BY_NUMBER } from '../../data/oracleData';
import { useJournal } from '../../lib/oracle/journal';
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
  const [error,setError] = useState('');
  const eventId = useRef(crypto.randomUUID());
  const returnTo = typeof state?.returnTo === 'string' && state.returnTo.startsWith('/') && state.returnTo !== '/draw' ? state.returnTo : '/home';
  const close = useCallback(() => navigate(returnTo, {replace:true}), [navigate, returnTo]);
  const openReading=(number:number,cast?:CastResult,entryId?:string)=>navigate(`/universal-language/${number}`, {replace:true, state:{entrance:true, oracleCast:cast, journalEntryId:entryId}});
  return <div className="oe-root"><OracleDrawDialog theme={isDarkMode ? 'dark' : 'light'} onClose={close} onInteraction={touchFeedback} introduction={<div className="oracle-draw-intention">
    <details><summary>{question ? 'Your question' : 'Bring a question (optional)'}</summary><label className="oracle-draw-sr" htmlFor="draw-question">Your question</label><textarea id="draw-question" placeholder="What would you like to reflect on?" rows={2} maxLength={1000} value={question} onChange={e=>setQuestion(e.target.value)}/></details>
  </div>} onOpen={(number, cast) => {
    try {
      const entry=recordReading({cardNumber:number,question,cast,eventId:eventId.current});
      const card = CARD_BY_NUMBER.get(number);
      if (card) record(number, card.card_name);
      touchFeedback();
      openReading(number,cast,entry.id);
    } catch(e) { setError(e instanceof Error ? e.message : 'This reading could not be saved. Please try again.'); }
  }} />{error && <p role="alert" className="oracle-draw-error">{error}</p>}</div>;
}
