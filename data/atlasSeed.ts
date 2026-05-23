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
  status: 'placed' | 'seeking';
  placedAt?: string;
}

const SEED: SeedPlacement[] = [
  // Placed — distributed across continents to show the kinship layer working.
  { pieceId: 'UL-122', cityId: 'denpasar-id', status: 'placed', placedAt: '2024-08-12' }, // 1 ☰ Heaven / ☰ Heaven
  { pieceId: 'UL-123', cityId: 'lisbon-pt', status: 'placed', placedAt: '2024-09-01' },   // 2 ☷ Earth / ☷ Earth
  { pieceId: 'UL-105', cityId: 'berlin-de', status: 'placed', placedAt: '2024-09-15' },   // 7 ☷ Earth / ☵ Water
  { pieceId: 'UL-112', cityId: 'london-gb', status: 'placed', placedAt: '2024-10-02' },   // 8 ☵ Water / ☷ Earth
  { pieceId: 'UL-103', cityId: 'amsterdam-nl', status: 'placed', placedAt: '2024-10-20' }, // 9 ☴ Wind / ☰ Heaven
  { pieceId: 'UL-114', cityId: 'new-york-us', status: 'placed', placedAt: '2024-11-05' }, // 11 ☷ Earth / ☰ Heaven
  { pieceId: 'UL-128', cityId: 'san-francisco-us', status: 'placed', placedAt: '2024-11-22' }, // 13 ☰ Heaven / ☲ Fire
  { pieceId: 'UL-129', cityId: 'tokyo-jp', status: 'placed', placedAt: '2024-12-08' },    // 14 ☲ Fire / ☰ Heaven
  { pieceId: 'UL-131', cityId: 'sydney-au', status: 'placed', placedAt: '2025-01-14' },   // 16 ☳ Thunder / ☷ Earth
  { pieceId: 'UL-115', cityId: 'mexico-city-mx', status: 'placed', placedAt: '2025-02-03' }, // 19 ☷ Earth / ☱ Lake
  { pieceId: 'UL-104', cityId: 'sao-paulo-br', status: 'placed', placedAt: '2025-02-28' }, // 20 ☴ Wind / ☷ Earth
  { pieceId: 'UL-117', cityId: 'paris-fr', status: 'placed', placedAt: '2025-03-15' },    // 25 ☰ Heaven / ☳ Thunder
  { pieceId: 'UL-118', cityId: 'cape-town-za', status: 'placed', placedAt: '2025-04-02' }, // 31 ☱ Lake / ☶ Mountain
  { pieceId: 'UL-100', cityId: 'singapore-sg', status: 'placed', placedAt: '2025-04-19' }, // 32 ☳ Thunder / ☴ Wind
  { pieceId: 'UL-101', cityId: 'toronto-ca', status: 'placed', placedAt: '2025-05-01' },  // 36 ☷ Earth / ☲ Fire

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
      };
    });

  const cities = Array.from(referencedCityIds)
    .map((id) => CITIES_BY_ID.get(id))
    .filter((c): c is NonNullable<typeof c> => c != null);

  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    pieces,
    cities,
  };
}
