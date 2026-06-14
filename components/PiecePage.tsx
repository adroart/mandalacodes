import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAccount } from '../lib/account/useAccount';
import SignInTrigger from './account/SignInTrigger';
import { FULL_ARCHIVE } from '../data/mockData';
import { CITIES_BY_ID, formatPlaceLabel } from '../data/cities';
import { CARD_BY_NUMBER } from '../data/oracleData';
import { img } from '../utils/cloudinary';
import { ulCardNumber } from '../utils/universalLanguage';
import { HexagramSVG } from './oracle/HexagramGlyph';
import { ordinalLabel } from './atlas/PieceSidePanel';
import {
  loadAtlasState,
  findPublicPiece,
  type PublicPiece,
} from '../lib/atlas/state';
import { loadEditorial } from '../lib/atlas/editorial';
import type { Artwork, PieceEditorial } from '../types';

/* A kindred piece — another Universal Language work sharing a trigram with
 * this one. Drawn from the static archive (not placement-gated like the
 * globe's kinship arcs) so the book always shows the piece's family. */
interface Kin {
  pieceId: string;
  title: string;
  cardNumber: number;
}

/** The trigram pair for a UL piece, via its card number. */
function trigramsFor(art: Artwork): { upper: string; lower: string } | null {
  if (art.series !== 'Universal Language') return null;
  const num = ulCardNumber(art.coverImage);
  if (num == null) return null;
  const card = CARD_BY_NUMBER.get(num);
  if (!card) return null;
  return {
    upper: card.iching.upper_trigram.name,
    lower: card.iching.lower_trigram.name,
  };
}

/**
 * Up to six kindred Universal Language pieces — those sharing a trigram with
 * this one. Mirrors the globe HUD's "Kin" list, but drawn from the whole
 * archive so it reads on the book page even before either piece is placed.
 */
