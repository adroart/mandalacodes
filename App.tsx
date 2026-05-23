import React, { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

const UniversalLanguageIndex = lazy(() => import('./components/UniversalLanguageIndex'));
const UniversalLanguageCard = lazy(() => import('./components/UniversalLanguageCard'));
const OracleGateway = lazy(() => import('./components/OracleGateway'));
const OracleSystems = lazy(() => import('./components/OracleSystems'));
const AtlasPage = lazy(() => import('./components/AtlasPage'));
const NotFound = lazy(() => import('./components/NotFound'));

import { useSeoMeta } from './useSeoMeta';
import { DarkModeProvider } from './DarkModeContext';

const AppInner: React.FC = () => {
  const location = useLocation();

  useSeoMeta(location.pathname);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <Suspense fallback={<div className="min-h-screen bg-wood-900" />}>
      <div className="min-h-screen bg-paper-50 text-wood-900 selection:bg-bronze-200 transition-colors duration-500">
        <main id="main-content">
          <div
            key={/^\/universal-language\/\d+$/.test(location.pathname) ? '/universal-language/:n' : location.pathname}
            className="route-fade-in"
          >
            <Routes>
              {/* Home — gateway becomes the landing page */}
              <Route path="/" element={<OracleGateway />} />

              {/* The Systems — educational page about I Ching / Gene Keys / Human Design */}
              <Route path="/the-systems" element={<OracleSystems />} />

              {/* Universal Language deck */}
              <Route path="/universal-language" element={<UniversalLanguageIndex />} />
              <Route path="/universal-language/:number" element={<UniversalLanguageCard />} />

              {/* Atlas — globe of placed Universal Language pieces with kinship arcs */}
              <Route path="/atlas" element={<AtlasPage />} />

              {/* Legacy /oracle/* paths — redirect to the new flat structure.
                  Catches anyone who copied a URL from the old domain before adrianrasmussen.com
                  redirects were in place. */}
              <Route path="/oracle" element={<Navigate to="/" replace />} />
              <Route path="/oracle/the-systems" element={<Navigate to="/the-systems" replace />} />
              <Route path="/oracle/universal-language" element={<Navigate to="/universal-language" replace />} />
              <Route path="/oracle/universal-language/:number" element={<RedirectToFlatCard />} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </main>
      </div>
    </Suspense>
  );
};

// Preserve the :number param when redirecting from the legacy /oracle/universal-language/:n path.
const RedirectToFlatCard: React.FC = () => {
  const location = useLocation();
  const num = location.pathname.split('/').pop();
  return <Navigate to={`/universal-language/${num}${location.search}`} replace />;
};

const App: React.FC = () => (
  <DarkModeProvider>
    <AppInner />
  </DarkModeProvider>
);

export default App;
