/**
 * Pure, I/O-free catalog logic for the Catalog Room.
 *
 * Adrian enters every work he has ever made through one form; each entry
 * becomes a permanent row (types.ts CatalogEntry) that feeds every downstream
 * surface. This module owns the two rules that must be frozen and testable
 * without touching R2 or Cloudflare:
 *
 *   - ID + SIGIL MINTING: the prefix comes from the kind via the FROZEN
 *     pieceCode table (mandala MA, signature SG, jewelry JW; 'other' derives
 *     from its series name per pieceCode's rules); the number is the next free
 *     number in that prefix, reserved at creation and NEVER reused, even after
 *     an entry is deleted. The id is `${prefix}-${number}` so its trailing
 *     digits align with the sigil forever (the forever contract).
 *
 *   - ENTRY PARSING: a whitelist parse/trim of the create-form body, so no
 *     stray field ever lands in the store and the private fields are bounded.
 *
 * Like utils/pieceCode.ts and utils/claimCode.ts, everything here is
 * deterministic and isomorphic — the unit suite pins the rules directly.
 */

import type {
  Artwork,
  CatalogEntry,
  CatalogKind,
  CatalogStatus,
  CatalogStore,
} from '../types';
import { pieceCode, piecePrefix, type PieceCodeInput } from './pieceCode';

/** The four kinds, and their exact UI labels (guardrail: these strings only). */
export const CATALOG_KINDS: readonly CatalogKind[] = [
  'mandala',
  'signature',
  'jewelry',
  'other',
];

export const CATALOG_KIND_LABELS: Readonly<Record<CatalogKind, string>> = {
  mandala: 'mandala',
  signature: 'signature piece',
  jewelry: 'jewelry',
  other: 'other',
};

export const CATALOG_STATUSES: readonly CatalogStatus[] = [
  'with-keeper',
  'available',
  'with-artist',
];

export function isCatalogKind(v: unknown): v is CatalogKind {
  return typeof v === 'string' && (CATALOG_KINDS as readonly string[]).includes(v);
}

export function isCatalogStatus(v: unknown): v is CatalogStatus {
  return (
    typeof v === 'string' && (CATALOG_STATUSES as readonly string[]).includes(v)
  );
}

/**
 * Map a kind (+ optional series) to the pieceCode inputs that resolve its
 * frozen prefix. The single source of truth for BOTH the minted prefix and the
 * merge meta, so a catalog piece's sigil and its atlas facet never disagree.
 *   - mandala   → series 'Mandala'      → MA
 *   - signature → isSignaturePiece      → SG (lives outside any named series)
 *   - jewelry   → category 'Jewelry'    → JW
 *   - other     → the series name       → series-derived prefix (frozen table
 *                                          or the pre-freeze initials fallback)
 */
export function kindToCodeParts(
  kind: CatalogKind,
  series?: string,
): { series?: string; category?: string; isSignaturePiece?: boolean } {
  switch (kind) {
    case 'mandala':
      return { series: 'Mandala' };
    case 'signature':
      return { isSignaturePiece: true };
    case 'jewelry':
      return { category: 'Jewelry' };
    case 'other':
      return { series: series ? series.trim() : undefined };
  }
}

/** The frozen sigil prefix a piece of this kind mints under. */
export function catalogPrefixFor(kind: CatalogKind, series?: string): string {
  return piecePrefix({ pieceId: '', ...kindToCodeParts(kind, series) });
}

/** The full pieceCode input for a stored entry — used to render its sigil. */
export function catalogPieceCodeInput(entry: CatalogEntry): PieceCodeInput {
  return {
    pieceId: entry.id,
    sigilNumber: entry.sigilNumber,
    ...kindToCodeParts(entry.kind, entry.series),
  };
}

/** The entry's sigil, e.g. "MA № 7". */
export function catalogSigil(entry: CatalogEntry): string {
  return pieceCode(catalogPieceCodeInput(entry));
}

