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
 * A quiet ceremony-voiced page on the dark stage, not a web form. Sign-in is
 * asked in the language of claiming a piece, never "log in". Adrian's eye does
 * the recognizing silently; the visitor is never asked to prove anything.
 *
 * Photos and story are private: they are sent only to Adrian, never shown on
 * the map.
 */

const STAGE_BG = 'rgb(15,13,11)';
const PARCHMENT = 'rgba(203,191,168,0.92)';
const PARCHMENT_SOFT = 'rgba(203,191,168,0.6)';
const GOLD = '#c4aa7c';

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

// A dark, inlaid field, a line of warm light under the words, never a white
// web-form box.
const fieldClass =
  'w-full bg-transparent border-0 border-b border-[rgba(196,170,124,0.28)] px-0 py-3 font-serif text-[1.0625rem] text-[#e9e1d2] placeholder:text-[rgba(203,191,168,0.38)] focus:outline-none focus:border-[#c4aa7c] transition-colors';

// TypeaheadPicker hardcodes a white book/admin input; the important-prefixed
// utilities here override it so the city field sits in the dark stage like the
// others (its dropdown panel stays a light overlay, which reads as an overlay,
// not a form).
const cityInputOverride =
  '!bg-transparent !border-0 !border-b !border-[rgba(196,170,124,0.28)] !px-0 !text-[#e9e1d2] placeholder:!text-[rgba(203,191,168,0.38)] focus:!outline-none focus:!border-[#c4aa7c] !rounded-none';

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
      className="min-h-screen w-full flex items-center justify-center px-6 py-20"
      style={{
        background: `radial-gradient(120% 90% at 50% 0%, rgb(28,22,17) 0%, ${STAGE_BG} 60%)`,
      }}
    >
      <div className="w-full max-w-xl">
        <h1
          className="text-3xl sm:text-4xl mb-6 text-center"
          style={{
            fontFamily: 'Cinzel, serif',
            letterSpacing: '0.12em',
            color: GOLD,
          }}
        >
          bring your piece home
        </h1>
        <p
          className="font-serif text-[1.0625rem] leading-relaxed text-center mb-12"
          style={{ color: PARCHMENT }}
        >
          If one of Adrian's works rests with you and the atlas does not know it
          yet, this is its way home.
        </p>

        {sent ? (
          <div className="text-center">
            <p
              className="font-serif text-[1.0625rem] leading-relaxed mb-4"
              style={{ color: PARCHMENT }}
            >
              It rests with me now. When I recognize the piece, it will take its
              place among the others, and I will write to you so you can light
              it.
            </p>
            <Link
              to="/atlas"
              className="font-label text-[11px] uppercase tracking-[0.22em] font-semibold transition-colors"
              style={{ color: GOLD }}
            >
              return to the world
            </Link>
          </div>
        ) : !isLoaded ? null : !isSignedIn ? (
          <div className="text-center">
            <p
              className="font-serif text-[1.0625rem] leading-relaxed mb-8"
              style={{ color: PARCHMENT }}
            >
              Claim your piece to begin. Your place is kept under the same name
              you use here.
            </p>
            <SignInTrigger>
              <button
                type="button"
                className="font-label text-xs uppercase tracking-[0.25em] font-semibold px-8 py-4 border transition-colors"
                style={{ color: GOLD, borderColor: 'rgba(196,170,124,0.4)' }}
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
              <span className={labelClass} style={{ color: PARCHMENT_SOFT }}>
                photographs of the piece
              </span>
              <p
                className="font-serif text-sm leading-relaxed mb-4"
                style={{ color: PARCHMENT_SOFT }}
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
                className={labelClass}
                style={{ color: PARCHMENT_SOFT }}
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
              <span className={labelClass} style={{ color: PARCHMENT_SOFT }}>
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
                  className="font-serif text-sm mt-2"
                  style={{ color: PARCHMENT_SOFT }}
                >
                  {formatCityLabel(getCityById(cityId)!)}
                </p>
              )}
            </div>

            {/* Anything else. */}
            <div>
              <label
                htmlFor="homecoming-note"
                className={labelClass}
                style={{ color: PARCHMENT_SOFT }}
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
              <p className="font-serif text-sm" style={{ color: '#d8a48a' }}>
                {error}
              </p>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={submit}
                disabled={!canSend}
                className="font-label text-xs uppercase tracking-[0.25em] font-semibold px-8 py-4 border transition-colors disabled:opacity-40"
                style={{ color: GOLD, borderColor: 'rgba(196,170,124,0.4)' }}
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
