/* The oracle rail-top: the identity ladder.
   Four states, all account-aware, composed here (not in the generated host) so
   it can use the real profile + account hooks and the live sign-in modal.

     1. Guest, no codes  -> "Enter your birth time" button that expands the
        birth date/time/place form inline. (Rung 1: Light.)
     2. Codes lit, not signed in -> illuminated confirmation with the bright
        profile link, plus a quiet "keep my reading" that opens sign-in.
        (Rung 2+3: Keep — the account is born here.)
     3. Signed in -> a "welcome back" with the bright profile link, plus the
        account switcher above it. (Rung 4: signed-in is special.)
     4. The switcher: Google-style faces. Tap a face to switch accounts (sign
        out then in), "Add" opens sign-in for another person. Shown whenever a
        birth moment exists, so partners on one phone can swap. */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import ProfileForm from '../ProfileForm';
import SignInModal from '../../account/SignInModal';
import type { ProfileInputs } from '../../../lib/profile/storage';

interface OracleRailTopProps {
  /** Whether the visitor's codes are lit (a birth moment is present). */
  hasCodes: boolean;
  /** Whether a real account session is active. */
  isSignedIn: boolean;
  /** Whether accounts are configured at all (launch flag / auth available). */
  accountsAvailable: boolean;
  /** The signed-in person's display name or email, for the welcome + switcher. */
  displayName: string | null;
  /** Prefill for the birth form (their saved inputs, if any). */
  initialInputs: ProfileInputs | null;
  /** Sign the current session out (used by the switcher to swap accounts). */
  onSignOut: () => void;
}

const BRIGHT_CTA: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  width: '100%',
  padding: '13px',
  border: 'none',
  borderRadius: '10px',
  background: 'linear-gradient(135deg, var(--accent,#a98a55), var(--accentDeep,#7d6638))',
  color: 'var(--onAccent,#fff8ec)',
  fontFamily: "'Karla',sans-serif",
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  textDecoration: 'none',
  cursor: 'pointer',
  boxShadow:
    '0 0 0 1px rgba(138,116,78,.4), 0 6px 22px -4px rgba(138,116,78,.5), 0 0 26px -2px var(--glow,rgba(196,170,124,.55))',
};

/* The account only carries an email, so derive a friendly name from it: the
   part before the @, lightly cased ("maya.lee" -> "Maya"). */
function friendlyName(email: string | null): string | null {
  if (!email) return null;
  const local = email.split('@')[0]?.split(/[._-]/)[0] ?? '';
  if (!local) return null;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

const initial = (name: string | null) => (name ? name.trim().charAt(0).toUpperCase() : '?');

const OracleRailTop: React.FC<OracleRailTopProps> = ({
  hasCodes,
  isSignedIn,
  accountsAvailable,
  displayName,
  initialInputs,
  onSignOut,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const name = friendlyName(displayName);

  // The account switcher. Shown once a birth moment exists. Single-session auth,
  // so "switch" = sign out then sign in as the other; "Add" opens sign-in.
  const switcher = accountsAvailable && hasCodes && (
    <div
      style={{
        background: 'var(--bg2,#fff)',
        border: '1px solid var(--line2,#d2c7b4)',
        borderRadius: '12px',
        padding: '10px 12px',
      }}
    >
      <p
        style={{
          margin: '0 0 9px',
          fontFamily: "'Karla',sans-serif",
          fontSize: '9.5px',
          fontWeight: 700,
          letterSpacing: '.18em',
          textTransform: 'uppercase',
          color: 'var(--faint,#a89070)',
        }}
      >
        Reading as
      </p>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {isSignedIn && (
          <span style={faceStyle(true)}>
            <span style={dotStyle}>{initial(name)}</span>
            {name || 'You'}
          </span>
        )}
        <button type="button" onClick={() => (isSignedIn ? onSignOut() : setSignInOpen(true))} style={faceStyle(false)}>
          <span style={{ ...dotStyle, background: 'transparent', color: 'var(--accent,#8a744e)', border: '1px dashed var(--line2,#d2c7b4)' }}>
            {isSignedIn ? '↻' : '+'}
          </span>
          {isSignedIn ? 'Switch' : 'Sign in'}
        </button>
      </div>
    </div>
  );

  // Rung 4: signed in — a special welcome over the bright profile link, the
  // switcher sits below.
  if (hasCodes && isSignedIn) {
    return (
      <>
        <div style={litCardStyle}>
          <p style={leadStyle}>Welcome back{name ? `, ${name}` : ''}</p>
          <Link to="/profile" style={BRIGHT_CTA}>
            Your profile, pieces &amp; grid →
          </Link>
        </div>
        {switcher}
      </>
    );
  }

  // Rung 2+3: codes lit, no account — confirmation + bright link, then the
  // reason to stay, then the switcher below.
  if (hasCodes) {
    return (
      <>
        <div style={litCardStyle}>
          <p style={leadStyle}>Your placement is illuminated</p>
          <Link to="/profile" style={BRIGHT_CTA}>
            See your full Hologenetic profile →
          </Link>
          {accountsAvailable && (
            <div style={{ marginTop: '14px' }}>
              <p style={sellLeadStyle}>Save your reading by signing in.</p>
              <ul style={sellListStyle}>
                <li>Go deeper on what your codes mean for you, kept as you learn.</li>
                <li>Your cards light up wherever they appear, on every page.</li>
                <li>Join the living oracle: claim a piece, place it, share your grid.</li>
              </ul>
              <button type="button" onClick={() => setSignInOpen(true)} style={keepBtnStyle}>
                Save my reading
              </button>
            </div>
          )}
        </div>
        {switcher}
        {signInOpen && <SignInModal onClose={() => setSignInOpen(false)} onSignedIn={() => setSignInOpen(false)} />}
      </>
    );
  }

  // Rung 1: guest, no codes — the birth-time button + inline form.
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg2,#fff)',
        border: '1px solid var(--line2,#d2c7b4)',
        borderRadius: '12px',
        overflow: expanded ? 'visible' : 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          width: '100%',
          padding: '14px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'center',
        }}
      >
        <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '18px', fontWeight: 500, lineHeight: 1.1, color: 'var(--ink,#262321)' }}>
          Enter your birth time
        </span>
        <span style={{ fontFamily: "'Karla',sans-serif", fontSize: '12px', lineHeight: 1.45, color: 'var(--ink3,#8a7a5e)' }}>
          See which cards are most relevant to you, lit throughout the oracle.
        </span>
      </button>
      {expanded && (
        <div style={{ padding: '4px 16px 18px', borderTop: '1px solid var(--line2,#d2c7b4)' }}>
          <ProfileForm initial={initialInputs} />
        </div>
      )}
    </div>
  );
};

