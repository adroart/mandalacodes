/**
 * Guard for the master style file (src/theme.css).
 *
 * Colours and control sizes belong to the master file. This test freezes the
 * number of hard-coded colours and hard-coded control sizes in every other
 * file at its count on the day the master file landed, so the count can only
 * go down. A new hex colour, a new `padding: 13px`, a new `h-[46px]` fails
 * here: use a token from src/theme.css or a master control (.btn, .field)
 * instead. After migrating a file, lower its baseline with
 * `node scripts/style-guard.mjs --write`.
 */
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BASELINE_PATH, countAll, countText, totals } from '../../scripts/style-guard.mjs';

type Counts = Record<string, { colors: number; sizes: number }>;
const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as {
  totals: { colors: number; sizes: number };
  files: Counts;
};

describe('master style file guard', () => {
  const now = countAll() as Counts;

  it('adds no hard-coded colour or control size to any file', () => {
    const over: string[] = [];
    for (const [file, c] of Object.entries(now)) {
      const was = baseline.files[file] ?? { colors: 0, sizes: 0 };
      if (c.colors > was.colors) over.push(`${file}: ${c.colors} colours (ceiling ${was.colors})`);
      if (c.sizes > was.sizes) over.push(`${file}: ${c.sizes} sizes (ceiling ${was.sizes})`);
    }
    expect(over, 'Use a token from src/theme.css or a master control (.btn, .field) instead').toEqual([]);
  });

  it('keeps the site-wide totals at or under the ceiling', () => {
    const t = totals(now);
    expect(t.colors).toBeLessThanOrEqual(baseline.totals.colors);
    expect(t.sizes).toBeLessThanOrEqual(baseline.totals.sizes);
  });

  it('catches a new hard-coded value (the guard is not blind)', () => {
    const sample = [
      '.x { color: #123456; background: rgba(0,0,0,.5); padding: 13px 18px; min-height: 46px; }',
      '<b className="h-[46px] py-[13px]" style={{ padding: 14, height: \'50px\' }} />',
    ].join('\n');
    expect(countText(sample)).toEqual({ colors: 2, sizes: 6 });
    expect(countText('.y { padding: 0 var(--control-pad-x); height: var(--control-h); }')).toEqual({ colors: 0, sizes: 0 });
  });
});
