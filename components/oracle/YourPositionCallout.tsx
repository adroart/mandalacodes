import React, { useMemo, useState } from 'react';
import { useProfile } from '../../lib/profile/context';
import { useAccount } from '../../lib/account/useAccount';
import SignInTrigger from '../account/SignInTrigger';
import {
  POSITIONS_BY_KEY,
  POSITION_KEYS,
} from '../../data/profilePositions';
import type { ProfileKey } from '../../lib/astrology/types';
import { LAUNCH_FLAGS } from '../../launchFlags';
import YourPositionPopup, { type PopupMatch } from './YourPositionPopup';

interface Props {
  /** The card's Human Design gate (1..64). */
  gate: number;
}

/**
 * The in-your-chart box that sits in the reading header, under Acquire / Share.
 * It is built from the same hairline box as those two actions, so it belongs to
 * the row rather than floating as a separate widget. A thin bronze hairline is
 * seated along the box's inside bottom edge: faint when signed out, lit when the
 * card is in your chart. Three states:
 *
 *   - Signed out: "See this card in your chart," which opens the soft sign-in.
 *   - Signed in and this card sits in your profile: "Your Pearl · Line 3,"
 *     which opens a short popup with what that placement means.
 *   - Signed in but this card is not in your chart (or accounts are off):
 *     renders nothing. No nag, no upsell.
 */
const YourPositionCallout: React.FC<Props> = ({ gate }) => {
  const { profile } = useProfile();
  const { available, isSignedIn } = useAccount();
  const [open, setOpen] = useState(false);

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

  // Signed out: invite them through the soft sign-in to discover the placement.
  if (!isSignedIn) {
    return (
      <>
        <SignInTrigger>
          <button
            type="button"
            className="ypc ypc--out"
            aria-label="See this card in your chart"
          >
            <span className="ypc__mid">
              <span className="ypc__title ypc__title--out">
                See this card in your chart
              </span>
            </span>
            <span aria-hidden="true" className="ypc__go">
              →
            </span>
          </button>
        </SignInTrigger>
        <Styles />
      </>
    );
  }

  // Signed in but this card isn't in their chart: stay quiet.
  if (matches.length === 0) return null;

  const primary = matches[0];
  const meta = POSITIONS_BY_KEY[primary.key as ProfileKey];
  const titleText =
    matches.length > 1
      ? `Your ${meta.label} and ${matches.length - 1} more`
      : `Your ${meta.label} · Line ${primary.line}`;

  return (
    <>
      <button
        type="button"
        className="ypc ypc--in"
        onClick={() => setOpen(true)}
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

      {open && (
        <YourPositionPopup
          gate={gate}
          matches={matches}
          onClose={() => setOpen(false)}
        />
      )}

      <Styles />
    </>
  );
};

const Styles: React.FC = () => (
  <style>{`
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
      font-family: 'Karla', var(--sans, system-ui), sans-serif;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--accent, #C99A5B);
      line-height: 1;
    }
    .ypc__title {
      font-family: 'Cormorant Garamond', var(--serif, serif);
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
      font-family: 'Karla', var(--sans, system-ui), sans-serif;
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
