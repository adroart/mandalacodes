import { test, expect } from '@playwright/test';

/* /account/pieces (todo/plans/overarching-plan.md Track B2) — the missing
 * "every piece this person holds" surface. Session is injected the same way
 * tests/oracle-visual-foundation.spec.ts does it: intercept Better Auth's
 * own /api/auth/get-session so the app believes it is signed in, then mock
 * the endpoint under test (/api/account/pieces) directly. */

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:2222';

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

const twoMockedPieces = {
  ok: true,
  pieces: [
    {
      id: 'kp-1',
      pieceId: 'UL-100',
      editionNumber: 0,
      title: 'Art of Living',
      cardNumber: 32,
      artworkImage: 'https://res.cloudinary.com/dobbosnda/image/upload/w_640/32_x9qxas',
      restsIn: 'Bali, Indonesia',
      intention: 'To hold steady through the year, and to remember the ground beneath it.',
      claimedAt: '2026-06-01T00:00:00.000Z',
    },
    {
      id: 'kp-2',
      pieceId: 'UL-101',
      editionNumber: 3,
      title: 'Crystal Creation',
      cardNumber: 36,
      artworkImage: 'https://res.cloudinary.com/dobbosnda/image/upload/w_640/36_k8tlcz',
      restsIn: null,
      intention: null,
      claimedAt: '2026-07-15T00:00:00.000Z',
    },
  ],
};

async function assertFourStandardChecks(page: import('@playwright/test').Page, consoleErrors: string[]) {
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  await expect(page.getByText('404')).toHaveCount(0);
  await expect(page.getByText('page not found', { exact: false })).toHaveCount(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 2,
  );
  expect(overflow).toBe(false);
  expect(consoleErrors).toEqual([]);
}

test.describe('/account/pieces', () => {
  test('lists every piece the signed-in steward holds', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await signIn(page);
    await page.route('**/api/account/pieces', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(twoMockedPieces),
    }));

    await page.goto(`${BASE}/account/pieces`, { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: 'Art of Living' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Crystal Creation' })).toBeVisible();
    await expect(page.getByText('rests in Bali, Indonesia')).toBeVisible();
    await expect(page.getByText('Unique piece')).toBeVisible();
    await expect(page.getByText('Edition 3')).toBeVisible();
    await expect(page.getByText('To hold steady through the year')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Read Code 32' })).toHaveAttribute('href', '/universal-language/32');
    await expect(page.getByRole('link', { name: 'Read Code 36' })).toHaveAttribute('href', '/universal-language/36');

    // No italics anywhere on the page (house rule) and no icon glyphs riding
    // along with the intention text.
    const italics = await page.locator('em, i, [style*="italic"]').count();
    expect(italics).toBe(0);

    await assertFourStandardChecks(page, consoleErrors);
  });

  test('shows an honest empty state with no pieces held', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await signIn(page);
    await page.route('**/api/account/pieces', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, pieces: [] }),
    }));

    await page.goto(`${BASE}/account/pieces`, { waitUntil: 'networkidle' });

    await expect(page.getByText('No pieces held under this account yet.')).toBeVisible();
    const worksLink = page.getByRole('link', { name: 'See the work' });
    await expect(worksLink).toBeVisible();
    await expect(worksLink).toHaveAttribute(
      'href',
      'https://adrianrasmussen.com/creations/multidimensional-art/universal-language',
    );

    await assertFourStandardChecks(page, consoleErrors);
  });
});
