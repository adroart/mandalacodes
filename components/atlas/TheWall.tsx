import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ArtworkPlate from './ArtworkPlate';
import DreamSignature from './DreamSignature';
import HexagramGlyph from '../oracle/HexagramGlyph';
import {
  LedgerControlRow,
  LedgerSearchField,
  LedgerSelect,
  LedgerTally,
} from './LedgerControls';
import {
  ledgerKindLabel,
  ledgerStatusLine,
  matchesSearch,
  matchesState,
  isLedgerState,
  LEDGER_STATE_OPTIONS,
  type LedgerRow,
  type LedgerStateFilter,
} from './ledgerRow';

/* ─── The wall ────────────────────────────────────────────────────────────
 * The exploratory reading of the one record: every piece a uniform card in a
 * calm grid. Each card is an artifact with two faces, never shown together —
 * the dream rides one side (readable, signed, anchored to its city), the
 * work itself lives on the other (the plate, the year, the size). One
 * control turns the whole wall over in a ripple; a small corner mark turns
 * a single card.
 *
 * Clicking a card does NOT open a popup: the card grows in place into the
 * full record, spanning the grid while the other cards slide out of its way
 * (a FLIP reflow), and folds back into its spot on close. The record keeps
 * the same two-face turn; ← → walk the wall in filtered order.
 *
 * Artifact rendering (all GPU transform/opacity, so hundreds of cards keep
 * 60fps): pointer-tracked 3D tilt with a lift, a bronze light sheen that
 * follows the hand across the face, paper grain, the piece's hexagram
 * embossed faintly into the dream face, a slow breathing
 * glow when a life is attached, a staggered rise as the wall assembles, and
 * a slow lens creep on the artwork under the hand. Reduced motion collapses
 * every one of these to a plain swap.
 *
 * The wall shares the ledger's filter grammar and URL params (lk / ls / lq)
 * so a narrowing made here still holds on the ledger or the globe.
 */

export interface WallCard extends LedgerRow {
  /** 'sixty-four' | 'mandala' | 'signature' | 'jewelry' | category slug. */
  kind: string;
  /** 1–64 when the piece embodies a code. */
  cardNumber?: number;
  /** Tile-sized delivery URL (the wall), and a larger one for the record. */
  coverImage?: string;
  coverImageLarge?: string;
  year?: string;
  dimensions?: string;
  material?: string;
}

type Face = 'dreams' | 'art';
type Density = 'near' | 'mid' | 'far';

interface Props {
  cards: WallCard[];
  onSelectOnGlobe: (pieceId: string, editionNumber?: number) => void;
}

const DENSITY_GRID: Record<Density, string> = {
  near: 'grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-3',
  mid: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  far: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7',
};

/** How big the open record stands at each density — an NxN block of cells,
 *  never wider than the column count at any breakpoint, so the neighboring
 *  dreams always keep at least one column beside it where the grid allows. */
const RECORD_SPAN: Record<Density, string> = {
  near: 'col-span-1 min-[420px]:col-span-2 min-[420px]:row-span-2',
  mid: 'col-span-2 row-span-2 sm:col-span-3 sm:row-span-3',
  far: 'col-span-2 row-span-2 sm:col-span-3 sm:row-span-3',
};

/** Fine pointer + motion allowed: the tilt/sheen instruments only make sense
 *  with a hand to follow. Checked once; touch keeps the calm static card. */
const HANDED =
  typeof window !== 'undefined' &&
  window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)')
    .matches;

/** Quiet paper grain, one tile, blended over both faces. */
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='wg'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='140' height='140' filter='url(%23wg)' opacity='0.55'/></svg>\")";

/** The wall's private keyframes. Transform/opacity only. */
const WALL_CSS = `
@keyframes wall-rise { from { opacity: 0; transform: translateY(16px) scale(0.985); } }
@keyframes wall-breathe { 0%, 100% { opacity: 0.25; } 50% { opacity: 0.7; } }
.wall-rise { animation: wall-rise 640ms cubic-bezier(.22,.1,.2,1) both; }
.wall-glow { animation: wall-breathe 5.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .wall-rise, .wall-glow { animation: none; }
}
`;

/** Piece detail line for the art face: only what the record truly carries. */
function detailLine(c: WallCard): string {
  return [c.year, c.dimensions, c.material].filter(Boolean).join(' · ');
}

function piecePathOf(c: WallCard): string {
  return `/piece/${c.pieceId}${
    typeof c.editionNumber === 'number' ? `/${c.editionNumber}` : ''
  }`;
}

/* The wall's controls are the shared ones (LedgerControls.tsx). It keeps kind
   as a real filter, unlike the ledger: a card field has no sections to jump
   to, so narrowing is the only way to see one kind on its own. */

/* ─── The hand instruments: tilt + sheen vars on one element ─────────────── */

