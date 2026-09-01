import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAccount } from '../lib/account/useAccount';
import SignInTrigger from './account/SignInTrigger';
import { SITE } from '../constants';
import AtlasMovedNotice from './atlas/AtlasMovedNotice';
import {
  atlasFailureMessage,
  readAtlasBoundary,
  type AtlasBoundary,
} from '../lib/atlas/boundary';

/**
 * /make — "Begin your piece": the creation journey's front door.
 *
 * The inspiring surface Adrian asked for (2026-07-26): a stranger arrives
 * from a piece page ("Have yours made" / "Begin your piece") and should feel
 * "I want to make my dream art piece", then know exactly what the click
 * does. Three beats teach the journey (choose its code, shape its form,
 * write its dream); the form is a short note to the studio, answered by
 * Adrian himself. No payment, no cart, no commitment: the beginning of a
 * conversation, in keeping with every other request flow in the atlas.
 *
 * Follows the site theme like the piece page: nightfall by default, warm
 * paper in light mode. Typography matches the oracle reading: Iowan for
 * prose, Cormorant for ceremonial moments, Cinzel on the title.
 */

const LABEL = 'font-label text-[11px] uppercase tracking-[0.2em] text-wood-600';

/** The sizes the studio actually cuts (the archive's real dimensions),
 *  plus the open door. The chosen string is sent as-is. */
const SIZES = [
  '23 in (58 cm) square',
  '35.5 in (90 cm) square',
  '39 in (99 cm) square',
  'Another size (tell us in the note)',
] as const;

const FIELD =
  'w-full border border-wood-300 bg-paper-50 px-3 py-2.5 font-reading text-base text-wood-900 placeholder:text-wood-400 focus:outline-2 focus:outline-bronze-700';

const beats = [
  {
    n: 'I',
    lead: 'Choose its code.',
    body: (
      <>
        Begin from a design that spoke to you, or{' '}
        <Link
          to="/profile"
          className="text-bronze-600 hover:text-bronze-500 transition-colors"
        >
          enter your birth date
        </Link>{' '}
        and find the codes that point to you.
      </>
    ),
  },
  {
    n: 'II',
    lead: 'Shape its form.',
    body: 'Size, woods, palette: decided with the artist, cut layer by layer for your wall.',
  },
  {
    n: 'III',
    lead: 'Write its dream.',
    body: 'When it arrives, you inscribe the dream it will keep, and its light joins the map.',
  },
];

