import { expect, test, type Page } from './fixtures';
import { LAUNCH_FLAGS } from '../launchFlags';

/* The Relations panel's stack of kin (components/oracle/RelationsStack.tsx):
 * two families of bars, one open at a time, every kin card a link, and, for
 * a reader with a chart, the chart's word on each bar.
 *
 * The chart is injected straight into localStorage under the profile store's
 * key (lib/profile/storage.ts) via addInitScript, never through the birth-data
 * form; the remote profile fetch is answered 404 so the local chart is the one
 * the page reads. The same shape as tests/channel-status.spec.ts. */

const CARD = '/universal-language/3';
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

// Carries 3 and 60 (the channel is defined), the pair 4 as the Pearl, and two
// of the ring's five siblings. Not the partner 50.
const chart = storedProfile({
  lifesWork: { gate: 3, line: 2 },
  attraction: { gate: 60, line: 5 },
  pearl: { gate: 4, line: 1 },
  culture: { gate: 24, line: 3 },
  core: { gate: 42, line: 6 },
});

/** Exercise a guest chart claimed by a synthetic account whose remote profile
 * is empty (204), using the same auth contract as account-pieces. */
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
  await page.route('**/api/profile/put', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/collections/**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
}

async function injectProfile(page: Page) {
  await signIn(page);
  await page.route('**/api/profile/get', (route) => route.fulfill({ status: 204 }));
  await page.addInitScript(([key, value]) => {
    window.localStorage.setItem(key, value);
  }, [PROFILE_KEY, JSON.stringify(chart)] as const);
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/404|401|403/.test(text)) return;
    errors.push(text);
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  return errors;
}

async function assertFourStandardChecks(page: Page, consoleErrors: string[]) {
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  await expect(page.getByText('page not found', { exact: false })).toHaveCount(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 2,
  );
  expect(overflow).toBe(false);
  expect(consoleErrors).toEqual([]);
}

