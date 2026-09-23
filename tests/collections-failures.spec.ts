import { expect, test, type Page } from './fixtures';

const collection = [{
  id: 1, name: 'Keepers', createdAt: '2026-06-01T00:00:00.000Z',
  items: [{ kind: 'card', ref: '1' }],
}];

async function signedIn(page: Page) {
  const now = new Date().toISOString();
  await page.route('**/api/auth/get-session', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({
      session: { id: 's', userId: 'collector-1', token: 't', createdAt: now, updatedAt: now, expiresAt: now },
      user: { id: 'collector-1', email: 'collector@example.com', emailVerified: true },
    }),
  }));
  await page.route('**/api/auth/sync-user', (route) => route.fulfill({ status: 204 }));
}

test('failed collection mutations leave the rendered collection unchanged', async ({ page }) => {
  await signedIn(page);
  await page.route('**/api/collections/list', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(collection),
  }));
  await page.route('**/api/collections/update', (route) => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'unavailable' }),
  }));
  await page.route('**/api/collections/delete', (route) => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'unavailable' }),
  }));
  await page.route('**/api/collections/remove-item', (route) => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'unavailable' }),
  }));
  await page.goto('/account/collections', { waitUntil: 'networkidle' });
  await expect(page.getByText('Keepers', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Keepers', exact: true }).click();
  const editor = page.locator('li input');
  await editor.fill('Renamed');
  await editor.press('Enter');
  await expect(page.getByRole('alert')).toContainText('Could not rename');
  await expect(page.locator('input[value="Renamed"]')).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Keepers', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText('Card 1', { exact: false })).toBeVisible();
});

test('a rejected add keeps the chooser open and never claims the card was saved', async ({ page }) => {
  await signedIn(page);
  await page.route('**/api/collections/list', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([{ ...collection[0], items: [] }]),
  }));
  await page.route('**/api/collections/add-item', (route) => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'unavailable' }),
  }));
  await page.goto('/universal-language/1', { waitUntil: 'networkidle' });
  const entrance = page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });
  if (await entrance.isVisible().catch(() => false)) await entrance.click();
  await page.getByRole('button', { name: 'Save this code' }).click();
  await page.getByRole('button', { name: 'Keepers', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not save this item');
  await expect(page.getByRole('button', { name: 'Keepers', exact: true })).toBeVisible();
});
