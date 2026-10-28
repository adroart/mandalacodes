import React, { useState } from 'react';
import { Sun, Moon, Share2, Grid3X3, Sparkles, CircleUserRound, Compass, UserRound } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDarkMode } from '../../DarkModeContext';
import { CARD_BY_NUMBER } from '../../data/oracleData';
import ReaderPreferences from './reading/ReaderPreferences';
import OracleShareSheet from './OracleShareSheet';
export default function OracleNavigation(_props: unknown) {
  const { pathname } = useLocation();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [shareOpen, setShareOpen] = useState(false);
  const card = /^\/universal-language\/\d+$/.test(pathname) ? CARD_BY_NUMBER.get(Number(pathname.split('/').pop())) : undefined;
  return <>
    <header className="oracle-app-nav">
      <Link to="/home" aria-label="Oracle home" className="oracle-app-brand">Oracle</Link>
      <div className="oracle-app-tools">
        {!card && <Link to="/account" aria-label="Account and backup"><UserRound size={21} aria-hidden="true" /></Link>}
        {card && <ReaderPreferences cardNumber={card.number} />}
        {card && <button aria-label="Share this code" onClick={() => setShareOpen(true)}><Share2 size={21} aria-hidden="true" /></button>}
        <button onClick={toggleDarkMode} aria-label={isDarkMode ? 'Use light appearance' : 'Use dark appearance'}>{isDarkMode ? <Sun size={21} aria-hidden="true" /> : <Moon size={21} aria-hidden="true" />}</button>
      </div>
    </header>
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
