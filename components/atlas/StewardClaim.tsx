import React, { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAccount } from '../../lib/account/useAccount';
import {
  sendSignInCode,
  verifySignInCode,
  signInWithPassword,
  signInWithGoogle,
} from '../../lib/account/authClient';
import type { PieceRecord, StewardRecord } from '../../types';
import { FULL_ARCHIVE } from '../../data/mockData';
import { img } from '../../utils/cloudinary';
import { pieceCode } from '../../utils/pieceCode';
import ConsentRings from './ConsentRings';
import type { ConsentChoice } from './ConsentRings';
import ClaimCeremony from './ClaimCeremony';
import RequestStewardship from './RequestStewardship';

/**
 * Steward claim, /atlas/claim, rebuilt as ONE continuous ceremony (M2+).
 *
 * The whole claim is a single persistent stage: a full-bleed dark shell with a
 * warm deep-brown vignette that never swaps. The beats cross-fade in place
 * rather than paging between screens, and a quiet lowercase "skip" jumps a beat
 * forward wherever forward has meaning. The beats:
 *
 *   arrival    , "A piece of the world is waiting for you." + the sign-in,
 *                 seated in the shell, spoken as "claim", never "log in".
 *   recognition, the piece's artwork as an object, its code, "begin".
 *   consent    , ConsentRings (stage variant): Ring 1 covenant + the Ring 2
 *                 show-on-the-map choice. Unchanged semantics + endpoints.
 *   dream      , the first inscription: "What should this piece hold for
 *                 you?" The show/keep-private choice rides here too, at the
 *                 moment of committing. "inscribe" / "inscribe later".
 *   ignition   , ClaimCeremony: the Founding Lights replay, yours last, the
 *                 ordinal spoken. Entered only after the dream completes.
 *   (the creator's message is the ClaimCeremony's own final beat, revealed
 *    after the light is lit, never before ignition.)
 *
 * The claim's two server phases are unchanged. Phase A (bind) fires on a
 * signed-in arrival. Phase B (consent capture) still carries `{ consent,
 * firstInscription? }` in a single POST, but that POST is now deferred to the
 * end of the dream beat, so the map choice (consent) and the dream
 * (firstInscription) travel together exactly as before, and ignition only
 * begins once it lands. The Phase B response also carries the creator's
 * message, which the ceremony holds back until after ignition.
 *
 * The no-record branch (a 404 from Phase A) keeps its original rendering and
 * the RequestStewardship hand-off, reachable exactly as before.
 */

const VIGNETTE =
  'radial-gradient(120% 90% at 50% 36%, #241b12 0%, #191410 46%, rgb(15,13,11) 100%)';

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
  | 'consent'
  | 'dream'
  | 'ignition'
  | 'no-record'
  | 'error';

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

