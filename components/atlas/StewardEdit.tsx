import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAccount } from '../../lib/account/useAccount';
import { signOut } from '../../lib/account/authClient';
import type { PieceRecord, CityCentroid, StewardRecord } from '../../types';
import { ATLAS_PLACES, getCityById, isCountryPlace } from '../../data/cities';
import { FULL_ARCHIVE } from '../../data/mockData';
import { img } from '../../utils/cloudinary';
import { loadAtlasState, findPublicPiece } from '../../lib/atlas/state';
import ConsentRings from './ConsentRings';
import type { ConsentChoice } from './ConsentRings';
import LegacyBook from './LegacyBook';
import StewardRequests from './StewardRequests';
import ArtworkPlate from './ArtworkPlate';
import BookLightBand from './BookLightBand';
import { ordinalLabel } from './PieceSidePanel';
import AccountLayout from '../account/AccountLayout';
import TypeaheadPicker from '../shared/TypeaheadPicker';
import Toggle from '../shared/Toggle';

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
  // Signed in, but no piece bound to this account (a 404, or an empty claim).
  // Not a redirect and not a dead-end: the three-door no-record screen.
  const [noRecord, setNoRecord] = useState(false);
  // The keeper's own dream, lifted from the book below to the top page. Set via
  // LegacyBook's onFirstDream once inscriptions load (framing only).
  const [firstDream, setFirstDream] = useState<string | null>(null);
  // The founding-light ordinal for the current piece, from public state (the
  // book's own PieceRecord does not carry the global rank). Absent for a piece
  // not visible on the public map (e.g. kept private).
  const [publicOrdinal, setPublicOrdinal] = useState<number | null>(null);
  // Whether this piece's dream is currently PUBLIC (a live shared intention on
  // the map). "Sign your dream" only offers itself when true — a signature has
  // nowhere to appear on a private dream. Read from the same public state as
  // the ordinal. Resets on piece switch.
  const [dreamIsPublic, setDreamIsPublic] = useState(false);
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
          setNoRecord(true);
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
          setNoRecord(true);
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

  // The founding-light ordinal comes from public state (the PieceRecord holds
  // only the per-piece claim date, not the global rank). One cached fetch; the
  // dream first-page and the globe band both read this. Reset on piece switch.
  useEffect(() => {
    setPublicOrdinal(null);
    setFirstDream(null);
    setDreamIsPublic(false);
    if (!stewardRecord) return;
    let active = true;
    loadAtlasState().then((state) => {
      if (!active) return;
      const pub = findPublicPiece(
        state,
        stewardRecord.pieceId,
        stewardRecord.editionNumber,
      );
      setPublicOrdinal(typeof pub?.claimOrdinal === 'number' ? pub.claimOrdinal : null);
      setDreamIsPublic(
        typeof pub?.intention === 'string' && pub.intention.trim().length > 0,
      );
    });
    return () => {
      active = false;
    };
  }, [stewardRecord?.pieceId, stewardRecord?.editionNumber, stewardRecord]);

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

  // "Sign your dream" — Ring 4 identity, in the keeper's own control. The name
  // and one link are local form state (seeded from the record, reset on piece
  // switch); the toggle and each field's blur save through the same update
  // endpoint. Off unless the keeper turns it on; the server audits every
  // visibility flip onto consentHistory and regenerates public state so the
  // signature follows the dream.
  const [sigName, setSigName] = useState('');
  const [sigLink, setSigLink] = useState('');
  const [sigSaving, setSigSaving] = useState(false);
  const sigShown = stewardRecord?.signature?.shown === true;

  useEffect(() => {
    setSigName(stewardRecord?.signature?.displayName ?? '');
    setSigLink(stewardRecord?.signature?.link ?? '');
  }, [stewardRecord?.pieceId, stewardRecord?.editionNumber, stewardRecord]);

  const submitSignature = async (next: {
    displayName: string;
    link: string;
    shown: boolean;
  }) => {
    if (!stewardRecord || sigSaving) return;
    setSigSaving(true);
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
          signature: {
            shown: next.shown,
            ...(next.displayName.trim() ? { displayName: next.displayName.trim() } : {}),
            ...(next.link.trim() ? { link: next.link.trim() } : {}),
          },
        }),
      });
      if (res.status === 401) {
        navigate('/atlas/claim', { replace: true });
        return;
      }
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; steward?: StewardRecord; error?: string }
        | null;
      if (!res.ok || !data?.ok || !data.steward) {
        setSaveError(data?.error ?? 'Something went wrong, please try again.');
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
      setSigSaving(false);
    }
  };

  const handleSignatureToggle = () => {
    submitSignature({ displayName: sigName, link: sigLink, shown: !sigShown });
  };

  // Persist an edited name/link only when it actually changed, so a blur that
  // touched nothing never fires a save. Carries the current shown state.
  const handleSignatureFieldCommit = () => {
    const nameChanged = sigName.trim() !== (stewardRecord?.signature?.displayName ?? '');
    const linkChanged = sigLink.trim() !== (stewardRecord?.signature?.link ?? '');
    if (!nameChanged && !linkChanged) return;
    submitSignature({ displayName: sigName, link: sigLink, shown: sigShown });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/atlas/claim', { replace: true });
  };

  // The no-record "sign-in switch": sign out so the keeper can come back in
  // with the email their piece was registered to (the pre-issued path).
  const handleSignInSwitch = async () => {
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
        <p className="font-display italic text-base text-stone-600">
          loading your piece
        </p>
      </AccountLayout>
    );
  }

  // Signed in, but nothing bound yet — a door, not a wall (interface law 6).
  if (noRecord) {
    return (
      <AccountLayout title="Your pieces">
        <div className="max-w-md space-y-5">
          <p className="font-display text-[1.0625rem] leading-relaxed text-stone-700">
            Your account is signed in, but no piece is bound to it yet.
          </p>
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={handleSignInSwitch}
              className="text-left font-label text-[11px] uppercase tracking-[0.18em] font-semibold text-bronze-700 hover:text-bronze-600 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 transition-colors"
            >
              Claim with the email your piece was registered to →
            </button>
            <Link
              to="/atlas"
              className="font-label text-[11px] uppercase tracking-[0.18em] font-semibold text-bronze-700 hover:text-bronze-600 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 transition-colors"
            >
              Came to it another way? Request stewardship →
            </Link>
            <Link
              to="/atlas/homecoming"
              className="font-label text-[11px] uppercase tracking-[0.18em] font-semibold text-bronze-700 hover:text-bronze-600 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 transition-colors"
            >
              Holding a piece we do not know? Bring it home →
            </Link>
          </div>
        </div>
      </AccountLayout>
    );
  }

  if (loadError || entries.length === 0) {
    return (
      <AccountLayout title="Your pieces">
        <div className="max-w-md space-y-4">
          <p className="font-display italic text-base text-stone-600">
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
                    className={`min-h-[44px] px-4 py-2 border font-reading text-sm transition-colors focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 ${
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
          <p className="font-display italic text-base text-stone-600 text-center mb-12">
            This piece doesn't have an atlas record yet. Ask Adrian to seed it
            and it will appear here.
          </p>
        ) : (
        <>
        {/* ═══ The treasure chest opens ═══
            The thread made visible (your light on the world), the plate, the
            dream as the book's first page, the founding number — and only then
            the tending controls below. */}
        {piece.currentCityId && currentCity && (
          <div className="mb-8">
            <BookLightBand
              pieceKey={`${stewardRecord?.pieceId ?? piece.pieceId}${
                (stewardRecord?.editionNumber ?? piece.editionNumber) != null
                  ? `:${stewardRecord?.editionNumber ?? piece.editionNumber}`
                  : ''
              }`}
              lat={currentCity.lat}
              lng={currentCity.lng}
              cityName={currentCity.city}
              ordinal={publicOrdinal}
            />
          </div>
        )}

        <div className="text-center mb-12">
          {artwork?.coverImage && (
            <div className="mx-auto w-full max-w-[12rem] mb-6">
              <div className="bg-[#151311] p-2.5 shadow-[0_2px_20px_-8px_rgba(0,0,0,0.55)]">
                <ArtworkPlate
                  src={img(artwork.coverImage, { w: 700, crop: 'fit' })}
                  alt={`${artwork.title}. Original work by Adrian Rasmussen.`}
                  title={artwork.title}
                  loading="eager"
                />
              </div>
            </div>
          )}
          <h2
            className="font-display text-2xl sm:text-[1.7rem] text-wood-900 font-medium mb-2"
            style={{ fontFamily: 'var(--font-brand)', letterSpacing: '0.04em' }}
          >
            You keep {artwork?.title ?? 'this piece'}
          </h2>
          <p className="font-display text-[1.0625rem] leading-relaxed text-stone-700">
            {detailParts.join(' · ')}
          </p>

          {/* The dream, framed as the first page of the book (display size). */}
          {firstDream && (
            <p
              className="font-display text-wood-900 leading-[1.3] mt-7 whitespace-pre-line"
              style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)' }}
            >
              {firstDream}
            </p>
          )}

          {/* The founding number. */}
          {publicOrdinal != null && (
            <div className="mt-7">
              <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 mb-1">
                Founding light
              </p>
              <p
                className="font-display text-wood-900 font-medium leading-none"
                style={{ fontFamily: 'var(--font-brand)', fontSize: 'clamp(2.25rem, 9vw, 3.25rem)' }}
              >
                {publicOrdinal}
              </p>
              <p className="font-display text-base text-wood-600 mt-2">
                the {ordinalLabel(publicOrdinal)} light
              </p>
            </div>
          )}

          <p className="font-display text-[15px] leading-relaxed text-stone-600 max-w-md mx-auto mt-6">
            {!piece.currentCityId
              ? 'A good first page: choose where it rests, just below.'
              : !piece.isPublic
                ? SHINE_SENTENCE
                : 'Its pages and letters continue below.'}
          </p>
        </div>

        {/* ═══ Chapter: Place it ═══ */}
        <div className="mb-10">
          <label
            htmlFor="city-search-input"
            className="block font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 font-semibold mb-3"
          >
            Place it
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

        {/* ═══ Chapter: Let it shine ═══
            Map presence, then the constellation of keepers beneath it. */}
        <div className="mb-10">
          <span className="block font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 font-semibold mb-3">
            Let it shine
          </span>
          <Toggle
            checked={piece.isPublic}
            onChange={handleVisibilityToggle}
            label={piece.isPublic ? 'Show on the atlas' : 'Keep this private'}
            ariaLabel="Show this piece on the atlas"
            disabled={saving}
          />
          {/* At-the-control nudge: after a placement, one quiet line pointing
              to the natural next step. The shine line reuses the welcome
              sentence and sits right under the toggle it points at; flipping
              visibility clears it. The public case points down to the book. */}
          {placeNudge === 'shine' && (
            <p className="font-display text-[15px] leading-relaxed text-stone-600 mt-3">
              {SHINE_SENTENCE}
            </p>
          )}
          {placeNudge === 'below' && (
            <p className="font-display text-[15px] leading-relaxed text-stone-600 mt-3">
              <a
                href="#piece-book"
                onClick={() => setPlaceNudge(null)}
                className="hover:text-wood-900 hover:underline focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2"
              >
                Its pages continue below.
              </a>
            </p>
          )}

          {/* ═══ Sign your dream ═══
              The optional keeper identity line: a name and one link that ride
              wherever the piece's public dream appears. Offered only while the
              dream is public; otherwise a quiet note, since a signature would
              have nowhere to appear. */}
          <div className="mt-8 pt-8 border-t border-wood-100">
            <span className="block font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 font-semibold mb-2">
              Sign your dream
            </span>
            {dreamIsPublic ? (
              <>
                <p className="font-display text-[15px] leading-relaxed text-stone-600 mb-4">
                  Show your name with your dream, and one link if you want
                  resonant people to find you. Off unless you turn it on; remove
                  it anytime.
                </p>
                <div className="space-y-4 mb-5">
                  <label className="block">
                    <span className="block font-label text-[11px] uppercase tracking-[0.16em] text-wood-500 mb-1.5">
                      name as it should appear
                    </span>
                    <input
                      type="text"
                      value={sigName}
                      maxLength={60}
                      onChange={e => setSigName(e.target.value)}
                      onBlur={handleSignatureFieldCommit}
                      disabled={sigSaving}
                      className="w-full border border-wood-300 bg-white px-3 py-2 font-reading text-base text-wood-900 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 disabled:opacity-60"
                    />
                  </label>
                  <label className="block">
                    <span className="block font-label text-[11px] uppercase tracking-[0.16em] text-wood-500 mb-1.5">
                      one link (https)
                    </span>
                    <input
                      type="url"
                      inputMode="url"
                      value={sigLink}
                      maxLength={200}
                      placeholder="https://"
                      onChange={e => setSigLink(e.target.value)}
                      onBlur={handleSignatureFieldCommit}
                      disabled={sigSaving}
                      className="w-full border border-wood-300 bg-white px-3 py-2 font-reading text-base text-wood-900 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 disabled:opacity-60"
                    />
                  </label>
                </div>
                <Toggle
                  checked={sigShown}
                  onChange={handleSignatureToggle}
                  label="shown with your dream"
                  ariaLabel="Show your signature with your dream"
                  disabled={sigSaving}
                />
              </>
            ) : (
              <p className="font-display text-[15px] leading-relaxed text-stone-600">
                your dream is private; a signature would have nowhere to appear.
              </p>
            )}
          </div>

          {/* Chart presence — the constellation of keepers, under Let it shine */}
          <div className="mt-8 pt-8 border-t border-wood-100">
            <span className="block font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 font-semibold mb-2">
              Join the constellation of keepers
            </span>
            <p className="font-display italic text-sm text-stone-600 mb-4">
              Turn this on and your piece joins the kinship constellation; arcs
              may connect it to other consenting pieces that share its trigrams.
              No name and no birth data are ever shown — only the elemental
              shape. You can turn it off at any time.
            </p>
            <Toggle
              checked={ring3On}
              onChange={handleRing3Toggle}
              label={ring3On ? 'Joined the constellation' : 'Join the kinship constellation'}
              ariaLabel="Join the kinship constellation"
              disabled={ring3Saving}
            />
          </div>
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
            <span className="font-display italic text-base text-stone-600">{saveError}</span>
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
            onFirstDream={setFirstDream}
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
