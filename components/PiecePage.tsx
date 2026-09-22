import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { FULL_ARCHIVE } from '../data/mockData';
import { CITIES_BY_ID, formatPlaceLabel } from '../data/cities';
import { CARD_BY_NUMBER } from '../data/oracleData';
import { img } from '../utils/media';
import { ulCardNumber } from '../utils/universalLanguage';
import { pieceCode } from '../utils/pieceCode';
import { stewardOrdinalLabel } from '../utils/inscriptions';
import { HexagramSVG } from './oracle/HexagramGlyph';
import { ordinalLabel } from './atlas/PieceSidePanel';
import ArtworkPlate from './atlas/ArtworkPlate';
import DreamSignature from './atlas/DreamSignature';
import {
  loadAtlasState,
  findPublicPiece,
  type PublicPiece,
} from '../lib/atlas/state';
import ArtworkDesignPage from './ArtworkDesignPage';
import { artDesignHref, artInstanceHref, ART_ORIGIN } from '../lib/atlas/artSite';
import type { PublicCatalogEntry } from '../utils/catalog';
import { buildKinshipIndex } from '../utils/kinship';
import type { PieceContent } from '../utils/pieceContent';
import type { Artwork, LedgerEvent, PublicAtlasState } from '../types';

/**
 * Public piece page: the QR-arrival surface — the treasure, not a document.
 *
 * Route: /piece/:pieceId  (or /piece/:pieceId/:edition)
 *
 * Pre-auth, zero-signup. What a keeper sees when they scan the QR on the back
 * of their piece: a fine legacy certificate. The artwork crowns it; beneath it
 * one composed certificate object carries the sigil, the founding-light
 * ordinal (the permanent, tamper-evident number), the dream at display size,
 * the anchoring city, the lineage of keepers, and the ledger seal. Directly
 * beneath it, "How this works" teaches the whole system in three short
 * statements, and everything else hangs on ONE connected ledger line ("The
 * life of this piece"): what has happened, what it carries (code, kin), and
 * what is still unwritten — the hollow marks that carry the invitations.
 * The page ends on one band with two doors (claim it / have one made).
 * It NEVER shows private events,
 * notes, or holder identity: everything comes from Adrian-Website's canonical
 * public projection. When that source is unavailable, the page says so
 * explicitly.
 *
 * Register: the page follows the site theme and DEFAULTS DARK (the site
 * default): nightfall paper, cream ink, antique gold — the same register as
 * the oracle reading. Light mode is one sun-toggle away and renders the
 * warm-paper daybook. Typography matches the reading's contract: Iowan
 * (font-reading) for prose, Cormorant (font-reading) for ceremonial
 * moments, Cinzel only on the title.
 */

/**
 * One label style, one link style, one card style. Every small-caps label
 * shares a single size, tracking and color; bronze is reserved for interactive
 * text and the single series eyebrow. Enforcing these constants is what makes
 * the page read as one certificate instead of a stack of fragments.
 */
const LABEL = 'font-label text-[11px] uppercase tracking-[0.2em] text-wood-600';
const LINK =
  'font-label text-[11px] uppercase tracking-[0.2em] font-semibold text-bronze-600 hover:text-bronze-500 transition-colors';
const CARD = 'border border-wood-200 bg-paper-100/60';
const BUTTON =
  'inline-block font-label text-[11px] uppercase tracking-[0.2em] font-semibold text-paper-50 bg-wood-900 hover:bg-wood-800 transition-colors px-6 py-3';

/** The hairline rule the certificate is ruled with. */
const Rule: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span
    aria-hidden
    className={`block h-px w-full bg-wood-300/70 ${className}`}
  />
);

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'not-found' }
  | {
      kind: 'ready';
      piece: PublicPiece;
      art: Artwork;
      /** The public catalog row, when one exists — carries status and (for an
       *  'available' piece) the public price + acquire link. */
      catalog: PublicCatalogEntry | null;
    };

/** Spine entry: a single public, non-personal moment in the piece's life. */
interface SpineEntry {
  label: string;
  detail?: string;
}