export interface CatalogMint {
  id: string;
  sigilNumber: number;
  prefix: string;
  /** The store's counter map advanced past this mint (only ever increments,
   *  so numbers are never reused — even after a later deletion). */
  nextNumberByPrefix: Record<string, number>;
}

/**
 * Mint the next id + sigil number for a kind. Pure: returns the new id, its
 * reserved sigilNumber, and the advanced counter map; the caller persists the
 * whole thing under the R2 etag discipline so two racing creates can't collide.
 * Numbering starts at 1 per prefix and never rolls back.
 */
export function mintCatalogId(
  store: Pick<CatalogStore, 'nextNumberByPrefix'>,
  kind: CatalogKind,
  series?: string,
): CatalogMint {
  const prefix = catalogPrefixFor(kind, series);
  const number = store.nextNumberByPrefix[prefix] ?? 1;
  return {
    id: `${prefix}-${number}`,
    sigilNumber: number,
    prefix,
    nextNumberByPrefix: { ...store.nextNumberByPrefix, [prefix]: number + 1 },
  };
}

const trimOrUndef = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t : undefined;
};

/** Bounds so the private/prose fields can't grow unboundedly. */
const TITLE_MAX = 200;
const TEXT_MAX = 500;
const URL_MAX = 500;
const NOTES_MAX = 2000;
const IMAGES_MAX = 24;

export interface ParsedCatalogInput {
  title: string;
  kind: CatalogKind;
  series?: string;
  year?: string;
  dimensions?: string;
  material?: string;
  coverImage?: string;
  images?: string[];
  status: CatalogStatus;
  cityId?: string;
  price?: number;
  acquireUrl?: string;
  keeperEmail?: string;
  notes?: string;
}

export type CatalogParseResult =
  | { ok: true; value: ParsedCatalogInput }
  | { ok: false; error: string };

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * Whitelist-parse and trim a create/update body into the fields we store.
 * Rejects (rather than silently coercing) a bad kind, status, price, or a
 * kind 'other' with no series — the two the id mint depends on. Unknown keys
 * are dropped. Never trusts an id or sigilNumber from the body: those are
 * minted server-side (create) or immutable (update).
 */
export function parseCatalogInput(raw: unknown): CatalogParseResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Invalid body' };
  }
  const o = raw as Record<string, unknown>;

  const title = trimOrUndef(o.title);
  if (!title) return { ok: false, error: 'A title is required' };
  if (title.length > TITLE_MAX) return { ok: false, error: 'Title is too long' };

  if (!isCatalogKind(o.kind)) return { ok: false, error: 'Pick a kind' };
  const kind = o.kind;

  const series = trimOrUndef(o.series);
  if (kind === 'other' && !series) {
    return { ok: false, error: 'A series name is required for kind other' };
  }

  if (!isCatalogStatus(o.status)) return { ok: false, error: 'Pick where it is' };
  const status = o.status;

  let price: number | undefined;
  if (o.price !== undefined && o.price !== null && o.price !== '') {
    const n = typeof o.price === 'number' ? o.price : Number(o.price);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      return { ok: false, error: 'Price must be a whole number of minor units' };
    }
    price = n;
  }

  const keeperEmail = trimOrUndef(o.keeperEmail);
  if (keeperEmail && !isValidEmail(keeperEmail)) {
    return { ok: false, error: 'Invalid keeper email' };
  }

  const images = Array.isArray(o.images)
    ? o.images
        .map((v) => trimOrUndef(v))
        .filter((v): v is string => !!v)
        .slice(0, IMAGES_MAX)
    : undefined;

  const clampText = (v: unknown, max: number) => {
    const t = trimOrUndef(v);
    return t ? t.slice(0, max) : undefined;
  };

  return {
    ok: true,
    value: {
      title: title.slice(0, TITLE_MAX),
      kind,
      series,
      year: clampText(o.year, TEXT_MAX),
      dimensions: clampText(o.dimensions, TEXT_MAX),
      material: clampText(o.material, TEXT_MAX),
      coverImage: clampText(o.coverImage, URL_MAX),
      images: images && images.length ? images : undefined,
      status,
      cityId: trimOrUndef(o.cityId),
      price,
      acquireUrl: clampText(o.acquireUrl, URL_MAX),
      keeperEmail,
      notes: clampText(o.notes, NOTES_MAX),
    },
  };
}

