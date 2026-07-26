/**
 * Phone selection sheet: on viewports under 768px the selected piece opens as
 * a full-screen reading surface.
 *
 * It used to be a half-sheet resting at 45svh so the globe stayed visible above
 * it (the old reading of interface law 4, "the globe is the constant"). Adrian,
 * 2026-07-26, on a phone: it "feels glitchy, it doesn't come up the right way",
 * and it should "be a full screen and easy to click and close". Two real faults
 * sat under that:
 *
 *  1. It was positioned ABSOLUTE inside the globe section, so it belonged to
 *     the scrolling page rather than to the screen. Any nudge of the scroll
 *     carried the panel up under the fixed nav, sliced its heading in half, and
 *     stranded it in the middle of the wall further down the page. Nothing was
 *     wrong with the drag logic; the panel was simply never attached to the
 *     viewport. It is `fixed` now, and the page behind it is held still while
 *     it is open.
 *  2. There was no way to close it except guessing that the small bar at the
 *     top was draggable, and then dragging it far enough. A reading surface
 *     that opens on a tap has to close on a tap.
 *
 * Ways out: a tap anywhere on the surface — the artwork, the dream, the
 * sub-line, the night around them — plus the named close button, a swipe down,
 * and Escape. Adrian ruled for tap-anywhere (2026-07-26) over the safer
 * tap-only-the-dark: nobody may feel locked in, and that outweighs the risk of
 * a stray thumb costing someone their place in a long dream.
 *
 * The exception is a real control. A button inside the card (a row in a city's
 * list, the back link to that list) acts and does NOT dismiss, because the
 * reader is staying. A link dismisses as it navigates, because they are going.
 * See handleSurfaceClick.
 *
 * The globe is no longer held visible behind the card on phones. On a small
 * screen the half-measure gave neither a readable card nor a legible world; the
 * globe returns, whole, the moment the reader closes the piece.
 */

import React, { useEffect, useRef, useState } from 'react';

/** Downward drag that dismisses. Generous: this is a shortcut, not the door. */
const DISMISS_DRAG_PX = 110;

export interface PhoneHudSheetProps {
  onDismiss: () => void;
  /** Hide the card WITHOUT touching the URL or history, for when a link inside
      it is already navigating. The full dismissal steps back through history,
      which would race the link and cancel the navigation outright. */
  onNavigateAway?: () => void;
  children: React.ReactNode;
}

const PhoneHudSheet: React.FC<PhoneHudSheetProps> = ({ onDismiss, onNavigateAway, children }) => {
  const [dragPx, setDragPx] = useState(0); // live drag offset, down positive
  const startY = useRef<number | null>(null);
  const dragging = startY.current !== null;

  // Hold the page still underneath. Without this the document keeps scrolling
  // behind the card, so closing it can return the reader somewhere entirely
  // different from where they tapped.
  useEffect(() => {
    const { body } = document;
    const prev = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = prev;
    };
  }, []);

  // Escape closes it too, for the keyboard and for a small laptop window.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  const onPointerDown = (e: React.PointerEvent) => {
    startY.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startY.current === null) return;
    // Only downward travel moves the card; an upward pull has nowhere to go.
    setDragPx(Math.max(0, e.clientY - startY.current));
  };
  const settle = () => {
    const dy = dragPx;
    startY.current = null;
    setDragPx(0);
    if (dy > DISMISS_DRAG_PX) onDismiss();
  };

  /* Tap anywhere on the surface to close (Adrian, 2026-07-26). Matching on the
     nearest interactive ancestor, rather than on a list of components, means
     every control inside the card is handled correctly, including ones added
     later, without each one having to remember to stop the event. */
  const handleSurfaceClick = (e: React.MouseEvent) => {
    const el = e.target as HTMLElement | null;
    // A control that acts INSIDE the card (a row in a city's list, the back link
    // to that list) must not also dismiss it: the reader is staying.
    if (el?.closest('button, [role="button"], input, select, textarea, label')) return;
    // A link LEAVES. Get the card out of the way as it goes, rather than let it
    // sit on top of the page it just opened: the new page renders a beat before
    // React finishes tearing this one down, and that beat was long enough to
    // read as "the book did not open". State only — a full dismissal would step
    // back through history and cancel the navigation.
    if (el?.closest('a')) {
      onNavigateAway?.();
      return;
    }
    onDismiss();
  };

  return (
    <div
      data-atlas-hud
      role="dialog"
      aria-modal="true"
      aria-label="The piece"
      // Above the site bar (z-100), deliberately. A full-screen reading surface
      // that stops short of the nav gets its own close control hidden behind
      // it, and leaves the reader looking at two sets of chrome at once. It
      // takes the whole screen and hands it back on close.
      className="fixed inset-0 z-[200] flex flex-col bg-atlas-night [color-scheme:dark]"
      style={{
        transform: `translateY(${dragPx}px)`,
        transition: dragging ? 'none' : 'transform 300ms cubic-bezier(0.4,0,0.2,1)',
        // Never let the card run under the notch or the home indicator.
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* The bar: the grab handle owns the swipe, the close button owns the tap.
          The button is the visible promise; the handle is the shortcut. */}
      {/* min-h-12 so the bar is at least as tall as the close button's touch
          target. Otherwise the button overhangs the row and lands on top of the
          artwork below it. */}
      <div className="relative flex min-h-12 shrink-0 items-center justify-center">
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={settle}
          onPointerCancel={settle}
          className="flex flex-1 items-center justify-center pt-3.5 pb-3"
          style={{ touchAction: 'none', cursor: 'grab' }}
          role="separator"
          aria-label="Drag down to close"
        >
          <span
            aria-hidden
            className="block h-1 w-10 rounded-full"
            style={{ backgroundColor: 'rgba(196,170,124,0.5)' }}
          />
        </div>
        {/* A named button, not a bare glyph (Adrian, 2026-07-26). A lone × asks
            the reader to recognise a symbol; the word removes the guess, and
            widening the target to the word makes it easier to hit than the
            glyph alone. This is the way out that is meant to be found. */}
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-2 top-0 flex h-12 items-center gap-2 pl-3 pr-1 font-label text-[11px] uppercase tracking-[0.18em] text-wood-700 hover:text-atlas-gold transition-colors"
        >
          close
          <span aria-hidden className="text-[19px] leading-none">
            ×
          </span>
        </button>
      </div>

      {/* The card hangs from the top, and the night left over collects at the
          bottom where it reads as margin.

          Centring it was worse, even though the space above and below came out
          mathematically equal: above the card that space is bare black sitting
          on the hard top edge of the artwork, and it reads as a hole the image
          is falling through. Below the card the same space reads as the page
          simply ending. Even is not the same as balanced.

          That leftover night is also the exit. Tapping it closes the piece, so
          the reader is never hunting for a way out, while taps that land on the
          card itself do nothing — a stray thumb in the middle of a long dream
          must not throw you back to the map. The close button stays the visible
          promise; this is the forgiving version of it. */}
      <div
        onClick={handleSurfaceClick}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain scrollbar-hide"
      >
        <div className="w-full">{children}</div>
      </div>
    </div>
  );
};

export default PhoneHudSheet;