async function openCard(page: Page, path = CARD) {
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

/** The visible stack: the card page mounts the reading markup twice, and the
 * designed header holds a hidden copy, so probe inside the chapter section. */
const stack = (page: Page) => page.locator('section[data-chapter="relations"] [data-relations-stack]').first();

/** Swipe the reading to the Relations chapter. */
async function showRelations(page: Page) {
  await page.getByRole('button', { name: 'Relations', exact: true }).first().click();
  // On a phone the chapters stack and this one is simply attached; on a
  // desktop they are a horizontal scroll-snap inside the right column, so
  // wait for the chapter to settle at its container's left edge.
  const panel = page.locator('section[data-chapter="relations"]');
  await expect.poll(async () => panel.evaluate((el) => {
    const mine = el.getBoundingClientRect().x;
    const parent = el.parentElement!.getBoundingClientRect().x;
    return Math.abs(mine - parent);
  })).toBeLessThan(2);
  await expect(stack(page)).toBeAttached();
}

/** Scroll the reading's own container until the element's top sits near the
 * top of the viewport. An open bar can be taller than a phone screen, so the
 * test asks for its head, not the whole of it. The chapter jump keeps
 * adjusting the container for a moment after a click, so scroll, then check,
 * until it stays put. The last folded bars sit at the foot of the page, and
 * on a tablet the container runs out of scroll before they reach the upper
 * part of the screen, so a bar that is on screen with the scroller at its
 * end counts too. */
async function bringIntoView(page: Page, selector: string) {
  const el = stack(page).locator(selector).first();
  await expect.poll(async () => el.evaluate((node) => {
    const main = node.closest('main') ?? document.scrollingElement!;
    const r = node.getBoundingClientRect();
    if (r.top >= 0 && r.top < window.innerHeight * 0.4) return true;
    const atEnd = main.scrollTop + main.clientHeight >= main.scrollHeight - 1;
    if (atEnd && r.top >= 0 && r.top < window.innerHeight) return true;
    main.scrollBy({ top: r.top - 90, behavior: 'instant' as ScrollBehavior });
    return false;
  }), { intervals: [300], timeout: 10_000 }).toBe(true);
  await expect(el).toBeInViewport();
  return el;
}

test.describe('the Relations stack', () => {
  // The stack ships behind LAUNCH_FLAGS.relationsStack, off until Adrian has
  // worked it up; these cases run when it is on, the orbit case below when off.
  test.skip(!LAUNCH_FLAGS.relationsStack, 'relationsStack is off');

  test('a stranger sees seven bars in two families, the pair open, every kin a link', async ({ page }) => {
    const errors = collectErrors(page);
    await openCard(page);
    await showRelations(page);
    const s = stack(page);

    // Card 3: pair 4 (inverse folded in), partner 50, channel 60, the ring, then the lore.
    await expect(s.locator('[data-bar]')).toHaveCount(7);
    const keys = await s.locator('[data-bar]').evaluateAll((els) => els.map((e) => e.getAttribute('data-bar')));
    expect(keys).toEqual(['pair', 'partner', 'channel', 'ring', 'tarot', 'immortals', 'deeper']);
    await expect(s.locator('[data-bar="pair"][data-open="true"]')).toHaveCount(1);
    await expect(s.locator('[data-open="true"]')).toHaveCount(1);

    // The open pair names its kin as a link to that card, and says the bond.
    const open = await bringIntoView(page, '[data-bar="pair"]');
    await expect(open).toContainText('Pair and inverse');
    const kinLink = open.locator('.ul-rs-open__kin a');
    await expect(kinLink).toHaveText('Veils of Knowledge');
    await expect(kinLink).toHaveAttribute('href', '/universal-language/4');
    await expect(open.getByRole('link', { name: 'Open the card' })).toHaveAttribute('href', '/universal-language/4');

    // No chart yet: no chart words anywhere, and the header offers the chart.
    await expect(s.locator('[data-chart-line]')).toHaveCount(0);
    await expect(s.locator('[data-chart-summary]')).toHaveText('Add your profile');
    await expect(s.locator('[data-chart-summary]')).toHaveAttribute('href', '/profile');

    await page.screenshot({ path: 'test-results/relations-stack-stranger.png', fullPage: false });
    await assertFourStandardChecks(page, errors);
  });

  test('pressing a folded bar opens it; the ring lists its six codes; Next walks on', async ({ page }) => {
    const errors = collectErrors(page);
    await openCard(page);
    await showRelations(page);
    const s = stack(page);

    const ringBar = await bringIntoView(page, '[data-bar="ring"]');
    await ringBar.click();
    await expect(s.locator('[data-bar="ring"][data-open="true"]')).toHaveCount(1);
    await expect(s.locator('[data-bar="pair"][data-open="false"]')).toHaveCount(1);

    const open = await bringIntoView(page, '[data-bar="ring"]');
    await expect(open).toContainText('Ring of Life and Death');
    const members = open.locator('[data-member]');
    await expect(members).toHaveCount(5);
    const codes = await members.evaluateAll((els) => els.map((e) => e.getAttribute('data-member')));
    expect(codes).toEqual(['20', '23', '24', '27', '42']);
    await expect(members.first()).toHaveAttribute('href', '/universal-language/20');
    await expect(members.first()).toContainText('Emerging as the Code');

    await page.screenshot({ path: 'test-results/relations-stack-ring.png', fullPage: false });

    // Next opens the bar below: Tarot.
    await open.locator('[data-next]').click();
    await expect(s.locator('[data-bar="tarot"][data-open="true"]')).toHaveCount(1);
    await expect(s.locator('[data-open="true"]')).toHaveCount(1);

    // The lore bars point at the traditions page, not a card.
    const tarot = await bringIntoView(page, '[data-bar="tarot"]');
    await expect(tarot.getByRole('link', { name: 'The traditions' })).toHaveAttribute('href', '/the-systems');
    await assertFourStandardChecks(page, errors);
  });

  test('a reader with a chart sees which kin the chart carries', async ({ page }) => {
    const errors = collectErrors(page);
    await injectProfile(page);
    await openCard(page);
    await showRelations(page);
    const s = stack(page);

    // Eight kin gates in the deck family (4, 50, 60 and the five ring siblings); the chart carries 4, 60, 24, 42.
    await expect(s.locator('[data-chart-summary]')).toHaveText('4 of 8 in your profile');

    // The open pair: gate 4 sits at the Pearl.
    const pair = await bringIntoView(page, '[data-bar="pair"]');
    await expect(pair.locator('[data-chart-line]')).toHaveText('In your profile, your Pearl');
    await expect(pair).toHaveClass(/is-lit/);

    // Folded bars carry the verdict: the partner is not in the chart, the channel is defined.
    await expect(s.locator('[data-bar="partner"] .ul-rs-bar__chart')).toHaveText('Not in profile');
    await expect(s.locator('[data-bar="partner"]')).not.toHaveClass(/is-lit/);
    await expect(s.locator('[data-bar="channel"] .ul-rs-bar__chart')).toHaveText('Defined in your profile');
    await expect(s.locator('[data-bar="channel"]')).toHaveClass(/is-lit/);
    await expect(s.locator('[data-bar="ring"] .ul-rs-bar__chart')).toHaveText('3 of 6 in your profile');

    // Open the channel: the full sentence from channelStatusFor.
    await s.locator('[data-bar="channel"]').click();
    const channel = await bringIntoView(page, '[data-bar="channel"]');
    await expect(channel.locator('[data-chart-line]')).toHaveText('Defined in your profile: you carry gate 3 and gate 60');
    await expect(channel.locator('.ul-rs-open__kin a')).toHaveAttribute('href', '/universal-language/60');

    // Open the ring: each member says whether the chart carries it.
    await s.locator('[data-bar="ring"]').click();
    const ring = await bringIntoView(page, '[data-bar="ring"]');
    await expect(ring.locator('[data-member="24"] .ul-rs-member__chart')).toHaveText('In your profile');
    await expect(ring.locator('[data-member="20"] .ul-rs-member__chart')).toHaveText('Not in profile');

    await page.screenshot({ path: 'test-results/relations-stack-chart.png', fullPage: false });
    await assertFourStandardChecks(page, errors);
  });

  test('a kin link opens that card', async ({ page }) => {
    await openCard(page);
    await showRelations(page);
    const open = await bringIntoView(page, '[data-bar="pair"]');
    await open.getByRole('link', { name: 'Open the card' }).click();
    await expect(page).toHaveURL(/\/universal-language\/4$/);
    await expect(page.locator('section[data-chapter="relations"]')).toBeAttached();
  });
});

test.describe('the Relations orbit, while the stack is off', () => {
  test.skip(LAUNCH_FLAGS.relationsStack, 'relationsStack is on');

  test('the template orbit still renders: six kin nodes and the pair teaching', async ({ page }) => {
    const errors = collectErrors(page);
    await openCard(page);
    await page.getByRole('button', { name: 'Relations', exact: true }).first().click();
    const panel = page.locator('section[data-chapter="relations"]');
    await expect(panel.locator('[data-relations-stack]')).toHaveCount(0);
    await expect(panel.locator('.ul-kin-wrap')).toBeAttached();
    // The six orbit nodes plus the centre: pair, ring, sky, tarot, letter, immortal.
    await expect(panel.locator('.ul-kin-wrap button')).toHaveCount(7);
    await expect(panel.getByText('Veils of Knowledge', { exact: false }).first()).toBeAttached();
    await assertFourStandardChecks(page, errors);
  });
});
