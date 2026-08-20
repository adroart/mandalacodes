// ── TEMPORARY LAUNCH SAMPLES — DELETE THIS FILE AND ITS REFERENCES WHEN THE REAL REGISTRY IS SEEDED. See loadAtlasState() in lib/atlas/state.ts and the sample-sky caption in the atlas HUD. ──
//
// Why this exists: while the real registry is being built, /api/atlas returns
// ok:true with zero pieces and the globe shows land only. Until real works are
// placed, this hands the atlas exactly FIVE fully-built-out SAMPLE pieces,
// every free-text field unmistakably marked as a sample, so the whole surface
// reads as alive. loadAtlasState swaps this state in ONLY when the canonical
// fetch SUCCEEDS with zero pieces — so it AUTO-HIDES the instant /api/atlas
// carries any real piece, and a canonical FAILURE still rejects (samples never
// mask a broken feed).
//
// Removal at launch, one motion:
//   1. delete this file,
//   2. delete the "TEMPORARY LAUNCH SAMPLES" blocks in lib/atlas/state.ts,
//   3. delete the "TEMPORARY SAMPLE caption" block in components/AtlasPage.tsx
//      and the sample notice in components/PiecePage.tsx.
// The optional `placeholder?: boolean` field on PublicAtlasState in types.ts
// and the `sample?: boolean` row flag in components/atlas/ledgerRow.ts can go
// at the same time.

import { CITIES_BY_ID } from './cities';
import { FULL_ARCHIVE } from './mockData';
import type { PublicAtlasState } from '../types';

/**
 * Five sample pieces, each a real Universal Language work from FULL_ARCHIVE,
 * spread across the atlas's full vocabulary of expressions:
 *
 *   1. UL-122 "Earth's Breath - 1" at Denpasar — placed, ordinal 1, carrying
 *      a public sample dream signed by "a sample steward".
 *   2. UL-114 "Sol Star - 11" at Berlin — placed, ordinal 2.
 *   3. UL-101 "Crystal Creation - 36" at Mexico City — placed, ordinal 3.
 *   4. UL-129 "Ancestors Bloom - 14" at Tokyo — unawakened, a dim
 *      sold-but-unclaimed ember (carries a city so it renders as a dot).
 *   5. UL-106 "Flight of the Tao - 57" — seeking, no city (lives in the
 *      seeking section, never on the globe).
 *
 * Pieces 1 and 2 (cards 1 and 11) share the Heaven trigram, so a kinship
 * thread draws between them and the constellation layer reads as working.
 * Every free-text field reads unmistakably as a sample.
 */
interface SamplePlacement {
  pieceId: string;
  /** null = seeking, no city to render. */
  cityId: string | null;
  status: 'seeking' | 'placed' | 'unawakened';
  claimOrdinal?: number;
  placedAt?: string;
  /** A shared dream, so the samples also show the map's dream layer.
   *  Sample copy, marked as such: replaced by real keepers' words at launch. */
  intention?: string;
  signedBy?: { name?: string };
}

const SAMPLES: SamplePlacement[] = [
  {
    pieceId: 'UL-122',
    cityId: 'denpasar-id',
    status: 'placed',
    claimOrdinal: 1,
    placedAt: '2026-06-21T00:00:00.000Z',
    intention:
      'sample · that whoever stands before this piece remembers they are allowed to begin again, quietly, without asking anyone for permission.',
    signedBy: { name: 'a sample steward' },
  },
  {
    pieceId: 'UL-114',
    cityId: 'berlin-de',
    status: 'placed',
    claimOrdinal: 2,
    placedAt: '2026-07-04T00:00:00.000Z',
  },
  {
    pieceId: 'UL-101',
    cityId: 'mexico-city-mx',
    status: 'placed',
    claimOrdinal: 3,
    placedAt: '2026-07-19T00:00:00.000Z',
  },
  { pieceId: 'UL-129', cityId: 'tokyo-jp', status: 'unawakened' },
  { pieceId: 'UL-106', cityId: null, status: 'seeking' },
];

/**
 * Build a `PublicAtlasState` carrying exactly the five sample pieces.
 * Mirrors buildSeedAtlasState's shape and validates every pieceId against
 * FULL_ARCHIVE and every non-null cityId against CITIES_BY_ID, warning and
 * dropping any that fail so a stale id can never crash the globe.
 */
export function buildPlaceholderAtlasState(): PublicAtlasState {
  const referencedCityIds = new Set<string>();

  const pieces = SAMPLES.filter((p) => {
    const art = FULL_ARCHIVE.find((a) => a.id === p.pieceId);
    if (!art) {
      console.warn(`[atlasPlaceholder] unknown pieceId ${p.pieceId}, dropping`);
      return false;
    }
    if (p.cityId !== null && !CITIES_BY_ID.has(p.cityId)) {
      console.warn(`[atlasPlaceholder] unknown cityId ${p.cityId}, dropping ${p.pieceId}`);
      return false;
    }
    return true;
  }).map((p) => {
    if (p.cityId) referencedCityIds.add(p.cityId);
    return {
      pieceId: p.pieceId,
      series: 'Universal Language' as const,
      category: 'Multidimensional Art' as const,
      cityId: p.cityId,
      status: p.status,
      pieceType: 'mandala' as const,
      claimOrdinal: p.claimOrdinal,
      placedAt: p.placedAt,
      intention: p.intention,
      signedBy: p.signedBy,
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
