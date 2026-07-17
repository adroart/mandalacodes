import React, { useEffect, useState } from 'react';

/**
 * Shared artwork image with a graceful fallback, extracted from PiecePage's
 * certificate plate (PiecePage.tsx:328-347). A missing image (no coverImage
 * on record) or a failed image load never shows raw alt text on a black box
 * or a browser's broken-image glyph: both render the same warm plate, an
 * eyebrow reading "The plate" over the piece's title.
 *
 * Two shapes, matching the two places this is used:
 *   - 'square' (default): PiecePage's certificate plate, the image at its
 *     natural size, the fallback a centered square.
 *   - 'cover': a full-bleed band that fills its parent edge to edge, PieceHUD's
 *     artwork strip. The parent must be positioned (relative/absolute
 *     context) and sized; this fills it.
 */

export interface ArtworkPlateProps {
  src: string | null | undefined;
  alt: string;
  /** Shown, with the "The plate" eyebrow, when there is no image or it fails
      to load. Defaults to `alt`. */
  title?: string;
  aspect?: 'square' | 'cover';
  className?: string;
  imgClassName?: string;
  imgStyle?: React.CSSProperties;
  loading?: 'eager' | 'lazy';
}

const ArtworkPlate: React.FC<ArtworkPlateProps> = ({
  src,
  alt,
  title,
  aspect = 'square',
  className = '',
  imgClassName = '',
  imgStyle,
  loading = 'lazy',
}) => {
  const [failed, setFailed] = useState(false);
  // A new src (a different piece, or edition) deserves a fresh attempt.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  const showImage = !!src && !failed;
  const fallbackTitle = title ?? alt;

  if (showImage) {
    return (
      <img
        src={src as string}
        alt={alt}
        loading={loading}
        onError={() => setFailed(true)}
        style={imgStyle}
        className={
          aspect === 'cover'
            ? `absolute inset-0 h-full w-full object-cover ${imgClassName} ${className}`.trim()
            : `w-full h-auto block ${imgClassName} ${className}`.trim()
        }
      />
    );
  }

  if (aspect === 'cover') {
    return (
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center px-4 bg-[#151311] ${className}`}
      >
        <span className="font-label text-[9px] uppercase tracking-[0.2em] text-bronze-400">
          The plate
        </span>
        {fallbackTitle && (
          <span className="font-serif text-sm text-paper-200 leading-snug">
            {fallbackTitle}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`w-full aspect-square flex flex-col items-center justify-center gap-3 text-center px-6 ${className}`}
    >
      <span className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 text-bronze-400">
        The plate
      </span>
      {fallbackTitle && (
        <span className="font-serif text-lg text-paper-200 leading-snug">
          {fallbackTitle}
        </span>
      )}
    </div>
  );
};

export default ArtworkPlate;
