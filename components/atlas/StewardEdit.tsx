import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from '../../lib/account/useAccount';
import { signOut } from '../../lib/account/authClient';
import type { PieceRecord, CityCentroid, StewardRecord } from '../../types';
import { ATLAS_PLACES, getCityById, isCountryPlace } from '../../data/cities';
import { FULL_ARCHIVE } from '../../data/mockData';
import ConsentRings from './ConsentRings';
import type { ConsentChoice } from './ConsentRings';
import LegacyBook from './LegacyBook';
import StewardRequests from './StewardRequests';
import AccountLayout from '../account/AccountLayout';
import TypeaheadPicker from '../shared/TypeaheadPicker';

/**
 * Steward edit page. Rendered at `/atlas/edit`.
 *
 * Requires auth. On mount we POST /api/atlas/steward/claim with the
 * bearer token to load every piece bound to this user. Stewards with more
 * than one piece get a picker; edits always apply to the selected piece.
 * If no record is bound to this user, we send them to /atlas/claim.
 *
 * Retro-consent (M2): a steward bound before consent capture existed sees
 * the ConsentRings step once — the same Phase B POST as the claim flow —
 * before the edit UI. From then on the visibility toggle below IS the
 * Ring 2 control (the server keeps consent.ring2MapPresence + the audit
 * history in sync on every flip).
 *
 * The place picker offers cities and "country only" centroids — picking a
 * country places the public dot at the country's geographic center.
 */

type ClaimResponse = {
  ok: boolean;
  claimed: Array<{
    steward: StewardRecord;
    piece: PieceRecord | null;
    needsConsent?: boolean;
  }>;
};

type UpdateResponse = {
  ok: boolean;
  piece: PieceRecord;
};

const cityMatches = (city: CityCentroid, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    city.city.toLowerCase().includes(q) ||
    city.country.toLowerCase().includes(q) ||
    (city.region?.toLowerCase().includes(q) ?? false)
  );
};

const formatCityLabel = (city: CityCentroid): string => {
  if (isCountryPlace(city)) return `${city.country} — country only`;
  return city.region
    ? `${city.city}, ${city.region}, ${city.country}`
    : `${city.city}, ${city.country}`;
};

// The welcome up top and the at-the-control nudge below both point a fresh
// keeper toward showing a placed-but-private piece on the atlas. One string,
// two homes. The repetition at the control is the point.
const SHINE_SENTENCE =
  'It has a place. When you are ready, let it shine on the atlas.';

