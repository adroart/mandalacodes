// Temp dev tool: screenshot any route, desktop + mobile.
// Usage: node tests/_page-shot.mjs <path> <label> [waitMs]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const route = process.argv[2] ?? '/';
const label = process.argv[3] ?? 'page';
const waitMs = Number(process.argv[4] ?? 2500);
const dir = 'test-results/pages';
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch();
for (const [name, viewport] of [
  ['desktop', { width: 1280, height: 800 }],
  ['mobile', { width: 390, height: 844 }],
]) {
  const page = await browser.newPage({ viewport });
  await page.goto(`http://localhost:2222${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: `${dir}/${label}-${name}.png`, fullPage: name === 'mobile' ? false : true });
  console.log(`${label}-${name} ok`);
  await page.close();
}
await browser.close();
