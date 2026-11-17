import { expect, test } from './fixtures';

test('reader guidance states the downloaded text and artwork boundary', async ({ page }) => {
  await page.goto('/universal-language');
  await page.getByRole('button', { name: /The Systems & Connections/ }).click();
  const guidance = page.getByRole('dialog', { name: 'Oracle systems' });
  await expect(guidance).toContainText('Downloaded card text can be read offline. Artwork needs an internet connection.');
  await page.screenshot({ path: test.info().outputPath('reader-offline-guidance.png') });
});

test('unavailable Atlas explains its connection requirement', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }));
  await page.route('**/api/atlas', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.goto('/atlas');
  await expect(page.getByText('The Atlas needs an internet connection.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'retry' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('atlas-connection-guidance.png') });
});