/**
 * Build a minimal Artwork for a piece that is in the public atlas state but
 * absent from FULL_ARCHIVE — a real, shipped piece whose catalog row has not
 * landed yet. A scanned QR on a shipped piece may NEVER dead-end (the forever
 * contract): it renders a certificate named by its sigil, its series/category
 * from public state, no hexagram block, and the ArtworkPlate's warm plate
 * fallback (no coverImage). The moment the catalog row lands, the real Artwork
 * wins with zero code change.
 */
function fallbackArtFromPublic(piece: PublicPiece): Artwork {
  const sigil = pieceCode({
    pieceId: piece.pieceId,
    series: piece.series,
    category: piece.category,
  });
  return {
    id: piece.pieceId,
    title: sigil, // title falls back to the sigil
    category: piece.category ?? '',
    series: piece.series,
    coverImage: '', // no plate image → ArtworkPlate renders its warm fallback
    images: [],
    description: '',
    year: '',
    availability: 'MADE_TO_ORDER',
  };
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
 * never break the piece page, it just renders without the extra content.
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
    spine.push({ label: 'On display', detail: place });
  } else {
    spine.push({ label: 'Seeking ground', detail: 'waiting for its first home on the map' });
  }

  if (typeof piece.claimOrdinal === 'number') {
    spine.push({
      label: 'Came to light',
      detail: `the ${ordinalLabel(piece.claimOrdinal)} light`,
    });
  }

  return spine;
}

