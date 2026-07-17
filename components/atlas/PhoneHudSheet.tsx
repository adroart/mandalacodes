/**
 * Phone selection half-sheet (interface law 4: the globe is the constant).
 *
 * On viewports under 768px the selected-piece card rides in a bottom sheet
 * that rests at 45% of the viewport so the globe stays visible above it, with
 * the chosen light recentred into that upper strip by the camera tween. A drag
 * on the grab handle raises the sheet to the full card, lowers it back to the
 * resting height, or, pulled down from rest, dismisses the selection. The
 * globe is never fully covered.
 *
 * Native pointer handling only, no dependencies. The handle owns the drag; the
 * card body scrolls on its own.
 */

import React, { useRef, useState } from 'react';

const PEEK_VH = 45;
const FULL_VH = 88;
const EXPAND_DRAG_PX = 56; // upward drag from rest that snaps to the full card
const DISMISS_DRAG_PX = 90; // downward drag from rest that dismisses
const COLLAPSE_DRAG_PX = 110; // downward drag from full that returns to rest

export interface PhoneHudSheetProps {
  onDismiss: () => void;
  children: React.ReactNode;
}

const PhoneHudSheet: React.FC<PhoneHudSheetProps> = ({ onDismiss, children }) => {
  const [expanded, setExpanded] = useState(false);
  const [dragPx, setDragPx] = useState(0); // live drag offset, down positive
  const startY = useRef<number | null>(null);
  const dragging = startY.current !== null;

  const onPointerDown = (e: React.PointerEvent) => {
    startY.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (startY.current === null) return;
    setDragPx(e.clientY - startY.current);
  };
  const settle = () => {
    const dy = dragPx;
    startY.current = null;
    setDragPx(0);
    if (!expanded) {
      if (dy < -EXPAND_DRAG_PX) setExpanded(true);
      else if (dy > DISMISS_DRAG_PX) onDismiss();
    } else if (dy > COLLAPSE_DRAG_PX) {
      setExpanded(false);
    }
  };

  // While dragging, translate the sheet by the raw offset (clamped so an
  // upward drag past full doesn't lift it off the bottom edge); at rest the
  // sheet sits flush and only its height animates between peek and full.
  const translate = dragging ? Math.max(-24, dragPx) : 0;

  return (
    <div
      data-atlas-hud
      className="absolute inset-x-0 bottom-0 z-30 [color-scheme:dark]"
      style={{
        height: `${expanded ? FULL_VH : PEEK_VH}svh`,
        transform: `translateY(${translate}px)`,
        transition: dragging
          ? 'none'
          : 'height 400ms cubic-bezier(0.4,0,0.2,1), transform 300ms cubic-bezier(0.4,0,0.2,1)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Grab handle: owns the drag, so the card body below scrolls freely. */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={settle}
        onPointerCancel={settle}
        className="flex shrink-0 items-center justify-center pt-2.5 pb-2"
        style={{ touchAction: 'none', cursor: 'grab' }}
        role="separator"
        aria-label="Drag to resize, pull down to close"
      >
        <span
          aria-hidden
          className="block h-1 w-10 rounded-full"
          style={{ backgroundColor: 'rgba(196,170,124,0.5)' }}
        />
      </div>
      {/* The card fills the remaining sheet height and owns its own scroll. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-hide">
        {children}
      </div>
    </div>
  );
};

export default PhoneHudSheet;
