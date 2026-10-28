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

test('trigram choices form a circle and preserve lower/upper selection on the phone', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Draw a card', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Draw a card' });
  await dialog.getByRole('tab', { name: 'Choose trigrams' }).click();
  const choices = dialog.getByRole('group', { name: /trigram choices/ });
  const geometry = await choices.evaluate(element => {
    const ring = element.getBoundingClientRect();
    return {
      width: ring.width, height: ring.height,
      buttons: Array.from(element.querySelectorAll('button')).map(button => {
        const box = button.getBoundingClientRect();
        return { width: box.width, height: box.height,
          radius: Math.hypot(box.x + box.width / 2 - ring.x - ring.width / 2, box.y + box.height / 2 - ring.y - ring.height / 2) };
      }),
    };
  });
  expect(Math.abs(geometry.width - geometry.height)).toBeLessThan(1);
  expect(geometry.buttons).toHaveLength(8);
  const radii = geometry.buttons.map(button => button.radius);
  expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(1);
  for (const button of geometry.buttons) {
    expect(button.width).toBeGreaterThanOrEqual(44);
    expect(button.height).toBeGreaterThanOrEqual(44);
  }
  await dialog.getByRole('button', { name: 'Fire', exact: true }).click();
  await expect(choices).toHaveAttribute('aria-label', 'Upper trigram choices');
  await dialog.getByRole('button', { name: 'Water', exact: true }).click();
  await expect(dialog.getByText('Hexagram 63', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Edit lower trigram, Fire' }).click();
  await dialog.getByRole('button', { name: 'Water', exact: true }).click();
  await expect(dialog.getByText('Hexagram 29', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Open card 29', exact: true })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: 'test-results/oracle-app-trigram-circle.png' });
  await dialog.getByRole('button', { name: 'Open card 29', exact: true }).click();
  await expect(page).toHaveURL(/\/universal-language\/29$/);
});
