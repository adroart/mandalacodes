import { expect, test, type Page } from './fixtures';

/* A plaque's QR code lands a visitor straight on a card page, never the deck
 * index (docs/offline-oracle.md, todo/plans/launch-readiness.md site item 3).
 * The card page now warms the whole deck for offline the same way the index
 * does (components/oracle/reading/CardReadingData.tsx, startAt: cardNumber),
 * and a failed prose chunk is handed to ChunkErrorBoundary's calm offline
 * notice instead of rendering a silently blank reading.
 *
 * This is service-worker behaviour, so it only exists against a production
 * build (docs/offline-oracle.md's own testing note): `npm run build` then
 * `vite preview`. PLAYWRIGHT_BASE_URL must point at that preview server, not
 * the dev server, or every case here trivially passes for the wrong reason
 * (no service worker means "offline" never actually engages).
 */

const entrance = (page: Page) =>
  page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });

async function openCard(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' });
  try {
    await entrance(page).waitFor({ state: 'visible', timeout: 1_500 });
    await entrance(page).click();
  } catch {
    // Direct link, no entrance to dismiss.
  }
}

async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return;
    await navigator.serviceWorker.ready;
  });
}

async function assertNeverBlankOrCrashed(page: Page) {
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  await expect(page.getByText('404')).toHaveCount(0);
  await expect(page.getByText('page not found', { exact: false })).toHaveCount(0);
  const bodyText = (await page.locator('body').innerText()).trim();
  expect(bodyText.length).toBeGreaterThan(0);
}

test.describe('offline reading, arriving straight on a card (QR path)', () => {
  test('card 34 either renders from cache or shows the calm offline sentence, never blank', async ({ page, context }) => {
    await openCard(page, '/universal-language/33');
    await waitForServiceWorker(page);
    // Give the background warm pass (idle-scheduled) a moment: this mirrors
    // an ordinary visit, not a race against it either way, since the
    // assertion below accepts both outcomes on purpose.
    await page.waitForTimeout(1_500);

    await context.setOffline(true);
    await openCard(page, '/universal-language/34');

    const rendered = page.getByRole('heading', { name: 'Sublime Power', level: 1 });
    const offlineNotice = page.getByText('needs a connection', { exact: false });
    await expect(rendered.or(offlineNotice).first()).toBeVisible({ timeout: 10_000 });

    await assertNeverBlankOrCrashed(page);
    await context.setOffline(false);
  });

  test('a card the device never fetched shows the calm sentence and a Retry that recovers it', async ({ page, context }) => {
    // The 64 cards' text chunks are served through the service worker's own
    // CacheFirst route, not the page's main frame, so page.route() cannot see
    // those requests at all (verified: it never fires on them, online or
    // offline). context.route() reaches them because it covers every request
    // in the browser context, workers included, which is what makes it
    // possible to force one specific card's chunk to fail on demand rather
    // than racing the background warm pass to see which cards it beat.
    await context.route('**/assets/50-*.js', (route) => route.abort());

    await openCard(page, '/universal-language/33');
    await waitForServiceWorker(page);
    await expect(page.getByRole('heading', { name: 'Echos of Time', level: 1 })).toBeVisible();

    // CDP's offline emulation is a page-level condition and does not stop the
    // service worker's own fetch from reaching the network (verified: a
    // never-before-requested chunk still loads fine under setOffline(true)
    // alone). The route abort above is what actually removes card 50's
    // connection; setOffline(true) is what makes navigator.onLine false, so
    // the boundary takes the calm branch instead of its silent auto-reload.
    await context.setOffline(true);
    await openCard(page, '/universal-language/50');

    await expect(page.getByText('needs a connection', { exact: false })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('already opened are still', { exact: false })).toBeVisible();
    const retry = page.getByRole('button', { name: 'Retry' });
    await expect(retry).toBeVisible();
    await page.screenshot({ path: 'test-results/offline-qr-reading-calm-notice.png' });
    await assertNeverBlankOrCrashed(page);

    // Recovery: lift both the deliberate block and the offline emulation,
    // then Retry without a full navigation. The boundary only clears its own
    // error state; CardReadingData's effect re-fetches on remount.
    await context.unroute('**/assets/50-*.js');
    await context.setOffline(false);
    await retry.click();

    await expect(page.getByRole('heading', { name: 'Melt Into Perfection', level: 1 })).toBeVisible({ timeout: 10_000 });
    await assertNeverBlankOrCrashed(page);
  });
});
