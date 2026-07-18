import React, { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAccount } from '../../lib/account/useAccount';
import {
  sendSignInCode,
  verifySignInCode,
  signInWithPassword,
  signInWithGoogle,
} from '../../lib/account/authClient';
import type { GlobeNode } from './Globe';
import type { PieceRecord, StewardRecord, PublicAtlasState } from '../../types';
import { FULL_ARCHIVE } from '../../data/mockData';
import { CITIES_BY_ID } from '../../data/cities';
import { buildKinshipIndex } from '../../utils/kinship';
import { ulCardNumber } from '../../utils/universalLanguage';
import { img } from '../../utils/cloudinary';
import { pieceCode } from '../../utils/pieceCode';
import ClaimCeremony from './ClaimCeremony';
import RequestStewardship from './RequestStewardship';
import ArtworkPlate from './ArtworkPlate';
import { ATLAS_GOLD, ATLAS_NIGHT } from './stageColors';

/**
 * Steward claim, /atlas/claim, one continuous ceremony (M2+, redesign phase 4).
 *
 * The whole claim is a single persistent stage. Behind every beat the living
 * world turns, dimmed, brightening subtly as the person advances (interface
 * law 4: the globe is the constant, never a bare page). The beats cross-fade in
 * place rather than paging between screens, and a quiet lowercase "skip" jumps a
 * beat forward wherever forward has meaning. The beats:
 *
 *   arrival    , the piece's plate floats faintly above the horizon (when the
 *                 URL names one) + the sign-in, seated in the shell, spoken as
 *                 "claim", never "log in".
 *   recognition, the piece's artwork as an object, its code, "begin".
 *   dream      , the first inscription: "What should this piece hold for
 *                 you?", and beneath it, asked exactly once, where the dream
 *                 should live: a light on the map, or privately in the book.
 *                 Private is the default. "inscribe" / "inscribe later".
 *   anchoring  , the committed dream visibly settles into ledger typography,
 *                 about half a second, no spectacle, then ignition.
 *   ignition   , ClaimCeremony: the Founding Lights replay, yours last, the
 *                 ordinal spoken, then the creator's message. Replayable.
 *
 * The claim's two server phases are unchanged. Phase A (bind) fires on a
 * signed-in arrival. Phase B (consent capture) still carries `{ consent,
 * firstInscription? }` in a single POST at the end of the dream beat, so the
 * map choice (consent.ring2MapPresence) and the dream (firstInscription) travel
 * together exactly as before, and ignition only begins once it lands.
 *
 * The no-record branch (a 404 from Phase A) keeps its paper rendering and the
 * RequestStewardship hand-off, and now also carries the homecoming door.
 */

const VIGNETTE = `radial-gradient(120% 90% at 50% 36%, #241b12 0%, #191410 46%, ${ATLAS_NIGHT} 100%)`;

// The gold "door" button treatment, repeated across every claim beat.
const GOLD_BUTTON: React.CSSProperties = { background: ATLAS_GOLD, color: '#241e17' };

type ClaimEntry = {
  steward: StewardRecord;
  piece: PieceRecord | null;
  needsConsent?: boolean;
};

type ClaimResponse = {
  ok: boolean;
  claimed: ClaimEntry[];
  needsConsent?: boolean;
  creatorMessage?: string;
};

type Beat =
  | 'arrival'
  | 'recognition'
  | 'dream'
  | 'anchoring'
  | 'ignition'
  | 'no-record'
  | 'error';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/* WebGL probe kept local so importing the ceremony never eagerly pulls the
   three.js chunk (Globe3D is lazy below); duplicates the tiny check in
   three/Globe3D.supportsWebGL on purpose, for that isolation. */
function localSupportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

const CeremonyGlobe3D = lazy(() => import('./three/Globe3D'));

/* The living world behind the ceremony (interface law 4). The real atlas scene
   at low activity: dimmed, slowly turning, brightening as the person advances
   (arrival dimmest, anchoring brightest, ignition hands off to ClaimCeremony's
   own full-brightness globe). It is decorative here — pointer-inert — so the
   sign-in stays the only thing to touch.

   It must never delay the sign-in's first paint: the heavy three.js mount is
   deferred two frames past first paint, and the atlas state is fetched lazily.
   On a non-WebGL device it renders nothing and the shell's warm vignette stands
   as the fallback; reduced motion is honored by the scene itself (Globe3D stills
   its own autorotation). */
