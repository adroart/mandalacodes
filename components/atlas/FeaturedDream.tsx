/**
 * The featured dream (build-order item 3, Room one item 5): at rest, one dream
 * at a time. A single public dream, complete, in generous Cormorant, composed
 * in the lower third opposite the caption (right on desktop; above the caption
 * on phones), with a hairline tether from the text toward its light when that
 * light is on the facing hemisphere. Cross-fades to the next roughly every 20s
 * (the rotation lives in AtlasPage); tapping it travels to the piece.
 *
 * Orientation-level chrome: it rests no lower than 0.6 opacity (law 3), passed
 * in as `opacity`. Reduced motion swaps plainly, never cross-fades.
 */

import { useEffect, useRef, useState } from 'react';

export interface FeaturedDreamData {
  /** The piece key, for selection on tap. */
  key: string;
  /** The public dream, complete text. */
  text: string;
  /** The sub-line: code, city, founding-light ordinal (already composed). */
  standing: string;
}

export interface FeaturedDreamProps {
  dream: FeaturedDreamData | null;
  /** The light's position in section coordinates, or null when it is behind
      the globe (then the tether is skipped). */
  screenPos: { x: number; y: number } | null;
  isPhone: boolean;
  reduced: boolean;
  opacity: number;
  onSelect: (key: string) => void;
}

export default function FeaturedDream({
  dream,
  screenPos,
  isPhone,
  reduced,
  opacity,
  onSelect,
}: FeaturedDreamProps) {
  // Cross-fade: hold the shown dream, fade out on change, swap, fade in.
  const [shown, setShown] = useState<FeaturedDreamData | null>(dream);
  const [visible, setVisible] = useState(true);
  const blockRef = useRef<HTMLDivElement | null>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

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
  }, [shown, isPhone, visible]);

  if (!shown) return null;

  const showTether =
    !isPhone && visible && screenPos != null && anchor != null && opacity > 0.05;

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
          // Phone: bottom-anchored above the caption, so a long dream grows
          // upward over the globe rather than down into the caption.
          isPhone
            ? 'pointer-events-auto absolute left-5 right-5 bottom-[13rem] z-10 text-left'
            : 'pointer-events-auto absolute right-8 bottom-[19%] z-10 text-right max-w-[30rem]'
        }
        style={{
          opacity: visible ? opacity : 0,
          transition: reduced ? 'none' : 'opacity 420ms ease',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        <p
          style={{
            fontFamily: '"Cormorant Garamond", serif',
            fontWeight: 400,
            fontSize: isPhone ? 'clamp(17px, 4.6vw, 20px)' : 'clamp(20px, 1.7vw, 26px)',
            lineHeight: 1.4,
            letterSpacing: '0.01em',
            color: 'rgba(233, 221, 198, 0.92)',
            margin: 0,
            textShadow: '0 1px 18px rgba(8,6,4,0.9)',
          }}
        >
          {shown.text}
        </p>
        <p
          className="mt-2 font-label uppercase"
          style={{
            fontSize: isPhone ? 10 : 11,
            letterSpacing: '0.16em',
            color: 'rgba(196,170,124,0.7)',
          }}
        >
          {shown.standing}
        </p>
      </button>
    </>
  );
}
