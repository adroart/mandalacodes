import React, { useEffect, useRef, useState } from 'react';
import { useProfile } from '../../lib/profile/context';
import { searchPlaces, type Place } from '../../lib/astrology/places';
import type { ProfileInputs } from '../../lib/profile/storage';

interface ProfileFormProps {
  initial?: ProfileInputs | null;
  onSaved?: () => void;
}

/* 24-hour time entry as plain text. Strip non-digits, cap at 4 digits, and
   insert the colon after the hour so typing "2345" becomes "23:45" and "9" can
   grow into "09:00". No coercion while typing — the value only settles when the
   user has entered it, so typing "23" never jumps to "02". */
function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function isValidTime(value: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return false;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

const ProfileForm: React.FC<ProfileFormProps> = ({ initial, onSaved }) => {
  const { save } = useProfile();
  const [date, setDate] = useState<string>(initial?.date ?? '');
  const [time, setTime] = useState<string>(initial?.time ?? '');
  const [placeQuery, setPlaceQuery] = useState<string>(initial?.place?.label ?? '');
  const [place, setPlace] = useState<Place | null>(initial?.place ?? null);
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchRetry, setSearchRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const hasQuery = placeQuery.trim().length >= 2 && placeQuery !== place?.label;

  // Keep the keyboard-highlighted row scrolled into view inside the list.
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`#profile-place-opt-${activeIndex}`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const onPlaceKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0) {
        e.preventDefault();
        selectPlace(suggestions[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  };

  // A failed download is distinct from a successful search with no matches.
  useEffect(() => {
    let active = true;
    setSearchError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!placeQuery || placeQuery === place?.label) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await searchPlaces(placeQuery, 24);
        if (active) { setSuggestions(results); setActiveIndex(-1); }
      } catch (err) {
        if (active) { setSuggestions([]); setSearchError(err instanceof Error ? err.message : 'City search is unavailable. Try again.'); }
      } finally {
        if (active) setSearching(false);
      }
    }, 180);
    return () => {
      active = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [placeQuery, place, searchRetry]);

  const canSubmit = !!date && isValidTime(time) && !!place && !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !place) return;
    setError(null);
    setSubmitting(true);
    try {
      await save({ date, time, place });
      onSaved?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong building your profile. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const selectPlace = (p: Place) => {
    setPlace(p);
    setPlaceQuery(p.label);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <form className="profile-form" onSubmit={handleSubmit} noValidate>
      <div className="profile-form__field">
        <label htmlFor="profile-date" className="profile-form__label">
          Birth date
        </label>
        <input
          id="profile-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          /* Tab from the date jumps straight to birth time, skipping the native
             calendar button's internal tab stop. */
          onKeyDown={(e) => {
            if (e.key === 'Tab' && !e.shiftKey) {
              e.preventDefault();
              document.getElementById('profile-time')?.focus();
            }
          }}
          className="profile-form__input"
          required
          autoComplete="bday"
        />
      </div>

      <div className="profile-form__field">
        <label htmlFor="profile-time" className="profile-form__label">
          Birth time
        </label>
        {/* Plain text field rather than type=time: the native picker fights
           free 24-hour typing (typing "23" in the hour column gets coerced).
           This accepts digits, auto-inserts the colon, and keeps the same
           HH:MM string the rest of the pipeline expects. */}
        <input
          id="profile-time"
          type="text"
          inputMode="numeric"
          value={time}
          onChange={(e) => setTime(formatTimeInput(e.target.value))}
          className="profile-form__input"
          placeholder="HH:MM"
          maxLength={5}
          autoComplete="off"
          required
          aria-invalid={!!time && !isValidTime(time)}
        />
        <p className="profile-form__help">
          24-hour time, e.g. 23:45. As exact as possible: every minute matters for the moving positions.
        </p>
      </div>

      <div className="profile-form__field">
        <label htmlFor="profile-place" className="profile-form__label">
          Birth place
        </label>
        <input
          id="profile-place"
          type="text"
          value={placeQuery}
          onChange={(e) => {
            setPlaceQuery(e.target.value);
            setPlace(null);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => window.setTimeout(() => setShowSuggestions(false), 150)}
          onKeyDown={onPlaceKeyDown}
          className="profile-form__input"
          placeholder="Type a city, then pick from the list"
          autoComplete="off"
          role="combobox"
          aria-expanded={showSuggestions && suggestions.length > 0}
          aria-controls="profile-place-list"
          aria-activedescendant={activeIndex >= 0 ? `profile-place-opt-${activeIndex}` : undefined}
          required
        />
        {showSuggestions && hasQuery && (
          suggestions.length > 0 ? (
            <ul
              id="profile-place-list"
              ref={listRef}
              className="profile-form__suggestions"
              role="listbox"
            >
              {suggestions.map((s, i) => (
                <li
                  key={`${s.lat}_${s.lng}_${s.tzId}`}
                  id={`profile-place-opt-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                >
                  <button
                    type="button"
                    className={`profile-form__suggestion${i === activeIndex ? ' is-active' : ''}`}
                    onMouseEnter={() => setActiveIndex(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectPlace(s);
                    }}
                  >
                    <span className="profile-form__suggestion-label">{s.label}</span>
                    <span className="profile-form__suggestion-tz">{s.tzId}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="profile-form__suggestions-empty">
              {searchError ?? (searching ? 'Searching cities…' : 'No match yet. Try the nearest larger city or town.')}
              {searchError && <button type="button" className="underline ml-2" onMouseDown={event => event.preventDefault()} onClick={() => setSearchRetry(value => value + 1)}>Retry city search</button>}
            </p>
          )
        )}
        {place && (
          <p className="profile-form__help">
            {place.tzId} resolved from {place.label}
          </p>
        )}
      </div>

      {error && <p className="profile-form__error" role="alert">{error}</p>}

      <button type="submit" className="profile-form__submit" disabled={!canSubmit}>
        {submitting ? 'Building...' : 'Build my profile'}
      </button>

      <style>{`
        .profile-form {
          max-width: 460px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .profile-form__field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          position: relative;
        }
        .profile-form__label {
          font-family: var(--font-ui);
          font-size: 11px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--color-wood-700);
        }
        .profile-form__input {
          font-family: var(--font-ui);
          font-size: 17px;
          color: var(--color-wood-900);
          background: var(--color-paper-50);
          border: 1px solid color-mix(in oklab, var(--color-wood-600) 30%, transparent);
          border-radius: 3px;
          padding: 10px 12px;
          outline: 2px solid transparent;
          outline-offset: 2px;
          transition: border-color 0.2s, outline-color 0.2s;
        }
        .profile-form__input:focus-visible {
          outline-color: var(--color-bronze-500);
          border-color: var(--color-bronze-500);
        }
        .profile-form__input[aria-invalid='true'] {
          border-color: var(--color-danger-border);
        }
        .profile-form__help {
          font-family: var(--font-ui);
          font-size: 11px;
          color: var(--color-wood-600);
        }
        .profile-form__error {
          font-family: var(--font-ui);
          font-size: 12px;
          color: var(--color-danger-text);
        }
        .profile-form__suggestions {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          z-index: 20;
          background: var(--color-paper-50);
          border: 1px solid color-mix(in oklab, var(--color-wood-600) 28%, transparent);
          border-radius: 6px;
          margin: 6px 0 0;
          padding: 4px;
          list-style: none;
          /* Tall enough to show ~9 rows; the index returns up to 24 so the
             list scrolls. min() keeps it inside short viewports (mobile). */
          max-height: min(60vh, 420px);
          overflow-y: auto;
          overscroll-behavior: contain;
          box-shadow: 0 14px 38px -10px rgba(0, 0, 0, 0.32);
        }
        .profile-form__suggestion {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          width: 100%;
          padding: 11px 14px;
          background: transparent;
          border: 0;
          border-radius: 4px;
          text-align: left;
          cursor: pointer;
          transition: background 0.12s;
        }
        .profile-form__suggestion:hover,
        .profile-form__suggestion.is-active {
          background: color-mix(in oklab, var(--color-bronze-400) 16%, transparent);
        }
        .profile-form__suggestion-label {
          font-family: var(--font-ui);
          font-size: 17px;
          line-height: 1.2;
          color: var(--color-wood-900);
        }
        .profile-form__suggestion-tz {
          font-family: var(--font-ui);
          font-size: 10px;
          color: var(--color-wood-600);
          letter-spacing: 0.1em;
        }
        .profile-form__suggestions-empty {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          z-index: 20;
          margin: 6px 0 0;
          padding: 12px 14px;
          background: var(--color-paper-50);
          border: 1px solid color-mix(in oklab, var(--color-wood-600) 28%, transparent);
          border-radius: 6px;
          box-shadow: 0 14px 38px -10px rgba(0, 0, 0, 0.32);
          font-family: var(--font-ui);
          font-size: 12px;
          color: var(--color-wood-600);
        }
        .profile-form__submit {
          align-self: flex-start;
          font-family: var(--font-ui);
          font-size: 11px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--color-paper-50);
          background: var(--color-bronze-600);
          border: 0;
          border-radius: 3px;
          padding: 12px 20px;
          cursor: pointer;
          transition: background 0.2s, opacity 0.2s;
        }
        .profile-form__submit:hover {
          background: var(--color-bronze-700, var(--color-bronze-600));
        }
        .profile-form__submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </form>
  );
};

export default ProfileForm;
