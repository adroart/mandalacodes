/**
 * The overture (build-order item 3, Room one items 1-3): the vision speaks
 * once, over black, then the earth emerges through the words as they dissolve
 * and the founding lights ignite. One continuous motion under ~5 seconds,
 * skippable with any input. The two lines are DOM, never WebGL text.
 *
 * This component owns only the words and the black cover; AtlasPage owns the
 * globe behind it and the ignition (Markers). The choreography:
 *   full motion  cover black -> line one -> line two -> onReveal() (the black
 *                lifts, the earth emerges, the lights ignite) -> onDone()
 *   reduced      the two lines sit as a static block above the settled sky
 *                (onReveal fired at once so the sky is already there), hold,
 *                then a plain crossfade out -> onDone(). Nothing moves.
 *   skip         any pointer/key/touch -> onSkip() lands on the resting sky.
 *
 * Ratified copy (verbatim, no em dashes, no italics):
 *   "Every piece I have ever made, connected into one living artwork."
 *   "Each one carries the dream of the person who keeps it."
 */

import { useEffect, useRef, useState } from 'react';

const LINE_ONE = 'Every piece I have ever made, connected into one living artwork.';
const LINE_TWO = 'Each one carries the dream of the person who keeps it.';

// Full-motion beats (ms from mount).
const LINE_TWO_AT = 1100;
const REVEAL_AT = 2300; // the black lifts, the earth emerges, the lights ignite
const DONE_AT = 3600;
// Reduced motion: a static block, held, then a plain crossfade out.
const REDUCED_HOLD = 3400;
const REDUCED_FADE = 900;

export interface AtlasOvertureProps {
  reduced: boolean;
  /** The black has lifted: mount the real lights so they ignite (full motion),
      or the settled sky is already up (reduced). */
  onReveal: () => void;
  /** The overture is over: unmount it. */
  onDone: () => void;
  /** Any input: skip the whole overture, land on the resting sky. */
  onSkip: () => void;
}

export default function AtlasOverture({ reduced, onReveal, onDone, onSkip }: AtlasOvertureProps) {
  const [showTwo, setShowTwo] = useState(reduced);
  const [revealed, setRevealed] = useState(reduced);
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
    if (reduced) {
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
  }, [reduced]);

  const line = (text: string, shown: boolean, delayMs: number): React.CSSProperties => ({
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
    transform: reduced ? 'none' : shown ? 'translateY(0)' : 'translateY(6px)',
    transition: reduced
      ? `opacity ${REDUCED_FADE}ms ease`
      : `opacity 800ms ease ${delayMs}ms, transform 900ms ease ${delayMs}ms`,
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
        pointerEvents: reduced ? 'none' : 'auto',
        // Full motion covers the earth in black, then lifts it; reduced motion
        // never blacks out (the settled sky shows through the static words).
        background: reduced
          ? 'transparent'
          : revealed
          ? 'rgba(15,13,11,0)'
          : 'rgba(15,13,11,1)',
        transition: reduced ? 'none' : 'background 1200ms ease',
      }}
    >
      <p style={line(LINE_ONE, true, 0)}>{LINE_ONE}</p>
      <p style={line(LINE_TWO, showTwo, 0)}>{LINE_TWO}</p>
    </div>
  );
}
