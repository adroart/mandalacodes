/**
 * Regression guard for the Hologenetic Profile math.
 *
 * The 11 positions are computed from an ephemeris + the Human Design wheel,
 * then each is mapped to a specific planet/side. That mapping is easy to get
 * subtly wrong (it was, once: the Venus and Pearl sequences had swapped
 * planets). This script recomputes a known chart and diffs all 11 positions
 * against an official Gene Keys Publishing reading, exiting non-zero on any
 * mismatch so a regression is caught before deploy.
 *
 * Run:  npx tsx scripts/verify-profile-math.ts   (or `npm run verify:profile`)
 *
 * Fixture: Adrian, 15 Jan 1982, 11:39pm, Santa Cruz CA (PST, UTC-8) ->
 * 1982-01-16 07:39 UTC. Values transcribed from the official chart.
 */

import { buildHologeneticProfile } from '../lib/astrology/profile';

const FIXTURES = [
  {
    name: 'Adrian · 15 Jan 1982 23:39 PST · Santa Cruz',
    utcBirth: new Date('1982-01-16T07:39:00Z'),
    expected: {
      lifesWork: '61.6', evolution: '62.6', radiance: '50.2', purpose: '3.2',
      attraction: '33.6', iq: '41.3', eq: '48.4', sq: '5.3',
      venusCore: '59.1' /* re-read of Vocation gate */,
      core: '59.1' /* Vocation */, culture: '32.2',
      brand: '61.6' /* re-read of Life's Work gate */, pearl: '44.1',
    },
  },
] as const;

let failures = 0;
for (const fx of FIXTURES) {
  const p = buildHologeneticProfile({ utcBirth: fx.utcBirth });
  console.log(`\n${fx.name}`);
  for (const [key, want] of Object.entries(fx.expected)) {
    const gl = p[key as keyof typeof p];
    const got = `${gl.gate}.${gl.line}`;
    const ok = got === want;
    if (!ok) failures++;
    console.log(`  ${key.padEnd(11)} ${got.padEnd(8)} expected ${want.padEnd(8)} ${ok ? 'OK' : 'MISMATCH'}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} position(s) mismatched. Profile math is wrong.`);
  process.exit(1);
}
console.log('\nAll positions match the official chart. Profile math is correct.');
