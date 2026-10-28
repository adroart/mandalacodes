import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Sparkles } from 'lucide-react';
import { CARD_BY_NUMBER } from '../../../data/oracleData';
import { todaysEnergy } from '../../../lib/astrology/today';
import { useJournal } from '../../../lib/oracle/journal';
import { useProfile } from '../../../lib/profile/context';
import HexagramGlyph from '../../../components/oracle/HexagramGlyph';
import { useReadingJournal } from '../journal/useReadingJournal';
import './discovery.css';

export default function OracleHome() {
  const [now, setNow] = useState(() => new Date());
  const { entries, record } = useJournal();
  const { entries: readings } = useReadingJournal();
  const { profile } = useProfile();
  useEffect(() => {
    const refresh = () => { if (!document.hidden) setNow(new Date()); };
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  const today = CARD_BY_NUMBER.get(todaysEnergy(now).gate)!;
  const recent = entries.find(entry => CARD_BY_NUMBER.has(entry.n));
  const journalRecent = readings.find(entry => CARD_BY_NUMBER.has(entry.cardNumber));
  const useJournalRecent = journalRecent && (!recent || journalRecent.createdAt >= recent.t);
  const recentCard = useJournalRecent ? CARD_BY_NUMBER.get(journalRecent.cardNumber) : recent && CARD_BY_NUMBER.get(recent.n);
  const personal = profile?.computed.lifesWork && CARD_BY_NUMBER.get(profile.computed.lifesWork.gate);
  return <section className="od-page od-home" aria-labelledby="oracle-home-title">
    <header className="od-heading"><div><p className="od-eyebrow">{now.toLocaleDateString(undefined, {weekday:'long', month:'long', day:'numeric'})}</p><h1 id="oracle-home-title">Your Oracle</h1></div><Link className="od-icon-link" to="/journal" aria-label="Open reading journal"><BookOpen size={23} aria-hidden="true" /></Link></header>
    <Link className="od-today" to={`/universal-language/${today.number}`} state={{entrance:true}} onClick={() => record(today.number, today.card_name)}>
      <div className="od-today-image"><img src={`/oracle-art/${today.number}.webp`} alt="" width={440} height={440} /></div>
      <div className="od-today-copy"><p className="od-eyebrow">Today's code · {today.number}</p><h2>{today.card_name}</h2><p>{today.gene_keys.gift}</p><span className="od-read-action">Read today's code <ArrowRight size={17} aria-hidden="true" /></span></div>
    </Link>
    <p className="od-transit-note">The current Sun transit, shared by everyone.</p>
    <Link className="od-draw" to="/draw" state={{returnTo:'/home'}}><Sparkles size={21} aria-hidden="true" /><span>Draw a card</span><ArrowRight size={19} aria-hidden="true" /></Link>
    {recentCard && <Link className="od-resume" to={`/universal-language/${recentCard.number}`} state={useJournalRecent ? {oracleCast:journalRecent.cast} : undefined}><HexagramGlyph gate={recentCard.number} width={35} /><div><p className="od-eyebrow">Continue reading · {recentCard.number}</p><h2>{recentCard.card_name}</h2></div><ArrowRight size={19} aria-hidden="true" /></Link>}
    <div className="od-home-links"><Link to="/profile"><span className="od-eyebrow">Your Birthday</span><strong>{personal ? `Life's Work · ${personal.number}` : 'Discover your codes'}</strong><span>{personal ? personal.card_name : 'A personal map from your birth moment.'}</span></Link><Link to="/universal-language"><span className="od-eyebrow">The index</span><strong>Explore all 64</strong><span>Find a code by image, name, or theme.</span></Link></div>
    <details className="od-about"><summary>About the Oracle</summary><p>The Universal Language brings the 64 codes into conversation across the I Ching, Gene Keys, Human Design, and the body.</p><p>An instrument of attunement through the cycles of change. For clarity, compassion, and harmony in our thoughts, words, and actions.</p><Link className="od-text-link" to="/the-systems">Explore the systems <ArrowRight size={16} aria-hidden="true" /></Link></details>
  </section>;
}
