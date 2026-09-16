import { expect, test, type Page } from './fixtures';

/* "You carry this channel": the one line under "What completes it" on the
 * card's Human Design panel, and the "Your channels" block on /profile.
 *
 * The session is injected the way tests/account-pieces.spec.ts does it:
 * intercept Better Auth's /api/auth/get-session so the app believes it is
 * signed in. The chart is injected straight into localStorage under the
 * profile store's key (lib/profile/storage.ts) via addInitScript, never
 * through the birth-data form. The remote profile fetch is answered with
 * 404 so the local chart is the one the page reads. */

const CARD = '/universal-language/3';
const INTEGRATION_CARD = '/universal-language/20';
const PROFILE_KEY = 'ul.profile.v1';

const blank = { gate: 64, line: 1 };

/** A stored profile where every position is gate 64, then the overrides. */
function storedProfile(overrides: Record<string, { gate: number; line: number }>) {
  return {
    inputs: {
      date: '1990-01-01',
      time: '12:00',
      place: { label: 'Denpasar, Bali, Indonesia', lat: -8.65, lng: 115.22, tzId: 'Asia/Makassar' },
    },
    computed: {
      lifesWork: blank, evolution: blank, radiance: blank, purpose: blank,
      attraction: blank, iq: blank, eq: blank, sq: blank,
      core: blank, culture: blank, pearl: blank,
      ...overrides,
    },
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

const mutationDefined = storedProfile({
  lifesWork: { gate: 3, line: 2 },
  attraction: { gate: 60, line: 5 },
});
const gateThreeOnly = storedProfile({ evolution: { gate: 3, line: 4 } });

async function signIn(page: Page) {
  const now = new Date().toISOString();
  await page.route('**/api/auth/get-session', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      session: {
        id: 'session-reader',
        userId: 'reader-1',
        token: 'test-session-token',
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
      user: {
        id: 'reader-1',
        name: 'A Reader',
        email: 'reader@example.com',
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    }),
  }));
  await page.route('**/api/auth/sync-user', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/profile/get', (route) => route.fulfill({ status: 404 }));
  await page.route('**/api/profile/put', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/collections/**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
}

async function injectProfile(page: Page, profile: ReturnType<typeof storedProfile>) {
  await page.addInitScript(([key, value]) => {
    window.localStorage.setItem(key, value);
  }, [PROFILE_KEY, JSON.stringify(profile)] as const);
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    // The stubbed endpoints answer 404/204; the browser logs the 404 itself.
    if (/404|401|403/.test(text)) return;
    errors.push(text);
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

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

async function openCard(page: Page, path = CARD) {
  // The reading fades text in as it scrolls into view; under reduced motion
  // the host shows everything at once, so the line's opacity is not a race.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(path, { waitUntil: 'networkidle' });
  const entrance = page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });
  try {
    await entrance.waitFor({ state: 'visible', timeout: 1_500 });
    await entrance.click();
  } catch {
    // Direct link, no entrance to dismiss.
  }
}

/** Swipe the reading to the Human Design chapter and bring the line on screen. */
async function showChannelLine(page: Page) {
  await page.getByRole('button', { name: 'Human Design', exact: true }).first().click();
  // The chapters are a horizontal scroll-snap; wait for this one to settle
  // at the left edge (the panel is taller than the viewport, so an
  // intersection ratio would never reach a useful threshold).
  const panel = page.locator('section[data-chapter="humandesign"]');
  await expect.poll(async () => Math.abs((await panel.boundingBox())?.x ?? 999)).toBeLessThan(2);
  const line = page.locator('[data-channel-status]').first();
  // The reading scrolls inside its own <main>, and the chapter jump keeps
  // adjusting that container for a moment after the click, so a single
  // scroll can be undone. Scroll, then check, until the line stays put.
  await expect.poll(async () => line.evaluate((el) => {
    const main = el.closest('main') ?? document.scrollingElement!;
    const r = el.getBoundingClientRect();
    if (r.top >= 0 && r.bottom <= window.innerHeight) return true;
    main.scrollBy({ top: r.top - window.innerHeight / 2, behavior: 'instant' as ScrollBehavior });
    return false;
  }), { intervals: [300], timeout: 10_000 }).toBe(true);
  // On screen, not merely in the DOM: a screenshot taken with the wrong
  // chapter under the viewport proves nothing.
  await expect(line).toBeInViewport();
  await expect(line).toHaveCSS('opacity', '1');
  return line;
}

/** The partner-card link sits above the chart line for every reader. */
async function expectPartnerLink(page: Page, partner: number) {
  const link = page.locator(`[data-channel-partner-link="${partner}"]`);
  await expect(link).toHaveText(`Read gate ${partner} →`);
  await expect(link).toHaveAttribute('href', `/universal-language/${partner}`);
  await expect(link).toBeInViewport();
}

test.describe('the channel line on the card page', () => {
  test('signed in, both gates: the channel is defined', async ({ page }) => {
    const errors = collectErrors(page);
    await signIn(page);
    await injectProfile(page, mutationDefined);
    await openCard(page);

    const line = await showChannelLine(page);
    await expect(line).toHaveAttribute('data-channel-status', 'defined');
    await expect(line).toHaveText('This channel is defined in your profile: you carry gate 3 and gate 60.');
    await expect(page.locator('[data-channel-status]')).toHaveCount(1);
    await expectPartnerLink(page, 60);

    await page.screenshot({ path: 'test-results/channel-line-defined.png' });
    await assertFourStandardChecks(page, errors);
  });

  test('signed in, this gate only: the channel completes in someone else', async ({ page }) => {
    const errors = collectErrors(page);
    await signIn(page);
    await injectProfile(page, gateThreeOnly);
    await openCard(page);

    const line = await showChannelLine(page);
    await expect(line).toHaveAttribute('data-channel-status', 'gate-only');
    await expect(line).toHaveText('You carry gate 3; the channel completes in someone who carries gate 60.');

    await page.screenshot({ path: 'test-results/channel-line-gate-only.png' });
    await assertFourStandardChecks(page, errors);
  });

  test('signed in, neither gate', async ({ page }) => {
    const errors = collectErrors(page);
    await signIn(page);
    await injectProfile(page, storedProfile({ iq: { gate: 1, line: 3 } }));
    await openCard(page);

    const line = await showChannelLine(page);
    await expect(line).toHaveAttribute('data-channel-status', 'neither');
    await expect(line).toHaveText('Neither gate is in your profile.');

    await page.screenshot({ path: 'test-results/channel-line-neither.png' });
    await assertFourStandardChecks(page, errors);
  });

  test('an Integration gate gets one named line per channel', async ({ page }) => {
    const errors = collectErrors(page);
    await signIn(page);
    await injectProfile(page, storedProfile({
      lifesWork: { gate: 20, line: 1 },
      eq: { gate: 57, line: 3 },
    }));
    await openCard(page, INTEGRATION_CARD);

    await showChannelLine(page);
    const lines = page.locator('[data-channel-status]');
    await expect(lines).toHaveCount(3);
    await expect(lines.nth(0)).toHaveText('Channel of Awakening: you carry gate 20; the channel completes in someone who carries gate 10.');
    await expect(lines.nth(1)).toHaveText('Channel of Charisma: you carry gate 20; the channel completes in someone who carries gate 34.');
    await expect(lines.nth(2)).toHaveText('Channel of the Brainwave, defined in your profile: you carry gate 20 and gate 57.');
    for (const partner of [10, 34, 57]) await expectPartnerLink(page, partner);

    await page.screenshot({ path: 'test-results/channel-line-integration.png' });
    await assertFourStandardChecks(page, errors);
  });

  test('signed out: one line inviting sign-in, which opens the sign-in modal', async ({ page }) => {
    const errors = collectErrors(page);
    await page.route('**/api/auth/get-session', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: 'null',
    }));
    await openCard(page);

    const line = await showChannelLine(page);
    await expect(line).toHaveAttribute('data-channel-status', 'signed-out');
    await expect(line).toHaveText('Sign in to see whether this channel is defined in your profile.');
    await expectPartnerLink(page, 60);

    await page.screenshot({ path: 'test-results/channel-line-signed-out.png' });

    await page.locator('[data-channel-partner-link="60"]').click();
    await expect(page).toHaveURL(/\/universal-language\/60$/);
    await expect(page.locator('[data-channel-partner-link="3"]')).toHaveText('Read gate 3 →');
    await page.goBack();
    await showChannelLine(page);

    await line.getByRole('button').click();
    await expect(page.getByText('Keep your chart')).toBeVisible();
    await assertFourStandardChecks(page, errors);
  });
});

test.describe('your channels, on the profile page', () => {
  test('lists each defined channel by name with both gates linked to their cards', async ({ page }) => {
    const errors = collectErrors(page);
    await signIn(page);
    await injectProfile(page, storedProfile({
      lifesWork: { gate: 3, line: 2 },
      evolution: { gate: 1, line: 1 },
      radiance: { gate: 8, line: 4 },
      attraction: { gate: 60, line: 5 },
      sq: { gate: 60, line: 1 },
      pearl: { gate: 7, line: 2 },      // 7 without 31: not a channel
    }));
    await page.goto('/profile', { waitUntil: 'networkidle' });

    const block = page.locator('[data-your-channels]');
    await block.scrollIntoViewIfNeeded();
    await expect(block).toBeInViewport();
    await expect(block.getByText('Your channels')).toBeVisible();

    const rows = block.locator('[data-your-channel]');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveAttribute('data-your-channel', '1-8');
    await expect(rows.nth(0)).toContainText('Channel of Inspiration');
    await expect(rows.nth(1)).toHaveAttribute('data-your-channel', '3-60');
    await expect(rows.nth(1)).toContainText('Channel of Mutation');

    const links = rows.nth(1).getByRole('link');
    await expect(links).toHaveCount(2);
    await expect(links.nth(0)).toHaveAttribute('href', '/universal-language/3');
    await expect(links.nth(0)).toContainText('Gate 3, Messengers of the Infinite');
    await expect(links.nth(1)).toHaveAttribute('href', '/universal-language/60');
    await expect(links.nth(1)).toContainText('Gate 60');

    await page.screenshot({ path: 'test-results/your-channels-defined.png' });
    await assertFourStandardChecks(page, errors);
  });

  test('says so when the chart completes no channel', async ({ page }) => {
    const errors = collectErrors(page);
    await signIn(page);
    await injectProfile(page, gateThreeOnly);
    await page.goto('/profile', { waitUntil: 'networkidle' });

    const block = page.locator('[data-your-channels]');
    await block.scrollIntoViewIfNeeded();
    await expect(block.locator('[data-your-channels-empty]')).toContainText('do not complete a channel');
    await expect(block.locator('[data-your-channel]')).toHaveCount(0);

    await page.screenshot({ path: 'test-results/your-channels-empty.png' });
    await assertFourStandardChecks(page, errors);
  });
});
