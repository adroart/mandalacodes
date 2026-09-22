import { expect, test } from './fixtures';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:2222';

async function setTheme(page: import('@playwright/test').Page, dark: boolean) {
  await page.addInitScript((isDark) => {
    localStorage.setItem('dark-mode', isDark ? 'true' : 'false');
    sessionStorage.setItem('eb-skip-entrance', '1');
  }, dark);
}

/* Under a plain `vite` dev server there is no Functions runtime, so
 * `/api/atlas` never answers, Atlas state never leaves `loading`, and
 * `[data-atlas-stage]` never mounts. Mock it the way `atlas-no-webgl.spec.ts`
 * does so these theme assertions can reach the stage. */
const mockAtlasState = {
  ok: true,
  state: {
    generatedAt: '2026-09-08T00:00:00.000Z',
    schemaVersion: 2,
    cities: [
      { id: 'lisbon-pt', city: 'Lisbon', country: 'Portugal', countryCode: 'PT', lat: 38.7223, lng: -9.1393 },
    ],
    pieces: [
      { pieceId: 'UL-01', editionNumber: 1, series: 'Universal Language', cityId: 'lisbon-pt', status: 'placed', pieceType: 'mandala', claimOrdinal: 1, kind: 'sixty-four' },
    ],
  },
};

async function mockAtlasEndpoint(page: import('@playwright/test').Page) {
  await page.route('**/api/atlas', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockAtlasState) }),
  );
  await page.route('**/api/atlas/catalog', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, entries: [] }) }),
  );
}

test('new visitors start in Nightfall across the SPA', async ({ page }) => {
  await page.goto(`${BASE}/universal-language`);

  const root = page.locator('html');
  await expect(root).toHaveClass(/\bdark\b/);
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('[data-site-shell]')).toHaveCSS('background-color', 'rgb(33, 28, 22)');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#141210');
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
});

test('new visitors start in Nightfall on Learn', async ({ page }) => {
  await page.goto(`${BASE}/learn`);

  const root = page.locator('html');
  await expect(root).toHaveClass(/\bdark\b/);
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect(root).toHaveCSS('background-color', 'rgb(33, 28, 22)');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#141210');
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
});

test('light mode uses the Warm Daybook material system on public surfaces', async ({ page }) => {
  await setTheme(page, false);

  for (const route of ['/the-systems', '/profile']) {
    await page.goto(`${BASE}${route}`);
    const shell = page.locator('[data-site-shell]');
    await expect(shell).toHaveCSS('background-color', 'rgb(243, 239, 231)');
    await expect(shell).toHaveCSS('color', 'rgb(39, 34, 25)');
  }

  await page.goto(`${BASE}/universal-language`);
  const deck = page.locator('.oe-root [data-theme="light"]');
  await expect(deck).toHaveCSS('background-color', 'rgb(243, 239, 231)');
  expect(await deck.evaluate((element) => getComputedStyle(element).getPropertyValue('--bg2').trim()))
    .toBe('#faf7f0');
});

test('light mode reaches every remaining paper route family', async ({ page }) => {
  await setTheme(page, false);

  const surfaces = [
    { route: '/gateway', selector: '#main-content > .route-fade-in > div', property: 'background-color', value: 'rgb(243, 239, 231)' },
    { route: '/family', selector: '.family-reveal', property: 'background-color', value: 'rgb(243, 239, 231)' },
    { route: '/make', selector: '#main-content .bg-paper-100', property: 'background-color', value: 'rgb(234, 228, 215)' },
    { route: '/piece/UL-100', selector: '#main-content > .route-fade-in > .bg-paper-100', property: 'background-color', value: 'rgb(234, 228, 215)' },
    { route: '/admin/login', selector: '#main-content h1', property: 'color', value: 'rgb(39, 34, 25)' },
    { route: '/account', selector: '#main-content h1', property: 'color', value: 'rgb(39, 34, 25)' },
    { route: '/account/collections', selector: '#main-content h1', property: 'color', value: 'rgb(39, 34, 25)' },
    { route: '/not-found', selector: '#main-content section', property: 'background-color', value: 'rgb(243, 239, 231)' },
  ] as const;

  for (const surface of surfaces) {
    await page.goto(`${BASE}${surface.route}`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator(surface.selector).first()).toHaveCSS(surface.property, surface.value);
  }

  await page.goto(`${BASE}/learn`);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(243, 239, 231)');
});

