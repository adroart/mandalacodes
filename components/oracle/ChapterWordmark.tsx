import React, { useLayoutEffect, useRef, useState } from 'react';

export type ChapterKey = 'ul' | 'iching' | 'genekeys' | 'humandesign' | 'tarot' | 'body';

export interface Chapter {
  key: ChapterKey;
  label: string;       // displayed text, e.g. "I Ching"
  shortLabel?: string; // optional narrow-screen replacement (kept for backwards compat; rarely needed now that the row wraps)
}

/**
 * Editorial chapter wordmark.
 *
 * A typeset row of serif italic chapter labels separated by middle dots:
 *
 *     UL · I Ching · Gene Keys · Human Design · Body · Relations
 *                    ──────
 *                 (bronze underline on the active chapter)
 *
 * The labels read as a sentence rather than as a tab bar. No cell
 * dividers, no equal-width buckets — each label is content-sized and
 * the row wraps between labels when the viewport is too narrow. Labels
 * never break internally (whitespace-nowrap).
 *
 * The active chapter is shown with a bronze color and a slim sliding
 * underline that tracks the active label's position (works correctly
 * even when the row wraps to multiple lines).
 *
 * Visual register: matches the keyword row in the title card (dot-
 * separated serif words). The whole hero area reads as one
 * typographic system rather than navigation chrome bolted on.
 *
 * Tap a label → onSelect(key).
 */
