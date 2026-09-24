import { test, expect } from './fixtures';

/* Page navigations in a tab the worker already controls must reach the network
 * first. When the worker answered them from the precached index.html, the
 * first load after a deploy showed the previous build and only a second load
 * showed the new one (measured 2026-09-23 on a branch preview).
 *
 * A deploy is simulated by rewriting the document on its way back from the
 * network: context.route() sees the worker's own fetches, so the probe only
 * appears if the worker actually went to the network for this navigation.
 * Offline, the precached shell must still boot the app.
 */

async function controlledTab(page: import('@playwright/test').Page) {
  await page.goto('/universal-language/1');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}

test.beforeEach(async ({ context }) => {
  expect(test.info().config.metadata.pwa, 'Use the built-worker playwright.pwa.config.ts lane').toBe(true);
  await context.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await context.route(/^https:\/\//, route => route.abort());
});

test('the first navigation after a deploy serves the new build, not the precached one', async ({ page, context }) => {
  await controlledTab(page);

  await context.route('**/universal-language/64', async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace('<head>', '<head><meta name="build-probe" content="new-deploy">');
    await route.fulfill({ response, body });
  });
  await page.goto('/universal-language/64');

  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect(page.locator('meta[name="build-probe"]')).toHaveAttribute('content', 'new-deploy');
  await expect(page.locator('[data-site-shell]')).toBeVisible();
});

test('offline, a navigation still boots the precached app shell', async ({ page, context }) => {
  await controlledTab(page);

  let refused = 0;
  await context.route('**/universal-language/2', route => { refused += 1; return route.abort('internetdisconnected'); });
  await page.goto('/universal-language/2');

  expect(refused, 'the network was never asked, so this proves nothing about offline').toBeGreaterThan(0);
  await expect(page.locator('[data-site-shell]')).toBeVisible();
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
});