/** The PUBLIC projection of an entry — the exact GET shape. NEVER keeperEmail,
 *  NEVER notes; price + acquireUrl ONLY when the piece is 'available'. */
export interface PublicCatalogEntry {
  id: string;
  title: string;
  kind: CatalogKind;
  series?: string;
  year?: string;
  dimensions?: string;
  material?: string;
  coverImage?: string;
  images?: string[];
  status: CatalogStatus;
  cityId?: string;
  price?: number;
  acquireUrl?: string;
}

export function toPublicCatalogEntry(entry: CatalogEntry): PublicCatalogEntry {
  const pub: PublicCatalogEntry = {
    id: entry.id,
    title: entry.title,
    kind: entry.kind,
    series: entry.series,
    year: entry.year,
    dimensions: entry.dimensions,
    material: entry.material,
    coverImage: entry.coverImage,
    images: entry.images,
    status: entry.status,
    cityId: entry.cityId,
  };
  // Price and the acquire link ride publicly only on an available piece.
  if (entry.status === 'available') {
    if (entry.price !== undefined) pub.price = entry.price;
    if (entry.acquireUrl) pub.acquireUrl = entry.acquireUrl;
  }
  return pub;
}

/** The series/category/isSignaturePiece meta a catalog entry contributes to
 *  the merged artwork map (buildArtworkMeta) — the same parts the sigil is
 *  built from, so the atlas kind facet and the sigil never disagree. */
export function catalogEntryMeta(entry: CatalogEntry): {
  series?: string;
  category?: string;
  isSignaturePiece?: boolean;
} {
  return kindToCodeParts(entry.kind, entry.series);
}

/**
 * Render a catalog entry as an Artwork so PiecePage (and any archive-shaped
 * reader) shows its real title/year/dimensions/images. Category comes from the
 * kind; isSignaturePiece is set for kind 'signature'; sigilNumber pins the
 * sigil. The public certificate reads this the moment the row lands.
 */
export function catalogEntryToArtwork(entry: CatalogEntry): Artwork {
  return publicCatalogEntryToArtwork(entry);
}

/**
 * The client-safe Artwork builder — takes the PUBLIC fields only (no
 * sigilNumber). The sigil still aligns: the id is `${prefix}-${number}`, so its
 * trailing digits ARE the sigil number and pieceCode derives it from the id.
 * PiecePage renders a catalogued piece's real title/year/dimensions/images
 * through this the moment the row lands.
 */
export function publicCatalogEntryToArtwork(
  entry: PublicCatalogEntry & { sigilNumber?: number },
): Artwork {
  const parts = kindToCodeParts(entry.kind, entry.series);
  return {
    id: entry.id,
    title: entry.title,
    category: parts.category ?? (entry.kind === 'mandala' ? 'Mandala' : ''),
    series: parts.series,
    ...(entry.sigilNumber !== undefined ? { sigilNumber: entry.sigilNumber } : {}),
    isSignaturePiece: parts.isSignaturePiece,
    coverImage: entry.coverImage ?? '',
    images: entry.images ?? [],
    description: '',
    year: entry.year ?? '',
    dimensions: entry.dimensions,
    material: entry.material,
    availability: entry.status === 'available' ? 'MADE_TO_ORDER' : 'SOLD',
    ...(entry.status === 'available' && entry.price !== undefined
      ? { price: entry.price }
      : {}),
  };
}
