import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures';

/* The card page's artwork can take a second or more the first time a card is
   opened. The art slot used to sit empty for that time. It now holds the
   card's own hexagram, colours swapped, until the plate lands and draws over
   it; the art itself is never held back. */
test('the card page holds its hexagram until the artwork lands', async ({ page }, testInfo) => {
  const plate = readFileSync(new URL('../public/android-chrome-512x512.png', import.meta.url));
  let release!: () => void;
  const arrived = new Promise<void>((resolve) => { release = resolve; });
  await page.route(/\/media\/image\/22_/, async (route) => {
    await arrived;
    await route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: plate });
  });

  await page.goto('/universal-language/22');
  const slot = page.locator('.card-art-wait').filter({ visible: true }).first();
  await expect(slot).toBeVisible();
  const hex = slot.locator('.card-art-wait__hex');
  await expect(hex).toBeVisible();
  // Card 22's hexagram, top to bottom: solid, broken, broken, solid, broken, solid.
  expect(await hex.locator('rect').count()).toBe(9);
  expect(await slot.locator('img').evaluate((img) => getComputedStyle(img).opacity)).toBe('1');
  await slot.screenshot({ path: testInfo.outputPath('1-waiting.png') });

  release();
  await expect(slot).toHaveAttribute('data-art-in', '');
  await expect(hex).toHaveCount(0);
  await slot.screenshot({ path: testInfo.outputPath('2-arrived.png') });
});
