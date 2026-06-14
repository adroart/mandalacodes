/**
 * Piece-detail HUD — an instrument readout, not a sidebar.
 *
 * Replaces the visual shell of PieceSidePanel for the immersive Atlas. Reuses
 * the same data (SelectedPiece / KinEntry) and helpers (statusLine, ordinal),
 * redrawn as a bronze instrument card: corner brackets, a lat-long coordinate
 * readout that counts up to the true value, hairline-etched field groups. The
 * globe slides aside so this never overlaps the world; a leader-line (drawn by
 * the parent) joins this card to the marker.
 *
 * Origin (the visitor's birth place) recalibrates every bronze accent to sage.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ordinalLabel, type SelectedPiece, type KinEntry, type HolderChartSummary } from './PieceSidePanel';

const BRONZE = '#c4aa7c';
const SAGE = '#9caa87';

function formatPlacedYear(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : String(d.getUTCFullYear());
}

function formatCoord(lat: number, lng: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(1)}°${ns} · ${Math.abs(lng).toFixed(1)}°${ew}`;
}

// The coordinate counts up from 0 to its true value — a gauge settling.
function useCoordCountUp(lat: number, lng: number, reduce: boolean) {
  const [v, setV] = useState(() => (reduce ? { lat, lng } : { lat: 0, lng: 0 }));
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (reduce) {
      setV({ lat, lng });
      return;
    }
    const start = performance.now();
    const dur = 600;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      setV({ lat: lat * e, lng: lng * e });
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [lat, lng, reduce]);
  return v;
}

export interface PieceHUDProps {
  piece: SelectedPiece;
  coord?: { lat: number; lng: number } | null;
  kin?: readonly KinEntry[];
  onSelectKin?: (key: string) => void;
  holderChart?: HolderChartSummary | null;
  onRelease: () => void;
  isOrigin?: boolean;
}

const PieceHUD: React.FC<PieceHUDProps> = ({
  piece,
  coord,
  kin,
  onSelectKin,
  holderChart,
  onRelease,
  isOrigin = false,
}) => {
  const accent = isOrigin ? SAGE : BRONZE;
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const counted = useCoordCountUp(coord?.lat ?? 0, coord?.lng ?? 0, reduce);

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

  const Rule = () => (
    <div
      className="my-4 h-px w-full"
      style={{ backgroundColor: 'rgba(196,170,124,0.14)' }}
    />
  );
  const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p
      className="font-label text-[10px] uppercase tracking-[0.2em] mb-1.5"
      style={{ color: isOrigin ? 'rgba(156,170,135,0.75)' : 'rgba(196,170,124,0.65)' }}
    >
      {children}
    </p>
  );

  return (
    <div
      className="relative [color-scheme:dark]"
      style={{
        background:
          'linear-gradient(160deg, rgba(28,23,18,0.86) 0%, rgba(17,14,11,0.92) 100%)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: `1px solid ${isOrigin ? 'rgba(156,170,135,0.2)' : 'rgba(196,170,124,0.18)'}`,
        boxShadow: '0 24px 70px -16px rgba(0,0,0,0.75)',
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

      <div className="p-6 sm:p-7 max-h-[calc(100svh-var(--nav-height)-7rem)] overflow-y-auto">
        {/* Series + category */}
        <Label>{piece.category ?? 'Selected piece'}</Label>
        {inlineBits.length > 0 && (
          <p className="font-serif text-sm text-wood-300 leading-snug mb-3">
            {inlineBits.map((b, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="mx-1.5 text-wood-500">·</span>}
                {b}
              </React.Fragment>
            ))}
          </p>
        )}

        {/* Title */}
        <h3 className="font-serif text-2xl sm:text-[1.7rem] text-paper-50 font-medium leading-tight">
          {title}
        </h3>

        {/* Coordinate readout — the instrument's signature line. */}
        {coord && (
          <p
            className="mt-3 font-label text-[12px] tracking-[0.08em]"
            style={{
              color: isOrigin ? 'rgba(156,170,135,0.85)' : 'rgba(196,170,124,0.85)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatCoord(counted.lat, counted.lng)}
          </p>
        )}

        <Rule />

        {/* Where it rests */}
        <Label>Where it rests</Label>
        <p
          className={`font-serif text-lg leading-snug ${
            isSeeking || isUnawakened ? 'italic text-wood-300' : 'text-paper-50'
          }`}
        >
          {statusLine}
        </p>

        {/* Founding light */}
        {typeof piece.claimOrdinal === 'number' && (
          <>
            <Rule />
            <Label>Founding light</Label>
            <p className="font-serif text-lg text-paper-50 leading-snug">
              The {ordinalLabel(piece.claimOrdinal)} light
            </p>
          </>
        )}

        {/* Holder chart */}
        {holderChart && (
          <>
            <Rule />
            <Label>Held by a chart of</Label>
            <p className="font-serif text-lg text-paper-50 leading-snug">
              {holderChart.element}
            </p>
          </>
        )}

        {/* Kin */}
        {kin && kin.length > 0 && (
          <>
            <Rule />
            <Label>Kin</Label>
            <ul className="space-y-1.5">
              {kin.map((k) => (
                <li key={k.key}>
                  <button
                    type="button"
                    onClick={() => onSelectKin?.(k.key)}
                    className="font-serif text-base text-paper-50 hover:text-bronze-300 transition-colors text-left leading-snug"
                  >
                    {k.title}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <Rule />

        {/* Links — book + code, the instrument's actions. */}
        <div className="flex flex-col gap-2.5">
          <Link
            to={`/piece/${piece.pieceId}${
              typeof piece.editionNumber === 'number' ? `/${piece.editionNumber}` : ''
            }`}
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