export const ChapterWordmark: React.FC<{
  chapters: Chapter[];
  active: ChapterKey;
  onSelect: (key: ChapterKey) => void;
  /**
   * `paper` for light backgrounds, `mixed` for the floating sticky chrome
   * that may sit over light or dark sections. The active label is always
   * bronze.
   */
  variant: 'paper' | 'mixed';
  /**
   * Layout shape:
   * - `inline` (default): edge-to-edge band on mobile, rounded-pill on
   *   desktop. Used when the strip sits as in-flow content on the page.
   * - `sticky`: edge-to-edge band on all viewports. Used when the strip
   *   is part of the sticky contextual header, where a floating rounded
   *   pill would look disconnected from the header chrome above it.
   */
  shape?: 'inline' | 'sticky';
  className?: string;
}> = ({ chapters, active, onSelect, variant, shape = 'inline', className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<Map<ChapterKey, HTMLButtonElement | null>>(new Map());
  const [underline, setUnderline] = useState<{ left: number; top: number; width: number; ready: boolean }>({
    left: 0,
    top: 0,
    width: 0,
    ready: false,
  });

  // Track the active label's position relative to the container so the
  // sliding underline can sit beneath it. Recomputes on resize and after
  // fonts load (Cormorant italic measures differently than the system
  // fallback). Tracks both left AND top because the row may wrap to
  // multiple lines on narrow viewports — the underline needs to follow
  // the active label down to its wrapped line.
  useLayoutEffect(() => {
    const update = () => {
      // Measure relative to the scrolling row (offsetParent), so the underline
      // stays glued to the active label even when the row is scrolled
      // horizontally. offsetLeft/offsetTop are content-relative and therefore
      // scroll-invariant; getBoundingClientRect would drift as the row scrolls.
      const item = itemsRef.current.get(active);
      const measureParent = scrollRef.current ?? containerRef.current;
      if (!item || !measureParent) return;
      setUnderline({
        left: item.offsetLeft,
        top: item.offsetTop + item.offsetHeight, // below the label's baseline
        width: item.offsetWidth,
        ready: true,
      });
    };
    update();
    const ro = new ResizeObserver(update);
    if (scrollRef.current) ro.observe(scrollRef.current);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', update);
    if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
      (document as any).fonts.ready.then(update).catch(() => {});
    }
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [active, chapters]);

  // Variant tokens. Paper for light section backgrounds; mixed for the
  // floating chrome strip that crosses light/dark sections.
  const paper = variant === 'paper';
  // Faint hairline — the bar is meant to read as one continuous surface
  // with the section below it, not a hard division.
  const ruleCls = paper ? 'border-wood-300/40' : 'border-stone-300/40';
  const inactiveCls = paper ? 'text-wood-600 hover:text-wood-900' : 'text-stone-400 hover:text-stone-100';
  const dotCls = paper ? 'text-wood-400' : 'text-stone-500';
  const activeCls = 'text-bronze-700';

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      role="tablist"
      aria-label="Reading chapters"
    >
      {/* Shape variants:

          shape="inline" (default, used for the on-page strip below
          the title card):
            · Mobile: full-bleed band edge-to-edge across the viewport,
              top/bottom hairlines only.
            · Desktop (>= 640px): contained rounded pill (rounded-2xl)
              centered, border on all four sides, soft shadow.

          shape="sticky" (used inside the sticky contextual header):
            · Always edge-to-edge band on every viewport. No rounded
              corners. Sits flush against the header chrome above with
              no top gap. Bottom hairline only (the header above
              provides the visual top edge).

          Both shapes keep all six labels visible and tappable — they
          wrap onto a second line when the viewport is too narrow rather
          than scrolling anything out of reach. */}
      <div
        ref={scrollRef}
        style={shape === 'sticky'
          // Fluid gap + dot/label size: the spacing between words AND the words
          // themselves shrink smoothly as the viewport narrows (clamp ties both
          // to viewport width), so more fits on one line before the row wraps.
          ? {
              columnGap: 'clamp(0.5rem, 2.4vw, 1.75rem)',
              rowGap: '0.25rem',
              fontSize: 'clamp(13px, 3.6vw, 16px)',
            }
          : undefined}
        className={
          shape === 'sticky'
            // Wrap-and-center: every label stays on screen and tappable; when
            // six don't fit one line they wrap to a second, centered line.
            ? `relative flex flex-wrap items-center justify-center w-full px-3 py-3 bg-paper-100 border-b ${ruleCls}`
            : `relative flex flex-wrap items-center justify-between gap-x-1 sm:gap-x-3 w-full sm:max-w-2xl sm:mx-auto px-4 sm:px-6 py-4 bg-paper-100 border-t border-b sm:border sm:rounded-2xl sm:shadow-[0_1px_3px_rgba(60,44,22,0.06)] ${ruleCls}`
        }
      >
        {chapters.map((chapter, idx) => {
          const isActive = chapter.key === active;
          const label = chapter.label;
          // Sticky strip reads as navigation and inherits the fluid font-size
          // set on the row (clamp), so labels scale with the viewport. Inline
          // strip keeps the larger fixed editorial display size.
          const labelSize = shape === 'sticky'
            ? '' // size comes from the row's fluid fontSize
            : 'text-[17px] sm:text-[20px] md:text-[22px]';
          const isFirst = idx === 0;
          // Each entry is a single flex item: the leading dot (all but the
          // first) and its label live in ONE inline-flex group so they never
          // split across a wrap — the dot always travels with the label it
          // precedes instead of dangling at the end of the line above.
          return (
            <span
              key={chapter.key}
              className="inline-flex items-center flex-shrink-0"
              style={{ columnGap: 'clamp(0.5rem, 2.4vw, 1.75rem)' }}
            >
              {!isFirst && (
                <span aria-hidden="true" style={{ fontFamily: '"Cormorant Garamond", serif' }} className={`${labelSize} leading-[1.2] tracking-[-0.005em] select-none ${dotCls}`}>
                  ·
                </span>
              )}
              <button
                ref={el => { itemsRef.current.set(chapter.key, el); }}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelect(chapter.key)}
                style={{ fontFamily: '"Cormorant Garamond", serif' }}
                className={`${labelSize} leading-[1.2] tracking-[-0.005em] whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:text-bronze-700 ${isActive ? `${activeCls} font-medium` : inactiveCls}`}
              >
                {label}
              </button>
            </span>
          );
        })}

        {/* Sliding accent beneath the active label. Not a plain
            underline — a short rounded-end bronze line that reads as a
            deliberate typographic mark. Sits a few pixels below the
            label's baseline so it doesn't visually touch the letters.
            Lives INSIDE the scrolling row so it scrolls with the labels
            and tracks the active one even when the row is scrolled or
            wrapped. */}
        <span
          aria-hidden="true"
          className="absolute h-[2px] rounded-full bg-bronze-500 motion-safe:transition-all motion-safe:duration-[280ms] motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] pointer-events-none"
          style={{
            left: 0,
            top: 0,
            transform: `translate(${underline.left}px, ${underline.top + 3}px)`,
            width: underline.width,
            opacity: underline.ready ? 1 : 0,
          }}
        />
      </div>
    </div>
  );
};

export default ChapterWordmark;
