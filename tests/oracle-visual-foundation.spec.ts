import { expect, test } from '@playwright/test';

const CARD = '/universal-language/22';
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:2222';

async function openReading(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}${CARD}`);
  const entrance = page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });
  if (await entrance.isVisible()) await entrance.click();
}

test('uses the Teajia reading type roles and measure', async ({ page }) => {
  await openReading(page);
  const reading = page.locator('section[data-chapter="ul"] > div > div[style*="flex-direction: column"] > p').first();
  await expect(reading).toBeVisible();
  const styles = await reading.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { family: computed.fontFamily, size: parseFloat(computed.fontSize), lineHeight: parseFloat(computed.lineHeight), width: element.getBoundingClientRect().width };
  });
  expect(styles.family).toContain('Lora');
  expect(styles.size).toBeGreaterThanOrEqual(18);
  expect(styles.lineHeight / styles.size).toBeGreaterThanOrEqual(1.72);
  expect(styles.lineHeight / styles.size).toBeLessThanOrEqual(1.78);
  expect(styles.width).toBeLessThanOrEqual(680);
});

test('keeps the centered constellation visible without overflow at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await openReading(page);
  const footer = page.getByRole('navigation', { name: 'Hexagram navigation' });
  await expect(footer).toBeVisible();
  const geometry = await footer.evaluate((element) => {
    const center = element.querySelector('[data-current-hexagram]');
    const previous = element.querySelector('[data-neighbor="previous"]');
    const next = element.querySelector('[data-neighbor="next"]');
    if (!center || !previous || !next) throw new Error('navigation constellation is incomplete');
    const c = center.getBoundingClientRect();
    const p = previous.getBoundingClientRect();
    const n = next.getBoundingClientRect();
    return { documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, centerDelta: Math.abs(c.left + c.width / 2 - innerWidth / 2), previousLeft: p.left, nextRight: n.right };
  });
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.centerDelta).toBeLessThanOrEqual(1);
  expect(geometry.previousLeft).toBeGreaterThanOrEqual(0);
  expect(geometry.nextRight).toBeLessThanOrEqual(geometry.viewportWidth);
});

test('preserves previous, all 64, and next navigation destinations', async ({ page }) => {
  await openReading(page);
  await expect(page.getByRole('link', { name: 'Previous hexagram: Code 21, Beyond Binary' })).toHaveAttribute('href', '/universal-language/21');
  await expect(page.getByRole('link', { name: 'All 64 hexagrams' })).toHaveAttribute('href', '/universal-language');
  await expect(page.getByRole('link', { name: 'Next hexagram: Code 23, Beneath the Surface' })).toHaveAttribute('href', '/universal-language/23');
});

test('reveals content immediately for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openReading(page);
  const reveal = page.locator('section[data-chapter] > div > *').first();
  await expect(reveal).toBeVisible();
  await expect(reveal).toHaveCSS('opacity', '1');
  await expect(reveal).toHaveCSS('transform', 'none');
});

test('keeps below-fold sections armed until they approach the viewport', async ({ page }) => {
  await openReading(page);
  await expect(page.locator('section[data-chapter="ul"]')).toBeVisible();
  const blocks = page.locator('section[data-chapter="ul"] > div > *');
  const count = await blocks.count();
  expect(count).toBeGreaterThan(2);
  const belowFold = blocks.nth(count - 1);

  await page.waitForTimeout(2100);
  const before = await belowFold.evaluate((element) => ({
    opacity: getComputedStyle(element).opacity,
    top: element.getBoundingClientRect().top,
    viewport: window.innerHeight,
  }));

  expect(before.top).toBeGreaterThan(before.viewport);
  expect(before.opacity).toBe('0');
});
