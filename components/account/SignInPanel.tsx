import React, { useState } from 'react';
import {
  sendSignInCode,
  verifySignInCode,
  signInWithPassword,
  signUpWithPassword,
  signInWithGoogle,
} from '../../lib/account/authClient';

/**
 * The sign-in form, free of any modal chrome. Three ways in:
 *   - Continue with Google (shown when configured)
 *   - Email + password (create account / log in)
 *   - Email me a code instead (no password)
 *
 * Rendered inline inside the account page (the signed-out state of
 * /account) so signing in happens *within* the whole account surface, not in
 * a popup. Colors are pinned to the light paper/wood/bronze system so the
 * panel reads correctly in dark mode.
 */

// Tokens borrowed from the Oracle entry's tile grammar (rounded soft-fill
// surfaces, bronze accent, warm hairlines) so the form reads as the same
// material as the rest of the site rather than a default rectangular form.
// All resolve through the global paper/wood/bronze variables, so they invert
// in dark mode with everything else.
const C = {
  ink: 'var(--color-wood-900)',
  sub: 'var(--color-wood-500)',
  faint: 'var(--color-wood-400)',
  bronze: 'var(--color-bronze-600)',
  accent: 'var(--color-bronze-600)',
  // Whisper-thin hairlines, no fills. Classy = restraint: fields are defined by
  // a single underline, not a boxed surface; nothing is washed.
  line: 'color-mix(in oklab, var(--color-wood-600) 26%, transparent)',
  lineStrong: 'color-mix(in oklab, var(--color-wood-700) 42%, transparent)',
  onAccent: 'var(--color-paper-50)',
};

type Mode = 'login' | 'signup' | 'code-email' | 'code-verify';

/**
 * @param bare  When true, drops the boxed card chrome (border, shadow, pinned
 *   surface) and the redundant "Mandala Codes / Sign in" header so the form
 *   sits directly on the account page as one of its sections. Used by the
 *   signed-out account page; the standalone/modal use leaves it false.
 * @param horizontal  When true, the primary (login/signup) view lays its parts
 *   out across a wide band — heading + Google on the left, a vertical rule,
 *   then the email/password fields and the Sign in pill on the right — instead
 *   of one tall column. The short code modes stay vertical. Mobile collapses
 *   back to a column automatically.
 */
