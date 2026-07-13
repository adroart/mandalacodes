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
   For Me (find the codes in your chart) and The Piece (the real one-of-one
   wooden original, acquiring lives one layer in). Family opens the project
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
}

const OracleBottomNavigation: React.FC<Props> = ({ current, palette, pieceId, onShare, onInvocationPublished }) => {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const [birthOpen, setBirthOpen] = useState(false);
  const recorder = useReflectionRecorder(current.number);
  const holdTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const [holding, setHolding] = useState(false);

  const cancelHold = useCallback(() => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    setHolding(false);
  }, []);
  const beginHold = useCallback((event: React.PointerEvent<HTMLAnchorElement>) => {
    if (!recorder.capabilityReady || !recorder.isAdmin || recorder.state.status !== 'idle' || event.button !== 0) return;
    longPressed.current = false;
    setHolding(true);
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null;
      longPressed.current = true;
      setHolding(false);
      void recorder.startRecording();
    }, 650);
  }, [recorder]);
  useEffect(() => cancelHold, [cancelHold]);

  if (recorder.state.status !== 'idle') {
    return <ReflectionRecorderBar hexagramNumber={current.number} recorder={recorder} onInvocationPublished={onInvocationPublished} />;
  }

  // "For Me": if a chart already exists, open it; otherwise invite the birthday
  // inline (computes locally, no account needed), mirroring the header callout.
  const openForMe = () => {
    if (profile) navigate('/profile');
    else setBirthOpen(true);
  };

  return (
    <nav className="eb-reading oracle-bottom-nav" data-palette={palette} aria-label="Reading actions">
      <div className="oracle-bottom-nav__inner">
        <Link className="oracle-bottom-nav__slot" to="/family" aria-label="The family behind these codes">
          <span className="oracle-bottom-nav__label">Family</span>
        </Link>

        <button type="button" className="oracle-bottom-nav__slot" onClick={openForMe} aria-label="See the codes in your chart">
          <span className="oracle-bottom-nav__label">For Me</span>
        </button>

        <Link
          className={`oracle-bottom-nav__slot oracle-bottom-nav__current${holding ? ' is-holding' : ''}`}
          data-current-hexagram
          data-admin-recorder={recorder.isAdmin ? 'available' : undefined}
          to="/universal-language"
          aria-label="All 64 codes"
          onPointerDown={beginHold}
          onPointerUp={cancelHold}
          onPointerCancel={cancelHold}
          onPointerLeave={cancelHold}
          onContextMenu={(event) => {
            if (recorder.isAdmin) event.preventDefault();
          }}
          onClick={(event) => {
            if (longPressed.current) {
              event.preventDefault();
              longPressed.current = false;
            }
          }}
        >
          <span className="oracle-bottom-nav__number">{current.number}</span>
          <span className="oracle-bottom-nav__label">All 64</span>
        </Link>

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
    </nav>
  );
};

export default OracleBottomNavigation;
