import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAccount } from '../../lib/account/useAccount';
import SignInModal from '../account/SignInModal';
import type { PieceRecord, StewardRecord } from '../../types';
import { FULL_ARCHIVE } from '../../data/mockData';
import ConsentRings from './ConsentRings';
import type { ConsentChoice } from './ConsentRings';
import ClaimCeremony from './ClaimCeremony';

/**
 * Steward claim — rendered at /atlas/claim. Two-phase since M2.
 *
 * Flow:
 *   1. Collector signs in to mandalacodes using the email Adrian
 *      added them with.
 *   2. Phase A: the page POSTs to /api/atlas/steward/claim (no consent in
 *      the body — identity comes from the bearer token). Server binds the
 *      userId and answers with the claimed pieces + needsConsent flags.
 *   3. If consent is already captured we redirect straight to /atlas/edit.
 *      Otherwise the consent step renders here (ConsentRings): the one
 *      Ring 2 map question, the optional first-inscription prompt, the
 *      quiet deferred line for Rings 3–4.
 *   4. Phase B: the choice POSTs back with `{ consent, firstInscription? }`.
 *      The server stamps the consent, appends the `claimed` event (the
 *      piece's Founding Lights ordinal), applies the Ring 2 choice, and we
 *      land on /atlas/edit.
 */

type ClaimEntry = {
  steward: StewardRecord;
  piece: PieceRecord | null;
  needsConsent?: boolean;
};

type ClaimResponse = {
  ok: boolean;
  claimed: ClaimEntry[];
  needsConsent?: boolean;
};

const StewardClaim: React.FC = () => {
  const { isLoaded, isSignedIn, email, fetchAuthed } = useAccount();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<
    'idle' | 'claiming' | 'consent' | 'ceremony' | 'no-record' | 'error'
  >('idle');
  const [entries, setEntries] = useState<ClaimEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  /* Dev-only rehearsal: /atlas/claim?ceremony=<pieceId[:edition]> renders the
     ceremony directly so it can be tuned without a live claim. (The return
     happens below, after every hook, so hook order stays stable.) */
  const rehearse = import.meta.env.DEV ? searchParams.get('ceremony') : null;

  // Phase A — bind on arrival.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || status !== 'idle') return;
    let cancelled = false;
    (async () => {
      setStatus('claiming');
      try {
        const res = await fetchAuthed('/api/atlas/steward/claim', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (cancelled) return;
        if (res.ok) {
          const data: ClaimResponse = await res.json();
          if (cancelled) return;
          const claimed = data.claimed ?? [];
          if (claimed.some(c => c.needsConsent)) {
            // The consent moment happens here — no redirect.
            setEntries(claimed);
            setStatus('consent');
            return;
          }
          navigate('/atlas/edit', { replace: true });
          return;
        }
        if (res.status === 404) {
          setStatus('no-record');
        } else {
          setStatus('error');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, fetchAuthed, navigate, status]);

  // Phase B — consent capture.
  const handleConsentSubmit = async (choice: ConsentChoice) => {
    setSubmitting(true);
    setConsentError(null);
    try {
      const res = await fetchAuthed('/api/atlas/steward/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          consent: { ring2MapPresence: choice.ring2MapPresence },
          ...(choice.firstInscription
            ? { firstInscription: choice.firstInscription }
            : {}),
        }),
      });
      if (!res.ok) {
        setConsentError('Something went wrong. Please try again.');
        return;
      }
      // The consent landed — now the ceremony: the founding lights replay
      // and this piece's light ignites last, with its ordinal spoken.
      setStatus('ceremony');
    } catch {
      setConsentError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // If the ceremony ever renders with nothing claimed, fall through quietly.
  useEffect(() => {
    if (status === 'ceremony' && entries.length === 0) {
      navigate('/atlas/edit', { replace: true });
    }
  }, [status, entries.length, navigate]);

  // Title of the (first) piece awaiting consent — for the heading copy.
  const consentPieceTitle = (() => {
    const entry = entries.find(e => e.needsConsent) ?? entries[0];
    if (!entry) return undefined;
    return FULL_ARCHIVE.find(a => a.id === entry.steward.pieceId)?.title;
  })();

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

  if (status === 'ceremony') {
    const entry = entries.find((e) => e.needsConsent) ?? entries[0];
    return entry ? (
      <ClaimCeremony
        pieceId={entry.steward.pieceId}
        editionNumber={entry.steward.editionNumber}
        onDone={() => navigate('/atlas/edit', { replace: true })}
      />
    ) : null;
  }

  return (
    <section className="min-h-screen bg-paper-50 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        {status !== 'consent' && (
          <h1
            className="font-display text-3xl text-wood-900 font-medium text-center mb-6 tracking-wide"
            style={{ fontFamily: 'Cinzel, serif', letterSpacing: '0.08em' }}
          >
            Claim your piece
          </h1>
        )}

        {isLoaded && !isSignedIn && (
          <>
            <p className="font-serif text-[1.0625rem] leading-relaxed text-stone-700 text-center mb-10">
              If you hold one of Adrian Rasmussen's pieces, sign in with the email Adrian used when he added you. Only your city will appear publicly, never an address. You can switch to private at any time.
            </p>
            {/* Self-owned sign-in. Once signed in, the Phase A effect above
                fires automatically (isSignedIn flips) and binds the piece —
                no redirect needed; the claim happens in place. */}
            <SignInModal
              onClose={() => navigate('/atlas', { replace: true })}
              onSignedIn={() => {
                /* Phase A effect handles binding once isSignedIn flips. */
              }}
            />
          </>
        )}

        {isSignedIn && (
          <>
          {status === 'claiming' && (
            <p className="font-serif italic text-base text-stone-700 text-center">
              Looking up your piece...
            </p>
          )}
          {status === 'consent' && (
            <ConsentRings
              pieceTitle={consentPieceTitle}
              submitting={submitting}
              error={consentError}
              onSubmit={handleConsentSubmit}
            />
          )}
          {status === 'no-record' && (
            <div className="text-center">
              <p className="font-serif text-[1.0625rem] leading-relaxed text-stone-700 mb-3">
                We don't have a piece bound to{' '}
                <span className="text-wood-900">
                  {email ?? 'your email'}
                </span>{' '}
                yet.
              </p>
              <p className="font-serif italic text-sm text-stone-600">
                If you hold one of Adrian's pieces, send him a note and he'll add you with this email address.
              </p>
            </div>
          )}
          {status === 'error' && (
            <p className="font-serif italic text-base text-stone-600 text-center">
              Something went wrong. Please try again.
            </p>
          )}
          </>
        )}
      </div>
    </section>
  );
};

export default StewardClaim;
