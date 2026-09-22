import { test, expect } from './fixtures';

test('registry keeps custody distinct from a withdrawn or unknown public location', async ({ page }, testInfo) => {
  let phase: 'public' | 'private' | 'unknown' = 'public';
  await page.route('**/api/atlas', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      ok: true,
      state: {
        generatedAt: '2026-09-22T00:00:00.000Z',
        schemaVersion: 2,
        cities: phase === 'public' ? [{
          id: 'denpasar-id', city: 'Denpasar', country: 'Indonesia',
          countryCode: 'ID', lat: -8.65, lng: 115.2167,
        }] : [],
        pieces: [{
          pieceId: 'UL-122', editionNumber: 3, series: 'Universal Language',
          kind: 'sixty-four', pieceType: 'mandala',
          status: phase === 'public' ? 'placed' : 'seeking',
          cityId: phase === 'public' ? 'denpasar-id' : null,
          ...(phase !== 'unknown' ? { claimOrdinal: 2 } : {}),
        }],
      },
    }),
  }));

  await page.goto('/atlas/registry');
  const row = page.locator('li').filter({ has: page.getByText("Earth's Breath", { exact: true }) });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Denpasar');
  await expect(row).not.toContainText('created, waiting for someone');

  phase = 'private';
  await page.reload();
  await expect(row).toContainText('held; location private');
  await expect(row).not.toContainText('Denpasar');
  await expect(row).not.toContainText('not yet placed');
  await expect(row).not.toContainText('created, waiting for someone');
  await row.screenshot({ path: testInfo.outputPath('registry-held-private.png') });

  phase = 'unknown';
  await page.reload();
  await expect(row).toBeVisible();
  await expect(row).not.toContainText('held; location private');
  await expect(row).not.toContainText('created, waiting for someone');
  await expect(row).not.toContainText('not yet placed');
  await expect(row).toContainText('public location unavailable');
  await expect(row).not.toContainText('Denpasar');
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
});
