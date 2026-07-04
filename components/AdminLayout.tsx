import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAccount } from '../lib/account/useAccount';
import { signOut } from '../lib/account/authClient';

/**
 * Wraps admin routes. Checks Better Auth session client-side, then verifies
 * the user's email is on the admin allowlist by pinging an admin-gated
 * endpoint we trust to return 403 cleanly. Falls back to /admin/login on any
 * unauthenticated state.
 *
 * Two-stage check: the session cookie says "you are signed in" → we still ask
 * the server "but are you admin?" The server is the only source of truth on
 * the ADMIN_EMAILS allowlist. The session rides along on the cookie via
 * fetchAuthed (credentials: 'include') — there is no bearer token anymore.
 */
const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoaded, isSignedIn, email, fetchAuthed } = useAccount();
  const navigate = useNavigate();
  const location = useLocation();
  const [adminVerified, setAdminVerified] = useState<'checking' | 'yes' | 'no'>('checking');

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      navigate('/admin/login', {
        state: { from: location.pathname },
        replace: true,
      });
      return;
    }
    // Ping an admin-gated endpoint. /api/atlas/stewards is GET-only and
    // requires admin; 200 means allowlist passed, 403 means signed-in but
    // not admin, 401 means no valid session. The session cookie rides along
    // via fetchAuthed (credentials: 'include') — no bearer token.
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchAuthed('/api/atlas/stewards');
        if (cancelled) return;
        if (res.ok) {
          setAdminVerified('yes');
        } else {
          setAdminVerified('no');
        }
      } catch {
        if (!cancelled) setAdminVerified('no');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, fetchAuthed, navigate, location.pathname]);

  const logout = async () => {
    await signOut();
    navigate('/admin/login', { replace: true });
  };

  if (!isLoaded || adminVerified === 'checking') {
    return (
      <div className="min-h-screen bg-paper-50 flex items-center justify-center">
        <span className="font-label text-xs uppercase tracking-[0.2em] text-wood-400 font-semibold">
          Checking session...
        </span>
      </div>
    );
  }

  if (adminVerified === 'no') {
    return (
      <div className="min-h-screen bg-paper-50 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold mb-3">
            Access denied
          </p>
          <h1 className="font-serif text-2xl text-wood-900 font-medium mb-4">
            Not an admin.
          </h1>
          <p className="font-sans text-sm text-wood-600 leading-relaxed mb-8">
            You are signed in as{' '}
            <span className="text-wood-900">
              {email ?? 'unknown'}
            </span>
            , but that email is not on the admin allowlist.
          </p>
          <button
            onClick={logout}
            className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-500 hover:text-wood-900 transition-colors font-semibold"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper-50">
      <div className="border-b border-wood-200 bg-white px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <Link
            to="/admin/atlas"
            className={`font-label text-[11px] uppercase tracking-[0.2em] transition-colors font-semibold flex items-center gap-1.5 ${
              location.pathname === '/admin/atlas'
                ? 'text-bronze-800'
                : 'text-bronze-600 hover:text-bronze-800'
            }`}
          >
            Atlas
          </Link>
          <Link
            to="/admin/piece-content"
            className={`font-label text-[11px] uppercase tracking-[0.2em] transition-colors font-semibold ${
              location.pathname === '/admin/piece-content'
                ? 'text-bronze-800'
                : 'text-bronze-600 hover:text-bronze-800'
            }`}
          >
            Piece Content
          </Link>
          <span className="text-wood-200">|</span>
          <span className="font-sans text-xs text-wood-400">
            {email}
          </span>
        </div>
        <button
          onClick={logout}
          className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-400 hover:text-wood-900 transition-colors font-semibold"
        >
          Log out
        </button>
      </div>
      {children}
    </div>
  );
};

export default AdminLayout;
