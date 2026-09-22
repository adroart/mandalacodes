import { expect, test } from './fixtures';

test('card reading has one coin-casting ritual inside the I Ching panel', async ({ page }) => {
  const base = process.env.TEST_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? '';
  await page.goto(`${base}/universal-language/22`);

  const entrance = page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });
  if (await entrance.isVisible()) await entrance.click();

  await expect(page.getByRole('button', { name: 'Cast the coins', exact: true })).toHaveCount(2);
  await expect(
    page.getByRole('button', {
      name: 'Throw the coins. Begin the changing and see how this hexagram is moving.',
      exact: true,
    }),
  ).toHaveCount(0);
});

test('the coins are the primary fast cast control', async ({ page }) => {
  const base = process.env.TEST_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? '';
  await page.goto(`${base}/universal-language/22`);

  const entrance = page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });
  if (await entrance.isVisible()) await entrance.click();

  const castControls = page.getByRole('button', { name: 'Cast the coins', exact: true });
  await expect(castControls).toHaveCount(2);

  const startedAt = Date.now();
  await castControls.first().click();
  await expect(castControls.first()).toBeDisabled();
  await expect(castControls.last()).toBeDisabled();
  await expect(page.getByText('Hexagram 22 · Grace', { exact: true })).toBeVisible();
  expect(Date.now() - startedAt).toBeLessThan(650);
});

test('the coin control casts from the keyboard without motion', async ({ page }) => {
  const base = process.env.TEST_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? '';
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${base}/universal-language/22`);

  const entrance = page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });
  if (await entrance.isVisible()) await entrance.click();

  const coinControl = page.getByRole('button', { name: 'Cast the coins', exact: true }).first();
  await coinControl.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByText('Hexagram 22 · Grace', { exact: true })).toBeVisible();
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

  await page.getByRole('button', { name: 'Cast the coins', exact: true }).first().click();
  await page.getByRole('button', { name: /Turning into Hexagram 47.*Open that card/i }).click();

  await expect(page).toHaveURL(/\/universal-language\/47$/);
  await expect(page.getByRole('dialog', { name: 'The 64 Codes' })).toHaveCount(0);
});
