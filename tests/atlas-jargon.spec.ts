import { test, expect } from './fixtures';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:2222';

const atlas = {
  ok: true,
  state: {
    generatedAt: '2026-11-16T00:00:00.000Z',
    schemaVersion: 2,
    cities: [
      { id: 'lisbon-pt', city: 'Lisbon', country: 'Portugal', countryCode: 'PT', lat: 38.7223, lng: -9.1393 },
    ],
    pieces: [
      { pieceId: 'UL-122', editionNumber: 1, series: 'Universal Language', cityId: 'lisbon-pt', status: 'placed', pieceType: 'mandala', claimOrdinal: 1, kind: 'sixty-four' },
      { pieceId: 'UL-162', editionNumber: 1, series: 'Universal Language', cityId: null, status: 'seeking', pieceType: 'mandala', kind: 'sixty-four' },
    ],
  },
};

test('atlas explains the active filter terms', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('atlas-overture-v1', '1'));
  await page.route('**/api/atlas', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(atlas),
  }));
  await page.route('**/api/atlas/catalog', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, entries: [] }),
  }));
  await page.goto(`${BASE}/atlas`, { waitUntil: 'networkidle' });
  await page.keyboard.press('Space');

  const filter = page.getByRole('button', { name: 'filter', exact: true });
  if (await filter.count()) await filter.click();
  await expect(page.getByRole('group', { name: 'Status filter' })).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Show kinship threads' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Seeking ground', exact: true }).click();
  await expect(page.getByText('Seeking ground means a piece has no public place on the map yet.')).toBeVisible();
  await expect(page.getByRole('link', { name: /claim/i })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('atlas-jargon.png'), scale: 'css' });
});

test('a selected claimed piece explains its founding light number', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('atlas-overture-v1', '1'));
  await page.route('**/api/atlas', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(atlas),
  }));
  await page.route('**/api/atlas/catalog', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ok: true, entries: [] }),
  }));
  await page.goto(`${BASE}/atlas?piece=UL-122%3A1`, { waitUntil: 'networkidle' });
  await page.keyboard.press('Space');
  const openBook = page.getByRole('button', { name: 'open the book' });
  if (await openBook.count()) await openBook.click();

  await expect(page.getByText('Founding light numbers show the order in which pieces were first claimed.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('atlas-founding-light.png'), scale: 'css' });
});
