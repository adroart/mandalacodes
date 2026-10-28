import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useDarkMode } from '../../DarkModeContext';
export default function OracleNavigation(_props: unknown) {
  const { pathname } = useLocation();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  return <header className="oracle-app-nav">
    <nav aria-label="Oracle">
      <Link to="/universal-language" aria-current={pathname.startsWith('/universal-language') ? 'page' : undefined}>Oracle</Link>
      <Link to="/profile" aria-current={pathname.startsWith('/profile') ? 'page' : undefined}>Birthday</Link>
      <Link to="/the-systems" aria-current={pathname === '/the-systems' ? 'page' : undefined}>Explore</Link>
    </nav>
    <button onClick={toggleDarkMode} aria-label={isDarkMode ? 'Use light appearance' : 'Use dark appearance'}>{isDarkMode ? <Sun size={21} aria-hidden="true" /> : <Moon size={21} aria-hidden="true" />}</button>
  </header>;
}

export const NAV_ITEMS = [
  { path: '/universal-language', label: 'Oracle' },
  { path: '/profile', label: 'Birthday' },
  { path: '/the-systems', label: 'Explore' },
];
