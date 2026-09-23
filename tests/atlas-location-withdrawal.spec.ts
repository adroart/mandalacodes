import { test, expect } from './fixtures';

// Preserve action/teardown evidence if this complete withdrawal flow times out.
test.use({ trace: 'retain-on-failure' });

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:2222';

async function releaseOverture(page: import('@playwright/test').Page) {
  await page.keyboard.press('Space');
  await expect(
    page.getByText('We are one global family of resonance,', { exact: false }),
  ).toHaveCount(0);
}

function atlasState(withdrawLocations: boolean) {
  return {
    ok: true,
    state: {
      generatedAt: '2026-09-22T00:00:00.000Z',
      schemaVersion: 2,
      cities: withdrawLocations ? [] : [
        { id: 'lisbon-pt', city: 'Lisbon', country: 'Portugal', countryCode: 'PT', lat: 38.7223, lng: -9.1393 },
        { id: 'denpasar-id', city: 'Denpasar', country: 'Indonesia', countryCode: 'ID', lat: -8.65, lng: 115.2167 },
      ],
      pieces: [
        { pieceId: 'UL-122', editionNumber: 1, series: 'Universal Language', cityId: withdrawLocations ? null : 'lisbon-pt', status: withdrawLocations ? 'seeking' : 'placed', pieceType: 'mandala', claimOrdinal: 1, kind: 'sixty-four' },
        { pieceId: 'UL-162', editionNumber: 1, series: 'Universal Language', cityId: withdrawLocations ? null : 'denpasar-id', status: withdrawLocations ? 'seeking' : 'placed', pieceType: 'mandala', claimOrdinal: 2, kind: 'sixty-four' },
      ],
    },
  };
}

test('withdrawing public locations keeps claimed lights but removes their map invitation', async ({ page }, testInfo) => {
  let locationsWithdrawn = false;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('atlas-overture-v1', '1'));
  await page.route('**/api/atlas', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(atlasState(locationsWithdrawn)),
  }));
  await test.step('open the atlas with public locations', async () => {
    await page.goto(`${BASE}/atlas`, { waitUntil: 'networkidle' });
    await releaseOverture(page);
  });

  // Two claimed keepers at public locations make the normal desktop guidance
  // applicable. The count comes from claim ordinals, not map coordinates.
  await test.step('verify the public map invitation', async () => {
    const publicPulse = page.getByText('2 lights lit', { exact: false });
    await expect(publicPulse).toBeVisible();
    await expect(page.getByText('of 2 pieces', { exact: false })).toBeVisible();
    await expect(page.getByText('touch a light to read its dream', { exact: false })).toBeVisible();
    await publicPulse.screenshot({ path: testInfo.outputPath('before-withdrawal-pulse.png') });
  });

  await test.step('reload the atlas after locations are withdrawn', async () => {
    locationsWithdrawn = true;
    await page.reload({ waitUntil: 'networkidle' });
    await releaseOverture(page);
  });

  // The claims and their order remain in the public total, while no eligible
  // piece marker remains for the instruction to describe.
  await test.step('verify claims remain while the map invitation is private', async () => {
    const withdrawnPulse = page.getByText('2 lights lit', { exact: false });
    await expect(withdrawnPulse).toBeVisible();
    await expect(page.getByText('of 2 pieces', { exact: false })).toBeVisible();
    await expect(page.getByText('touch a light to read its dream', { exact: false })).toHaveCount(0);
    await expect(page.getByText('Lisbon', { exact: false })).toHaveCount(0);
    await expect(page.getByText('Denpasar', { exact: false })).toHaveCount(0);
    await withdrawnPulse.screenshot({ path: testInfo.outputPath('after-withdrawal-pulse.png') });
  });
});
