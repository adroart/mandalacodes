import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { OracleCard } from '../../data/oracleData';
import { useReflectionRecorder } from '../../hooks/useReflectionRecorder';
import ReflectionRecorderBar from './ReflectionRecorderBar';
import BirthTimeModal from './BirthTimeModal';
import { useProfile } from '../../lib/profile/context';
import './oracle-bottom-navigation.css';

/* The persistent reading bar. Five slots, always fixed to the bottom so a
   visitor can act the moment a code lands, at any scroll depth:

     Family · For Me · [All 64] · The Piece · Share

   All 64 stays the centre anchor (and holds the admin reflection recorder on
   long-press, unchanged). The two slots beside it are the highest-intent acts:
   For Me (find the codes in your chart) and The Piece (the physical wooden
   work, made by hand; acquiring lives one layer in). Family opens the project
   reveal; Share sends this code onward. No "buy"/"claim" word ever sits on the
   ever-present bar. */

interface Props {
  current: OracleCard;
  palette: 'daybook' | 'nightfall';
  /** The physical piece id for this code, if one exists. Links "The Piece". */
  pieceId?: string | null;
  /** Opens the share sheet, owned by the reading page. */
  onShare(): void;
  onInvocationPublished?(): void;
  showSafariHandoff?: boolean;
}

