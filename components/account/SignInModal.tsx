import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useDarkMode } from '../../DarkModeContext';
import {
  sendSignInCode,
  verifySignInCode,
  signInWithPassword,
  signUpWithPassword,
  signInWithGoogle,
} from '../../lib/account/authClient';

/**
 * The "Welcome" sign-in modal.
 *
 * How the auth really works (and why this UI is shaped the way it is):
 *   - Continue with Google      → logs in an existing Google member OR creates.
 *   - Email me a code           → logs in OR creates on first verify.
 *   - Email + password          → the one door where create and log in differ,
 *                                 so it carries an explicit toggle.
 * The server links all three to ONE account by email (auth.server.js →
 * account.accountLinking), so the same person using Google one day and a code
 * the next is a single account, not two. That means there is no "new vs
 * returning" fork at the top: every door serves both. The only choice that
 * matters is whether you want a password, and that lives inside the password
 * panel.
 *
 *   welcome  → the three doors: Google, email code, "use email and password".
 *   password → email + password, defaulting to Log in, with a New-here toggle
 *              to create, and "email me a code instead" as the no-dead-end out.
 *   code     → enter the six-digit code.
 *
 * Theme-aware: follows the active light/dark mode.
 */

const LIGHT = {
  surface: '#ffffff', field: '#f3f1ec', border: '#e3ddd1', ink: '#262321',
  sub: '#8a7a5e', bronze: '#8a744e', onBronze: '#f7f5f1', fieldBorder: '#d2c7b4',
  faint: '#a89070', line: '#e3ddd1', glow: 'rgba(196,170,124,0.18)',
};
const DARK = {
  surface: '#241e17', field: '#1d1813', border: 'rgba(196,170,124,0.26)', ink: '#f0ece4',
  sub: '#a99a82', bronze: '#dabd8b', onBronze: '#241e17', fieldBorder: 'rgba(196,170,124,0.30)',
  faint: '#8c7f6b', line: 'rgba(196,170,124,0.18)', glow: 'rgba(196,170,124,0.16)',
};

type Mode = 'welcome' | 'email' | 'password' | 'code';
type SignInContext = 'reading' | 'codes' | 'default';

