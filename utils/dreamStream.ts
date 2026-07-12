/**
 * Dream Stream route builder for the Atlas.
 *
 * The Dream Stream is a feed-like way to browse the dream-bearing lights with
 * zero effort: one gesture flies the camera to the next light and opens its
 * vessel. This module turns the set of currently visible dream stops into a
 * deterministic route the page can walk forward and back.
 *
 * The route starts at the artist's first light (claimOrdinal 1 when present),
 * then repeatedly hops to the nearest not-yet-visited light by great-circle
 * distance, a quiet sweep across the earth rather than a jump list. No
 * randomness: ties resolve by a stable pre-sort (claimOrdinal, then key), so
 * the same seed always yields the same order.
 *
 * Many lights can rest on one city point (the seed places three dreams in
 * Lisbon). Same-point lights are gathered consecutively by construction: the
 * route walks points, not individual lights, and emits every light at a
 * point together, ordered by claimOrdinal ascending, so a same-point hop is
 * always the next dream at the same place rather than a scattered return.
 */

import { greatCircleDistance } from './kinship';

/** A dream-bearing light the stream can rest on. */
export interface DreamStop {
  /** Matches the GlobeNode id / selection key (`pieceId:editionNumber`). */
  key: string;
  lat: number;
  lng: number;
  /** Founding Lights ordinal, when the light carries one. */
  claimOrdinal?: number;
}

/** A point on the earth holding one or more dream-bearing lights. */
interface DreamPoint {
  lat: number;
  lng: number;
  /** Ordinal used to break nearest-neighbour ties; the point's lowest. */
  minOrdinal: number;
  /** Lowest member key, for a final stable tie-break. */
  minKey: string;
  /** Member keys, ordered by claimOrdinal ascending (then key). */
  keys: string[];
}

/** Cluster stops onto shared city points (coordinates rounded to ~1e-4 deg). */
function clusterPoints(stops: readonly DreamStop[]): DreamPoint[] {
  const byCoord = new Map<string, DreamStop[]>();
  for (const s of stops) {
    const id = `${s.lat.toFixed(4)},${s.lng.toFixed(4)}`;
    const arr = byCoord.get(id);
    if (arr) arr.push(s);
    else byCoord.set(id, [s]);
  }

  const points: DreamPoint[] = [];
  for (const members of byCoord.values()) {
    const ordered = [...members].sort((a, b) => {
      const ao = a.claimOrdinal ?? Number.POSITIVE_INFINITY;
      const bo = b.claimOrdinal ?? Number.POSITIVE_INFINITY;
      if (ao !== bo) return ao - bo;
      return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
    });
    points.push({
      lat: ordered[0].lat,
      lng: ordered[0].lng,
      minOrdinal: ordered[0].claimOrdinal ?? Number.POSITIVE_INFINITY,
      minKey: ordered.reduce((m, s) => (s.key < m ? s.key : m), ordered[0].key),
      keys: ordered.map((s) => s.key),
    });
  }
  return points;
}

/**
 * Build the ordered list of selection keys for the Dream Stream.
 *
 * Deterministic: lights are clustered onto city points, points are pre-sorted
 * by (minOrdinal, minKey) so nearest-neighbour ties always break the same way,
 * and every light at a point is emitted together in claimOrdinal order. The
 * walk starts at the point holding claimOrdinal 1 when present, otherwise the
 * first point in the stable order. Returns [] for an empty input.
 */
export function buildDreamRoute(stops: readonly DreamStop[]): string[] {
  if (stops.length === 0) return [];

  const points = clusterPoints(stops).sort((a, b) => {
    if (a.minOrdinal !== b.minOrdinal) return a.minOrdinal - b.minOrdinal;
    return a.minKey < b.minKey ? -1 : a.minKey > b.minKey ? 1 : 0;
  });

  const start =
    points.find((p) => p.minOrdinal === 1) ?? points[0];

  const remaining = new Set(points);
  remaining.delete(start);
  const ordered: DreamPoint[] = [start];
  let current = start;

  while (remaining.size > 0) {
    let best: DreamPoint | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    // Walk the stable `points` order so equal distances resolve the same way.
    for (const p of points) {
      if (!remaining.has(p)) continue;
      const d = greatCircleDistance(current.lat, current.lng, p.lat, p.lng);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    if (!best) break;
    ordered.push(best);
    remaining.delete(best);
    current = best;
  }

  return ordered.flatMap((p) => p.keys);
}
