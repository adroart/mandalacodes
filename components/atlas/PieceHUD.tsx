/**
 * Piece-detail HUD: the vessel card, an editorial-poster readout.
 *
 * Rebuilt to the won card-c mockup: a code header, a full-bleed artwork band,
 * the dream set as a gallery pull-quote (first sentence large, the rest at body
 * scale), the standing line, the others resting on the same point, quiet kin,
 * and understated action rows. Reuses the same data (SelectedPiece / KinEntry /
 * HolderChartSummary) and helpers (statusLine, ordinal) the old instrument card
 * used; only the composition changed.
 *
 * The dream fits first: when the whole dream fits inside ~15rem it shows in full
 * with no fade and no affordance; only a truly overflowing dream gets the soft
 * fade and the quiet "unfold the dream" beat that expands it in place. No raw
 * scrollbar, no mid-line clip.
 *
 * Origin (the visitor's birth place) keeps its own identity layout and recolours
 * every bronze accent to sage.
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ordinalLabel, type SelectedPiece, type KinEntry, type HolderChartSummary } from './PieceSidePanel';
import { img } from '../../utils/cloudinary';

const BRONZE = '#c4aa7c';
const SAGE = '#9caa87';
const PARCHMENT = '#f6f1e8';
const MUTED = '#cbbfa8';

// The fits-first threshold: a dream taller than this collapses behind a fade.
const MAX_DREAM_PX = 240; // ~15rem

/** A piece resting at the same city point, split into its two aligned columns. */
export interface AlsoHereEntry {
  key: string;
  code: string;      // e.g. "UL № 46"
  standing: string;  // e.g. "8th light" / "not yet awakened"
}

