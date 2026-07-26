/**
 * The featured dream (build-order item 3, Room one item 5): at rest, one dream
 * at a time. A single public dream, complete, in generous Cormorant, composed
 * in the lower third opposite the caption. Cross-fades to the next roughly
 * every 20s (the rotation lives in AtlasPage); tapping it travels to the piece.
 *
 * Two placements, and they are genuinely different problems:
 *
 *  - Desktop: this component seats itself in the dark margin to the RIGHT of
 *    the globe, its inner edge computed from the globe's projected screen
 *    circle (`globe`) so no line crosses the limb, the rim rings, or a light's
 *    bloom. It carries its own radial scrim.
 *  - Phone (`inFlow`): there is no margin to seat it in. It renders as a plain
 *    block inside AtlasPage's lower band, sharing that band's rail and gradient
 *    floor, and the globe's camera lifts to clear it (see GlobeScene). It used
 *    to float bottom-anchored over the sphere on its own left inset, which put
 *    the most intimate text on the page across the lit coastlines and left it
 *    one long dream away from colliding with the caption below it.
 *
 * Legibility first (law 2, sharpened): the dream never fights the earth, and
 * whatever backs it is a deepening of the night, never a card edge. Adrian's
 * ruling: if you can't read the dream it does not exist.
 *
 * Orientation-level chrome: at rest the page fades it with the rest of the band
 * (floor 0.8, passed in as `opacity`; see the contrast note in AtlasPage before
 * lowering that). Reduced motion swaps plainly, never cross-fades.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface FeaturedDreamData {
  /** The piece key, for selection on tap. */
  key: string;
  /** The public dream, complete text. */
  text: string;
  /** The sub-line: code, city, founding-light ordinal (already composed). */
  standing: string;
}

/** The globe's projected screen circle in the stage's coordinate space, so the
    block can be laid off the limb. cx/cy = centre, r = radius, both in px. */
export interface GlobeCircle {
  cx: number;
  cy: number;
  r: number;
}

export interface FeaturedDreamProps {
  dream: FeaturedDreamData | null;
  /** The light's position in section coordinates, or null when it is behind
      the globe (then the tether is skipped). */
  screenPos: { x: number; y: number } | null;
  /** The globe's screen circle (desktop only); null on phone or before measure. */
  globe: GlobeCircle | null;
  isPhone: boolean;
  reduced: boolean;
  opacity: number;
  onSelect: (key: string) => void;
  /** Render as a static block inside the caller's stack instead of positioning
      itself. The phone band uses this: the dream and the caption rail used to
      be two independently bottom-anchored blocks that drifted into each other
      as the dream's length changed, on two different left rails. In flow they
      share one rail, one rhythm, and the band's own gradient floor, so nothing
      needs a local scrim and nothing can collide. */
  inFlow?: boolean;
}

/** The scrim: a soft elliptical deepening of the night behind the text, so the
    dream always sits on calm ground. No visible edge, no blur box — it falls to
    fully transparent well before any hard boundary (law 2). */
const SCRIM =
  'radial-gradient(96% 104% at 60% 50%, rgba(7,5,3,0.72) 0%, rgba(7,5,3,0.56) 34%, rgba(7,5,3,0.24) 58%, rgba(7,5,3,0.07) 74%, rgba(7,5,3,0) 88%)';

/* Dreams are long (Adrian, 2026-07-18). The featured slot shows only the
   opening — about sixty words — and travels to the full text on tap. Where a
   sentence boundary falls within that window the excerpt ends on it; otherwise
   it cuts at the word target. A quiet ellipsis marks that more waits on the
   piece. A short dream (already under the window) shows whole, no ellipsis. */
const FEATURED_WORD_TARGET = 60;
const FEATURED_MAX_LINES = 10;

/** Rebuild a truncated excerpt from the first `n` words with a quiet ellipsis,
    dropping a dangling comma or colon so the cut never ends mid-punctuation. */
function toWords(core: string, n: number): string {
  const kept = core.split(' ').slice(0, Math.max(1, n)).join(' ').replace(/[,;:–-]+$/, '');
  return `${kept} …`;
}