function kinFor(art: Artwork, max = 6): Kin[] {
  const mine = trigramsFor(art);
  if (!mine) return [];
  const out: Kin[] = [];
  for (const other of FULL_ARCHIVE) {
    if (other.id === art.id) continue;
    const t = trigramsFor(other);
    if (!t) continue;
    const shares =
      t.upper === mine.upper ||
      t.upper === mine.lower ||
      t.lower === mine.upper ||
      t.lower === mine.lower;
    if (!shares) continue;
    const num = ulCardNumber(other.coverImage);
    if (num == null) continue;
    out.push({
      pieceId: other.id,
      title: other.title.replace(/\s*-\s*\d+$/, ''),
      cardNumber: num,
    });
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Public piece page — the QR-arrival surface.
 *
 * Route: /piece/:pieceId  (or /piece/:pieceId/:edition)
 *
 * Pre-auth, zero-signup. Shows what a collector sees when they scan the QR on
 * the back of their piece: the artwork, Adrian's story, the edition, the
 * Founding Lights ordinal once claimed, the hexagram for Universal Language
 * pieces, and the *public* history spine — derived only from the public atlas
 * state ("Created 2024 · Placed, Lisbon 2025"). It NEVER shows private events,
 * notes, holder identity, or anything beyond the public projection: the public
 * piece is fetched from /api/atlas with the same seed fallback AtlasPage uses,
 * so a slightly-stale cache still renders.
 *
 * The page's job is to communicate "your piece already has a story; signing in
 * lets you add to it" — so the single CTA opens the existing /atlas/claim flow.
 */

type LoadState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | {
      kind: 'ready';
      piece: PublicPiece;
      art: Artwork;
      /** The artist-written book for this piece, or null if none written yet. */
      editorial: PieceEditorial | null;
    };

/** Spine entry: a single public, non-personal moment in the piece's life. */
interface SpineEntry {
  label: string;
  detail?: string;
}

function cityLabel(cityId: string | null | undefined): string | undefined {
  if (!cityId) return undefined;
  const c = CITIES_BY_ID.get(cityId);
  return c ? formatPlaceLabel(c) : undefined;
}

function yearOf(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : String(d.getUTCFullYear());
}

/**
 * The public history spine — built only from public state + archive metadata.
 * Three honest beats at most: created, placed (or awaiting), claimed. No
 * private events, no notes, no holder. This is the public mirror of the book,
 * not the book itself.
 */
function buildSpine(piece: PublicPiece, art: Artwork): SpineEntry[] {
  const spine: SpineEntry[] = [];

  const createdYear = art.year || undefined;
  spine.push({ label: 'Created', detail: createdYear });

  const place = cityLabel(piece.cityId);
  if (piece.status === 'placed' && place) {
    spine.push({ label: 'Placed', detail: `${place}${yearOf(piece.placedAt) ? ` · ${yearOf(piece.placedAt)}` : ''}` });
  } else if (piece.status === 'unawakened' && place) {
    spine.push({ label: 'At rest', detail: `${place} · awaiting its keeper` });
  } else {
    spine.push({ label: 'Seeking ground', detail: 'not yet placed in the world' });
  }

  if (typeof piece.claimOrdinal === 'number') {
    spine.push({
      label: 'Came to light',
      detail: `the ${ordinalLabel(piece.claimOrdinal)} light`,
    });
  }

  return spine;
}

/**
 * "Request stewardship" (M4) — the self-serve path for whoever holds the
 * physical piece without a pre-issued record: secondary buyers, auction
 * winners, gift recipients, heirs. Signed-in visitors send a request (with
 * an optional evidence note) into the queue — the admin decides for
 * unclaimed pieces, the current holder for claimed ones; nothing binds
 * automatically. Anonymous visitors get a sign-in prompt into the
 * self-owned sign-in modal, staying on this piece.
 */
const RequestStewardship: React.FC<{
  pieceId: string;
  editionNumber?: number;
}> = ({ pieceId, editionNumber }) => {
  const { isSignedIn, fetchAuthed } = useAccount();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetchAuthed('/api/atlas/steward/request-claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pieceId,
          ...(editionNumber !== undefined ? { editionNumber } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <p className="font-serif italic text-base text-stone-700 mt-4 leading-[1.6]">
        Your request is in. The piece's current keeper — or Adrian — will
        review it, and the book opens to you once they approve.
      </p>
    );
  }

  return (
    <div className="mt-4">
      {!isSignedIn && (
        /* A secondary owner (auction, gift, inheritance) is NOT pre-bound by
           Adrian, so the email-based /atlas/claim flow 404s for them. Sign in
           in place with a modal and stay on this piece — once signed in the
           signed-in branch below shows the request-stewardship form, which is
           the right path for them. Never send them to /atlas/claim. */
        <p className="font-serif text-sm text-wood-600 leading-[1.6]">
          Hold this piece but arrived another way — an auction, a gift, an
          inheritance?{' '}
          <SignInTrigger>
            <button
              type="button"
              className="font-label text-[11px] uppercase tracking-[0.18em] font-semibold text-bronze-700 hover:text-bronze-600 transition-colors"
            >
              Sign in to request stewardship →
            </button>
          </SignInTrigger>
        </p>
      )}
      {isSignedIn && (
        !open ? (
          <p className="font-serif text-sm text-wood-600 leading-[1.6]">
            Hold this piece but arrived another way?{' '}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="font-label text-[11px] uppercase tracking-[0.18em] font-semibold text-bronze-700 hover:text-bronze-600 transition-colors"
            >
              Request stewardship →
            </button>
          </p>
        ) : (
          <div className="space-y-3">
            <label
              htmlFor="request-note"
              className="block font-label text-[11px] uppercase tracking-[0.18em] text-wood-600 font-semibold"
            >
              How did it come to you? (optional)
            </label>
            <textarea
              id="request-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Bought at the Vienna auction, lot 12…"
              className="w-full border border-wood-300 bg-white px-4 py-3 font-serif text-base text-wood-900 placeholder:text-wood-400 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 focus:border-bronze-400 resize-y"
            />
            {error && (
              <p className="font-serif italic text-sm text-stone-600">{error}</p>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="inline-block font-label text-xs uppercase tracking-[0.18em] font-semibold text-paper-50 bg-wood-900 hover:bg-wood-800 transition-colors px-6 py-3 disabled:opacity-40"
            >
              {busy ? 'Sending...' : 'Send request'}
            </button>
          </div>
        )
      )}
    </div>
  );
};

/**
 * The piece's photo gallery — cover image leading, any extra photos following.
 * A large active image with a thumbnail rail beneath it; a single photo shows
 * no rail. Keeps the artwork itself uncovered: the active image stands alone on
 * its dark mat, controls sit below it.
 */
const PieceGallery: React.FC<{
  imageIds: string[];
  alt: string;
}> = ({ imageIds, alt }) => {
  const [active, setActive] = useState(0);
  const current = imageIds[active] ?? imageIds[0];

  return (
    <div className="w-full">
      <div className="bg-[#151311] p-4 sm:p-6 overflow-hidden">
        <img
          src={img(current, { w: 1200, crop: 'fit' })}
          alt={alt}
          className="w-full h-auto block"
          loading="eager"
        />
      </div>

      {imageIds.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {imageIds.map((id, i) => (
            <button
              key={`${id}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`View photo ${i + 1}`}
              aria-current={i === active}
              className={`bg-[#151311] p-1 transition-all ${
                i === active
                  ? 'ring-2 ring-bronze-500'
                  : 'ring-1 ring-wood-200 hover:ring-bronze-300'
              }`}
            >
              <img
                src={img(id, { w: 120, h: 120, crop: 'fill' })}
                alt=""
                className="w-14 h-14 sm:w-16 sm:h-16 object-cover block"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const PiecePage: React.FC = () => {
  const { pieceId, edition } = useParams<{ pieceId: string; edition?: string }>();
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    if (!pieceId) {
      setLoad({ kind: 'not-found' });
      return;
    }
    const art = FULL_ARCHIVE.find((a) => a.id === pieceId);
    const editionNumber =
      edition !== undefined && /^\d+$/.test(edition) ? parseInt(edition, 10) : undefined;

    // The page leans on archive metadata for the art; if the piece isn't in
    // the archive there's nothing meaningful to show.
    if (!art) {
      setLoad({ kind: 'not-found' });
      return;
    }

    // Atlas placement and the artist-written book load in parallel; either can
    // be empty and the page still renders from the archive, so the QR never
    // dead-ends.
    Promise.all([loadAtlasState(), loadEditorial()]).then(
      ([state, editorialMap]) => {
        if (!active) return;
        const piece = findPublicPiece(state, pieceId, editionNumber);
        // No public ledger entry yet (or private): still render the artwork and
        // story from the archive as a "seeking ground" piece. Synthesize a
        // minimal public piece.
        const resolved: PublicPiece =
          piece ?? {
            pieceId,
            editionNumber,
            series: art.series,
            category: art.category,
            cityId: null,
            status: 'seeking',
          };
        setLoad({
          kind: 'ready',
          piece: resolved,
          art,
          editorial: editorialMap[pieceId] ?? null,
        });
      },
    );
    return () => {
      active = false;
    };
  }, [pieceId, edition]);

  if (load.kind === 'loading') {
    return (
      <section className="min-h-screen bg-paper-50 flex items-center justify-center px-6">
        <p className="font-serif italic text-lg text-wood-700" aria-live="polite">
          opening the book
        </p>
      </section>
    );
  }

  if (load.kind === 'not-found') {
    return (
      <section className="min-h-screen bg-paper-50 flex flex-col items-center justify-center px-6 text-center">
        <h1
          className="font-serif text-3xl text-wood-900 font-medium mb-4"
          style={{ fontFamily: 'Cinzel, serif', letterSpacing: '0.04em' }}
        >
          This piece isn't on the map yet
        </h1>
        <p className="font-serif text-lg text-wood-700 max-w-md leading-[1.6] mb-8">
          The code you scanned doesn't resolve to a known piece. If you hold one
          of Adrian's works, you can still open its book.
        </p>
        <Link
          to="/atlas/claim"
          className="font-label text-[11px] uppercase tracking-[0.2em] font-semibold text-bronze-700 hover:text-bronze-600 transition-colors"
        >
          Open this piece's book →
        </Link>
      </section>
    );
  }

  const { piece, art, editorial } = load;
  const cardNumber =
    art.series === 'Universal Language' ? ulCardNumber(art.coverImage) : null;
  const card = cardNumber != null ? CARD_BY_NUMBER.get(cardNumber) : undefined;
  const spine = buildSpine(piece, art);

  // The piece's story: the artist-written book wins; otherwise fall back to the
  // archive's long form, then the short placeholder. The editor at /admin/pieces
  // is how the book gets written without touching code.
  const story =
    editorial?.story || art.longDescription || art.description || undefined;
  const cleanTitle = art.title.replace(/\s*-\s*\d+$/, '');

  // Gallery = cover image first, then any extra photos the artist added
  // (archive images, then editorial gallery), de-duped.
  const galleryIds = Array.from(
    new Set([art.coverImage, ...art.images, ...(editorial?.gallery ?? [])]),
  );

  const kin = kinFor(art);

  const editionLine =
    typeof piece.editionNumber === 'number'
      ? `Edition ${piece.editionNumber}`
      : art.edition || undefined;

  // Deep-link back to this piece, framed on the globe.
  const atlasHref = `/atlas?piece=${encodeURIComponent(
    typeof piece.editionNumber === 'number'
      ? `${piece.pieceId}:${piece.editionNumber}`
      : piece.pieceId,
  )}`;

  return (
    <div className="min-h-screen bg-paper-50 text-wood-900">
      <div className="px-6 pb-32 max-w-5xl mx-auto pt-[calc(var(--nav-height)+3rem)] sm:pt-[calc(var(--nav-height)+4rem)]">
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-2 gap-y-1 font-label text-[11px] sm:text-xs uppercase tracking-[0.12em] sm:tracking-[0.2em] text-wood-700 mb-10 sm:mb-14"
        >
          <Link to="/" className="hover:text-wood-900 transition-colors">
            Home
          </Link>
          <span aria-hidden className="text-wood-400">
            /
          </span>
          <Link to="/atlas" className="hover:text-wood-900 transition-colors">
            Atlas
          </Link>
          <span aria-hidden className="text-wood-400">
            /
          </span>
          <span className="text-wood-900">{cleanTitle}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          {/* ── The artwork ─────────────────────────────────────────────── */}
          <PieceGallery
            imageIds={galleryIds}
            alt={`${cleanTitle}${
              cardNumber != null ? `, Universal Language ${cardNumber}` : ''
            }. Original work by Adrian Rasmussen.`}
          />

          {/* ── The story ───────────────────────────────────────────────── */}
          <div className="w-full">
            {piece.series && (
              <p className="font-label text-[11px] uppercase tracking-[0.28em] text-bronze-700 mb-4">
                {piece.series}
              </p>
            )}

            <h1
              className="font-serif text-4xl sm:text-5xl text-wood-900 font-medium leading-[0.98] mb-4"
              style={{ fontFamily: 'Cinzel, serif', letterSpacing: '0.02em' }}
            >
              {cleanTitle}
            </h1>

            {/* Founding light — the artifact. */}
            {typeof piece.claimOrdinal === 'number' && (
              <p className="font-serif italic text-xl text-bronze-700 mb-6">
                The {ordinalLabel(piece.claimOrdinal)} light
              </p>
            )}

            {/* Inline metadata row */}
            {(editionLine || art.dimensions || art.material) && (
              <p className="font-sans text-sm text-wood-700 leading-relaxed mb-7">
                {[editionLine, art.dimensions, art.material]
                  .filter(Boolean)
                  .map((bit, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && (
                        <span aria-hidden className="mx-1.5 text-wood-400">
                          ·
                        </span>
                      )}
                      <span>{bit}</span>
                    </React.Fragment>
                  ))}
              </p>
            )}

            {story && (
              <div className="font-serif text-lg text-wood-800 leading-[1.7] mb-8 whitespace-pre-line">
                {story}
              </div>
            )}

            {/* Materials & making — the editor's prominent note, when written. */}
            {editorial?.materials && (
              <div className="border-t border-wood-200 pt-6 mb-8">
                <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 mb-2">
                  Materials &amp; making
                </p>
                <p className="font-serif text-lg text-wood-800 leading-[1.7] whitespace-pre-line">
                  {editorial.materials}
                </p>
              </div>
            )}

            {/* Hexagram — Universal Language pieces only. */}
            {card && cardNumber != null && (
              <div className="border-t border-wood-200 pt-6 mb-8 flex items-start gap-5">
                <div className="shrink-0 text-bronze-700">
                  <HexagramSVG
                    upper={card.iching.upper_trigram.symbol}
                    lower={card.iching.lower_trigram.symbol}
                    width={48}
                  />
                </div>
                <div>
                  <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 mb-1">
                    The code it carries
                  </p>
                  <p className="font-serif text-lg text-wood-900 leading-snug">
                    {card.iching.hexagram_name} · Hexagram {cardNumber}
                  </p>
                  <Link
                    to={`/universal-language/${cardNumber}`}
                    state={{ ritual: true }}
                    className="font-label text-[11px] uppercase tracking-[0.2em] font-semibold text-bronze-700 hover:text-bronze-600 transition-colors mt-2 inline-block"
                  >
                    Read Code {cardNumber} →
                  </Link>
                </div>
              </div>
            )}

            {/* Provenance — the artist's account of the piece's making + history. */}
            {editorial?.provenance && (
              <div className="border-t border-wood-200 pt-6 mb-8">
                <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 mb-2">
                  Provenance
                </p>
                <p className="font-serif text-lg text-wood-800 leading-[1.7] whitespace-pre-line">
                  {editorial.provenance}
                </p>
              </div>
            )}

            {/* Kin — kindred Universal Language pieces sharing a trigram. */}
            {kin.length > 0 && (
              <div className="border-t border-wood-200 pt-6 mb-8">
                <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 mb-3">
                  Its kin
                </p>
                <ul className="flex flex-wrap gap-x-5 gap-y-2">
                  {kin.map((k) => (
                    <li key={k.pieceId}>
                      <Link
                        to={`/piece/${k.pieceId}`}
                        className="font-serif text-lg text-wood-900 hover:text-bronze-700 transition-colors leading-snug"
                      >
                        {k.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── The public history spine ──────────────────────────────── */}
            <div className="border-t border-wood-200 pt-6 mb-10">
              <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 mb-4">
                Its story so far
              </p>
              <ol className="space-y-3">
                {spine.map((entry, i) => (
                  <li key={i} className="flex items-baseline gap-3">
                    <span
                      aria-hidden
                      className="shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-bronze-400"
                    />
                    <span className="font-serif text-lg text-wood-900 leading-snug">
                      {entry.label}
                      {entry.detail && (
                        <span className="text-wood-600"> · {entry.detail}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
              <p className="font-serif italic text-sm text-wood-500 mt-4 leading-relaxed">
                This is the public page of the piece's book — only what the holder
                has chosen to show. The full record lives with the piece.
              </p>
              {(piece.status === 'placed' || piece.status === 'unawakened') &&
                piece.cityId && (
                  <Link
                    to={atlasHref}
                    className="font-label text-[11px] uppercase tracking-[0.2em] font-semibold text-bronze-700 hover:text-bronze-600 transition-colors mt-4 inline-block"
                  >
                    See it on the globe →
                  </Link>
                )}
            </div>

            {/* ── CTA ───────────────────────────────────────────────────── */}
            <div className="bg-paper-100 border border-wood-200 p-6 sm:p-7">
              <p className="font-serif text-lg text-wood-800 leading-[1.6] mb-5">
                Your piece already has a story. Signing in lets you add to it —
                place it on the map, write its intentions, pass it on.
              </p>
              <Link
                to="/atlas/claim"
                className="inline-block font-label text-xs uppercase tracking-[0.18em] font-semibold text-paper-50 bg-wood-900 hover:bg-wood-800 transition-colors px-6 py-3"
              >
                Open this piece's book
              </Link>
              <RequestStewardship
                pieceId={piece.pieceId}
                editionNumber={piece.editionNumber}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PiecePage;
