import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FULL_ARCHIVE } from '../data/mockData';
import { CITIES_BY_ID, formatPlaceLabel } from '../data/cities';
import { CARD_BY_NUMBER } from '../data/oracleData';
import { img } from '../utils/cloudinary';
import { ulCardNumber } from '../utils/universalLanguage';
import { pieceCode } from '../utils/pieceCode';
import { stewardOrdinalLabel } from '../utils/inscriptions';
import { HexagramSVG } from './oracle/HexagramGlyph';
import { ordinalLabel } from './atlas/PieceSidePanel';
import RequestStewardship from './atlas/RequestStewardship';
import ArtworkPlate from './atlas/ArtworkPlate';
import {
  loadAtlasState,
  findPublicPiece,
  type PublicPiece,
} from '../lib/atlas/state';
import { buildKinshipIndex } from '../utils/kinship';
import { useAccount } from '../lib/account/useAccount';
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
 * the anchoring city, the lineage of keepers, and the ledger seal. The
 * scholarship — materials, edition, the code, the story spine, its kin — reads
 * below the certificate in three chapters. It NEVER shows private events,
 * notes, or holder identity: everything comes from the *public* projection
 * (fetched with the same seed fallback AtlasPage uses), so a slightly-stale
 * cache still renders.
 *
 * Register: the certificate is warm paper regardless of the site theme — a
 * physical document photographed against the page. The whole surface carries
 * `dark-preserve` so paper, wood, and bronze tokens hold their light values in
 * both dark and light site themes.
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

/** The hairline rule the certificate is ruled with. */
const Rule: React.FC<{ className?: string }> = ({ className = '' }) => (
  <span
    aria-hidden
    className={`block h-px w-full bg-wood-300/70 ${className}`}
  />
);

type LoadState =
  | { kind: 'loading' }
  | { kind: 'not-found' }
  | { kind: 'ready'; piece: PublicPiece; art: Artwork };

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

/* ─── The keeper's layer ──────────────────────────────────────────────────
 * Served only to the piece's bound steward by
 * /api/atlas/steward/certificate — the price, the full private spine, the
 * door to the book. Everyone else gets exactly the public certificate above.
 * ──────────────────────────────────────────────────────────────────────── */

interface KeeperCertificate {
  acquisition: { amount: number | null; currency: string | null; saleDate: string } | null;
  history: LedgerEvent[];
  claimedAt?: string;
  firstInscriptionAt?: string;
}

/** Keeper-voice labels for the fuller (private) spine. 'Created', 'Placed',
 *  and 'Came to light' already read on the public certificate; the rest are
 *  first shown here (flagged for Fable copy review). */
const KEEPER_EVENT_LABEL: Record<LedgerEvent['type'], string> = {
  created: 'Created',
  placed: 'Placed',
  moved: 'Moved',
  withdrawn: 'Taken from the map',
  revealed: 'Shown on the map',
  retired: 'Retired',
  claimed: 'Came to light',
  inscribed: 'A dream inscribed',
  transferred: 'Passed on',
};

/** The fuller spine, one entry per sanitized event, in the certificate's
 *  label/detail grammar. */
function buildKeeperSpine(history: readonly LedgerEvent[]): SpineEntry[] {
  return history.map((e) => {
    const bits: string[] = [];
    if (e.type === 'transferred' && e.transferKind) bits.push(e.transferKind);
    const city = cityLabel(e.cityId);
    if (city) bits.push(city);
    const year = yearOf(e.date);
    if (year) bits.push(year);
    return {
      label: KEEPER_EVENT_LABEL[e.type] ?? e.type,
      detail: bits.length ? bits.join(' · ') : undefined,
    };
  });
}

/** Format the acquisition price for the keeper line. Returns null when the
 *  confirmed row carried no price (many will not). `amount` is minor units. */
function formatAcquisitionAmount(
  acq: { amount: number | null; currency: string | null },
): string | null {
  if (acq.amount == null) return null;
  const major = acq.amount / 100;
  if (acq.currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: acq.currency,
      }).format(major);
    } catch {
      /* invalid currency code — fall through to a plain number */
    }
  }
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(major);
}

