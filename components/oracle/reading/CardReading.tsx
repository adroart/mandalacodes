/* CardReading — the data adapter and breakpoint seam for the imported
   Claude Design card reading.

   This is the ONLY hand-written part. Everything visible comes from the two
   generated markup components, which are byte-exact conversions of the design
   files (see _src/). Never hand-edit the generated files; re-run the converter:

     python3 ~/builds/dc-import/convert.py \
       "components/oracle/reading/_src/Card Reading - Mobile.dc.html" \
       components/oracle/reading/generated CardReadingMobile

   Why two hosts rather than one: the two designs share the same reading engine
   (scroll, parallax, comet, jump-bar) but genuinely differ in information
   architecture. Mobile carries a pill rail plus a five-item icon tab bar;
   desktop carries a top header nav, a card meta block, and richer per-lens rail
   entries with summaries and glyphs, plus focus-fade and a section-reveal
   observer mobile does not have. Forcing one DOM to serve both would mean
   conditionally rendering most of each tree, which breaks the fidelity of the
   locked desktop design. One data bag still feeds both, so there is a single
   wiring surface — only the markup forks. */
import React, { useEffect, useState } from 'react';
import CardReadingMobileHost, { type CardReadingMobileData } from './generated/CardReadingMobile.host';
import CardReadingDesktopHost, { type CardReadingDesktopData } from './generated/CardReadingDesktop.host';
import './generated/CardReadingMobile.style.css';
import './generated/CardReadingDesktop.style.css';
/* Loads last: dissolves the design files' mockup frame so the reading fills the
   viewport. See the file for why it overrides rather than edits. */
import './card-reading-fullbleed.css';

/* Where the two-column desktop layout gives way to the single-column mobile
   one. Measured rather than guessed: the desktop layout still reads correctly
   down to about 780px, and only breaks below ~760 where the brand mark and the
   top nav start to overlap. 820 keeps a margin above that. */
const DESKTOP_QUERY = '(min-width: 820px)';

export interface CardReadingLens {
  id: string;
  /* Full name, desktop rail: "Universal Language" */
  label: string;
  /* Rail name on desktop, where there is room: "Human Design" */
  tab: string;
  /* Rail name on mobile, where six labels share 402px. The design abbreviates
     here ("H. Design"); without it long names collide. Falls back to `tab`. */
  tabShort?: string;
  /* Desktop rail summary line: "Sphere of Genius" */
  sum?: string;
  glyph?: 'star' | 'hex' | 'sprout' | 'diamond' | 'circle' | 'rings';
}

export interface CardReadingProps {
  /* The six lens sections of the reading, in order. */
  lenses?: CardReadingLens[];
  /* Desktop card meta block: Element / Gate / Keynotes. */
  meta?: { k: string; v: string }[];
  /* Desktop top nav. */
  headerLabels?: { label: string; active?: boolean }[];
  /* Desktop header title block: the small line above, then the card name. */
  cardKicker?: string;
  cardName?: string;
  /* Mobile bottom tab bar. */
  tabs?: { id: string; label: string; color: string }[];
  /* Desktop rail node style, from the design file's own two modes. */
  railNode?: 'glyph' | 'ring';
  /* Force a variant instead of measuring the viewport (useful for previews). */
  variant?: 'mobile' | 'desktop';
  /* The reading body itself. Both design files leave this as a slot
     (<dc-import name="Reading">) and supply only the shell around it, so the
     prose comes from the app. Each lens section must carry
     data-sec="<lens id>" — that is what the design's own scroll engine keys
     the rail, marker and jump behaviour off. Without it the reading renders
     but the rail stays inert. */
  reading?: React.ReactNode;
  /* The mandala artwork, dropped into the design's own sizing container. */
  artwork?: React.ReactNode;
}

const GLYPH_FLAG: Record<string, string> = {
  star: 'gStar', hex: 'gHex', sprout: 'gSprout',
  diamond: 'gDiamond', circle: 'gCircle', rings: 'gRings',
};

function useIsDesktop(forced?: 'mobile' | 'desktop') {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (forced) return forced === 'desktop';
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return window.matchMedia(DESKTOP_QUERY).matches;
  });

  useEffect(() => {
    if (forced || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [forced]);

  return forced ? forced === 'desktop' : isDesktop;
}

export const CardReading: React.FC<CardReadingProps> = ({
  lenses, meta, headerLabels, tabs, railNode, variant, reading, artwork, cardKicker, cardName,
}) => {
  const isDesktop = useIsDesktop(variant);

  /* One bag, two shapes. Each host falls back to its design file's own defaults
     for anything not supplied, so an unconfigured render matches the source. */
  const mobileData: CardReadingMobileData = {
    nav: lenses?.map((l) => ({ id: l.id, tab: l.tabShort ?? l.tab })),
    tabs,
  };

  const desktopData: CardReadingDesktopData = {
    nav: lenses?.map((l) => ({
      id: l.id,
      label: l.label,
      sum: l.sum ?? '',
      tab: l.tab,
      ...(l.glyph ? { [GLYPH_FLAG[l.glyph]]: true } : {}),
    })),
    meta,
    headerLabels,
    cardKicker,
    cardName,
  };

  return isDesktop
    ? <CardReadingDesktopHost data={desktopData} railNode={railNode} reading={reading} artwork={artwork} />
    : <CardReadingMobileHost data={mobileData} reading={reading} artwork={artwork} />;
};

export default CardReading;
