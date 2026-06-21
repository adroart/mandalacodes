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
 * Self-owned sign-in modal. Three ways in:
 *   - Continue with Google (shown when configured)
 *   - Email + password (create account / log in)
 *   - Email me a code instead (no password)
 * Styled in the site's paper / wood / bronze system, and theme-aware: it
 * follows the active light/dark mode rather than forcing a light card.
 */

// Palette per theme. The modal follows the active mode so a dark-mode visitor
// gets a dark card (the old pinned-light surface read as a white box in dark).
const LIGHT = {
  surface: '#f5f4f0', field: '#ffffff', border: '#e0d8cc', ink: '#262321',
  sub: '#8f7a5b', bronze: '#8a744e', fieldBorder: '#c8bda8',
};
const DARK = {
  surface: '#1d1813', field: '#241e17', border: 'rgba(196,170,124,0.30)', ink: '#f0ece4',
  sub: '#a99a82', bronze: '#dabd8b', fieldBorder: 'rgba(196,170,124,0.34)',
};

type Mode = 'login' | 'signup' | 'code-email' | 'code-verify';

/**
 * `context` reframes the same modal for where it was opened from:
 *   - 'reading' → opened from "save my reading" (a card is on screen): keep it.
 *   - 'codes'   → opened from the deck picker (no single card): light your codes.
 *   - 'default' → generic account sign-in.
 * The auth controls are identical; only the header + one benefit line change, so
 * the moment reads as claiming something, not logging in.
 */
type SignInContext = 'reading' | 'codes' | 'default';

