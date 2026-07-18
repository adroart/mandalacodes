/**
 * Selection as inscription (build-order item 3, "Selection: the inscription,
 * not the card") — desktop only. Selecting a light writes its dream large
 * across the dark on the side of the globe away from the light, in Cormorant
 * display, with one line beneath in Karla and exactly one action: open the
 * book. That action reveals the existing full PieceHUD card, unchanged.
 *
 * Legibility first (law 2, sharpened): the whole block — dream, sub-line and
 * the `open the book` action — is backed by a quiet local scrim, a soft
 * elliptical deepening of the night with no card edge, so the display text is
 * comfortably readable wherever it lands, even over the engraved earth. Seated
 * on the outer side away from the light, it never sits under a light's bloom.
 *
 * A piece with no public dream shows the existing "no dream is kept here yet"
 * line at the same dignity. return, Esc and Back keep closing the selection as
 * Phase 2 built them.
 */

export interface SelectionInscriptionProps {
  /** The piece's public dream, unabridged; null when none is kept. */
  dream: string | null;
  /** The sub-line, e.g. "UL № 1 · alive in Denpasar · the 1st light". */
  standing: string;
  /** Write on the left when the light is on the right hemisphere, and vice
      versa: the dream sits away from its light. */
  awayLeft: boolean;
  onOpenBook: () => void;
}

/** The scrim: a soft elliptical deepening of the night behind the inscription,
    biased toward the outer edge (where the block hugs the margin) and falling
    to nothing before any hard boundary — a deepening, not a panel (law 2). */
function scrim(awayLeft: boolean): string {
  const at = awayLeft ? '38% 50%' : '62% 50%';
  return `radial-gradient(120% 140% at ${at}, rgba(7,5,3,0.68) 0%, rgba(7,5,3,0.52) 40%, rgba(7,5,3,0.28) 64%, rgba(7,5,3,0) 82%)`;
}

/* Dreams are long (Adrian, 2026-07-18). The inscription fits up to ~700
   characters by stepping the size down from 22px, never below the 19px floor;
   beyond that it truncates at a sentence boundary and offers a quiet
   `read the whole dream` action into the full card, where every word renders. */
/* The calm dream scale (Adrian, 2026-07-18): the inscription rests at a base
   22px and steps down only for long dreams, to a 19px floor. A short dream
   stays 22px and is never enlarged; it sits small and dignified. */
const INSCRIPTION_CHAR_FIT = 700;
const INSCRIPTION_MAX_PX = 22;
const INSCRIPTION_MIN_PX = 19;

/** Step the display size down as the dream lengthens (floor 20px), and cut a
 *  longer-than-fit dream at a sentence boundary at or before the fit ceiling. */
function fitInscription(dream: string): { text: string; fontPx: number; truncated: boolean } {
  const clean = dream.trim();
  if (clean.length <= INSCRIPTION_CHAR_FIT) {
    // Interpolate from the large size down to the floor across the fit range.
    const over = Math.max(0, clean.length - 140);
    const span = INSCRIPTION_CHAR_FIT - 140;
    const px = INSCRIPTION_MAX_PX - (INSCRIPTION_MAX_PX - INSCRIPTION_MIN_PX) * (over / span);
    return { text: clean, fontPx: Math.max(INSCRIPTION_MIN_PX, Math.round(px)), truncated: false };
  }
  const windowText = clean.slice(0, INSCRIPTION_CHAR_FIT);
  const m = windowText.match(/^[\s\S]*[.!?]["'”’)\]]?(?=\s|$)/);
  const atSentence = m ? m[0].trim() : '';
  const body =
    atSentence && atSentence.length >= INSCRIPTION_CHAR_FIT * 0.5 ? atSentence : windowText.trim();
  return { text: `${body} …`, fontPx: INSCRIPTION_MIN_PX, truncated: true };
}

export default function SelectionInscription({
  dream,
  standing,
  awayLeft,
  onOpenBook,
}: SelectionInscriptionProps) {
  const fit = dream ? fitInscription(dream) : null;
  return (
    <div
      data-atlas-inscription
      className={
        awayLeft
          ? 'pointer-events-none absolute left-8 top-1/2 -translate-y-1/2 z-30 max-w-[27rem] text-left'
          : 'pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 z-30 max-w-[27rem] text-right'
      }
      style={{ animation: 'hud-in 500ms ease-out', padding: '1.6rem 1.8rem' }}
    >
      {/* The scrim, behind the whole block. */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          inset: '-1.4rem -1.2rem',
          background: scrim(awayLeft),
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <p
        style={{
          position: 'relative',
          zIndex: 1,
          fontFamily: 'var(--font-display)',
          fontWeight: 400,
          fontSize: fit ? `${fit.fontPx}px` : '22px',
          lineHeight: 1.4,
          letterSpacing: '0.008em',
          color: dream ? 'rgba(238, 228, 208, 0.98)' : 'rgba(200, 176, 132, 0.78)',
          margin: 0,
          textShadow: '0 2px 22px rgba(8,6,4,0.9)',
        }}
      >
        {fit ? fit.text : 'no dream is kept here yet.'}
      </p>
      {fit?.truncated && (
        <button
          type="button"
          onClick={onOpenBook}
          className="pointer-events-auto relative mt-4 block font-label text-[12px] uppercase tracking-[0.22em] text-bronze-300 hover:text-bronze-200 transition-colors"
          style={{ zIndex: 1 }}
        >
          read the whole dream
        </button>
      )}
      <p
        className="mt-5 font-label uppercase"
        style={{
          position: 'relative',
          zIndex: 1,
          fontSize: 12,
          letterSpacing: '0.18em',
          color: 'rgba(200,176,132,0.8)',
        }}
      >
        {standing}
      </p>
      <button
        type="button"
        onClick={onOpenBook}
        className="pointer-events-auto relative mt-6 font-label text-[12px] uppercase tracking-[0.24em] text-bronze-300 hover:text-bronze-200 transition-colors"
        style={{ zIndex: 1, borderBottom: '1px solid rgba(196,170,124,0.5)', paddingBottom: 3 }}
      >
        open the book
      </button>
    </div>
  );
}
