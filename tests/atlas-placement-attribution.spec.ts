import { test, expect } from './fixtures';

test('placement can be anonymous and attribution disappears when name or city sharing is withdrawn', async ({ page }, testInfo) => {
  let shareCity = true;
  let shareName = false;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/atlas', route => route.fulfill({
    json: { ok: true, state: {
      generatedAt: '2026-11-19T00:00:00Z', schemaVersion: 2,
      cities: shareCity ? [{ id: 'denpasar-id', city: 'Denpasar', country: 'Indonesia',
        countryCode: 'ID', lat: -8.65, lng: 115.2167 }] : [],
      pieces: [{ pieceId: 'UL-134', editionNumber: 1, claimOrdinal: 47,
        series: 'Universal Language', status: shareCity ? 'placed' : 'seeking',
        cityId: shareCity ? 'denpasar-id' : null,
        ...(shareCity && shareName ? { placedBy: 'Synthetic Keeper' } : {}),
      }],
    } },
  }));
  await page.goto('/atlas?view=ledger&code=23');
  const attribution = page.getByText('Placed by Synthetic Keeper', { exact: true });
  await expect(page.getByRole('link', { name: 'View Beneath the Surface artwork' })).toBeVisible();
  await expect(attribution).toHaveCount(0);
  shareName = true;
  await page.reload();
  await expect(attribution).toBeVisible();
  await attribution.evaluate(element => element.scrollIntoView({ block: 'end', behavior: 'instant' }));
  await page.screenshot({ path: testInfo.outputPath('named-placement.png'), scale: 'css' });
  shareName = false;
  await page.reload();
  await expect(page.getByRole('link', { name: 'View Beneath the Surface artwork' })).toBeVisible();
  await expect(attribution).toHaveCount(0);
  shareName = true;
  shareCity = false;
  await page.reload();
  await expect(page.getByRole('link', { name: 'View Beneath the Surface artwork' })).toBeVisible();
  await expect(attribution).toHaveCount(0);
  await expect(page.getByText(/Denpasar/)).toHaveCount(0);
});
