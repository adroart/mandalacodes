import { test, expect } from './fixtures';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:2222';
const DREAM = 'A distinctive dream of luminous shelter beside the sea.';
const atlas = {
  ok: true,
  state: {
    generatedAt: '2026-11-16T00:00:00.000Z',
    schemaVersion: 2,
    cities: [
      { id: 'lisbon-pt', city: 'Lisbon', country: 'Portugal', countryCode: 'PT', lat: 38.7223, lng: -9.1393 },
      { id: 'denpasar-id', city: 'Denpasar', country: 'Indonesia', countryCode: 'ID', lat: -8.65, lng: 115.2167 },
    ],
    pieces: [
      { pieceId: 'UL-122', editionNumber: 1, series: 'Universal Language', cityId: 'lisbon-pt', status: 'placed', pieceType: 'mandala', claimOrdinal: 1, kind: 'sixty-four', intention: DREAM },
      { pieceId: 'UL-114', editionNumber: 1, series: 'Universal Language', cityId: 'denpasar-id', status: 'placed', pieceType: 'mandala', claimOrdinal: 2, kind: 'sixty-four', intention: 'Another public dream by the mountain.' },
      { pieceId: 'UL-163', editionNumber: 1, series: 'Universal Language', cityId: null, status: 'seeking', pieceType: 'mandala', kind: 'sixty-four' },
    ],
  },
};

async function openFixture(page: import('@playwright/test').Page, url = '/atlas') {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('atlas-overture-v1', '1'));
  await page.route('**/api/atlas', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(atlas) }));
  await page.route('**/api/atlas/catalog', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, entries: [] }) }));
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle' });
  await page.keyboard.press('Enter');
  await expect(page.getByText('We are one global family of resonance', { exact: false })).toHaveCount(0);
}

test('dream prose appears only inside opened records, with wall search and filters intact', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFixture(page);
  const wall = page.getByRole('region', { name: 'The wall' });
  await expect(wall).toBeVisible();
  await expect(page.getByText(DREAM, { exact: true })).toHaveCount(0);
  await expect(wall.getByRole('button', { name: /Open the record of/ }).first()).toBeVisible();
  await expect(wall.getByRole('button', { name: 'the dreams' })).toHaveCount(0);
  await expect(wall.getByRole('button', { name: 'Stand near' })).toBeVisible();
  await expect(wall.getByRole('combobox', { name: /kind/i })).toBeVisible();
  await expect(wall.getByRole('combobox', { name: /status/i })).toBeVisible();
  const search = wall.getByRole('searchbox');
  await search.fill('luminous shelter');
  await expect(wall.getByText('1 of 3 pieces')).toBeVisible();
  await wall.getByRole('button', { name: /Open the record of/ }).first().click();
  await expect(wall.getByText(DREAM, { exact: true })).toBeVisible();
  await wall.getByRole('button', { name: 'show art' }).click();
  await expect(wall.getByRole('button', { name: 'show dream' })).toBeVisible();
  await wall.getByRole('button', { name: 'close' }).click();
  await expect(page.getByText(DREAM, { exact: true })).toHaveCount(0);
});

