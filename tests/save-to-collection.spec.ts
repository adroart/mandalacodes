import { expect, test, type Page } from './fixtures';

/* The card reading's save control (todo/plans/repair/phase-1-wiring-queue.md
 * item 05, landed in components/UniversalLanguageCard.tsx by PR #165 as the
 * chart-row's "Save this code" chip). This spec locks that wiring in: a
 * signed-in visitor sees the button and can add the code to a collection, a
 * signed-out visitor sees the same sign-in door the chart callout above it
 * already opens (SaveToCollectionButton renders a SignInTrigger, no separate
 * wall).
 *
 * Session is injected the same way tests/account-pieces.spec.ts does it:
 * intercept Better Auth's own /api/auth/get-session so the app believes it is
 * signed in, then mock the collections endpoints under test directly. */

const CARD = '/universal-language/1';

const entrance = (page: Page) =>
  page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });

/** A direct link to a card opens quietly (no entrance ritual); this only
 * exists so the spec does not break if that ever changes. */
async function openCard(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'networkidle' });
  try {
    await entrance(page).waitFor({ state: 'visible', timeout: 1_500 });
    await entrance(page).click();
  } catch {
    // Direct link, no entrance to dismiss.
  }
}

async function signIn(page: Page) {
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

const oneEmptyCollection = [
  { id: 1, name: 'Keepers', createdAt: '2026-06-01T00:00:00.000Z', items: [] },
];

async function assertFourStandardChecks(page: Page, consoleErrors: string[]) {
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  await expect(page.getByText('404')).toHaveCount(0);
  await expect(page.getByText('page not found', { exact: false })).toHaveCount(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 2,
  );
  expect(overflow).toBe(false);
  expect(consoleErrors).toEqual([]);
}

test.describe('save to collection, on the card reading', () => {
  test('signed in: the button is visible and saving posts to the collection', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    await signIn(page);
    await page.route('**/api/collections/list', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(oneEmptyCollection),
    }));

    let addItemBody: unknown = null;
    await page.route('**/api/collections/add-item', async (route) => {
      addItemBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await openCard(page, CARD);

    const saveButton = page.getByRole('button', { name: 'Save this code' });
    await expect(saveButton).toBeVisible();
    await page.screenshot({ path: 'test-results/save-to-collection-signed-in.png' });

    await saveButton.click();
    await page.getByRole('button', { name: 'Keepers' }).click();

    await expect.poll(() => addItemBody).toEqual({ collectionId: 1, kind: 'card', ref: '1' });

    await assertFourStandardChecks(page, consoleErrors);
  });

  test('signed out: the button opens the sign-in door instead of a wall on the page', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));

    // No signIn() call: get-session resolves to Better Auth's own signed-out
    // shape from the real (dev) endpoint, same as any anonymous visitor.
    await openCard(page, CARD);

    const saveButton = page.getByRole('button', { name: 'Save this code' });
    await expect(saveButton).toBeVisible();

    // The reading behind it stays open; nothing about the page itself is
    // walled off by being signed out.
    await expect(page.getByText('Something went wrong')).toHaveCount(0);

    await saveButton.click();
    await expect(page.getByText('Keep your chart')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Email me a sign-in code' })).toBeVisible();
    await page.screenshot({ path: 'test-results/save-to-collection-signed-out.png' });

    await assertFourStandardChecks(page, consoleErrors);
  });
});