export function openingExcerpt(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  const words = clean.split(' ');
  if (words.length <= FEATURED_WORD_TARGET) return clean;
  const windowText = words.slice(0, FEATURED_WORD_TARGET).join(' ');
  // Prefer the last full sentence that ends within the window, as long as it
  // carries most of the opening (never cut back to a single clause).
  const m = windowText.match(/^[\s\S]*[.!?]["'”’)\]]?(?=\s|$)/);
  const atSentence = m ? m[0].trim() : '';
  const body =
    atSentence && atSentence.length >= windowText.length * 0.5 ? atSentence : windowText.trim();
  return `${body} …`;
}

export default function FeaturedDream({
  dream,
  screenPos,
  globe,
  isPhone,
  reduced,
  opacity,
  onSelect,
  inFlow = false,
}: FeaturedDreamProps) {
  // Cross-fade: hold the shown dream, fade out on change, swap, fade in.
  const [shown, setShown] = useState<FeaturedDreamData | null>(dream);
  const [visible, setVisible] = useState(true);
  const blockRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
  // Computed desktop placement (left edge + width) that clears the globe's limb.
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  // The opening excerpt, shortened word by word until it sits within the
  // eight-line ceiling at the block's real width, always ending on a clean
  // quiet ellipsis. Measured against the live paragraph so the fit is honest
  // whether the block is a wide desktop margin or the narrow tight-desktop floor.
  const [fitted, setFitted] = useState<string>(() => openingExcerpt(dream?.text ?? ''));

  useEffect(() => {
    if (dream?.key === shown?.key) {
      setShown(dream);
      return;
    }
    if (reduced) {
      setShown(dream);
      setVisible(true);
      return;
    }
    setVisible(false);
    const t = window.setTimeout(() => {
      setShown(dream);
      setVisible(true);
    }, 420);
    return () => window.clearTimeout(t);
  }, [dream, shown, reduced]);

  // Fit the opening excerpt into at most eight lines at the block's real width.
  // Start from the ~60-word opening and shorten a word at a time until it sits
  // within the ceiling; the block stays legible and the tap-through carries the
  // rest. Runs before paint, so there is no flash of an over-long block.
  useLayoutEffect(() => {
    const el = textRef.current;
    const base = openingExcerpt(shown?.text ?? '');
    if (!el || !shown) {
      setFitted(base);
      return;
    }
    const cs = window.getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
    const maxH = lh * FEATURED_MAX_LINES + 1;
    const prev = el.textContent;
    el.textContent = base;
    if (el.scrollHeight <= maxH) {
      el.textContent = prev;
      setFitted(base);
      return;
    }
    const core = base.replace(/\s*…\s*$/, '');
    const words = core.split(' ');
    let n = words.length;
    while (n > 6) {
      el.textContent = toWords(core, n);
      if (el.scrollHeight <= maxH) break;
      n--;
    }
    const finalText = toWords(core, n);
    el.textContent = prev;
    setFitted(finalText);
  }, [shown, box, isPhone, inFlow]);

  // Desktop placement: seat the block in the dark margin to the RIGHT of the
  // globe. Its inner (left) edge is pushed past the globe's limb + a gap, so no
  // line crosses the sphere. The reference limb is taken a safe step BELOW the
  // equator (the block is bottom-anchored in the lower third), which decouples
  // the width from the block's own height — no reflow loop. On tight desktops
  // the width floors and the scrim carries any small overlap of the lower dark.
  useLayoutEffect(() => {
    if (inFlow || !globe) {
      setBox(null);
      return;
    }
    const { cx, cy, r } = globe;
    const stageW = cx * 2;
    const stageH = cy * 2;
    const RIGHT_GAP = 40; // block right edge inset from the stage edge
    const LIMB_GAP = 26; // clearance past the limb before text may begin
    const refDy = 0.12 * stageH; // sample the limb this far below the equator
    const limbX = cx + Math.sqrt(Math.max(0, r * r - refDy * refDy));
    const rightX = stageW - RIGHT_GAP;
    const rawWidth = rightX - (limbX + LIMB_GAP);
    const width = Math.max(250, Math.min(430, rawWidth));
    const left = rightX - width;
    setBox((prev) =>
      prev && Math.abs(prev.left - left) < 1 && Math.abs(prev.width - width) < 1
        ? prev
        : { left, width },
    );
  }, [globe, isPhone]);

  // Measure the block's tether anchor (its inner edge, toward the globe) in
  // section coordinates, so the hairline meets the text cleanly.
  useEffect(() => {
    const el = blockRef.current;
    if (!el || inFlow) {
      setAnchor(null);
      return;
    }
    const x = el.offsetLeft; // left edge (the inner edge on the right side)
    const y = el.offsetTop + el.offsetHeight / 2;
    setAnchor({ x, y });
  }, [shown, inFlow, visible, box]);

  if (!shown) return null;

  /* Tether retired (Adrian's live-walkthrough ruling, second pass): a line
     from the text to a light on the far side of the frame crossed the whole
     face of the earth, exactly the "random lines" he rejected. The standing
     sub-line already names the piece, its city, and its ordinal; the tap
     still travels to the light. Less is more. */
  const showTether = false;

  // In flow the parent band owns placement, the rail and the floor, so the
  // block contributes nothing but its own height.
  const positionStyle: React.CSSProperties = inFlow
    ? { position: 'static', width: '100%' }
    : box
      ? { left: box.left, width: box.width, bottom: '11%' }
      : // Pre-measure fallback: hug the right margin, narrow, so the very first
        // paint never crosses the globe before the circle is known.
        { right: '2rem', width: '17rem', bottom: '11%' };

  return (
    <>
      {showTether && (
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 hidden sm:block"
          width="100%"
          height="100%"
          style={{ opacity: visible ? opacity : 0, transition: 'opacity 500ms ease' }}
        >
          <line
            x1={screenPos!.x}
            y1={screenPos!.y}
            x2={anchor!.x}
            y2={anchor!.y}
            stroke="rgba(196,170,124,0.4)"
            strokeWidth={1}
          />
          <circle cx={screenPos!.x} cy={screenPos!.y} r={2} fill="rgba(238,195,135,0.85)" />
        </svg>
      )}

      <button
        type="button"
        ref={blockRef as unknown as React.RefObject<HTMLButtonElement>}
        onClick={() => onSelect(shown.key)}
        aria-label="Read this dream on its piece"
        className={
          inFlow
            ? 'pointer-events-auto block w-full text-left'
            : 'pointer-events-auto absolute z-10 text-right'
        }
        style={{
          ...positionStyle,
          opacity: visible ? opacity : 0,
          transition: reduced ? 'none' : 'opacity 420ms ease',
          background: 'transparent',
          border: 'none',
          // In flow the band supplies the rail inset; free-floating, the padding
          // is what lets the scrim reach past the glyphs and fall off as calm
          // night rather than as a panel edge.
          padding: inFlow ? 0 : '1.4rem 1.6rem',
          cursor: 'pointer',
        }}
      >
        {/* The scrim sits behind the text, extending past the padding and
            fading to nothing — a deepening of the night, not a card. In flow
            the band's own gradient floor already does this job for the whole
            lower third, and a second one stacked on top reads as a smudge. */}
        {!inFlow && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              // Wide enough that the gradient reaches full transparency well
              // inside its own box. At the old inset the vertical stop still
              // carried alpha at the box edge, so the "soft deepening of the
              // night, no card edge" rendered on desktop as a visible rectangle
              // with hard top and bottom borders: precisely the panel it is
              // documented not to be.
              inset: '-3.25rem -2.75rem',
              background: SCRIM,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        )}
        <p
          ref={textRef}
          style={{
            position: 'relative',
            zIndex: 1,
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            // The calm dream scale (Adrian, 2026-07-18): one quiet size tuned
            // for the three-to-five-sentence median. A short dream sits small
            // and dignified in this same slot; nothing inflates.
            fontSize: isPhone ? '17px' : 'clamp(17px, 1.1vw, 18px)',
            lineHeight: 1.45,
            letterSpacing: '0.01em',
            color: 'rgba(236, 226, 207, 0.96)',
            margin: 0,
            // Only when free-floating over the earth. In flow the band's
            // gradient already gives the text calm ground, and the per-glyph
            // haloes then overlap into a faint rectangle the size of the text
            // block: an accidental card edge, the exact thing the scrim is
            // written to avoid.
            textShadow: inFlow ? 'none' : '0 1px 16px rgba(8,6,4,0.85)',
            // Never more than ~10 lines in the featured slot: the opening
            // excerpt is short, but on tight desktop widths this floor keeps
            // the block calm and lets tap-through carry the rest.
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 10,
            overflow: 'hidden',
          }}
        >
          {fitted}
        </p>
        <p
          className="mt-2 font-label uppercase"
          style={{
            position: 'relative',
            zIndex: 1,
            fontSize: isPhone ? 10 : 11,
            letterSpacing: '0.16em',
            // Full alpha, dimmer hue. Quiet has to come from the colour itself:
            // the block already sits under the page's idle fade, and a second
            // alpha on top of that is what took this line under 3:1.
            color: '#b9a179',
          }}
        >
          {/* Break only at the separators. Right-aligned in the desktop margin
              this line wrapped mid-phrase ("THE 1ST / LIGHT"), splitting the
              one human fact on it across two rows. Hard spaces inside each
              segment let it wrap between facts and never inside one. */}
          {shown.standing
            .split(' · ')
            .map((seg) => seg.replace(/ /g, '\u00A0'))
            .join(' · ')}
        </p>
      </button>
    </>
  );
}
