import React from 'react';
import {
  ATLAS_BOUNDARY_LINK_LABEL,
  ATLAS_BOUNDARY_SENTENCE,
  type AtlasBoundary,
} from '../../lib/atlas/boundary';

/**
 * The one calm boundary surface.
 *
 * Every screen that used to render a generic failure for a retired atlas route
 * renders this instead: one sentence saying where the collector record lives
 * now, and one link that opens it. Nothing else.
 *
 * There is deliberately no retry control here. These routes answer 410, so a
 * repeat request cannot succeed; offering one is the defect this replaces.
 * There is also no code, no apology and no blame: the person reading it is
 * often mid-ceremony, possibly holding a piece they have just bought.
 *
 * Two tones, because the same sentence has to sit on two grounds. `paper` is
 * the light book and admin pages. `night` is the atlas stage, where the `dark`
 * wrapper inverts the wood ramp, so this tone carries its own light values
 * rather than reaching for wood-200 or wood-300 (near black there).
 */

export interface AtlasMovedNoticeProps {
  boundary: AtlasBoundary;
  tone?: 'paper' | 'night';
  align?: 'left' | 'center';
  className?: string;
}

const TONE = {
  paper: {
    sentence: 'text-stone-700',
    link: 'text-bronze-700 hover:text-bronze-600',
    sentenceStyle: undefined as React.CSSProperties | undefined,
    linkStyle: undefined as React.CSSProperties | undefined,
  },
  night: {
    sentence: '',
    link: 'text-bronze-300 hover:text-bronze-200',
    sentenceStyle: { color: 'rgba(203,191,168,0.86)' } as React.CSSProperties,
    linkStyle: undefined as React.CSSProperties | undefined,
  },
} as const;

const AtlasMovedNotice: React.FC<AtlasMovedNoticeProps> = ({
  boundary,
  tone = 'paper',
  align = 'center',
  className,
}) => {
  const t = TONE[tone];
  return (
    <div
      className={[
        align === 'center' ? 'text-center' : 'text-left',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <p
        className={`font-display text-[1.0625rem] leading-relaxed ${t.sentence}`}
        style={t.sentenceStyle}
      >
        {ATLAS_BOUNDARY_SENTENCE}
      </p>
      <a
        href={boundary.destination}
        rel="noopener"
        className={`inline-block mt-5 min-h-[44px] font-label text-[11px] uppercase tracking-[0.18em] font-semibold transition-colors ${t.link}`}
        style={t.linkStyle}
      >
        {ATLAS_BOUNDARY_LINK_LABEL} &rarr;
      </a>
    </div>
  );
};

export default AtlasMovedNotice;
