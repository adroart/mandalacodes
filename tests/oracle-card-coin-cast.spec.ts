import { expect, test } from '@playwright/test';

test('card reading has one coin-casting ritual inside the I Ching panel', async ({ page }) => {
  await page.goto(`${process.env.TEST_BASE_URL ?? ''}/universal-language/22`);

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
