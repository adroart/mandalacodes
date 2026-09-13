/**
 * The suite's `test`, with one standing rule: no spec ever fetches from
 * Cloudinary.
 *
 * Every image and video on the site is delivered from res.cloudinary.com, and
 * Cloudinary bills delivery bandwidth against the plan's credits. A fresh
 * browser context (which is every Playwright test) has no cache, so each test
 * that opens a page pulls that page's artwork again from the origin. On
 * 2026-09-12 this suite, running ~35 times in CI, delivered 200K images and
 * 70 GB in one day: nearly three times the free plan's monthly allowance,
 * and the account locked.
 *
 * So every Cloudinary request is answered here with a 1x1 transparent PNG
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

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.route(/https?:\/\/res\.cloudinary\.com\//, (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: ONE_PIXEL_PNG }),
    );
    await use(context);
  },
});
