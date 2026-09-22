import { test, expect } from './fixtures';

test('controlled Oracle navigation preserves the Astro Learn library and article', async ({ page, context }) => {
  expect(test.info().config.metadata.pwa, 'Use the built-worker playwright.pwa.config.ts lane').toBe(true);
  // This server serves only built files; provider/API calls are all synthetic.
  await context.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await context.route(/^https:\/\//, route => route.abort());
  await page.goto('/universal-language/1');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.goto('/learn');
  await expect(page.locator('h1')).toContainText(/Learn|mandala/i);
  await expect(page.locator('[data-site-shell]')).toHaveCount(0);
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  const article = await page.locator('a[href^="/learn/"]').evaluateAll(links => links
    .map(link => link.getAttribute('href'))
    .find(href => href && !href.includes('/category/') && !href.includes('/keystatic') && href !== '/learn/'));
  expect(article).toBeTruthy();
  await page.goto(article!);
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('[data-site-shell]')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-site-shell]')).toHaveCount(0);
  await page.goto('/universal-language/64');
  await expect(page.locator('[data-site-shell]')).toBeVisible();
});