const MakePage: React.FC = () => {
  const [params] = useSearchParams();
  const { isLoaded, isSignedIn, fetchAuthed } = useAccount();

  const prefilledCode = /^([1-9]|[1-5][0-9]|6[0-4])$/.test(params.get('code') ?? '')
    ? (params.get('code') as string)
    : '';
  const pieceId = params.get('piece') ?? '';

  const [code, setCode] = useState(prefilledCode);
  const [size, setSize] = useState<string>(SIZES[0]);
  const [palette, setPalette] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [movedBoundary, setMovedBoundary] = useState<AtlasBoundary | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetchAuthed('/api/atlas/make/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          size,
          ...(code ? { code: parseInt(code, 10) } : {}),
          ...(pieceId ? { pieceId } : {}),
          ...(palette.trim() ? { palette: palette.trim() } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      const boundary = await readAtlasBoundary(res);
      if (boundary) {
        setMovedBoundary(boundary);
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(
          atlasFailureMessage(res.status, data, 'Something went wrong, please try again.'),
        );
        return;
      }
      setSent(true);
    } catch {
      setError('Something went wrong, please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper-100 text-wood-900">
      <div className="px-5 sm:px-6 pb-32 max-w-2xl mx-auto pt-[calc(var(--nav-height)+2.5rem)]">
        {/* ── The invitation ── */}
        <header className="text-center">
          <p className={`${LABEL} text-bronze-600 mb-4`}>The studio</p>
          <h1
            className="font-display text-4xl sm:text-5xl text-wood-900 font-medium leading-[1.05]"
            style={{ fontFamily: 'var(--font-brand)', letterSpacing: '0.02em' }}
          >
            Make yours
          </h1>
          <p className="font-display text-xl text-wood-700 leading-[1.55] mt-6 max-w-lg mx-auto">
            Every piece in the atlas began the same way: someone decided its
            story should exist. Yours can begin here.
          </p>
        </header>

        {/* ── The journey, in three beats ── */}
        <ol className="mt-12 sm:mt-14 space-y-7">
          {beats.map((b) => (
            <li key={b.n} className="flex items-start gap-5 border-t border-wood-300 pt-6">
              <span
                aria-hidden
                className="font-display text-2xl text-bronze-600 leading-none pt-0.5 w-8 shrink-0 text-center"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {b.n}
              </span>
              <p className="font-reading text-lg text-wood-700 leading-[1.6]">
                <span className="font-semibold text-wood-900">{b.lead}</span>{' '}
                {b.body}
              </p>
            </li>
          ))}
        </ol>

        {/* ── The note to the studio ── */}
        <section className="mt-14 border border-wood-200 bg-paper-50/80 p-6 sm:p-8">
          <h2 className={`${LABEL} mb-2`}>The note to the studio</h2>
          <p className="font-reading text-base text-wood-600 leading-[1.6] mb-7">
            A short note: which code, what size, what palette. Adrian replies
            himself within a few days. No payment, no commitment, just the
            beginning of a conversation.
          </p>

          {movedBoundary ? (
            <AtlasMovedNotice boundary={movedBoundary} align="left" />
          ) : sent ? (
            <p className="font-reading text-lg text-wood-800 leading-[1.6]">
              The note is with the studio. Adrian reads every one and will
              reply to your email within a few days. The next line of a
              certificate may now be yours.
            </p>
          ) : !isLoaded ? null : !isSignedIn ? (
            <div>
              <p className="font-reading text-base text-wood-700 leading-[1.6] mb-4">
                Sign in so the reply has somewhere to land.
              </p>
              <SignInTrigger>
                <span className="inline-block font-label text-[11px] uppercase tracking-[0.2em] font-semibold text-paper-50 bg-wood-900 hover:bg-wood-800 transition-colors px-6 py-3 cursor-pointer">
                  Sign in and begin
                </span>
              </SignInTrigger>
              <p className="font-reading text-sm text-wood-600 leading-[1.6] mt-4">
                Prefer plain mail? Write to{' '}
                <a
                  href={`mailto:${SITE.email}`}
                  className="text-bronze-600 hover:text-bronze-500 transition-colors"
                >
                  {SITE.email}
                </a>
                .
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label htmlFor="make-code" className={`${LABEL} block mb-2`}>
                  The code · 1 to 64 · optional
                </label>
                <input
                  id="make-code"
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
                  placeholder="Not sure yet? Leave it open."
                  className={FIELD}
                />
              </div>

              <fieldset>
                <legend className={`${LABEL} mb-2`}>The size</legend>
                <div className="space-y-2">
                  {SIZES.map((s) => (
                    <label
                      key={s}
                      className="flex items-center gap-3 font-reading text-base text-wood-800 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="make-size"
                        checked={size === s}
                        onChange={() => setSize(s)}
                        className="accent-bronze-700"
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="make-palette" className={`${LABEL} block mb-2`}>
                  The palette · optional
                </label>
                <input
                  id="make-palette"
                  type="text"
                  value={palette}
                  onChange={(e) => setPalette(e.target.value)}
                  placeholder="Warm woods, bronze, the room it will live in"
                  className={FIELD}
                  maxLength={300}
                />
              </div>

              <div>
                <label htmlFor="make-note" className={`${LABEL} block mb-2`}>
                  Anything else · optional
                </label>
                <textarea
                  id="make-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  placeholder="The wall it is for, the person it is for, the dream taking shape"
                  className={FIELD}
                  maxLength={1000}
                />
              </div>

              {error && (
                <p className="font-reading text-base text-stone-600" role="alert">
                  {error}
                </p>
              )}

              <div>
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy}
                  className="font-label text-[11px] uppercase tracking-[0.2em] font-semibold text-paper-50 bg-wood-900 hover:bg-wood-800 disabled:opacity-60 transition-colors px-6 py-3"
                >
                  {busy ? 'Sending' : 'Send the note'}
                </button>
              </div>
            </div>
          )}
        </section>

        {pieceId && (
          <p className="font-reading text-base text-wood-600 text-center mt-8">
            <Link
              to={`/piece/${encodeURIComponent(pieceId)}`}
              className="text-bronze-600 hover:text-bronze-500 transition-colors"
            >
              ← Back to the piece you came from
            </Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default MakePage;