test('globe keeps only Series and status, and has no dream hopping or timed hints with lenses flag', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFixture(page, '/atlas?lenses=1&piece=UL-122%3A1');
  await expect(page.getByText(DREAM, { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'open the book' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'dreams', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'open the book' }).click();
  await expect(page.getByText(DREAM, { exact: true })).toBeVisible();
  const cardReturn = page.locator('[data-atlas-hud]').getByRole('button', { name: 'return', exact: true });
  await expect(cardReturn).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('opened-card-1440.png'), scale: 'css' });
  await cardReturn.click();
  await expect(page.getByText(DREAM, { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'filter', exact: true }).click();
  const panel = page.getByText('Refine the map').locator('..').locator('..');
  await expect(panel.getByRole('combobox', { name: 'Series' })).toBeVisible();
  await expect(panel.getByRole('group', { name: 'Status filter' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Seeking ground' })).toBeVisible();
  await expect(panel.getByRole('switch')).toHaveCount(0);
  await expect(panel.getByText(/Kind|Category|Size|Threads|Mandala|Legend|Lens/, { exact: true })).toHaveCount(0);
  await expect(panel.getByText('Lines connect placed pieces whose codes share a three-line symbol.', { exact: false })).toBeVisible();
});

test('populated phone reading and narrow filter fit', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await openFixture(page);
  await expect(page.getByText(DREAM, { exact: true })).toHaveCount(0);
  const stageHeight = await page.locator('[data-atlas-stage]').evaluate((el) => el.getBoundingClientRect().height);
  expect(stageHeight).toBeLessThanOrEqual(561);
  await page.screenshot({ path: testInfo.outputPath('phone-globe-393.png'), scale: 'css' });
  const wall = page.getByRole('region', { name: 'The wall' });
  await wall.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('phone-wall-393.png'), scale: 'css' });
  await wall.getByRole('button', { name: /Open the record of Earth's Breath/ }).getByText("Earth's Breath", { exact: true }).click();
  await expect(wall.getByText(DREAM, { exact: true })).toBeVisible();
  await wall.getByRole('button', { name: 'show art' }).click();
  await expect(wall.getByRole('button', { name: 'show dream' })).toBeVisible();
  await wall.getByRole('button', { name: 'close' }).click();
  await expect(page.getByText(DREAM, { exact: true })).toHaveCount(0);
  await page.goto(`${BASE}/atlas?piece=UL-122%3A1`, { waitUntil: 'networkidle' });
  await page.keyboard.press('Enter');
  const hud = page.getByRole('dialog', { name: 'The piece' });
  await expect(hud.getByText(DREAM, { exact: true })).toBeVisible();
  await hud.getByRole('button', { name: 'close' }).click();
  await expect(hud).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: 'filter', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Status filter' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  await page.setViewportSize({ width: 320, height: 568 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
  const measureContrast = () => page.evaluate(() => {
    const label = document.querySelector('label[for="atlas-series-stage"]');
    const select = document.querySelector('#atlas-series-stage');
    const group = document.querySelector('[aria-label="Status filter"]');
    const panel = label?.closest('.border');
    if (!label || !select || !group || !panel) return null;
    const colors = [label, select, ...Array.from(group.querySelectorAll('button')), ...Array.from(panel.querySelectorAll('p'))].map((el) => getComputedStyle(el).color);
    const rgb = (v: string) => (v.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const lum = (v: string) => rgb(v).map((n) => { const c = n / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
    const backgrounds = ['rgb(28,23,18)', 'rgb(17,14,11)']; // the panel gradient endpoints
    return { colors, minRatio: Math.min(...colors.flatMap((c, i) => {
      const choices = i === 1 ? [...backgrounds, getComputedStyle(select).backgroundColor] : backgrounds;
      return choices.map((bg) => { const l = lum(c), b = lum(bg); return (Math.max(l, b) + 0.05) / (Math.min(l, b) + 0.05); });
    })) };
  });
  const daybookContrast = await measureContrast();
  expect(daybookContrast).not.toBeNull();
  expect(daybookContrast!.minRatio, JSON.stringify(daybookContrast)).toBeGreaterThanOrEqual(4.5);
  const themeToggle = page.getByRole('button', { name: /Switch to (light|dark) mode/ });
  await themeToggle.click();
  const nightfallContrast = await measureContrast();
  expect(nightfallContrast).not.toBeNull();
  expect(nightfallContrast!.minRatio, JSON.stringify(nightfallContrast)).toBeGreaterThanOrEqual(4.5);
  await expect(page.locator('#atlas-series-stage')).toHaveValue('all');
  await page.screenshot({ path: testInfo.outputPath('filter-320.png'), scale: 'css' });
});

test('populated desktop resting wall screenshot', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFixture(page);
  await page.screenshot({ path: testInfo.outputPath('desktop-1440.png'), fullPage: true, scale: 'css' });
});

test('retired globe URL facets cannot silently hide a piece', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFixture(page, '/atlas?kind=signature&category=nonexistent&size=small');
  await expect(page.getByText('of 3 pieces', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'filter', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Status filter' })).toBeVisible();
});
