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
import { Link, useNavigate } from 'react-router-dom';
import BirthTimeModal from '../BirthTimeModal';
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

// The profile link. Quiet by default — an outlined accent button, not a gold
// slab — so the surface reads minimal and subtle.
const BRIGHT_CTA: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  width: '100%',
  padding: '13px',
  border: '1px solid var(--accent,#8a744e)',
  borderRadius: '10px',
  background: 'transparent',
  color: 'var(--accent,#8a744e)',
  fontFamily: 'var(--font-ui)',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  textDecoration: 'none',
  cursor: 'pointer',
};

/* The account only carries an email, so derive a friendly name from it: the
   part before the @, lightly cased ("maya.lee" -> "Maya"). */
function friendlyName(email: string | null): string | null {
  if (!email) return null;
  const local = email.split('@')[0]?.split(/[._-]/)[0] ?? '';
  if (!local) return null;
  return local.charAt(0).toUpperCase() + local.slice(1);
}


const OracleRailTop: React.FC<OracleRailTopProps> = ({
  hasCodes,
  isSignedIn,
  accountsAvailable,
  displayName,
  initialInputs,
  onSignOut,
}) => {
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const name = friendlyName(displayName);

  // A single quiet account line, folded INTO the card under a hairline. Signed
  // in: "Reading as <name>" with one Switch action (single-session auth, so
  // switch = sign out then sign in as the other). No separate box, no pills.
  const accountLine = accountsAvailable && hasCodes && isSignedIn && (
    <div style={accountRowStyle}>
      <span style={readingAsStyle}>
        Reading as <b style={{ color: 'var(--ink,#262321)', fontWeight: 600 }}>{name || 'you'}</b>
      </span>
      <button type="button" onClick={() => onSignOut()} style={accountActionStyle}>
        Switch
      </button>
    </div>
  );

  // Rung 4: signed in — welcome, profile link, then the one account line below.
  if (hasCodes && isSignedIn) {
    return (
      <div style={litCardStyle}>
        <p style={leadStyle}>Welcome back{name ? `, ${name}` : ''}</p>
        <Link to="/profile" style={BRIGHT_CTA}>
          Your profile, pieces &amp; grid →
        </Link>
        {accountLine}
      </div>
    );
  }

  // Rung 2+3: codes lit, no account — confirmation + bright link, then the
  // collapsed save pitch. Sign-in lives in that pitch; no separate switcher.
  if (hasCodes) {
    return (
      <>
        <div style={litCardStyle}>
          <p style={leadStyle}>Your placement is illuminated</p>
          <Link to="/profile" style={BRIGHT_CTA}>
            See your full Hologenetic profile →
          </Link>
          {accountsAvailable && (
            // The click already says "yes, keep it" — go straight to the modal,
            // which carries the why. No intermediate expand-the-pitch step.
            <button type="button" onClick={() => setSignInOpen(true)} style={saveLinkStyle}>
              Save your reading →
            </button>
          )}
        </div>
        {signInOpen && <SignInModal context="reading" onClose={() => setSignInOpen(false)} onSignedIn={() => setSignInOpen(false)} />}
      </>
    );
  }

  // Rung 1: guest, no codes — the birth-time button opens the popup. On save,
  // the second screen offers to keep it (the Welcome sign-in).
  return (
    <>
      <button
        type="button"
        onClick={() => setFormOpen(true)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          width: '100%',
          padding: '14px 16px',
          background: 'var(--bg2,#fff)',
          border: '1px solid var(--line2,#d2c7b4)',
          borderRadius: '12px',
          cursor: 'pointer',
          textAlign: 'center',
        }}
      >
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 500, lineHeight: 1.1, color: 'var(--ink,#262321)' }}>
          Enter your birth time
        </span>
        <span style={{ fontFamily: 'var(--font-reading)', fontSize: '12px', lineHeight: 1.45, color: 'var(--ink3,#8a7a5e)' }}>
          See which cards are most relevant to you, lit throughout the oracle.
        </span>
      </button>

      {formOpen && (
        <BirthTimeModal
          initial={initialInputs}
          onClose={() => setFormOpen(false)}
          onLogIn={accountsAvailable ? () => { setFormOpen(false); setSignInOpen(true); } : undefined}
          onSeeChart={() => { setFormOpen(false); navigate('/profile'); }}
          onSave={accountsAvailable ? () => { setFormOpen(false); setSignInOpen(true); } : undefined}
        />
      )}

      {signInOpen && (
        <SignInModal context="reading" onClose={() => setSignInOpen(false)} onSignedIn={() => setSignInOpen(false)} />
      )}
    </>
  );
};

/* ── shared inline styles ── */
const litCardStyle: React.CSSProperties = {
  background: 'var(--bg2,#fff)',
  border: '1px solid var(--line2,#d2c7b4)',
  borderRadius: '12px',
  padding: '18px 16px',
};
const leadStyle: React.CSSProperties = {
  margin: '0 0 14px',
  fontFamily: 'var(--font-reading)',
  fontSize: '18px',
  textAlign: 'center',
  color: 'var(--ink,#262321)',
};
// Collapsed default: one quiet centered text link, near-zero height.
const saveLinkStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: '10px',
  padding: 0,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'center',
  fontFamily: 'var(--font-ui)',
  fontSize: '11px',
  letterSpacing: '.08em',
  color: 'var(--ink3,#8a7a5e)',
};
const sellListStyle: React.CSSProperties = {
  margin: '0 0 14px',
  padding: '0',
  listStyle: 'none',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  textAlign: 'center',
  fontFamily: 'var(--font-ui)',
  fontSize: '12px',
  lineHeight: 1.45,
  color: 'var(--ink3,#8a7a5e)',
};
// "Save my reading" is the one real action here, so it carries the gentle
// accent fill; the profile link stays a quiet outline above it.
const keepBtnStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px',
  border: 'none',
  borderRadius: '10px',
  background: 'var(--accent,#8a744e)',
  color: 'var(--onAccent,#f7f5f1)',
  fontFamily: 'var(--font-ui)',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  cursor: 'pointer',
};
// The single in-card account line: name on the left, one action on the right,
// divided from the card above by a hairline.
const accountRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  marginTop: '14px',
  paddingTop: '12px',
  borderTop: '1px solid var(--line,#e3ddd1)',
};
const readingAsStyle: React.CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontSize: '12px',
  color: 'var(--ink3,#8a7a5e)',
};
const accountActionStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontFamily: 'var(--font-ui)',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '.1em',
  textTransform: 'uppercase',
  color: 'var(--accent,#8a744e)',
};

export default OracleRailTop;
