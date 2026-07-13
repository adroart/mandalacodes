import { expect, test, type Page } from '@playwright/test';

const CARD = '/universal-language/22';

const entrance = (page: Page) =>
  page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });

const waitForReading = (page: Page) =>
  expect(page.locator('[data-oracle-flow]')).toBeAttached();

test('direct and shared card links open quietly', async ({ page }) => {
  await page.goto(CARD);
  await waitForReading(page);
  await expect(entrance(page)).toHaveCount(0);
});

test('a QR arrival plays once and is consumed before reload', async ({ page }) => {
  await page.goto(`${CARD}?ref=qr`);
  await expect(entrance(page)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${CARD}$`));

  await entrance(page).click();
  await page.reload();
  await waitForReading(page);
  await expect(entrance(page)).toHaveCount(0);
});

test('opening from the deck plays once and browser Back returns quietly', async ({ page }) => {
  await page.goto('/universal-language');
  const card = page.locator('[data-oe-num="22"]');
  await card.getByRole('button', { name: /Card 22:/ }).click();
  await card.getByRole('button', { name: 'Read' }).click();
  await expect(entrance(page)).toBeVisible();

  await entrance(page).click();
  await page.getByRole('link', { name: 'The physical piece for this code' }).click();
  await expect(page).toHaveURL(/\/piece\/UL-119$/);
  await page.goBack();

  await expect(page).toHaveURL(new RegExp(`${CARD}$`));
  await waitForReading(page);
  await expect(entrance(page)).toHaveCount(0);

  await page.reload();
  await waitForReading(page);
  await expect(entrance(page)).toHaveCount(0);
});
