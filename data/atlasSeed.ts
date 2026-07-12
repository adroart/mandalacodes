/**
 * Seed for the /atlas page.
 *
 * The ledger backend (Cloudflare Functions + R2 + steward keys) lives in
 * Adrian-Website and is being ported in a follow-up PR. Until then, the atlas
 * reads from this static seed so the visual layer can be reviewed independently
 * of the storage layer.
 *
 * Coverage: all 64 Universal Language pieces from FULL_ARCHIVE. A curated
 * subset is placed in cities around the world (lit + unawakened) to show the
 * kinship layer working; every remaining piece is seeded seeking, no city,
 * so the right-rail "Seeking ground" view carries the full archive rather
 * than a small sample. Piece IDs match FULL_ARCHIVE entries in `mockData.ts`.
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
  /** DEV FIXTURE ONLY: the public dream this lit light carries. Production
   *  derives this from the ledger's shared-intention inscriptions; here it is
   *  hand-seeded so the "dreams write the sky" layer has real content to show.
   *  Only set on `placed` (lit) pieces; sealed/absent dreams are never shown. */
  intention?: string;
}

const SEED: SeedPlacement[] = [
  // Lit lights — claimed + placed, carrying their Founding Lights ordinal.
  // Distributed across continents to show the kinship layer working.
  // DEV FIXTURE dreams (`intention`) are hand-seeded on these so the dream
  // layer has content; production reads them from the ledger. Words and a
  // city only, never a name. Dreams are year-scale guiding principles, two
  // sentences to two paragraphs, never to-do items. Lisbon carries three
  // lights on one point to exercise the clustered-city card.
  { pieceId: 'UL-122', cityId: 'denpasar-id', status: 'placed', placedAt: '2024-08-12', claimOrdinal: 1, intention: 'That my daughters grow up certain their wildness is welcome in this world. When they stand in front of this piece I want them to remember that the house they were raised in asked them to be more themselves, never less.' }, // 1 ☰ Heaven / ☰ Heaven · Adrian's light #1
  { pieceId: 'UL-123', cityId: 'lisbon-pt', status: 'placed', placedAt: '2024-09-01', claimOrdinal: 2, intention: 'A home with room for everyone who arrives. This year I want our table to stay long and our door to stay unlocked, and to become someone whose welcome people can feel from the street.' },   // 2 ☷ Earth / ☷ Earth
  { pieceId: 'UL-105', cityId: 'berlin-de', status: 'placed', placedAt: '2024-09-15', claimOrdinal: 3, intention: 'To stop performing my life and start inhabiting it.\n\nI have spent ten years building things I could point at. I want the years ahead to be measured differently: by how honest my mornings are, by whether my son knows my actual voice, by whether the people I love feel more possible around me. This piece hangs where I drink my coffee, so I meet the intention before I meet my phone.' },   // 7 ☷ Earth / ☵ Water
  { pieceId: 'UL-112', cityId: 'london-gb', status: 'placed', placedAt: '2024-10-02', claimOrdinal: 4, intention: 'Steady hands and a soft heart, whatever this year decides to bring. I refuse to let the hard seasons make me hard.' },   // 8 ☵ Water / ☷ Earth
  { pieceId: 'UL-103', cityId: 'amsterdam-nl', status: 'placed', placedAt: '2024-10-20', claimOrdinal: 5, intention: 'To plant things whose shade I will never sit in. A garden, a family repaired, a little more forgiveness in every room I leave.' }, // 9 ☴ Wind / ☰ Heaven
  { pieceId: 'UL-114', cityId: 'new-york-us', status: 'placed', placedAt: '2024-11-05', claimOrdinal: 6, intention: 'To speak the truth even when my voice shakes, and to build a life where being honest no longer requires being brave.' }, // 11 ☷ Earth / ☰ Heaven
  { pieceId: 'UL-128', cityId: 'san-francisco-us', status: 'placed', placedAt: '2024-11-22', claimOrdinal: 7, intention: 'Enough stillness to hear what wants to be made through me, and enough courage to make it without asking permission first.' }, // 13 ☰ Heaven / ☲ Fire
  { pieceId: 'UL-107', cityId: 'lisbon-pt', status: 'placed', placedAt: '2025-01-20', claimOrdinal: 8, intention: 'To let my marriage be the place I practice everything else I believe. Patience first at home, then everywhere.' }, // clustered on the Lisbon point with UL-123
  { pieceId: 'UL-119', cityId: 'lisbon-pt', status: 'placed', placedAt: '2025-03-08', claimOrdinal: 9, intention: 'A year of making instead of consuming.\n\nEvery evening I would have spent scrolling, I want to have drawn, cooked, written, repaired, or listened. The piece watches the room where that choice gets made.' }, // clustered on the Lisbon point with UL-123

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

  // Remaining seeking, the rest of the 64 Universal Language pieces, created
  // but not yet sold or placed. Fills out the Seeking Ground rail so the dev
  // atlas carries the full FULL_ARCHIVE coverage, not just a curated sample.
  { pieceId: 'UL-102', cityId: null, status: 'seeking' },
  { pieceId: 'UL-106', cityId: null, status: 'seeking' },
  { pieceId: 'UL-108', cityId: null, status: 'seeking' },
  { pieceId: 'UL-109', cityId: null, status: 'seeking' },
  { pieceId: 'UL-110', cityId: null, status: 'seeking' },
  { pieceId: 'UL-111', cityId: null, status: 'seeking' },
  { pieceId: 'UL-113', cityId: null, status: 'seeking' },
  { pieceId: 'UL-116', cityId: null, status: 'seeking' },
  { pieceId: 'UL-120', cityId: null, status: 'seeking' },
  { pieceId: 'UL-121', cityId: null, status: 'seeking' },
  { pieceId: 'UL-124', cityId: null, status: 'seeking' },
  { pieceId: 'UL-125', cityId: null, status: 'seeking' },
  { pieceId: 'UL-126', cityId: null, status: 'seeking' },
  { pieceId: 'UL-127', cityId: null, status: 'seeking' },
  { pieceId: 'UL-130', cityId: null, status: 'seeking' },
  { pieceId: 'UL-132', cityId: null, status: 'seeking' },
  { pieceId: 'UL-133', cityId: null, status: 'seeking' },
  { pieceId: 'UL-134', cityId: null, status: 'seeking' },
  { pieceId: 'UL-135', cityId: null, status: 'seeking' },
  { pieceId: 'UL-136', cityId: null, status: 'seeking' },
  { pieceId: 'UL-137', cityId: null, status: 'seeking' },
  { pieceId: 'UL-138', cityId: null, status: 'seeking' },
  { pieceId: 'UL-139', cityId: null, status: 'seeking' },
  { pieceId: 'UL-140', cityId: null, status: 'seeking' },
  { pieceId: 'UL-141', cityId: null, status: 'seeking' },
  { pieceId: 'UL-142', cityId: null, status: 'seeking' },
  { pieceId: 'UL-143', cityId: null, status: 'seeking' },
  { pieceId: 'UL-144', cityId: null, status: 'seeking' },
  { pieceId: 'UL-145', cityId: null, status: 'seeking' },
  { pieceId: 'UL-146', cityId: null, status: 'seeking' },
  { pieceId: 'UL-147', cityId: null, status: 'seeking' },
  { pieceId: 'UL-148', cityId: null, status: 'seeking' },
  { pieceId: 'UL-149', cityId: null, status: 'seeking' },
  { pieceId: 'UL-153', cityId: null, status: 'seeking' },
  { pieceId: 'UL-154', cityId: null, status: 'seeking' },
  { pieceId: 'UL-155', cityId: null, status: 'seeking' },
  { pieceId: 'UL-156', cityId: null, status: 'seeking' },
  { pieceId: 'UL-157', cityId: null, status: 'seeking' },
  { pieceId: 'UL-158', cityId: null, status: 'seeking' },
  { pieceId: 'UL-159', cityId: null, status: 'seeking' },
  { pieceId: 'UL-160', cityId: null, status: 'seeking' },
  { pieceId: 'UL-161', cityId: null, status: 'seeking' },
  { pieceId: 'UL-162', cityId: null, status: 'seeking' },
  { pieceId: 'UL-163', cityId: null, status: 'seeking' },
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
        // DEV FIXTURE: the lit light's public dream, when one is seeded above.
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
  };
}
