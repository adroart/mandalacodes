/**
 * Guard for the master style file (src/theme.css).
 *
 * Colours, control sizes, font sizes and font families belong to the master
 * file. This test freezes the number of hard-coded ones in every other file
 * at its count on the day the master file landed, so the count can only go
 * down. A new hex colour, a new `padding: 13px`, a new `text-[13px]`, a new
 * `font-family: 'Lora'` fails here: use a role from src/theme.css (text-body,
 * text-ink, bg-page, var(--font-reading)) or a master control (.btn, .field)
 * instead. After migrating a file, lower its baseline with
 * `node scripts/style-guard.mjs --write`.
 */
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BASELINE_PATH, KINDS, countAll, countText, totals } from '../../scripts/style-guard.mjs';

type Kind = 'colors' | 'sizes' | 'fontSizes' | 'fonts';
type Counts = Record<string, Record<Kind, number>>;
const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as {
  totals: Record<Kind, number>;
  files: Counts;
};
const kinds = KINDS as Kind[];

describe('master style file guard', () => {
  const now = countAll() as Counts;

  it('adds no hard-coded colour, size, font size or font to any file', () => {
    const over: string[] = [];
    for (const [file, c] of Object.entries(now)) {
      const was = baseline.files[file];
      for (const k of kinds) {
        const ceiling = was?.[k] ?? 0;
        if ((c[k] ?? 0) > ceiling) over.push(`${file}: ${c[k]} ${k} (ceiling ${ceiling})`);
      }
    }
    expect(over, 'Use a role from src/theme.css or a master control (.btn, .field) instead').toEqual([]);
  });

  it('keeps the site-wide totals at or under the ceiling', () => {
    const t = totals(now) as Record<Kind, number>;
    for (const k of kinds) expect(t[k], k).toBeLessThanOrEqual(baseline.totals[k]);
  });

  it('catches a new hard-coded value (the guard is not blind)', () => {
    const sample = [
      '.x { color: #123456; background: rgba(0,0,0,.5); padding: 13px 18px; min-height: 46px; }',
      '.z { font-size: 13px; font-family: "Lora", serif; }',
      '<b className="h-[46px] py-[13px] text-[11px]" style={{ padding: 14, height: \'50px\', fontSize: 15, fontFamily: \'Karla\' }} />',
    ].join('\n');
    expect(countText(sample)).toEqual({ colors: 2, sizes: 6, fontSizes: 3, fonts: 2 });
    expect(countText([
      '.y { padding: 0 var(--control-pad-x); height: var(--control-h); font-size: var(--text-body); font-family: var(--font-reading); }',
      '<i className="text-caption text-ink bg-page" style={{ fontFamily: \'var(--font-ui)\' }} />',
    ].join('\n'))).toEqual({ colors: 0, sizes: 0, fontSizes: 0, fonts: 0 });
  });
});
