/**
 * Unit tests for utils/dreamStream.ts, the Dream Stream route builder.
 *
 * Covers: determinism, the ordinal-1 start, the nearest-neighbour property on
 * a 4-point fixture, that every light appears exactly once (the route wraps
 * nothing), and same-point grouping ordered by claimOrdinal.
 */
import { describe, expect, it } from 'vitest';
import { buildDreamRoute, type DreamStop } from '../../utils/dreamStream';

describe('buildDreamRoute', () => {
  it('returns [] for no stops', () => {
    expect(buildDreamRoute([])).toEqual([]);
  });

  it('is deterministic and starts at claimOrdinal 1', () => {
    // Four points on the equator; A is the artist's first light.
    const stops: DreamStop[] = [
      { key: 'B', lat: 0, lng: 40, claimOrdinal: 2 },
      { key: 'D', lat: 0, lng: 30, claimOrdinal: 4 },
      { key: 'A', lat: 0, lng: 0, claimOrdinal: 1 },
      { key: 'C', lat: 0, lng: 10, claimOrdinal: 3 },
    ];
    const route = buildDreamRoute(stops);
    // Start at ordinal 1, then nearest unvisited each hop:
    // A(0) -> C(10) -> D(30) -> B(40).
    expect(route[0]).toBe('A');
    expect(route).toEqual(['A', 'C', 'D', 'B']);
    // Same input, same order, no randomness.
    expect(buildDreamRoute([...stops].reverse())).toEqual(route);
  });

  it('visits every light exactly once (wraps nothing)', () => {
    const stops: DreamStop[] = [
      { key: 'A', lat: 10, lng: 10, claimOrdinal: 1 },
      { key: 'B', lat: -20, lng: 60, claimOrdinal: 2 },
      { key: 'C', lat: 40, lng: -30, claimOrdinal: 3 },
    ];
    const route = buildDreamRoute(stops);
    expect(route).toHaveLength(3);
    expect(new Set(route).size).toBe(3);
  });

  it('groups same-point lights consecutively, ordered by claimOrdinal', () => {
    // Three lights on one city point (out of ordinal order in the input) plus
    // a distant start.
    const stops: DreamStop[] = [
      { key: 'START', lat: -8.65, lng: 115.2, claimOrdinal: 1 },
      { key: 'L-mid', lat: 38.72, lng: -9.14, claimOrdinal: 5 },
      { key: 'L-late', lat: 38.72, lng: -9.14, claimOrdinal: 8 },
      { key: 'L-early', lat: 38.72, lng: -9.14, claimOrdinal: 2 },
    ];
    const route = buildDreamRoute(stops);
    expect(route[0]).toBe('START');
    // The trio arrives together, lowest ordinal first.
    expect(route.slice(1)).toEqual(['L-early', 'L-mid', 'L-late']);
  });
});
