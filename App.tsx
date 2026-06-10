import React, { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

const UniversalLanguageIndex = lazy(() => import('./components/UniversalLanguageIndex'));
const UniversalLanguageCard = lazy(() => import('./components/UniversalLanguageCard'));
const OracleGateway = lazy(() => import('./components/OracleGateway'));
const OracleSystems = lazy(() => import('./components/OracleSystems'));
const AtlasPage = lazy(() => import('./components/AtlasPage'));
const AdminLogin = lazy(() => import('./components/AdminLogin'));
const AdminAtlas = lazy(() => import('./components/AdminAtlas'));
const StewardClaim = lazy(() => import('./components/atlas/StewardClaim'));
const StewardEdit = lazy(() => import('./components/atlas/StewardEdit'));
const OracleProfile = lazy(() => import('./components/OracleProfile'));
const AccountDashboard = lazy(() => import('./components/AccountDashboard'));
const CollectionsManager = lazy(() => import('./components/account/CollectionsManager'));
const NotFound = lazy(() => import('./components/NotFound'));
const LightweaverLanding = lazy(() => import('./components/lightweaver/LightweaverLanding'));

import Navigation from './components/Navigation';
import { useSeoMeta } from './useSeoMeta';
import { DarkModeProvider } from './DarkModeContext';
import { AccountProvider } from './lib/account/AccountProvider';
import { ProfileProvider } from './lib/profile/context';
import { CollectionsProvider } from './lib/collections/context';

// Two domains share the same Pages bundle:
//   mandalacodes.com           → Oracle / Universal Language / Atlas (default routes)
//   led.mandalacodes.com       → Lightweaver Studio/install/support surface
// Hostname detection picks which route table applies.
const isLedHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  if (host === 'led.mandalacodes.com' || host.startsWith('led.')) return true;
  // Escape hatch: `?led=1` forces the Lightweaver route table on any host,
  // including preview URLs (xxx.mandalacodes.pages.dev) which never match
  // the led. prefix. Sticks in localStorage so the user only needs to add
  // it once per device.
  try {
    if (new URLSearchParams(window.location.search).get('led') === '1') {
      window.localStorage.setItem('force_led_host', '1');
      return true;
    }
    if (window.localStorage.getItem('force_led_host') === '1') return true;
  } catch {}
  return false;
};

const AppInner: React.FC = () => {
  const location = useLocation();
  const ledHost = isLedHost();

  useSeoMeta(location.pathname);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // The Gateway is a fullscreen orbit-arrival screen with its own chrome; the
  // global top bar belongs on every other oracle page. LED host never shows it.
  const showNav = !ledHost && location.pathname !== '/gateway';

  return (
    <Suspense fallback={<div className="min-h-screen bg-wood-900" />}>
      <div className="min-h-screen bg-paper-50 text-wood-900 selection:bg-bronze-200 transition-colors duration-500">
        {showNav && <Navigation />}
        <main id="main-content">
          <div
            key={/^\/universal-language\/\d+$/.test(location.pathname) ? '/universal-language/:n' : location.pathname}
            className="route-fade-in"
          >
            {ledHost ? (
              <Routes>
                {/* led.mandalacodes.com — Studio/install entry. The card is
                    the runtime. */}
                <Route path="/" element={<LightweaverLanding />} />
                <Route path="/local" element={<LightweaverLanding />} />
                <Route path="/control/:host" element={<Navigate to="/" replace />} />
                {/* Legacy /lightweaver/* paths from before the subdomain move */}
                <Route path="/lightweaver" element={<Navigate to="/" replace />} />
                <Route path="/lightweaver/control/:host" element={<Navigate to="/" replace />} />
                {/* Designer is served as a static bundle from /design/ */}
                <Route path="/design" element={<DesignerRedirect />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            ) : (
              <Routes>
                {/* Home — defaults to the Universal Language deck while the rest
                    of the oracle is in development. Restore <OracleGateway /> here
                    to bring the QR-arrival gateway back as the landing. */}
                <Route path="/" element={<Navigate to="/universal-language" replace />} />

                {/* Gateway — the QR-arrival orbit screen, still reachable directly */}
                <Route path="/gateway" element={<OracleGateway />} />

                {/* The Systems — educational page about I Ching / Gene Keys / Human Design */}
                <Route path="/the-systems" element={<OracleSystems />} />

                {/* Universal Language deck */}
                <Route path="/universal-language" element={<UniversalLanguageIndex />} />
                <Route path="/universal-language/:number" element={<UniversalLanguageCard />} />

                {/* Atlas — globe of placed Universal Language pieces with kinship arcs */}
                <Route path="/atlas" element={<AtlasPage />} />
                <Route path="/atlas/claim" element={<StewardClaim />} />
                <Route path="/atlas/edit" element={<StewardEdit />} />

                {/* Admin — atlas ledger + steward key issuance */}
                <Route path="/admin" element={<Navigate to="/admin/atlas" replace />} />
                <Route path="/admin/login" element={<AdminLogin />} />
                <Route path="/admin/atlas" element={<AdminAtlas />} />

                {/* Hologenetic Profile (local-first, optionally synced when signed in) */}
                <Route path="/profile" element={<OracleProfile />} />

                {/* Account dashboard + collections (only reachable when accounts flag is on) */}
                <Route path="/account" element={<AccountDashboard />} />
                <Route path="/account/collections" element={<CollectionsManager />} />

                {/* Lightweaver — kept for backward compatibility; the live home
                    is led.mandalacodes.com root. */}
                <Route path="/lightweaver" element={<LightweaverLanding />} />
                <Route path="/lightweaver/control/:host" element={<LightweaverLanding />} />

                {/* Legacy /oracle/* paths — redirect to the new flat structure. */}
                <Route path="/oracle" element={<Navigate to="/" replace />} />
                <Route path="/oracle/the-systems" element={<Navigate to="/the-systems" replace />} />
                <Route path="/oracle/universal-language" element={<Navigate to="/universal-language" replace />} />
                <Route path="/oracle/universal-language/:number" element={<RedirectToFlatCard />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            )}
          </div>
        </main>
      </div>
    </Suspense>
  );
};

// Designer is a static bundle under /design/index.html. Cloudflare Pages
// serves that path directly. If the React router gets here, redirect via
// a full page load so the static bundle takes over.
const DesignerRedirect: React.FC = () => {
  useEffect(() => {
    if (typeof window !== 'undefined') window.location.replace('/design/');
  }, []);
  return <div className="min-h-screen bg-wood-900" />;
};

// Preserve the :number param — and the navigation state (the ritual-entrance
// flag rides on it) — when redirecting from the legacy
// /oracle/universal-language/:n path.
const RedirectToFlatCard: React.FC = () => {
  const location = useLocation();
  const num = location.pathname.split('/').pop();
  return <Navigate to={`/universal-language/${num}${location.search}`} state={location.state} replace />;
};

const App: React.FC = () => (
  <DarkModeProvider>
    <AccountProvider>
      <ProfileProvider>
        <CollectionsProvider>
          <AppInner />
        </CollectionsProvider>
      </ProfileProvider>
    </AccountProvider>
  </DarkModeProvider>
);

export default App;
