import { expect, test, type Page } from './fixtures';

async function openDelayedReading(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  // Real manuscript request, held until the reader deliberately chooses a tab.
  await page.route('**/oracle/cards/22.md?*', async route => { await held; await route.continue(); });
  await page.addInitScript(() => sessionStorage.setItem('eb-skip-entrance', '1'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/universal-language/22');
  await expect(page.locator('.eb-reading').first()).toBeVisible();
  return { release, errors };
}

async function assertHealthy(page: Page, errors: string[]) {
  expect(errors).toEqual([]);
  await expect(page.getByRole('heading', { name: 'System Error', exact: true })).toHaveCount(0);
  await expect(page.getByText('Something went wrong', { exact: false })).toHaveCount(0);
  await expect(page.getByText('page not found', { exact: false })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)).toBe(true);
}

test.beforeEach(async ({ context }) => {
  await context.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  await context.route(/^https:\/\//, route => route.abort());
});

test('a chosen system stays selected when its delayed manuscript arrives', async ({ page }, testInfo) => {
  const { release, errors } = await openDelayedReading(page);
  const nav = page.locator('.card-reading [data-nav="genekeys"]');
  await expect(nav).toBeVisible();
  await expect(nav).toBeEnabled();
  await nav.click();
  release();
  await expect(page.locator('[data-gk="shadow"] > div > p').first()).not.toBeEmpty();
  await expect(nav).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('[data-chapter="genekeys"]')).toBeInViewport();
  await expect(nav).toBeFocused();
  await assertHealthy(page, errors);
  await page.screenshot({ path: testInfo.outputPath('chosen-system.png') });
});

test('the latest tab wins and manual scrolling releases its layout anchor', async ({ page }, testInfo) => {
  const { release, errors } = await openDelayedReading(page);
  await page.locator('.card-reading [data-nav="genekeys"]').click();
  const body = page.locator('.card-reading [data-nav="body"]');
  await body.click();
  release();
  await expect(page.locator('[data-gk="shadow"] > div > p').first()).not.toBeEmpty();
  await expect(body).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('[data-chapter="body"]')).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath('latest-system.png') });

  const scroll = page.locator('.card-reading [data-scroll]');
  const bounds = await scroll.boundingBox();
  if (!bounds) throw new Error('The reader scroll area is missing');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, -100000);
  const ul = page.locator('.card-reading [data-nav="ul"]');
  await expect(ul).toHaveAttribute('aria-current', 'true');
  // A later content-size change must not drag a freely scrolling reader back.
  await page.locator('.card-reading__designed-header').evaluate(async element => {
    (element as HTMLElement).style.minHeight = `${element.getBoundingClientRect().height + 400}px`;
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
  await expect(ul).toHaveAttribute('aria-current', 'true');
  await expect(body).toHaveAttribute('aria-current', 'false');
  await assertHealthy(page, errors);
  await page.screenshot({ path: testInfo.outputPath('manual-scroll.png') });
});

test('a mounted reader observes the new card after browser navigation', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/oracle/cards/23.md?*', async route => { await held; await route.continue(); });
  await page.goto('/universal-language/22');
  await expect(page.locator('[data-gk="shadow"] > div > p').first()).not.toBeEmpty();
  const geneKeys = page.locator('.card-reading [data-nav="genekeys"]');
  await geneKeys.click();
  await expect(geneKeys).toHaveAttribute('aria-current', 'true');
  // Exercise the browser-history route on the mounted shell, not a page reload
  // or a test-only React remount. Keep the exact DOM node as custody evidence.
  await page.locator('.card-reading').evaluate(element => {
    (window as any).__readerBeforeNavigation = element;
    history.pushState({}, '', '/universal-language/23');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page).toHaveURL(/\/universal-language\/23$/);
  await expect(page.locator('.card-reading__designed-header')).toContainText('Universal Language 23');
  expect(await page.locator('.card-reading').evaluate(element => element === (window as any).__readerBeforeNavigation)).toBe(true);
  const body = page.locator('.card-reading [data-nav="body"]');
  await body.click();
  await expect(body).toHaveAttribute('aria-current', 'true');
  // Model a response arriving after the 500ms navigation animation and the
  // initial 1400ms settling timer, so observing the new chapters is necessary.
  await page.waitForTimeout(1600);
  const previousText = await page.locator('[data-gk="shadow"] > div > p').first().textContent();
  release();
  await expect(page.locator('[data-gk="shadow"] > div > p').first()).not.toHaveText(previousText ?? '');
  await expect(body).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('[data-chapter="body"]')).toBeInViewport();
  await assertHealthy(page, errors);
  await page.screenshot({ path: testInfo.outputPath('new-card-system.png') });
});
