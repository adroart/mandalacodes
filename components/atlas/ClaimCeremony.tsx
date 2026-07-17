/**
 * The claim ceremony: shown once, right after a steward's consent is
 * captured. The whole founding sequence replays on the globe: every light
 * that came before ignites in claim order, and because the new steward's
 * piece carries the highest ordinal, their light ignites last. The camera
 * then swings to face it, the ring settles around it, and the ordinal is
 * spoken: "You are the 12th light."
 *
 * The ceremony never blocks the claim. If the fresh atlas state can't be
 * fetched (offline, cache lag), we skip straight to the book.
 */

import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { GlobeNode } from './Globe';
import { CITIES_BY_ID } from '../../data/cities';
import { FULL_ARCHIVE } from '../../data/mockData';
import { buildKinshipIndex } from '../../utils/kinship';
import { ulCardNumber } from '../../utils/universalLanguage';
import type { PublicAtlasState } from '../../types';

const Globe3D = lazy(() => import('./three/Globe3D'));

export interface ClaimCeremonyProps {
  /** The claimed piece (first of the batch when several bound at once). */
  pieceId: string;
  editionNumber?: number;
  /** The creator's message that travelled with this piece, delivered in the
   *  Phase B claim response. Revealed in the final beat, after the light has
   *  ignited and the ordinal has settled, never before. Absent in the
   *  dev rehearsal (?ceremony=) and when the response carried none. */
  creatorMessage?: string;
  /** Leave the ceremony: lands in the piece's book. */
  onDone: () => void;
}

