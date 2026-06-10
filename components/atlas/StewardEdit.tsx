import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignedIn, SignedOut, useAuth, useClerk } from '@clerk/clerk-react';
import type { PieceRecord, CityCentroid, StewardRecord } from '../../types';
import { CITIES, getCityById } from '../../data/cities';
import { FULL_ARCHIVE } from '../../data/mockData';

/**
 * Steward edit page. Rendered at `/atlas/edit`.
 *
 * Requires Clerk auth. On mount we POST /api/atlas/steward/claim with the
 * bearer token to load every piece bound to this user. Stewards with more
 * than one piece get a picker; edits always apply to the selected piece.
 * If no record is bound to this user, we send them to /atlas/claim.
 */

type ClaimResponse = {
  ok: boolean;
  claimed: Array<{ steward: StewardRecord; piece: PieceRecord | null }>;
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
  return city.region
    ? `${city.city}, ${city.region}, ${city.country}`
    : `${city.city}, ${city.country}`;
};

const StewardEdit: React.FC = () => {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { signOut } = useClerk();
  const [entries, setEntries] = useState<ClaimResponse['claimed']>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const savedTimerRef = useRef<number | null>(null);

  // City picker state
  const [cityQuery, setCityQuery] = useState('');
  const [cityOpen, setCityOpen] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  // Load claimed pieces via Clerk-authed claim call.
  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      navigate('/atlas/claim', { replace: true });
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const token = await getToken();
        const res = await fetch('/api/atlas/steward/claim', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  }, [isLoaded, isSignedIn, getToken, navigate]);

  // Click-outside to close the city combobox
  useEffect(() => {
    if (!cityOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setCityOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [cityOpen]);

  // The piece currently being edited. Every update targets this entry.
  const current = entries[selectedIdx] ?? null;
  const stewardRecord = current?.steward ?? null;
  const piece = current?.piece ?? null;

  const flashSaved = () => {
    setSavedAt(Date.now());
    if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
    savedTimerRef.current = window.setTimeout(() => setSavedAt(null), 2000);
  };

  // Switch which claimed piece the form edits; clears transient picker state
  // so the city search and save flash don't leak across pieces.
  const handlePieceSwitch = (idx: number) => {
    setSelectedIdx(idx);
    setCityQuery('');
    setCityOpen(false);
    setSaveError(null);
    setSavedAt(null);
  };

  const submitUpdate = async (body: { cityId?: string; isPublic?: boolean }) => {
    if (!stewardRecord) return;
    setSaving(true);
    setSaveError(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/atlas/steward/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
      flashSaved();
    } catch {
      setSaveError('Something went wrong, please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCityPick = (cityId: string) => {
    setCityQuery('');
    setCityOpen(false);
    if (piece && piece.currentCityId === cityId) {
      // Server will no-op; we still flash "Saved." per UX spec
      submitUpdate({ cityId });
      return;
    }
    submitUpdate({ cityId });
  };

  const handleVisibilityToggle = () => {
    if (!piece) return;
    submitUpdate({ isPublic: !piece.isPublic });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/atlas/claim', { replace: true });
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

  const filteredCities = useMemo(() => {
    if (!cityQuery.trim()) return CITIES.slice(0, 12);
    return CITIES.filter(c => cityMatches(c, cityQuery)).slice(0, 12);
  }, [cityQuery]);

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
      <section className="min-h-screen bg-paper-50 flex items-center justify-center">
        <p className="font-serif italic text-base text-stone-600">
          loading your piece
        </p>
      </section>
    );
  }

  if (loadError || entries.length === 0) {
    return (
      <section className="min-h-screen bg-paper-50 flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center space-y-4">
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
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-paper-50 px-6 py-16">
      <div className="w-full max-w-xl mx-auto">
        <h1
          className="font-display text-3xl text-wood-900 font-medium text-center mb-6"
          style={{ fontFamily: 'Cinzel, serif', letterSpacing: '0.08em' }}
        >
          {entries.length > 1 ? 'Your pieces' : 'Your piece'}
        </h1>

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
        {/* Piece details */}
        <div className="text-center mb-12">
          <p className="font-serif text-[1.0625rem] leading-relaxed text-stone-700">
            {detailParts.join(' · ')}
          </p>
        </div>

        {/* City picker */}
        <div className="mb-10">
          <label
            htmlFor="city-search"
            className="block font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 font-semibold mb-3"
          >
            Where it rests
          </label>
          <div className="relative" ref={comboRef}>
            <input
              id="city-search"
              type="text"
              role="combobox"
              aria-expanded={cityOpen}
              aria-controls="city-list"
              autoComplete="off"
              value={cityQuery}
              onChange={e => {
                setCityQuery(e.target.value);
                setCityOpen(true);
              }}
              onFocus={() => setCityOpen(true)}
              placeholder={currentCity ? formatCityLabel(currentCity) : 'Search a city or country'}
              className="w-full min-h-[44px] border border-wood-300 bg-white px-4 py-3 font-sans text-base text-wood-900 placeholder:text-wood-400 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 focus:border-bronze-400"
            />
            {cityOpen && filteredCities.length > 0 && (
              <ul
                id="city-list"
                role="listbox"
                className="absolute z-10 left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-white border border-wood-300 shadow-sm"
              >
                {filteredCities.map(c => {
                  const selected = piece.currentCityId === c.id;
                  return (
                    <li
                      key={c.id}
                      role="option"
                      aria-selected={selected}
                      onClick={() => handleCityPick(c.id)}
                      className={`px-4 py-2 cursor-pointer font-sans text-sm transition-colors ${
                        selected
                          ? 'bg-bronze-100 text-wood-900'
                          : 'text-wood-700 hover:bg-paper-100'
                      }`}
                    >
                      {formatCityLabel(c)}
                    </li>
                  );
                })}
              </ul>
            )}
            {cityOpen && filteredCities.length === 0 && (
              <ul
                role="listbox"
                className="absolute z-10 left-0 right-0 mt-1 bg-white border border-wood-300 shadow-sm"
              >
                <li className="px-4 py-2 font-serif italic text-sm text-stone-600">
                  No cities match. Try a country name.
                </li>
              </ul>
            )}
          </div>
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

        {/* Sign out */}
        <div className="text-center pt-6 border-t border-wood-200">
          <button
            type="button"
            onClick={handleSignOut}
            className="font-label text-xs uppercase tracking-[0.15em] text-stone-500 hover:text-wood-900 hover:underline focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </section>
  );
};

export default StewardEdit;
