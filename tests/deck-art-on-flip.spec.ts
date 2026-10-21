import { readFileSync } from 'node:fs';
import { test, expect } from './fixtures';

/* A deck tile's art sits on its back face, under the hexagram, so the
   browser's lazy loading fetched it anyway: 37 plates, 1.8 MB, to show none
   (measured on the live deck 2026-10-21). The deck asks for a card's art only
   once that card is flipped. */
test('the deck downloads no card art until a card is flipped', async ({ page }) => {
  const artRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/media/image/')) artRequests.push(request.url());
  });

  await page.goto('/universal-language');
  const tile = page.getByRole('button', { name: /^Card 22: Treasure of the Way/ });
  await expect(tile).toBeVisible();
  await page.waitForTimeout(1500);
  expect(artRequests).toEqual([]);

  await tile.click();
  await expect.poll(() => artRequests.some((url) => url.includes('/media/image/22_'))).toBe(true);
  expect(artRequests.every((url) => url.includes('/media/image/22_'))).toBe(true);
});

/* The art starts downloading only on the flip, so for a moment the back of the
   tile has nothing to show. It used to sit empty and then the art popped in,
   which read as a fault. It now holds six breathing lines until the art has
   fully arrived, then fades the art in over them. */
test('a flipped tile waits on breathing lines, then fades its art in', async ({ page }, testInfo) => {
  const plate = readFileSync(new URL('../public/android-chrome-512x512.png', import.meta.url));
  let release!: () => void;
  const arrived = new Promise<void>((resolve) => { release = resolve; });
  await page.route(/\/media\/image\/22_/, async (route) => {
    await arrived;
    await route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: plate });
  });

  await page.goto('/universal-language');
  const tile = page.getByRole('button', { name: /^Card 22: Treasure of the Way/ });
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
  const art = tile.locator('img');
  const lines = () => art.evaluate((img) => getComputedStyle(img.parentElement!, '::before').animationName);

  await page.waitForTimeout(900);
  expect(await lines()).toBe('oe-art-wait');
  expect(await art.evaluate((img) => getComputedStyle(img).opacity)).toBe('0');
  await tile.screenshot({ path: testInfo.outputPath('1-waiting.png') });

  release();
  await expect(art).toHaveAttribute('data-oe-loaded', '');
  await page.waitForTimeout(600);
  await tile.screenshot({ path: testInfo.outputPath('2-fading.png') });
  await expect.poll(() => art.evaluate((img) => getComputedStyle(img).opacity)).toBe('1');
  await tile.screenshot({ path: testInfo.outputPath('3-shown.png') });
});
