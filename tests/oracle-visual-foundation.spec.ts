import { expect, test } from '@playwright/test';

const CARD = '/universal-language/22';
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:2222';

async function openReading(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}${CARD}`);
  const entrance = page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });
  try {
    await entrance.waitFor({ state: 'visible', timeout: 2_000 });
    await entrance.click();
  } catch {
    // Quiet previous/next arrivals intentionally skip the entrance.
  }
}

test('uses the Teajia reading type roles and measure', async ({ page }) => {
  await openReading(page);
  const reading = page.locator('[data-reading-prose] p').first();
  await expect(reading).toBeVisible();
  const styles = await reading.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { family: computed.fontFamily, size: parseFloat(computed.fontSize), lineHeight: parseFloat(computed.lineHeight), width: element.getBoundingClientRect().width };
  });
  expect(styles.family).toContain('Lora');
  expect(styles.size).toBeGreaterThanOrEqual(16);
  expect(styles.lineHeight / styles.size).toBeGreaterThanOrEqual(1.78);
  expect(styles.lineHeight / styles.size).toBeLessThanOrEqual(1.82);
  expect(styles.width).toBeLessThanOrEqual(680);
});

test('renders the six systems as one continuous vertical reading', async ({ page }) => {
  await openReading(page);
  const flow = page.locator('[data-oracle-flow]');
  await expect(flow).toBeVisible();
  const layout = await flow.evaluate((element) => {
    const chapters = Array.from(element.querySelectorAll<HTMLElement>('section[data-chapter]'));
    return {
      direction: getComputedStyle(element).flexDirection,
      overflowX: getComputedStyle(element).overflowX,
      snap: getComputedStyle(element).scrollSnapType,
      chapterTops: chapters.map((chapter) => chapter.getBoundingClientRect().top + scrollY),
      chapterCount: chapters.length,
      fits: element.scrollWidth <= element.clientWidth,
    };
  });
  expect(layout.chapterCount).toBe(6);
  expect(layout.direction).toBe('column');
  expect(layout.overflowX).not.toBe('auto');
  expect(layout.snap).toBe('none');
  expect(layout.fits).toBe(true);
  expect(layout.chapterTops).toEqual([...layout.chapterTops].sort((a, b) => a - b));
});

test('pins the reading to Teajia espresso', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await openReading(page);
  const reader = page.locator('.eb-reading').first();
  await expect(reader).toHaveCSS('background-color', 'rgb(20, 16, 11)');
});

test('omits the visible drop cap', async ({ page }) => {
  await openReading(page);
  const initial = page.locator('.ul-dropcap');
  await expect(initial).toHaveCSS('float', 'none');
  const typography = await initial.evaluate((element) => {
    const own = getComputedStyle(element);
    const parent = getComputedStyle(element.parentElement!);
    return { ownSize: own.fontSize, parentSize: parent.fontSize, ownColor: own.color, parentColor: parent.color };
  });
  expect(typography.ownSize).toBe(typography.parentSize);
  expect(typography.ownColor).toBe(typography.parentColor);
});

test('keeps the chart prompt direct and visually subordinate to the hexagram', async ({ page }) => {
  await openReading(page);
  const prompt = page.locator('.ul-hero-box--chart');
  await expect(prompt).toBeVisible();
  await expect(prompt.locator('.ul-hero-box__eyebrow')).toHaveCount(0);
  await expect(prompt.locator('.ul-hero-box__title')).toHaveText('Is this code in your chart?');
  await expect(prompt.locator('.ul-hero-box__line')).toHaveText(
    'See your birth chart and understand where all 64 codes land in the Oracle.',
  );

  const typeScale = await prompt.evaluate((element) => {
    const glyph = element.querySelector<HTMLElement>('.ul-hero-hex__glyph')!;
    const number = element.querySelector<HTMLElement>('.ul-hero-hex__num')!;
    return {
      glyph: parseFloat(getComputedStyle(glyph).fontSize),
      number: parseFloat(getComputedStyle(number).fontSize),
    };
  });
  expect(typeScale.number).toBeLessThanOrEqual(typeScale.glyph * 0.2);
});

test('shows one sticky document progress indicator', async ({ page }) => {
  await openReading(page);
  const nav = page.locator('[data-oracle-progress-nav]');
  const progress = page.getByRole('progressbar', { name: 'Reading progress' });
  await expect(nav).toHaveCount(1);
  await expect(nav).toHaveCSS('position', 'sticky');
  await expect(progress).toHaveAttribute('aria-valuemin', '0');
  await expect(progress).toHaveAttribute('aria-valuemax', '100');
  const systems = nav.getByRole('navigation', { name: 'Jump to system' });
  await expect(systems).toBeVisible();
  await expect(nav.locator('.oracle-reading-progress__inner')).toHaveCount(0);
  await expect(systems.getByRole('button', { name: 'Universal Language' })).toContainText('UL');
  await expect(systems.getByRole('button', { name: 'I Ching' })).toContainText('I Ching');
  await expect(systems.getByRole('button', { name: 'Relations' }).locator('[data-system-icon="connection"]')).toHaveCount(1);
  await systems.getByRole('button', { name: 'Gene Keys' }).click();
  await expect(page.locator('section[data-chapter="genekeys"]')).toBeInViewport();
  await expect(page.getByRole('navigation', { name: 'Reading by system' })).toBeHidden();
});

test('matches the system rail typography to the primary navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openReading(page);
  const rail = page.locator('.oracle-reading-progress__jumps');
  const ul = rail.getByRole('button', { name: 'Universal Language' });
  const primaryNavLink = page.locator('.site-bar-root').getByRole('link', { name: 'Deck' });

  await expect(rail).toBeVisible();
  const desktop = await ul.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
      fontFamily: styles.fontFamily,
      fontSize: parseFloat(styles.fontSize),
    };
  });
  const primary = await primaryNavLink.evaluate((element) => {
    const styles = getComputedStyle(element);
    return { fontFamily: styles.fontFamily, fontSize: parseFloat(styles.fontSize) };
  });
  expect(desktop.height).toBeGreaterThanOrEqual(60);
  expect(desktop.fontFamily).toBe(primary.fontFamily);
  expect(desktop.fontSize).toBeLessThanOrEqual(primary.fontSize);
  const desktopButtonGaps = await rail.getByRole('button').evaluateAll((buttons) => {
    const rects = buttons.map((button) => button.getBoundingClientRect());
    return rects.slice(1).map((rect, index) => Math.round(rect.left - rects[index].right));
  });
  expect(desktopButtonGaps.every((gap) => gap >= 3 && gap <= 5)).toBe(true);

  const progressTrack = page.locator('.oracle-reading-progress__track');
  const trackPosition = await progressTrack.evaluate((element) => {
    const track = element.getBoundingClientRect();
    const railBounds = element.parentElement!.getBoundingClientRect();
    return { distanceFromTop: Math.abs(track.top - railBounds.top), distanceFromBottom: Math.abs(track.bottom - railBounds.bottom) };
  });
  expect(trackPosition.distanceFromTop).toBeLessThan(trackPosition.distanceFromBottom);

  await page.setViewportSize({ width: 320, height: 760 });
  await expect(rail).toBeVisible();
  expect(await page.locator('html').evaluate((element) => element.scrollWidth)).toBe(320);
  const mobile = await ul.evaluate((element) => element.getBoundingClientRect().width);
  expect(mobile).toBeLessThan(desktop.width);
  const labelsFit = await rail.getByRole('button').evaluateAll((buttons) => buttons.every((button) => button.scrollWidth <= button.clientWidth));
  expect(labelsFit).toBe(true);
  const mobileRail = await rail.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
  expect(mobileRail.scrollWidth).toBeGreaterThan(mobileRail.clientWidth);
});

test('uses tonal chapter shifts and inset I Ching editorial panels', async ({ page }) => {
  await openReading(page);
  const chapters = page.locator('section[data-chapter]');
  const backgrounds = await chapters.evaluateAll((elements) => elements.map((element) => getComputedStyle(element).backgroundColor));
  expect(new Set(backgrounds).size).toBeGreaterThanOrEqual(3);

  const panel = page.locator('section[data-chapter="iching"] .ul-ji > div').first();
  await panel.scrollIntoViewIfNeeded();
  const geometry = await panel.evaluate((element) => {
    const styles = getComputedStyle(element);
    const parent = element.parentElement!.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return {
      insetLeft: rect.left - parent.left,
      insetRight: parent.right - rect.right,
      paddingLeft: parseFloat(styles.paddingLeft),
      paddingRight: parseFloat(styles.paddingRight),
      borderLeft: parseFloat(styles.borderLeftWidth),
    };
  });
  expect(geometry.insetLeft).toBeGreaterThanOrEqual(8);
  expect(geometry.insetRight).toBeGreaterThanOrEqual(8);
  expect(geometry.paddingLeft).toBeGreaterThanOrEqual(24);
  expect(geometry.paddingRight).toBeGreaterThanOrEqual(24);
  expect(geometry.borderLeft).toBe(1);
});

test('keeps an inward-aligned previous and next navigator fixed at the bottom', async ({ page }) => {
  await openReading(page);
  const footer = page.locator('[data-oracle-neighbor-footer]');
  const previous = footer.getByRole('link', { name: 'Previous hexagram: Code 21, Beyond Binary' });
  const next = footer.getByRole('link', { name: 'Next hexagram: Code 23, Beneath the Surface' });

  await expect(footer).toBeAttached();
  await expect(footer).toHaveCSS('position', 'fixed');
  await expect(previous).toHaveAttribute('href', '/universal-language/21');
  await expect(next).toHaveAttribute('href', '/universal-language/23');
  await expect(previous).toContainText('Code 21');
  await expect(previous).toContainText('Beyond Binary');
  await expect(previous).toHaveCSS('justify-content', 'flex-end');
  await expect(previous).toHaveCSS('text-align', 'right');
  await expect(next).toContainText('Code 23');
  await expect(next).toContainText('Beneath the Surface');
  await expect(next).toHaveCSS('justify-content', 'flex-start');
  await expect(next).toHaveCSS('text-align', 'left');

});

test('keeps the desktop title on one line and prose panels narrow', async ({ page }) => {
  await openReading(page);
  await page.setViewportSize({ width: 1148, height: 900 });
  const title = page.locator('h1.ul-title-desktop');
  const titleLines = await title.evaluate((element) => {
    const style = getComputedStyle(element);
    return element.getBoundingClientRect().height / parseFloat(style.lineHeight);
  });
  expect(titleLines).toBeLessThan(1.2);

  const panel = page.locator('[data-gk]').first();
  const panelWidth = await panel.evaluate((element) => element.getBoundingClientRect().width);
  expect(panelWidth).toBeLessThanOrEqual(680);
});

test('reveals content immediately for reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openReading(page);
  const reveals = page.locator('[data-oracle-reveal]');
  expect(await reveals.count()).toBeGreaterThan(0);
  for (const reveal of await reveals.all()) {
    await expect(reveal).toHaveCSS('opacity', '1');
    await expect(reveal).toHaveCSS('transform', 'none');
  }
});

test('keeps below-fold sections armed until they approach the viewport', async ({ page }) => {
  await openReading(page);
  await expect(page.locator('section[data-chapter="ul"]')).toBeVisible();
  const blocks = page.locator('section[data-chapter="ul"] [data-oracle-reveal]');
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
