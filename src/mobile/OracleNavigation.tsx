import React, { useState, useCallback, useEffect } from 'react';
import { Sun, Moon, Share2, Grid3X3, Sparkles, CircleUserRound, Compass, UserRound, Search, BookOpen, Mic } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDarkMode } from '../../DarkModeContext';
import { CARD_BY_NUMBER } from '../../data/oracleData';
import type {PassageAnchor} from '../../lib/oracle/authoring/passageContext';
import { currentReaderSection,currentNamedReaderSection } from './authoring/readerContext';
import OracleAuthoringSheet from './authoring/OracleAuthoringSheet';
import {humanJobs,subscribeHumanJobs} from './authoring/humanCaptureJobs';
import ReaderPreferences from './reading/ReaderPreferences';
import OracleShareSheet from './OracleShareSheet';
export default function OracleNavigation(_props: unknown) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [shareOpen, setShareOpen] = useState(false);
  const [voiceJobs,setVoiceJobs]=useState(humanJobs);
  useEffect(()=>subscribeHumanJobs(()=>setVoiceJobs(humanJobs())),[]);
  const needsCheck=voiceJobs.some(job=>job.state==='attention'||job.state==='failed');
  const [namedSectionId,setNamedSectionId]=useState<string>();
  const [recordSection, setRecordSection] = useState<string | null>(null);
  const [recordingCard,setRecordingCard]=useState<number|null>(null);
  const [startImmediately,setStartImmediately]=useState(false);
  const [passageAnchors,setPassageAnchors]=useState<PassageAnchor[]>([]);
  const closeRecording=useCallback(()=>{setRecordSection(null);setNamedSectionId(undefined);setRecordingCard(null);setPassageAnchors([]);setStartImmediately(false);},[]);
  useEffect(()=>{const open=(e:Event)=>{const anchors=(e as CustomEvent<PassageAnchor[]>).detail;if(!anchors?.length)return;setRecordingCard(anchors[0].cardNumber);setPassageAnchors(anchors);setRecordSection(anchors[0].sectionId);};window.addEventListener('oracle:re-record',open);return()=>window.removeEventListener('oracle:re-record',open);},[]);
  useEffect(()=>{const open=(e:Event)=>{const detail=(e as CustomEvent<{sectionId?:string;anchors?:PassageAnchor[]}>).detail;setRecordingCard(detail?.anchors?.[0]?.cardNumber??null);setPassageAnchors([]);setStartImmediately(false);setRecordSection(detail?.sectionId??currentReaderSection());};window.addEventListener('oracle:open-recording',open);return()=>window.removeEventListener('oracle:open-recording',open);},[]);
  const card = /^\/universal-language\/\d+$/.test(pathname) ? CARD_BY_NUMBER.get(Number(pathname.split('/').pop())) : undefined;
  return <>
    <header className="oracle-app-nav">
      <Link to="/universal-language" aria-label="Oracle home" className="oracle-app-brand">Oracle</Link>
      <div className="oracle-app-tools">
        {!card && <Link to="/search" aria-label="Search codes"><Search size={20} aria-hidden="true" /></Link>}
        {!card && <Link to="/journal" aria-label="Reading journal"><BookOpen size={20} aria-hidden="true" /></Link>}
        {!card && <Link to="/account" aria-label="Account and backup"><UserRound size={21} aria-hidden="true" /></Link>}

        {card && <button className="oracle-record-trigger" aria-label="Record a voice rewrite" onClick={event=>{const named=currentNamedReaderSection();event.currentTarget.focus({preventScroll:true});setNamedSectionId(named);setRecordingCard(null);setPassageAnchors([]);setStartImmediately(false);setRecordSection(currentReaderSection());}}><Mic size={18} aria-hidden="true"/><span>{needsCheck?'Check':'Record'}</span></button>}
        {card && <button aria-label="Open passage tools" onClick={()=>window.dispatchEvent(new Event('oracle:toggle-passage-tools'))}><BookOpen size={20} aria-hidden="true"/></button>}
        {card && <ReaderPreferences cardNumber={card.number} />}
        {card && <button aria-label="Share this code" onClick={() => setShareOpen(true)}><Share2 size={21} aria-hidden="true" /></button>}
        <button onClick={toggleDarkMode} aria-label={isDarkMode ? 'Use light appearance' : 'Use dark appearance'}>{isDarkMode ? <Sun size={21} aria-hidden="true" /> : <Moon size={21} aria-hidden="true" />}</button>
      </div>
    </header>
    {card && recordSection && <OracleAuthoringSheet cardNumber={recordingCard??card.number} sectionId={recordSection} namedSectionId={namedSectionId} anchors={passageAnchors} startImmediately={startImmediately} onClose={closeRecording} />}
    {card && <OracleShareSheet key={card.number} open={shareOpen} onClose={() => setShareOpen(false)} cardNumber={card.number} cardName={card.card_name} />}
  </>;
}
export function OracleTabBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return <nav className="oracle-app-tabs" aria-label="Oracle">
    <Link to="/universal-language" aria-current={pathname.startsWith('/universal-language') ? 'page' : undefined}><Grid3X3 size={21} aria-hidden="true" /><span>Index</span></Link>
    <button aria-label="Draw a card" onClick={() => navigate('/draw', {state:{returnTo:pathname}})}><Sparkles size={21} aria-hidden="true" /><span>Draw</span></button>
    <Link to="/profile" aria-current={pathname.startsWith('/profile') ? 'page' : undefined}><CircleUserRound size={21} aria-hidden="true" /><span>Birthday</span></Link>
    <Link to="/the-systems" aria-current={pathname === '/the-systems' ? 'page' : undefined}><Compass size={21} aria-hidden="true" /><span>Explore</span></Link>
  </nav>;
}
export const NAV_ITEMS = [
  { path: '/universal-language', label: 'Oracle' },
  { path: '/profile', label: 'Birthday' },
  { path: '/the-systems', label: 'Explore' },
];
