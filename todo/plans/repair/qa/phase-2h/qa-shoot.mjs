import { chromium } from 'playwright';

const BASE = 'http://localhost:2229';
const OUT = process.env.QA_OUT_DIR || '/tmp/typeahead-qa';
const TAG = process.env.QA_TAG || 'after';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
// Site defaults to dark mode for fresh visitors; admin surfaces are the
// light paper theme, so force light mode for this QA pass.
await page.addInitScript(() => localStorage.setItem('dark-mode', 'false'));

async function shoot(name) {
  await page.screenshot({ path: `${OUT}/${TAG}-${name}.png` });
  console.log(`shot: ${TAG}-${name}.png`);
}

// 1) Admin Atlas: CityAutocomplete (Seed Event section)
await page.goto(`${BASE}/dev/admin-atlas-qa`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await shoot('admin-atlas-closed');

const cityInput = page.locator('input[placeholder="Lisbon, Portugal"]');
await cityInput.click();
await cityInput.fill('ber');
await page.waitForTimeout(300);
await shoot('admin-atlas-city-open');

// 2) Admin Piece Content: PiecePicker
await page.goto(`${BASE}/dev/admin-piece-content-qa`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await shoot('admin-piece-content-closed');

const pieceInput = page.locator('input[placeholder^="Search a piece"]');
await pieceInput.click();
await pieceInput.fill('art');
await page.waitForTimeout(300);
await shoot('admin-piece-content-open');

// 3) Steward book: "Where it rests" picker (QA harness w/ mocked session)
await page.goto(`${BASE}/dev/steward-qa`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await shoot('steward-book-closed');

const stewardCityInput = page.locator('#city-search-input, #city-search');
await stewardCityInput.first().click();
await page.waitForTimeout(300);
await shoot('steward-book-open-empty-query');

await stewardCityInput.first().fill('ber');
await page.waitForTimeout(300);
await shoot('steward-book-open-query');

await browser.close();