function useTilt() {
  const ref = useRef<HTMLDivElement | null>(null);

  /* Applied synchronously in the move event (no rAF) and frozen while any
     button is down: a transform that lands BETWEEN pointerdown and pointerup
     shifts the geometry mid-gesture and the browser then resolves the click
     to the grid instead of the card. Settled geometry before the press is
     what makes every click land. The spring-back transition rides only on
     leave, so following the hand stays per-frame crisp. */
  const onMove = useCallback((e: React.PointerEvent) => {
    if (!HANDED || e.buttons !== 0) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    el.style.transition = 'none';
    el.style.setProperty('--ry', `${((px - 0.5) * 9).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${((0.5 - py) * 9).toFixed(2)}deg`);
    el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
    el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    el.style.setProperty('--lift', '1.02');
    el.style.setProperty('--sheen', '1');
  }, []);

  const onLeave = useCallback(() => {
    if (!HANDED) return;
    const el = ref.current;
    if (!el) return;
    el.style.transition = 'transform 450ms cubic-bezier(.3,.1,.16,1)';
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--lift', '1');
    el.style.setProperty('--sheen', '0');
  }, []);

  return { ref, onMove, onLeave };
}

/** The raking-light sheen a face catches under the hand. */
const Sheen: React.FC<{ strong?: boolean }> = ({ strong }) => (
  <span
    aria-hidden
    className="pointer-events-none absolute inset-0 transition-opacity duration-300"
    style={{
      opacity: 'var(--sheen, 0)' as unknown as number,
      background: `radial-gradient(320px circle at var(--mx, 50%) var(--my, 50%), rgba(222,188,126,${
        strong ? 0.18 : 0.12
      }), transparent 65%)`,
    }}
  />
);

/** Paper grain, blended over a face. */
const Grain: React.FC = () => (
  <span
    aria-hidden
    className="pointer-events-none absolute inset-0 opacity-[0.05]"
    style={{ backgroundImage: GRAIN, mixBlendMode: 'overlay' }}
  />
);

/* ─── Kind marks: each family of work carries its own embossed sigil ──────
 * The sixty-four wear their hexagram; mandalas a ring of petals; signature
 * pieces a single flourish of the hand; jewelry a cut stone. All stroke
 * currentColor so they emboss in the same bronze whisper. */

const MandalaMark: React.FC<{ width: number }> = ({ width }) => (
  <svg width={width} height={width} viewBox="0 0 100 100" fill="none" aria-hidden>
    <circle cx="50" cy="50" r="10" stroke="currentColor" strokeWidth="2" />
    <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="2" />
    {Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4;
      return (
        <circle
          key={i}
          cx={50 + 24 * Math.cos(a)}
          cy={50 + 24 * Math.sin(a)}
          r="14"
          stroke="currentColor"
          strokeWidth="2"
        />
      );
    })}
  </svg>
);

const SignatureMark: React.FC<{ width: number }> = ({ width }) => (
  <svg width={width} height={width * 0.6} viewBox="0 0 100 60" fill="none" aria-hidden>
    <path
      d="M6 44 C22 8, 34 54, 48 30 S 70 6, 74 34 C 76 46, 86 44, 94 36"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);

