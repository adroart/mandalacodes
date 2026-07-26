// Measure real composited contrast for the atlas band at rest, walking up the
// ancestor chain to accumulate every opacity actually applied.
/**
 * Atlas legibility probe: measure the REAL composited contrast of the globe
 * stage's chrome at rest, and fail loudly if any of it drops under AA.
 *
 * Why this exists as a script and not a unit test: the numbers that matter here
 * are not the token values. They are the product of a token, a per-element
 * alpha, and every ancestor opacity (the idle fade), composited over the stage
 * night, inside a `dark` wrapper that INVERTS the wood ramp. That product is
 * only knowable in a real browser, and getting it wrong is invisible to
 * typecheck, to tests, and to a screenshot glanced at on a bright monitor.
 *
 * Run against a dev server:
 *   node tests/_atlas-contrast.mjs                 # defaults to :2231, phone
 *   ATLAS_URL=http://localhost:2222 node tests/_atlas-contrast.mjs 1440 900
 *
 * Exits non-zero on any failure, so it can gate a change to the band.
 */

import { chromium } from 'playwright';
const W = Number(process.argv[2] || 390), H = Number(process.argv[3] || 844);
const BASE = process.env.ATLAS_URL || 'http://localhost:2231';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
await page.goto(`${BASE}/atlas`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);
await page.mouse.click(W / 2, H * 0.85);
await page.waitForTimeout(9000); // let the idle fade settle

const rows = await page.evaluate(() => {
  const lin = (v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const L = ([r, g, b]) => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255);
  const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number);
  const BG = [15, 13, 11]; // --color-atlas-night
  const stage = document.querySelector('section[aria-label="Atlas globe"]');
  if (!stage) return [];
  const out = [];
  for (const el of stage.querySelectorAll('p, a, button, span')) {
    const txt = (el.textContent || '').trim();
    if (!txt || txt.length > 90) continue;
    if (el.querySelector('p, a, button')) continue; // leaf-ish only
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    // Accumulate every opacity on the ancestor chain, which is the bug the old
    // code hid: a per-element alpha multiplied by a block-level idle fade.
    let a = 1, n = el;
    while (n && n !== document.documentElement) { a *= parseFloat(getComputedStyle(n).opacity || '1'); n = n.parentElement; }
    const [cr, cg, cb, ca = 1] = parse(cs.color);
    const eff = a * ca;
    const fg = [cr, cg, cb].map((c, i) => c * eff + BG[i] * (1 - eff));
    const ratio = (L(fg) + 0.05) / (L(BG) + 0.05);
    const px = parseFloat(cs.fontSize);
    const large = px >= 24 || (px >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
    out.push({ col: cs.color, text: txt.slice(0, 34), px: +px.toFixed(0), eff: +eff.toFixed(2), ratio: +ratio.toFixed(2), need: large ? 3 : 4.5 });
  }
  return out;
});
const seen = new Set();
let fails = 0;
for (const r of rows) {
  if (seen.has(r.text)) continue; seen.add(r.text);
  const ok = r.ratio >= r.need;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${String(r.ratio).padStart(6)}:1  (need ${r.need})  ${String(r.px).padStart(2)}px a=${r.eff}  ${r.text}   [${r.col}]`);
}
console.log(fails ? `\n${fails} FAILING` : '\nall pass');
if (fails) process.exitCode = 1;
await browser.close();
