/**
 * Two things the suite must never do again (2026-09-12: 200K image
 * deliveries and 70 GB in one day, the free plan's credits gone):
 *
 *  1. Fetch artwork from Cloudinary. tests/fixtures.ts answers every
 *     res.cloudinary.com request with a 1x1 PNG; this proves the route is
 *     live by checking every artwork response is that stub.
 *  2. Warm all 64 hero images on a card page. The offline pass now fetches
 *     prose only, so a single card page asks for a handful of images, not
 *     the whole deck.
 */
import { test, expect } from './fixtures';

test('a card page asks Cloudinary for a few images, and every one is answered locally', async ({ page }) => {
  const sizes: number[] = [];
  page.on('response', async (r) => {
    if (/res\.cloudinary\.com/.test(r.url())) {
      try { sizes.push((await r.body()).length); } catch { sizes.push(-1); }
    }
  });
  await page.goto('/universal-language/2', { waitUntil: 'domcontentloaded' });
  /* Long enough for the old warm pass to have fetched dozens of images. */
  await page.waitForTimeout(12000);

  expect(sizes.length, 'the card renders its own artwork').toBeGreaterThan(0);
  expect(sizes.length, 'no 64-card artwork warm').toBeLessThan(20);
  expect(sizes.every((n) => n > 0 && n < 200), 'every response is the fixture stub').toBe(true);
});
