import { test, expect } from './fixtures';

// Canonical six-line patterns from the Markdown-derived Oracle corpus, in
// card-number order. Each digit is one solid line; zero is broken. Keeping
// this expected sequence independent of the renderer catches changes to
// either its trigram mapping or its top-to-bottom joining order.
const EXPECTED_LINES = [
  '111111', '000000', '010001', '100010', '010111', '111010', '000010', '010000',
  '110111', '111011', '000111', '111000', '111101', '101111', '000100', '001000',
  '011001', '100110', '000011', '110000', '101001', '100101', '100000', '000001',
  '111001', '100111', '100001', '011110', '010010', '101101', '011100', '001110',
  '111100', '001111', '101000', '000101', '110101', '101011', '010100', '001010',
  '100011', '110001', '011111', '111110', '011000', '000110', '011010', '010110',
  '011101', '101110', '001001', '100100', '110100', '001011', '001101', '101100',
  '110110', '011011', '110010', '010011', '110011', '001100', '010101', '101010',
];

test('gateway renders the canonical six lines for all 64 hexagrams', async ({ page }) => {
  await page.goto('/gateway');
  const glyphs = page.locator('g.og-hex');
  await expect(glyphs).toHaveCount(64);

  for (const [index, expected] of EXPECTED_LINES.entries()) {
    const glyph = glyphs.nth(index);
    const actual = await glyph.locator('g[aria-hidden="true"]').evaluate((group) => {
      const counts = new Map<string, number>();
      for (const rect of group.querySelectorAll('rect:not(.og-hex-hit)')) {
        const y = rect.getAttribute('y') ?? '';
        counts.set(y, (counts.get(y) ?? 0) + 1);
      }
      const rows = [...counts.values()];
      return {
        valid: rows.length === 6 && rows.every((count) => count === 1 || count === 2),
        pattern: rows.map((count) => count === 1 ? '1' : '0').join(''),
      };
    });

    expect(actual.valid, `six valid rendered rows for card ${index + 1}`).toBe(true);
    expect(actual.pattern, `rendered lines for card ${index + 1}`).toBe(expected);
  }
});
