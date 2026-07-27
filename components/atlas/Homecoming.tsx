import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from '../../lib/account/useAccount';
import SignInTrigger from '../account/SignInTrigger';
import TypeaheadPicker from '../shared/TypeaheadPicker';
import { ATLAS_PLACES, getCityById, isCountryPlace } from '../../data/cities';
import type { CityCentroid } from '../../types';
import { HOMECOMING_MAX_PHOTOS } from '../../lib/atlas/homecoming';

/**
 * The Homecoming (Phase 2.5): /atlas/homecoming.
 *
 * The way home for a past collector the atlas has NO record of, no chain, no
 * steward record, nothing to match against. They hold a real piece of Adrian's
 * that the system has never heard of. Here they offer photographs, roughly
 * when and where it came to them, and where it rests now. Adrian recognizes
 * his own work, and it takes its place.
 *
 * A quiet ceremony-voiced page on the site's active paper surface. Sign-in is
 * asked in the language of claiming a piece, never "log in". Adrian's eye does
 * the recognizing silently; the visitor is never asked to prove anything.
 *
 * Photos and story are private: they are sent only to Adrian, never shown on
 * the map.
 */

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
  if (isCountryPlace(city)) return `${city.country}`;
  return city.region
    ? `${city.city}, ${city.region}, ${city.country}`
    : `${city.city}, ${city.country}`;
};

const fieldClass =
  'w-full bg-transparent border-0 border-b border-wood-300 px-0 py-3 font-display text-[1.0625rem] text-wood-900 placeholder:text-wood-400 focus:outline-none focus:border-bronze-700 transition-colors';

// Homecoming uses an unboxed, underline-only field treatment. These
// important-prefixed utilities override the shared picker's raised-paper input
// while leaving its dropdown on the standard themed overlay surface.
const cityInputOverride =
  '!bg-transparent !border-0 !border-b !border-wood-300 !px-0 !text-wood-900 placeholder:!text-wood-400 focus:!outline-none focus:!border-bronze-700 !rounded-none';

const labelClass =
  'block font-label text-[11px] uppercase tracking-[0.22em] font-semibold mb-3';

