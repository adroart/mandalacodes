import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
test.beforeEach(async ({ context }) => {
  // Bundled assets are served locally for this browser test. No public network
  // is available: artwork and birth-place calculations must remain usable.
  await context.route(/^https:\/\//, route => route.abort());
});
test('bundled deck, drawing, and reading work without external network', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Oracle', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Birthday', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /draw a card/i }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('dialog').getByRole('button', { name: 'Cast the coins', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Open card \d+$/ }).first()).toBeVisible();
  await page.getByRole('button', { name: /^Open card \d+$/ }).first().click();
  await expect(page).toHaveURL(/\/universal-language\/\d+$/);
  await page.screenshot({ path: 'test-results/oracle-app-draw.png' });
  await page.goto('/universal-language/1');
  await expect(page.locator('img[src="/oracle-art/1.webp"]').first()).toBeVisible();
  await expect.poll(() => page.locator('img[src="/oracle-art/1.webp"]').first().evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('body')).toContainText('Gate 1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/oracle-app-reading.png' });
  await expect(page.getByText('Hold to record', { exact: true })).toHaveCount(0);
  await page.locator('[data-bar-tab=share]').click();
  await expect(page.getByRole('button', { name: 'Share reading', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test('Birthday searches local places, calculates and retains a profile after reopening', async ({ page }) => {
  await page.goto('/profile');
  await page.locator('input[type="date"]').fill('1990-06-15');
  await page.getByPlaceholder('HH:MM').fill('14:30');
  await page.getByPlaceholder('Type a city, then pick from the list').fill('Jakarta');
  await page.getByRole('option').first().click();
  await page.getByRole('button', { name: 'Build my profile', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
  await expect(page.locator('body')).toContainText('1990-06-15');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
  await expect(page.locator('body')).toContainText('1990-06-15');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/oracle-app-profile.png' });
});
test('all 64 artwork plates ship in the bundle', async ({ request }) => {
  const manifest = JSON.parse(readFileSync('dist-oracle/oracle-art/manifest.json', 'utf8'));
  expect(manifest).toHaveLength(64);
  for (const item of manifest) {
    const response = await request.get(`/oracle-art/${item.number}.webp`);
    expect(response.ok()).toBe(true);
    expect((await response.body()).length).toBe(item.bytes);
  }
});
