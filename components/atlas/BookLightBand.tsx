import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Globe, { type GlobeNode } from './Globe';

/**
 * The thread, made visible at the top of the keeper's book: a slim globe band
 * showing their light glowing at its city, captioned and tapping through to the
 * world focused on it.
 *
 * This is an emblem, not an instrument. The band clips the globe to a slim
 * horizon; passing the piece as the selected node recenters the light and holds
 * it (Globe stops rotating once a selection settles), so the render is
 * near-static and cheap. No hit-testing, no controls — the whole strip is one
 * link into `/atlas`.
 */

export interface BookLightBandProps {
  /** Selection key for the atlas deep link, e.g. `UL-122:1` or `UL-122`. */
  pieceKey: string;
  lat: number;
  lng: number;
  /** "your light · placed in Lisbon · the 8th light" — the ordinal clause is
   *  dropped when the founding number is not known from public state. */
  cityName: string;
  ordinal: number | null;
}

const BookLightBand: React.FC<BookLightBandProps> = ({
  pieceKey,
  lat,
  lng,
  cityName,
  ordinal,
}) => {
  const nodes = useMemo<GlobeNode[]>(
    () => [
      {
        id: pieceKey,
        lat,
        lng,
        status: 'placed',
        owned: true,
        ...(ordinal != null ? { ordinal } : {}),
      },
    ],
    [pieceKey, lat, lng, ordinal],
  );

  const ordinalWord = ordinal != null ? ordinalLabel(ordinal) : null;

  return (
    <Link
      to={`/atlas?piece=${encodeURIComponent(pieceKey)}`}
      aria-label={`Your light, placed in ${cityName}. Open it on the world map.`}
      className="group block relative w-full h-[120px] overflow-hidden border border-wood-300 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2"
    >
      {/* The globe fills the strip; the band height clips it to a horizon. The
          selected node recenters the light and holds it. */}
      <div className="absolute inset-0 pointer-events-none">
        <Globe nodes={nodes} selectedId={pieceKey} />
      </div>
      {/* Caption over the dark stage strip — atlas gold, legible in both site
          themes (the token is fixed, not theme-remapped). */}
      <div className="absolute inset-x-0 bottom-0 px-4 py-3 flex items-baseline gap-2 flex-wrap">
        <span className="font-label text-[11px] uppercase tracking-[0.22em] text-atlas-gold font-semibold">
          your light
        </span>
        <span className="font-label text-[11px] uppercase tracking-[0.18em] text-atlas-gold/80">
          · placed in {cityName}
          {ordinalWord ? ` · the ${ordinalWord} light` : ''}
        </span>
      </div>
    </Link>
  );
};

/** 1 → "1st" … mirrors the founding-lights ordinal used across the atlas. */
function ordinalLabel(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export default BookLightBand;
