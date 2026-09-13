import { test, expect, Page } from './fixtures';

/* Drive the real birth-data form to create a profile, then assert the chart.
   (localStorage seeding doesn't survive a reload in headless here, so we use
   the genuine user path: type a city, pick it, build.) The place picker reads
   a local cities index over fetch, so no network is needed. */
async function buildProfile(page: Page) {
  await page.goto('/profile');
  await page.fill('#profile-date', '1990-06-15');
  await page.fill('#profile-time', '1430');
  await page.fill('#profile-place', 'London');
  await page.waitForSelector('.profile-form__suggestion', { timeout: 8000 });
  await page.locator('.profile-form__suggestion').first().click();
  await page.getByText('Build my profile').click();
  await page.waitForSelector('.pg__svg');
}

test('chart, zoom controls and list all render below 880px', async ({ page }) => {
  await buildProfile(page);

  // The visual chart and its 11 orbs are present at phone width (was hidden
  // under the old 880px gate, which swapped to a list-only fallback).
  await expect(page.locator('.pg__svg')).toBeVisible();
  expect(await page.locator('.pg__orb').count()).toBe(11);

  // Zoom controls present.
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();

  // The grouped list is ALSO present beneath the chart (both, by request).
  await expect(page.locator('.pg__list-view')).toBeVisible();

  // No error boundary, no horizontal overflow.
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  expect(overflow).toBe(false);
});

test('zoom in magnifies the chart', async ({ page }) => {
  await buildProfile(page);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  const transform = await page.locator('.pg__pan').evaluate((el) => getComputedStyle(el).transform);
  const scale = Number(transform.match(/matrix\(([^,]+)/)?.[1] ?? '1');
  expect(scale).toBeGreaterThan(1);
});

test('profile introduction leads with birth details and explains the chart in one line', async ({ page }) => {
  await buildProfile(page);

  const header = page.locator('header');
  await expect(header.getByText('Universal Language')).toHaveCount(0);
  await expect(header.getByText(/1990-06-15 at 14:30/)).toBeVisible();
  await expect(header.getByText(
    'This chart connects the elements of your life to the 64 codes, helping you understand their influences more deeply.'
  )).toBeVisible();
  await expect(header.getByRole('link', { name: 'Explore the Gene Keys system to learn more' })).toBeVisible();

  const headingBox = await header.getByRole('heading', { name: 'Your Hologenetic Profile' }).boundingBox();
  const birthBox = await header.getByText(/1990-06-15 at 14:30/).boundingBox();
  expect(birthBox!.y).toBeGreaterThan(headingBox!.y + headingBox!.height);

  const intro = header.locator('[data-profile-introduction]');
  if ((page.viewportSize()?.width ?? 0) >= 880) {
    expect(await intro.evaluate((el) => el.getBoundingClientRect().height)).toBeLessThan(30);
  }
});

test('desktop profile balances the chart between connected path and detail rails', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 880, 'desktop layout only');
  await buildProfile(page);

  const work = page.locator('.pg__work');
  const columns = await work.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' '));
  expect(columns[0]).toBe(columns[2]);

  await expect(page.locator('.pg__rail--path')).toBeVisible();
  await expect(page.locator('.pg__rail--detail')).toBeVisible();
  await expect(page.locator('.pg__rail--detail').getByRole('button', { name: 'Activation' })).toBeVisible();

  await page.locator('.pg__rail--path').getByRole('button', { name: /Evolution/ }).click();
  await expect(page.locator('.pg__rail--detail').getByRole('heading', { name: 'Evolution' })).toBeVisible();
  await expect(page.locator('.pg__rail--detail')).toContainText('The contrast that shapes you');
});
