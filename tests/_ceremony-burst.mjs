// Temp dev tool: capture the claim ceremony rehearsal at timed intervals.
// Usage: node tests/_ceremony-burst.mjs [pieceKey]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const piece = process.argv[2] ?? 'UL-122';
const dir = 'test-results/ceremony';
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:2222/atlas/claim?ceremony=${encodeURIComponent(piece)}`, {
  waitUntil: 'domcontentloaded',
});

const marks = [2000, 4000, 6000, 8000, 9500, 11500];
let prev = 0;
for (const t of marks) {
  await page.waitForTimeout(t - prev);
  prev = t;
  await page.screenshot({ path: `${dir}/t${String(t).padStart(5, '0')}.png` });
  console.log(`captured t=${t}ms`);
}
await browser.close();
