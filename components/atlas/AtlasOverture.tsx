/**
 * The overture (build-order item 3, Room one items 1-3): the vision speaks
 * once, over black, then the earth emerges through the words as they dissolve
 * and the founding lights ignite. One continuous motion under ~5 seconds,
 * skippable with any input. The two lines are DOM, never WebGL text.
 *
 * The vision speaks every arrival, scaled by familiarity (Adrian, 2026-07-18):
 *   full    a cold visit — the word-led overture, played regardless of how
 *           many lights exist (even over an empty sky).
 *   breath  a returning visit — a two-second breath, the thesis line settling
 *           over the emerging globe, then the resting sky. No black cover; the
 *           globe is already present. Reduced motion: static, legible, brief.
 *
 * This component owns only the words and the black cover; AtlasPage owns the
 * globe behind it and the ignition (Markers). The full-motion choreography:
 *   full motion  cover black -> line one -> line two -> onReveal() (the black
 *                lifts, the earth emerges, the lights ignite) -> onDone()
 *   reduced      the two lines sit as a static block above the settled sky
 *                (onReveal fired at once so the sky is already there), hold,
 *                then a plain crossfade out -> onDone(). Nothing moves.
 *   skip         any pointer/key/touch -> onSkip() lands on the resting sky.
 *
 * Ratified copy (verbatim, no em dashes, no italics; the recentering,
 * 2026-07-18 — the story is the community, not the artist):
 *   "We are one global family of resonance, sharing the dreams we are
 *    birthing for the future."
 *   "Together, our dreams shape our reality: set into the creative cauldron,
 *    watched as they take form."
 */

import { useEffect, useRef, useState } from 'react';

const LINE_ONE =
  'We are one global family of resonance, sharing the dreams we are birthing for the future.';
const LINE_TWO =
  'Together, our dreams shape our reality: set into the creative cauldron, watched as they take form.';

// Full-motion beats (ms from mount).
const LINE_TWO_AT = 1100;
const REVEAL_AT = 2300; // the black lifts, the earth emerges, the lights ignite
const DONE_AT = 3600;
// Reduced motion: a static block, held, then a plain crossfade out.
const REDUCED_HOLD = 3400;
const REDUCED_FADE = 900;

// Returning-visit breath: the thesis line settles over the emerging globe, held
// about two seconds, then the resting sky. No black; the globe is already up.
const BREATH_HOLD = 1500;
const BREATH_FADE = 600;

export interface AtlasOvertureProps {
  reduced: boolean;
  /** 'full' plays the word-led overture; 'breath' plays the two-second
      returning-visit breath. Defaults to the full overture. */
  mode?: 'full' | 'breath';
  /** The black has lifted: mount the real lights so they ignite (full motion),
      or the settled sky is already up (reduced / breath). */
  onReveal: () => void;
  /** The overture is over: unmount it. */
  onDone: () => void;
  /** Any input: skip the whole overture, land on the resting sky. */
  onSkip: () => void;
}

export default function AtlasOverture({
  reduced,
  mode = 'full',
  onReveal,
  onDone,
  onSkip,
}: AtlasOvertureProps) {
  const breath = mode === 'breath';
  const [showTwo, setShowTwo] = useState(reduced && !breath);
  const [revealed, setRevealed] = useState(reduced || breath);
  const [fading, setFading] = useState(false);
  const doneRef = useRef(false);

  const finish = useRef(() => {});
  finish.current = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  // Skip on any input, anywhere. Removed as soon as the overture is over.
  useEffect(() => {
    const skip = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      onSkip();
      onDone();
    };
    const opts = { passive: true } as AddEventListenerOptions;
    window.addEventListener('pointerdown', skip, opts);
    window.addEventListener('keydown', skip);
    window.addEventListener('touchstart', skip, opts);
    window.addEventListener('wheel', skip, opts);
    return () => {
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('touchstart', skip);
      window.removeEventListener('wheel', skip);
    };
  }, [onSkip, onDone]);

  // The choreography.
  useEffect(() => {
    const timers: number[] = [];
    if (breath) {
      // The globe is already present; settle the thesis line over it, hold,
      // then lift. onReveal at once so the resting sky never blacks out.
      onReveal();
      timers.push(window.setTimeout(() => setFading(true), BREATH_HOLD));
      timers.push(window.setTimeout(() => finish.current(), BREATH_HOLD + BREATH_FADE));
    } else if (reduced) {
      onReveal();
      timers.push(window.setTimeout(() => setFading(true), REDUCED_HOLD));
      timers.push(window.setTimeout(() => finish.current(), REDUCED_HOLD + REDUCED_FADE));
    } else {
      timers.push(window.setTimeout(() => setShowTwo(true), LINE_TWO_AT));
      timers.push(
        window.setTimeout(() => {
          setRevealed(true);
          setFading(true);
          onReveal();
        }, REVEAL_AT),
      );
      timers.push(window.setTimeout(() => finish.current(), DONE_AT));
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, breath]);

  const line = (shown: boolean, delayMs: number): React.CSSProperties => ({
    fontFamily: 'var(--font-display)',
    fontWeight: 400,
    fontSize: 'clamp(21px, 2.6vw, 34px)',
    lineHeight: 1.32,
    letterSpacing: '0.01em',
    color: 'rgba(233, 221, 198, 0.94)',
    maxWidth: '20ch',
    margin: '0 auto',
    textAlign: 'center' as const,
    opacity: fading ? 0 : shown ? 1 : 0,
    transform: reduced || breath ? 'none' : shown ? 'translateY(0)' : 'translateY(6px)',
    transition:
      reduced || breath
        ? `opacity ${breath ? BREATH_FADE : REDUCED_FADE}ms ease`
        : `opacity 800ms ease ${delayMs}ms, transform 900ms ease ${delayMs}ms`,
    textShadow: breath ? '0 2px 24px rgba(8,6,4,0.9)' : undefined,
  });

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.1rem',
        padding: '0 2rem',
        pointerEvents: reduced || breath ? 'none' : 'auto',
        // Full motion covers the earth in black, then lifts it; reduced motion
        // and the returning breath never black out (the globe shows through).
        background:
          reduced || breath
            ? 'transparent'
            : revealed
            ? 'rgba(15,13,11,0)'
            : 'rgba(15,13,11,1)',
        transition: reduced || breath ? 'none' : 'background 1200ms ease',
      }}
    >
      <p style={line(true, 0)}>{LINE_ONE}</p>
      {!breath && <p style={line(showTwo, 0)}>{LINE_TWO}</p>}
    </div>
  );
}
