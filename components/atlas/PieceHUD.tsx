/**
 * Piece-detail HUD: the vessel card, an editorial-poster readout.
 *
 * The one-action card (Adrian, 2026-07-18, the recentering): the card was
 * confusing — too many links, nothing clumped. Stripped to a full-bleed artwork
 * plate, the dream in full at a calm consistent size, one quiet standing line
 * (code, where it is alive, its founding light, and the count of pieces resting
 * at the same point), and exactly ONE action: open the book. The kin list, the
 * read-code row, the "also resting here" list and the card's own return are
 * gone — all of that already lives on the piece's certificate. The card scrolls
 * itself for a long dream; nothing collapses or unfolds.
 *
 * Origin (the visitor's birth place) keeps its own identity layout and recolours
 * every bronze accent to sage.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ordinalLabel, type SelectedPiece, type KinEntry, type HolderChartSummary } from './PieceSidePanel';
import { img } from '../../utils/media';
import { ATLAS_GOLD, ATLAS_KEPT } from './stageColors';
import ArtworkPlate from './ArtworkPlate';
import DreamSignature, { type DreamSignatureValue } from './DreamSignature';

const BRONZE = ATLAS_GOLD;
const SAGE = ATLAS_KEPT;
const PARCHMENT = '#f6f1e8';
const MUTED = '#cbbfa8';

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
  /** When this piece was reached through a multi-piece city, a back control
      returns to that city's list instead of releasing the selection. */
  onBack?: () => void;
  isOrigin?: boolean;
  /** Hosted in the phone half-sheet, which owns the scroll: drop the card's
      own viewport-height cap so the sheet governs how much shows. */
  inSheet?: boolean;
  /** True when this piece carries one of the visitor's own codes. */
  carriesYourCode?: boolean;
  /** The dream this piece publicly carries, when its keeper shares one. */
  intention?: string | null;
  /** The keeper's optional signature ("sign your dream"), shown as one quiet
      line under the dream. Present only when the public dream is present. */
  signedBy?: DreamSignatureValue | null;
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
  onBack,
  isOrigin = false,
  inSheet = false,
  carriesYourCode = false,
  intention,
  signedBy,
  code,
  alsoHere,
}) => {
  const accent = isOrigin ? SAGE : BRONZE;
  // The scroll viewport: a viewport-height cap when the card floats on its own
  // (desktop / origin), or full-height with no cap when the phone sheet scrolls.
  const scrollCap = inSheet
    ? 'h-full'
    : 'max-h-[calc(100svh-var(--nav-height)-7rem)] overflow-y-auto overscroll-contain scrollbar-hide';
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const counted = useCoordCountUp(coord?.lat ?? 0, coord?.lng ?? 0, reduce);

  const isSeeking = piece.status === 'seeking';
  const isUnawakened = piece.status === 'unawakened';
  /* The one standing line (Adrian, 2026-07-18): where the piece is alive, its
     founding light, and — folded in only when relevant — the count of pieces
     resting at the same city point. "alive in" is the word for where a piece
     lives; an unawakened vessel is not yet alive, so it keeps "at rest". */
  const restingCount = 1 + (alsoHere?.length ?? 0);
  const placeText = isSeeking
    ? 'seeking ground'
    : isUnawakened
      ? piece.cityLabel
        ? `at rest in ${piece.cityLabel}, awaiting its keeper`
        : 'awaiting its keeper'
      : piece.cityLabel
        ? `alive in ${piece.cityLabel}`
        : 'alive';
  const standingRest = [
    placeText,
    !isSeeking && !isUnawakened && typeof piece.claimOrdinal === 'number'
      ? `the ${ordinalLabel(piece.claimOrdinal)} light`
      : null,
    restingCount > 1 ? `one of ${restingCount} resting here` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // Title with a middle-dot before the edition (data may carry " - 20").
  // Shown only on the origin card; pieces are named by their code here.
  const title =
    typeof piece.editionNumber === 'number'
      ? `${piece.title.replace(/\s*-\s*\d+\s*$/, '')} · ${piece.editionNumber}`
      : piece.title;

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
  /* Two surfaces, because the card lives in two different places.

     Floating (desktop): a vessel seated over the live globe. It needs an edge,
     a shadow and a blur so the turning world does not wash the serif out.

     In the phone sheet: there is no globe behind it any more, the sheet fills
     the screen. A border and a drop shadow there do not read as a vessel, they
     read as a panel stranded in a black field with a hard line cutting the top
     of the artwork; the blur has nothing to blur. So the card goes edge to
     edge, transparent, and lets the sheet's own night be the surface. The
     bracket motif stays with the floating card and with the certificate. */
  const shell = (children: React.ReactNode) =>
    inSheet ? (
      <div className="relative [color-scheme:dark]">{children}</div>
    ) : (
      <div
        className="relative [color-scheme:dark]"
        style={{
          // The vessel's warm brown-black surface. Kept slightly translucent
          // with a blur so it seats over the live globe without the bright
          // world washing the serif text out.
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
        <div className={`p-6 sm:p-7 ${scrollCap}`}>
          <Label>{piece.category ?? 'Selected piece'}</Label>
          <h3
            className="font-display text-2xl sm:text-[1.7rem] font-semibold leading-tight"
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
                      className="font-reading text-base transition-colors text-left leading-snug"
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
          return
        </button>
      </>,
    );
  }

  // ─── Piece card: the vessel, one action ────────────────────────────────────
  // The plate, the dream in full, one quiet standing line, and exactly one door:
  // open the book. The card scrolls itself (scrollbar hidden) for a long dream.
  // No card return: on desktop the control cluster carries `return`, on the
  // phone the sheet's own close button does. The kin, the read-code row and
  // the also-resting list all live on the certificate the book door opens.
  return shell(
    <div className={scrollCap}>
      {/* Back to the city list, when this piece was reached through one. This
          is contextual navigation into the list, not a second `return`. */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="block px-[26px] pt-[18px] font-label text-[10px] uppercase tracking-[0.2em] transition-colors hover:text-bronze-300"
          style={{ color: BRONZE }}
        >
          ← the city
        </button>
      )}

      {/* The whole artwork (Adrian, 2026-07-26: "open with the whole art piece
          on it instead of the small piece").

          It used to be cropped twice over: Cloudinary was asked for
          `c_fill,g_auto`, which cut the piece down to a square, and then CSS
          `object-cover` cut that square into a 124px letterbox band — so a
          reader met roughly a third of the work, sliced through the middle, and
          had to leave the card to see what they had actually opened. `c_fit`
          keeps the whole frame, `object-contain` shows all of it, and the plate
          now takes its natural share of the screen and lets the dream scroll
          beneath. The gradient wash over its lower edge is gone with it: that
          existed to blend a cropped band into the card, and dimming the corner
          of a piece of art to make a seam disappear is not a trade worth
          making.

          In the phone sheet the plate is NOT a link. Tapping anywhere on that
          surface closes the card (Adrian, 2026-07-26), and the artwork is the
          largest thing on it, so it has to answer to that gesture like
          everything else. Wrapped in a link it would silently do the opposite of
          the text right beside it. The book keeps its one named door in the
          footer. On the floating desktop card, where no such gesture exists, the
          plate stays a link. */}
      {(() => {
        const frame = `group relative block overflow-hidden ${onBack ? 'mt-3' : ''}`;
        const edges = {
          borderTop: '1px solid rgba(196,170,124,0.2)',
          borderBottom: '1px solid rgba(196,170,124,0.2)',
          backgroundColor: '#0d0b09',
        };
        const plate = (
          <ArtworkPlate
            src={piece.coverImage ? img(piece.coverImage, { w: 900, crop: 'fit' }) : null}
            alt=""
            title={title}
            // Capped so the plate never crowds the dream off a short screen: it
            // shrinks whole rather than cropping.
            imgClassName={`mx-auto object-contain transition-transform duration-500 group-hover:scale-[1.02] ${
              // Only the sheet needs a ceiling: it shares one screen with the
              // dream. The floating card is already inside its own scroll cap,
              // so capping it there would letterbox the piece between two dark
              // bars for no gain.
              inSheet ? 'max-h-[46svh]' : ''
            }`}
            imgStyle={{ filter: 'saturate(0.92) brightness(0.94)' }}
          />
        );
        return inSheet ? (
          <div className={frame} style={edges}>
            {plate}
          </div>
        ) : (
          <Link to={bookHref} aria-label="See the full artwork" className={frame} style={edges}>
            {plate}
          </Link>
        );
      })()}

      {/* The dream, in full, at one calm consistent size. A short dream sits
          small and dignified here; a long one scrolls with the card. */}
      {intention ? (
        <section className="px-[26px] pt-[26px] pb-[20px]">
          <Label>The dream</Label>
          <p
            className="font-display text-[20px] leading-[1.55] whitespace-pre-line"
            style={{ color: PARCHMENT }}
          >
            {intention}
          </p>
          {/* The keeper's signature: one quiet line under the dream, a link
              out when they offered one. */}
          <DreamSignature signedBy={signedBy} tone="stage" align="left" className="mt-4" />
        </section>
      ) : (
        <section className="px-[26px] pt-[26px] pb-[20px] text-center">
          <p className="font-reading text-[17px] leading-[1.45]" style={{ color: MUTED }}>
            no dream is kept here yet.
          </p>
          <p className="font-reading text-[17px] leading-[1.45]" style={{ color: MUTED }}>
            this vessel waits for a keeper.
          </p>
        </section>
      )}

      {/* The one standing line: code, where it is alive, its founding light,
          and the resting count when it matters. Quiet, grouped metadata. */}
      <div className="px-[26px]">
        {/* Place first, catalogue last — matched to the featured dream's
            sub-line. Leading with the code put an unexplained initialism in
            front of the one human fact on the line ("alive in London"), which
            is the fact a reader is actually here for. */}
        <p className="font-reading text-[16px] leading-[1.5]" style={{ color: MUTED }}>
          {standingRest}
          {code && (
            <>
              <span style={{ color: BRONZE, margin: '0 8px' }}>·</span>
              <CodeText
                text={code}
                base={PARCHMENT}
                hi={BRONZE}
                className="font-label text-[12px] uppercase tracking-[0.18em] font-medium"
              />
            </>
          )}
        </p>
        {carriesYourCode && (
          <p className="mt-1.5 font-reading text-[15px] leading-snug" style={{ color: SAGE }}>
            It carries one of your codes.
          </p>
        )}
        {holderChart && (
          <p className="mt-1.5 font-reading text-[13px] leading-snug" style={{ color: 'rgba(203,191,168,0.6)' }}>
            held by a chart of{' '}
            <span style={{ color: MUTED }}>{holderChart.element}</span>
          </p>
        )}
      </div>

      {/* The one action: open the book. */}
      <footer
        className="mt-6 flex flex-col gap-3 px-[26px] pt-[22px] pb-[26px]"
        style={{ borderTop: '1px solid rgba(196,170,124,0.12)' }}
      >
        <Link
          to={bookHref}
          className="flex items-center justify-between font-reading text-[17px] transition-colors hover:text-bronze-300"
          style={{ color: PARCHMENT }}
        >
          open the book
          <span style={{ color: BRONZE }}>→</span>
        </Link>
      </footer>
    </div>,
  );
};

export default PieceHUD;