const CeremonyGlobe: React.FC<{ brightness: number }> = ({ brightness }) => {
  const [webgl] = useState(() => typeof window !== 'undefined' && localSupportsWebGL());
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<PublicAtlasState | null>(null);

  useEffect(() => {
    if (!webgl) return;
    let cancelled = false;
    // Two rAFs: let the sign-in options paint before the canvas mounts.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (!cancelled) setMounted(true);
      });
    });
    import('../../lib/atlas/state')
      .then(({ loadAtlasState }) => loadAtlasState())
      .then((s) => {
        if (!cancelled) setState(s);
      })
      .catch(() => {
        /* No world data: the sphere alone still reads as the world. */
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [webgl]);

  const nodes = useMemo<GlobeNode[]>(() => {
    if (!state) return [];
    const out: GlobeNode[] = [];
    for (const p of state.pieces) {
      if (p.status !== 'placed' && p.status !== 'unawakened') continue;
      if (!p.cityId) continue;
      const c = CITIES_BY_ID.get(p.cityId);
      if (!c) continue;
      out.push({
        id: `${p.pieceId}:${p.editionNumber ?? 0}`,
        lat: c.lat,
        lng: c.lng,
        status: p.status === 'unawakened' ? 'unawakened' : 'placed',
        series: p.series,
        pieceType: p.pieceType,
        ordinal: p.claimOrdinal,
      });
    }
    return out;
  }, [state]);

  const kinship = useMemo(
    () => (state ? buildKinshipIndex(state, CITIES_BY_ID, FULL_ARCHIVE) : null),
    [state],
  );

  const placedByCard = useMemo(() => {
    const map = new Map<number, { lat: number; lng: number }>();
    if (!state) return map;
    for (const p of state.pieces) {
      if (p.status !== 'placed' || !p.cityId) continue;
      const art = FULL_ARCHIVE.find((a) => a.id === p.pieceId);
      if (!art || art.series !== 'Universal Language') continue;
      const num = ulCardNumber(art.coverImage);
      if (num == null || map.has(num)) continue;
      const c = CITIES_BY_ID.get(p.cityId);
      if (c) map.set(num, { lat: c.lat, lng: c.lng });
    }
    return map;
  }, [state]);

  if (!webgl) return null;

  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      {mounted && (
        <Suspense fallback={null}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: Math.max(0, Math.min(1, brightness)),
              transition: 'opacity 1.6s ease',
            }}
          >
            <CeremonyGlobe3D
              nodes={nodes}
              kinship={kinship}
              kinshipVisible
              placedByCard={placedByCard}
              clearForHud={false}
              className="absolute inset-0"
            />
          </div>
        </Suspense>
      )}
      {/* Legibility scrim: the world glows behind, the words stay readable in
          front. Constant; the globe's own opacity carries the brightening. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(120% 90% at 50% 42%, rgba(15,13,11,0.52) 0%, rgba(15,13,11,0.36) 48%, rgba(15,13,11,0.72) 100%)',
        }}
      />
    </div>
  );
};

/** Cross-fade wrapper: each beat remounts on a fresh key and fades up, so the
 *  stage behind stays constant while the content dissolves and resolves. */
const FadeIn: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div
      className={className}
      style={{ opacity: shown ? 1 : 0, transition: 'opacity 900ms ease' }}
    >
      {children}
    </div>
  );
};

/** The persistent stage. Full-bleed, warm, the living world dim behind the
 *  beats, brightening as `brightness` rises with the person's progress. */
const CeremonyShell: React.FC<{
  children: React.ReactNode;
  brightness: number;
  onSkip?: () => void;
  skipDisabled?: boolean;
}> = ({ children, brightness, onSkip, skipDisabled }) => (
  <div
    className="fixed inset-0 overflow-hidden"
    style={{ background: VIGNETTE, zIndex: 200 }}
  >
    <CeremonyGlobe brightness={brightness} />
    <div
      className="absolute inset-0 flex items-center justify-center px-6 py-16 overflow-y-auto"
      style={{ zIndex: 1 }}
    >
      <div className="w-full max-w-md">{children}</div>
    </div>
    {onSkip && (
      <button
        type="button"
        onClick={onSkip}
        disabled={skipDisabled}
        className="absolute top-5 right-6 font-label text-[10px] uppercase tracking-[0.2em] text-wood-500 hover:text-bronze-300 transition-colors disabled:opacity-40"
        style={{ zIndex: 2 }}
      >
        skip
      </button>
    )}
  </div>
);