const JewelryMark: React.FC<{ width: number }> = ({ width }) => (
  <svg width={width} height={width} viewBox="0 0 100 100" fill="none" aria-hidden>
    <path
      d="M30 22 H70 L88 44 L50 86 L12 44 Z"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <path d="M12 44 H88 M30 22 L42 44 L50 86 L58 44 L70 22 M42 44 H58" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

/** The embossed sigil for a card's kind, centered behind the dream. */
const KindMark: React.FC<{ card: WallCard; width: number }> = ({ card, width }) => {
  let mark: React.ReactNode = null;
  if (card.kind === 'sixty-four' && typeof card.cardNumber === 'number') {
    mark = <HexagramGlyph gate={card.cardNumber} width={width} />;
  } else if (card.kind === 'mandala') {
    mark = <MandalaMark width={width} />;
  } else if (card.kind === 'signature') {
    mark = <SignatureMark width={width} />;
  } else if (card.kind === 'jewelry') {
    mark = <JewelryMark width={width} />;
  }
  if (!mark) return null;
  /* Pressed INTO the paper, not floating above it: the sigil sits darker
     than the surface, ink sunk in shadow rather than a lighter ghost. */
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center justify-center text-[#0b0906] opacity-[0.45]"
    >
      {mark}
    </span>
  );
};

/* ─── One card, two faces ─────────────────────────────────────────────────── */

const WallTile: React.FC<{
  card: WallCard;
  face: Face;
  /** Stagger delay in ms while a whole-wall turn ripples through. */
  delayMs: number;
  /** Stagger delay for the rise-in as the wall assembles. */
  riseDelayMs: number;
  density: Density;
  onOpen: (key: string, rect: DOMRect) => void;
  onTurn: (key: string) => void;
}> = ({ card, face, delayMs, riseDelayMs, density, onOpen, onTurn }) => {
  const tilt = useTilt();
  const far = density === 'far';
  const placed = card.norm === 'placed';

  const open = () => {
    const rect = tilt.ref.current?.getBoundingClientRect();
    if (rect) onOpen(card.key, rect);
  };

  return (
    <li
      data-flipkey={card.key}
      className="wall-rise"
      style={{ animationDelay: `${riseDelayMs}ms` }}
    >
      {/* The tilt wrapper stays FLAT (no preserve-3d, no will-change, no
          translateZ) with its perspective inline in the transform: a 3D
          layer here makes Chromium's compositor hit-test drop clicks on the
          whole card to the page root. The flip child below owns the real 3D
          (its own perspective property + preserve-3d faces), the structure
          that hit-tests correctly. onClick also rides here as a safety net —
          the TurnMark stops propagation, so turning never opens. */}
      <div
        ref={tilt.ref}
        onPointerMove={tilt.onMove}
        onPointerLeave={tilt.onLeave}
        onClick={open}
        className="group/card relative aspect-[4/5] cursor-pointer"
        style={{
          perspective: '1400px',
          transform:
            'perspective(1100px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)) scale(var(--lift, 1))',
        }}
      >
        {/* The breathing halo — only where a life is attached. Held close to
            the edge and faint, a warmth at the rim rather than a bloom that
            bleeds into the night around it. */}
        {placed && (
          <span
            aria-hidden
            className="wall-glow pointer-events-none absolute -inset-px"
            style={{ boxShadow: '0 0 10px rgba(196,170,124,0.2)' }}
          />
        )}

        <div
          className={`absolute inset-0 transition-transform duration-[900ms] ease-[cubic-bezier(.62,.02,.34,1)] [transform-style:preserve-3d] motion-reduce:transition-none ${
            face === 'art' ? '[transform:rotateY(180deg)]' : ''
          }`}
          style={{ transitionDelay: `${delayMs}ms` }}
        >
          {/* Dream face — three zones: a slim upper bar carrying the flip
              button, the dream in the middle, the signature and anchor in the
              lower bar. Separated zones so nothing overlaps the embossed
              sigil. The away face keeps paint hidden via backface-visibility
              but would still catch clicks and tab stops, so pointer-events and
              focusability follow the turn. */}
          <div
            aria-hidden={face === 'art'}
            className={`absolute inset-0 [backface-visibility:hidden] flex flex-col overflow-hidden border bg-wood-50 ${
              face === 'art' ? 'pointer-events-none' : ''
            } ${placed ? 'border-bronze-500/40' : 'border-wood-200'}`}
            style={{
              backgroundImage:
                'linear-gradient(168deg, rgba(222,188,126,0.05), transparent 38%, rgba(21,19,17,0.12))',
            }}
          >
            <Grain />
            {/* Upper bar: the flip control, tight in the corner. */}
            <div className="relative z-10 flex items-center justify-end px-3 pt-2 pb-1">
              <FlipButton
                label="show art"
                onTurn={() => onTurn(card.key)}
                far={far}
                away={face === 'art'}
              />
            </div>
            {/* Middle: the dream, with the sigil embossed behind only here. */}
            <button
              type="button"
              onClick={open}
              tabIndex={face === 'art' ? -1 : 0}
              aria-label={`Open the record of ${card.title}`}
              className="relative flex-1 min-h-0 w-full flex flex-col text-left px-3.5 sm:px-4 pb-1 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-[-2px] group"
            >
              <KindMark card={card} width={far ? 56 : 88} />
              {card.dream ? (
                <p
                  className={`relative font-display text-wood-800 group-hover:text-wood-900 transition-colors ${
                    far
                      ? 'text-[13px] leading-[1.5] line-clamp-5'
                      : density === 'near'
                        ? 'text-[17px] leading-[1.6] line-clamp-[10]'
                        : 'text-[16px] leading-[1.6] line-clamp-[7]'
                  }`}
                >
                  {card.dream}
                </p>
              ) : (
                <span className="relative m-auto text-center block">
                  <span
                    className={`block font-display text-wood-600 leading-snug ${
                      far ? 'text-[14px]' : 'text-xl'
                    }`}
                  >
                    {card.title}
                  </span>
                </span>
              )}
            </button>
            {/* Lower bar: who signed it, where it lives. */}
            <div className="relative border-t border-wood-200/70 px-3 py-2 text-center">
              {card.dream && card.signedBy?.name && (
                <span
                  className={`block font-display text-wood-600 truncate ${
                    far ? 'text-[12px]' : 'text-[13px]'
                  }`}
                >
                  {card.signedBy.name}
                </span>
              )}
              <span
                className={`block font-label uppercase tracking-[0.16em] ${
                  card.dream ? 'text-bronze-600' : 'text-wood-400'
                } ${far ? 'text-[9px]' : 'text-[10px]'}`}
              >
                {card.dream
                  ? ledgerStatusLine(card)
                  : card.norm === 'seeking'
                    ? 'seeking ground'
                    : 'waiting for a dream'}
              </span>
            </div>
            <Sheen />
          </div>

          {/* Art face — the square work framed by an upper and lower bar. The
              flip button rides the upper bar, the title and details the
              lower; the piece sits whole between them. */}
          <div
            aria-hidden={face === 'dreams'}
            className={`absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col overflow-hidden border bg-[#151311] ${
              face === 'dreams' ? 'pointer-events-none' : ''
            } ${placed ? 'border-bronze-500/50' : 'border-wood-800/40'}`}
          >
            {/* Upper bar. */}
            <div className="relative z-10 flex items-center justify-end px-3 pt-2 pb-1.5">
              <FlipButton
                label="show dream"
                onTurn={() => onTurn(card.key)}
                far={far}
                dark
                away={face === 'dreams'}
              />
            </div>
            {/* The square piece. */}
            <button
              type="button"
              onClick={open}
              tabIndex={face === 'dreams' ? -1 : 0}
              aria-label={`Open the record of ${card.title}`}
              className="relative flex-1 min-h-0 w-full overflow-hidden focus:outline-2 focus:outline-bronze-400 focus:outline-offset-[-2px] group"
            >
              <ArtworkPlate
                src={card.coverImage}
                alt={card.title}
                title={card.title}
                aspect="cover"
                imgClassName="transition-transform duration-[1600ms] ease-out group-hover:scale-[1.05]"
              />
            </button>
            {/* Lower bar. */}
            <div className="relative border-t border-white/10 px-3 py-2 text-center">
              <span
                className={`block font-display text-[#f0e8d8] leading-snug truncate ${
                  far ? 'text-[13px]' : 'text-[15px]'
                }`}
              >
                {card.title}
              </span>
              {!far && detailLine(card) && (
                <span className="block font-label text-[9px] uppercase tracking-[0.16em] text-[#c8b084] truncate">
                  {detailLine(card)}
                </span>
              )}
            </div>
            <Sheen strong />
          </div>
        </div>
      </div>
    </li>
  );
};

/** The flip control — a named button seated tight in a face's upper-right
 *  corner: "show art" on the dream side, "show dream" on the reverse. A small
 *  caps label with a hairline that draws in from the right under the hand, so
 *  it reads as a considered switch rather than an icon. Stops propagation so
 *  turning the card never also opens the record. */
const FlipButton: React.FC<{
  label: string;
  onTurn: () => void;
  far: boolean;
  dark?: boolean;
  /** True when this mark's face is turned away — unclickable, unfocusable. */
  away?: boolean;
}> = ({ label, onTurn, far, dark, away }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onTurn();
    }}
    tabIndex={away ? -1 : 0}
    aria-label={label}
    className={`group/flip relative shrink-0 font-label uppercase tracking-[0.18em] leading-none pb-1 transition-colors ${
      far ? 'text-[8px]' : 'text-[9px]'
    } ${
      dark
        ? 'text-[#c8b084]/85 hover:text-[#f0e2c2]'
        : 'text-bronze-600/85 hover:text-bronze-700'
    }`}
  >
    {label}
    <span
      aria-hidden
      className={`absolute left-auto right-0 bottom-0 h-px w-0 transition-[width] duration-300 ease-out group-hover/flip:w-full ${
        dark ? 'bg-[#c8b084]/70' : 'bg-bronze-500/70'
      }`}
    />
  </button>
);

