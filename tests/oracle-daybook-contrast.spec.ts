import { expect, test } from './fixtures';

// Check rendered ink against its actual inherited surface, so a leftover
// Nightfall panel cannot pass just because the text token looks correct.
async function contrast(locator: import('@playwright/test').Locator) {
  return locator.evaluateAll(elements => elements.map(element => {
    const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).map(Number);
    const luminance = (channels: number[]) => channels.slice(0, 3).map(v => {
      const c = v / 255;
      return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
    }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    let parent: Element | null = element;
    let background = [255, 255, 255];
    while (parent) {
      const color = rgb(getComputedStyle(parent).backgroundColor);
      if (color.length === 3 || color[3] === 1) { background = color; break; }
      parent = parent.parentElement;
    }
    const foreground = luminance(rgb(getComputedStyle(element).color));
    const backdrop = luminance(background);
    return { text: element.textContent?.trim().slice(0, 70), ratio: (Math.max(foreground, backdrop) + .05) / (Math.min(foreground, backdrop) + .05) };
  }));
}

test('Daybook reading controls and secondary copy remain legible on their surfaces', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('dark-mode', 'false'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/universal-language/22');
  await expect(page.locator('.eb-reading[data-palette="daybook"]').first()).toBeAttached();

  const targets = page.locator([
    '.card-reading > section > div > footer a span',
    '.card-reading--desktop aside a span',
    '.card-reading--desktop aside > div > div > span',
    '.eb-reading .ul-gk-spectrum-nav button p',
    '.eb-reading .ul-iching-rows button span',
    '.card-reading [data-nav]',
  ].join(',')).filter({ visible: true });
  const samples = await contrast(targets);
  expect(samples.length).toBeGreaterThan(5);
  expect(samples.filter(sample => sample.text && sample.ratio < 4.5)).toEqual([]);

  const geneKeysNav = page.locator('.card-reading [data-nav]').filter({ hasText: 'Gene Keys' });
  await geneKeysNav.click();
  await expect(geneKeysNav).toHaveAttribute('aria-current', 'true');
  await page.getByRole('button', { name: 'About the Gene Keys', exact: true }).click();
  const close = page.getByRole('button', { name: 'Close', exact: true });
  await expect(close).toBeVisible();
  const closeContrast = await contrast(close);
  expect(closeContrast[0].ratio).toBeGreaterThanOrEqual(4.5);
  await close.click();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