/* ── The sign-in, seated in the shell ──────────────────────────────────────
   Built directly on the auth client rather than the app's SignInModal so the
   language is the ceremony's own, "claim", never "log in", and it lives in
   the stage instead of floating as a modal. Every door logs in OR creates
   (the code and Google both create on first use), so a collector Adrian added
   by email lands in one account however they return. On success the session
   flips and the parent's Phase A effect binds the piece; no callback needed. */

const authField: React.CSSProperties = {
  width: '100%',
  border: '1px solid rgba(196,170,124,0.32)',
  background: 'rgba(20,16,12,0.6)',
  borderRadius: 12,
  padding: '13px 15px',
  fontFamily: "'Karla', system-ui, sans-serif",
  fontSize: 16,
  color: '#e7dcc7',
  marginBottom: 14,
};

const ClaimSignIn: React.FC = () => {
  type Mode = 'choices' | 'email' | 'code' | 'password';
  const [mode, setMode] = useState<Mode>('choices');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const primaryBtn =
    'w-full min-h-[48px] font-label text-xs uppercase tracking-[0.18em] font-semibold py-3.5 rounded-xl transition-opacity disabled:opacity-40';
  const doorBtn =
    'w-full min-h-[48px] flex items-center justify-center gap-2.5 font-reading text-[15px] py-3.5 rounded-full transition-colors disabled:opacity-40';

  const doGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      const returnTo = window.location.pathname + window.location.search;
      const { error: e } = await signInWithGoogle(returnTo);
      if (e) {
        setBusy(false);
        setError('Google is not available right now. Ask for a code below.');
      }
    } catch {
      setBusy(false);
      setError('Could not start Google. Ask for a code below.');
    }
  };

  const send = async () => {
    if (!email.trim()) {
      setMode('email');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: e } = await sendSignInCode(email.trim());
      setBusy(false);
      if (e) {
        setError('Could not send the code. Check the email and try again.');
        return;
      }
      setMode('code');
    } catch {
      setBusy(false);
      setError('Could not reach the server. Check your connection.');
    }
  };

  const verify = async () => {
    if (code.trim().length < 6) return;
    setBusy(true);
    setError(null);
    try {
      const { error: e } = await verifySignInCode(email.trim(), code.trim());
      // On success the session flips and Phase A binds the piece, stay busy
      // through the transition so the button does not re-arm.
      if (e) {
        setBusy(false);
        setError('That code did not match. Try again, or request a new one.');
      }
    } catch {
      setBusy(false);
      setError('Could not reach the server. Check your connection.');
    }
  };

  const doPassword = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const { error: e } = await signInWithPassword(email.trim(), password);
      if (e) {
        setBusy(false);
        setError('That did not match. Try again, or ask for a code instead.');
      }
    } catch {
      setBusy(false);
      setError('Could not reach the server. Check your connection.');
    }
  };

  return (
    <div className="text-center">
      {error && (
        <p
          className="font-display text-[15px] mb-5"
          style={{ color: 'rgba(214,171,138,0.9)' }}
        >
          {error}
        </p>
      )}

      {mode === 'choices' && (
        <>
          <button
            type="button"
            onClick={doGoogle}
            disabled={busy}
            className={doorBtn}
            style={GOLD_BUTTON}
          >
            <GoogleMark /> Claim with Google
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode('email');
            }}
            disabled={busy}
            className={`${doorBtn} mt-3`}
            style={{
              background: 'transparent',
              color: '#e7dcc7',
              border: '1px solid rgba(196,170,124,0.32)',
            }}
          >
            Email me a claim code
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setMode('password');
            }}
            className="mt-5 font-label text-[10px] uppercase tracking-[0.18em] text-wood-500 hover:text-bronze-300 transition-colors"
          >
            Use a password instead
          </button>
        </>
      )}

      {mode === 'email' && (
        <>
          <input
            type="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            style={authField}
            placeholder="you@example.com"
          />
          <button
            type="button"
            onClick={send}
            disabled={busy || !email.trim()}
            className={primaryBtn}
            style={GOLD_BUTTON}
          >
            {busy ? 'Sending…' : 'Send the code'}
          </button>
          <BackLink onClick={() => { setError(null); setMode('choices'); }} />
        </>
      )}

      {mode === 'code' && (
        <>
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => e.key === 'Enter' && verify()}
            style={{ ...authField, textAlign: 'center', letterSpacing: '0.3em' }}
            placeholder="123456"
          />
          <button
            type="button"
            onClick={verify}
            disabled={busy || code.length < 6}
            className={primaryBtn}
            style={GOLD_BUTTON}
          >
            {busy ? 'Claiming…' : 'Claim your piece'}
          </button>
          <BackLink onClick={() => { setError(null); setCode(''); setMode('choices'); }} />
        </>
      )}

      {mode === 'password' && (
        <>
          <input
            type="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={authField}
            placeholder="you@example.com"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doPassword()}
            style={authField}
            placeholder="Your password"
          />
          <button
            type="button"
            onClick={doPassword}
            disabled={busy || !email.trim() || !password}
            className={primaryBtn}
            style={GOLD_BUTTON}
          >
            {busy ? 'Claiming…' : 'Claim your piece'}
          </button>
          <button
            type="button"
            onClick={() => { setError(null); send(); }}
            disabled={busy || !email.trim()}
            className="mt-4 block mx-auto font-label text-[10px] uppercase tracking-[0.18em] text-bronze-300 hover:text-bronze-200 transition-colors disabled:opacity-40"
          >
            Email me a code instead
          </button>
          <BackLink onClick={() => { setError(null); setMode('choices'); }} />
        </>
      )}
    </div>
  );
};