const SignInModal: React.FC<{
  onClose: () => void;
  onSignedIn?: () => void;
  context?: SignInContext;
}> = ({ onClose, onSignedIn, context = 'default' }) => {
  const { isDarkMode } = useDarkMode();
  const C = isDarkMode ? DARK : LIGHT;
  const [mode, setMode] = useState<Mode>('welcome');
  const [createNew, setCreateNew] = useState(false); // password panel: create vs log in
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = () => { onSignedIn?.(); onClose(); };

  const doGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      // Return to the page the modal was opened from (e.g. the card the
      // visitor was trying to save), not the homepage. Google does a
      // full-page redirect, so this is the only way that intent survives
      // the round trip.
      const returnTo = window.location.pathname + window.location.search;
      const { error } = await signInWithGoogle(returnTo);
      if (error) {
        // Better Auth's client resolves with { error } rather than throwing
        // (e.g. PROVIDER_NOT_FOUND when Google isn't configured server-side).
        // Without this check the button silently stayed disabled forever.
        setBusy(false);
        setError('Google sign-in is not available right now. Try a code or password below.');
      }
      // On success the client redirects the browser to Google; leave busy=true
      // so the button stays disabled through the navigation.
    } catch {
      setBusy(false);
      setError('Could not start Google sign-in. Try a code or password below.');
    }
  };

  const doPassword = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const { error } = createNew
        ? await signUpWithPassword(email.trim(), password, name.trim())
        : await signInWithPassword(email.trim(), password);
      setBusy(false);
      if (error) {
        setError(
          createNew
            ? 'Could not create the account. The email may already be in use (try Log in), or the password is under 8 characters.'
            : 'Email or password did not match. Try again, create an account, or get a code instead.',
        );
        return;
      }
      done();
    } catch {
      setBusy(false);
      setError('Could not reach the server. Check your connection and try again.');
    }
  };

  const sendCode = async () => {
    if (!email.trim()) { setMode('email'); return; }
    setBusy(true);
    setError(null);
    try {
      // One path for new and returning: the code logs in or creates on verify.
      const { error } = await sendSignInCode(email.trim());
      setBusy(false);
      if (error) { setError('Could not send the code. Check the email and try again.'); return; }
      setMode('code');
    } catch {
      setBusy(false);
      setError('Could not reach the server. Check your connection and try again.');
    }
  };

  const verify = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { error } = await verifySignInCode(email.trim(), code.trim());
      setBusy(false);
      if (error) { setError('That code did not match. Try again, or request a new one.'); return; }
      done();
    } catch {
      setBusy(false);
      setError('Could not reach the server. Check your connection and try again.');
    }
  };

  // ── styles ──
  const fieldLabel: React.CSSProperties = {
    display: 'block', textAlign: 'left',
    fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 700,
    letterSpacing: '0.14em', textTransform: 'uppercase', color: C.sub, margin: '0 0 6px',
  };
  const fieldStyle: React.CSSProperties = {
    width: '100%', border: `1px solid ${C.fieldBorder}`, background: C.field,
    borderRadius: 12, padding: '13px 15px',
    fontFamily: 'var(--font-ui)', fontSize: 16, color: C.ink, marginBottom: 14,
  };
  const primaryStyle: React.CSSProperties = {
    width: '100%', cursor: 'pointer', background: C.bronze, color: C.onBronze, border: 'none',
    borderRadius: 12, padding: 14,
    fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700,
    letterSpacing: '0.12em', textTransform: 'uppercase',
  };
  const pillPrimary: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    cursor: 'pointer', background: C.bronze, color: C.onBronze, border: 'none',
    borderRadius: 999, padding: 14,
    fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 700, marginBottom: 10,
  };
  const pillSecondary: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    cursor: 'pointer', background: C.surface, color: C.ink, border: `1px solid ${C.fieldBorder}`,
    borderRadius: 999, padding: 13,
    fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 500, marginBottom: 10,
  };
  const backBtn: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', background: 'none',
    border: 'none', padding: 0, margin: '0 auto 16px',
    fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700,
    letterSpacing: '0.12em', textTransform: 'uppercase', color: C.bronze,
  };
  const altLine: React.CSSProperties = {
    marginTop: 14, fontFamily: 'var(--font-ui)', fontSize: 12, color: C.sub,
  };
  const altLink: React.CSSProperties = {
    color: C.bronze, textDecoration: 'none', fontWeight: 700, background: 'none', border: 'none',
    cursor: 'pointer', font: 'inherit', padding: 0,
  };

  const headline =
    mode === 'password' ? (createNew ? 'Create your account' : 'Welcome back')
    : mode === 'email' ? 'Sign in with a code'
    : mode === 'code' ? 'Check your email'
    : 'Keep your chart';

  const subline =
    mode === 'password'
      ? (createNew
          ? 'Choose a password and your chart is kept across every visit.'
          : 'Log in to find your chart where you left it.')
    : mode === 'email' ? "Enter your email and we'll send a six-digit code. No password needed."
    : mode === 'code' ? `We sent a six-digit code to ${email || 'your email'}.`
    : context === 'reading'
      ? 'Your placement, kept across every visit and lit on every card.'
      : 'Your placement, lit across all sixty-four and kept for every visit.';

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 24,
        background: 'rgba(38,35,33,0.45)', backdropFilter: 'blur(3px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%', maxWidth: 340, background: C.surface,
          borderRadius: 20, boxShadow: '0 24px 60px -20px rgba(0,0,0,0.45)',
          padding: '30px 26px', color: C.ink, textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {mode !== 'welcome' && (
          <button type="button" style={backBtn} onClick={() => { setError(null); setMode('welcome'); }}>
            ← Back
          </button>
        )}

        {mode === 'welcome' && (
          <div style={{
            width: 54, height: 54, margin: '0 auto 16px', borderRadius: '50%',
            border: `1.5px solid ${C.bronze}`, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: C.glow,
          }}>
            <span style={{ width: 18, height: 18, borderRadius: '50%', border: `1.5px solid ${C.bronze}` }} />
          </div>
        )}

        <p style={{
          fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 700,
          letterSpacing: '0.24em', textTransform: 'uppercase', color: C.bronze, margin: '0 0 10px',
        }}>
          Mandala Codes
        </p>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 28,
          lineHeight: 1.05, color: C.ink, margin: '0 0 6px',
        }}>
          {headline}
        </h2>
        <p style={{
          fontFamily: 'var(--font-reading)', fontStyle: 'italic', fontSize: 17,
          color: C.sub, lineHeight: 1.35, margin: '0 0 22px',
        }}>
          {subline}
        </p>

        {error && (
          <div style={{
            marginBottom: 16, padding: '8px 12px', borderRadius: 10, textAlign: 'left',
            border: `1px solid ${isDarkMode ? 'rgba(220,150,150,0.4)' : '#e0b3b3'}`,
            background: isDarkMode ? 'rgba(138,42,42,0.18)' : '#fbeaea',
            color: isDarkMode ? '#e6a6a6' : '#8a2a2a',
            fontFamily: 'var(--font-ui)', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* ── Welcome: three doors, each logs in OR creates ── */}
        {mode === 'welcome' && (
          <>
            <button type="button" onClick={doGoogle} disabled={busy} style={pillPrimary}>
              <GoogleMark /> Continue with Google
            </button>
            <button type="button" onClick={() => { setError(null); setMode('email'); }} disabled={busy} style={pillSecondary}>
              Email me a sign-in code
            </button>
            <button
              type="button"
              onClick={() => { setError(null); setCreateNew(false); setMode('password'); }}
              style={pillSecondary}
            >
              Use email and password
            </button>
            <p style={{
              marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.line}`,
              fontFamily: 'var(--font-ui)', fontSize: 13, color: C.sub,
            }}>
              Every option signs you in or sets you up. One account, however you return.
            </p>
          </>
        )}

        {/* ── Password: explicit log-in vs create (the one door where they differ) ── */}
        {mode === 'password' && (
          <>
            {createNew && (
              <>
                <label style={fieldLabel}>Name (optional)</label>
                <input value={name} onChange={(e) => setName(e.target.value)} style={fieldStyle} placeholder="Your name" />
              </>
            )}
            <label style={fieldLabel}>Email</label>
            <input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} style={fieldStyle} placeholder="you@example.com" />
            <label style={fieldLabel}>Password</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doPassword()} style={fieldStyle}
              placeholder={createNew ? 'At least 8 characters' : 'Your password'}
            />
            <button type="button" onClick={doPassword} disabled={busy || !email.trim() || !password} style={primaryStyle}>
              {busy ? 'Please wait…' : createNew ? 'Create account' : 'Log in'}
            </button>
            <p style={altLine}>
              {createNew ? (
                <>Already have an account?{' '}
                  <button type="button" style={altLink} onClick={() => { setError(null); setCreateNew(false); }}>Log in</button>
                </>
              ) : (
                <>New here?{' '}
                  <button type="button" style={altLink} onClick={() => { setError(null); setCreateNew(true); }}>Create an account</button>
                </>
              )}
            </p>
            <p style={{ ...altLine, marginTop: 6 }}>
              <button type="button" style={altLink} onClick={() => { setError(null); sendCode(); }} disabled={busy || !email.trim()}>
                Email me a code instead
              </button>
            </p>
          </>
        )}

        {/* ── Email entry for the code path ── */}
        {mode === 'email' && (
          <>
            <label style={fieldLabel}>Email</label>
            <input
              type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendCode()} style={fieldStyle} placeholder="you@example.com"
            />
            <button type="button" onClick={sendCode} disabled={busy || !email.trim()} style={primaryStyle}>
              {busy ? 'Sending…' : 'Email me a code'}
            </button>
          </>
        )}

        {/* ── Code verify ── */}
        {mode === 'code' && (
          <>
            <label style={fieldLabel}>Six-digit code</label>
            <input
              type="text" inputMode="numeric" autoFocus value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && verify()}
              style={{ ...fieldStyle, textAlign: 'center', letterSpacing: '0.3em' }} placeholder="123456"
            />
            <button type="button" onClick={verify} disabled={busy || code.length < 6} style={primaryStyle}>
              {busy ? 'Verifying…' : 'Continue'}
            </button>
            <p style={altLine}>
              <button type="button" style={altLink} onClick={() => { setError(null); setCode(''); setMode('welcome'); }}>
                Use a different way in
              </button>
            </p>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};

const GoogleMark: React.FC = () => (
  <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.3 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.8-9.8 6.8-17.4z" />
    <path fill="#FBBC05" d="M10.4 28.3c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.8-6.1C.9 16.1 0 19.9 0 23.7s.9 7.6 2.6 10.7l7.8-6.1z" />
    <path fill="#34A853" d="M24 47.4c6.2 0 11.4-2 15.2-5.5l-7.3-5.7c-2 1.4-4.7 2.3-7.9 2.3-6.3 0-11.7-3.8-13.6-9.3l-7.8 6.1C6.5 42 14.6 47.4 24 47.4z" />
  </svg>
);

export default SignInModal;
