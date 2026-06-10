import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FULL_ARCHIVE } from '../data/mockData';
import { CITIES_BY_ID } from '../data/cities';
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
import type { Artwork } from '../types';

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
  | { kind: 'ready'; piece: PublicPiece; art: Artwork };

/** Spine entry: a single public, non-personal moment in the piece's life. */
interface SpineEntry {
  label: string;
  detail?: string;
}

function cityLabel(cityId: string | null | undefined): string | undefined {
  if (!cityId) return undefined;
  const c = CITIES_BY_ID.get(cityId);
  return c ? `${c.city}, ${c.country}` : undefined;
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

    loadAtlasState().then((state) => {
      if (!active) return;
      const piece = findPublicPiece(state, pieceId, editionNumber);
      // The page leans on archive metadata for the art; if the piece isn't in
      // the archive there's nothing meaningful to show.
      if (!art) {
        setLoad({ kind: 'not-found' });
        return;
      }
      // No public ledger entry yet (or private): still render the artwork and
      // story from the archive as a "seeking ground" piece, so the QR never
      // dead-ends. Synthesize a minimal public piece.
      const resolved: PublicPiece =
        piece ?? {
          pieceId,
          editionNumber,
          series: art.series,
          category: art.category,
          cityId: null,
          status: 'seeking',
        };
      setLoad({ kind: 'ready', piece: resolved, art });
    });
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

  const { piece, art } = load;
  const cardNumber =
    art.series === 'Universal Language' ? ulCardNumber(art.coverImage) : null;
  const card = cardNumber != null ? CARD_BY_NUMBER.get(cardNumber) : undefined;
  const spine = buildSpine(piece, art);

  // Adrian's description: prefer the long form, fall back to the short one.
  const description = art.longDescription || art.description || undefined;
  const cleanTitle = art.title.replace(/\s*-\s*\d+$/, '');

  const editionLine =
    typeof piece.editionNumber === 'number'
      ? `Edition ${piece.editionNumber}`
      : art.edition || undefined;

  const heroImage = img(art.coverImage, { w: 1200, crop: 'fit' });

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
          <div className="w-full">
            <div className="bg-[#151311] p-4 sm:p-6 overflow-hidden">
              <img
                src={heroImage}
                alt={`${cleanTitle}${
                  cardNumber != null ? `, Universal Language ${cardNumber}` : ''
                }. Original work by Adrian Rasmussen.`}
                className="w-full h-auto block"
                loading="eager"
              />
            </div>
          </div>

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

            {description && (
              <p className="font-serif text-lg text-wood-800 leading-[1.7] mb-8 whitespace-pre-line">
                {description}
              </p>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PiecePage;
