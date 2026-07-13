import { expect, test } from '@playwright/test';

test('birth profile entry uses one scroll surface and dynamic place results', async ({ page }) => {
  await page.goto('/universal-language');
  await page.getByRole('button', { name: /enter your birth time/i }).click();

  const dialog = page.getByRole('dialog', { name: /enter your birth time/i });
  await expect(dialog).toBeVisible();

  await expect(dialog).toHaveAttribute('data-birth-dialog-scroll', 'true');
  await expect(dialog).toHaveCSS('overflow-y', 'auto');

  const place = dialog.getByRole('combobox', { name: /birth place/i });
  const results = dialog.getByRole('listbox');
  await expect(results).toHaveCount(0);

  await place.fill('Santa Cruz');
  await expect(results).toBeVisible();
  expect(await results.getByRole('option').count()).toBeGreaterThan(6);
  await expect(results).toHaveCSS('overflow-y', 'visible');

  await results.getByRole('option').first().getByRole('button').click();
  await expect(results).toHaveCount(0);
  await expect(place).toHaveValue(/Santa Cruz/);
});