const BackLink: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="mt-4 block mx-auto font-label text-[10px] uppercase tracking-[0.2em] text-wood-500 hover:text-bronze-300 transition-colors"
  >
    Back
  </button>
);

const GoogleMark: React.FC = () => (
  <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.3 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.8-9.8 6.8-17.4z" />
    <path fill="#FBBC05" d="M10.4 28.3c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.8-6.1C.9 16.1 0 19.9 0 23.7s.9 7.6 2.6 10.7l7.8-6.1z" />
    <path fill="#34A853" d="M24 47.4c6.2 0 11.4-2 15.2-5.5l-7.3-5.7c-2 1.4-4.7 2.3-7.9 2.3-6.3 0-11.7-3.8-13.6-9.3l-7.8 6.1C6.5 42 14.6 47.4 24 47.4z" />
  </svg>
);

/* One of the two "where should this dream live" options: a stage-seated radio,
   the gold-filled dot on selection matching the Toggle's stage conventions. */
const StageRadio: React.FC<{
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}> = ({ selected, onSelect, disabled, children }) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    onClick={onSelect}
    disabled={disabled}
    className="flex items-start gap-3 w-full text-left py-2.5 min-h-[44px] focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 disabled:opacity-60"
  >
    <span
      aria-hidden
      className="mt-1 shrink-0 inline-flex items-center justify-center w-[18px] h-[18px] rounded-full border transition-colors"
      style={{ borderColor: selected ? ATLAS_GOLD : 'rgba(196,170,124,0.4)' }}
    >
      <span
        className="w-2 h-2 rounded-full transition-opacity"
        style={{ background: ATLAS_GOLD, opacity: selected ? 1 : 0 }}
      />
    </span>
    <span
      className="font-display text-[15px] leading-snug"
      style={{ color: selected ? '#ece2cf' : 'rgba(203,191,168,0.72)' }}
    >
      {children}
    </span>
  </button>
);

/* The anchoring beat: the committed dream settles into ledger typography, a
   quiet half-second, no spectacle. Reduced motion gets a plain crossfade. */
