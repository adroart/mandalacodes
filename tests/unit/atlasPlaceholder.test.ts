/**
 * Unit tests for data/atlasPlaceholder.ts — the TEMPORARY launch samples.
 *
 * These lock the contract loadAtlasState() and the sample-sky caption depend
 * on: exactly FIVE fully-built-out sample pieces, all resolving in
 * FULL_ARCHIVE (and cities.ts where placed), the spread of expressions
 * (three placed on three continents, one unawakened, one seeking), every
 * free-text field unmistakably marked as a sample, and the placeholder flag.
 * When the real registry is seeded this whole file is deleted alongside
 * data/atlasPlaceholder.ts.
 */
import { describe, expect, it } from 'vitest';
import { buildPlaceholderAtlasState } from '../../data/atlasPlaceholder';
import { FULL_ARCHIVE } from '../../data/mockData';
import { CITIES_BY_ID } from '../../data/cities';

describe('buildPlaceholderAtlasState', () => {
  const state = buildPlaceholderAtlasState();

  it('returns exactly 5 pieces', () => {
    expect(state.pieces).toHaveLength(5);
  });

  it('marks the state as placeholder (the truth-marker)', () => {
    expect(state.placeholder).toBe(true);
  });

  it('resolves every pieceId in FULL_ARCHIVE', () => {
    for (const p of state.pieces) {
      expect(FULL_ARCHIVE.find((a) => a.id === p.pieceId)).toBeTruthy();
    }
  });

  it('resolves every non-null cityId in cities.ts', () => {
    for (const p of state.pieces) {
      if (p.status === 'seeking') continue;
      expect(p.cityId).toBeTruthy();
      expect(CITIES_BY_ID.has(p.cityId as string)).toBe(true);
    }
  });

  it('uses five distinct pieceIds and four distinct cities', () => {
    expect(new Set(state.pieces.map((p) => p.pieceId)).size).toBe(5);
    const cityIds = state.pieces.map((p) => p.cityId).filter((c) => c != null);
    expect(new Set(cityIds).size).toBe(4);
  });

  it('has the specified spread of expressions', () => {
    const placed = state.pieces.filter((p) => p.status === 'placed');
    const unawakened = state.pieces.filter((p) => p.status === 'unawakened');
    const seeking = state.pieces.filter((p) => p.status === 'seeking');

    // Three placed, each numbered and dated, in three distinct cities.
    expect(placed).toHaveLength(3);
    for (const p of placed) {
      expect(typeof p.claimOrdinal).toBe('number');
      expect(typeof p.placedAt).toBe('string');
      expect(p.cityId).toBeTruthy();
    }
    expect(new Set(placed.map((p) => p.cityId)).size).toBe(3);

    // One dim ember: unawakened, still at a city so it renders as a dot.
    expect(unawakened).toHaveLength(1);
    expect(unawakened[0].cityId).toBeTruthy();

    // One seeking: no city, lives in the seeking section only.
    expect(seeking).toHaveLength(1);
    expect(seeking[0].cityId).toBeNull();
  });

  it('marks every free-text field unmistakably as a sample', () => {
    const dreams = state.pieces.filter((p) => p.intention);
    expect(dreams.length).toBeGreaterThanOrEqual(1);
    for (const p of dreams) {
      expect(p.intention!.startsWith('sample ')).toBe(true);
    }
    const signed = state.pieces.filter((p) => p.signedBy);
    expect(signed.length).toBeGreaterThanOrEqual(1);
    for (const p of signed) {
      expect(p.signedBy!.name).toBe('a sample steward');
    }
  });

  it('populates cities with exactly the referenced centroids', () => {
    const referenced = new Set(
      state.pieces.map((p) => p.cityId).filter((c): c is string => c != null),
    );
    expect(new Set(state.cities.map((c) => c.id))).toEqual(referenced);
    for (const c of state.cities) {
      expect(CITIES_BY_ID.get(c.id)).toEqual(c);
    }
  });
});