/* ── shared inline styles ── */
const litCardStyle: React.CSSProperties = {
  background: 'var(--glow,rgba(196,170,124,.16))',
  border: '1px solid var(--accent,#8a744e)',
  borderRadius: '12px',
  padding: '16px',
};
const leadStyle: React.CSSProperties = {
  margin: '0 0 14px',
  fontFamily: "'Cormorant Garamond',serif",
  fontSize: '18px',
  textAlign: 'center',
  color: 'var(--ink,#262321)',
};
const sellLeadStyle: React.CSSProperties = {
  margin: '0 0 8px',
  textAlign: 'center',
  fontFamily: "'Cormorant Garamond',serif",
  fontSize: '15px',
  color: 'var(--ink,#262321)',
};
const sellListStyle: React.CSSProperties = {
  margin: '0 0 14px',
  padding: '0 0 0 18px',
  display: 'flex',
  flexDirection: 'column',
  gap: '5px',
  fontFamily: "'Karla',sans-serif",
  fontSize: '12px',
  lineHeight: 1.45,
  color: 'var(--ink2,#524330)',
};
const keepBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px',
  border: '1px solid var(--accent,#8a744e)',
  borderRadius: '10px',
  background: 'transparent',
  color: 'var(--ink,#262321)',
  fontFamily: "'Karla',sans-serif",
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  cursor: 'pointer',
};
const dotStyle: React.CSSProperties = {
  width: '22px',
  height: '22px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '11px',
  fontWeight: 700,
  color: 'var(--onAccent,#fff8ec)',
  background: 'linear-gradient(135deg, var(--accent,#a98a55), var(--accentDeep,#7d6638))',
};
function faceStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '7px 12px 7px 8px',
    border: active ? '1px solid var(--accent,#8a744e)' : '1px solid var(--line2,#d2c7b4)',
    borderRadius: '999px',
    background: active ? 'var(--glow,rgba(196,170,124,.16))' : 'var(--bg2,#fff)',
    color: active ? 'var(--ink,#262321)' : 'var(--ink2,#524330)',
    boxShadow: active ? '0 0 0 1px var(--accent,#8a744e), 0 0 18px -4px var(--glow,rgba(196,170,124,.7))' : 'none',
    fontFamily: "'Karla',sans-serif",
    fontSize: '13px',
    cursor: 'pointer',
  };
}

export default OracleRailTop;