const Homecoming: React.FC = () => {
  const { isLoaded, isSignedIn, fetchAuthed } = useAccount();

  const [photoUrls, setPhotoUrls] = useState<string[]>(['', '', '']);
  const [provenance, setProvenance] = useState('');
  const [cityId, setCityId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const setPhotoAt = (i: number, value: string) => {
    setPhotoUrls((prev) => {
      const next = prev.slice();
      next[i] = value;
      return next;
    });
  };

  const cleanPhotos = photoUrls.map((u) => u.trim()).filter(Boolean);
  const canSend =
    !busy && cleanPhotos.length > 0 && provenance.trim() !== '' && cityId !== '';

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetchAuthed('/api/atlas/homecoming/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photoUrls: cleanPhotos,
          provenance: provenance.trim(),
          cityId,
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? 'Something did not go through. Please try again.');
        return;
      }
      setSent(true);
    } catch {
      setError('Something did not go through. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      data-homecoming-page
      className="min-h-screen w-full flex items-center justify-center bg-paper-50 px-6 py-20"
      style={{
        backgroundImage: 'radial-gradient(120% 90% at 50% 0%, var(--color-wood-50) 0%, transparent 62%)',
      }}
    >
      <div className="w-full max-w-xl">
        <h1
          className="text-3xl sm:text-4xl mb-6 text-center text-bronze-700"
          style={{
            fontFamily: 'var(--font-brand)',
            letterSpacing: '0.12em',
          }}
        >
          bring your piece home
        </h1>
        <p
          className="font-display text-[1.0625rem] leading-relaxed text-center text-wood-700 mb-12"
        >
          If one of Adrian's works rests with you and the atlas does not know it
          yet, this is its way home.
        </p>

        {sent ? (
          <div className="text-center">
            <p
              className="font-display text-[1.0625rem] leading-relaxed text-wood-700 mb-4"
            >
              It rests with me now. When I recognize the piece, it will take its
              place among the others, and I will write to you so you can light
              it.
            </p>
            <Link
              to="/atlas"
              className="font-label text-[11px] uppercase tracking-[0.22em] font-semibold text-bronze-700 transition-colors"
            >
              return to the world
            </Link>
          </div>
        ) : !isLoaded ? null : !isSignedIn ? (
          <div className="text-center">
            <p
              className="font-display text-[1.0625rem] leading-relaxed text-wood-700 mb-8"
            >
              Claim your piece to begin. Your place is kept under the same name
              you use here.
            </p>
            <SignInTrigger>
              <button
                type="button"
                className="font-label text-xs uppercase tracking-[0.25em] font-semibold px-8 py-4 border border-bronze-500/50 text-bronze-700 transition-colors hover:border-bronze-700"
              >
                claim your piece
              </button>
            </SignInTrigger>
          </div>
        ) : (
          <div className="space-y-10">
            {/* Photographs, the repo has no image upload, so these are links
                the collector pastes. */}
            <div>
              <span className={`${labelClass} text-wood-600`}>
                photographs of the piece
              </span>
              <p
                className="font-display text-sm leading-relaxed text-wood-700 mb-4"
              >
                Paste a web link to a photo. One is enough; up to{' '}
                {HOMECOMING_MAX_PHOTOS} if you have them.
              </p>
              <div className="space-y-4">
                {photoUrls.map((url, i) => (
                  <input
                    key={i}
                    type="url"
                    inputMode="url"
                    value={url}
                    onChange={(e) => setPhotoAt(i, e.target.value)}
                    placeholder={
                      i === 0
                        ? 'https://…'
                        : 'https://… (another view, if you have one)'
                    }
                    className={fieldClass}
                  />
                ))}
              </div>
            </div>

            {/* Provenance, roughly when and where it came to them. */}
            <div>
              <label
                htmlFor="homecoming-provenance"
                className={`${labelClass} text-wood-600`}
              >
                how it came to you
              </label>
              <textarea
                id="homecoming-provenance"
                value={provenance}
                onChange={(e) => setProvenance(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Roughly when, and where you were, when it found you."
                className={`${fieldClass} resize-y leading-relaxed`}
              />
            </div>

            {/* Where it rests now, reuses the shared city picker. */}
            <div>
              <span className={`${labelClass} text-wood-600`}>
                the city where it rests now
              </span>
              <TypeaheadPicker<CityCentroid>
                items={ATLAS_PLACES}
                filter={cityMatches}
                itemKey={(c) => c.id}
                itemLabel={formatCityLabel}
                value={cityId || null}
                onPick={(c) => setCityId(c.id)}
                onQueryChange={() => setCityId('')}
                placeholder="Santa Cruz, Bali, Sacramento…"
                clearQueryOnPick={false}
                seedQueryFromValue={false}
                variant="book"
                className={cityInputOverride}
                renderItem={(c) => formatCityLabel(c)}
              />
              {cityId && getCityById(cityId) && (
                <p
                  className="font-display text-sm text-wood-700 mt-2"
                >
                  {formatCityLabel(getCityById(cityId)!)}
                </p>
              )}
            </div>

            {/* Anything else. */}
            <div>
              <label
                htmlFor="homecoming-note"
                className={`${labelClass} text-wood-600`}
              >
                anything else you want me to see
              </label>
              <textarea
                id="homecoming-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Optional."
                className={`${fieldClass} resize-y leading-relaxed`}
              />
            </div>

            {error && (
              <p className="font-display text-sm text-danger-text">
                {error}
              </p>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={submit}
                disabled={!canSend}
                className="font-label text-xs uppercase tracking-[0.25em] font-semibold px-8 py-4 border border-bronze-500/50 text-bronze-700 transition-colors hover:border-bronze-700 disabled:opacity-40"
              >
                {busy ? 'sending…' : 'bring it home'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default Homecoming;
