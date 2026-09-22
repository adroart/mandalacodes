import { test, expect } from './fixtures';

/* Closed collector routes disclose the supported boundary before credentials or
 * prose. They never submit to retired writers. The surviving public registry
 * remains an honest reader with its own explicit outage state. */

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:2222';

const DESTINATION = 'https://adrianrasmussen.com/atlas/piece/UL-07';

async function assertFourStandardChecks(page: import('@playwright/test').Page, consoleErrors: string[]) {
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  await expect(page.getByText('404')).toHaveCount(0);
  await expect(page.getByText('page not found', { exact: false })).toHaveCount(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 2,
  );
  expect(overflow).toBe(false);
  // The mocked 410 itself is a failed network request, and Chrome logs that
  // to the console as a browser-level resource message regardless of how the
  // app handles the response. That is not an application console error, so
  // it is the one expected line filtered out here; anything else still fails
  // the check.
  const realErrors = consoleErrors.filter(
    (e) => !/Failed to load resource: the server responded with a status of 410/.test(e),
  );
  expect(realErrors).toEqual([]);
}

/* The one calm sentence and one working door, and nothing a collector should
 * never see: the raw code, a retry control, or the word "error". */
async function assertHonestBoundary(page: import('@playwright/test').Page) {
  await expect(page.getByText('Collector registration is not open here.', { exact: false })).toBeVisible();

  const door = page.getByRole('link', { name: 'View the public artwork atlas' });
  await expect(door).toBeVisible();
  await expect(door).toHaveAttribute('href', 'https://adrianrasmussen.com/atlas');

  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain('atlas_moved');
  expect(bodyText).not.toContain('atlas_reader_moved');
  expect(bodyText.toLowerCase()).not.toContain('try again');
  expect(bodyText.toLowerCase()).not.toContain('retry');
}

test.describe('the honest boundary on the closed atlas ceremony', () => {
  test('/atlas/claim shows its immediate boundary without inputs or retired requests', async ({ page }) => {
    const consoleErrors: string[] = [];
    const retired: string[] = [];
    page.on('request', (request) => { if (request.url().includes('/api/atlas/')) retired.push(request.url()); });
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.goto(`${BASE}/atlas/claim`, { waitUntil: 'networkidle' });
    await assertHonestBoundary(page);
    await expect(page.locator('input,textarea')).toHaveCount(0);
    expect(retired).toEqual([]);
    await assertFourStandardChecks(page, consoleErrors);
  });

  test('/atlas/edit shows its immediate boundary without inputs or retired requests', async ({ page }) => {
    const consoleErrors: string[] = [];
    const retired: string[] = [];
    page.on('request', (request) => { if (request.url().includes('/api/atlas/')) retired.push(request.url()); });
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.goto(`${BASE}/atlas/edit`, { waitUntil: 'networkidle' });
    await assertHonestBoundary(page);
    await expect(page.locator('input,textarea')).toHaveCount(0);
    expect(retired).toEqual([]);
    await assertFourStandardChecks(page, consoleErrors);
  });

  test('/atlas/homecoming shows its immediate boundary without submitting retired inputs', async ({ page }) => {
    const consoleErrors: string[] = [];
    const retired: string[] = [];
    page.on('request', (request) => { if (request.url().includes('/api/atlas/')) retired.push(request.url()); });
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await page.goto(`${BASE}/atlas/homecoming`, { waitUntil: 'networkidle' });
    await assertHonestBoundary(page);
    await expect(page.locator('input,textarea')).toHaveCount(0);
    expect(retired).toEqual([]);
    await assertFourStandardChecks(page, consoleErrors);
  });

  test('/atlas/registry stays honest under a hard API failure without borrowing the moved sentence', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    // /atlas/registry reads the surviving public GET /api/atlas, not a
    // retired write route. Forcing it to 410 here is a synthetic outage, not
    // the "moved" case, so the correct honest behaviour is the registry's
    // own calm line, never the atlas_moved code and never the claim/edit
    // boundary sentence (that would misstate where the record actually is).
    await page.route('**/api/atlas', (route) => route.fulfill({
      status: 410,
      contentType: 'application/json',
      body: JSON.stringify({ ok: false, error: 'atlas_reader_moved', message: 'gone', destination: DESTINATION }),
    }));

    await page.goto(`${BASE}/atlas/registry`, { waitUntil: 'networkidle' });

    await expect(page.getByText('the atlas is briefly out of reach.')).toBeVisible();
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('atlas_moved');
    expect(bodyText).not.toContain('atlas_reader_moved');
    expect(bodyText.toLowerCase()).not.toContain('try again');

    await assertFourStandardChecks(page, consoleErrors);
  });
});
