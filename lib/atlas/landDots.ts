/**
 * Client-side loader for the pre-generated land-dots binary atlas.
 *
 * The binary at /atlas/land-dots.bin is produced by scripts/generate-land-dots.ts
 * and holds a packed Float32Array of [lat, lng] pairs in degrees — one pair per
 * land dot on the Fibonacci-sphere dotted globe.  Loading it once and caching
 * the promise keeps the Three.js globe from re-fetching on re-renders.
 */

/** Resolves to a Float32Array of [lat, lng] pairs in degrees. Cached after first load. */
let cache: Promise<Float32Array> | null = null;

export function loadLandDots(): Promise<Float32Array> {
  if (!cache) {
    cache = fetch('/atlas/land-dots.bin')
      .then((res) => {
        if (!res.ok) throw new Error(`land-dots fetch failed: ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buf) => new Float32Array(buf));
  }
  return cache;
}
