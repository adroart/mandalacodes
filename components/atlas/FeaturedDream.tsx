/**
 * The featured dream (build-order item 3, Room one item 5): at rest, one dream
 * at a time. A single public dream, complete, in generous Cormorant, composed
 * in the lower third opposite the caption (right on desktop; above the caption
 * on phones), with a hairline tether from the text toward its light when that
 * light is on the facing hemisphere. Cross-fades to the next roughly every 20s
 * (the rotation lives in AtlasPage); tapping it travels to the piece.
 *
 * Legibility first (law 2, sharpened): the dream never fights the earth. On
 * desktop the block is placed in the dark margin beside the globe, its inner
 * edge computed from the globe's projected screen circle (`globe`) so no line
 * crosses the limb, the rim rings, or a light's bloom. Wherever it renders it
 * is backed by a quiet local scrim — a soft radial deepening of the night, no
 * card edge — so every glyph sits on calm ground. Adrian's ruling: if you can't
 * read the dream it does not exist.
 *
 * Orientation-level chrome: it rests no lower than 0.6 opacity (law 3), passed
 * in as `opacity`. Reduced motion swaps plainly, never cross-fades.
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
}

/** The scrim: a soft elliptical deepening of the night behind the text, so the
    dream always sits on calm ground. No visible edge, no blur box — it falls to
    fully transparent well before any hard boundary (law 2). */
const SCRIM =
  'radial-gradient(115% 135% at 62% 50%, rgba(7,5,3,0.66) 0%, rgba(7,5,3,0.5) 38%, rgba(7,5,3,0.26) 62%, rgba(7,5,3,0) 80%)';

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
  }, [shown, box, isPhone]);

  // Desktop placement: seat the block in the dark margin to the RIGHT of the
  // globe. Its inner (left) edge is pushed past the globe's limb + a gap, so no
  // line crosses the sphere. The reference limb is taken a safe step BELOW the
  // equator (the block is bottom-anchored in the lower third), which decouples
  // the width from the block's own height — no reflow loop. On tight desktops
  // the width floors and the scrim carries any small overlap of the lower dark.
  useLayoutEffect(() => {
    if (isPhone || !globe) {
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
    if (!el || isPhone) {
      setAnchor(null);
      return;
    }
    const x = el.offsetLeft; // left edge (the inner edge on the right side)
    const y = el.offsetTop + el.offsetHeight / 2;
    setAnchor({ x, y });
  }, [shown, isPhone, visible, box]);

  if (!shown) return null;

  /* Tether retired (Adrian's live-walkthrough ruling, second pass): a line
     from the text to a light on the far side of the frame crossed the whole
     face of the earth, exactly the "random lines" he rejected. The standing
     sub-line already names the piece, its city, and its ordinal; the tap
     still travels to the light. Less is more. */
  const showTether = false;

  // Desktop box style from the computed placement; phone keeps its bottom-
  // anchored slot above the caption. Both carry the scrim.
  const positionStyle: React.CSSProperties = isPhone
    ? { left: '1.25rem', right: '1.25rem', bottom: '13rem' }
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
          isPhone
            ? 'pointer-events-auto absolute z-10 text-left'
            : 'pointer-events-auto absolute z-10 text-right'
        }
        style={{
          ...positionStyle,
          opacity: visible ? opacity : 0,
          transition: reduced ? 'none' : 'opacity 420ms ease',
          background: 'transparent',
          border: 'none',
          // Generous padding so the scrim reaches well beyond the glyphs and
          // falls off as calm night, never as a panel edge.
          padding: isPhone ? '1.1rem 1.25rem' : '1.4rem 1.6rem',
          cursor: 'pointer',
        }}
      >
        {/* The scrim sits behind the text, extending past the padding and
            fading to nothing — a deepening of the night, not a card. */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: isPhone ? '-1rem -0.75rem' : '-1.2rem -1rem',
            background: SCRIM,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
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
            textShadow: '0 1px 16px rgba(8,6,4,0.85)',
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
            color: 'rgba(200,176,132,0.78)',
          }}
        >
          {shown.standing}
        </p>
      </button>
    </>
  );
}
