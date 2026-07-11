/**
 * Piece-detail HUD — an instrument readout, not a sidebar.
 *
 * Replaces the visual shell of PieceSidePanel for the immersive Atlas. Reuses
 * the same data (SelectedPiece / KinEntry) and helpers (statusLine, ordinal),
 * redrawn as a bronze instrument card: corner brackets, hairline-etched field
 * groups. The globe slides aside so this never overlaps the world; a
 * leader-line (drawn by the parent) joins this card to the marker.
 *
 * Compact form (approved 2026-07-11): no coordinate readout, no explainer
 * sentences, series and year folded into the title block, kin capped at three
 * one-line rows with a quiet link to the book when more exist, and no italic
 * text anywhere (standing project rule: italics are hard to read). The whole
 * card fits a 375x667 phone viewport without scrolling for a typical piece.
 *
 * Origin (the visitor's birth place) recalibrates every bronze accent to sage.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ordinalLabel, type SelectedPiece, type KinEntry, type HolderChartSummary } from './PieceSidePanel';

const BRONZE = '#c4aa7c';
const SAGE = '#9caa87';

/** The HUD shows at most this many kin; the rest live in the piece's book. */
const MAX_HUD_KIN = 3;

function formatPlacedYear(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : String(d.getUTCFullYear());
}

export interface PieceHUDProps {
  piece: SelectedPiece;
  kin?: readonly KinEntry[];
  onSelectKin?: (key: string) => void;
  holderChart?: HolderChartSummary | null;
  onRelease: () => void;
  /** When this piece was reached through a multi-piece city, a back control
      returns to that city's list instead of releasing the selection. */
  onBack?: () => void;
  isOrigin?: boolean;
  /** True when this piece carries one of the visitor's own codes. */
  carriesYourCode?: boolean;
  /** The dream this piece publicly carries, when its keeper shares one. */
  intention?: string | null;
}

