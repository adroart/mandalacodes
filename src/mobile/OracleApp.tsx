import React, { lazy, Suspense, useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { DarkModeProvider } from '../../DarkModeContext';
import { ProfileProvider } from '../../lib/profile/context';
import { CollectionsProvider } from '../../lib/collections/context';
import ChunkErrorBoundary from '../../components/ChunkErrorBoundary';
import OracleNavigation from './OracleNavigation';
const Deck = lazy(() => import('../../components/oracle/entry/OracleEntryPage'));
const Reading = lazy(() => import('../../components/UniversalLanguageCard'));
const Profile = lazy(() => import('../../components/OracleProfile'));
const SharedProfile = lazy(() => import('../../components/SharedProfile'));
const Systems = lazy(() => import('../../components/OracleSystems'));
function WebsiteDestination() {
  const location = useLocation();
  return <section className="oracle-app-website"><h1>On Mandala Codes</h1><p>This part of Mandala Codes opens on the website.</p><a href={`https://mandalacodes.com${location.pathname}${location.search}`} target="_blank" rel="noopener noreferrer">Open website ↗</a><Link to="/universal-language">Return to Oracle</Link></section>;
}
function OracleRoutes() {
  const { pathname } = useLocation();
  const reading = /^\/universal-language\/\d+$/.test(pathname);
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  const page = reading ? 'reading' : pathname.startsWith('/profile/shared/') ? 'shared-profile' : pathname === '/profile' ? 'profile' : pathname === '/the-systems' ? 'systems' : 'deck';
  return <div data-site-shell data-app-page={page} className="oracle-app-shell min-h-screen bg-paper-50 text-wood-900">
    {!reading && <OracleNavigation />}
    <main id="main-content"><ChunkErrorBoundary><Suspense fallback={<div className="oracle-app-loading">Opening Oracle…</div>}><Routes>
      <Route path="/" element={<Navigate to="/universal-language" replace />} />
      <Route path="/universal-language" element={<Deck />} />
      <Route path="/universal-language/:number" element={<Reading />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/profile/shared/:data" element={<SharedProfile />} />
      <Route path="/the-systems" element={<Systems />} />
      <Route path="*" element={<WebsiteDestination />} />
    </Routes></Suspense></ChunkErrorBoundary></main>
  </div>;
}
export default function OracleApp() {
  return <DarkModeProvider><ProfileProvider><CollectionsProvider><OracleRoutes /></CollectionsProvider></ProfileProvider></DarkModeProvider>;
}
