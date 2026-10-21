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
