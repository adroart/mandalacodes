import React, { lazy, Suspense, useEffect } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { DarkModeProvider } from '../../DarkModeContext';
import { ProfileProvider } from '../../lib/profile/context';
import { CollectionsProvider } from '../../lib/collections/context';
import ChunkErrorBoundary from '../../components/ChunkErrorBoundary';
import { NativeAccountProvider } from './account/NativeAccountProvider';
import OracleNavigation, { OracleTabBar } from './OracleNavigation';
import { useReadingPosition } from './reading/ReaderPreferences';
import { useAccount } from '../../lib/account/useAccount';
const Authoring = lazy(() => import('./authoring/OracleAuthoringPage'));
const Draw = lazy(() => import('./OracleDrawPage'));
const Deck = lazy(() => import('../../components/oracle/entry/OracleEntryPage'));
const SearchIndex = lazy(() => import('./discovery/OracleIndex'));
const Account = lazy(() => import('./account/OracleAccount'));
const Journal = lazy(() => import('./journal/OracleJournal'));
const Home = lazy(() => import('./discovery/OracleHome'));
const Reading = lazy(() => import('../../components/UniversalLanguageCard'));
const Profile = lazy(() => import('../../components/OracleProfile'));
const SharedProfile = lazy(() => import('../../components/SharedProfile'));
const Systems = lazy(() => import('../../components/OracleSystems'));
function WebsiteDestination() {
  const location = useLocation();
  return <section className="oracle-app-website"><h1>On Mandala Codes</h1><p>This part of Mandala Codes opens on the website.</p><a href={`https://mandalacodes.com${location.pathname}${location.search}`} target="_blank" rel="noopener noreferrer">Open website ↗</a><Link to="/universal-language">Return to Oracle</Link></section>;
}
function OracleRoutes() {
  const account=useAccount();
  useEffect(()=>{
    if(account.isLoaded&&account.isSignedIn)void import('./authoring/backgroundRecovery').then(module=>module.resumeSignedInAuthoring()).catch(()=>undefined);
  },[account.isLoaded,account.isSignedIn,account.userId]);
  useEffect(()=>{
    if(account.available&&(!account.isLoaded||!account.isSignedIn))return;
    let active=true,cleanup:(()=>void)|undefined;
    const resume=()=>void import('./authoring/backgroundRecovery').then(module=>{if(!active)return;if(!cleanup)cleanup=module.startPendingHumanRecovery();module.resumePendingHumanAuthoring();}).catch(()=>undefined);
    resume();const visible=()=>{if(!document.hidden)resume();};window.addEventListener('online',resume);document.addEventListener('visibilitychange',visible);return()=>{active=false;cleanup?.();window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',visible);};
  },[account.available,account.isLoaded,account.isSignedIn]);
  const { pathname } = useLocation();
  useReadingPosition(pathname);
  const reading = /^\/universal-language\/\d+$/.test(pathname);
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  const page = pathname === '/draw' ? 'draw' : reading ? 'reading' : pathname.startsWith('/profile/shared/') ? 'shared-profile' : pathname === '/profile' ? 'profile' : pathname === '/the-systems' ? 'systems' : 'deck';
  return <div data-site-shell data-app-page={page} className="oracle-app-shell min-h-screen bg-paper-50 text-wood-900">
    <OracleNavigation key={pathname} />
    <main id="main-content"><ChunkErrorBoundary><Suspense fallback={<div className="oracle-app-loading">Opening Oracle…</div>}><Routes>
      <Route path="/" element={<Navigate to="/universal-language" replace />} />
      <Route path="/search" element={<SearchIndex />} />
      <Route path="/account" element={<Account />} />
      <Route path="/authoring/:number" element={<Authoring />} />
      <Route path="/journal" element={<Journal />} />
      <Route path="/home" element={<Home />} />
      <Route path="/universal-language" element={<Deck />} />
      <Route path="/universal-language/:number" element={<Reading />} />
      <Route path="/draw" element={<Draw />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/profile/shared/:data" element={<SharedProfile />} />
      <Route path="/the-systems" element={<Systems />} />
      <Route path="*" element={<WebsiteDestination />} />
    </Routes></Suspense></ChunkErrorBoundary></main>
    <OracleTabBar />
  </div>;
}
export default function OracleApp() {
  return <DarkModeProvider><NativeAccountProvider enabled={import.meta.env.VITE_ORACLE_NATIVE_ACCOUNTS === 'true'}><ProfileProvider><CollectionsProvider><OracleRoutes /></CollectionsProvider></ProfileProvider></NativeAccountProvider></DarkModeProvider>;
}