function formatCoord(lat: number, lng: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(1)}°${ns} · ${Math.abs(lng).toFixed(1)}°${ew}`;
}

/** Split a dream into its lead (first sentence or paragraph) and the remainder,
 *  so the lead can carry the pull-quote scale and the rest the body scale. */
function splitDream(text: string): { lead: string; rest: string } {
  const t = text.trim();
  const nl = t.search(/\n/);
  if (nl !== -1) {
    const lead = t.slice(0, nl).trim();
    const rest = t.slice(nl).trim();
    if (lead) return { lead, rest };
  }
  const m = t.match(/^[\s\S]*?[.!?]["'”’)\]]?(\s+)/);
  if (m) {
    const cut = m[0].length;
    const lead = t.slice(0, cut).trim();
    const rest = t.slice(cut).trim();
    if (lead && rest) return { lead, rest };
  }
  return { lead: t, rest: '' };
}

// The coordinate counts up from 0 to its true value, a gauge settling.
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

/** A code rendered in two weights: the series letters quiet, the number lit. */
const CodeText: React.FC<{
  text: string;
  base: string;
  hi: string;
  className?: string;
}> = ({ text, base, hi, className }) => {
  const i = text.indexOf(' ');
  if (i === -1) {
    return (
      <span className={className} style={{ color: hi }}>
        {text}
      </span>
    );
  }
  return (
    <span className={className}>
      <span style={{ color: base }}>{text.slice(0, i)}</span>{' '}
      <span style={{ color: hi, fontWeight: 600 }}>{text.slice(i + 1)}</span>
    </span>
  );
};

export interface PieceHUDProps {
  piece: SelectedPiece;
  coord?: { lat: number; lng: number } | null;
  kin?: readonly KinEntry[];
  onSelectKin?: (key: string) => void;
  holderChart?: HolderChartSummary | null;
  onRelease: () => void;
  isOrigin?: boolean;
  /** True when this piece carries one of the visitor's own codes. */
  carriesYourCode?: boolean;
  /** The dream this piece publicly carries, when its keeper shares one. */
  intention?: string | null;
  /** The piece's code (e.g. `UL № 1`); the header leads with it. */
  code?: string | null;
  /** Other pieces resting at the same city point, one tap away. */
  alsoHere?: readonly AlsoHereEntry[];
}

const PieceHUD: React.FC<PieceHUDProps> = ({
  piece,
  coord,
  kin,
  onSelectKin,
  holderChart,
  onRelease,
  isOrigin = false,
  carriesYourCode = false,
  intention,
  code,
  alsoHere,
}) => {
  const accent = isOrigin ? SAGE : BRONZE;
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const counted = useCoordCountUp(coord?.lat ?? 0, coord?.lng ?? 0, reduce);

  // ─── Fits-first dream measurement ──────────────────────────────────────────
  // Measure the natural height of the dream block. If it fits inside the
  // threshold it renders in full (no cap, no fade, no affordance); if it truly
  // overflows we cap it and reveal the fade + "unfold" beat. useLayoutEffect
  // runs the measure-then-collapse before paint so there is no flash of the
  // full text, and a fonts.ready re-measure catches the serif face settling
  // after first layout (font-display: swap).
  const dreamRef = useRef<HTMLDivElement>(null);
  const [dreamOpen, setDreamOpen] = useState(false);
  const [dreamOverflow, setDreamOverflow] = useState(false);
  const [dreamFull, setDreamFull] = useState(0);

  useLayoutEffect(() => {
    setDreamOpen(false);
    const el = dreamRef.current;
    if (!el || !intention) {
      setDreamOverflow(false);
      return;
    }
    const measure = () => {
      const full = el.scrollHeight;
      setDreamFull(full);
      setDreamOverflow(full > MAX_DREAM_PX + 2);
    };
    measure();
    let cancelled = false;
    const fonts = (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts;
    if (fonts?.ready) {
      fonts.ready.then(() => {
        if (!cancelled) measure();
      });
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [intention]);

  const isSeeking = piece.status === 'seeking';
  const isUnawakened = piece.status === 'unawakened';
  /* One quiet line carries the whole standing: place and founding light
     together. Everything else about the piece lives in its book. */
  const statusLine = isSeeking
    ? 'seeking ground'
    : isUnawakened
    ? piece.cityLabel
      ? `at rest in ${piece.cityLabel}, awaiting its keeper`
      : 'awaiting its keeper'
    : `${piece.cityLabel ? `placed in ${piece.cityLabel}` : 'placed'}${
        typeof piece.claimOrdinal === 'number'
          ? ` · the ${ordinalLabel(piece.claimOrdinal)} light`
          : ''
      }`;
  // Split the standing at its middle dot so the founding light reads muted
  // beside the bronze dot, the place lit in parchment (the mockup pattern).
  const [standingPlace, standingLight] = (() => {
    const idx = statusLine.indexOf(' · ');
    if (idx === -1) return [statusLine, null] as const;
    return [statusLine.slice(0, idx), statusLine.slice(idx + 3)] as const;
  })();

  // Title with a middle-dot before the edition (data may carry " - 20").
  // Shown only on the origin card; pieces are named by their code here.
  const title =
    typeof piece.editionNumber === 'number'
      ? `${piece.title.replace(/\s*-\s*\d+\s*$/, '')} · ${piece.editionNumber}`
      : piece.title;

  const dream = intention ? splitDream(intention) : null;

  const Rule: React.FC<{ soft?: boolean }> = ({ soft }) => (
    <div
      className="h-px w-full my-[18px]"
      style={{ backgroundColor: soft ? 'rgba(196,170,124,0.12)' : 'rgba(196,170,124,0.14)' }}
    />
  );
  const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p
      className="font-label text-[10px] uppercase tracking-[0.24em] mb-2.5"
      style={{ color: isOrigin ? 'rgba(156,170,135,0.75)' : BRONZE }}
    >
      {children}
    </p>
  );

  const bookHref = `/piece/${piece.pieceId}${
    typeof piece.editionNumber === 'number' ? `/${piece.editionNumber}` : ''
  }`;

  // ─── Shared shell ──────────────────────────────────────────────────────────
  const shell = (children: React.ReactNode) => (
    <div
      className="relative [color-scheme:dark]"
      style={{
        // The vessel's warm brown-black surface. Kept slightly translucent with
        // a blur so it seats over the live globe without the bright world
        // washing the serif text out.
        background:
          'linear-gradient(176deg, rgba(26,22,19,0.97) 0%, rgba(20,17,16,0.98) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: `1px solid ${isOrigin ? 'rgba(156,170,135,0.2)' : 'rgba(196,170,124,0.2)'}`,
        boxShadow: '0 40px 90px -40px rgba(0,0,0,0.85), 0 0 0 1px rgba(0,0,0,0.3)',
      }}
    >
      {/* Corner brackets: the atlas motif. */}
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
            borderTop: c[0] === 't' ? `1px solid ${accent}8c` : undefined,
            borderBottom: c[0] === 'b' ? `1px solid ${accent}8c` : undefined,
            borderLeft: c[1] === 'l' ? `1px solid ${accent}8c` : undefined,
            borderRight: c[1] === 'r' ? `1px solid ${accent}8c` : undefined,
          }}
        />
      ))}
      {children}
    </div>
  );

  // ─── Origin card: kept as its own identity layout ──────────────────────────
  if (isOrigin) {
    return shell(
      <>
        <div className="p-6 sm:p-7 max-h-[calc(100svh-var(--nav-height)-7rem)] overflow-y-auto overscroll-contain scrollbar-hide">
          <Label>{piece.category ?? 'Selected piece'}</Label>
          <h3
            className="font-serif text-2xl sm:text-[1.7rem] font-semibold leading-tight"
            style={{ color: PARCHMENT }}
          >
            {title}
          </h3>
          {coord && (
            <p
              className="mt-3 font-label text-[12px] tracking-[0.08em]"
              style={{
                color: 'rgba(156,170,135,0.85)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatCoord(counted.lat, counted.lng)}
            </p>
          )}

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
                      className="font-serif text-base transition-colors text-left leading-snug"
                      style={{ color: PARCHMENT }}
                    >
                      {k.title}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <Rule />
          <div className="flex flex-col gap-2.5">
            <Link
              to={bookHref}
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
      </>,
    );
  }

  // ─── Piece card: the vessel ────────────────────────────────────────────────
  // One quiet scroll surface: the card scrolls with its scrollbar hidden (the
  // cut content at the sheet edge is the affordance); the dream never scrolls.
  return shell(
    <div className="max-h-[calc(100svh-var(--nav-height)-7rem)] overflow-y-auto overscroll-contain scrollbar-hide">
      {/* Header: code left, release right. */}
      <header className="flex items-baseline justify-between px-[26px] pt-[22px] pb-4">
        {code ? (
          <CodeText
            text={code}
            base={MUTED}
            hi={PARCHMENT}
            className="font-label text-[12px] uppercase tracking-[0.22em] font-medium"
          />
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onRelease}
          className="font-label text-[10px] uppercase tracking-[0.2em] transition-colors hover:text-bronze-300"
          style={{ color: 'rgba(203,191,168,0.5)' }}
        >
          release
        </button>
      </header>

      {/* Full-bleed artwork band. Shorter on phones so the dream keeps the
          room; full height from sm up. */}
      <div
        className="relative h-[124px] sm:h-[172px] overflow-hidden"
        style={{
          borderTop: '1px solid rgba(196,170,124,0.2)',
          borderBottom: '1px solid rgba(196,170,124,0.2)',
          backgroundColor: '#0d0b09',
        }}
      >
        {piece.coverImage && (
          <img
            src={img(piece.coverImage, { w: 760 })}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: '50% 50%', filter: 'saturate(0.92) brightness(0.94)' }}
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(20,17,16,0) 62%, rgba(20,17,16,0.55) 100%)',
          }}
        />
      </div>

      {/* The dream, the hero, or the quiet no-dream note. */}
      {dream ? (
        <section className="px-[26px] pt-[26px] pb-[22px]">
          <Label>The dream</Label>
          <div
            ref={dreamRef}
            className="relative overflow-hidden"
            style={{
              maxHeight: dreamOpen
                ? `${dreamFull}px`
                : dreamOverflow
                ? `${MAX_DREAM_PX}px`
                : undefined,
              transition: 'max-height 600ms cubic-bezier(.4,0,.2,1)',
            }}
          >
            <p
              className="font-serif font-medium text-[29px] leading-[1.16]"
              style={{ color: PARCHMENT }}
            >
              {dream.lead}
            </p>
            {dream.rest && (
              <p
                className="font-serif text-[16.5px] leading-[1.58] mt-4 whitespace-pre-line"
                style={{ color: MUTED }}
              >
                {dream.rest}
              </p>
            )}
            {dreamOverflow && !dreamOpen && (
              <span
                aria-hidden
                className="pointer-events-none absolute left-0 right-0 bottom-0 h-12"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(17,13,10,0) 0%, rgba(17,13,10,0.97) 92%)',
                }}
              />
            )}
          </div>
          {dreamOverflow && !dreamOpen && (
            <button
              type="button"
              onClick={() => setDreamOpen(true)}
              className="mt-3 inline-flex items-center gap-2 font-label text-[10px] uppercase tracking-[0.2em] font-semibold transition-colors hover:text-wood-100"
              style={{ color: BRONZE }}
            >
              <span className="inline-block h-px w-4" style={{ backgroundColor: 'currentColor' }} />
              unfold the dream
            </button>
          )}
        </section>
      ) : (
        <section className="px-[26px] pt-[26px] pb-[22px] text-center">
          <p className="font-serif text-[17px] leading-[1.45]" style={{ color: MUTED }}>
            no dream is kept here yet.
          </p>
          <p className="font-serif text-[17px] leading-[1.45]" style={{ color: MUTED }}>
            this vessel waits for a keeper.
          </p>
        </section>
      )}

      {/* Structured meta: standing, also resting, holder chart, kin. */}
      <div className="px-[26px] pt-1">
        <div>
          <Label>{piece.status === 'placed' ? 'Placed' : 'Standing'}</Label>
          <p className="font-serif text-[18px] leading-[1.4]" style={{ color: PARCHMENT }}>
            {standingPlace}
            {standingLight && (
              <>
                <span style={{ color: BRONZE, margin: '0 6px' }}>·</span>
                <span style={{ color: MUTED }}>{standingLight}</span>
              </>
            )}
          </p>
          {carriesYourCode && (
            <p className="mt-1.5 font-serif text-[15px] leading-snug" style={{ color: SAGE }}>
              It carries one of your codes.
            </p>
          )}
        </div>

        {alsoHere && alsoHere.length > 0 && (
          <>
            <Rule soft />
            <Label>Also resting here</Label>
            <div className="flex flex-col">
              {alsoHere.map((k, i) => (
                <button
                  key={k.key}
                  type="button"
                  onClick={() => onSelectKin?.(k.key)}
                  className="group flex items-baseline justify-between py-2.5 text-left transition-[padding] hover:pl-2"
                  style={{
                    borderBottom:
                      i === alsoHere.length - 1
                        ? 'none'
                        : '1px solid rgba(196,170,124,0.12)',
                  }}
                >
                  <CodeText
                    text={k.code}
                    base={PARCHMENT}
                    hi={BRONZE}
                    className="font-serif text-[20px] leading-none"
                  />
                  <span
                    className="font-label text-[10px] uppercase tracking-[0.16em] transition-colors group-hover:text-bronze-300"
                    style={{ color: MUTED }}
                  >
                    {k.standing}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {holderChart && (
          <>
            <Rule soft />
            <p className="font-serif text-[13px] leading-snug" style={{ color: 'rgba(203,191,168,0.6)' }}>
              held by a chart of{' '}
              <span style={{ color: MUTED }}>{holderChart.element}</span>
            </p>
          </>
        )}

        {kin && kin.length > 0 && (
          <>
            <Rule soft />
            <Label>Kin</Label>
            <div className="flex flex-col gap-1">
              {kin.map((k) => (
                <button
                  key={k.key}
                  type="button"
                  onClick={() => onSelectKin?.(k.key)}
                  className="text-left font-serif text-[13px] leading-snug transition-colors hover:text-bronze-300"
                  style={{ color: 'rgba(203,191,168,0.52)' }}
                >
                  {k.title}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Actions: understated rows with right arrows. */}
      <footer
        className="mt-6 flex flex-col gap-3 px-[26px] pt-[22px] pb-[26px]"
        style={{ borderTop: '1px solid rgba(196,170,124,0.12)' }}
      >
        <Link
          to={bookHref}
          className="flex items-center justify-between font-serif text-[17px] transition-colors hover:text-bronze-300"
          style={{ color: PARCHMENT }}
        >
          open this piece's book
          <span style={{ color: BRONZE }}>→</span>
        </Link>
        {typeof piece.cardNumber === 'number' && (
          <Link
            to={`/universal-language/${piece.cardNumber}`}
            state={{ ritual: true }}
            className="flex items-center justify-between font-serif text-[15px] transition-colors hover:text-bronze-300"
            style={{ color: MUTED }}
          >
            read code {piece.cardNumber}
            <span style={{ color: BRONZE }}>→</span>
          </Link>
        )}
      </footer>
    </div>,
  );
};

export default PieceHUD;
