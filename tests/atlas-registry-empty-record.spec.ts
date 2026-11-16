import { test, expect } from './fixtures';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:2222';

test('registry shows a true empty record and counts searchable real entries only', async ({ page }, testInfo) => {
  let pieces: unknown[] = [];
  await page.route('**/api/atlas', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      state: { generatedAt: '2026-11-16T00:00:00.000Z', schemaVersion: 2, cities: [], pieces },
    }),
  }));

  await page.goto(`${BASE}/atlas/registry`, { waitUntil: 'networkidle' });
  await expect(page.getByText('the sky is waiting for its first light.')).toBeVisible();
  await expect(page.getByText('0 pieces', { exact: true })).toBeVisible();
  await expect(page.locator('li')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('registry-empty.png'), scale: 'css' });

  pieces = [{
    pieceId: 'UL-122', editionNumber: 1, series: 'Universal Language',
    kind: 'sixty-four', status: 'seeking', cityId: null,
  }];
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByText('1 pieces', { exact: true })).toBeVisible();
  await expect(page.getByText("Earth's Breath", { exact: true })).toBeVisible();
  await expect(page.getByText('A mandala yet to be entered')).toHaveCount(0);
  await expect(page.getByText('A signature work yet to be entered')).toHaveCount(0);
  await expect(page.getByText('A piece yet to be entered')).toHaveCount(0);

  const search = page.getByRole('searchbox');
  await search.fill("Earth's Breath");
  await expect(page.getByText('1 of 1 pieces')).toBeVisible();
  await expect(page.getByText("Earth's Breath", { exact: true })).toBeVisible();
  await search.fill('nothing matches');
  await expect(page.getByText('0 of 1 pieces')).toBeVisible();
  await expect(page.getByText('Nothing matches. Loosen a filter.')).toBeVisible();
  await expect(page.getByText('the sky is waiting for its first light.')).toHaveCount(0);
  await page.getByRole('button', { name: 'clear' }).click();

  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.getByText('1 pieces', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('registry-populated.png'), scale: 'css' });
});
