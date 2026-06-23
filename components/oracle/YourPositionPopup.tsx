import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { POSITIONS_BY_KEY, SEQUENCE_LABEL } from '../../data/profilePositions';
import { PLACEMENT_DESCRIPTIONS } from '../../data/placementDescriptions';
import { CARD_BY_NUMBER } from '../../data/oracleData';
import type { ProfileKey } from '../../lib/astrology/types';
import SignInModal from '../account/SignInModal';

export interface PopupMatch {
  key: ProfileKey;
  line: number;
}

interface Props {
  /** The card's gate (1..64). */
  gate: number;
  /** Every position in the visitor's profile this card lands on. */
  matches: PopupMatch[];
  /** When true, the chart is local-only: show the offer to save it (sign in). */
  canSave?: boolean;
  onClose: () => void;
}

/**
 * The short, phone-sized "what this placement means in your chart" popup.
 * One block per matched position: the position name + line, two or three
 * sentences from data/placementDescriptions.ts, the card's Gene Keys triad,
 * and a single link out to the full chart. Sized to read in a few seconds.
 *
 * When the chart is local-only (`canSave`), a quiet "Save your chart" offer
 * sits at the foot, opening the Welcome sign-in. The save pitch lands here,
 * after the placement is seen, not before.
 */
const YourPositionPopup: React.FC<Props> = ({ gate, matches, canSave = false, onClose }) => {
  const [saveOpen, setSaveOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const card = CARD_BY_NUMBER.get(gate);
  const triad = card
    ? [
        { rung: 'Shadow', name: card.gene_keys.shadow },
        { rung: 'Gift', name: card.gene_keys.gift },
        { rung: 'Siddhi', name: card.gene_keys.siddhi },
      ]
    : [];

  return (
    <div
      className="ypp__scrim"
      role="dialog"
      aria-modal="true"
      aria-label="This card in your chart"
      onClick={onClose}
    >
      <div className="ypp__sheet" onClick={(e) => e.stopPropagation()}>
        <button className="ypp__x" aria-label="Close" onClick={onClose}>
          ×
        </button>

        {matches.map(({ key, line }, i) => {
          const meta = POSITIONS_BY_KEY[key];
          const desc = PLACEMENT_DESCRIPTIONS[key];
          return (
            <div
              key={key}
              className={`ypp__block${i > 0 ? ' ypp__block--stacked' : ''}`}
            >
              <div className="ypp__eyebrow">
                In your chart · {SEQUENCE_LABEL[meta.sequence]}
              </div>
              <h3 className="ypp__title">
                Your {meta.label} · Line {line}
              </h3>
              {card && (
                <div className="ypp__sub">
                  {card.card_name} · Code {gate}
                </div>
              )}
              <p className="ypp__body">{desc.body}</p>
            </div>
          );
        })}

        {triad.length > 0 && (
          <div className="ypp__triad">
            {triad.map((t) => (
              <span key={t.rung} className="ypp__chip">
                {t.rung} · <b>{t.name}</b>
              </span>
            ))}
          </div>
        )}

        {canSave ? (
          <button type="button" className="ypp__save" onClick={() => setSaveOpen(true)}>
            <span className="ypp__save-t">Save your chart</span>
            <span className="ypp__save-s">Keep it across every visit, lit on every card.</span>
          </button>
        ) : (
          <Link to="/profile" className="ypp__full" onClick={onClose}>
            See it in your full chart →
          </Link>
        )}
      </div>

      {saveOpen && (
        <SignInModal
          context="reading"
          onClose={() => setSaveOpen(false)}
          onSignedIn={() => {
            setSaveOpen(false);
            onClose();
          }}
        />
      )}

      <style>{`
        .ypp__scrim {
          position: fixed;
          inset: 0;
          z-index: 300;
          background: rgba(8,6,3,0.62);
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 14px;
          animation: yppFade 220ms ease both;
        }
        @media (min-width: 560px) {
          .ypp__scrim { align-items: center; }
        }
        .ypp__sheet {
          position: relative;
          width: 100%;
          max-width: 420px;
          max-height: 84vh;
          overflow-y: auto;
          background: var(--color-paper-100, #241E18);
          color: var(--l-1, #ECE4D5);
          border: 1px solid color-mix(in oklab, var(--color-bronze-600, #C99A5B) 26%, var(--l-rule, rgba(180,150,110,0.20)));
          border-radius: 14px;
          padding: 22px 20px 18px;
          box-shadow: 0 24px 60px rgba(0,0,0,0.45);
          animation: yppRise 280ms cubic-bezier(.16,1,.3,1) both;
        }
        @keyframes yppFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes yppRise { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: none } }
        .ypp__x {
          position: absolute;
          top: 10px;
          right: 12px;
          background: none;
          border: none;
          color: var(--l-3, #8C7F6B);
          font-size: 22px;
          line-height: 1;
          cursor: pointer;
          padding: 4px 6px;
        }
        .ypp__block--stacked {
          margin-top: 18px;
          padding-top: 18px;
          border-top: 1px solid var(--l-rule, rgba(180,150,110,0.20));
        }
        .ypp__eyebrow {
          font-family: Cinzel, Palatino, serif;
          font-size: 10px;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: var(--color-bronze-600, #C99A5B);
          margin-bottom: 6px;
          padding-right: 18px;
        }
        .ypp__title {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 500;
          font-size: 25px;
          line-height: 1.12;
          color: var(--l-1, #ECE4D5);
          margin: 0 0 2px;
        }
        .ypp__sub {
          font-family: 'Lato', Helvetica, sans-serif;
          font-size: 10px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--l-3, #8C7F6B);
          margin-bottom: 12px;
        }
        .ypp__body {
          font-family: 'Cormorant Garamond', serif;
          font-size: 17px;
          line-height: 1.5;
          color: var(--l-2, #C9BDA9);
          margin: 0;
        }
        .ypp__triad {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin: 16px 0 0;
        }
        .ypp__chip {
          font-family: 'Lato', Helvetica, sans-serif;
          font-size: 9px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--l-2, #C9BDA9);
          border: 1px solid var(--l-rule, rgba(180,150,110,0.20));
          border-radius: 999px;
          padding: 5px 9px;
          background: color-mix(in oklab, var(--color-bronze-600, #C99A5B) 7%, transparent);
        }
        .ypp__chip b { color: var(--color-bronze-600, #C99A5B); font-weight: 700; }
        .ypp__full {
          display: block;
          margin-top: 16px;
          padding-top: 14px;
          border-top: 1px solid var(--l-rule, rgba(180,150,110,0.20));
          font-family: 'Lato', Helvetica, sans-serif;
          font-size: 10px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--color-bronze-600, #C99A5B);
          text-decoration: none;
        }
        .ypp__save {
          display: flex;
          flex-direction: column;
          gap: 3px;
          width: 100%;
          text-align: left;
          margin-top: 16px;
          padding: 13px 15px;
          cursor: pointer;
          border: 1px solid color-mix(in oklab, var(--color-bronze-600, #C99A5B) 40%, var(--l-rule, rgba(180,150,110,0.20)));
          border-radius: 12px;
          background: color-mix(in oklab, var(--color-bronze-600, #C99A5B) 10%, transparent);
          transition: background .2s, border-color .2s;
        }
        .ypp__save:hover {
          background: color-mix(in oklab, var(--color-bronze-600, #C99A5B) 18%, transparent);
          border-color: var(--color-bronze-600, #C99A5B);
        }
        .ypp__save-t {
          font-family: 'Cormorant Garamond', serif;
          font-size: 18px;
          font-weight: 500;
          line-height: 1.1;
          color: var(--l-1, #ECE4D5);
        }
        .ypp__save-s {
          font-family: 'Lato', Helvetica, sans-serif;
          font-size: 11.5px;
          line-height: 1.4;
          color: var(--l-2, #C9BDA9);
        }
      `}</style>
    </div>
  );
};

export default YourPositionPopup;