/** "Came to you {date}" date — a readable full date in the paper grammar. */
function formatSaleDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const PiecePage: React.FC = () => {
  const { pieceId, edition } = useParams<{ pieceId: string; edition?: string }>();
  const { isLoaded, isSignedIn, fetchAuthed } = useAccount();
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [content, setContent] = useState<PieceContent | null>(null);
  const [atlasState, setAtlasState] = useState<PublicAtlasState | null>(null);
  /* The keeper's private layer — set ONLY after a positive authenticated
     response, so a non-keeper never sees a flash of it. All failures silent. */
  const [keeper, setKeeper] = useState<KeeperCertificate | null>(null);

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
      // Dead-end only when the piece is in NEITHER the archive NOR the public
      // state. A shipped piece present in public state but not yet catalogued
      // still renders its certificate by sigil (forever contract).
      if (!art && !piece) {
        setLoad({ kind: 'not-found' });
        return;
      }
      const resolved: PublicPiece =
        piece ?? {
          pieceId,
          editionNumber,
          series: art!.series,
          category: art!.category,
          cityId: null,
          status: 'seeking',
        };
      const resolvedArt = art ?? fallbackArtFromPublic(resolved);
      setLoad({ kind: 'ready', piece: resolved, art: resolvedArt });
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

  /* Holder's chart element — the same public endpoint the atlas HUD uses;
     returns chart: null unless the steward opted into chart presence. */
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

  /* The keeper's layer: only when signed in, and only revealed on a positive
     response. A non-keeper gets a 404 and nothing renders; every failure is
     silent, so the certificate stays byte-identical to the public view. */
  useEffect(() => {
    setKeeper(null);
    if (load.kind !== 'ready' || !isLoaded || !isSignedIn) return;
    let active = true;
    const pieceParam = `${load.piece.pieceId}${
      typeof load.piece.editionNumber === 'number' ? `:${load.piece.editionNumber}` : ''
    }`;
    fetchAuthed(
      `/api/atlas/steward/certificate?piece=${encodeURIComponent(pieceParam)}`,
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data: (KeeperCertificate & { ok?: boolean }) | null) => {
        if (active && data && data.ok) setKeeper(data);
      })
      .catch(() => {
        /* quiet: the keeper section simply doesn't render */
      });
    return () => {
      active = false;
    };
  }, [load, isLoaded, isSignedIn, fetchAuthed]);

  if (load.kind === 'loading') {
    return (
      <section className="dark-preserve min-h-screen bg-paper-100 flex items-center justify-center px-6">
        <p className={`${LABEL} text-wood-500`} aria-live="polite">
          Opening the certificate
        </p>
      </section>
    );
  }

  if (load.kind === 'not-found') {
    return (
      <section className="dark-preserve min-h-screen bg-paper-100 flex flex-col items-center justify-center px-6 text-center">
        <h1
          className="font-display text-3xl text-wood-900 font-medium mb-4"
          style={{ fontFamily: 'var(--font-brand)', letterSpacing: '0.04em' }}
        >
          This piece isn't on the map yet
        </h1>
        <p className="font-display text-lg text-wood-700 max-w-md leading-[1.6] mb-8">
          The code you scanned doesn't resolve to a known piece. If you hold one
          of Adrian's works, you can still bring it into the record.
        </p>
        <div className="flex flex-col items-center gap-4">
          <Link to="/atlas/claim" className={LINK}>
            Open this piece's book →
          </Link>
          {/* The homecoming door — the single highest-leverage line in the
              redesign: the launch letter will send exactly these people here. */}
          <Link to="/atlas/homecoming" className={LINK}>
            Holding a piece we do not know? Bring it home →
          </Link>
        </div>
      </section>
    );
  }

  const { piece, art } = load;
  const cardNumber =
    art.series === 'Universal Language' ? ulCardNumber(art.coverImage) : null;
  const card = cardNumber != null ? CARD_BY_NUMBER.get(cardNumber) : undefined;
  const spine = buildSpine(piece, art);

  const description = content?.story || art.longDescription || art.description || undefined;
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
  const atlasHref = `/atlas?piece=${encodeURIComponent(
    `${piece.pieceId}${
      typeof piece.editionNumber === 'number' ? `:${piece.editionNumber}` : ''
    }`,
  )}`;

  return (
    <div className="dark-preserve min-h-screen bg-paper-100 text-wood-900">
      <div className="px-5 sm:px-6 pb-32 max-w-3xl mx-auto pt-[calc(var(--nav-height)+1rem)] sm:pt-[calc(var(--nav-height)+1.75rem)]">
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
                }. Original work by Adrian Rasmussen.`}
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
          </div>

          {/* ── The invitation band: QR arrivals meet the door in the first
              screenful, not after 1,800 pixels of scholarship. ── */}
          {seeking && (
            <div className="mt-8 text-center">
              <div className="mx-auto max-w-md border-y border-wood-300 py-5">
                <p className="font-display text-2xl sm:text-[1.75rem] text-wood-800 leading-[1.3]">
                  This piece is ready for someone to become its keeper and
                  infuse it with their dream.{' '}
                  <Link
                    to={claimHref}
                    className="text-bronze-600 hover:text-bronze-500 transition-colors whitespace-nowrap"
                  >
                    Begin →
                  </Link>
                </p>
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
                style={{ fontFamily: 'var(--font-brand)', fontSize: 'clamp(3.5rem, 13vw, 6rem)' }}
              >
                {piece.claimOrdinal}
              </p>
              <p className="font-display text-lg text-wood-600 mt-3">
                the {ordinalLabel(piece.claimOrdinal as number)} light of the constellation
              </p>
              <p className="font-display text-sm text-wood-500 mt-1">
                A founding light marks the order in which a piece was claimed by its keeper.
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
                <p className="font-display text-lg text-wood-600">{lineageLine}</p>
              )}
            </div>
          )}

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
                style={{ fontFamily: 'var(--font-brand)' }}
              >
                {claimed ? (piece.claimOrdinal as number) : '·'}
              </span>
            </span>
            <p className="font-display text-base text-wood-600 leading-[1.55] max-w-md mt-4">
              Recorded in the living ledger. Each page is sealed against the one
              before it, and the keeper can always carry the whole book away.
            </p>
            {piece.status === 'placed' && (
              <Link to={atlasHref} className={`${LINK} mt-4`}>
                See it among the others →
              </Link>
            )}
          </div>

          {/* ── For the keeper: the private layer, beneath the seal. Renders
              only for the signed-in bound steward, only after a positive
              authenticated response — never a flash for anyone else. Carries
              the acquisition line, the fuller (private) spine, and the one
              door to the book. ── */}
          {keeper && (
            <div className="mt-12 sm:mt-16 pt-10 border-t border-wood-300">
              <p className={`${LABEL} text-center mb-8`}>For the keeper</p>

              {keeper.acquisition && (
                <p className="font-display text-lg text-wood-700 text-center mb-8">
                  Came to you {formatSaleDate(keeper.acquisition.saleDate)}
                  {formatAcquisitionAmount(keeper.acquisition)
                    ? ` · ${formatAcquisitionAmount(keeper.acquisition)}`
                    : ''}
                </p>
              )}

              {keeper.history.length > 0 && (
                <ol className="relative ml-[3px] border-l border-wood-300 space-y-5 pb-1 mb-8">
                  {buildKeeperSpine(keeper.history).map((entry, i) => (
                    <li key={i} className="relative pl-6">
                      <span
                        aria-hidden
                        className="absolute left-0 top-[0.55em] w-[7px] h-[7px] rounded-full bg-bronze-400"
                        style={{ transform: 'translateX(-4px)' }}
                      />
                      <span className="font-display text-lg text-wood-900 leading-snug">
                        {entry.label}
                        {entry.detail && (
                          <span className="text-wood-600"> · {entry.detail}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              )}

              <div className="text-center">
                <Link to="/atlas/edit" className={LINK}>
                  open your book →
                </Link>
              </div>
            </div>
          )}
        </article>

        <p className="font-display text-base text-wood-500 text-center mt-5 leading-[1.6] max-w-sm mx-auto">
          This page is the certificate of the physical work.
        </p>

        {/* ═══════════════════ THE SCHOLARSHIP ═══════════════════
            Three chapters below the certificate object. */}
        <div className="mt-16 sm:mt-20 space-y-16">
          {/* ── Chapter: The work ── */}
          <section>
            <h2 className={`${LABEL} text-center mb-8`}>The work</h2>

            {description && (
              <p className="font-display text-lg text-wood-800 leading-[1.7] mb-8 whitespace-pre-line">
                {description}
              </p>
            )}

            {(editionLine || art.dimensions || art.material) && (
              <p className="font-display text-base text-wood-600 leading-relaxed mb-8">
                {[editionLine, art.dimensions, art.material]
                  .filter(Boolean)
                  .map((bit, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && (
                        <span aria-hidden className="mx-2 text-wood-400">·</span>
                      )}
                      <span>{bit}</span>
                    </React.Fragment>
                  ))}
              </p>
            )}

            {(content?.materials || content?.provenance) && (
              <div className="space-y-5 mb-8">
                {content?.materials && (
                  <div>
                    <p className={`${LABEL} mb-2`}>Materials</p>
                    <p className="font-display text-base text-wood-800 leading-[1.6] whitespace-pre-line">
                      {content.materials}
                    </p>
                  </div>
                )}
                {content?.provenance && (
                  <div>
                    <p className={`${LABEL} mb-2`}>Provenance</p>
                    <p className="font-display text-base text-wood-800 leading-[1.6] whitespace-pre-line">
                      {content.provenance}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* The code it carries — Universal Language pieces only. */}
            {card && cardNumber != null && (
              <div className="flex items-start gap-5 pt-2">
                <div className="shrink-0 text-bronze-600">
                  <HexagramSVG
                    upper={card.iching.upper_trigram.symbol}
                    lower={card.iching.lower_trigram.symbol}
                    width={48}
                  />
                </div>
                <div>
                  <p className={`${LABEL} mb-2`}>The code it carries</p>
                  <p className="font-display text-lg text-wood-900 leading-snug">
                    {card.iching.hexagram_name} · Hexagram {cardNumber}
                  </p>
                  <Link
                    to={`/universal-language/${cardNumber}`}
                    state={{ ritual: true }}
                    className={`${LINK} mt-3 inline-block`}
                  >
                    Read Code {cardNumber} →
                  </Link>
                </div>
              </div>
            )}

            {galleryImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-8">
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
          </section>

          {/* ── Chapter: The dream it carries — the network the dream joins ── */}
          {(kinEntries.length > 0 || (holderElement && piece.status === 'placed')) && (
            <section>
              <h2 className={`${LABEL} text-center mb-8`}>The dream it carries</h2>

              {kinEntries.length > 0 && (
                <div className="mb-8">
                  <p className={`${LABEL} mb-3`}>Its kin on the map</p>
                  <ul className="space-y-2">
                    {kinEntries.map((k) => (
                      <li key={k.key}>
                        <Link
                          to={`/atlas?piece=${encodeURIComponent(k.atlasParam)}`}
                          className="font-display text-lg text-wood-900 leading-snug hover:text-bronze-600 transition-colors"
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

              {holderElement && piece.status === 'placed' && (
                <div>
                  <p className={`${LABEL} mb-1`}>The hands it rests in</p>
                  <p className="font-display text-lg text-wood-900 leading-snug">
                    Held by a chart of {holderElement}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* ── Chapter: Its story — the public history spine ── */}
          <section>
            <h2 className={`${LABEL} text-center mb-8`}>Its story</h2>
            <ol className="relative ml-[3px] border-l border-wood-300 space-y-5 pb-1">
              {spine.map((entry, i) => (
                <li key={i} className="relative pl-6">
                  <span
                    aria-hidden
                    className="absolute left-0 top-[0.55em] w-[7px] h-[7px] rounded-full bg-bronze-400"
                    style={{ transform: 'translateX(-4px)' }}
                  />
                  <span className="font-display text-lg text-wood-900 leading-snug">
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
                <span className="font-display text-lg text-wood-500 leading-snug">
                  It is ready for its next keeper
                </span>
              </li>
            </ol>
          </section>

          {/* ── CTA: the claim block stays at the foot ── */}
          <div className={`${CARD} p-6 sm:p-7`}>
            <p className="font-display text-lg text-wood-800 leading-[1.6] mb-5">
              Your piece already has a story. Signing in lets you add to it:
              place it on the map, write its intentions, pass it on.
            </p>
            <Link
              to={claimHref}
              className="inline-block font-label text-[11px] uppercase tracking-[0.2em] font-semibold text-paper-50 bg-wood-900 hover:bg-wood-800 transition-colors px-6 py-3"
            >
              Open this piece's book
            </Link>
            <p className="font-display text-sm text-wood-600 mt-3 leading-[1.6]">
              Sign in with the email your piece was registered to.
            </p>
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
  );
};

export default PiecePage;
