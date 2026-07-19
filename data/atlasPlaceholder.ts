// ── TEMPORARY LAUNCH PLACEHOLDER — DELETE THIS FILE AND ITS TWO REFERENCES WHEN THE REAL MIRROR IS SEEDED. See loadAtlasState() in lib/atlas/state.ts and the placeholder caption in the atlas HUD. ──
//
// Why this exists: the live public mirror is not seeded yet, so /api/atlas
// returns ok:true with zero pieces and the globe shows land only. Until real
// works are placed, this hands the atlas exactly three placeholder dots so the
// globe reads as alive. It AUTO-HIDES the instant /api/atlas returns any real
// piece (loadAtlasState only swaps this in when the live piece count is 0).
//
// Removal at launch, one motion:
//   1. delete this file,
//   2. delete the "TEMPORARY PLACEHOLDER (remove at launch)" block in
//      lib/atlas/state.ts,
//   3. delete the "TEMPORARY PLACEHOLDER caption" block in components/AtlasPage.tsx.
// The optional `placeholder?: boolean` field on PublicAtlasState in types.ts can
// go at the same time.

import { CITIES_BY_ID } from './cities';
import { FULL_ARCHIVE } from './mockData';
import type { PublicAtlasState } from '../types';

/**
 * Three placeholder pieces, each a real Universal Language work from
 * FULL_ARCHIVE placed at a real city from cities.ts. Three distinct dot
 * expressions so the globe shows its full vocabulary at a glance:
 *
 *   1. UL-122 "Earth's Breath - 1" at Denpasar — status 'placed', a bright
 *      kept light (no ordinal).
 *   2. UL-114 "Sol Star - 11" at Lisbon — status 'placed' WITH claimOrdinal,
 *      a founding / numbered glow.
 *   3. UL-129 "Ancestors Bloom - 14" at Tokyo — status 'unawakened', a dim
 *      sold-but-unclaimed ember (still carries a city so it renders as a dot).
 *
 * Pieces 1 and 2 (cards 1 and 11) share the Heaven trigram, so a kinship
 * thread draws between them and the constellation layer reads as working.
 */
interface PlaceholderPlacement {
  pieceId: string;
  cityId: string;
  status: 'placed' | 'unawakened';
  claimOrdinal?: number;
  /** A shared dream, so the placeholder also shows the map's dream layer.
   *  Placeholder copy: replace with a real keeper's words at launch. */
  intention?: string;
}

const PLACEHOLDER: PlaceholderPlacement[] = [
  { pieceId: 'UL-122', cityId: 'denpasar-id', status: 'placed' },
  {
    pieceId: 'UL-114',
    cityId: 'lisbon-pt',
    status: 'placed',
    claimOrdinal: 1,
    intention:
      'That whoever stands before this piece remembers they are allowed to begin again, quietly, without asking anyone for permission.',
  },
  { pieceId: 'UL-129', cityId: 'tokyo-jp', status: 'unawakened' },
];

/**
 * Build a `PublicAtlasState` carrying exactly the three placeholder pieces.
 * Mirrors buildSeedAtlasState's shape and validates every pieceId against
 * FULL_ARCHIVE and every cityId against CITIES_BY_ID, warning and dropping any
 * that fail so a stale id can never crash the globe.
 */
export function buildPlaceholderAtlasState(): PublicAtlasState {
  const referencedCityIds = new Set<string>();

  const pieces = PLACEHOLDER.filter((p) => {
    const art = FULL_ARCHIVE.find((a) => a.id === p.pieceId);
    if (!art) {
      console.warn(`[atlasPlaceholder] unknown pieceId ${p.pieceId}, dropping`);
      return false;
    }
    if (!CITIES_BY_ID.has(p.cityId)) {
      console.warn(`[atlasPlaceholder] unknown cityId ${p.cityId}, dropping ${p.pieceId}`);
      return false;
    }
    return true;
  }).map((p) => {
    referencedCityIds.add(p.cityId);
    return {
      pieceId: p.pieceId,
      series: 'Universal Language' as const,
      category: 'Multidimensional Art' as const,
      cityId: p.cityId,
      status: p.status,
      pieceType: 'mandala' as const,
      claimOrdinal: p.claimOrdinal,
      intention: p.intention,
    };
  });

  const cities = Array.from(referencedCityIds)
    .map((id) => CITIES_BY_ID.get(id))
    .filter((c): c is NonNullable<typeof c> => c != null);

  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: 2,
    pieces,
    cities,
    placeholder: true,
  };
}

// ── TEMPORARY LEDGER PLACEHOLDERS — SINGLE SOURCE, DELETE WHEN REAL ENTRIES LAND. ──
//
// The living ledger (Part II.6, ruling 2) renders OTHER KINDS sections —
// mandalas, signature pieces, jewelry — from the public catalog + public state.
// Until the first real works of a kind are entered, that kind's section shows a
// few quietly-marked placeholder rows so the section reads as a waiting ledger,
// not an empty void. Removal is one motion: delete this block and the fallback
// in components/atlas/TheLedger.tsx that reads it. Fable authored the titles.

/** The status line every placeholder row carries, in the placeholder style. */
export const LEDGER_PLACEHOLDER_STATUS = 'placeholder · until the first works are entered';

/** Per-kind ghost rows shown while a kind has no real entries. Trivially
 *  removable: drop a kind's array (or the whole export) when its works land. */
export const LEDGER_KIND_PLACEHOLDERS: Readonly<
  Record<'mandala' | 'signature' | 'jewelry', readonly string[]>
> = {
  mandala: [
    'A mandala yet to be entered',
  ],
  signature: [
    'A signature work yet to be entered',
  ],
  jewelry: [
    'A piece yet to be entered',
    'A piece yet to be entered',
    'A piece yet to be entered',
  ],
};
