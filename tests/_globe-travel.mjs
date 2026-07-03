// Temp dev tool: verify selection HUD + thread travel on the atlas globe.
// Selects a piece via deep link, clicks its first kin entry, and captures
// frames through the travel flight.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const dir = 'test-results/globe-travel';
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

// Find a placed piece that has kin: load the same state the app loads
// (dev server has no API; the app falls back to its seed).
await page.goto('http://localhost:2222/atlas', { waitUntil: 'domcontentloaded' });
const placed = await page.evaluate(async () => {
  const m = await import('/lib/atlas/state.ts');
  const s = await m.loadAtlasState();
  return s.pieces.filter((p) => p.status === 'placed' && p.cityId);
});
const first = placed[0];
const key = `${first.pieceId}${typeof first.editionNumber === 'number' ? `:${first.editionNumber}` : ''}`;
console.log('selecting', key, 'of', placed.length, 'placed');

await page.goto(`http://localhost:2222/atlas?piece=${encodeURIComponent(key)}`, {
  waitUntil: 'domcontentloaded',
});
await page.waitForTimeout(9000); // intro + selection tween settle
await page.screenshot({ path: `${dir}/1-selected.png` });

// HUD kin list: first kin button inside the HUD card.
const kinButton = page.locator('ul button').first();
const hasKin = (await kinButton.count()) > 0;
console.log('kin buttons:', await page.locator('ul button').count());
if (hasKin) {
  await kinButton.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/2-travel-early.png` });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/3-travel-mid.png` });
  const caption = await page
    .locator('div', { hasText: /traveling the .* thread/ })
    .last()
    .textContent()
    .catch(() => null);
  console.log('travel caption:', caption);
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${dir}/4-arrived.png` });
}

// Esc releases.
await page.keyboard.press('Escape');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${dir}/5-released.png` });
console.log('done');
await browser.close();