test('the Oracle reading frame follows Daybook while the artwork mat stays dark', async ({ page }) => {
  await setTheme(page, false);
  await page.goto(`${BASE}/universal-language/14`);

  const frame = page.locator('.card-reading');
  const jumpRail = frame.locator('[data-jumpbar]');
  const artworkMat = frame.locator('[data-artparallax]').locator('..');

  await expect(frame).toHaveCSS('background-color', 'rgb(243, 239, 231)');
  await expect(jumpRail).toHaveCSS('background-color', 'rgb(234, 228, 215)');
  await expect(frame.locator('.card-reading__designed-header h1')).toHaveCSS('color', 'rgb(39, 34, 25)');
  await expect(artworkMat).toHaveCSS(
    'background-color',
    await frame.evaluate(element => element.classList.contains('card-reading--mobile')) ? 'rgb(20, 16, 11)' : 'rgb(16, 13, 9)',
  );
});

test('Atlas keeps the globe dark while its ledger follows light mode', async ({ page }) => {
  await setTheme(page, false);
  await mockAtlasEndpoint(page);
  await page.goto(`${BASE}/atlas?view=ledger`);

  const pageSurface = page.locator('[data-atlas-page]');
  const stage = page.locator('[data-atlas-stage]');
  const ledger = page.getByRole('heading', { name: 'The ledger' });

  await expect(stage).toBeVisible({ timeout: 15_000 });
  await expect(pageSurface).toHaveCSS('background-color', 'rgb(243, 239, 231)');
  await expect(stage).toHaveCSS('background-color', 'rgb(15, 13, 11)');
  await expect(ledger).toHaveCSS('color', 'rgb(39, 34, 25)');
});

test('dark mode retains Nightfall without changing the Atlas stage', async ({ page }) => {
  await setTheme(page, true);
  await mockAtlasEndpoint(page);
  await page.goto(`${BASE}/atlas?view=ledger`);

  const pageSurface = page.locator('[data-atlas-page]');
  const stage = page.locator('[data-atlas-stage]');

  await expect(stage).toBeVisible({ timeout: 15_000 });
  await expect(pageSurface).toHaveCSS('background-color', 'rgb(33, 28, 22)');
  await expect(stage).toHaveCSS('background-color', 'rgb(15, 13, 11)');
});

for (const theme of [
  { dark: false, surface: 'rgb(243, 239, 231)', ink: 'rgb(39, 34, 25)' },
  { dark: true, surface: 'rgb(33, 28, 22)', ink: 'rgb(243, 236, 222)' },
] as const) {
  test(`Lightweaver follows ${theme.dark ? 'Nightfall' : 'Daybook'} without double-inverting tokens`, async ({ page }) => {
    await setTheme(page, theme.dark);
    await page.goto(`${BASE}/lightweaver`);

    const surface = page.locator('[data-lightweaver-page]');
    await expect(surface).toHaveCSS('background-color', theme.surface);
    await expect(surface.getByRole('heading', { name: 'Lightweaver', exact: true })).toHaveCSS('color', theme.ink);
    await expect(surface.getByRole('button', { name: theme.dark ? 'Switch to light mode' : 'Switch to dark mode' })).toBeVisible();
  });
}

test('Homecoming is a themed paper form rather than a permanently dark stage', async ({ page }) => {
  await setTheme(page, false);
  await page.goto(`${BASE}/atlas/homecoming`);

  const surface = page.locator('[data-homecoming-page]');
  await expect(surface).toHaveCSS('background-color', 'rgb(243, 239, 231)');
  await expect(surface.getByRole('heading', { name: 'bring your piece home' })).toHaveCSS('color', 'rgb(122, 90, 34)');
});

for (const theme of [
  { dark: false, palette: 'daybook' },
  { dark: true, palette: 'nightfall' },
] as const) {
  test(`Oracle share sheet follows the active ${theme.palette} palette`, async ({ page }) => {
    await setTheme(page, theme.dark);
    await page.goto(`${BASE}/universal-language/22`);

    const share = page.locator('[data-bar-share], [data-bar-tab="share"]');
    await expect(share).toBeVisible();
    await share.click();

    const sheet = page.locator('.eb-reading[role="dialog"]');
    await expect(sheet).toHaveAttribute('data-palette', theme.palette);
  });
}