/* ─── The record, in the flow of the wall ─────────────────────────────────
 * Not a popup: this renders as a grid item spanning an NxN block of the
 * same grid, standing where the clicked card stood, so the other cards pack
 * around it (dense flow + the grid FLIP below) and it never sits alone on
 * its own row. It grows from the clicked card's rect, carries the same
 * two-face turn, and ← → walk the wall without leaving the record. */

const WallRecord: React.FC<{
  card: WallCard;
  originRect: DOMRect | null;
  initialFace: Face;
  /** Responsive col-span/row-span classes for the current density. */
  spanClass: string;
  hasPrev: boolean;
  hasNext: boolean;
  onStep: (dir: 1 | -1) => void;
  onClose: () => void;
  onSelectOnGlobe: (pieceId: string, editionNumber?: number) => void;
}> = ({
  card,
  originRect,
  initialFace,
  spanClass,
  hasPrev,
  hasNext,
  onStep,
  onClose,
  onSelectOnGlobe,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [face, setFace] = useState<Face>(initialFace);

  /* Grow from the clicked card's rect into place, then settle centered in
     the viewport. Steps between records swap in place with a soft rise. */
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      el.scrollIntoView({ block: 'center' });
      return;
    }
    if (originRect) {
      const final = el.getBoundingClientRect();
      const sx = originRect.width / final.width;
      const sy = originRect.height / final.height;
      const dx =
        originRect.left + originRect.width / 2 - (final.left + final.width / 2);
      const dy =
        originRect.top + originRect.height / 2 - (final.top + final.height / 2);
      el.animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.55 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 480, easing: 'cubic-bezier(.3,.1,.14,1)' },
      );
    } else {
      el.animate(
        [
          { transform: 'translateY(10px) scale(0.995)', opacity: 0.4 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 320, easing: 'ease-out' },
      );
    }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [originRect, card.key]);

  /* Keys walk and close — unless the reader is typing in the filter bar. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') onStep(1);
      else if (e.key === 'ArrowLeft') onStep(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, onStep]);

  const details = detailLine(card);
  /* The caption bar's link voice: true underlined links, no arrows, quiet
     until the hand arrives. Close sits a shade dimmer than the rest. */
  const linkClass =
    'font-label text-[11px] lowercase tracking-[0.08em] underline underline-offset-[5px] decoration-[0.5px] decoration-bronze-500/40 text-bronze-700 hover:text-bronze-600 hover:decoration-bronze-600 transition-colors';
  const closeClass =
    'font-label text-[11px] lowercase tracking-[0.08em] underline underline-offset-[5px] decoration-[0.5px] decoration-wood-400/40 text-wood-500 hover:text-wood-700 hover:decoration-wood-600 transition-colors';
  const linkClassDark =
    'font-label text-[11px] lowercase tracking-[0.08em] underline underline-offset-[5px] decoration-[0.5px] decoration-[#c8b084]/40 text-[#c8b084] hover:text-[#e8d9b0] hover:decoration-[#e8d9b0] transition-colors';
  const closeClassDark =
    'font-label text-[11px] lowercase tracking-[0.08em] underline underline-offset-[5px] decoration-[0.5px] decoration-[#8a7a5c]/40 text-[#8a7a5c] hover:text-[#c8b084] hover:decoration-[#c8b084] transition-colors';

  return (
    <li
      data-flipkey="__record"
      className={`relative ${spanClass}`}
      aria-label={`The record of ${card.title}`}
    >
      {/* The record is a bigger card among the cards: it spans an NxN block
          of the same grid (dense flow packs the other dreams around it), so
          the big dream never stands alone on its own row. Square, like its
          siblings, with the caption riding the bottom edge. */}
      <div
        ref={panelRef}
        className="relative w-full aspect-square will-change-transform"
        style={{ perspective: '2200px' }}
      >
        <div
          className={`absolute inset-0 transition-transform duration-[900ms] ease-[cubic-bezier(.62,.02,.34,1)] [transform-style:preserve-3d] motion-reduce:transition-none ${
            face === 'art' ? '[transform:rotateY(180deg)]' : ''
          }`}
        >
          {/* Dream page */}
          <div
            aria-hidden={face === 'art'}
            className={`absolute inset-0 [backface-visibility:hidden] flex flex-col overflow-hidden border border-bronze-500/30 bg-wood-50 shadow-[0_24px_80px_rgba(21,19,17,0.45)] ${
              face === 'art' ? 'pointer-events-none' : ''
            }`}
          >
            <KindMark card={card} width={280} />
            <Grain />
            <div className="absolute inset-0 overflow-y-auto px-5 sm:px-9 pt-6 sm:pt-9 pb-[70px]">
              {card.dream ? (
                <>
                  <p className="font-display text-[20px] sm:text-[23px] leading-[1.75] text-wood-900 whitespace-pre-line">
                    {card.dream}
                  </p>
                  <DreamSignature signedBy={card.signedBy} className="mt-5" />
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                  <p className="font-display text-2xl text-wood-700">{card.title}</p>
                  <p className="font-label text-[11px] uppercase tracking-[0.16em] text-wood-500">
                    {card.norm === 'seeking'
                      ? 'seeking ground'
                      : 'waiting for a dream'}
                  </p>
                </div>
              )}
            </div>
            <div className="absolute inset-x-0 bottom-0 h-[60px] border-t border-wood-200 bg-wood-50/95 px-2.5 sm:px-4 flex items-center gap-x-3 sm:gap-x-5 overflow-x-auto whitespace-nowrap">
              <StepArrow dir={-1} enabled={hasPrev} onStep={onStep} tone="paper" />
              <span className="flex items-baseline gap-x-3 sm:gap-x-4 min-w-0">
                <span className="font-display text-[16px] text-wood-800 shrink-0">
                  {card.title}
                </span>
                <span className="font-label text-[10px] uppercase tracking-[0.18em] text-bronze-600">
                  {ledgerStatusLine(card)}
                </span>
              </span>
              <span className="ml-auto flex items-center gap-x-4 sm:gap-x-6">
                <button
                  type="button"
                  onClick={() => setFace('art')}
                  className={linkClass}
                >
                  see the piece
                </button>
                {card.onGlobe && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectOnGlobe(card.pieceId, card.editionNumber);
                    }}
                    className={linkClass}
                  >
                    on the globe
                  </button>
                )}
                <Link to={piecePathOf(card)} className={linkClass}>
                  its page
                </Link>
                <button type="button" onClick={onClose} className={closeClass}>
                  close
                </button>
              </span>
              <StepArrow dir={1} enabled={hasNext} onStep={onStep} tone="paper" />
            </div>
          </div>

          {/* Art page */}
          <div
            aria-hidden={face === 'dreams'}
            className={`absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col overflow-hidden border border-bronze-500/40 bg-[#151311] shadow-[0_24px_80px_rgba(21,19,17,0.45)] ${
              face === 'dreams' ? 'pointer-events-none' : ''
            }`}
          >
            {/* The piece, whole: a square stage for a square work, contain-fit
                so nothing is ever cut away. */}
            <div className="absolute inset-0">
              <ArtworkPlate
                src={card.coverImageLarge ?? card.coverImage}
                alt={card.title}
                title={card.title}
                aspect="cover"
                imgStyle={{ objectFit: 'contain' }}
                loading="eager"
              />
            </div>
            <Grain />
            <div className="absolute inset-x-0 bottom-0 h-[60px] px-2.5 sm:px-4 flex items-center gap-x-3 sm:gap-x-5 overflow-x-auto whitespace-nowrap bg-gradient-to-t from-black/85 via-black/60 to-transparent">
              <StepArrow dir={-1} enabled={hasPrev} onStep={onStep} tone="stage" />
              <span className="flex items-baseline gap-x-3 sm:gap-x-4 min-w-0">
                <span className="font-display text-[16px] text-[#f0e8d8] shrink-0">
                  {card.title}
                </span>
                {details && (
                  <span className="font-label text-[10px] uppercase tracking-[0.18em] text-[#c8b084] truncate">
                    {details}
                  </span>
                )}
              </span>
              <span className="ml-auto flex items-center gap-x-4 sm:gap-x-6">
                <button
                  type="button"
                  onClick={() => setFace('dreams')}
                  className={linkClassDark}
                >
                  read the dream
                </button>
                <Link to={piecePathOf(card)} className={linkClassDark}>
                  its page
                </Link>
                <button
                  type="button"
                  onClick={onClose}
                  className={closeClassDark}
                >
                  close
                </button>
              </span>
              <StepArrow dir={1} enabled={hasNext} onStep={onStep} tone="stage" />
            </div>
          </div>
        </div>

      </div>
    </li>
  );
};

