import { expect, test } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:2222';

async function setTheme(page: import('@playwright/test').Page, dark: boolean) {
  await page.addInitScript((isDark) => {
    localStorage.setItem('dark-mode', isDark ? 'true' : 'false');
    sessionStorage.setItem('eb-skip-entrance', '1');
  }, dark);
}

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

test('Atlas keeps the globe dark while its ledger follows light mode', async ({ page }) => {
  await setTheme(page, false);
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

    const share = page.locator('[data-bar-share]:visible, [data-bar-tab="share"]:visible');
    await expect(share).toBeVisible();
    await share.click();

    const sheet = page.locator('.eb-reading[role="dialog"]');
    await expect(sheet).toHaveAttribute('data-palette', theme.palette);
  });
}
