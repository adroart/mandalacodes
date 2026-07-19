/**
 * The overture (build-order item 3; the living ledger, ruling 1 — reader-paced
 * entry): the vision speaks once, over black, and HOLDS. Behind the words the
 * earth slowly fades in over a long, gentle ramp; the founding lights ignite
 * there. No timer ever removes the words — one tap, click, or keypress anywhere
 * releases them (a graceful fade), and the already-present world stands. The
 * two lines are DOM, never WebGL text.
 *
 * The vision speaks every arrival, scaled by familiarity (Adrian, 2026-07-18):
 *   full    a cold visit — the word-led overture, played regardless of how
 *           many lights exist (even over an empty sky). The black cover fades
 *           out over the earth as it emerges; the words hold until released.
 *   breath  a returning visit — the thesis line settles over the already-
 *           present globe (no black cover), and holds until released.
 *
 * This component owns only the words, the touch hint, and the black cover;
 * AtlasPage owns the earth behind it and the ignition (Markers). onReveal fires
 * once, at mount, so the world is already emerging behind the held words; the
 * release only fades the words and fires onDone.
 *
 * Reader-paced choreography (the living ledger, ruling 1):
 *   full     black cover fades out over ~6s (the earth emerges, the lights
 *            ignite) while line one, then line two, settle and HOLD; a barely-
 *            there "touch anywhere" hint appears after ~6s; one input fades the
 *            words -> onDone(). No timer ever removes the words.
 *   breath   the thesis line settles over the already-present globe and holds;
 *            same hint, same tap-to-release.
 *   reduced  the words sit static over the already-visible globe (no cover, no
 *            motion); same hint, same tap-to-release.
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

// The earth emerges behind the words over this long, gentle ramp, then rests.
const SCENE_FADE_MS = 6000;
// A gentle stagger for the second line to arrive (never a removal).
const LINE_TWO_AT = 1100;
// The barely-there hint appears once the earth has fully emerged.
const HINT_AT = 6000;
// The words fade gracefully on release; the returning breath fades a touch faster.
const RELEASE_FADE_MS = 900;
const BREATH_FADE_MS = 600;

export interface AtlasOvertureProps {
  reduced: boolean;
  /** 'full' plays the word-led overture; 'breath' plays the returning-visit
      form (one line over the already-present globe). Defaults to full. */
  mode?: 'full' | 'breath';
  /** Fired once, at mount: the earth is already emerging behind the held words
      (full motion), or the settled sky is already up (reduced / breath). */
  onReveal: () => void;
  /** The overture is over: unmount it. */
  onDone: () => void;
}

export default function AtlasOverture({
  reduced,
  mode = 'full',
  onReveal,
  onDone,
}: AtlasOvertureProps) {
  const breath = mode === 'breath';
  // Reduced motion shows both lines at once (nothing moves); full staggers the
  // second in; breath shows only the first line.
  const [showTwo, setShowTwo] = useState(reduced && !breath);
  const [showHint, setShowHint] = useState(false);
  // The black cover starts opaque only for the full cold visit; it fades out to
  // reveal the emerging earth. Reduced and breath never cover the globe.
  const [uncovered, setUncovered] = useState(reduced || breath);
  const [fading, setFading] = useState(false);
  const doneRef = useRef(false);
  const fadeMs = breath ? BREATH_FADE_MS : RELEASE_FADE_MS;

  // One tap / click / keypress anywhere releases the words. No timer ever does.
  useEffect(() => {
    const release = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      setFading(true);
      window.setTimeout(onDone, fadeMs);
    };
    // Capture phase, on window: the globe stage and its controls stop
    // propagation of pointer events before they bubble back to window, so a
    // bubble-phase listener would never see a tap on the stage. Capturing at
    // the top means one input anywhere always reaches the release.
    const opts = { passive: true, capture: true } as AddEventListenerOptions;
    window.addEventListener('pointerdown', release, opts);
    window.addEventListener('keydown', release, true);
    window.addEventListener('touchstart', release, opts);
    return () => {
      window.removeEventListener('pointerdown', release, true);
      window.removeEventListener('keydown', release, true);
      window.removeEventListener('touchstart', release, true);
    };
  }, [onDone, fadeMs]);

  // Choreography. The world is revealed once, at mount, so it emerges behind
  // the held words; no timer removes the words.
  useEffect(() => {
    onReveal();
    const timers: number[] = [];
    if (!reduced && !breath) {
      // Lift the black cover on the next frame so the CSS ramp runs, and settle
      // the second line in behind it.
      const raf = window.requestAnimationFrame(() => setUncovered(true));
      timers.push(window.setTimeout(() => setShowTwo(true), LINE_TWO_AT));
      timers.push(window.setTimeout(() => setShowHint(true), HINT_AT));
      return () => {
        window.cancelAnimationFrame(raf);
        timers.forEach((t) => window.clearTimeout(t));
      };
    }
    timers.push(window.setTimeout(() => setShowHint(true), HINT_AT));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, breath]);

  const line = (shown: boolean): React.CSSProperties => ({
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
        ? `opacity ${fadeMs}ms ease`
        : `opacity 800ms ease, transform 900ms ease`,
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
        // The overture holds the stage: it takes the release tap itself, so a
        // single input can never also fall through to the resting chrome behind
        // it. The keydown release rides the window listener above.
        pointerEvents: fading ? 'none' : 'auto',
        background: `rgba(15,13,11,${uncovered ? 0 : 1})`,
        transition:
          reduced || breath ? 'none' : `background ${SCENE_FADE_MS}ms ease`,
      }}
    >
      <p style={line(true)}>{LINE_ONE}</p>
      {!breath && <p style={line(showTwo)}>{LINE_TWO}</p>}

      {/* The barely-there hint (the living ledger, ruling 1): a small lowercase
          Karla label at the foot, resting at 0.5, that the release fades away. */}
      <span
        style={{
          position: 'absolute',
          bottom: 'clamp(2rem, 7vh, 5rem)',
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: 'var(--font-label)',
          fontSize: '11px',
          textTransform: 'lowercase',
          letterSpacing: '0.2em',
          color: 'rgba(233, 221, 198, 0.9)',
          opacity: fading ? 0 : showHint ? 0.5 : 0,
          transition: 'opacity 900ms ease',
        }}
      >
        touch anywhere
      </span>
    </div>
  );
}