/** The walking arrows, seated at the caption bar's outer corners. A missing
 *  neighbor leaves an equal-width silence so the bar never shifts. */
const StepArrow: React.FC<{
  dir: 1 | -1;
  enabled: boolean;
  onStep: (dir: 1 | -1) => void;
  tone: 'paper' | 'stage';
}> = ({ dir, enabled, onStep, tone }) => {
  if (!enabled) return <span aria-hidden className="shrink-0 w-[27px]" />;
  return (
    <button
      type="button"
      aria-label={dir === 1 ? 'Next piece' : 'Previous piece'}
      onClick={() => onStep(dir)}
      className={`shrink-0 px-1.5 font-display text-[19px] leading-none transition-all duration-200 ${
        dir === 1 ? 'hover:translate-x-0.5' : 'hover:-translate-x-0.5'
      } ${
        tone === 'paper'
          ? 'text-bronze-600 hover:text-bronze-500'
          : 'text-[#c8b084] hover:text-[#e8d9b0]'
      }`}
    >
      <span aria-hidden>{dir === 1 ? '→' : '←'}</span>
    </button>
  );
};

/* ─── Grid FLIP: cards slide to their new places, never teleport ──────────
 * On every layout-affecting render (record opens/closes/steps, filters,
 * density), each tile's previous rect is compared to its new one and the
 * difference is played back as a transform settling to rest. Measurement is
 * per commit, not per frame, so the wall's 60fps rule holds. */

