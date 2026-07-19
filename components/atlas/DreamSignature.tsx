import React from 'react';

/**
 * "Sign your dream" (Ring 4, 2026-07-19) — one quiet line after a piece's
 * PUBLIC dream: the keeper's name in Cormorant, smaller than the dream, and a
 * link out when they added one. This is the ONLY surface a keeper's name rides
 * publicly, always by their explicit, revocable choice, and only ever where
 * the public dream already renders (the caller places it beneath the dream).
 *
 * Renders nothing without a name — a signature with nowhere to speak stays
 * silent. When a link exists the name becomes the link, opening in a new tab
 * and passing neither referrer nor equity (noopener noreferrer nofollow).
 *
 * Two tones so the one line seats on either register:
 *   - 'paper': the certificate / book, warm wood ink with a bronze link.
 *   - 'stage': the dark Atlas (HUD, inscription), muted parchment/gold.
 */

export interface DreamSignatureValue {
  name?: string;
  link?: string;
}

export interface DreamSignatureProps {
  signedBy: DreamSignatureValue | null | undefined;
  tone?: 'paper' | 'stage';
  align?: 'left' | 'center' | 'right';
  /** Layout-only extra classes on the wrapper (margins, etc.). */
  className?: string;
  /** Merged onto the wrapper — used on the dark stage to raise the line above
      a local scrim (position/zIndex). */
  style?: React.CSSProperties;
}

const ALIGN_CLASS: Record<NonNullable<DreamSignatureProps['align']>, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

const DreamSignature: React.FC<DreamSignatureProps> = ({
  signedBy,
  tone = 'paper',
  align = 'left',
  className = '',
  style,
}) => {
  const name = signedBy?.name?.trim();
  if (!name) return null;
  const link = signedBy?.link;
  const stage = tone === 'stage';

  const nameNode = link ? (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={`pointer-events-auto underline decoration-1 underline-offset-2 transition-colors ${
        stage ? 'hover:opacity-80' : 'text-bronze-600 hover:text-bronze-500'
      }`}
      style={stage ? { color: 'rgba(200,176,132,0.9)' } : undefined}
    >
      {name}
    </a>
  ) : (
    <span className={stage ? '' : 'text-wood-600'} style={stage ? { color: 'rgba(200,176,132,0.85)' } : undefined}>
      {name}
    </span>
  );

  return (
    <p
      className={`font-display text-[15px] leading-snug ${ALIGN_CLASS[align]} ${className}`}
      style={{ fontFamily: 'var(--font-display)', ...style }}
    >
      {nameNode}
    </p>
  );
};

export default DreamSignature;