function ordinalWord(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

type Phase = 'igniting' | 'reveal' | 'ready' | 'message';

const ClaimCeremony: React.FC<ClaimCeremonyProps> = ({ pieceId, editionNumber, creatorMessage, onDone }) => {
  const [state, setState] = useState<PublicAtlasState | null>(null);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<Phase>('igniting');
  const [selected, setSelected] = useState<string | null>(null);

  const key = `${pieceId}:${editionNumber ?? 0}`;

  // Fresh fetch first (the claim just changed the record), falling back to
  // the shared loader (session cache or local seed) if it is unreachable.
  // The ordinal may then be missing, and the copy degrades gracefully.
  useEffect(() => {
    let active = true;
    fetch('/api/atlas')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('atlas fetch'))))
      .then((data: { state?: PublicAtlasState }) => {
        if (!active) return;
        if (data?.state) setState(data.state);
        else throw new Error('empty state');
      })
      .catch(async () => {
        try {
          const { loadAtlasState } = await import('../../lib/atlas/state');
          const s = await loadAtlasState();
          if (active) setState(s);
        } catch {
          if (active) setFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // The ceremony is a gift, not a gate: if the state never arrives, move on.
  useEffect(() => {
    if (failed) onDone();
  }, [failed, onDone]);

  const nodes: GlobeNode[] = useMemo(() => {
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

  const mine = useMemo(
    () => state?.pieces.find((p) => `${p.pieceId}:${p.editionNumber ?? 0}` === key) ?? null,
    [state, key],
  );
  const myOrdinal = mine?.claimOrdinal;
  const myTitle = FULL_ARCHIVE.find((a) => a.id === pieceId)?.title ?? pieceId;
  const onGlobe = nodes.some((n) => n.id === key);

  /* Sequence: ignition runs its own clock inside the globe (~0.9s lead +
     ~0.35s per light). Time the reveal off the same arithmetic, then swing
     the camera to the new light. */
  useEffect(() => {
    if (!state) return;
    const count = nodes.length;
    const step = Math.max(0.22, Math.min(0.55, 5.0 / Math.max(1, count)));
    const introMs = (0.9 + count * step) * 1000;
    const t1 = window.setTimeout(() => {
      if (onGlobe) setSelected(key);
      setPhase('reveal');
    }, introMs + 900);
    const t2 = window.setTimeout(() => setPhase('ready'), introMs + 2600);
    // The creator's message is the final beat: after the ordinal has settled,
    // the words cross-fade out and the message crosses in. Only scheduled when
    // a message travelled with the piece.
    const t3 = creatorMessage
      ? window.setTimeout(() => setPhase('message'), introMs + 2600 + 2800)
      : undefined;
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      if (t3 !== undefined) window.clearTimeout(t3);
    };
  }, [state, nodes.length, onGlobe, key, creatorMessage]);

  /* Skip jumps forward, never blocks, and never reveals the message before
     the light is lit: from the ignition it lands on the settled ordinal; from
     there it reveals the message; from the message it enters the book. With no
     message it simply enters the book. */
  const handleSkip = () => {
    if (!creatorMessage || phase === 'message') {
      onDone();
      return;
    }
    if (phase === 'igniting') {
      if (onGlobe) setSelected(key);
      setPhase('ready');
      return;
    }
    setPhase('message');
  };

  const wordsVisible = phase === 'reveal' || phase === 'ready';
  const showExit = (phase === 'ready' && !creatorMessage) || phase === 'message';

  if (!state) {
    return (
      <div
        className="fixed inset-0"
        style={{ background: 'rgb(15,13,11)', zIndex: 300 }}
        aria-busy
      />
    );
  }

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{ background: 'rgb(15,13,11)', zIndex: 300 }}
    >
      <Suspense fallback={<div className="absolute inset-0" />}>
        <Globe3D
          nodes={nodes}
          selectedId={selected}
          kinship={kinship}
          kinshipVisible
          placedByCard={placedByCard}
          clearForHud={false}
          className="absolute inset-0"
        />
      </Suspense>

      {/* The words: held until the last light has come up, then released when
          the creator's message takes the stage. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-[14%] text-center px-6"
        style={{
          opacity: wordsVisible ? 1 : 0,
          transform: phase === 'igniting' ? 'translateY(10px)' : 'translateY(0)',
          transition: 'opacity 1.6s ease, transform 1.6s ease',
        }}
      >
        <p
          className="font-reading text-lg sm:text-xl mb-3"
          style={{ color: 'rgba(203,191,168,0.9)' }}
        >
          {myTitle} has found its steward.
        </p>
        <p
          className="text-3xl sm:text-5xl"
          style={{
            fontFamily: 'var(--font-brand)',
            // The line arrives wide and settles, like a breath released.
            letterSpacing: phase === 'igniting' ? '0.22em' : '0.08em',
            transition: 'letter-spacing 2.4s cubic-bezier(0.22, 1, 0.36, 1)',
            color: '#c4aa7c',
          }}
        >
          {typeof myOrdinal === 'number'
            ? `You are the ${ordinalWord(myOrdinal)} light.`
            : 'Your piece has joined the record.'}
        </p>
        {/* A hairline draws itself beneath the words. */}
        <div
          aria-hidden
          className="mx-auto mt-5 h-px"
          style={{
            width: phase === 'igniting' ? 0 : 140,
            background:
              'linear-gradient(90deg, rgba(196,170,124,0) 0%, rgba(196,170,124,0.7) 50%, rgba(196,170,124,0) 100%)',
            transition: 'width 2.2s cubic-bezier(0.22, 1, 0.36, 1) 0.4s',
          }}
        />
      </div>

      {/* The creator's message: the final beat. Mounted only once the light is
          lit and the ordinal has settled, never present in the DOM before
          ignition. Its words arrive over the same globe, no page-swap. */}
      {phase === 'message' && creatorMessage && (
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center px-8"
          style={{
            opacity: 0,
            transform: 'translateY(-50%)',
            transition: 'opacity 1.8s ease',
          }}
          ref={(el) => {
            if (el) requestAnimationFrame(() => (el.style.opacity = '1'));
          }}
        >
          <p
            className="font-label text-[11px] uppercase tracking-[0.25em] mb-6"
            style={{ color: 'rgba(196,170,124,0.75)' }}
          >
            a message traveled with this piece
          </p>
          <p
            className="mx-auto max-w-xl text-2xl sm:text-3xl leading-snug"
            style={{
              fontFamily: 'var(--font-reading)',
              color: '#e7dcc7',
            }}
          >
            {creatorMessage}
          </p>
        </div>
      )}

      {/* The way onward: appears after the reveal has landed (or with the
          message, when one travelled with the piece). */}
      <div
        className="absolute inset-x-0 bottom-[5%] flex items-center justify-center gap-8"
        style={{
          opacity: showExit ? 1 : 0,
          transition: 'opacity 1.2s ease',
          pointerEvents: showExit ? 'auto' : 'none',
        }}
      >
        <button
          type="button"
          onClick={onDone}
          className="font-label text-[11px] uppercase tracking-[0.25em] text-bronze-300 hover:text-bronze-200 transition-colors"
        >
          Enter your piece&apos;s book
        </button>
      </div>

      {/* Quiet exit for the impatient: always available, never highlighted.
          It jumps forward a beat rather than abandoning the ceremony. */}
      <button
        type="button"
        onClick={handleSkip}
        className="absolute top-5 right-6 font-label text-[10px] uppercase tracking-[0.2em] text-wood-500 hover:text-bronze-300 transition-colors"
      >
        skip
      </button>
    </div>
  );
};

export default ClaimCeremony;
