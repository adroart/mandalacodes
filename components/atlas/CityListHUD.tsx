/**
 * City-list HUD — the panel a multi-piece city opens into (Phase 2A).
 *
 * When several pieces rest in one city, the globe draws a single numbered
 * marker; tapping it opens this list in the HUD slot instead of a single
 * piece's card. It borrows PieceHUD's instrument shell (corner brackets, the
 * bronze-on-near-black gradient) so the two read as one instrument in two
 * states. Each row identifies a piece by title and status ("kept" / "ember" /
 * "seeking"); choosing one hands off to the normal PieceHUD, and that card's
 * "back" affordance returns here.
 */

import React from 'react';

const BRONZE = '#c4aa7c';

export interface CityMember {
  key: string;
  title: string;
  series?: string;
  status: 'placed' | 'unawakened' | 'seeking' | 'origin';
  claimOrdinal?: number;
}

export interface CityListHUDProps {
  cityLabel: string;
  members: readonly CityMember[];
  onSelectMember: (key: string) => void;
  onRelease: () => void;
}

/* The voice for a piece's state, kept to Adrian's register: a placed-and-
   claimed piece is "kept", a sold-but-unclaimed one is an "ember", an
   unplaced one is still "seeking". */
function statusWord(status: CityMember['status']): string {
  return status === 'placed' ? 'kept' : status === 'unawakened' ? 'ember' : 'seeking';
}

const CityListHUD: React.FC<CityListHUDProps> = ({
  cityLabel,
  members,
  onSelectMember,
  onRelease,
}) => {
  const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p
      className="font-label text-[10px] uppercase tracking-[0.2em] mb-1.5"
      style={{ color: 'rgba(196,170,124,0.65)' }}
    >
      {children}
    </p>
  );

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
        <Label>
          {members.length} {members.length === 1 ? 'piece rests here' : 'pieces rest here'}
        </Label>

        {/* City name */}
        <h3
          className="font-serif text-2xl sm:text-[1.7rem] font-semibold leading-tight"
          style={{ color: '#f6f1e8' }}
        >
          {cityLabel}
        </h3>

        <div
          className="my-4 h-px w-full"
          style={{ backgroundColor: 'rgba(196,170,124,0.14)' }}
        />

        {/* The pieces, each a row: title · status. */}
        <ul className="space-y-3">
          {members.map((m) => {
            const title = m.title.replace(/\s*-\s*\d+\s*$/, '');
            return (
              <li key={m.key}>
                <button
                  type="button"
                  onClick={() => onSelectMember(m.key)}
                  className="group block w-full text-left"
                >
                  <span
                    className="font-serif text-lg leading-snug transition-colors group-hover:text-bronze-300"
                    style={{ color: '#f6f1e8' }}
                  >
                    {title}
                  </span>
                  <span
                    className="ml-2 font-label text-[10px] uppercase tracking-[0.18em]"
                    style={{ color: 'rgba(196,170,124,0.7)' }}
                  >
                    · {statusWord(m.status)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Release the whole city. */}
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