function useGridFlip(ulRef: React.RefObject<HTMLUListElement | null>) {
  const prev = useRef<Map<string, { left: number; top: number }>>(new Map());
  useLayoutEffect(() => {
    const ul = ulRef.current;
    if (!ul) {
      prev.current = new Map();
      return;
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const next = new Map<string, { left: number; top: number }>();
    for (const child of Array.from(ul.children) as HTMLElement[]) {
      const key = child.dataset.flipkey;
      if (!key) continue;
      /* offsetLeft/offsetTop, NOT getBoundingClientRect: client rects are
         viewport-relative and transform-inclusive, so a re-render landing
         mid-scroll (the site scrolls smoothly) or mid-animation would read
         the scroll delta as movement and fling every card. Layout offsets
         are immune to both. */
      const pos = { left: child.offsetLeft, top: child.offsetTop };
      next.set(key, pos);
      if (reduce || key === '__record') continue;
      const was = prev.current.get(key);
      if (!was) continue;
      const dx = was.left - pos.left;
      const dy = was.top - pos.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      child.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
        { duration: 440, easing: 'cubic-bezier(.3,.1,.16,1)' },
      );
    }
    prev.current = next;
  });
}

/* ─── The wall itself ─────────────────────────────────────────────────────── */

const TheWall: React.FC<Props> = ({ cards, onSelectOnGlobe }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const kindOptions = useMemo(() => {
    const present = Array.from(new Set(cards.map((c) => c.kind)));
    const ordered = [
      'sixty-four',
      ...present.filter((k) => k !== 'sixty-four').sort(),
    ].filter((k) => present.includes(k));
    return ['all', ...ordered];
  }, [cards]);

  const [kind, setKindState] = useState<string>(() => {
    const k = searchParams.get('lk');
    return k && kindOptions.includes(k) ? k : 'all';
  });
  const [state, setStateState] = useState<LedgerStateFilter>(() => {
    const s = searchParams.get('ls');
    return isLedgerState(s) ? s : 'all';
  });
  const [search, setSearchState] = useState<string>(
    () => searchParams.get('lq') ?? '',
  );
  /** What the field holds; `search` follows a beat later so a long wall is not
   *  refiltered on every keystroke. */
  const [typed, setTyped] = useState<string>(() => searchParams.get('lq') ?? '');

  const mirror = (key: string, value: string, clearVal: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === clearVal) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  };
  const setKind = (v: string) => {
    setKindState(v);
    mirror('lk', v, 'all');
  };
  const setState = (v: LedgerStateFilter) => {
    setStateState(v);
    mirror('ls', v, 'all');
  };
  const setSearch = useCallback(
    (v: string) => {
      setSearchState(v);
      mirror('lq', v, '');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setSearchParams],
  );
  useEffect(() => {
    if (typed === search) return;
    const t = setTimeout(() => setSearch(typed), 180);
    return () => clearTimeout(t);
  }, [typed, search, setSearch]);

  const filterActive = kind !== 'all' || state !== 'all' || search.trim() !== '';
  const clearAll = () => {
    setKind('all');
    setState('all');
    setTyped('');
    setSearch('');
  };

  /* Counts on every option, so a dead end is visible before it is chosen. */
  const kindSelectOptions = useMemo(
    () =>
      kindOptions.map((k) => ({
        value: k,
        label: k === 'all' ? 'every kind' : ledgerKindLabel(k),
        count: k === 'all' ? cards.length : cards.filter((c) => c.kind === k).length,
      })),
    [kindOptions, cards],
  );
  const stateSelectOptions = useMemo(
    () =>
      LEDGER_STATE_OPTIONS.map((o) => ({
        ...o,
        count: cards.filter(
          (c) => (kind === 'all' || c.kind === kind) && matchesState(c, o.value),
        ).length,
      })),
    [cards, kind],
  );

  /* The two whole-wall instruments: which face is out, and how close you
     stand. A whole-wall turn ripples with a per-card stagger; turning one
     card is immediate. */
  const [globalFace, setGlobalFace] = useState<Face>('dreams');
  const [turned, setTurned] = useState<ReadonlySet<string>>(new Set());
  const [rippling, setRippling] = useState(false);
  const rippleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [density, setDensity] = useState<Density>('mid');

  const turnWall = (next: Face) => {
    if (next === globalFace) return;
    setGlobalFace(next);
    setTurned(new Set());
    setRippling(true);
    if (rippleTimer.current) clearTimeout(rippleTimer.current);
    rippleTimer.current = setTimeout(() => setRippling(false), 1600);
  };
  useEffect(
    () => () => {
      if (rippleTimer.current) clearTimeout(rippleTimer.current);
    },
    [],
  );

  const turnOne = useCallback((key: string) => {
    setTurned((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const visible = useMemo(
    () =>
      cards.filter(
        (c) =>
          (kind === 'all' || c.kind === kind) &&
          matchesState(c, state) &&
          matchesSearch(c, search),
      ),
    [cards, kind, state, search],
  );

  const dreamsRiding = useMemo(
    () => visible.filter((c) => !!c.dream).length,
    [visible],
  );

  /* The open record: which card, and the wall-rect it grew from. It renders
     IN the grid at the opened card's index, spanning every column, so the
     other cards make way rather than being covered. */
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);
  const openIndex = useMemo(
    () => (openKey ? visible.findIndex((c) => c.key === openKey) : -1),
    [openKey, visible],
  );
  const openCard = openIndex >= 0 ? visible[openIndex] : null;

  const openRecord = useCallback((key: string, rect: DOMRect) => {
    setOriginRect(rect);
    setOpenKey(key);
  }, []);
  const closeRecord = useCallback(() => setOpenKey(null), []);
  const stepRecord = useCallback(
    (dir: 1 | -1) => {
      if (openIndex < 0) return;
      const next = visible[openIndex + dir];
      if (next) {
        setOriginRect(null); // steps swap in place; only the first open travels
        setOpenKey(next.key);
      }
    },
    [openIndex, visible],
  );

  const faceOf = (c: WallCard): Face =>
    turned.has(c.key)
      ? globalFace === 'dreams'
        ? 'art'
        : 'dreams'
      : globalFace;

  const gridRef = useRef<HTMLUListElement | null>(null);
  useGridFlip(gridRef);

  return (
    <section aria-labelledby="atlas-wall-heading">
      <style>{WALL_CSS}</style>
      <h2
        id="atlas-wall-heading"
        className="font-display text-3xl text-wood-900 font-medium mb-2"
      >
        The wall
      </h2>
      <p className="font-reading text-base text-wood-700 leading-[1.7] max-w-prose">
        Every piece is a card. The dream rides one face, the work the other.
        Turn them.
      </p>

      {/* ── The instruments: face, distance, then the filter line ─────────── */}
      <div className="mt-6 mb-8 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div
            role="group"
            aria-label="Which face of the wall is showing"
            className="flex items-baseline gap-4"
          >
            <FaceButton
              label="the dreams"
              active={globalFace === 'dreams'}
              onClick={() => turnWall('dreams')}
            />
            <span aria-hidden className="text-wood-300">
              /
            </span>
            <FaceButton
              label="the art"
              active={globalFace === 'art'}
              onClick={() => turnWall('art')}
            />
          </div>

          <div
            role="group"
            aria-label="How close you stand to the wall"
            className="flex items-center gap-2.5 ml-auto"
          >
            <span className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-500">
              stand
            </span>
            {(['near', 'mid', 'far'] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={density === d}
                aria-label={`Stand ${d === 'mid' ? 'at reading distance' : d}`}
                onClick={() => setDensity(d)}
                className={`rounded-full border transition-colors ${
                  d === 'near' ? 'h-3.5 w-3.5' : d === 'mid' ? 'h-2.5 w-2.5' : 'h-1.5 w-1.5'
                } ${
                  density === d
                    ? 'bg-bronze-500 border-bronze-500'
                    : 'bg-transparent border-wood-400 hover:border-bronze-500'
                }`}
              />
            ))}
          </div>
        </div>

        <LedgerControlRow>
          <LedgerSearchField
            value={typed}
            onChange={setTyped}
            ariaLabel="Search the wall by title, city, or dream"
          />
          <LedgerSelect
            label="kind"
            value={kind}
            options={kindSelectOptions}
            onChange={setKind}
            emphasis={kind !== 'all'}
          />
          <LedgerSelect
            label="status"
            value={state}
            options={stateSelectOptions}
            onChange={setState}
            emphasis={state !== 'all'}
          />
        </LedgerControlRow>

        <LedgerTally onClear={filterActive ? clearAll : undefined}>
          {filterActive
            ? `${visible.length} of ${cards.length} pieces`
            : `${cards.length} pieces`}
          {dreamsRiding > 0 && ` · ${dreamsRiding} dreams riding`}
        </LedgerTally>
      </div>

      {visible.length === 0 ? (
        <p className="font-reading text-base text-wood-600 leading-[1.7] py-8">
          Nothing matches. Loosen a filter.
        </p>
      ) : (
        <ul
          ref={gridRef}
          className={`grid gap-3 sm:gap-4 [grid-auto-flow:dense] ${DENSITY_GRID[density]}`}
>
          {visible.map((c, i) => {
            const isOpen = openCard?.key === c.key;
            if (isOpen && openCard) {
              return (
                <WallRecord
                  key="__record"
                  card={openCard}
                  originRect={originRect}
                  spanClass={RECORD_SPAN[density]}
                  initialFace={faceOf(openCard)}
                  hasPrev={openIndex > 0}
                  hasNext={openIndex < visible.length - 1}
                  onStep={stepRecord}
                  onClose={closeRecord}
                  onSelectOnGlobe={onSelectOnGlobe}
                />
              );
            }
            return (
              <WallTile
                key={c.key}
                card={c}
                face={faceOf(c)}
                delayMs={rippling ? (i % 36) * 26 : 0}
                riseDelayMs={(i % 28) * 24}
                density={density}
                onOpen={openRecord}
                onTurn={turnOne}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
};

const FaceButton: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={`font-display text-xl transition-colors ${
      active
        ? 'text-wood-900 border-b border-bronze-600'
        : 'text-wood-500 border-b border-transparent hover:text-bronze-700'
    }`}
  >
    {label}
  </button>
);

export default TheWall;
