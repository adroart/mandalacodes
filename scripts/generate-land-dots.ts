/**
 * Generate a "land dots" dataset for the Three.js dotted globe.
 *
 * Uses a Fibonacci sphere (golden-angle spiral) to distribute candidate points
 * evenly across the entire globe surface, then keeps only those that fall on
 * land using d3-geo's geoContains against the world-atlas land-50m TopoJSON.
 * The result is a compact Float32Array binary (little-endian) of [lat, lng]
 * pairs in degrees, written to public/atlas/land-dots.bin.
 *
 * Land covers ≈ 29 % of the globe, so ~40 000 total samples yields ~11 600
 * kept dots — comfortably in the 10 000–13 000 target range.
 *
 * Regenerate whenever you want to change resolution or the land geometry:
 *   npx tsx scripts/generate-land-dots.ts
 * or: npm run generate:land-dots
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feature } from 'topojson-client';
import { geoContains } from 'd3-geo';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { GeoJSON } from 'geojson';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ── Load land polygons ────────────────────────────────────────────────────────

const topoRaw = readFileSync(
  resolve(root, 'node_modules/world-atlas/land-50m.json'),
  'utf8',
);
const topo = JSON.parse(topoRaw) as Topology<{ land: GeometryCollection }>;
const landFeature = feature(topo, topo.objects.land) as GeoJSON.FeatureCollection;

// ── Fibonacci sphere point generation ────────────────────────────────────────
// Golden-angle spiral ensures near-uniform coverage with no clustering at poles.
// With TOTAL_SAMPLES ≈ 40 000 and land fraction ≈ 29 %, we expect ~11 600 kept.

const TOTAL_SAMPLES = 40_000;
const PHI = Math.PI * (Math.sqrt(5) - 1); // golden angle in radians

const kept: number[] = [];

for (let i = 0; i < TOTAL_SAMPLES; i++) {
  // Map index → latitude via equal-area spacing on the sphere
  const y = 1 - (i / (TOTAL_SAMPLES - 1)) * 2; // -1 … +1
  const latRad = Math.asin(y);                   // -π/2 … +π/2
  const lngRad = ((i * PHI) % (2 * Math.PI)) - Math.PI; // -π … +π

  const lat = (latRad * 180) / Math.PI;
  const lng = (lngRad * 180) / Math.PI;

  if (geoContains(landFeature, [lng, lat])) {
    kept.push(lat, lng);
  }
}

const dotCount = kept.length / 2;

// ── Write binary ──────────────────────────────────────────────────────────────

const outDir = resolve(root, 'public/atlas');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, 'land-dots.bin');

const buffer = new Float32Array(kept);
writeFileSync(outPath, Buffer.from(buffer.buffer));

const fileSizeKB = (buffer.byteLength / 1024).toFixed(1);
console.log(`Kept ${dotCount.toLocaleString()} land dots (${kept.length} floats)`);
console.log(`Written ${outPath} — ${fileSizeKB} KB (${buffer.byteLength} bytes)`);

// ── Sanity-check: print 5 random kept points ─────────────────────────────────
console.log('\nSample points (lat, lng):');
const step = Math.floor(dotCount / 5);
for (let k = 0; k < 5; k++) {
  const idx = (k * step) % dotCount;
  const lat = kept[idx * 2].toFixed(3);
  const lng = kept[idx * 2 + 1].toFixed(3);
  console.log(`  [${k}] lat=${lat}  lng=${lng}`);
}
