/**
 * Selection as inscription (build-order item 3, "Selection: the inscription,
 * not the card") — desktop only. Selecting a light writes its dream large
 * across the dark on the side of the globe away from the light, in Cormorant
 * display, with one line beneath in Karla and exactly one action: open the
 * book. That action reveals the existing full PieceHUD card, unchanged.
 *
 * A piece with no public dream shows the existing "no dream is kept here yet"
 * line at the same dignity. return, Esc and Back keep closing the selection as
 * Phase 2 built them.
 */

export interface SelectionInscriptionProps {
  /** The piece's public dream, unabridged; null when none is kept. */
  dream: string | null;
  /** The sub-line, e.g. "UL № 1 · placed in Denpasar · the 1st light". */
  standing: string;
  /** Write on the left when the light is on the right hemisphere, and vice
      versa: the dream sits away from its light. */
  awayLeft: boolean;
  onOpenBook: () => void;
}

export default function SelectionInscription({
  dream,
  standing,
  awayLeft,
  onOpenBook,
}: SelectionInscriptionProps) {
  return (
    <div
      data-atlas-inscription
      className={
        awayLeft
          ? 'pointer-events-none absolute left-8 top-1/2 -translate-y-1/2 z-30 max-w-[34rem] text-left'
          : 'pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 z-30 max-w-[34rem] text-right'
      }
      style={{ animation: 'hud-in 500ms ease-out' }}
    >
      <p
        style={{
          fontFamily: '"Cormorant Garamond", serif',
          fontWeight: 400,
          fontSize: dream ? 'clamp(28px, 2.6vw, 40px)' : 'clamp(28px, 2.4vw, 36px)',
          lineHeight: 1.28,
          letterSpacing: '0.008em',
          color: dream ? 'rgba(237, 226, 204, 0.96)' : 'rgba(196, 170, 124, 0.72)',
          margin: 0,
          textShadow: '0 2px 26px rgba(8,6,4,0.92)',
        }}
      >
        {dream ?? 'no dream is kept here yet.'}
      </p>
      <p
        className="mt-5 font-label uppercase"
        style={{ fontSize: 12, letterSpacing: '0.18em', color: 'rgba(196,170,124,0.72)' }}
      >
        {standing}
      </p>
      <button
        type="button"
        onClick={onOpenBook}
        className="pointer-events-auto mt-6 font-label text-[12px] uppercase tracking-[0.24em] text-bronze-300 hover:text-bronze-200 transition-colors"
        style={{ borderBottom: '1px solid rgba(196,170,124,0.5)', paddingBottom: 3 }}
      >
        open the book
      </button>
    </div>
  );
}
