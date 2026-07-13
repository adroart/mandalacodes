/**
 * Unit tests for data/atlasPlaceholder.ts — the TEMPORARY launch placeholder.
 *
 * These lock the contract loadAtlasState() and the HUD caption depend on:
 * exactly three pieces, all resolving in FULL_ARCHIVE and cities.ts, the three
 * distinct dot expressions, and the placeholder flag. When the real mirror is
 * seeded this whole file is deleted alongside data/atlasPlaceholder.ts.
 */
import { describe, expect, it } from 'vitest';
import { buildPlaceholderAtlasState } from '../../data/atlasPlaceholder';
import { FULL_ARCHIVE } from '../../data/mockData';
import { CITIES_BY_ID } from '../../data/cities';

describe('buildPlaceholderAtlasState', () => {
  const state = buildPlaceholderAtlasState();

  it('returns exactly 3 pieces', () => {
    expect(state.pieces).toHaveLength(3);
  });

  it('marks the state as placeholder', () => {
    expect(state.placeholder).toBe(true);
  });

  it('resolves every pieceId in FULL_ARCHIVE', () => {
    for (const p of state.pieces) {
      expect(FULL_ARCHIVE.find((a) => a.id === p.pieceId)).toBeTruthy();
    }
  });

  it('resolves every cityId in cities.ts', () => {
    for (const p of state.pieces) {
      expect(p.cityId).toBeTruthy();
      expect(CITIES_BY_ID.has(p.cityId as string)).toBe(true);
    }
  });

  it('uses three distinct pieceIds and three distinct cityIds', () => {
    expect(new Set(state.pieces.map((p) => p.pieceId)).size).toBe(3);
    expect(new Set(state.pieces.map((p) => p.cityId)).size).toBe(3);
  });

  it('has the three specified dot expressions', () => {
    const [first, second, third] = state.pieces;
    // 1: a bright kept light — placed, no ordinal.
    expect(first.status).toBe('placed');
    expect(first.claimOrdinal).toBeUndefined();
    // 2: a founding / numbered glow — placed WITH an ordinal.
    expect(second.status).toBe('placed');
    expect(typeof second.claimOrdinal).toBe('number');
    // 3: a dim ember — unawakened, but still carries a city so it renders.
    expect(third.status).toBe('unawakened');
    expect(third.cityId).toBeTruthy();
  });
});
