/**
 * Seed for the /atlas page.
 *
 * The ledger backend (Cloudflare Functions + R2 + steward keys) lives in
 * Adrian-Website and is being ported in a follow-up PR. Until then, the atlas
 * reads from this static seed so the visual layer can be reviewed independently
 * of the storage layer.
 *
 * Coverage: a handful of Universal Language pieces placed in cities around the
 * world, plus a few seeking pieces so the right-rail "Seeking ground" view has
 * something to render. Piece IDs match FULL_ARCHIVE entries in `mockData.ts`.
 * City IDs match `data/cities.ts`.
 */

import { CITIES_BY_ID } from './cities';
import type { PublicAtlasState } from '../types';

interface SeedPlacement {
  pieceId: string;
  cityId: string | null;
  status: 'placed' | 'seeking' | 'unawakened';
  placedAt?: string;
  /** Founding Lights ordinal — set on lit (claimed) pieces only. Seeded by
   *  hand here in placement (claim) order; production derives it from the
   *  ledger's `claimed` events. */
  claimOrdinal?: number;
}

const SEED: SeedPlacement[] = [
  // Lit lights — claimed + placed, carrying their Founding Lights ordinal.
  // Distributed across continents to show the kinship layer working.
  { pieceId: 'UL-122', cityId: 'denpasar-id', status: 'placed', placedAt: '2024-08-12', claimOrdinal: 1 }, // 1 ☰ Heaven / ☰ Heaven — Adrian's light #1
  { pieceId: 'UL-123', cityId: 'lisbon-pt', status: 'placed', placedAt: '2024-09-01', claimOrdinal: 2 },   // 2 ☷ Earth / ☷ Earth
  { pieceId: 'UL-105', cityId: 'berlin-de', status: 'placed', placedAt: '2024-09-15', claimOrdinal: 3 },   // 7 ☷ Earth / ☵ Water
  { pieceId: 'UL-112', cityId: 'london-gb', status: 'placed', placedAt: '2024-10-02', claimOrdinal: 4 },   // 8 ☵ Water / ☷ Earth
  { pieceId: 'UL-103', cityId: 'amsterdam-nl', status: 'placed', placedAt: '2024-10-20', claimOrdinal: 5 }, // 9 ☴ Wind / ☰ Heaven
  { pieceId: 'UL-114', cityId: 'new-york-us', status: 'placed', placedAt: '2024-11-05', claimOrdinal: 6 }, // 11 ☷ Earth / ☰ Heaven
  { pieceId: 'UL-128', cityId: 'san-francisco-us', status: 'placed', placedAt: '2024-11-22', claimOrdinal: 7 }, // 13 ☰ Heaven / ☲ Fire

  // Sold-but-unclaimed — admin-placed at a city, no claim yet. Render dim;
  // these are the outreach dashboard, waiting to ignite.
  { pieceId: 'UL-129', cityId: 'tokyo-jp', status: 'unawakened', placedAt: '2024-12-08' },    // 14 ☲ Fire / ☰ Heaven
  { pieceId: 'UL-131', cityId: 'sydney-au', status: 'unawakened', placedAt: '2025-01-14' },   // 16 ☳ Thunder / ☷ Earth
  { pieceId: 'UL-115', cityId: 'mexico-city-mx', status: 'unawakened', placedAt: '2025-02-03' }, // 19 ☷ Earth / ☱ Lake
  { pieceId: 'UL-104', cityId: 'sao-paulo-br', status: 'unawakened', placedAt: '2025-02-28' }, // 20 ☴ Wind / ☷ Earth
  { pieceId: 'UL-117', cityId: 'paris-fr', status: 'unawakened', placedAt: '2025-03-15' },    // 25 ☰ Heaven / ☳ Thunder
  { pieceId: 'UL-118', cityId: 'cape-town-za', status: 'unawakened', placedAt: '2025-04-02' }, // 31 ☱ Lake / ☶ Mountain
  { pieceId: 'UL-100', cityId: 'singapore-sg', status: 'unawakened', placedAt: '2025-04-19' }, // 32 ☳ Thunder / ☴ Wind
  { pieceId: 'UL-101', cityId: 'toronto-ca', status: 'unawakened', placedAt: '2025-05-01' },  // 36 ☷ Earth / ☲ Fire

  // Seeking — no city yet, will surface in the right rail.
  { pieceId: 'UL-150', cityId: null, status: 'seeking' },
  { pieceId: 'UL-151', cityId: null, status: 'seeking' },
  { pieceId: 'UL-152', cityId: null, status: 'seeking' },
];

/**
 * Build a `PublicAtlasState` from the seed. We only include cities that are
 * actually referenced — matches the production projection's behaviour.
 */
export function buildSeedAtlasState(): PublicAtlasState {
  const referencedCityIds = new Set<string>();
  const pieces = SEED
    .filter((p) => {
      if (p.status === 'placed' && p.cityId && !CITIES_BY_ID.has(p.cityId)) {
        console.warn(`[atlasSeed] unknown cityId ${p.cityId}, dropping ${p.pieceId}`);
        return false;
      }
      return true;
    })
    .map((p) => {
      if (p.cityId) referencedCityIds.add(p.cityId);
      return {
        pieceId: p.pieceId,
        series: 'Universal Language' as const,
        category: 'Multidimensional Art' as const,
        cityId: p.cityId,
        status: p.status,
        placedAt: p.placedAt,
        pieceType: 'mandala' as const, // all seeded pieces are Universal Language
        claimOrdinal: p.claimOrdinal,
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
  };
}