const SignInPanel: React.FC<{ onSignedIn?: () => void; bare?: boolean; horizontal?: boolean }> = ({ onSignedIn, bare = false, horizontal = false }) => {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = () => { onSignedIn?.(); };

  const doGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error } = await signInWithGoogle('/account');
      if (error) {
        // Better Auth's client resolves with { error } rather than throwing
        // (e.g. PROVIDER_NOT_FOUND when Google isn't configured server-side).
        // Without this check the button silently stayed disabled forever.
        setBusy(false);
        setError('Google sign-in is not available right now. Try another way below.');
      }
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

  const labelCls = 'block mb-1.5';
  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-ui)', fontSize: 9.5, letterSpacing: '0.22em',
    textTransform: 'uppercase', color: C.faint, fontWeight: 600,
  };
  // Underline-only fields: a single hairline beneath, no box, no fill, no
  // radius. The minimal, classy treatment.
  const inputStyle: React.CSSProperties = {
    width: '100%', border: 0, borderBottom: `1px solid ${C.line}`, background: 'transparent',
    borderRadius: 0, padding: '8px 1px', fontFamily: 'var(--font-ui)',
    fontSize: 19, color: C.ink, outline: 'none',
  };
  // A tight bronze bar, thin and quiet, not a slab. Small caps label.
  const primaryStyle: React.CSSProperties = {
    width: '100%', background: C.accent, color: C.onAccent, borderRadius: 0,
    fontFamily: 'var(--font-ui)', fontSize: 10.5, letterSpacing: '0.26em',
    textTransform: 'uppercase', fontWeight: 600, padding: '12px', cursor: 'pointer', border: 0,
  };
  const linkStyle: React.CSSProperties = {
    background: 'transparent', border: 0, cursor: 'pointer', color: C.sub,
    fontFamily: 'var(--font-ui)', fontSize: 10, letterSpacing: '0.16em',
    textTransform: 'uppercase', fontWeight: 600, padding: '4px 0', textAlign: 'left',
    width: 'fit-content',
  };
  // Google: a thin-bordered secondary, matching the field hairline weight.
  const googleStyle: React.CSSProperties = {
    width: '100%', border: `1px solid ${C.line}`, background: 'transparent',
    borderRadius: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 9, padding: '12px', cursor: 'pointer', color: C.ink,
    fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600,
    letterSpacing: '0.02em',
  };

  const title =
    mode === 'signup' ? 'Create your account'
    : mode === 'code-email' ? 'Sign in with a code'
    : mode === 'code-verify' ? 'Enter your code'
    : 'Sign in';

  const subtitle =
    mode === 'signup' ? 'Save pieces to collections and find your orders.'
    : mode === 'code-email' ? 'We will email you a one-time code. No password.'
    : mode === 'code-verify' ? `We sent a code to ${email}.`
    : 'Welcome back.';

  // No card. Bare mode sits open on the page; only the non-bare (modal) use
  // keeps a light boxed surface.
  const wrapperStyle: React.CSSProperties = bare
    ? { width: '100%', maxWidth: horizontal ? '100%' : 380, color: C.ink }
    : {
        width: '100%', maxWidth: 380, color: C.ink,
        background: 'var(--color-paper-50)', border: `1px solid ${C.line}`,
        padding: 32, boxShadow: '0 20px 50px -20px rgba(0,0,0,0.16)',
      };

  return (
    <div style={wrapperStyle}>
      {horizontal && (
        <style>{`
          .sip-h { display: grid; grid-template-columns: minmax(0,0.85fr) auto minmax(0,1.45fr); gap: 40px; align-items: center; }
          .sip-h__left { display: flex; flex-direction: column; justify-content: center; }
          .sip-h__right { display: flex; flex-direction: column; gap: 18px; justify-content: center; }
          .sip-h__fields { display: flex; gap: 28px; }
          .sip-h__rule { display: flex; flex-direction: column; align-items: center; gap: 9px; align-self: stretch; }
          .sip-h__rule-line { flex: 1; width: 1px; background: ${C.line}; }
          .sip-h__rule-or { font-family: var(--font-ui); font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.22em; color: ${C.faint}; }
          @media (max-width: 760px) {
            .sip-h { grid-template-columns: 1fr; gap: 22px; }
            .sip-h__rule { flex-direction: row; }
            .sip-h__rule-line { width: auto; height: 1px; }
            .sip-h__fields { flex-direction: column; gap: 18px; }
            .sip-h__left > div { margin-top: 14px !important; padding-top: 0 !important; }
          }
        `}</style>
      )}
      {/* Bare mode (inside the account page) drops the brand line and the big
          serif title — the page already carries "Your account" — and shows
          just a quiet sub-heading so the form reads as a section, not a card. */}
      {bare ? (
        <div style={{ marginBottom: 22 }}>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 10, letterSpacing: '0.28em', textTransform: 'uppercase', color: C.bronze, fontWeight: 600, margin: 0 }}>
            {title}
          </p>
        </div>
      ) : (
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <p style={{ ...labelStyle, color: C.bronze, marginBottom: 8 }}>Mandala Codes</p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: C.ink, fontWeight: 500, margin: 0 }}>
            {title}
          </h2>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: C.sub, marginTop: 8 }}>
            {subtitle}
          </p>
        </div>
      )}

      {error && (
        <div style={{
          marginBottom: 16, padding: '8px 12px', border: '1px solid #d99',
          background: '#fbeaea', color: '#8a2a2a', fontFamily: 'var(--font-ui)', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {(mode === 'login' || mode === 'signup') && (
        horizontal ? (
          // Wide band: Google + heading on the left, vertical rule, fields and
          // the Sign in pill on the right. Collapses to a column under 760px.
          <div className="sip-h">
            <div className="sip-h__left">
              <button type="button" onClick={doGoogle} disabled={busy} style={googleStyle}>
                <GoogleMark /> Continue with Google
              </button>
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 2,
                paddingTop: 16,
              }}>
                <button type="button" style={linkStyle} onClick={() => { setError(null); setMode(mode === 'signup' ? 'login' : 'signup'); }}>
                  {mode === 'signup' ? 'Have an account? Sign in' : 'Create an account'}
                </button>
                <button type="button" style={{ ...linkStyle, color: C.sub }} onClick={() => { setError(null); setMode('code-email'); }}>
                  Email me a code instead
                </button>
              </div>
            </div>

            <div className="sip-h__rule" aria-hidden="true">
              <span className="sip-h__rule-line" />
              <span className="sip-h__rule-or">or</span>
              <span className="sip-h__rule-line" />
            </div>

            <div className="sip-h__right">
              {mode === 'signup' && (
                <div>
                  <label className={labelCls} style={labelStyle}>Name (optional)</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Your name" />
                </div>
              )}
              <div className="sip-h__fields">
                <div style={{ flex: 1 }}>
                  <label className={labelCls} style={labelStyle}>Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="you@example.com" />
                </div>
                <div style={{ flex: 1 }}>
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
              </div>
              <button type="button" onClick={doPassword} disabled={busy || !email.trim() || !password} style={primaryStyle}>
                {busy ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
              </button>
            </div>
          </div>
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <button type="button" onClick={doGoogle} disabled={busy} style={googleStyle}>
            <GoogleMark /> Continue with Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.sub }}>
            <span style={{ flex: 1, height: 1, background: C.line }} />
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em' }}>or</span>
            <span style={{ flex: 1, height: 1, background: C.line }} />
          </div>

          {mode === 'signup' && (
            <div>
              <label className={labelCls} style={labelStyle}>Name (optional)</label>
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Your name" />
            </div>
          )}
          <div>
            <label className={labelCls} style={labelStyle}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} placeholder="you@example.com" />
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

          <div style={{
            display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8,
            paddingTop: 16, borderTop: `1px solid ${C.line}`,
          }}>
            <button type="button" style={linkStyle} onClick={() => { setError(null); setMode(mode === 'signup' ? 'login' : 'signup'); }}>
              {mode === 'signup' ? 'Have an account? Sign in' : 'Create an account'}
            </button>
            <button type="button" style={{ ...linkStyle, color: C.sub }} onClick={() => { setError(null); setMode('code-email'); }}>
              Email me a code instead
            </button>
          </div>
        </div>
        )
      )}

      {mode === 'code-email' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className={labelCls} style={labelStyle}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendCode()} style={inputStyle} placeholder="you@example.com" />
          </div>
          <button type="button" onClick={sendCode} disabled={busy || !email.trim()} style={primaryStyle}>
            {busy ? 'Sending...' : 'Send code'}
          </button>
          <button type="button" style={linkStyle} onClick={() => { setError(null); setMode('login'); }}>
            Back to sign in
          </button>
        </div>
      )}

      {mode === 'code-verify' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label className={labelCls} style={labelStyle}>6-digit code</label>
            <input
              type="text"
              inputMode="numeric"
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

export default SignInPanel;