const OracleBottomNavigation: React.FC<Props> = ({ current, palette, pieceId, onShare, onInvocationPublished, showSafariHandoff = false }) => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [birthOpen, setBirthOpen] = useState(false);
  const recorder = useReflectionRecorder(current.number);
  const holdTimer = useRef<number | null>(null);
  const heldPointer = useRef<{ id: number; target: HTMLButtonElement } | null>(null);
  const longPressed = useRef(false);
  const [holding, setHolding] = useState(false);
  const centerButtonRef = useRef<HTMLButtonElement>(null);
  const previousRecorderStatus = useRef(recorder.state.status);

  useEffect(() => {
    const previous = previousRecorderStatus.current;
    previousRecorderStatus.current = recorder.state.status;
    if (previous !== 'idle' && recorder.state.status === 'idle') {
      window.requestAnimationFrame(() => {
        const visibleDeck = document.querySelector<HTMLElement>(
          '.card-reading [data-bar-tab="deck"], .card-reading [data-bar-deck]',
        );
        (visibleDeck ?? centerButtonRef.current)?.focus();
      });
    }
  }, [recorder.state.status]);

  const cancelHold = useCallback(() => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setHolding(false);
    const held = heldPointer.current;
    heldPointer.current = null;
    if (held?.target.hasPointerCapture?.(held.id)) {
      try { held.target.releasePointerCapture(held.id); } catch { /* Pointer capture may already have ended. */ }
    }
  }, []);
  const beginHold = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!recorder.capabilityReady || !recorder.isAdmin || recorder.state.status !== 'idle' || event.button !== 0) return;
    longPressed.current = false;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
      heldPointer.current = { id: event.pointerId, target: event.currentTarget };
    } catch { /* Synthetic events and older browsers may not expose active pointer capture. */ }
    setHolding(true);
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      longPressed.current = true;
      setHolding(false);
      void recorder.startRecording();
    }, 650);
  }, [recorder]);
  useEffect(() => cancelHold, [cancelHold]);

  // The current reading frame owns the visible deck control; this legacy bar
  // remains mounted (hidden) as the single recorder/share state owner. Bind
  // the admin gesture to the controls people can actually reach.
  useEffect(() => {
    if (!recorder.capabilityReady || !recorder.isAdmin || recorder.state.status !== 'idle') return;
    const controls = Array.from(document.querySelectorAll<HTMLElement>(
      '.card-reading [data-bar-tab="deck"], .card-reading [data-bar-deck]',
    ));
    const cleanups = controls.map((control) => {
      let timer: number | null = null;
      let suppressClick = false;
      let heldPointerId: number | null = null;
      const start = () => {
        timer = null;
        suppressClick = true;
        control.classList.remove('is-holding');
        void recorder.startRecording();
      };
      const pointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        suppressClick = false;
        heldPointerId = event.pointerId;
        try { control.setPointerCapture(event.pointerId); } catch { /* Older WebKit may not capture synthetic pointers. */ }
        control.classList.add('is-holding');
        timer = window.setTimeout(start, 650);
      };
      const endHold = () => {
        if (timer !== null) window.clearTimeout(timer);
        timer = null;
        control.classList.remove('is-holding');
        if (heldPointerId !== null && control.hasPointerCapture?.(heldPointerId)) {
          try { control.releasePointerCapture(heldPointerId); } catch { /* Capture may already have ended. */ }
        }
        heldPointerId = null;
      };
      const click = (event: MouseEvent) => {
        if (!suppressClick) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressClick = false;
      };
      const keyDown = (event: KeyboardEvent) => {
        if (event.key !== ' ') return;
        event.preventDefault();
        if (event.repeat) return;
        void recorder.startRecording();
      };
      const contextMenu = (event: Event) => event.preventDefault();
      const hint = document.createElement('span');
      hint.className = 'oracle-admin-record-hint';
      hint.textContent = 'Hold to record';
      hint.setAttribute('aria-hidden', 'true');
      control.appendChild(hint);
      control.dataset.adminRecorder = 'available';
      control.setAttribute('aria-keyshortcuts', 'Space');
      control.setAttribute('aria-label', 'The 64. Tap or press Enter to open the deck. Hold or press Space to record a private reflection');
      control.addEventListener('pointerdown', pointerDown);
      control.addEventListener('pointerup', endHold);
      control.addEventListener('pointercancel', endHold);
      control.addEventListener('click', click, true);
      control.addEventListener('keydown', keyDown);
      control.addEventListener('contextmenu', contextMenu);
      return () => {
        endHold();
        hint.remove();
        delete control.dataset.adminRecorder;
        control.removeAttribute('aria-keyshortcuts');
        control.removeAttribute('aria-label');
        control.removeEventListener('pointerdown', pointerDown);
        control.removeEventListener('pointerup', endHold);
        control.removeEventListener('pointercancel', endHold);
        control.removeEventListener('click', click, true);
        control.removeEventListener('keydown', keyDown);
        control.removeEventListener('contextmenu', contextMenu);
      };
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [recorder.capabilityReady, recorder.isAdmin, recorder.state.status, recorder.startRecording]);

  const reflectionActive = recorder.state.status !== 'idle';
  useEffect(() => {
    const frame = document.querySelector<HTMLElement>('.card-reading');
    if (!frame || !reflectionActive) return;
    frame.dataset.reflectionActive = 'true';
    return () => { delete frame.dataset.reflectionActive; };
  }, [reflectionActive]);

  const safariHandoff = showSafariHandoff ? (
    <a
      className="oracle-safari-handoff"
      href={`/universal-language/${current.number}`}
      target="_blank"
      rel="external noopener noreferrer"
      aria-label="Open this reading in Safari"
    >
      <span>Open in Safari</span>
      <small>Full browser</small>
    </a>
  ) : null;

  if (recorder.state.status !== 'idle') {
    return <><ReflectionRecorderBar hexagramNumber={current.number} recorder={recorder} onInvocationPublished={onInvocationPublished} />{safariHandoff}</>;
  }

  // "For Me": if a chart already exists, open it; otherwise invite the birthday
  // inline (computes locally, no account needed), mirroring the header callout.
  const openForMe = () => {
    if (profile) navigate('/profile');
    else setBirthOpen(true);
  };

  return (
    <><nav className="eb-reading oracle-bottom-nav" data-palette={palette} aria-label="Reading actions">
      <div className="oracle-bottom-nav__inner">
        <Link className="oracle-bottom-nav__slot" to="/family" aria-label="The family behind these codes">
          <span className="oracle-bottom-nav__label">Family</span>
        </Link>

        <button type="button" className="oracle-bottom-nav__slot" onClick={openForMe} aria-label="See the codes in your chart">
          <span className="oracle-bottom-nav__label">For Me</span>
        </button>

        <button
          ref={centerButtonRef}
          type="button"
          className={`oracle-bottom-nav__slot oracle-bottom-nav__current${holding ? ' is-holding' : ''}`}
          data-recorder-owner
          data-admin-recorder={recorder.isAdmin ? 'available' : undefined}
          aria-label="All 64 codes"
          onPointerDown={beginHold}
          onPointerUp={cancelHold}
          onPointerCancel={cancelHold}
          onContextMenu={(event) => {
            if (recorder.isAdmin) event.preventDefault();
          }}
          onClick={(event) => {
            if (longPressed.current) {
              event.preventDefault();
              longPressed.current = false;
              return;
            }
            navigate('/universal-language');
          }}
        >
          <span className="oracle-bottom-nav__number">{current.number}</span>
          <span className="oracle-bottom-nav__label">All 64</span>
        </button>

        {pieceId ? (
          <Link className="oracle-bottom-nav__slot" to={`/piece/${pieceId}`} aria-label="The physical piece for this code">
            <span className="oracle-bottom-nav__label">The Piece</span>
          </Link>
        ) : (
          <span className="oracle-bottom-nav__slot oracle-bottom-nav__slot--muted" aria-hidden>
            <span className="oracle-bottom-nav__label">The Piece</span>
          </span>
        )}

        <button type="button" className="oracle-bottom-nav__slot" onClick={onShare} aria-label="Share this code">
          <span className="oracle-bottom-nav__label">Share</span>
        </button>
      </div>

      {birthOpen && (
        <BirthTimeModal
          showCardOption
          onClose={() => setBirthOpen(false)}
          onLogIn={() => setBirthOpen(false)}
          onSeeChart={() => { setBirthOpen(false); navigate('/profile'); }}
          onBackToCard={() => setBirthOpen(false)}
          onSave={() => setBirthOpen(false)}
        />
      )}
    </nav>{safariHandoff}</>
  );
};

export default OracleBottomNavigation;
