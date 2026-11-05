import { test, expect } from './fixtures';

test('numeric card routes reject suffixes and retain canonical and legacy valid arrivals', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/api/oracle/invocations/**/live', route => route.fulfill({ status: 204 }));

  for (const number of ['1junk', '1.5', '1e1', '65']) {
    await page.goto(`/universal-language/${number}`);
    await expect(page.getByText('This card has not yet arrived.', { exact: true })).toBeVisible();
    await expect(page.locator('[data-oracle-reading-prose]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)).toBe(false);
  }
  await page.screenshot({ path: info.outputPath('invalid-card-route.png') });

  for (const path of ['/universal-language/1', '/universal-language/064', '/oracle/universal-language/33']) {
    await page.goto(path);
    await expect(page.locator('[data-oracle-reading-prose]').first()).toBeVisible();
    await expect(page.getByText('This card has not yet arrived.', { exact: true })).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await expect(page.locator('body')).not.toContainText('Page not found');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)).toBe(false);
  }
  expect(errors).toEqual([]);
});
