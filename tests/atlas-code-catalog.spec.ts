import { test, expect } from './fixtures';

test('links a code to its catalog artwork even without any public placements', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('atlas-overture-v1', '1'));
  await page.route('**/api/atlas', (route) => route.fulfill({
    json: { ok: true, state: { schemaVersion: 2, generatedAt: '2026-11-17T00:00:00.000Z', pieces: [], cities: [] } },
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

test('finds a catalog artwork by title or code without counting a public placement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/atlas', (route) => route.fulfill({
    json: { ok: true, state: { schemaVersion: 2, generatedAt: '2026-11-17T00:00:00.000Z', pieces: [], cities: [] } },
  }));

  await page.goto('/atlas?view=ledger');
  const search = page.getByRole('searchbox', { name: /search the ledger/i });
  const artwork = page.getByRole('link', { name: 'View Nobel Spark artwork' });
  for (const query of ['Nobel Spark', '39']) {
    await search.fill(query);
    await expect(page).toHaveURL((url) => url.searchParams.get('lq') === query);
    await expect(artwork).toBeVisible();
    await expect(artwork).toHaveAttribute(
      'href',
      'https://adrianrasmussen.com/creations/UL-111?from=mandalacodes&card=39',
    );
    await expect(page.getByText('0 of 0 pieces · 1 catalog artwork', { exact: true })).toBeVisible();
  }

  await search.fill('not-a-catalog-title');
  await expect(page).toHaveURL((url) => url.searchParams.get('lq') === 'not-a-catalog-title');
  await expect(artwork).toHaveCount(0);

  await page.goto('/atlas?view=ledger&lq=39&lg=place');
  await expect(artwork).toBeVisible();
  await page.goto('/atlas?view=ledger&lq=39&ls=held-private');
  await expect(page.getByText('0 of 0 pieces', { exact: true })).toBeVisible();
  await expect(artwork).toHaveCount(0);
});
