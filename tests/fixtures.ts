/**
 * The suite's `test`, with one standing rule: no spec ever reads metered
 * production media.
 *
 * Images are delivered through the same-origin /media route. A fresh
 * browser context (which is every Playwright test) has no cache, so each test
 * that opens a page pulls that page's artwork again from the origin. On
 * 2026-09-12 this suite, running ~35 times in CI, delivered 200K images and
 * 70 GB in one day: nearly three times the free plan's monthly allowance,
 * and the account locked.
 *
 * So every media request is answered here with a 1x1 transparent PNG
 * instead of leaving the machine. `<img>` elements still fire `load`, so any
 * timing that waits on images is unchanged; nothing in the suite asserts on
 * pixels from the artwork itself. The one spec that reads the live site
 * (live-oracle-cards) is opt-in and stays on the real network.
 *
 * Specs import `test` and `expect` from here, never from '@playwright/test'
 * directly; that is what makes the rule impossible to forget.
 */
import { test as base } from '@playwright/test';

export * from '@playwright/test';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/* crossOrigin="anonymous" images are CORS requests; a stub without this
   header is refused by the browser and logged as ERR_FAILED, which the
   "no console errors" checks would then count. */
const CORS = { 'access-control-allow-origin': '*' };

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route(/\/media\//, (route) => {
      /* Decided by what the page asked for, not by the URL: a poster frame is
         an <img> under /video/upload/, and it has to load like any image. An
         empty body for a <video> makes it report an unsupported source and
         stop, with no network error in the console. */
      if (route.request().resourceType() === 'media') {
        return route.fulfill({ status: 204, headers: CORS });
      }
      return route.fulfill({ status: 200, contentType: 'image/png', headers: CORS, body: ONE_PIXEL_PNG });
    });
    await use(context);
  },
});