const SignInModal: React.FC<{
  onClose: () => void;
  onSignedIn?: () => void;
  context?: SignInContext;
}> = ({ onClose, onSignedIn, context = 'default' }) => {
  const { isDarkMode } = useDarkMode();
  const C = isDarkMode ? DARK : LIGHT;
  const [mode, setMode] = useState<Mode>('login');
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
      await signInWithGoogle('/');
      // Redirects away; nothing more to do here.
    } catch {
      setBusy(false);
      setError('Could not start Google sign-in. Try another way below.');
    }
  };

  const doPassword = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    const { error } = mode === 'signup'
      ? await signUpWithPassword(email.trim(), password, name.trim())
      : await signInWithPassword(email.trim(), password);
    setBusy(false);
    if (error) {
      setError(
        mode === 'signup'
          ? 'Could not create the account. The email may already be in use, or the password is too short (8+ characters).'
          : 'Email or password did not match. Try again, or create an account.',
      );
      return;
    }
    done();
  };

  const sendCode = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    const { error } = await sendSignInCode(email.trim());
    setBusy(false);
    if (error) { setError('Could not send the code. Check the email and try again.'); return; }
    setMode('code-verify');
  };

  const verify = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    const { error } = await verifySignInCode(email.trim(), code.trim());
    setBusy(false);
    if (error) { setError('That code did not match. Try again, or request a new one.'); return; }
    done();
  };

  const labelCls = 'block mb-2';
  const labelStyle: React.CSSProperties = {
    fontFamily: 'Lato, Helvetica, sans-serif', fontSize: 11, letterSpacing: '0.15em',
    textTransform: 'uppercase', color: C.sub, fontWeight: 600,
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', border: `1px solid ${C.fieldBorder}`, background: C.field,
    padding: '12px 16px', fontFamily: 'Lato, Helvetica, sans-serif', fontSize: 16, color: C.ink,
  };
  const primaryStyle: React.CSSProperties = {
    width: '100%', background: C.ink, color: C.surface,
    fontFamily: 'Lato, Helvetica, sans-serif', fontSize: 11, letterSpacing: '0.2em',
    textTransform: 'uppercase', fontWeight: 600, padding: '12px', cursor: 'pointer', border: 0,
  };
  const linkStyle: React.CSSProperties = {
    background: 'transparent', border: 0, cursor: 'pointer', color: C.bronze,
    fontFamily: 'Lato, Helvetica, sans-serif', fontSize: 11, letterSpacing: '0.12em',
    textTransform: 'uppercase', fontWeight: 600, padding: '6px 0',
  };

  // Context-framed header for the entry modes (login/signup). Code steps keep
  // their literal titles since they're mid-flow.
  const ctxTitle =
    context === 'reading' ? 'Keep this reading'
    : context === 'codes' ? 'See your codes light up'
    : 'Sign in';
  const ctxSubtitle =
    context === 'reading' ? 'Sign in and your reading is kept — your codes stay lit across every visit.'
    : context === 'codes' ? 'Sign in and your codes light up across all sixty-four, kept for every visit.'
    : 'Welcome back.';

  const title =
    mode === 'signup' ? 'Create your account'
    : mode === 'code-email' ? 'Sign in with a code'
    : mode === 'code-verify' ? 'Enter your code'
    : ctxTitle;

  const subtitle =
    mode === 'signup' ? 'Your reading and your codes, kept across every visit.'
    : mode === 'code-email' ? 'We will email you a one-time code. No password.'
    : mode === 'code-verify' ? `We sent a code to ${email}.`
    : ctxSubtitle;

  const brandLine = context === 'default' ? 'Adrian Rasmussen Art' : 'Mandala Codes';

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
          width: '100%', maxWidth: 384, background: C.surface,
          border: `1px solid ${C.border}`, boxShadow: '0 20px 50px -20px rgba(0,0,0,0.4)',
          padding: 32, color: C.ink,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <p style={{ ...labelStyle, color: C.bronze, marginBottom: 8 }}>{brandLine}</p>
          <h2 style={{ fontFamily: '"Cormorant Garamond", serif', fontSize: 26, color: C.ink, fontWeight: 500, margin: 0 }}>
            {title}
          </h2>
          <p style={{ fontFamily: 'Lato, Helvetica, sans-serif', fontSize: 14, color: C.sub, marginTop: 8 }}>
            {subtitle}
          </p>
        </div>

        {error && (
          <div style={{
            marginBottom: 16, padding: '8px 12px',
            border: `1px solid ${isDarkMode ? 'rgba(220,150,150,0.4)' : '#d99'}`,
            background: isDarkMode ? 'rgba(138,42,42,0.18)' : '#fbeaea',
            color: isDarkMode ? '#e6a6a6' : '#8a2a2a', fontFamily: 'Lato, sans-serif', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        {/* Password modes (login / signup) */}
        {(mode === 'login' || mode === 'signup') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Compact two-up: one tap with Google, or get a code by email. The
                fast paths sit small and side by side, the way Cloudflare's does. */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={doGoogle} disabled={busy} style={{
                ...inputStyle, flex: 1, minWidth: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8, cursor: 'pointer', fontWeight: 600,
                fontSize: 13, padding: '11px 12px',
              }}>
                <GoogleMark /> Google
              </button>
              <button type="button" onClick={() => { setError(null); setMode('code-email'); }} disabled={busy} style={{
                ...inputStyle, flex: 1, minWidth: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8, cursor: 'pointer', fontWeight: 600,
                fontSize: 13, padding: '11px 12px',
              }}>
                Email me a code
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.sub }}>
              <span style={{ flex: 1, height: 1, background: C.border }} />
              <span style={{ fontFamily: 'Lato, sans-serif', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em' }}>or</span>
              <span style={{ flex: 1, height: 1, background: C.border }} />
            </div>

            {mode === 'signup' && (
              <div>
                <label className={labelCls} style={labelStyle}>Name (optional)</label>
                <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Your name" />
              </div>
            )}
            <div>
              <label className={labelCls} style={labelStyle}>Email</label>
              <input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="you@example.com" />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doPassword()}
                style={inputStyle}
                placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
              />
            </div>
            <button type="button" onClick={doPassword} disabled={busy || !email.trim() || !password} style={primaryStyle}>
              {busy ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>

            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 4 }}>
              <button type="button" style={linkStyle} onClick={() => { setError(null); setMode(mode === 'signup' ? 'login' : 'signup'); }}>
                {mode === 'signup' ? 'Have an account? Sign in' : 'Create an account'}
              </button>
            </div>
          </div>
        )}

        {/* Code request */}
        {mode === 'code-email' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className={labelCls} style={labelStyle}>Email</label>
              <input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendCode()} style={inputStyle} placeholder="you@example.com" />
            </div>
            <button type="button" onClick={sendCode} disabled={busy || !email.trim()} style={primaryStyle}>
              {busy ? 'Sending...' : 'Send code'}
            </button>
            <button type="button" style={linkStyle} onClick={() => { setError(null); setMode('login'); }}>
              Back to sign in
            </button>
          </div>
        )}

        {/* Code verify */}
        {mode === 'code-verify' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label className={labelCls} style={labelStyle}>6-digit code</label>
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => e.key === 'Enter' && verify()}
                style={{ ...inputStyle, textAlign: 'center', letterSpacing: '0.3em' }}
                placeholder="123456"
              />
            </div>
            <button type="button" onClick={verify} disabled={busy || code.length < 6} style={primaryStyle}>
              {busy ? 'Verifying...' : 'Sign in'}
            </button>
            <button type="button" style={linkStyle} onClick={() => { setError(null); setCode(''); setMode('code-email'); }}>
              Use a different email
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

const GoogleMark: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.3 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.8-9.8 6.8-17.4z" />
    <path fill="#FBBC05" d="M10.4 28.3c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.8-6.1C.9 16.1 0 19.9 0 23.7s.9 7.6 2.6 10.7l7.8-6.1z" />
    <path fill="#34A853" d="M24 47.4c6.2 0 11.4-2 15.2-5.5l-7.3-5.7c-2 1.4-4.7 2.3-7.9 2.3-6.3 0-11.7-3.8-13.6-9.3l-7.8 6.1C6.5 42 14.6 47.4 24 47.4z" />
  </svg>
);

export default SignInModal;
