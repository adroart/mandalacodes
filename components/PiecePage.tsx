import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FULL_ARCHIVE } from '../data/mockData';
import { CITIES_BY_ID, formatPlaceLabel } from '../data/cities';
import { CARD_BY_NUMBER } from '../data/oracleData';
import { img } from '../utils/cloudinary';
import { ulCardNumber } from '../utils/universalLanguage';
import { HexagramSVG } from './oracle/HexagramGlyph';
import { ordinalLabel } from './atlas/PieceSidePanel';
import RequestStewardship from './atlas/RequestStewardship';
import {
  loadAtlasState,
  findPublicPiece,
  type PublicPiece,
} from '../lib/atlas/state';
import { buildKinshipIndex } from '../utils/kinship';
import type { PieceContent } from '../utils/pieceContent';
import type { Artwork, PublicAtlasState } from '../types';

/**
 * Public piece page: the QR-arrival surface.
 *
 * Route: /piece/:pieceId  (or /piece/:pieceId/:edition)
 *
 * Pre-auth, zero-signup. Shows what a collector sees when they scan the QR on
 * the back of their piece: the artwork, Adrian's story, the edition, the
 * Founding Lights ordinal once claimed, the hexagram for Universal Language
 * pieces, and the *public* history spine: derived only from the public atlas
 * state ("Created 2024 · Placed, Lisbon 2025"). It NEVER shows private events,
 * notes, holder identity, or anything beyond the public projection: the public
 * piece is fetched from /api/atlas with the same seed fallback AtlasPage uses,
 * so a slightly-stale cache still renders.
 *
 * The page's job is to communicate "your piece already has a story; signing in
 * lets you add to it": so the single CTA opens the existing /atlas/claim flow.
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
  return c ? formatPlaceLabel(c) : undefined;
}

function yearOf(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : String(d.getUTCFullYear());
}

/**
 * Fetch the piece's editorial content (story, gallery, materials,
 * provenance): the mutable layer an admin writes via the editor. Public,
 * no auth, and fails silently: a network error or a pre-migration 503 must
 * never break the piece page, it just renders without the extra content
 * (today's behavior).
 */
