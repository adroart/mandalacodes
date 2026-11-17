import { test, expect } from './fixtures';

test('links a code to its catalog artwork even without any public placements', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('atlas-overture-v1', '1'));
  await page.route('**/api/atlas', (route) => route.fulfill({
    json: { ok: true, state: { schemaVersion: 2, pieces: [], cities: [] } },
  }));

  await page.goto('/atlas?view=ledger&code=23');
  const code = page.getByRole('listitem').filter({
    has: page.getByRole('button', { name: /23 Beneath the Surface/ }),
  }).last();
  await expect(code.getByRole('link', { name: 'View Beneath the Surface artwork' })).toHaveAttribute(
    'href',
    'https://adrianrasmussen.com/creations/UL-134?from=mandalacodes&card=23',
  );
  await expect(code.getByText(/not yet embodied|has been made/i)).toHaveCount(0);
  await expect(page.getByText('0 pieces', { exact: true })).toBeVisible();
});