/** The persistent stage. Full-bleed, warm, always present behind the beats. */
const CeremonyShell: React.FC<{
  children: React.ReactNode;
  onSkip?: () => void;
  skipDisabled?: boolean;
}> = ({ children, onSkip, skipDisabled }) => (
  <div
    className="fixed inset-0 overflow-hidden"
    style={{ background: VIGNETTE, zIndex: 200 }}
  >
    <div className="absolute inset-0 flex items-center justify-center px-6 py-16 overflow-y-auto">
      <div className="w-full max-w-md">{children}</div>
    </div>
    {onSkip && (
      <button
        type="button"
        onClick={onSkip}
        disabled={skipDisabled}
        className="absolute top-5 right-6 font-label text-[10px] uppercase tracking-[0.2em] text-wood-500 hover:text-bronze-300 transition-colors disabled:opacity-40"
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
  fontFamily: 'var(--font-ui)',
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
          className="font-reading text-[15px] mb-5"
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
            style={{ background: '#c4aa7c', color: '#241e17' }}
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
            style={{ background: '#c4aa7c', color: '#241e17' }}
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
            style={{ background: '#c4aa7c', color: '#241e17' }}
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
            style={{ background: '#c4aa7c', color: '#241e17' }}
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

const StewardClaim: React.FC = () => {
  const { isLoaded, isSignedIn, email, fetchAuthed } = useAccount();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [beat, setBeat] = useState<Beat>('arrival');
  const [arrivalStatus, setArrivalStatus] = useState<'signin' | 'claiming'>('signin');
  const [entries, setEntries] = useState<ClaimEntry[]>([]);
  const [creatorMessage, setCreatorMessage] = useState<string | undefined>();

  // Ring 2 map-presence choice, lifted to the flow so the consent beat can set
  // it and the dream beat commits it in the same Phase B POST.
  const [mapPresence, setMapPresence] = useState(false);
  const [dreamText, setDreamText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dreamError, setDreamError] = useState<string | null>(null);
  const dreamId = useId();

  /* Dev-only rehearsal: /atlas/claim?ceremony=<pieceId[:edition]> renders the
     ignition beat directly so it can be tuned without a live claim. */
  const rehearse = import.meta.env.DEV ? searchParams.get('ceremony') : null;

  /* Piece context: /atlas/claim?piece=<pieceId[:edition]>, set by a piece
     page's primary CTA. Read ONLY by the no-record branch, where it turns the
     dead-end into the request-stewardship hand-off for that piece. */
  const pieceContext = (() => {
    const raw = searchParams.get('piece');
    if (!raw) return null;
    const [pid, ped] = raw.split(':');
    if (!pid) return null;
    const editionNumber =
      ped !== undefined && /^\d+$/.test(ped) ? parseInt(ped, 10) : undefined;
    return { pieceId: pid, editionNumber };
  })();

  // Phase A: bind on arrival. Single-fire, ref-guarded (see the long note on
  // this guard's history retained from the prior implementation: keying off
  // `status` re-triggered the cleanup and killed the in-flight response).
  const claimFired = useRef(false);
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
  }, [isLoaded, isSignedIn, fetchAuthed, navigate]);

  // The piece the ceremony is about: the first awaiting consent, else the
  // first claimed.
  const primary = entries.find((e) => e.needsConsent) ?? entries[0] ?? null;
  const art = primary
    ? FULL_ARCHIVE.find((a) => a.id === primary.steward.pieceId)
    : undefined;

  // Phase B: the single consent + inscription POST, deferred to the end of the
  // dream beat. Consent (map presence) and the dream travel together, exactly
  // as before. On success, ignition begins; the creator's message rides in the
  // response and is held for the ceremony's final beat.
  const submitClaim = async (inscription?: string) => {
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
        return;
      }
      const data: ClaimResponse = await res.json().catch(() => ({}) as ClaimResponse);
      setCreatorMessage(data.creatorMessage);
      setBeat('ignition');
    } catch {
      setDreamError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Dev rehearsal ──
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

  // ── No-record: kept as the original rendering, with the RequestStewardship
  //    hand-off reachable exactly as before. Not the dark stage. ──
  if (beat === 'no-record') {
    return (
      <section className="min-h-screen bg-paper-50 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md text-center">
          <p className="font-reading text-[1.0625rem] leading-relaxed text-stone-700 mb-3">
            We don&apos;t have a piece bound to{' '}
            <span className="text-wood-900">{email ?? 'your email'}</span> yet.
          </p>
          {pieceContext ? (
            <div className="text-left">
              <p className="font-reading text-sm text-stone-600">
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
            <>
              <p className="font-reading text-sm text-stone-600 mb-5">
                If you hold one of Adrian&apos;s pieces, scan the code on its
                back, or find it on the map, and request stewardship from the
                piece&apos;s own page.
              </p>
              <Link
                to="/atlas"
                className="font-label text-[11px] uppercase tracking-[0.18em] font-semibold text-bronze-700 hover:text-bronze-600 transition-colors"
              >
                Find it on the map →
              </Link>
            </>
          )}
        </div>
      </section>
    );
  }

  // ── The one stage: arrival → recognition → consent → dream ──
  const skipHandler: (() => void) | undefined =
    beat === 'recognition'
      ? () => setBeat('consent')
      : beat === 'consent'
      ? () => setBeat('dream')
      : beat === 'dream'
      ? () => submitClaim(undefined)
      : undefined;

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
    <CeremonyShell onSkip={skipHandler} skipDisabled={submitting}>
      {beat === 'error' && (
        <FadeIn key="error" className="text-center">
          <p
            className="font-reading text-[1.0625rem] leading-relaxed mb-6"
            style={{ color: 'rgba(203,191,168,0.86)' }}
          >
            Something went wrong reaching your piece. Please try again.
          </p>
          <Link
            to="/atlas"
            className="font-label text-[11px] uppercase tracking-[0.18em] font-semibold text-bronze-300 hover:text-bronze-200 transition-colors"
          >
            Back to the map
          </Link>
        </FadeIn>
      )}

      {beat === 'arrival' && (
        <FadeIn key={`arrival:${arrivalStatus}`} className="text-center">
          <h1
            className="text-3xl sm:text-[2.25rem] leading-tight font-medium mb-10"
            style={{
              fontFamily: 'var(--font-display)',
              color: '#ece2cf',
              letterSpacing: '0.01em',
            }}
          >
            A piece of the world is waiting for you.
          </h1>
          {arrivalStatus === 'claiming' || isSignedIn || !isLoaded ? (
            <p
              className="font-reading text-base"
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
            className="font-reading text-xl sm:text-2xl leading-snug mb-10"
            style={{ color: '#ece2cf', fontFamily: 'var(--font-reading)' }}
          >
            This piece has been waiting to meet you.
          </p>
          <button
            type="button"
            onClick={() => setBeat('consent')}
            className="min-h-[48px] px-10 font-label text-xs uppercase tracking-[0.2em] font-semibold rounded-xl transition-opacity hover:opacity-90"
            style={{ background: '#c4aa7c', color: '#241e17' }}
          >
            begin
          </button>
        </FadeIn>
      )}

      {beat === 'consent' && (
        <FadeIn key="consent">
          <ConsentRings
            variant="stage"
            showInscription={false}
            pieceTitle={art?.title}
            initialMapPresence={mapPresence}
            submitLabel="continue"
            submitting={false}
            error={null}
            onSubmit={(choice: ConsentChoice) => {
              setMapPresence(choice.ring2MapPresence);
              setBeat('dream');
            }}
          />
        </FadeIn>
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
            className="block font-reading text-xl sm:text-2xl leading-snug text-center mb-4"
            style={{ color: '#ece2cf', fontFamily: 'var(--font-display)' }}
          >
            What should this piece hold for you?
          </label>
          <p
            className="font-reading text-[15px] leading-relaxed text-center mb-7"
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
            className="w-full bg-transparent border-b px-1 py-3 font-reading text-lg leading-relaxed focus:outline-none disabled:opacity-60"
            style={{
              color: '#f0ece4',
              borderColor: 'rgba(196,170,124,0.4)',
              caretColor: '#c4aa7c',
              fontFamily: 'var(--font-reading)',
            }}
          />

          {/* The show/keep-private choice rides here, at the moment of
              committing: the same Ring 2 map presence, restated compactly. */}
          <button
            type="button"
            role="switch"
            aria-checked={mapPresence}
            aria-label="Show this piece as a light on the world map"
            onClick={() => setMapPresence((v) => !v)}
            disabled={submitting}
            className="mt-7 mx-auto flex items-center gap-3 min-h-[44px] font-reading text-[15px] disabled:opacity-60"
            style={{ color: 'rgba(203,191,168,0.86)' }}
          >
            <span
              aria-hidden="true"
              className="relative inline-block w-11 h-6 border transition-colors"
              style={
                mapPresence
                  ? { background: '#c4aa7c', borderColor: '#d4b88a' }
                  : { background: 'rgba(60,50,38,0.6)', borderColor: 'rgba(196,170,124,0.35)' }
              }
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 transition-transform ${
                  mapPresence ? 'translate-x-5' : 'translate-x-0'
                }`}
                style={{ background: mapPresence ? '#241e17' : '#e7dcc7' }}
              />
            </span>
            <span>{mapPresence ? 'Show on the atlas' : 'Keep this private'}</span>
          </button>

          {mapPresence && (
            <p
              className="mt-3 text-center font-reading text-[13px] leading-relaxed"
              style={{ color: 'rgba(203,191,168,0.6)' }}
            >
              Your light and its dream, visible to all.
            </p>
          )}

          <div className="h-6 mt-4 text-center" aria-live="polite">
            {dreamError && (
              <span
                className="font-reading text-sm"
                style={{ color: 'rgba(214,171,138,0.9)' }}
              >
                {dreamError}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => submitClaim(dreamText.trim() || undefined)}
            disabled={submitting}
            className="w-full min-h-[48px] font-label text-xs uppercase tracking-[0.2em] font-semibold py-3.5 rounded-xl transition-opacity hover:opacity-90 disabled:opacity-40"
            style={{ background: '#c4aa7c', color: '#241e17' }}
          >
            {submitting ? 'Inscribing…' : 'inscribe'}
          </button>
          <button
            type="button"
            onClick={() => submitClaim(undefined)}
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