async function loadPieceContent(pieceId: string): Promise<PieceContent | null> {
  try {
    const res = await fetch(
      `/api/atlas/piece-content?pieceId=${encodeURIComponent(pieceId)}`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.ok && data.content ? (data.content as PieceContent) : null;
  } catch {
    return null;
  }
}

/**
 * The public history spine: built only from public state + archive metadata.
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
  // Editorial content (story/gallery/materials/provenance) loads independently
  // of the archive + atlas state above — it's an enrichment layer, never a
  // blocker, so it starts null and simply fills in once (if) it arrives.
  const [content, setContent] = useState<PieceContent | null>(null);
  // The full public atlas state, kept for the kin constellation below. Same
  // load the piece itself comes from; no extra fetch.
  const [atlasState, setAtlasState] = useState<PublicAtlasState | null>(null);

  useEffect(() => {
    if (!pieceId) return;
    let active = true;
    loadPieceContent(pieceId).then((c) => {
      if (active) setContent(c);
    });
    return () => {
      active = false;
    };
  }, [pieceId]);

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
      setAtlasState(state);
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

  /* Kin constellation: what the globe shows for this piece, on its own page.
     Built from the already-loaded public state; same index the atlas builds. */
  const kinEntries = useMemo(() => {
    if (!atlasState || !pieceId) return [];
    const editionNumber =
      edition !== undefined && /^\d+$/.test(edition) ? parseInt(edition, 10) : undefined;
    const selfKey = `${pieceId}:${editionNumber ?? 0}`;
    const index = buildKinshipIndex(atlasState, CITIES_BY_ID, FULL_ARCHIVE);
    const pairs = index.pairsByKey.get(selfKey) ?? [];
    return pairs
      .slice()
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 6)
      .map((pair) => {
        const otherKey = pair.aKey === selfKey ? pair.bKey : pair.aKey;
        const other = index.nodes.get(otherKey);
        // Same thread naming as the atlas HUD: "Heaven (Ch'ien)" → "Heaven".
        const thread = pair.sharedTrigram
          ? `${pair.sharedTrigram.replace(/\s*\(.*\)$/, '')} thread`
          : '';
        return {
          key: otherKey,
          title: other?.title ?? otherKey,
          thread,
          atlasParam: otherKey.replace(/:0$/, ''),
        };
      });
  }, [atlasState, pieceId, edition]);

  /* Holder's chart element (M5) — the same public endpoint the atlas HUD
     uses; returns chart: null unless the steward opted into Ring 3. */
  const [holderElement, setHolderElement] = useState<string | null>(null);
  useEffect(() => {
    setHolderElement(null);
    if (load.kind !== 'ready' || load.piece.status !== 'placed') return;
    let active = true;
    const params = new URLSearchParams({ pieceId: load.piece.pieceId });
    if (typeof load.piece.editionNumber === 'number') {
      params.set('editionNumber', String(load.piece.editionNumber));
    }
    fetch(`/api/atlas/holder-chart?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { chart?: { element?: string } | null } | null) => {
        if (active) setHolderElement(data?.chart?.element ?? null);
      })
      .catch(() => {
        /* quiet: the line simply doesn't render */
      });
    return () => {
      active = false;
    };
  }, [load]);

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

  // Adrian's description: the editor's story (when written) replaces the
  // placeholder — prefer it, then the long form, then the short one.
  const description = content?.story || art.longDescription || art.description || undefined;
  const cleanTitle = art.title.replace(/\s*-\s*\d+$/, '');
  const galleryImages = content?.images ?? [];

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
          {/* ── The artwork, as the certificate's plate ─────────────────── */}
          <div className="w-full lg:sticky lg:top-[calc(var(--nav-height)+2rem)]">
            <div className="relative border border-wood-300 p-2.5 sm:p-3">
              {/* Corner marks: the certificate's quiet engraving. */}
              {(['top-0 left-0 border-t border-l', 'top-0 right-0 border-t border-r',
                 'bottom-0 left-0 border-b border-l', 'bottom-0 right-0 border-b border-r'] as const).map((pos) => (
                <span
                  key={pos}
                  aria-hidden
                  className={`absolute w-4 h-4 border-bronze-700/70 ${pos}`}
                  style={{ margin: '-1px' }}
                />
              ))}
              <div className="bg-[#151311] p-4 sm:p-7 overflow-hidden">
                <img
                  src={heroImage}
                  alt={`${cleanTitle}${
                    cardNumber != null ? `, Universal Language ${cardNumber}` : ''
                  }. Original work by Adrian Rasmussen.`}
                  className="w-full h-auto block"
                  loading="eager"
                />
              </div>
              {/* Plate caption: set like an engraving beneath the work. */}
              <div className="pt-3 pb-1 text-center">
                <p className="font-label text-[10px] uppercase tracking-[0.3em] text-wood-700">
                  {[cleanTitle, piece.series, editionLine].filter(Boolean).join('  ·  ')}
                </p>
              </div>
            </div>

            {/* Photo gallery: extra images Adrian has added via the admin
                editor. Absent for most pieces today; renders nothing when
                empty, so the page looks exactly as it does now. */}
            {galleryImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {galleryImages.map((publicId, i) => (
                  <a
                    key={publicId}
                    href={img(publicId, { w: 1600, crop: 'fit' })}
                    target="_blank"
                    rel="noreferrer"
                    className="block bg-[#151311] overflow-hidden"
                  >
                    <img
                      src={img(publicId, { w: 400, h: 400, crop: 'fill' })}
                      alt={`${cleanTitle}, additional view ${i + 1}`}
                      className="w-full h-full object-cover block"
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
            )}
            <p className="font-serif italic text-sm text-wood-500 text-center mt-4 leading-relaxed">
              This page is the certificate of the physical work: page one of a
              book that never closes.
            </p>
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

            {/* Founding light: the artifact. */}
            {typeof piece.claimOrdinal === 'number' && (
              <div className="mb-6">
                <p className="font-serif italic text-xl text-bronze-700">
                  The {ordinalLabel(piece.claimOrdinal)} light
                </p>
                <p className="font-serif italic text-sm text-wood-600 leading-snug mt-1">
                  A founding light marks the order in which a piece was claimed by its keeper.
                </p>
              </div>
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

            {/* Materials · provenance: the editor's expanded notes, shown
                only when Adrian has written them. */}
            {(content?.materials || content?.provenance) && (
              <div className="border-t border-wood-200 pt-6 mb-8 space-y-5">
                {content?.materials && (
                  <div>
                    <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 mb-1">
                      Materials
                    </p>
                    <p className="font-serif text-base text-wood-800 leading-[1.6] whitespace-pre-line">
                      {content.materials}
                    </p>
                  </div>
                )}
                {content?.provenance && (
                  <div>
                    <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 mb-1">
                      Provenance
                    </p>
                    <p className="font-serif text-base text-wood-800 leading-[1.6] whitespace-pre-line">
                      {content.provenance}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Hexagram: Universal Language pieces only. */}
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

            {/* ── The dream the piece carries (keeper-shared, public) ───── */}
            {piece.intention && (
              <div className="border-t border-wood-200 pt-6 mb-8">
                <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 mb-1">
                  Held with a dream
                </p>
                <p className="font-serif italic text-lg text-wood-800 leading-[1.6]">
                  {piece.intention}
                </p>
              </div>
            )}

            {/* ── Kin constellation: what the globe shows for this piece ── */}
            {kinEntries.length > 0 && (
              <div className="border-t border-wood-200 pt-6 mb-8">
                <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 mb-3">
                  Its kin on the map
                </p>
                <ul className="space-y-2">
                  {kinEntries.map((k) => (
                    <li key={k.key}>
                      <Link
                        to={`/atlas?piece=${encodeURIComponent(k.atlasParam)}`}
                        className="font-serif text-lg text-wood-900 leading-snug hover:text-bronze-700 transition-colors"
                      >
                        {k.title}
                        {k.thread && (
                          <span className="text-wood-600"> · {k.thread}</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Holder's chart element (Ring 3, derived, non-identifying) ── */}
            {holderElement && piece.status === 'placed' && (
              <div className="border-t border-wood-200 pt-6 mb-8">
                <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 mb-1">
                  The hands it rests in
                </p>
                <p className="font-serif text-lg text-wood-900 leading-snug">
                  Held by a chart of {holderElement}
                </p>
              </div>
            )}

            {/* ── The public history spine: the book's open pages ──────── */}
            <div className="border-t border-wood-200 pt-6 mb-10">
              <p className="font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 mb-5">
                Its story so far
              </p>
              <ol className="relative ml-[3px] border-l border-wood-300 space-y-5 pb-1">
                {spine.map((entry, i) => (
                  <li key={i} className="relative pl-6">
                    <span
                      aria-hidden
                      className="absolute left-0 top-[0.55em] w-[7px] h-[7px] rounded-full bg-bronze-400"
                      style={{ transform: 'translateX(-4px)' }}
                    />
                    <span className="font-serif text-lg text-wood-900 leading-snug">
                      {entry.label}
                      {entry.detail && (
                        <span className="text-wood-600"> · {entry.detail}</span>
                      )}
                    </span>
                  </li>
                ))}
                <li className="relative pl-6">
                  <span
                    aria-hidden
                    className="absolute left-0 top-[0.55em] w-[7px] h-[7px] rounded-full border border-wood-400 bg-paper-50"
                    style={{ transform: 'translateX(-4px)' }}
                  />
                  <span className="font-serif italic text-lg text-wood-500 leading-snug">
                    The next page is unwritten
                  </span>
                </li>
              </ol>

              {/* The ledger seal: quiet, and it goes somewhere. */}
              <div className="mt-7 border border-wood-200 bg-paper-100/60 px-5 py-4 flex items-center gap-4">
                <span
                  aria-hidden
                  className="shrink-0 w-9 h-9 rounded-full border border-bronze-700/50 flex items-center justify-center"
                >
                  <span
                    className="font-serif text-sm text-bronze-700"
                    style={{ fontFamily: 'Cinzel, serif' }}
                  >
                    {typeof piece.claimOrdinal === 'number' ? piece.claimOrdinal : '·'}
                  </span>
                </span>
                <span className="font-serif text-sm text-wood-700 leading-snug">
                  Recorded in the living ledger. Each page is sealed against the
                  one before it, and the holder can always carry the whole book
                  away.
                  {piece.status === 'placed' && (
                    <>
                      {' '}
                      <Link
                        to={`/atlas?piece=${encodeURIComponent(
                          `${piece.pieceId}${
                            typeof piece.editionNumber === 'number'
                              ? `:${piece.editionNumber}`
                              : ''
                          }`,
                        )}`}
                        className="font-label text-[10px] uppercase tracking-[0.18em] font-semibold text-bronze-700 hover:text-bronze-600 transition-colors whitespace-nowrap"
                      >
                        See it among the others →
                      </Link>
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* ── CTA ───────────────────────────────────────────────────── */}
            <div className="bg-paper-100 border border-wood-200 p-6 sm:p-7">
              <p className="font-serif text-lg text-wood-800 leading-[1.6] mb-5">
                Your piece already has a story. Signing in lets you add to it :
                place it on the map, write its intentions, pass it on.
              </p>
              {/* The loud button carries the piece: an unregistered visitor
                  who clicks it lands on the recovery form in StewardClaim's
                  no-record branch, not a dead-end. */}
              <Link
                to={`/atlas/claim?piece=${encodeURIComponent(piece.pieceId)}${
                  typeof piece.editionNumber === 'number'
                    ? `:${piece.editionNumber}`
                    : ''
                }`}
                className="inline-block font-label text-xs uppercase tracking-[0.18em] font-semibold text-paper-50 bg-wood-900 hover:bg-wood-800 transition-colors px-6 py-3"
              >
                Open this piece's book
              </Link>
              <p className="font-serif text-sm text-wood-600 mt-3 leading-[1.6]">
                Sign in with the email your piece was registered to.
              </p>
              {/* The second path, visible as a labeled alternative rather
                  than a footnote: for the holder who was never
                  pre-registered. */}
              <div className="mt-5 pt-4 border-t border-wood-200">
                <RequestStewardship
                  pieceId={piece.pieceId}
                  editionNumber={piece.editionNumber}
                  leadIn="Came to it another way? An auction, a gift, an inheritance:"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PiecePage;
