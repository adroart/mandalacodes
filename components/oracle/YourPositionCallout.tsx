import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../../lib/profile/context';
import { useAccount } from '../../lib/account/useAccount';
import {
  POSITIONS_BY_KEY,
  POSITION_KEYS,
} from '../../data/profilePositions';
import type { ProfileKey } from '../../lib/astrology/types';
import { LAUNCH_FLAGS } from '../../launchFlags';
import YourPositionPopup, { type PopupMatch } from './YourPositionPopup';
import BirthTimeModal from './BirthTimeModal';
import SignInModal from '../account/SignInModal';

interface Props {
  /** The card's Human Design gate (1..64). */
  gate: number;
}

/**
 * The in-your-chart box, centred under the card name and its keywords on the
 * card page. A hairline box with a bronze rule seated along its inside bottom
 * edge: faint before a chart exists, lit once the code is in your chart.
 *
 * The flow is birthday-first, then save:
 *
 *   1. No birthday yet → "Is this code in your chart?" Opens the birth-time
 *      form inline; the chart computes locally, no account needed.
 *   2. Birthday entered and this card is in your chart → "Your Pearl · Line 3."
 *      Opens a short popup with what the placement means; the popup carries the
 *      offer to save (sign in) when the chart is not yet saved to an account.
 *   3. Birthday entered but this card is not in your chart → renders nothing.
 *
 * Accounts being off, or the launch flag being off, hides everything.
 */
const YourPositionCallout: React.FC<Props> = ({ gate }) => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { available, isSignedIn } = useAccount();
  const [popupOpen, setPopupOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  const matches = useMemo<PopupMatch[]>(() => {
    if (!profile) return [];
    const out: PopupMatch[] = [];
    for (const key of POSITION_KEYS) {
      const gl = profile.computed[key];
      if (gl && gl.gate === gate) out.push({ key, line: gl.line });
    }
    return out;
  }, [profile, gate]);

  if (!LAUNCH_FLAGS.hologeneticProfile || !available) return null;

  const primary = matches[0];
  const meta = primary ? POSITIONS_BY_KEY[primary.key as ProfileKey] : null;
  const titleText = !meta
    ? ''
    : matches.length > 1
      ? `Your ${meta.label} and ${matches.length - 1} more`
      : `Your ${meta.label} · Line ${primary.line}`;

  // Which of the two boxes, if either, this card earns. A chart that does not
  // hold this code gets neither: silence is the honest answer there.
  const asking = !profile;
  const holding = !!profile && matches.length > 0;

  /* The popups sit OUTSIDE that choice on purpose. Building a chart flips
     asking to false in the same render, so a popup owned by the asking branch
     would unmount mid-flow and swallow its own "your chart is lit" screen. */
  if (!asking && !holding && !formOpen && !popupOpen && !saveOpen) return null;

  return (
    <div className={`ypc-wrap${asking || holding ? '' : ' ypc-wrap--boxless'}`}>
      {asking && (
        <button
          type="button"
          className="ypc ypc--out"
          onClick={() => setFormOpen(true)}
        >
          <span className="ypc__mid">
            <span className="ypc__title ypc__title--out">
              Is this code in your chart?
            </span>
          </span>
          <span aria-hidden="true" className="ypc__go">
            →
          </span>
        </button>
      )}

      {holding && (
        <button
          type="button"
          className="ypc ypc--in"
          onClick={() => setPopupOpen(true)}
          aria-label={`This card is in your chart: ${titleText}. Read what it means.`}
        >
          <span className="ypc__mid">
            <span className="ypc__eyebrow">In your chart</span>
            <span className="ypc__title">{titleText}</span>
          </span>
          <span aria-hidden="true" className="ypc__go">
            Read →
          </span>
        </button>
      )}

      {formOpen && (
        <BirthTimeModal
          showCardOption
          onClose={() => setFormOpen(false)}
          onLogIn={() => { setFormOpen(false); setSaveOpen(true); }}
          onSeeChart={() => { setFormOpen(false); navigate('/profile'); }}
          onBackToCard={() => setFormOpen(false)}
          onSave={() => { setFormOpen(false); setSaveOpen(true); }}
        />
      )}

      {popupOpen && holding && (
        <YourPositionPopup
          gate={gate}
          matches={matches}
          canSave={!isSignedIn}
          onClose={() => setPopupOpen(false)}
        />
      )}

      {saveOpen && (
        <SignInModal
          context="reading"
          onClose={() => setSaveOpen(false)}
          onSignedIn={() => setSaveOpen(false)}
        />
      )}

      <Styles />
    </div>
  );
};

const Styles: React.FC = () => (
  <style>{`
    .ypc-wrap { width: 100%; }
    .ypc-wrap--boxless { display: none; }
    .ypc {
      position: relative;
      display: flex;
      align-items: center;
      gap: 14px;
      width: 100%;
      text-align: left;
      cursor: pointer;
      background: none;
      border: 1px solid var(--l-rule, rgba(180,150,110,0.22));
      padding: 14px 18px;
      overflow: hidden;
      transition: border-color .25s, background .25s;
    }
    .ypc:hover {
      border-color: color-mix(in oklab, var(--accent, #C99A5B) 55%, var(--l-rule, rgba(180,150,110,0.22)));
    }
    /* The unique hold: a bronze hairline seated along the inside bottom edge.
       Faint for the signed-out invite, full and lit for the matched state. */
    .ypc::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 2px;
      background: linear-gradient(
        to right,
        var(--accent, #C99A5B),
        color-mix(in oklab, var(--accent, #C99A5B) 25%, transparent)
      );
      transition: opacity .25s;
    }
    .ypc--out::after { opacity: .32; }
    .ypc--in::after { opacity: 1; }

    .ypc__mid {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .ypc__eyebrow {
      font-family: var(--font-ui);
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--accent, #C99A5B);
      line-height: 1;
    }
    .ypc__title {
      font-family: var(--font-display);
      font-size: 20px;
      font-weight: 500;
      line-height: 1.04;
      color: var(--l-1, #ECE4D5);
    }
    .ypc__title--out {
      font-size: 18px;
      font-weight: 400;
      color: var(--l-2, #C9BDA9);
    }
    .ypc__go {
      flex-shrink: 0;
      font-family: var(--font-ui);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--accent, #C99A5B);
      white-space: nowrap;
    }
  `}</style>
);

export default YourPositionCallout;
