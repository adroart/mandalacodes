import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/* The empty-atlas distinction: "Nothing matches. Loosen a filter." is only
 * honest when a filter reduced a non-empty record to nothing. A valid-but-
 * empty atlas (no pieces at all, no filters active) has nothing to loosen,
 * so every zero-results surface must carry the quiet awaiting line instead.
 * Same source-assertion style as atlasRetiredUi.test.ts. */

const AWAITING = 'the sky is waiting for its first light.';
const NOTHING_MATCHES = 'Nothing matches. Loosen a filter.';

const SURFACES: { file: string; totalGuard: string }[] = [
  { file: 'components/atlas/TheWall.tsx', totalGuard: 'cards.length === 0' },
  { file: 'components/atlas/TheLedger.tsx', totalGuard: 'pool.length === 0' },
  { file: 'components/atlas/TheRegistry.tsx', totalGuard: 'pool.length === 0' },
];

describe('empty-atlas copy vs over-narrowed copy', () => {
  for (const surface of SURFACES) {
    it(`${surface.file} distinguishes an empty atlas from an over-narrowed one`, async () => {
      const source = await readFile(resolve(surface.file), 'utf8');

      // Both lines exist: the awaiting line for a truly empty record...
      expect(source).toContain(AWAITING);
      // ...and the loosen-a-filter line for a filtered-to-zero one.
      expect(source).toContain(NOTHING_MATCHES);

      // The awaiting line is gated on the UNFILTERED total, and it comes
      // first: an empty atlas must never be told to loosen a filter.
      const guardAt = source.indexOf(surface.totalGuard);
      const awaitingAt = source.indexOf(AWAITING);
      const nothingAt = source.indexOf(NOTHING_MATCHES);
      expect(guardAt, `total-count guard ${surface.totalGuard}`).toBeGreaterThan(-1);
      expect(guardAt).toBeLessThan(awaitingAt);
      expect(awaitingAt).toBeLessThan(nothingAt);

      // Tone contract: the awaiting line is a quiet font-display italic,
      // like the page's other liminal states.
      const styleWindow = source.slice(Math.max(0, awaitingAt - 400), awaitingAt);
      expect(styleWindow).toContain('font-display italic');
    });
  }
});