const AnchorSettle: React.FC<{ text: string }> = ({ text }) => {
  const [reduced] = useState(prefersReducedMotion);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <p
      className="font-display text-xl sm:text-2xl leading-snug text-center mx-auto whitespace-pre-line"
      style={{
        fontFamily: 'var(--font-display)',
        color: '#f0ece4',
        maxWidth: '32rem',
        opacity: settled ? 1 : reduced ? 0 : 0.35,
        letterSpacing: reduced ? '0.01em' : settled ? '0.01em' : '0.16em',
        transition: reduced
          ? 'opacity 320ms ease'
          : 'opacity 520ms ease, letter-spacing 520ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      {text}
    </p>
  );
};

const StewardClaim: React.FC = () => {
  const { isLoaded, isSignedIn, email, fetchAuthed } = useAccount();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [beat, setBeat] = useState<Beat>('arrival');
  const [arrivalStatus, setArrivalStatus] = useState<'signin' | 'claiming'>('signin');
  const [entries, setEntries] = useState<ClaimEntry[]>([]);
  const [creatorMessage, setCreatorMessage] = useState<string | undefined>();

  // Ring 2 map-presence choice. Private (false) is the default: placing a light
  // on the world map is an active opt-in. Committed with the dream in one POST.
  const [mapPresence, setMapPresence] = useState(false);
  const [dreamText, setDreamText] = useState('');
  const [committedDream, setCommittedDream] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dreamError, setDreamError] = useState<string | null>(null);
  const dreamId = useId();

  /* Replay / rehearsal entry: /atlas/claim?ceremony=<pieceId[:edition]> renders
     the ignition beat directly from public data, so a steward can watch their
     ignition again from the book (LegacyBook links here) and the sequence can
     be tuned without a live claim. No creator message travels this path. */
  const rehearse = searchParams.get('ceremony');

  /* Piece context: /atlas/claim?piece=<pieceId[:edition]>, set by a piece
     page's primary CTA. Names the piece being claimed on arrival (its plate and
     title), and turns the no-record dead-end into the request-stewardship
     hand-off for that piece. */
  const pieceContext = (() => {
    const raw = searchParams.get('piece');
    if (!raw) return null;
    const [pid, ped] = raw.split(':');
    if (!pid) return null;
    const editionNumber =
      ped !== undefined && /^\d+$/.test(ped) ? parseInt(ped, 10) : undefined;
    return { pieceId: pid, editionNumber };
  })();

  // The piece named by the URL, resolved for the arrival plate + title.
  const contextArt = pieceContext
    ? FULL_ARCHIVE.find((a) => a.id === pieceContext.pieceId) ?? null
    : null;

  // Phase A: bind on arrival. Single-fire via the ref guard (see the long note
  // on its history: keying off in-flight status re-triggered the cleanup and
  // killed the response). `claimAttempt` is state so the error beat's "try
  // again" can re-fire it: bumping it re-runs the effect with the guard reset.
  const claimFired = useRef(false);
  const [claimAttempt, setClaimAttempt] = useState(0);
  useEffect(() => {
    if (!isLoaded || !isSignedIn || claimFired.current) return;
    claimFired.current = true;
    let cancelled = false;
    (async () => {
      setArrivalStatus('claiming');
      try {
        const res = await fetchAuthed('/api/atlas/steward/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (cancelled) return;
        if (res.ok) {
          const data: ClaimResponse = await res.json();
          if (cancelled) return;
          const claimed = data.claimed ?? [];
          if (claimed.some((c) => c.needsConsent)) {
            setEntries(claimed);
            setBeat('recognition');
            return;
          }
          // Already consented (a re-claim): no ceremony, straight to the book.
          navigate('/atlas/edit', { replace: true });
          return;
        }
        if (res.status === 404) {
          setBeat('no-record');
        } else {
          setBeat('error');
        }
      } catch {
        if (!cancelled) setBeat('error');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, claimAttempt, fetchAuthed, navigate]);

  // Failure honesty (law 6): re-fire Phase A from the error beat.
  const retryPhaseA = () => {
    claimFired.current = false;
    setEntries([]);
    setCreatorMessage(undefined);
    setArrivalStatus('claiming');
    setBeat('arrival');
    setClaimAttempt((n) => n + 1);
  };

  // The piece the ceremony is about: the first awaiting consent, else the
  // first claimed.
  const primary = entries.find((e) => e.needsConsent) ?? entries[0] ?? null;
  const art = primary
    ? FULL_ARCHIVE.find((a) => a.id === primary.steward.pieceId)
    : undefined;

  // Phase B: the single consent + inscription POST. Consent (map presence) and
  // the dream travel together, exactly as before. Returns whether it landed;
  // the caller advances to ignition (after the anchoring settle) on success.
  const runClaim = async (inscription?: string): Promise<boolean> => {
    setSubmitting(true);
    setDreamError(null);
    try {
      const res = await fetchAuthed('/api/atlas/steward/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consent: { ring2MapPresence: mapPresence },
          ...(inscription ? { firstInscription: inscription } : {}),
        }),
      });
      if (!res.ok) {
        setDreamError('Something went wrong. Please try again.');
        return false;
      }
      const data: ClaimResponse = await res.json().catch(() => ({}) as ClaimResponse);
      setCreatorMessage(data.creatorMessage);
      return true;
    } catch {
      setDreamError('Something went wrong. Please try again.');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  // "inscribe later": commit with no dream, straight to ignition.
  const inscribeLater = async () => {
    const ok = await runClaim(undefined);
    if (ok) setBeat('ignition');
  };

  // "inscribe": the dream settles into the ledger (anchoring beat) while the
  // POST is in flight; ignition begins once both the settle and the POST have
  // landed. On failure we fall back to the dream beat with its error.
  const inscribeDream = async () => {
    const text = dreamText.trim();
    if (!text) {
      await inscribeLater();
      return;
    }
    setCommittedDream(text);
    setBeat('anchoring');
    const settleMs = prefersReducedMotion() ? 300 : 560;
    const [ok] = await Promise.all([
      runClaim(text),
      new Promise<void>((resolve) => setTimeout(resolve, settleMs)),
    ]);
    setBeat(ok ? 'ignition' : 'dream');
  };

  // ── Dev / steward rehearsal + replay ──
  if (rehearse) {
    const [rid, redition] = rehearse.split(':');
    return (
      <ClaimCeremony
        pieceId={rid}
        editionNumber={redition ? Number(redition) : undefined}
        onDone={() => navigate('/atlas/edit', { replace: true })}
      />
    );
  }

  // ── Ignition (+ the creator's message beat, inside ClaimCeremony) ──
  if (beat === 'ignition' && primary) {
    return (
      <ClaimCeremony
        pieceId={primary.steward.pieceId}
        editionNumber={primary.steward.editionNumber}
        creatorMessage={creatorMessage}
        onDone={() => navigate('/atlas/edit', { replace: true })}
      />
    );
  }

  // ── No-record: paper rendering, the RequestStewardship hand-off, and the
  //    homecoming door (law 6: nothing dead-ends). Not the dark stage. ──
  if (beat === 'no-record') {
    return (
      <section className="min-h-screen bg-paper-50 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md text-center">
          <p className="font-display text-[1.0625rem] leading-relaxed text-stone-700 mb-3">
            We don&apos;t have a piece bound to{' '}
            <span className="text-wood-900">{email ?? 'your email'}</span> yet.
          </p>
          {pieceContext ? (
            <div className="text-left">
              <p className="font-display text-sm text-stone-600">
                If this piece came to you another way, an auction, a gift, an
                inheritance, request stewardship here and the current keeper, or
                Adrian, will approve it.
              </p>
              <RequestStewardship
                pieceId={pieceContext.pieceId}
                editionNumber={pieceContext.editionNumber}
                leadIn={null}
              />
            </div>
          ) : (
            <p className="font-display text-sm text-stone-600 mb-5">
              If you hold one of Adrian&apos;s pieces, scan the code on its
              back, or find it on the map, and request stewardship from the
              piece&apos;s own page.
            </p>
          )}
          <div className="mt-8 pt-6 border-t border-wood-200 flex flex-col items-center gap-4">
            <Link
              to="/atlas/homecoming"
              className="font-label text-[11px] uppercase tracking-[0.18em] font-semibold text-bronze-700 hover:text-bronze-600 transition-colors"
            >
              Holding a piece we do not know? Bring it home →
            </Link>
            {!pieceContext && (
              <Link
                to="/atlas"
                className="font-label text-[11px] uppercase tracking-[0.18em] text-wood-500 hover:text-wood-800 transition-colors"
              >
                Find it on the map →
              </Link>
            )}
          </div>
        </div>
      </section>
    );
  }

  // ── The one stage: arrival → recognition → dream → anchoring ──
  const skipHandler: (() => void) | undefined =
    beat === 'recognition'
      ? () => setBeat('dream')
      : beat === 'dream'
      ? () => void inscribeLater()
      : undefined;

  const brightness =
    beat === 'anchoring' ? 0.82 : beat === 'dream' ? 0.62 : beat === 'recognition' ? 0.52 : 0.34;

  const codeLabel =
    art
      ? pieceCode({
          pieceId: art.id,
          series: art.series,
          category: art.category,
          cardNumber: art.cardNumber,
        })
      : null;

  return (
    <CeremonyShell brightness={brightness} onSkip={skipHandler} skipDisabled={submitting}>
      {beat === 'error' && (
        <FadeIn key="error" className="text-center">
          <p
            className="font-display text-[1.0625rem] leading-relaxed mb-6"
            style={{ color: 'rgba(203,191,168,0.86)' }}
          >
            Something went wrong reaching your piece. Please try again.
          </p>
          <div className="flex flex-col items-center gap-5">
            <button
              type="button"
              onClick={retryPhaseA}
              className="min-h-[48px] px-10 font-label text-xs uppercase tracking-[0.2em] font-semibold rounded-xl transition-opacity hover:opacity-90"
              style={GOLD_BUTTON}
            >
              try again
            </button>
            <Link
              to="/atlas"
              className="font-label text-[11px] uppercase tracking-[0.18em] text-bronze-300 hover:text-bronze-200 transition-colors"
            >
              Back to the map
            </Link>
          </div>
        </FadeIn>
      )}

      {beat === 'arrival' && (
        <FadeIn key={`arrival:${arrivalStatus}`} className="text-center">
          {contextArt && (
            <div className="mx-auto mb-9" style={{ maxWidth: 208, opacity: 0.82 }}>
              <ArtworkPlate
                src={contextArt.coverImage ? img(contextArt.coverImage, { w: 560, crop: 'fit' }) : null}
                alt={contextArt.title.replace(/\s*-\s*\d+\s*$/, '')}
                title={contextArt.title.replace(/\s*-\s*\d+\s*$/, '')}
                aspect="square"
                loading="eager"
                imgStyle={{ filter: 'drop-shadow(0 24px 48px rgba(0,0,0,0.55))' }}
              />
            </div>
          )}
          {contextArt ? (
            <>
              <h1
                className="text-3xl sm:text-[2.25rem] leading-tight font-medium mb-4"
                style={{
                  fontFamily: 'var(--font-display)',
                  color: '#ece2cf',
                  letterSpacing: '0.01em',
                }}
              >
                You are claiming {contextArt.title.replace(/\s*-\s*\d+\s*$/, '')}.
              </h1>
              <p
                className="font-display text-lg sm:text-xl leading-snug mb-10"
                style={{ color: 'rgba(203,191,168,0.8)', fontFamily: 'var(--font-display)' }}
              >
                It is ready to receive your dream.
              </p>
            </>
          ) : (
            <h1
              className="text-3xl sm:text-[2.25rem] leading-tight font-medium mb-10"
              style={{
                fontFamily: 'var(--font-display)',
                color: '#ece2cf',
                letterSpacing: '0.01em',
              }}
            >
              The world is ready to receive your dream.
            </h1>
          )}
          {arrivalStatus === 'claiming' || isSignedIn || !isLoaded ? (
            <p
              className="font-display text-base"
              style={{ color: 'rgba(203,191,168,0.7)' }}
            >
              Finding your piece…
            </p>
          ) : (
            <ClaimSignIn />
          )}
        </FadeIn>
      )}

      {beat === 'recognition' && primary && (
        <FadeIn key="recognition" className="text-center">
          {art?.coverImage && (
            <div className="mx-auto mb-8" style={{ maxWidth: 300 }}>
              <img
                src={img(art.coverImage, { w: 720, crop: 'fit' })}
                alt={art.title}
                className="w-full h-auto"
                style={{ filter: 'drop-shadow(0 24px 48px rgba(0,0,0,0.55))' }}
              />
            </div>
          )}
          {codeLabel && (
            <p
              className="font-label text-[11px] uppercase tracking-[0.28em] mb-6"
              style={{ color: 'rgba(196,170,124,0.8)' }}
            >
              {codeLabel}
            </p>
          )}
          <p
            className="font-display text-xl sm:text-2xl leading-snug mb-10"
            style={{ color: '#ece2cf', fontFamily: 'var(--font-display)' }}
          >
            Your dream will become its light.
          </p>
          <button
            type="button"
            onClick={() => setBeat('dream')}
            className="min-h-[48px] px-10 font-label text-xs uppercase tracking-[0.2em] font-semibold rounded-xl transition-opacity hover:opacity-90"
            style={GOLD_BUTTON}
          >
            begin
          </button>
        </FadeIn>
      )}

      {beat === 'anchoring' && (
        <div key="anchoring">
          <AnchorSettle text={committedDream} />
        </div>
      )}

      {beat === 'dream' && (
        <FadeIn key="dream">
          <p
            className="font-label text-[11px] uppercase tracking-[0.28em] text-center mb-5"
            style={{ color: 'rgba(196,170,124,0.8)' }}
          >
            the dream
          </p>
          <label
            htmlFor={dreamId}
            className="block font-display text-xl sm:text-2xl leading-snug text-center mb-4"
            style={{ color: '#ece2cf', fontFamily: 'var(--font-display)' }}
          >
            What should this piece hold for you?
          </label>
          <p
            className="font-display text-[15px] leading-relaxed text-center mb-7"
            style={{ color: 'rgba(203,191,168,0.68)' }}
          >
            Not a task. A guiding principle, something that could steer a year or
            more of your life. You can tend it each year in the month around your
            birthday, and it stays with the piece for as long as the piece is
            kept.
          </p>
          <textarea
            id={dreamId}
            value={dreamText}
            onChange={(e) => setDreamText(e.target.value)}
            rows={4}
            maxLength={2000}
            disabled={submitting}
            placeholder="Write it here."
            className="w-full bg-transparent border-b px-1 py-3 font-display text-lg leading-relaxed focus:outline-none disabled:opacity-60"
            style={{
              color: '#f0ece4',
              borderColor: 'rgba(196,170,124,0.4)',
              caretColor: ATLAS_GOLD,
              fontFamily: 'var(--font-display)',
            }}
          />

          {/* Ring 1, one quiet line under the textarea. The dream-beat promise
              (Adrian, 2026-07-18): the bond is honest — the connection stays
              through every hand, and the dream can always be tended. */}
          <p
            className="mt-4 text-center font-display text-[13px] leading-relaxed"
            style={{ color: 'rgba(203,191,168,0.6)' }}
          >
            Your dream and your art stay connected, through every hand this
            piece ever passes to. Once a year you can tend it or set a new one;
            nothing is lost.
          </p>

          {/* Where the dream lives: the one map-presence question, asked once.
              Private is the default. This is the sole place the flow asks it. */}
          <div
            role="radiogroup"
            aria-label="Where should this dream live?"
            className="mt-8 pt-7 border-t"
            style={{ borderColor: 'rgba(196,170,124,0.22)' }}
          >
            <p
              className="font-display text-lg leading-snug mb-3"
              style={{ color: '#ece2cf', fontFamily: 'var(--font-display)' }}
            >
              Where should this dream live?
            </p>
            <StageRadio
              selected={mapPresence}
              onSelect={() => setMapPresence(true)}
              disabled={submitting}
            >
              As a light on the world map, city only, first name never shown
            </StageRadio>
            <StageRadio
              selected={!mapPresence}
              onSelect={() => setMapPresence(false)}
              disabled={submitting}
            >
              Privately, in the piece&apos;s book
            </StageRadio>
          </div>

          <div className="h-6 mt-4 text-center" aria-live="polite">
            {dreamError && (
              <span
                className="font-display text-sm"
                style={{ color: 'rgba(214,171,138,0.9)' }}
              >
                {dreamError}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => void inscribeDream()}
            disabled={submitting}
            className="w-full min-h-[48px] font-label text-xs uppercase tracking-[0.2em] font-semibold py-3.5 rounded-xl transition-opacity hover:opacity-90 disabled:opacity-40"
            style={GOLD_BUTTON}
          >
            {submitting ? 'Inscribing…' : 'inscribe'}
          </button>
          <button
            type="button"
            onClick={() => void inscribeLater()}
            disabled={submitting}
            className="mt-4 block mx-auto font-label text-[10px] uppercase tracking-[0.2em] text-wood-500 hover:text-bronze-300 transition-colors disabled:opacity-40"
          >
            inscribe later
          </button>
        </FadeIn>
      )}
    </CeremonyShell>
  );
};

export default StewardClaim;
