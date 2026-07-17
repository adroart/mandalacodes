import { expect, test, type Locator, type Page } from '@playwright/test';

type FontRole = '--font-display' | '--font-reading' | '--font-ui';

function normalizeFontFamily(value: string) {
  return value
    .split(',')
    .map((family) => family.trim().replace(/^["']|["']$/g, '').replace(/\s+/g, ' ').toLowerCase())
    // Chromium serializes its BlinkMacSystemFont alias as system-ui.
    .map((family) => family === 'blinkmacsystemfont' ? 'system-ui' : family)
    .filter(Boolean);
}

async function expectComputedFontRole(element: Locator, role: FontRole) {
  await expect(element).toBeVisible();

  const { actual, expected } = await element.evaluate((node, customProperty) => {
    const styles = getComputedStyle(node);
    return {
      actual: styles.fontFamily,
      expected: styles.getPropertyValue(customProperty),
    };
  }, role);

  expect(expected.trim(), `${role} must be available to the representative element`).not.toBe('');
  expect(normalizeFontFamily(actual)).toEqual(normalizeFontFamily(expected));
}

async function waitForFonts(page: Page) {
  await page.evaluate(() => document.fonts.ready);
}

async function visibleSharedNavigationLabel(page: Page, scope = '.site-bar-root') {
  const visibleLabel = page.locator(`${scope} .font-label:visible`).first();
  if (await visibleLabel.count()) return visibleLabel;

  await page.locator(scope).getByRole('button', { name: 'Open menu' }).click();
  return page.getByRole('navigation', { name: 'Mobile navigation' }).locator('.font-label').first();
}

test('the oracle reading resolves typography through the shared roles', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('eb-skip-entrance', '1'));
  await page.goto('/universal-language/22');

  await expect(page.locator('.eb-reading').first()).toBeVisible();
  await waitForFonts(page);

  const visibleTitle = page
    .locator('.eb-reading .ul-title-mobile:visible h1, .eb-reading .ul-title-desktop:visible')
    .first();
  const prose = page.locator('.eb-reading section[data-chapter] p:has(.ul-dropcap)').first();
  const navigation = await visibleSharedNavigationLabel(page);

  await expectComputedFontRole(visibleTitle, '--font-display');
  await expectComputedFontRole(prose, '--font-reading');
  await expectComputedFontRole(navigation, '--font-ui');
});

test('the learn article resolves typography through the same shared roles', async ({ page }) => {
  await page.goto('/learn/what-is-a-mandala/');

  const article = page.locator('.lp-read-section');
  await expect(article).toBeVisible();
  await waitForFonts(page);

  const title = article.locator('.lp-read-title');
  const prose = article.locator('.lp-read-body p').first();
  const navigation = await visibleSharedNavigationLabel(page, '.mc-site-bar .site-bar-root');

  await expectComputedFontRole(title, '--font-display');
  await expectComputedFontRole(prose, '--font-reading');
  await expectComputedFontRole(navigation, '--font-ui');
});
