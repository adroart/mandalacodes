/* The card reading's mobile shell is a fixed frame: the site bar at the top,
   the lens rail sticky under it, the reading scrolling between them and the
   five-slot bar pinned to the bottom edge. These cover the three ways that
   frame came apart on an iPhone — a bar in its own colour cutting across the
   bottom of the page, a bar floating above the bottom edge, and a lens rail
   that vanished under the site bar after a QR arrival. */
import { expect, test, type Page } from '@playwright/test';

const CARD = '/universal-language/22';
const PHONE = { width: 390, height: 844 };

const entrance = (page: Page) =>
  page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });

async function openReading(page: Page, search = '') {
  await page.setViewportSize(PHONE);
  await page.goto(`${CARD}${search}`);
  try {
    await entrance(page).waitFor({ state: 'visible', timeout: 2_000 });
    await entrance(page).click();
    await expect(page.locator('[data-oracle-choreography="reading"]')).toBeAttached({ timeout: 2_500 });
  } catch {
    // A direct link opens quietly; there is no entrance to dismiss.
  }
  await expect(page.locator('[data-oracle-flow]')).toBeAttached();
}

test('the reading bar carries the page ground rather than a colour of its own', async ({ page }) => {
  await openReading(page);
  const surfaces = await page.evaluate(() => {
    const bar = document.querySelector('.card-reading--mobile > section > div > footer')!;
    const shell = document.querySelector('.card-reading')!;
    return {
      bar: getComputedStyle(bar).backgroundColor,
      ground: getComputedStyle(shell).backgroundColor,
    };
  });
  expect(surfaces.bar).toBe(surfaces.ground);
});

test('the reading bar sits on the bottom edge of the viewport', async ({ page }) => {
  await openReading(page);
  const frame = await page.evaluate(() => {
    const panel = document.querySelector('.card-reading--mobile > section > div')!;
    const bar = document.querySelector('.card-reading--mobile > section > div > footer')!;
    return {
      panelHeight: panel.getBoundingClientRect().height,
      barBottom: bar.getBoundingClientRect().bottom,
      viewport: window.innerHeight,
      docScroll: document.documentElement.scrollHeight,
    };
  });
  expect(frame.panelHeight).toBeCloseTo(frame.viewport, 0);
  expect(frame.barBottom).toBeCloseTo(frame.viewport, 0);
  // The shell IS the screen: nothing may scroll behind it and carry it off.
  expect(frame.docScroll).toBeLessThanOrEqual(frame.viewport);
});

test('the shell follows the viewport when the browser toolbar changes its height', async ({ page }) => {
  await openReading(page);
  await page.setViewportSize({ width: PHONE.width, height: PHONE.height - 58 });
  await expect
    .poll(async () => page.evaluate(() => {
      const bar = document.querySelector('.card-reading--mobile > section > div > footer')!;
      return Math.round(window.innerHeight - bar.getBoundingClientRect().bottom);
    }))
    .toBe(0);
});

test('a QR arrival never collapses the top space the lens rail sits in', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await page.goto(`${CARD}?ref=qr`);
  await expect(entrance(page)).toBeVisible();

  // The entrance hides the site bar outright. Measuring it at zero and
  // publishing that put the rail at y=0, underneath the bar it should hang
  // from — the reading then scrolled under the bar with no rail in sight.
  const duringEntrance = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--nav-height').trim());
  expect(parseFloat(duringEntrance)).toBeGreaterThan(0);

  await entrance(page).click();
  await expect(page.locator('[data-oracle-choreography="reading"]')).toBeAttached({ timeout: 2_500 });

  const chrome = await page.evaluate(() => {
    const bar = document.querySelector('.site-bar-root')!.getBoundingClientRect();
    const rail = document.querySelector('[data-jumpbar]')!.getBoundingClientRect();
    return { barBottom: bar.bottom, railTop: rail.top, railHeight: rail.height };
  });
  expect(chrome.railHeight).toBeGreaterThan(0);
  expect(chrome.railTop).toBeGreaterThanOrEqual(chrome.barBottom - 1);
});

test('the lens rail stays pinned under the site bar at any scroll depth', async ({ page }) => {
  await openReading(page);
  await page.evaluate(() => { document.querySelector('[data-scroll]')!.scrollTop = 2_400; });
  await page.waitForTimeout(400);

  const chrome = await page.evaluate(() => {
    const bar = document.querySelector('.site-bar-root')!.getBoundingClientRect();
    const rail = document.querySelector('[data-jumpbar]')!.getBoundingClientRect();
    const scroller = document.querySelector('[data-scroll]')!;
    return {
      barBottom: bar.bottom,
      railTop: rail.top,
      scrollTop: scroller.scrollTop,
      /* Not in the CSSStyleDeclaration type — it is a WebKit-only property, and
         a Chromium run reports it empty. */
      momentum: getComputedStyle(scroller).getPropertyValue('-webkit-overflow-scrolling'),
    };
  });
  expect(chrome.scrollTop).toBeGreaterThan(1_000);
  expect(chrome.railTop).toBeCloseTo(chrome.barBottom, 0);
  // `touch` puts WebKit on the legacy scrolling path, where the sticky rail is
  // only reconciled once a flick settles.
  expect(chrome.momentum).not.toBe('touch');
});