const StewardEdit: React.FC = () => {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, fetchAuthed } = useAccount();
  const [entries, setEntries] = useState<ClaimResponse['claimed']>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [consentSubmitting, setConsentSubmitting] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const savedTimerRef = useRef<number | null>(null);
  // At-the-control nudge shown only after a successful placement: 'shine'
  // points at the visibility toggle (piece placed but still private),
  // 'below' points down to the book. Cleared on any new save so it never
  // stacks, lingers across pieces, or shows on error.
  const [placeNudge, setPlaceNudge] = useState<'shine' | 'below' | null>(null);

  // Load claimed pieces via authed claim call.
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      navigate('/atlas/claim', { replace: true });
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetchAuthed('/api/atlas/steward/claim', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (cancelled) return;
        if (res.status === 401) {
          navigate('/atlas/claim', { replace: true });
          return;
        }
        if (res.status === 404) {
          navigate('/atlas/claim', { replace: true });
          return;
        }
        if (!res.ok) {
          setLoadError('Could not load your piece. Please try again.');
          return;
        }
        const data: ClaimResponse = await res.json();
        if (cancelled) return;
        const claimed = data.claimed ?? [];
        if (claimed.length === 0) {
          navigate('/atlas/claim', { replace: true });
          return;
        }
        setEntries(claimed);
        setSelectedIdx(0);
      } catch {
        if (!cancelled) setLoadError('Could not load your piece. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
    };
  }, [isLoaded, isSignedIn, fetchAuthed, navigate]);

  // The piece currently being edited. Every update targets this entry.
  const current = entries[selectedIdx] ?? null;
  const stewardRecord = current?.steward ?? null;
  const piece = current?.piece ?? null;

  const flashSaved = () => {
    setSavedAt(Date.now());
    if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
    savedTimerRef.current = window.setTimeout(() => setSavedAt(null), 2000);
  };

  // Switch which claimed piece the form edits. The city picker below is
  // keyed on selectedIdx, so it remounts (and its transient query/open
  // state resets) automatically; here we only clear the save flash/error
  // so they don't leak across pieces.
  const handlePieceSwitch = (idx: number) => {
    setSelectedIdx(idx);
    setSaveError(null);
    setSavedAt(null);
    setPlaceNudge(null);
  };

  const submitUpdate = async (body: { cityId?: string; isPublic?: boolean }) => {
    if (!stewardRecord) return;
    setSaving(true);
    setSaveError(null);
    // Clear any prior nudge up front: a fresh save decides the next one, and
    // a visibility flip (isPublic in the body) simply leaves it cleared,
    // which is how toggling the atlas on dismisses the shine nudge.
    setPlaceNudge(null);
    try {
      const res = await fetchAuthed('/api/atlas/steward/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...body,
          pieceId: stewardRecord.pieceId,
          editionNumber: stewardRecord.editionNumber,
        }),
      });
      if (res.status === 401) {
        navigate('/atlas/claim', { replace: true });
        return;
      }
      if (!res.ok) {
        setSaveError('Something went wrong, please try again.');
        return;
      }
      const data: UpdateResponse = await res.json();
      setEntries(prev =>
        prev.map((e, i) => (i === selectedIdx ? { ...e, piece: data.piece } : e)),
      );
      // Only a placement (a city save) raises the next-step nudge. A private
      // piece points at the toggle; an already-public one points to the book.
      if (body.cityId !== undefined) {
        setPlaceNudge(data.piece.isPublic ? 'below' : 'shine');
      }
      flashSaved();
    } catch {
      setSaveError('Something went wrong, please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCityPick = (cityId: string) => {
    // Server no-ops if this is already the current city; we still flash
    // "Saved." per UX spec either way, so there is nothing to branch on.
    submitUpdate({ cityId });
  };

  const handleVisibilityToggle = () => {
    if (!piece) return;
    submitUpdate({ isPublic: !piece.isPublic });
  };

  // Ring 3 — chart presence. Joining the kinship constellation is a consent
  // flip (mutable, revocable), not a ledger event; the server keeps the audit
  // history and regenerates the public kinshipEligible flag. We update the
  // steward record in place so the toggle reflects immediately.
  const [ring3Saving, setRing3Saving] = useState(false);
  const ring3On = stewardRecord?.consent?.ring3ChartPresence === true;

  const handleRing3Toggle = async () => {
    if (!stewardRecord || ring3Saving) return;
    setRing3Saving(true);
    setSaveError(null);
    try {
      const res = await fetchAuthed('/api/atlas/steward/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pieceId: stewardRecord.pieceId,
          editionNumber: stewardRecord.editionNumber,
          ring3ChartPresence: !ring3On,
        }),
      });
      if (res.status === 401) {
        navigate('/atlas/claim', { replace: true });
        return;
      }
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; steward?: StewardRecord }
        | null;
      if (!res.ok || !data?.ok || !data.steward) {
        setSaveError('Something went wrong, please try again.');
        return;
      }
      const updated = data.steward;
      setEntries(prev =>
        prev.map((e, i) => (i === selectedIdx ? { ...e, steward: updated } : e)),
      );
      flashSaved();
    } catch {
      setSaveError('Something went wrong, please try again.');
    } finally {
      setRing3Saving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/atlas/claim', { replace: true });
  };

  // Retro-consent: a record bound before M2 has no captured consent — the
  // ConsentRings step renders once, posting the same Phase B body as the
  // claim flow. One capture covers every piece this steward holds.
  const needsConsent = entries.some(e => !e.steward.consent);

  const handleConsentSubmit = async (choice: ConsentChoice) => {
    setConsentSubmitting(true);
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
      if (res.status === 401) {
        navigate('/atlas/claim', { replace: true });
        return;
      }
      if (!res.ok) {
        setConsentError('Something went wrong. Please try again.');
        return;
      }
      const data: ClaimResponse = await res.json();
      setEntries(data.claimed ?? []);
    } catch {
      setConsentError('Something went wrong. Please try again.');
    } finally {
      setConsentSubmitting(false);
    }
  };

  // === Derived view data ===

  const artwork = useMemo(() => {
    if (!piece) return undefined;
    return FULL_ARCHIVE.find(a => a.id === piece.pieceId);
  }, [piece]);

  const currentCity = useMemo(() => {
    if (!piece?.currentCityId) return undefined;
    return getCityById(piece.currentCityId);
  }, [piece]);

  const statusLine = useMemo(() => {
    if (!piece) return '';
    if (piece.status === 'placed' && currentCity) {
      return `placed in ${currentCity.city}`;
    }
    if (piece.status === 'withdrawn') return 'private';
    if (piece.status === 'retired') return 'retired';
    return 'seeking ground';
  }, [piece, currentCity]);

  const detailParts = useMemo(() => {
    if (!piece) return [];
    const parts: string[] = [];
    if (artwork?.title) parts.push(artwork.title);
    if (artwork?.series) {
      if (piece.editionNumber != null) {
        parts.push(`${artwork.series} ${String(piece.editionNumber).padStart(2, '0')}`);
      } else {
        parts.push(artwork.series);
      }
    } else if (piece.editionNumber != null) {
      parts.push(`Edition ${piece.editionNumber}`);
    }
    parts.push(statusLine);
    return parts;
  }, [artwork, piece, statusLine]);

  // === Render ===

  if (loading) {
    return (
      <AccountLayout title="Your pieces">
        <p className="font-serif italic text-base text-stone-600">
          loading your piece
        </p>
      </AccountLayout>
    );
  }

  if (loadError || entries.length === 0) {
    return (
      <AccountLayout title="Your pieces">
        <div className="max-w-md space-y-4">
          <p className="font-serif italic text-base text-stone-600">
            {loadError ?? 'Could not load your piece.'}
          </p>
          <button
            onClick={() => navigate('/atlas/claim', { replace: true })}
            className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 hover:text-bronze-800 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 font-semibold"
          >
            Return to claim
          </button>
        </div>
      </AccountLayout>
    );
  }

  if (needsConsent) {
    const pending = entries.find(e => !e.steward.consent) ?? entries[0];
    const title = FULL_ARCHIVE.find(a => a.id === pending.steward.pieceId)?.title;
    return (
      <AccountLayout title="Your pieces">
        <ConsentRings
          pieceTitle={title}
          submitting={consentSubmitting}
          error={consentError}
          onSubmit={handleConsentSubmit}
        />
      </AccountLayout>
    );
  }

  return (
    <AccountLayout title="Your pieces">
      <div className="w-full max-w-xl">
        {/* Everything interactive is print-hidden; the LegacyBook below
            carries its own print-only rendering of the piece's book. */}
        <div className="print:hidden">
        {/* Piece picker — only for stewards of more than one piece. The
            form below always edits the selected piece. */}
        {entries.length > 1 && (
          <div className="mb-10">
            <span className="block font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 font-semibold mb-3">
              Choose a piece
            </span>
            <div className="flex flex-wrap gap-2">
              {entries.map((e, i) => {
                const art = FULL_ARCHIVE.find(a => a.id === e.steward.pieceId);
                const label =
                  (art?.title ?? e.steward.pieceId) +
                  (e.steward.editionNumber != null ? ` · Ed. ${e.steward.editionNumber}` : '');
                const active = i === selectedIdx;
                return (
                  <button
                    key={`${e.steward.pieceId}:${e.steward.editionNumber ?? ''}`}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handlePieceSwitch(i)}
                    className={`min-h-[44px] px-4 py-2 border font-sans text-sm transition-colors focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 ${
                      active
                        ? 'bg-bronze-100 border-bronze-500 text-wood-900'
                        : 'bg-white border-wood-300 text-wood-700 hover:bg-paper-100'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!piece ? (
          /* Claimed steward record but no ledger projection yet — nothing to
             edit until an event exists for this piece. */
          <p className="font-serif italic text-base text-stone-600 text-center mb-12">
            This piece doesn't have an atlas record yet. Ask Adrian to seed it
            and it will appear here.
          </p>
        ) : (
        <>
        {/* The keeper's welcome: this page is a book, not a settings panel.
            One quiet next step, chosen from the piece's actual state, so a
            fresh owner is walked in rather than dropped on a wall of toggles. */}
        <div className="text-center mb-12">
          <h2
            className="font-serif text-2xl sm:text-[1.7rem] text-wood-900 font-medium mb-2"
            style={{ fontFamily: 'var(--font-brand)', letterSpacing: '0.04em' }}
          >
            You keep {artwork?.title ?? 'this piece'}
          </h2>
          <p className="font-serif text-[1.0625rem] leading-relaxed text-stone-700 mb-4">
            {detailParts.join(' · ')}
          </p>
          <p className="font-serif text-[15px] leading-relaxed text-stone-600 max-w-md mx-auto">
            This is the piece&apos;s book. Place it in the world, choose what
            the atlas shows, write into its pages, and one day pass it on.
            {' '}
            {!piece.currentCityId
              ? 'A good first page: choose where it rests, just below.'
              : !piece.isPublic
                ? SHINE_SENTENCE
                : 'Its pages and letters continue below.'}
          </p>
        </div>

        {/* City picker */}
        <div className="mb-10">
          <label
            htmlFor="city-search-input"
            className="block font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 font-semibold mb-3"
          >
            Where it rests
          </label>
          <TypeaheadPicker<CityCentroid>
            // Keyed on selectedIdx so switching claimed pieces remounts the
            // picker, resetting its query/open state exactly as
            // handlePieceSwitch used to do explicitly.
            key={selectedIdx}
            id="city-search"
            items={ATLAS_PLACES}
            filter={cityMatches}
            itemKey={c => c.id}
            itemLabel={formatCityLabel}
            value={piece.currentCityId ?? null}
            seedQueryFromValue={false}
            clearQueryOnPick
            onPick={c => handleCityPick(c.id)}
            placeholder={currentCity ? formatCityLabel(currentCity) : 'Search a city or country'}
            maxResults={12}
            emptyMessage="No cities match. Try a country name."
            variant="book"
            renderItem={formatCityLabel}
          />
        </div>

        {/* Visibility toggle */}
        <div className="mb-10">
          <span className="block font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 font-semibold mb-3">
            Visibility
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={piece.isPublic}
            aria-label="Show this piece on the atlas"
            onClick={handleVisibilityToggle}
            disabled={saving}
            className="group flex items-center gap-4 min-h-[44px] font-sans text-base text-wood-800 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 disabled:opacity-60"
          >
            <span
              aria-hidden="true"
              className={`relative inline-block w-11 h-6 border transition-colors ${
                piece.isPublic
                  ? 'bg-bronze-400 border-bronze-500'
                  : 'bg-paper-100 border-wood-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white transition-transform ${
                  piece.isPublic ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </span>
            <span>{piece.isPublic ? 'Show on the atlas' : 'Keep this private'}</span>
          </button>
          {/* At-the-control nudge: after a placement, one quiet line pointing
              to the natural next step. The shine line reuses the welcome
              sentence and sits right under the toggle it points at; flipping
              visibility clears it. The public case points down to the book. */}
          {placeNudge === 'shine' && (
            <p className="font-serif text-[15px] leading-relaxed text-stone-600 mt-3">
              {SHINE_SENTENCE}
            </p>
          )}
          {placeNudge === 'below' && (
            <p className="font-serif text-[15px] leading-relaxed text-stone-600 mt-3">
              <a
                href="#piece-book"
                onClick={() => setPlaceNudge(null)}
                className="hover:text-wood-900 hover:underline focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2"
              >
                Its pages continue below.
              </a>
            </p>
          )}
        </div>

        {/* Ring 3 — chart presence (the kinship constellation) */}
        <div className="mb-10">
          <span className="block font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 font-semibold mb-2">
            Chart presence
          </span>
          <p className="font-serif italic text-sm text-stone-600 mb-4">
            Turn this on and your piece joins the kinship constellation; arcs
            may connect it to other consenting pieces that share its trigrams.
            No name and no birth data are ever shown — only the elemental
            shape. You can turn it off at any time.
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={ring3On}
            aria-label="Join the kinship constellation"
            onClick={handleRing3Toggle}
            disabled={ring3Saving}
            className="group flex items-center gap-4 min-h-[44px] font-sans text-base text-wood-800 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 disabled:opacity-60"
          >
            <span
              aria-hidden="true"
              className={`relative inline-block w-11 h-6 border transition-colors ${
                ring3On
                  ? 'bg-bronze-400 border-bronze-500'
                  : 'bg-paper-100 border-wood-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white transition-transform ${
                  ring3On ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </span>
            <span>
              {ring3On
                ? 'Joined the constellation'
                : 'Join the kinship constellation'}
            </span>
          </button>
        </div>

        {/* Confirmation + error region */}
        <div className="h-6 mb-10 text-center">
          {savedAt && (
            <span
              key={savedAt}
              className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold"
              style={{ animation: 'fadeIn 0.2s ease-out' }}
            >
              Saved.
            </span>
          )}
          {!savedAt && saveError && (
            <span className="font-serif italic text-base text-stone-600">{saveError}</span>
          )}
        </div>
        </>
        )}
        </div>

        {/* Claim requests routed to this holder (M4) — only the current
            steward can pass the piece on; approving re-binds the record,
            so we reload from /atlas/claim afterwards. */}
        {stewardRecord && (
          <StewardRequests
            steward={stewardRecord}
            fetchAuthed={fetchAuthed}
            onTransferred={() => {
              navigate('/atlas/claim', { replace: true });
            }}
          />
        )}

        {/* Legacy book — Ring 1 timeline, add-entry, heirs, export (M3).
            Includes the print-only book rendering. */}
        {piece && stewardRecord && (
          <LegacyBook
            steward={stewardRecord}
            piece={piece}
            fetchAuthed={fetchAuthed}
            onStewardUpdate={(s) =>
              setEntries(prev =>
                prev.map((e, i) => (i === selectedIdx ? { ...e, steward: s } : e)),
              )
            }
          />
        )}

        {/* Sign out */}
        <div className="text-center pt-6 border-t border-wood-200 print:hidden">
          <button
            type="button"
            onClick={handleSignOut}
            className="font-label text-xs uppercase tracking-[0.15em] text-stone-500 hover:text-wood-900 hover:underline focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </AccountLayout>
  );
};

export default StewardEdit;
