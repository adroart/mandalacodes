import { test, expect } from './fixtures';

/* The honest boundary on the closed collector routes (todo/plans/honest-boundary.md,
 * launch-readiness.md item 2, overarching-plan.md Track C3).
 *
 * /atlas/claim, /atlas/edit and /atlas/homecoming all call collector-write
 * endpoints that functions/api/atlas/_middleware.ts retired on 2026-08-09 —
 * every one of those routes now answers 410 with an `atlas_moved` (or
 * `atlas_reader_moved`) code and a `destination`. lib/atlas/boundary.ts and
 * components/atlas/AtlasMovedNotice.tsx already carry the shared surface;
 * this spec is the missing live proof that the three real ceremony screens
 * actually render it against a genuine 410 response, with no raw error code,
 * no retry control, and a working door to the destination the server named.
 *
 * /atlas/registry is grouped with the other three URL-only pages in the plan,
 * but it never calls a retired write endpoint — it reads the same public
 * `/api/atlas` GET the globe reads (lib/atlas/record.ts), which is one of
 * the three reads functions/api/atlas/_middleware.ts explicitly keeps alive.
 * Measured directly: nothing in TheRegistry.tsx imports the boundary helper,
 * and it doesn't need to — there is no boundary to cross. Forcing the "moved"
 * sentence onto a page that is not moved would be the exact dishonesty this
 * work exists to remove. The fourth test below proves the honest half that
 * DOES apply to it: even under a hard API failure, the page speaks its own
 * calm sentence and never lets a raw error code reach the screen.
 */

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:2222';

const DESTINATION = 'https://adrianrasmussen.com/atlas/piece/UL-07';

const MOVED_BODY = {
  ok: false,
  error: 'atlas_moved',
  message: 'The Atlas collector record moved to Adrian-Website and is read-only on Mandala Codes.',
  readOnly: true,
  movedAt: '2026-08-09',
  destination: DESTINATION,
};

async function signIn(page: import('@playwright/test').Page) {
  const now = new Date().toISOString();
  await page.route('**/api/auth/get-session', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      session: {
        id: 'session-collector',
        userId: 'collector-1',
        token: 'test-session-token',
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
      user: {
        id: 'collector-1',
        name: 'A Collector',
        email: 'collector@example.com',
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    }),
  }));
  await page.route('**/api/auth/sync-user', (route) => route.fulfill({ status: 204 }));
}

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
  await expect(page.getByText('The collector record now lives on the artist site.')).toBeVisible();

  const door = page.getByRole('link', { name: /open the collector record/i });
  await expect(door).toBeVisible();
  await expect(door).toHaveAttribute('href', DESTINATION);

  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain('atlas_moved');
  expect(bodyText).not.toContain('atlas_reader_moved');
  expect(bodyText.toLowerCase()).not.toContain('try again');
  expect(bodyText.toLowerCase()).not.toContain('retry');
}

test.describe('the honest boundary on the closed atlas ceremony', () => {
  test('/atlas/claim shows the boundary, not the retired endpoint', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await signIn(page);
    await page.route('**/api/atlas/steward/claim', (route) => route.fulfill({
      status: 410,
      contentType: 'application/json',
      body: JSON.stringify(MOVED_BODY),
    }));

    await page.goto(`${BASE}/atlas/claim`, { waitUntil: 'networkidle' });

    await assertHonestBoundary(page);
    await assertFourStandardChecks(page, consoleErrors);
  });

  test('/atlas/edit shows the boundary, not the retired endpoint', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await signIn(page);
    // StewardEdit loads the signed-in steward's claimed pieces off the same
    // retired endpoint StewardClaim uses to bind on arrival.
    await page.route('**/api/atlas/steward/claim', (route) => route.fulfill({
      status: 410,
      contentType: 'application/json',
      body: JSON.stringify(MOVED_BODY),
    }));

    await page.goto(`${BASE}/atlas/edit`, { waitUntil: 'networkidle' });

    await assertHonestBoundary(page);
    await assertFourStandardChecks(page, consoleErrors);
  });

  test('/atlas/homecoming shows the boundary after a submit meets the retired endpoint', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await signIn(page);
    await page.route('**/api/atlas/homecoming/submit', (route) => route.fulfill({
      status: 410,
      contentType: 'application/json',
      body: JSON.stringify(MOVED_BODY),
    }));

    await page.goto(`${BASE}/atlas/homecoming`, { waitUntil: 'networkidle' });

    // Sign-in is mocked, not the form: fill the three required fields, then submit.
    await page.getByPlaceholder('https://…', { exact: true }).fill('https://example.test/photo.jpg');
    await page.getByLabel('how it came to you').fill('It arrived by hand, in Bali, a few years back.');

    // Open with an empty query so the picker's own default (unfiltered) rows
    // show, rather than guessing which one of ATLAS_PLACES' city/region
    // fields would match a typed name.
    const cityInput = page.getByPlaceholder('Santa Cruz, Bali, Sacramento…');
    await cityInput.click();
    await page.getByRole('option').first().click();

    const submit = page.getByRole('button', { name: /bring it home/i });
    await expect(submit).toBeEnabled();
    await submit.click();

    await assertHonestBoundary(page);
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
