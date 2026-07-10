import React from 'react';
import { Link } from 'react-router-dom';

export interface SelectedPiece {
  pieceId: string;
  editionNumber?: number;
  title: string;
  series?: string;
  category?: string;
  status: 'seeking' | 'placed' | 'unawakened';
  cityLabel?: string;     // e.g. "Lisbon, Portugal"  (omitted when seeking)
  placedAt?: string;      // ISO of most recent placed/moved event
  cardNumber?: number;    // Universal Language code 1–64, when the piece carries one
  claimOrdinal?: number;  // Founding Lights ordinal (1 = first light) when claimed
}

export interface KinEntry {
  key: string;            // piece key — same shape AtlasPage uses to select
  title: string;
}

/** Derived, non-identifying holder-chart summary (M5). Served only when the
 *  steward opted into Ring 3 and has a D1 profile — the 8-way trigram
 *  element only, never raw birth data, a name, or anything gate-resolution
 *  (see functions/api/atlas/holder-chart.ts). */
export interface HolderChartSummary {
  element: string;
}

export interface PieceSidePanelProps {
  piece: SelectedPiece | null;
  /** Kindred pieces, already sorted nearest-first, capped to ~6. Empty for non-UL pieces. */
  kin?: readonly KinEntry[];
  onSelectKin?: (key: string) => void;
  /** "Held by a chart of…" — present only when ring3 is on AND a profile
   *  exists; null/undefined otherwise (the line simply doesn't render). */
  holderChart?: HolderChartSummary | null;
}

function formatPlacedYear(iso?: string): string | null {
  if (!iso) return null;
  // Show just the year. Anything more specific risks reading like an address-level breadcrumb.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return String(d.getUTCFullYear());
}

/** Ordinal word for the Founding Lights number: 1 → "1st", 2 → "2nd", … */
export function ordinalLabel(n: number): string {
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

const PieceSidePanel: React.FC<PieceSidePanelProps> = ({
  piece,
  kin,
  onSelectKin,
  holderChart,
}) => {
  if (!piece) {
    return (
      <aside
        aria-label="Selected piece"
        className="bg-paper-100 border border-wood-200 p-6 sm:p-8 min-h-[16rem] flex items-center justify-center"
      >
        <p className="font-serif italic text-base text-wood-600 max-w-xs text-center leading-[1.7]">
          Tap a point on the globe to see where that piece has come to rest.
        </p>
      </aside>
    );
  }

  const placedYear = formatPlacedYear(piece.placedAt);
  const isSeeking = piece.status === 'seeking';
  const isUnawakened = piece.status === 'unawakened';
  const statusLine = isSeeking
    ? 'seeking ground'
    : isUnawakened
    ? piece.cityLabel
      ? `at rest in ${piece.cityLabel}, awaiting its keeper`
      : 'awaiting its keeper'
    : piece.cityLabel
    ? `placed in ${piece.cityLabel}`
    : 'placed';

  // Build inline detail row with middle-dot separators.
  const inlineBits: string[] = [];
  if (piece.series) inlineBits.push(piece.series);
  if (typeof piece.editionNumber === 'number')
    inlineBits.push(`Edition ${piece.editionNumber}`);
  if (placedYear && !isSeeking) inlineBits.push(placedYear);

  return (
    <aside
      aria-label={`Selected piece, ${piece.title}`}
      className="bg-paper-100 border border-wood-200 p-6 sm:p-8"
    >
      <p className="font-label text-[11px] uppercase tracking-[0.25em] text-bronze-700 mb-3">
        {piece.category ?? 'Selected piece'}
      </p>
      <h3 className="font-serif text-2xl sm:text-3xl text-wood-900 font-medium leading-tight mb-3">
        {piece.title}
      </h3>

      {inlineBits.length > 0 && (
        <p className="font-sans text-sm text-wood-700 leading-relaxed mb-5">
          {inlineBits.map((bit, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <span aria-hidden className="mx-1.5 text-wood-400">
                  ·
                </span>
              )}
              <span>{bit}</span>
            </React.Fragment>
          ))}
        </p>
      )}

      <div className="border-t border-wood-200 pt-5">
        <p className="font-label text-[11px] uppercase tracking-[0.18em] text-wood-600 mb-1">
          Where it rests
        </p>
        <p
          className={`font-serif text-lg leading-snug ${
            isSeeking || isUnawakened ? 'italic text-wood-700' : 'text-wood-900'
          }`}
        >
          {statusLine}
        </p>
      </div>

      {typeof piece.claimOrdinal === 'number' && (
        <div className="border-t border-wood-200 pt-5 mt-5">
          <p className="font-label text-[11px] uppercase tracking-[0.18em] text-wood-600 mb-1">
            Founding light
          </p>
          <p className="font-serif text-lg text-wood-900 leading-snug">
            The {ordinalLabel(piece.claimOrdinal)} light
          </p>
          <p className="font-serif italic text-sm text-wood-600 leading-snug mt-1">
            A founding light marks the order in which a piece was claimed by its keeper.
          </p>
        </div>
      )}

      <div className="border-t border-wood-200 pt-5 mt-5">
        <Link
          to={`/piece/${piece.pieceId}${
            typeof piece.editionNumber === 'number' ? `/${piece.editionNumber}` : ''
          }`}
          className="font-label text-[11px] uppercase tracking-[0.2em] font-semibold text-bronze-700 hover:text-bronze-600 transition-colors"
        >
          Open this piece's book →
        </Link>
      </div>

      {/* Bridge back into the deck — every Universal Language piece carries
          one of the 64 codes; the reading lives on the card page. */}
      {typeof piece.cardNumber === 'number' && (
        <div className="border-t border-wood-200 pt-5 mt-5">
          <p className="font-label text-[11px] uppercase tracking-[0.18em] text-wood-600 mb-1">
            The code it carries
          </p>
          <Link
            to={`/universal-language/${piece.cardNumber}`}
            state={{ ritual: true }}
            className="font-serif text-lg text-wood-900 hover:text-bronze-700 transition-colors leading-snug"
          >
            Read Code {piece.cardNumber} →
          </Link>
        </div>
      )}

      {holderChart && (
        <div className="border-t border-wood-200 pt-5 mt-5">
          <p className="font-label text-[11px] uppercase tracking-[0.18em] text-wood-600 mb-1">
            Held by a chart of
          </p>
          <p className="font-serif text-lg text-wood-900 leading-snug">
            {holderChart.element}
          </p>
        </div>
      )}

      {kin && kin.length > 0 && (
        <div className="border-t border-wood-200 pt-5 mt-5">
          <p className="font-label text-[11px] uppercase tracking-[0.18em] text-wood-600 mb-2">
            Kin
          </p>
          <ul className="space-y-1.5">
            {kin.map((k) => (
              <li key={k.key}>
                <button
                  type="button"
                  onClick={() => onSelectKin?.(k.key)}
                  className="font-serif text-base text-wood-900 hover:text-bronze-700 transition-colors text-left leading-snug"
                >
                  {k.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
};

export default PieceSidePanel;
