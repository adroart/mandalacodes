import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDarkMode } from '../../DarkModeContext';
import type { ProfileInputs } from '../../lib/profile/storage';
import ProfileForm from './ProfileForm';

/**
 * The birth-time entry popup. A warm, on-theme modal (same chrome as the
 * Welcome sign-in) wrapping the birth-date / time / place form. Used in both
 * places that ask for a birth moment: the reading's in-your-chart line and the
 * oracle index rail-top. The chart computes locally on save; no account needed.
 *
 * Two steps:
 *   form    → the birth-date / time / place form, with a quiet "already have an
 *             account? log in" line for returning members (calls `onLogIn`).
 *   confirm → after the chart is computed, a confirmation offering three ways
 *             on: see the whole chart, go back to the card, or save by creating
 *             an account. The callers wire what each action does.
 *
 * `showCardOption` controls whether "back to this card" is offered (true on a
 * card, false on the index where there is no single card).
 */
const LIGHT = {
  surface: '#ffffff', field: '#f3f1ec', ink: '#262321', sub: '#8a7a5e',
  bronze: '#8a744e', onBronze: '#f7f5f1', fieldBorder: '#d2c7b4',
  line: '#e3ddd1', glow: 'rgba(196,170,124,0.18)',
};
const DARK = {
  surface: '#241e17', field: '#1d1813', ink: '#f0ece4', sub: '#a99a82',
  bronze: '#dabd8b', onBronze: '#241e17', fieldBorder: 'rgba(196,170,124,0.30)',
  line: 'rgba(196,170,124,0.18)', glow: 'rgba(196,170,124,0.16)',
};

const BirthTimeModal: React.FC<{
  initial?: ProfileInputs | null;
  /** Offer "back to this card" on the confirmation (true on a card surface). */
  showCardOption?: boolean;
  onClose: () => void;
  /** Returning member chose to log in instead of entering a birth time. */
  onLogIn?: () => void;
  /** Confirmation: go to the full Hologenetic chart. */
  onSeeChart?: () => void;
  /** Confirmation: keep reading this card (just close). */
  onBackToCard?: () => void;
  /** Confirmation: save by creating an account (opens the Welcome sign-in). */
  onSave?: () => void;
}> = ({
  initial,
  showCardOption = false,
  onClose,
  onLogIn,
  onSeeChart,
  onBackToCard,
  onSave,
}) => {
  const { isDarkMode } = useDarkMode();
  const C = isDarkMode ? DARK : LIGHT;
  const [step, setStep] = useState<'form' | 'confirm'>('form');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const ring = (
    <div style={{
      width: 54, height: 54, margin: '0 auto 16px', borderRadius: '50%',
      border: `1.5px solid ${C.bronze}`, display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: C.glow,
    }}>
      <span style={{ width: 18, height: 18, borderRadius: '50%', border: `1.5px solid ${C.bronze}` }} />
    </div>
  );
  const brand = (
    <p style={{
      fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 700,
      letterSpacing: '0.24em', textTransform: 'uppercase', color: C.bronze, margin: '0 0 10px',
    }}>
      Mandala Codes
    </p>
  );

  const pillPrimary: React.CSSProperties = {
    width: '100%', cursor: 'pointer', background: C.bronze, color: C.onBronze, border: 'none',
    borderRadius: 12, padding: 14, marginBottom: 10,
    fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700,
    letterSpacing: '0.12em', textTransform: 'uppercase',
  };
  const pillGhost: React.CSSProperties = {
    width: '100%', cursor: 'pointer', background: C.surface, color: C.ink,
    border: `1px solid ${C.fieldBorder}`, borderRadius: 12, padding: 13, marginBottom: 10,
    fontFamily: 'var(--font-ui)', fontSize: 17, fontWeight: 500,
  };
  const quietLink: React.CSSProperties = {
    color: C.bronze, textDecoration: 'none', fontWeight: 700, background: 'none', border: 'none',
    cursor: 'pointer', font: 'inherit', padding: 0,
  };

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
          width: '100%', maxWidth: 380, maxHeight: '88vh', overflowY: 'auto',
          background: C.surface, borderRadius: 20,
          boxShadow: '0 24px 60px -20px rgba(0,0,0,0.45)',
          padding: '28px 26px', color: C.ink, textAlign: 'center',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {step === 'form' && (
          <>
            {ring}
            {brand}
            <h2 style={{
              fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 28,
              lineHeight: 1.05, color: C.ink, margin: '0 0 6px',
            }}>
              Enter your birth time
            </h2>
            <p style={{
              fontFamily: 'var(--font-reading)', fontStyle: 'italic', fontSize: 17,
              color: C.sub, lineHeight: 1.35, margin: '0 0 18px',
            }}>
              See which cards are most relevant to you, lit throughout the oracle.
            </p>

            <div style={{ textAlign: 'left' }}>
              <ProfileForm initial={initial} onSaved={() => setStep('confirm')} />
            </div>

            {onLogIn && (
              <p style={{
                marginTop: 18, paddingTop: 16, borderTop: `1px solid ${C.line}`,
                fontFamily: 'var(--font-ui)', fontSize: 13, color: C.sub,
              }}>
                Already have an account?{' '}
                <button type="button" style={quietLink} onClick={onLogIn}>
                  Log in
                </button>
              </p>
            )}
          </>
        )}

        {step === 'confirm' && (
          <>
            {ring}
            {brand}
            <h2 style={{
              fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 28,
              lineHeight: 1.05, color: C.ink, margin: '0 0 6px',
            }}>
              Your chart is lit
            </h2>
            <p style={{
              fontFamily: 'var(--font-reading)', fontStyle: 'italic', fontSize: 17,
              color: C.sub, lineHeight: 1.35, margin: '0 0 22px',
            }}>
              Your placement now glows across all sixty-four. Where to next?
            </p>

            <button type="button" style={pillPrimary} onClick={() => { onSeeChart?.(); }}>
              See your whole chart
            </button>
            {showCardOption && onBackToCard && (
              <button type="button" style={pillGhost} onClick={() => { onBackToCard(); }}>
                Back to this card
              </button>
            )}
            {onSave && (
              <button type="button" style={pillGhost} onClick={() => { onSave(); }}>
                Save it to your account
              </button>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default BirthTimeModal;
