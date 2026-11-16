import { expect, test } from './fixtures';
import { readFileSync } from 'node:fs';
import { mapCode, parseCardMarkdown } from '../lib/oracle/card-markdown';

const manuscript = parseCardMarkdown(readFileSync(new URL('../oracle/cards/22.md', import.meta.url), 'utf8'));
const entrance = (manuscript.frontmatter.meta as Record<string, string>).centre;
const codeOpening = mapCode(manuscript)?.reading.split('\n\n')[0];

test('the authored entrance appears once under its heading, separate from the CODE reading', async ({ page }) => {
  expect(entrance).toBeTruthy();
  expect(codeOpening).toBeTruthy();
  expect(entrance).not.toBe(codeOpening);
  await page.route('**/api/oracle/invocations/**/live', route => route.fulfill({ status: 204, body: '' }));
  await page.goto('/universal-language/22');

  const intro = page.getByRole('region', { name: 'Message at a glance' });
  await expect(intro.getByRole('heading', { name: 'Message at a glance' })).toBeVisible();
  await expect(intro.locator('.ul-essence')).toHaveText(entrance);
  await expect(page.locator('.ul-intro')).toHaveCount(1);
  await expect(page.locator('section[data-chapter="ul"] [data-oracle-reading-prose]')).toContainText(codeOpening);
  await expect(page.locator('section[data-chapter="ul"] [data-oracle-reading-prose]')).not.toContainText(entrance);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('the site header hides inline links when its mobile menu is visible', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/universal-language');
  const inlineLink = page.locator('.site-bar-root a[href="/the-systems"]');
  const mobileMenuButton = page.getByRole('button', { name: 'Open menu' });
  await expect(inlineLink).toBeVisible();
  await expect(mobileMenuButton).toBeHidden();
  await page.evaluate(() => {
    const link = document.querySelector('.site-bar-root a[href="/the-systems"]')!;
    const menu = link.parentElement!;
    const observer = new MutationObserver(() => {
      if (menu.getAttribute('aria-hidden') !== 'true') return;
      (window as Window & { navVisibilityAtCollapse?: string }).navVisibilityAtCollapse = getComputedStyle(link).visibility;
      observer.disconnect();
    });
    observer.observe(menu, { attributes: true, attributeFilter: ['aria-hidden'] });
  });
  await page.setViewportSize({ width: 320, height: 568 });
  await expect(mobileMenuButton).toBeVisible();
  await expect(inlineLink.locator('..')).toHaveAttribute('aria-hidden', 'true');
  expect(await page.evaluate(() => (window as Window & { navVisibilityAtCollapse?: string }).navVisibilityAtCollapse)).toBe('hidden');
  await expect(inlineLink).toBeHidden();
});
