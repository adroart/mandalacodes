import { expect, test } from '@playwright/test';

test('card reading has one coin-casting ritual inside the I Ching panel', async ({ page }) => {
  const base = process.env.TEST_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? '';
  await page.goto(`${base}/universal-language/22`);

  const entrance = page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });
  if (await entrance.isVisible()) await entrance.click();

  await expect(page.getByRole('button', { name: 'Cast the coins', exact: true })).toHaveCount(1);
  await expect(
    page.getByRole('button', {
      name: 'Throw the coins. Begin the changing and see how this hexagram is moving.',
      exact: true,
    }),
  ).toHaveCount(0);
});

test('the resulting hexagram opens its reading directly', async ({ page }) => {
  const base = process.env.TEST_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? '';
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto(`${base}/universal-language/22`);

  const entrance = page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });
  if (await entrance.isVisible()) await entrance.click();

  await page.getByRole('button', { name: 'Cast the coins', exact: true }).click();
  await page.getByRole('button', { name: /Moving toward Hexagram 47.*Read where it stands/i }).click();

  await expect(page).toHaveURL(/\/universal-language\/47$/);
  await expect(page.getByRole('dialog', { name: 'The 64 Codes' })).toHaveCount(0);
});
