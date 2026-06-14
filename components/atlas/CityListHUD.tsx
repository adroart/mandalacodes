/**
 * City-list HUD — the cluster's detail card.
 *
 * When a city holds more than one piece, the globe plots a single cluster
 * marker; clicking it opens this list instead of a piece HUD. It mirrors
 * PieceHUD's instrument-card look (corner brackets, bronze hairlines) so the
 * two read as the same family of object. Selecting a member opens that piece's
 * HUD; "all places" releases back to the turning world.
 */

import React from 'react';

const BRONZE = '#c4aa7c';

export interface CityListMember {
  key: string;
  title: string;
  /** "Edition 3", when the piece carries one — shown as a quiet suffix. */
  editionLabel?: string;
}

export interface CityListHUDProps {
  cityLabel?: string;
  members: readonly CityListMember[];
  onSelectMember: (key: string) => void;
  onRelease: () => void;
}

const CityListHUD: React.FC<CityListHUDProps> = ({
  cityLabel,
  members,
  onSelectMember,
  onRelease,
}) => {
  return (
    <div
      className="relative [color-scheme:dark]"
      style={{
        background:
          'linear-gradient(160deg, rgba(20,16,12,0.94) 0%, rgba(11,9,7,0.97) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid rgba(196,170,124,0.18)`,
        boxShadow: '0 24px 70px -16px rgba(0,0,0,0.85)',
      }}
    >
      {/* Corner brackets — the instrument signature, shared with PieceHUD. */}
      {(['tl', 'tr', 'bl', 'br'] as const).map((c) => (
        <span
          key={c}
          aria-hidden
          className="pointer-events-none absolute h-3.5 w-3.5"
          style={{
            top: c[0] === 't' ? 8 : undefined,
            bottom: c[0] === 'b' ? 8 : undefined,
            left: c[1] === 'l' ? 8 : undefined,
            right: c[1] === 'r' ? 8 : undefined,
            borderTop: c[0] === 't' ? `1px solid ${BRONZE}99` : undefined,
            borderBottom: c[0] === 'b' ? `1px solid ${BRONZE}99` : undefined,
            borderLeft: c[1] === 'l' ? `1px solid ${BRONZE}99` : undefined,
            borderRight: c[1] === 'r' ? `1px solid ${BRONZE}99` : undefined,
          }}
        />
      ))}

      <div className="p-6 sm:p-7 max-h-[calc(100svh-var(--nav-height)-7rem)] overflow-y-auto">
        <p
          className="font-label text-[10px] uppercase tracking-[0.2em] mb-1.5"
          style={{ color: 'rgba(196,170,124,0.65)' }}
        >
          {members.length} pieces rest here
        </p>
        <h3
          className="font-serif text-2xl sm:text-[1.7rem] font-semibold leading-tight"
          style={{ color: '#f6f1e8' }}
        >
          {cityLabel ?? 'This place'}
        </h3>

        <div
          className="my-4 h-px w-full"
          style={{ backgroundColor: 'rgba(196,170,124,0.14)' }}
        />

        <ul className="space-y-2.5">
          {members.map((m) => (
            <li key={m.key}>
              <button
                type="button"
                onClick={() => onSelectMember(m.key)}
                className="w-full text-left font-serif text-lg leading-snug hover:text-bronze-300 transition-colors"
                style={{ color: '#f6f1e8' }}
              >
                {m.title}
                {m.editionLabel && (
                  <span className="text-base" style={{ color: '#8a7d64' }}>
                    {' '}
                    · {m.editionLabel}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={onRelease}
        className="absolute top-2.5 right-2.5 font-label text-[10px] uppercase tracking-[0.2em] text-wood-500 hover:text-bronze-300 transition-colors px-2 py-1"
      >
        release
      </button>
    </div>
  );
};

export default CityListHUD;