const PhysicalPiecePage: React.FC = () => {
  const { pieceId, edition } = useParams<{ pieceId: string; edition?: string }>();
  const navigate = useNavigate();
  /* Is there somewhere inside the app to step back to? react-router stamps an
     incrementing idx on every history entry it creates, so a positive idx means
     this page was opened from another page of the site rather than cold (a
     shared link, a QR scan). MUST be read here, above the loading and
     not-found early returns below: hooks after a conditional return change the
     hook count between renders and React tears the page down with "Rendered
     more hooks than during the previous render". */
  const routerIdx = (window.history.state as { idx?: number } | null)?.idx;
  const cameFromApp = typeof routerIdx === 'number' ? routerIdx > 0 : window.history.length > 1;
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [content, setContent] = useState<PieceContent | null>(null);
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
    if (!pieceId || (edition !== undefined && (!/^\d+$/.test(edition) || !Number.isSafeInteger(Number(edition)) || Number(edition) < 1))) {
      setLoad({ kind: 'not-found' });
      return;
    }
    const art = FULL_ARCHIVE.find((a) => a.id === pieceId);
    const editionNumber =
      edition !== undefined && /^\d+$/.test(edition) ? parseInt(edition, 10) : undefined;

    loadAtlasState()
      .then((state) => {
        if (!active) return;
        setAtlasState(state);
        const piece = findPublicPiece(state, pieceId, editionNumber);
        // An explicit edition must resolve to an actual public identity.
        // Catalogue presence alone never stands in for an issued object.
        if (!piece) {
          setLoad({ kind: 'not-found' });
          return;
        }
        setLoad({ kind: 'ready', piece, art: art ?? fallbackArtFromPublic(piece), catalog: null });
      })
      .catch(() => {
        if (active) setLoad({ kind: 'error' });
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

  if (load.kind === 'loading') {
    return (
      <section className="min-h-screen bg-paper-100 flex items-center justify-center px-6">
        <p className={`${LABEL} text-wood-500`} aria-live="polite">
          Opening the certificate
        </p>
      </section>
    );
  }

  if (load.kind === 'error') {
    return (
      <section className="min-h-screen bg-paper-100 flex flex-col items-center justify-center px-6 text-center">
        <h1
          className="font-display text-3xl text-wood-900 font-medium mb-4"
          style={{ fontFamily: 'var(--font-brand)', letterSpacing: '0.04em' }}
        >
          The Atlas record is briefly out of reach.
        </h1>
        <p className="font-reading text-lg text-wood-700 max-w-md leading-[1.6] mb-8">
          We could not reach the canonical record. Please try again shortly.
        </p>
        <Link to="/atlas" className={LINK}>
          Return to the Atlas →
        </Link>
      </section>
    );
  }

  if (load.kind === 'not-found') {
    return (
      <section className="min-h-screen bg-paper-100 flex flex-col items-center justify-center px-6 text-center">
        <h1
          className="font-display text-3xl text-wood-900 font-medium mb-4"
          style={{ fontFamily: 'var(--font-brand)', letterSpacing: '0.04em' }}
        >
          This physical piece could not be found
        </h1>
        <p className="font-reading text-lg text-wood-700 max-w-md leading-[1.6] mb-8">
          This link does not resolve to a public physical record. Collector
          registration is not open here.
        </p>
        <div className="flex flex-col items-center gap-4">
          <Link to="/atlas/claim" className={LINK}>
            Registration information →
          </Link>
          {/* The homecoming door — the single highest-leverage line in the
              redesign: the launch letter will send exactly these people here. */}
          <Link to="/atlas/homecoming" className={LINK}>
            About an unlisted piece →
          </Link>
        </div>
      </section>
    );
  }

  const { piece, art, catalog } = load;
  const cardNumber =
    art.series === 'Universal Language' ? art.cardNumber ?? null : null;
  const card = cardNumber != null ? CARD_BY_NUMBER.get(cardNumber) : undefined;
  const spine = buildSpine(piece, art);

  // The story prose. The archive's "Number N in the ... series." placeholder
  // earns no ink: a page fighting reader fatigue only prints real writing.
  const rawStory = content?.story || art.longDescription || art.description || '';
  const story = /^Number \d+ in the .+ series\.$/.test(rawStory.trim())
    ? undefined
    : rawStory || undefined;
  const cleanTitle = art.title.replace(/\s*-\s*\d+$/, '');
  const galleryImages = content?.images ?? [];

  const editionLine =
    typeof piece.editionNumber === 'number'
      ? `Edition ${piece.editionNumber}`
      : art.edition || undefined;

  const heroImage = art.coverImage ? img(art.coverImage, { w: 1200, crop: 'fit' }) : null;

  const sigil = pieceCode({
    pieceId: piece.pieceId,
    series: piece.series ?? art.series,
    category: piece.category ?? art.category,
    cardNumber: cardNumber ?? undefined,
    isSignaturePiece: art.isSignaturePiece,
    sigilNumber: art.sigilNumber,
  });

  const claimed = typeof piece.claimOrdinal === 'number';
  const seeking = piece.status === 'seeking' || piece.status === 'unawakened';
  const anchoredCity = cityLabel(piece.cityId);
  // The lineage vocabulary derives from the ledger's own attribution words
  // ("first steward"…) softened to the keeper's voice. Public state carries no
  // transfer count, so the certificate names the founding keeper honestly.
  const lineageLine = claimed
    ? `In the hands of its ${stewardOrdinalLabel(1).replace('steward', 'keeper')}`
    : null;

  const claimHref = `/atlas/claim?piece=${encodeURIComponent(piece.pieceId)}${
    typeof piece.editionNumber === 'number' ? `:${piece.editionNumber}` : ''
  }`;
  // The two doors. A catalog row marked 'available' means a finished piece is
  // waiting in the studio: its acquire link is the "take it home" door. In
  // every other unclaimed state the door is the making journey.
  const acquireUrl =
    catalog?.status === 'available' ? catalog.acquireUrl : undefined;
  const makeHref = `/make?piece=${encodeURIComponent(piece.pieceId)}${
    cardNumber != null ? `&code=${cardNumber}` : ''
  }`;
  const atlasHref = `/atlas?piece=${encodeURIComponent(
    `${piece.pieceId}${
      typeof piece.editionNumber === 'number' ? `:${piece.editionNumber}` : ''
    }`,
  )}`;

  return (
    <div className="min-h-screen bg-paper-100 text-wood-900">
      <div className="px-5 sm:px-6 pb-32 max-w-3xl mx-auto pt-[calc(var(--nav-height)+1rem)] sm:pt-[calc(var(--nav-height)+1.75rem)]">
        {/* The way back, and then the breadcrumb.

            A reader who opened this from a light on the atlas wants to shut the
            book and be returned to the light they were standing at, not to a
            fresh globe with nothing selected (Adrian, 2026-07-26). The
            breadcrumb's "Atlas" link cannot do that: it is a forward navigation
            to a bare /atlas. So when we arrived from inside the app, step back
            through history, which lands on the atlas with the piece still open.
            A cold arrival (a shared link, a QR scan) has no history to step
            into, so it gets the plain link instead. */}
        {cameFromApp && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-4 -ml-1 flex items-center gap-2 px-1 py-1 font-label text-[11px] uppercase tracking-[0.16em] text-wood-600 hover:text-wood-900 transition-colors"
          >
            <span aria-hidden className="text-[15px] leading-none">←</span>
            close the book
          </button>
        )}

        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-2 gap-y-1 font-label text-[11px] uppercase tracking-[0.14em] text-wood-600 mb-5 sm:mb-7"
        >
          <Link to="/" className="hover:text-wood-900 transition-colors">
            Home
          </Link>
          <span aria-hidden className="text-wood-400">/</span>
          <Link to="/atlas" className="hover:text-wood-900 transition-colors">
            Atlas
          </Link>
          <span aria-hidden className="text-wood-400">/</span>
          <span className="text-wood-900">{cleanTitle}</span>
        </nav>

        {/* ═══════════════════ THE CERTIFICATE ═══════════════════
            Warm paper, engraved grammar, generous margins. The artwork crowns
            it; one composed object carries the sigil, the ordinal, the dream,
            the city, the lineage, and the seal. */}
        <article className="relative bg-paper-50 border border-wood-300 shadow-[0_1px_40px_-12px_rgba(39,34,25,0.25)] px-6 py-9 sm:px-12 sm:py-14">
          {/* Corner marks: the certificate's quiet engraving. */}
          {(['top-0 left-0 border-t border-l', 'top-0 right-0 border-t border-r',
             'bottom-0 left-0 border-b border-l', 'bottom-0 right-0 border-b border-r'] as const).map((pos) => (
            <span
              key={pos}
              aria-hidden
              className={`absolute w-6 h-6 border-bronze-500/60 ${pos}`}
              style={{ margin: '5px' }}
            />
          ))}

          {/* ── The artwork, the crown of the document ── */}
          <div className="mx-auto w-full max-w-[17rem] sm:max-w-md">
            <div className="bg-[#151311] p-3 sm:p-4 shadow-[0_2px_24px_-8px_rgba(0,0,0,0.55)]">
              <ArtworkPlate
                src={heroImage}
                alt={`${cleanTitle}${
                  cardNumber != null ? `, Universal Language ${cardNumber}` : ''
                }. Made by hand by Adrian Rasmussen.`}
                title={cleanTitle}
                loading="eager"
              />
            </div>
            {editionLine && (
              <p className="font-label text-[10px] uppercase tracking-[0.3em] text-wood-600 text-center pt-3">
                {editionLine}
              </p>
            )}
          </div>

          {/* ── Series eyebrow, title, sigil ── */}
          <div className="text-center mt-9 sm:mt-11">
            {(piece.series ?? art.series) && (
              <p className={`${LABEL} text-bronze-600 mb-3`}>
                {piece.series ?? art.series}
              </p>
            )}
            <h1
              className="font-display text-4xl sm:text-5xl text-wood-900 font-medium leading-[1.02]"
              style={{ fontFamily: 'var(--font-brand)', letterSpacing: '0.02em' }}
            >
              {cleanTitle}
            </h1>
            <p className="font-label text-[12px] uppercase tracking-[0.32em] text-wood-500 mt-4">
              {sigil}
            </p>
            {/* The stranger's first ground: one plain sentence that names the
                maker and what this page is, before any invented word lands. */}
            <p className="font-reading text-[15px] text-wood-600 leading-[1.6] max-w-md mx-auto mt-5">
              Made by hand by Adrian Rasmussen. This is a public summary of
              this physical piece. Its canonical Piece Record is held on the artist site.
            </p>
          </div>

          {/* ── The invitation band: QR arrivals meet the door in the first
              screenful, not after 1,800 pixels of scholarship. ── */}
          {seeking && (
            <div className="mt-8 text-center">
              <div className="mx-auto max-w-md border-y border-wood-300 py-5">
                {acquireUrl ? (
                  <>
                    <p className="font-display text-2xl sm:text-[1.75rem] text-wood-800 leading-[1.3]">
                      This piece is finished and waiting in the studio. It can
                      be on your wall within the week.{' '}
                      <a
                        href={acquireUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-bronze-600 hover:text-bronze-500 transition-colors whitespace-nowrap"
                      >
                        Take it home →
                      </a>
                    </p>
                    <p className="font-reading text-base text-wood-600 leading-[1.5] mt-4">
                      Not the right size or palette?{' '}
                      <Link
                        to={makeHref}
                        className="text-bronze-600 hover:text-bronze-500 transition-colors whitespace-nowrap"
                      >
                        Have yours made →
                      </Link>
                    </p>
                  </>
                ) : (
                  <p className="font-display text-2xl sm:text-[1.75rem] text-wood-800 leading-[1.3]">
                    This design is waiting to be made. Yours would be cut layer
                    by layer: your size, your palette, your dream sealed into
                    it.{' '}
                    <Link
                      to={makeHref}
                      className="text-bronze-600 hover:text-bronze-500 transition-colors whitespace-nowrap"
                    >
                      Begin your piece →
                    </Link>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── The founding-light ordinal: the prize. A permanent,
              tamper-evident number nobody can ever take. ── */}
          {claimed && (
            <div className="mt-10 sm:mt-12 text-center">
              <p className={`${LABEL} text-bronze-600 mb-2`}>Founding light</p>
              <p
                className="font-display text-wood-900 font-medium leading-none"
                style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(3.5rem, 13vw, 6rem)' }}
              >
                {piece.claimOrdinal}
              </p>
              <p className="font-display text-lg text-wood-600 mt-3">
                the {ordinalLabel(piece.claimOrdinal as number)} light of the constellation
              </p>
              <p className="font-reading text-sm text-wood-500 mt-1">
                Each claimed piece receives its number in the order it came to
                light. It can never change and never be taken away.
              </p>
            </div>
          )}

          {/* ── The dream it carries: the centerpiece, as a calm reading block
              (the recentering, 2026-07-18 — the ordinal stays the monumental
              element; the dream reads at a quiet 22-24px). ── */}
          {piece.intention && (
            <div className="mt-10 sm:mt-12">
              <Rule className="mx-auto max-w-[5rem]" />
              <p
                className="font-display text-wood-900 text-center leading-[1.5] mt-8 whitespace-pre-line"
                style={{ fontSize: 'clamp(1.375rem, 2.4vw, 1.5rem)' }}
              >
                {piece.intention}
              </p>
              {/* The keeper's signature: one quiet line under the dream, a link
                  out when they offered one. Rides only a public dream. */}
              <DreamSignature
                signedBy={piece.signedBy}
                tone="paper"
                align="center"
                className="mt-5"
              />
              <Rule className="mx-auto max-w-[5rem] mt-8" />
            </div>
          )}

          {/* ── Where the piece is alive + the lineage of keepers ── */}
          {(anchoredCity || lineageLine) && (
            <div className="mt-9 sm:mt-11 text-center space-y-1.5">
              {anchoredCity && (
                <p className="font-display text-xl text-wood-800">
                  alive in {anchoredCity}
                </p>
              )}
              {lineageLine && (
                <p className="font-reading text-lg text-wood-600">{lineageLine}</p>
              )}
            </div>
          )}

          {/* ── The signatures: a certificate ends in named hands. The
              maker's line is signed; the keeper's line is the invitation
              embodied — ruled and empty until someone claims it, then
              carrying their public signature (or the quiet ordinal). ── */}
          <div className="mt-11 sm:mt-14 mx-auto max-w-md grid grid-cols-2 gap-8 sm:gap-12 text-center">
            <div>
              <p
                className="font-display text-lg text-wood-900 leading-none pb-2"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}
              >
                Adrian Rasmussen
              </p>
              <Rule />
              <p className={`${LABEL} mt-2`}>Maker</p>
            </div>
            <div>
              <p
                className="font-display text-lg text-wood-900 leading-none pb-2"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}
              >
                {claimed ? (piece.signedBy?.name ?? 'Its first keeper') : ' '}
              </p>
              <Rule />
              <p className={`${LABEL} mt-2`}>
                {claimed ? 'Keeper' : 'Awaiting its keeper'}
              </p>
            </div>
          </div>

          {/* ── The ledger seal: the recorded-in-the-living-ledger mark,
              elevated into a proper seal. ── */}
          <div className="mt-11 sm:mt-14 flex flex-col items-center text-center">
            <span
              aria-hidden
              className="w-16 h-16 rounded-full border border-bronze-500/60 flex items-center justify-center relative"
            >
              <span
                className="absolute inset-1 rounded-full border border-bronze-500/30"
              />
              <span
                className="font-display text-xl text-bronze-600 relative"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {claimed ? (piece.claimOrdinal as number) : '·'}
              </span>
            </span>
            <p className="font-reading text-base text-wood-600 leading-[1.55] max-w-md mt-4">
              Recorded in the ledger, the permanent record every piece carries.
              Each entry is sealed against the one before it, so its history
              can never be quietly rewritten.
            </p>
            {piece.status === 'placed' && (
              <Link to={atlasHref} className={`${LINK} mt-4`}>
                See it among the others →
              </Link>
            )}
          </div>

          <div className="mt-10 text-center">
            <p className="font-reading text-base text-wood-600">Private collector records are managed on the artist site.</p>
            <a className={LINK} href={artInstanceHref(piece.pieceId, piece.publicCode) ?? `${ART_ORIGIN}/atlas`}>
              {piece.publicCode ? 'View this physical Piece Record' : 'View the public artwork atlas'} →
            </a>
          </div>

          {/* ── How it is made, in the certificate's own voice: the human
              sentence that reads before the engraved particulars below it.
              True of every piece in the series, so it is stated here rather
              than carried in each piece's record. Never "original" or "one of
              one": the layers are cut, then painted and assembled by hand,
              pieces are made to order, and a design can exist in numbered
              editions. ── */}
          <p className="font-reading text-lg text-wood-700 leading-[1.7] text-center max-w-[46ch] mx-auto mt-12 sm:mt-14">
            Layers of wood cut to exact depth, each surface painted by hand.
            One of 64 designs.
          </p>

          {/* ── The plate line: the certificate's engraved last line, the
              formal particulars in banknote grammar. ── */}
          <p className="font-label text-[10px] uppercase tracking-[0.28em] text-wood-500 text-center leading-[1.9] mt-6 sm:mt-7">
            {[
              sigil,
              piece.series ?? art.series,
              art.material,
              art.dimensions,
              art.year ? `cut ${art.year}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </article>

        {/* ═══════════════════ HOW THIS WORKS ═══════════════════
            The stranger's on-ramp in one breath: two short statements, each
            grounding one invented word (dream, ledger). The making used to
            be a third one here, but the certificate above now says how the
            piece is made in its own voice, and the two lines sat close
            enough to repeat each other (Adrian, 2026-09-02). Compressed
            hard (Adrian, 2026-07-26: "so much text... easy to get fatigued
            and just skip") — the longer teaching lives on /make and in the
            certificate itself. */}
        <section className="mt-10 sm:mt-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-8 text-center">
            {[
              { lead: 'Public record', body: 'What its keeper has chosen to share.' },
              { lead: 'Physical identity', body: 'The artist site holds the canonical Piece Record.' },
            ].map((item) => (
              <div key={item.lead} className="border-t border-wood-300 pt-4">
                <p className="font-display text-xl text-wood-900 font-semibold leading-snug">
                  {item.lead}
                </p>
                <p className="font-reading text-base text-wood-600 leading-[1.5] mt-1">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════ THE LIFE OF THIS PIECE ═══════════════════
            One connected spine instead of floating chapters. Everything
            below the certificate hangs on a single ledger line: what has
            happened (filled marks), what it carries (the code, its kin),
            and what is still unwritten (hollow marks) — so the page's ask
            reads as the piece's own next event, never a sales block. */}
        <div className="mt-14 sm:mt-16">
          {story && (
            <p className="font-reading text-lg text-wood-800 leading-[1.7] mb-10 whitespace-pre-line">
              {story}
            </p>
          )}

          {(content?.materials || content?.provenance) && (
            <div className="space-y-5 mb-10">
              {content?.materials && (
                <div>
                  <p className={`${LABEL} mb-2`}>Materials</p>
                  <p className="font-reading text-base text-wood-800 leading-[1.6] whitespace-pre-line">
                    {content.materials}
                  </p>
                </div>
              )}
              {content?.provenance && (
                <div>
                  <p className={`${LABEL} mb-2`}>Provenance</p>
                  <p className="font-reading text-base text-wood-800 leading-[1.6] whitespace-pre-line">
                    {content.provenance}
                  </p>
                </div>
              )}
            </div>
          )}

          {galleryImages.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-10">
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

          <section>
            <h2 className={`${LABEL} text-center mb-8`}>The life of this piece</h2>
            <ol className="relative ml-[3px] border-l border-wood-300 space-y-6 pb-1 max-w-lg mx-auto">
              {/* What has happened — filled marks. The code stop rides
                  directly after Created: it is a birth fact, not an event. */}
              {spine.slice(0, 1).map((entry, i) => (
                <li key={i} className="relative pl-6">
                  <span
                    aria-hidden
                    className="absolute left-0 top-[0.55em] w-[7px] h-[7px] rounded-full bg-bronze-400"
                    style={{ transform: 'translateX(-4px)' }}
                  />
                  <span className="font-reading text-lg text-wood-900 leading-snug">
                    {entry.label}
                    {entry.detail && (
                      <span className="text-wood-600"> · {entry.detail}</span>
                    )}
                  </span>
                </li>
              ))}

              {/* What it carries — the code, marked by its own glyph. */}
              {card && cardNumber != null && (
                <li className="relative pl-6">
                  <span
                    aria-hidden
                    className="absolute left-0 top-[0.55em] w-[7px] h-[7px] rounded-full bg-bronze-400"
                    style={{ transform: 'translateX(-4px)' }}
                  />
                  <div className="flex items-start justify-between gap-4">
                    <span className="font-reading text-lg text-wood-900 leading-snug">
                      Carries the code {card.iching.hexagram_name.replace(/\s*\(.*\)$/, '')}
                      <span className="text-wood-600"> · Hexagram {cardNumber}</span>{' '}
                      <Link
                        to={`/universal-language/${cardNumber}`}
                        state={{ ritual: true }}
                        className={`${LINK} whitespace-nowrap`}
                      >
                        Read it →
                      </Link>
                    </span>
                    <span aria-hidden className="shrink-0 text-bronze-600 pt-0.5">
                      <HexagramSVG
                        upper={card.iching.upper_trigram.symbol}
                        lower={card.iching.lower_trigram.symbol}
                        width={24}
                      />
                    </span>
                  </div>
                </li>
              )}

              {/* The rest of what has happened. */}
              {spine.slice(1).map((entry, i) => (
                <li key={`rest-${i}`} className="relative pl-6">
                  <span
                    aria-hidden
                    className="absolute left-0 top-[0.55em] w-[7px] h-[7px] rounded-full bg-bronze-400"
                    style={{ transform: 'translateX(-4px)' }}
                  />
                  <span className="font-reading text-lg text-wood-900 leading-snug">
                    {entry.label}
                    {entry.detail && (
                      <span className="text-wood-600"> · {entry.detail}</span>
                    )}
                  </span>
                </li>
              ))}

              {/* Its kin — alive elsewhere, one quiet stop. */}
              {kinEntries.length > 0 && (
                <li className="relative pl-6">
                  <span
                    aria-hidden
                    className="absolute left-0 top-[0.55em] w-[7px] h-[7px] rounded-full bg-bronze-400"
                    style={{ transform: 'translateX(-4px)' }}
                  />
                  <span className="font-reading text-lg text-wood-900 leading-snug">
                    Its kin
                    <span className="text-wood-600"> · nearest in pattern, alive elsewhere</span>
                  </span>
                  <ul className="mt-2 space-y-1">
                    {kinEntries.map((k) => (
                      <li key={k.key}>
                        <Link
                          to={`/atlas?piece=${encodeURIComponent(k.atlasParam)}`}
                          className="font-reading text-base text-wood-800 leading-snug hover:text-bronze-600 transition-colors"
                        >
                          {k.title}
                          {k.thread && (
                            <span className="text-wood-500"> · {k.thread}</span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              )}

              {/* What is still unwritten — hollow marks. The invitation is
                  the piece's own next event. */}
              {seeking ? (
                <>
                  <li className="relative pl-6">
                    <span
                      aria-hidden
                      className="absolute left-0 top-[0.55em] w-[7px] h-[7px] rounded-full border border-wood-400 bg-paper-50"
                      style={{ transform: 'translateX(-4px)' }}
                    />
                    <span className="font-reading text-lg text-wood-500 leading-snug">
                      A keeper writes one dream into it{' '}
                      <Link to={claimHref} className={`${LINK} whitespace-nowrap`}>
                        Become its keeper →
                      </Link>
                    </span>
                  </li>
                  <li className="relative pl-6">
                    <span
                      aria-hidden
                      className="absolute left-0 top-[0.55em] w-[7px] h-[7px] rounded-full border border-wood-400 bg-paper-50"
                      style={{ transform: 'translateX(-4px)' }}
                    />
                    <span className="font-reading text-lg text-wood-500 leading-snug">
                      Its light joins the map
                    </span>
                  </li>
                </>
              ) : (
                <li className="relative pl-6">
                  <span
                    aria-hidden
                    className="absolute left-0 top-[0.55em] w-[7px] h-[7px] rounded-full border border-wood-400 bg-paper-50"
                    style={{ transform: 'translateX(-4px)' }}
                  />
                  <span className="font-reading text-lg text-wood-500 leading-snug">
                    Passed on, someday
                    <span className="text-wood-400"> · the book continues</span>
                  </span>
                </li>
              )}
            </ol>
          </section>

          {/* ═══════════════════ THE TWO DOORS ═══════════════════
              One band, two short doors: the holder's and the maker's. */}
          <div className={`${CARD} grid sm:grid-cols-2 mt-14 sm:mt-16`}>
            <div className="p-6 sm:p-7 border-b sm:border-b-0 sm:border-r border-wood-200">
              <p className={`${LABEL} mb-3`}>Hold this piece?</p>
              <p className="font-reading text-base text-wood-700 leading-[1.6] mb-5">
                Collector registration is not open here.
              </p>
              <Link to={claimHref} className={BUTTON}>
                Registration information
              </Link>
              <p className="font-reading text-sm text-wood-600 mt-3 leading-[1.6]">
                The artist site manages physical ownership records.
              </p>

            </div>
            <div className="p-6 sm:p-7">
              <p className={`${LABEL} mb-3`}>Want one made?</p>
              <p className="font-reading text-base text-wood-700 leading-[1.6] mb-5">
                {claimed
                  ? 'This design can be made again: your size, your palette.'
                  : 'Your size, your palette, cut layer by layer for you.'}
              </p>
              <Link to={makeHref} className={BUTTON}>
                Begin your piece
              </Link>
              <p className="font-reading text-sm text-wood-600 mt-3 leading-[1.6]">
                A short note to the studio. Adrian replies himself.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PiecePage: React.FC = () => {
  const { pieceId, edition } = useParams<{ pieceId: string; edition?: string }>();
  const { search } = useLocation();
  const art = FULL_ARCHIVE.find(item => item.id === pieceId);
  if (edition === undefined && new URLSearchParams(search).get('ref') !== 'qr' && art) return <ArtworkDesignPage art={art} />;
  return <PhysicalPiecePage key={`${pieceId}:${edition ?? ''}`} />;
};

export default PiecePage;