const PieceHUD: React.FC<PieceHUDProps> = ({
  piece,
  kin,
  onSelectKin,
  holderChart,
  onRelease,
  onBack,
  isOrigin = false,
  carriesYourCode = false,
  intention,
}) => {
  const accent = isOrigin ? SAGE : BRONZE;

  const isSeeking = piece.status === 'seeking';
  const isUnawakened = piece.status === 'unawakened';
  const statusLine = isSeeking
    ? 'seeking ground'
    : isUnawakened
    ? piece.cityLabel
      ? `at rest in ${piece.cityLabel}, awaiting its keeper`
      : 'awaiting its keeper'
    : piece.cityLabel
    ? piece.cityLabel
    : 'placed';

  const placedYear = formatPlacedYear(piece.placedAt);
  const inlineBits: string[] = [];
  if (piece.series) inlineBits.push(piece.series);
  if (placedYear && !isSeeking) inlineBits.push(placedYear);

  // Title with a middle-dot before the edition (data may carry " - 20").
  const title =
    typeof piece.editionNumber === 'number'
      ? `${piece.title.replace(/\s*-\s*\d+\s*$/, '')} · ${piece.editionNumber}`
      : piece.title;

  // Kin: at most three one-line rows in the card; the full list lives in the
  // piece's book, pointed at quietly when more exist.
  const kinShown = kin ? kin.slice(0, MAX_HUD_KIN) : [];
  const moreKin = (kin?.length ?? 0) > MAX_HUD_KIN;
  const bookPath = `/piece/${piece.pieceId}${
    typeof piece.editionNumber === 'number' ? `/${piece.editionNumber}` : ''
  }`;

  const Rule = () => (
    <div
      className="my-3 h-px w-full"
      style={{ backgroundColor: 'rgba(196,170,124,0.14)' }}
    />
  );
  const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p
      className="font-label text-[10px] uppercase tracking-[0.2em] mb-1"
      style={{ color: isOrigin ? 'rgba(156,170,135,0.75)' : 'rgba(196,170,124,0.65)' }}
    >
      {children}
    </p>
  );

  return (
    <div
      className="relative [color-scheme:dark]"
      style={{
        // Darker, more opaque than before so the text reads clearly — the
        // earlier translucent panel let the bright globe behind it wash out the
        // serif value text.
        background:
          'linear-gradient(160deg, rgba(20,16,12,0.94) 0%, rgba(11,9,7,0.97) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${isOrigin ? 'rgba(156,170,135,0.2)' : 'rgba(196,170,124,0.18)'}`,
        boxShadow: '0 24px 70px -16px rgba(0,0,0,0.85)',
      }}
    >
      {/* Corner brackets — the instrument signature. */}
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
            borderTop: c[0] === 't' ? `1px solid ${accent}99` : undefined,
            borderBottom: c[0] === 'b' ? `1px solid ${accent}99` : undefined,
            borderLeft: c[1] === 'l' ? `1px solid ${accent}99` : undefined,
            borderRight: c[1] === 'r' ? `1px solid ${accent}99` : undefined,
          }}
        />
      ))}

      <div className="p-5 sm:p-6 max-h-[calc(100svh-var(--nav-height)-7rem)] overflow-y-auto">
        {/* Back to the city list, when this piece was reached through one. */}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mb-2 font-label text-[10px] uppercase tracking-[0.2em] transition-colors"
            style={{ color: accent }}
          >
            ← the city
          </button>
        )}

        {/* Header: category, title, then series · year folded in tight. */}
        <Label>{piece.category ?? 'Selected piece'}</Label>
        <h3
          className="font-serif text-2xl sm:text-[1.7rem] font-semibold leading-tight"
          style={{ color: '#f6f1e8' }}
        >
          {title}
        </h3>
        {inlineBits.length > 0 && (
          <p className="mt-1 font-serif text-sm leading-snug" style={{ color: '#cbbfa8' }}>
            {inlineBits.map((b, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="mx-1.5" style={{ color: '#8a7d64' }}>·</span>}
                {b}
              </React.Fragment>
            ))}
          </p>
        )}

        <Rule />

        {/* Where it rests */}
        <Label>Where it rests</Label>
        <p
          className="font-serif text-lg leading-snug"
          style={{ color: isSeeking || isUnawakened ? '#cbbfa8' : '#f6f1e8' }}
        >
          {statusLine}
        </p>

        {/* Founding light — the value alone; the explainer lives in the book. */}
        {typeof piece.claimOrdinal === 'number' && (
          <>
            <Rule />
            <Label>Founding light</Label>
            <p className="font-serif text-lg leading-snug" style={{ color: "#f6f1e8" }}>
              The {ordinalLabel(piece.claimOrdinal)} light
            </p>
          </>
        )}

        {/* The dream the piece carries, when its keeper shares one. */}
        {intention && (
          <>
            <Rule />
            <Label>Held with a dream</Label>
            <p className="font-serif text-lg leading-snug" style={{ color: '#f6f1e8' }}>
              {intention}
            </p>
          </>
        )}

        {/* Your codes: computed on the visitor's own device, never sent. */}
        {carriesYourCode && (
          <p
            className="mt-2 font-serif text-[15px] leading-snug"
            style={{ color: '#9caa87' }}
          >
            It carries one of your codes.
          </p>
        )}

        {/* Holder chart */}
        {holderChart && (
          <>
            <Rule />
            <Label>Held by a chart of</Label>
            <p className="font-serif text-lg leading-snug" style={{ color: "#f6f1e8" }}>
              {holderChart.element}
            </p>
          </>
        )}

        {/* Kin: three at most, one line each; the rest live in the book. */}
        {kinShown.length > 0 && (
          <>
            <Rule />
            <Label>Kin</Label>
            <ul className="space-y-1">
              {kinShown.map((k) => (
                <li key={k.key} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onSelectKin?.(k.key)}
                    title={k.title}
                    className="block w-full max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-serif text-base hover:text-bronze-300 transition-colors text-left leading-snug"
                    style={{ color: '#f6f1e8' }}
                  >
                    {k.title}
                  </button>
                </li>
              ))}
            </ul>
            {moreKin && (
              <Link
                to={bookPath}
                className="mt-1.5 inline-block font-label text-[10px] uppercase tracking-[0.2em] transition-colors"
                style={{ color: 'rgba(196,170,124,0.7)' }}
              >
                more kin in its book →
              </Link>
            )}
          </>
        )}

        <Rule />

        {/* Links — book + code, the instrument's actions. */}
        <div className="flex flex-col gap-2">
          <Link
            to={bookPath}
            className="font-label text-[10px] uppercase tracking-[0.2em] font-semibold transition-colors"
            style={{ color: accent }}
          >
            Open this piece's book →
          </Link>
          {typeof piece.cardNumber === 'number' && (
            <Link
              to={`/universal-language/${piece.cardNumber}`}
              state={{ ritual: true }}
              className="font-label text-[10px] uppercase tracking-[0.2em] font-semibold transition-colors"
              style={{ color: accent }}
            >
              Read Code {piece.cardNumber} →
            </Link>
          )}
        </div>
      </div>

      {/* Release the lock. */}
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

export default PieceHUD;
