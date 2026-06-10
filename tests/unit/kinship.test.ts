/**
 * Unit tests for utils/kinship.ts — the shared-trigram constellation.
 *
 * Covers: node keys using the ledger-wide `editionNumber ?? 0` convention,
 * the same-piece exclusion (sibling editions trivially share both trigrams
 * and must not draw self-kin arcs), and the shared-trigram test itself.
 */
import { describe, expect, it } from 'vitest';
import { buildKinshipIndex, isKin } from '../../utils/kinship';
import type { KinshipNode } from '../../utils/kinship';
import type { Artwork, CityCentroid, PublicAtlasState } from '../../types';

function node(overrides: Partial<KinshipNode>): KinshipNode {
  return {
    key: 'UL-1:0',
    pieceId: 'UL-1',
    title: 'Test',
    hexagramNumber: 1,
    upperTrigram: 'Heaven',
    lowerTrigram: 'Heaven',
    lat: 0,
    lng: 0,
    ...overrides,
  };
}

const lisbon: CityCentroid = {
  id: 'lisbon-pt',
  city: 'Lisbon',
  country: 'Portugal',
  countryCode: 'PT',
  lat: 38.7,
  lng: -9.1,
};
const denpasar: CityCentroid = {
  id: 'denpasar-id',
  city: 'Denpasar',
  country: 'Indonesia',
  countryCode: 'ID',
  lat: -8.7,
  lng: 115.2,
};
const citiesById = new Map([
  [lisbon.id, lisbon],
  [denpasar.id, denpasar],
]);

/* Minimal UL archive entries. coverImage "N_x" resolves to hexagram N via
   ulCardNumber. Hexagram 1 is pure Heaven, 2 pure Earth (no shared trigram);
   11 is Earth over Heaven (kin with both). */
function art(id: string, hexagram: number): Artwork {
  return {
    id,
    title: `Test ${id}`,
    category: 'Multidimensional Art',
    series: 'Universal Language',
    coverImage: `${hexagram}_test`,
    images: [],
    description: '',
    year: '2026',
    availability: 'SOLD',
  };
}

function state(pieces: PublicAtlasState['pieces']): PublicAtlasState {
  return {
    generatedAt: '2026-06-10T00:00:00.000Z',
    schemaVersion: 1,
    pieces,
    cities: [lisbon, denpasar],
  };
}

describe('isKin', () => {
  it('matches any shared trigram, order independent', () => {
    const a = node({ pieceId: 'A', upperTrigram: 'Heaven', lowerTrigram: 'Lake' });
    const b = node({ pieceId: 'B', upperTrigram: 'Earth', lowerTrigram: 'Heaven' });
    expect(isKin(a, b)).toBe(true);
    expect(isKin(b, a)).toBe(true);
  });

  it('rejects pieces with no shared trigram', () => {
    const a = node({ pieceId: 'A', upperTrigram: 'Heaven', lowerTrigram: 'Heaven' });
    const b = node({ pieceId: 'B', upperTrigram: 'Earth', lowerTrigram: 'Earth' });
    expect(isKin(a, b)).toBe(false);
  });

  it('never pairs sibling editions of the same piece', () => {
    const ed1 = node({ pieceId: 'A', key: 'A:1', editionNumber: 1 });
    const ed2 = node({ pieceId: 'A', key: 'A:2', editionNumber: 2 });
    expect(isKin(ed1, ed2)).toBe(false);
  });
});

describe('buildKinshipIndex', () => {
  it('keys nodes by pieceId:editionNumber with 0 for missing editions', () => {
    const index = buildKinshipIndex(
      state([
        {
          pieceId: 'UL-1',
          series: 'Universal Language',
          cityId: 'lisbon-pt',
          status: 'placed',
        },
        {
          pieceId: 'UL-2',
          editionNumber: 2,
          series: 'Universal Language',
          cityId: 'denpasar-id',
          status: 'placed',
        },
      ]),
      citiesById,
      [art('UL-1', 1), art('UL-2', 2)],
    );
    // Same convention as ledger.ts groupChains / projectAll.
    expect(Array.from(index.nodes.keys()).sort()).toEqual(['UL-1:0', 'UL-2:2']);
  });

  it('pairs pieces sharing a trigram, skips unrelated ones', () => {
    const index = buildKinshipIndex(
      state([
        {
          pieceId: 'UL-1',
          series: 'Universal Language',
          cityId: 'lisbon-pt',
          status: 'placed',
        },
        {
          pieceId: 'UL-2',
          series: 'Universal Language',
          cityId: 'denpasar-id',
          status: 'placed',
        },
        {
          pieceId: 'UL-11',
          series: 'Universal Language',
          cityId: 'lisbon-pt',
          status: 'placed',
        },
      ]),
      citiesById,
      [art('UL-1', 1), art('UL-2', 2), art('UL-11', 11)],
    );
    const pairKeys = index.pairs
      .map((p) => `${p.aKey}|${p.bKey}`)
      .sort();
    // Hexagram 11 (Earth over Heaven) is kin with both pure hexagrams;
    // 1 (Heaven) and 2 (Earth) share nothing. ('UL-11:0' sorts before
    // 'UL-1:0' — '1' < ':' in ASCII.)
    expect(pairKeys).toEqual(['UL-11:0|UL-1:0', 'UL-11:0|UL-2:0']);
  });

  it('excludes same-piece sibling editions from the arc list', () => {
    const index = buildKinshipIndex(
      state([
        {
          pieceId: 'UL-1',
          editionNumber: 1,
          series: 'Universal Language',
          cityId: 'lisbon-pt',
          status: 'placed',
        },
        {
          pieceId: 'UL-1',
          editionNumber: 2,
          series: 'Universal Language',
          cityId: 'denpasar-id',
          status: 'placed',
        },
      ]),
      citiesById,
      [art('UL-1', 1)],
    );
    expect(index.nodes.size).toBe(2);
    expect(index.pairs).toEqual([]);
  });
});
