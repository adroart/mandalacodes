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

test('an iPhone QR arrival offers a one-tap Safari handoff without replacing the reading bar', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
    });
  });
  await page.goto(`${CARD}?ref=qr`);
  await entrance(page).click();

  const handoff = page.getByRole('link', { name: 'Open this reading in Safari' });
  await expect(handoff).toBeVisible();
  await expect(handoff).toHaveAttribute('href', CARD);
  await expect(handoff).toHaveAttribute('target', '_blank');
  await expect(page.getByRole('navigation', { name: 'Reading actions' })).toBeVisible();
});

test('a normal iPhone card link does not show the QR Safari handoff', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
    });
  });
  await page.goto(CARD);
  await waitForReading(page);
  await expect(page.getByRole('link', { name: 'Open this reading in Safari' })).toHaveCount(0);
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
