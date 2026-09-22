import { expect, test } from './fixtures';

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
  expect(styles.family).toContain('Iowan Old Style Web');
  expect(styles.size).toBeGreaterThanOrEqual(16);
  expect(styles.lineHeight / styles.size).toBeGreaterThanOrEqual(1.78);
  expect(styles.lineHeight / styles.size).toBeLessThanOrEqual(1.82);
  expect(styles.width).toBeLessThanOrEqual(680);
});

/* Relations is paused (2026-09-16): the panel stays in the DOM but is hidden and
   drops out of the jump bars while RELATIONS_PANEL_ENABLED is false in
   components/oracle/eb/generated/EBReading.host.tsx. The page carries the
   state as data-relations on .eb-reading, so the specs read it rather than
   importing the flag. */
async function relationsOn(page: import('@playwright/test').Page): Promise<boolean> {
  return (await page.locator('.eb-reading[data-relations]').first().getAttribute('data-relations')) !== 'off';
}

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
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    };
  });
  expect(layout.chapterCount).toBe(6); // the paused Relations section stays in the DOM, hidden
  expect(layout.direction).toBe('column');
  expect(layout.overflowX).not.toBe('auto');
  expect(layout.snap).toBe('none');
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  expect(layout.chapterTops).toEqual([...layout.chapterTops].sort((a, b) => a - b));
});

for (const palette of [
  {
    mode: 'light',
    reader: 'rgb(221, 211, 189)',
    main: 'rgb(243, 239, 231)',
    recess: 'rgb(230, 221, 201)',
    shell: 'rgb(243, 239, 231)',
    rail: 'rgb(234, 228, 215)',
    title: 'rgb(39, 34, 25)',
  },
  {
    mode: 'dark',
    reader: 'rgb(16, 13, 9)',
    main: 'rgb(20, 16, 11)',
    recess: 'rgb(17, 14, 10)',
    shell: 'rgb(20, 16, 11)',
    rail: 'rgb(25, 21, 16)',
    title: 'rgb(237, 228, 212)',
  },
] as const) {
  test(`uses the ${palette.mode === 'light' ? 'Daybook' : 'Nightfall'} reading palette in ${palette.mode} mode`, async ({ page }) => {
    await page.addInitScript((mode) => {
      localStorage.setItem('dark-mode', mode === 'dark' ? 'true' : 'false');
      sessionStorage.setItem('eb-skip-entrance', '1');
    }, palette.mode);
    await openReading(page);

    const reader = page.locator('.eb-reading[data-oracle-reader]');
    const mainChapter = page.locator('section[data-chapter="ul"]');
    const recessedChapter = page.locator('section[data-chapter="iching"]');
    const shell = page.locator('.card-reading > section > div');
    const rail = page.locator('.card-reading [data-jumpbar]');
    const title = page.locator('.card-reading__designed-header h1');
    await expect(reader).toHaveCSS('background-color', palette.reader);
    await expect(mainChapter).toHaveCSS('background-color', palette.main);
    await expect(recessedChapter).toHaveCSS('background-color', palette.recess);
    await expect(shell).toHaveCSS('background-color', palette.shell);
    await expect(rail).toHaveCSS('background-color', palette.rail);
    await expect(title).toHaveCSS('color', palette.title);
  });
}

test('keeps the artwork clear of the mobile system rail on the same surface', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReading(page);

  const rail = page.locator('.card-reading--mobile [data-jumpbar]');
  const artwork = page.locator('.card-reading--mobile [data-artparallax]').locator('..');
  const layout = await artwork.evaluate((element) => {
    const rail = document.querySelector<HTMLElement>('.card-reading--mobile [data-jumpbar]');
    if (!rail) throw new Error('System rail is missing');
    return {
      gap: element.getBoundingClientRect().top - rail.getBoundingClientRect().bottom,
      artworkBackground: getComputedStyle(element).backgroundColor,
    };
  });

  await expect(rail).toBeVisible();
  expect(layout.gap).toBeGreaterThanOrEqual(0);
  expect(layout.artworkBackground).toBe('rgb(20, 16, 11)');
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

test('asks the chart question once, centred under the header', async ({ page }) => {
  await openReading(page);
  const prompt = page.locator('.ul-chart-row .ypc--out');
  await expect(prompt).toBeVisible();
  await expect(prompt.locator('.ypc__title')).toHaveText('Is this code in your chart?');

  // The design file carries a fixed chart link of its own. The live callout
  // supersedes it on every layout, so exactly one question is on screen.
  await expect(page.locator('[data-chart-cta]:visible')).toHaveCount(0);

  const placement = await prompt.evaluate((element) => {
    const row = element.closest('.ul-chart-row')!;
    const box = element.getBoundingClientRect();
    const seat = row.getBoundingClientRect();
    return {
      offCentre: Math.abs((box.left + box.right) / 2 - (seat.left + seat.right) / 2),
      widthRatio: box.width / seat.width,
    };
  });
  // Centred in its seat, and sized to its words rather than spanning them.
  expect(placement.offCentre).toBeLessThanOrEqual(1);
  expect(placement.widthRatio).toBeLessThan(0.9);
});

test('offers keeping the code as the quieter second line', async ({ page }) => {
  await openReading(page);
  const save = page.locator('.ul-chart-row .stc__btn');
  await expect(save).toHaveText('Save this code');
  const sizes = await page.locator('.ul-chart-row').evaluate((row) => ({
    question: parseFloat(getComputedStyle(row.querySelector('.ypc__title')!).fontSize),
    save: parseFloat(getComputedStyle(row.querySelector('.stc__btn')!).fontSize),
  }));
  expect(sizes.save).toBeLessThan(sizes.question);
});

test('removes the chart prompt as soon as a birth moment is added', async ({ page }) => {
  await openReading(page);
  // The generated reader keeps a desktop and mobile header mounted together;
  // invoke the chart action directly so the test follows the shared behavior.
  await page.locator('.ul-chart-row .ypc--out').evaluate((button: HTMLButtonElement) => button.click());
  await page.fill('#profile-date', '1990-06-15');
  await page.fill('#profile-time', '1430');
  await page.fill('#profile-place', 'Jakarta');
  await page.locator('.profile-form__suggestion').first().click();
  await page.getByRole('button', { name: 'Build my profile' }).click();

  await expect(page.getByRole('heading', { name: 'Your chart is lit' })).toBeVisible();
  await expect(page.locator('.ypc--out')).toHaveCount(0);
});

test('does not ask signed-in readers whether the code is in their chart', async ({ page }) => {
  const now = new Date().toISOString();
  await page.route('**/api/auth/get-session', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      session: {
        id: 'session-reader',
        userId: 'reader-1',
        token: 'test-session-token',
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      },
      user: {
        id: 'reader-1',
        name: 'Reader',
        email: 'reader@example.com',
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    }),
  }));
  await page.route('**/api/auth/sync-user', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/profile/get', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      inputs: {
        date: '1990-06-15',
        time: '14:30',
        place: { label: 'Jakarta, Indonesia', lat: -6.2146, lng: 106.8451, tzId: 'Asia/Jakarta' },
      },
      computed: { lifesWork: { gate: 22, line: 3 } },
      updatedAt: now,
    }),
  }));

  await openReading(page);

  await expect(page.locator('.ypc--out')).toHaveCount(0);
  await expect(page.getByText("Your Life's Work · Line 3")).toBeVisible();
});

test('shows one sticky system rail with visual document progress', async ({ page }) => {
  await openReading(page);
  const nav = page.locator('.card-reading--mobile [data-jumpbar]');
  const progress = page.locator('.card-reading--mobile [data-progressfill-h]');
  await expect(nav).toHaveCount(1);
  await expect(nav).toHaveAttribute('aria-label', 'Reading by system');
  await expect(nav).toHaveCSS('position', 'sticky');
  await expect(progress).toHaveCount(1);
  await expect(nav.getByRole('progressbar', { name: 'Reading progress' })).toHaveCount(1);
  await expect(progress).toHaveAttribute('aria-valuemin', '0');
  await expect(progress).toHaveAttribute('aria-valuemax', '100');
  await expect(progress).toHaveAttribute('aria-valuenow', '0');
  const systems = nav.locator('[data-nav]');
  await expect(systems).toHaveCount(6);
  await nav.locator('[data-nav="genekeys"]').click();
  await expect(page.locator('section[data-chapter="genekeys"]')).toBeInViewport();
  await expect(progress).toBeVisible();
  expect(Number(await progress.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
  await expect(page.getByRole('navigation', { name: 'Reading by system' })).toBeVisible();
});

test('keeps the iPhone reading marker locked to touch scroll without catch-up', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReading(page);

  const scroller = page.locator('.card-reading--mobile [data-scroll]');
  await expect(scroller).toHaveCount(1);

  const marker = await scroller.evaluate(async (element) => {
    const reader = element.closest<HTMLElement>('[data-reader]')!;
    const fill = reader.querySelector<HTMLElement>('[data-progressfill-h]')!;
    const comet = reader.querySelector<HTMLElement>('[data-comet]')!;
    const maxScroll = element.scrollHeight - element.clientHeight;
    element.scrollTop = maxScroll * 0.42;
    element.dispatchEvent(new Event('scroll'));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const readerBounds = reader.getBoundingClientRect();
    const fillBounds = fill.getBoundingClientRect();
    const cometBounds = comet.getBoundingClientRect();
    const expectedX = (element.scrollTop / maxScroll) * readerBounds.width;

    return {
      expectedX,
      fillX: fillBounds.right - readerBounds.left,
      cometX: cometBounds.left + cometBounds.width / 2 - readerBounds.left,
      fillTransition: getComputedStyle(fill).transitionDuration,
      cometTransition: getComputedStyle(comet).transitionDuration,
    };
  });

  expect(Math.abs(marker.fillX - marker.expectedX)).toBeLessThanOrEqual(2);
  expect(Math.abs(marker.cometX - marker.expectedX)).toBeLessThanOrEqual(2);
  expect(marker.fillTransition).toBe('0s');
  expect(marker.cometTransition).toBe('0s');
});

test('matches the system rail typography to the primary navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openReading(page);
  const rail = page.locator('.card-reading [data-jumpbar]');
  const ul = rail.locator('[data-nav="ul"]');
  const primaryNavLink = page.locator('.card-reading--desktop header nav').getByRole('link', { name: 'Deck' });

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
  expect(desktop.height).toBeGreaterThanOrEqual(44);
  expect(desktop.fontFamily).toContain('Iowan');
  expect(desktop.fontSize).toBeLessThanOrEqual(primary.fontSize);
  const desktopButtonCenters = await rail.locator('[data-nav]').evaluateAll((buttons) => {
    const rects = buttons.map((button) => button.getBoundingClientRect());
    return rects.map((rect) => rect.left + rect.width / 2);
  });
  expect(desktopButtonCenters.slice(1).every((center, index) => center > desktopButtonCenters[index])).toBe(true);
  const desktopButtonPadding = await ul.evaluate((element) => parseFloat(getComputedStyle(element).paddingInlineStart));
  expect(desktopButtonPadding).toBeGreaterThanOrEqual(9);

  await page.setViewportSize({ width: 320, height: 760 });
  await expect(rail).toBeVisible();
  expect(await page.locator('html').evaluate((element) => element.scrollWidth)).toBe(320);
  const mobile = await ul.evaluate((element) => element.getBoundingClientRect().width);
  expect(mobile).toBeLessThan(desktop.width);
  const labelsFit = await rail.getByRole('button').evaluateAll((buttons) => buttons.every((button) => button.scrollWidth <= button.clientWidth));
  expect(labelsFit).toBe(true);
  const mobileRail = await rail.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
  expect(mobileRail.scrollWidth).toBeLessThanOrEqual(mobileRail.clientWidth);
});

test('iOS Oracle surface uses exact warm-dark chapter colors and inset I Ching editorial panels', async ({ page }) => {
  await openReading(page);
  const chapters = page.locator('section[data-chapter]');
  const backgrounds = await chapters.evaluateAll((elements) => Object.fromEntries(
    elements.map((element) => [element.getAttribute('data-chapter'), getComputedStyle(element).backgroundColor]),
  ));
  expect(backgrounds).toEqual({
    ul: 'rgb(20, 16, 11)',
    iching: 'rgb(17, 14, 10)',
    genekeys: 'rgb(23, 18, 12)',
    humandesign: 'rgb(18, 15, 11)',
    body: 'rgb(24, 19, 13)',
    relations: 'rgb(16, 13, 9)',
  });

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

test('iOS Oracle surface uses the fine real-paper texture after entry', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}${CARD}?ref=qr`);
  const ritual = page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });
  await expect(ritual).toBeVisible();
  await ritual.click();
  await expect(page.locator('[data-oracle-choreography="reading"]')).toBeAttached({ timeout: 2_500 });

  const grain = page.locator('[data-oracle-grain]');
  await expect(grain).toHaveCount(1);
  await expect(grain).toBeVisible();
  const texture = await grain.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      backgroundImage: styles.backgroundImage,
      backgroundRepeat: styles.backgroundRepeat,
      backgroundSize: styles.backgroundSize,
      mixBlendMode: styles.mixBlendMode,
      opacity: Number.parseFloat(styles.opacity),
    };
  });
  expect(texture.backgroundImage).toContain('/oracle/oracle-paper-fine.webp');
  expect(texture.backgroundRepeat).toBe('repeat');
  expect(texture.backgroundSize).toBe('768px 768px');
  expect(texture.mixBlendMode).toBe('screen');
  expect(texture.opacity).toBeGreaterThanOrEqual(0.33);
  expect(texture.opacity).toBeLessThanOrEqual(0.34);
  await expect(page.locator('[data-oracle-generated-grain]')).toBeHidden();
  await expect(page.locator('[data-reader] > svg')).toBeHidden();
});

test('iOS Oracle surface keeps paper restrained in light mode', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('dark-mode', 'false');
    sessionStorage.setItem('eb-skip-entrance', '1');
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}${CARD}`);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  const grain = page.locator('[data-oracle-grain]');
  await expect(grain).toBeVisible();
  const texture = await grain.evaluate((element) => {
    const styles = getComputedStyle(element);
    return { mixBlendMode: styles.mixBlendMode, opacity: Number.parseFloat(styles.opacity) };
  });
  expect(texture.mixBlendMode).toBe('multiply');
  expect(texture.opacity).toBeGreaterThanOrEqual(0.15);
  expect(texture.opacity).toBeLessThanOrEqual(0.16);
});

test('iOS Oracle surface moves its paper texture with the internal scroller', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReading(page);

  const scroller = page.locator('.card-reading--mobile [data-scroll]');
  const grain = page.locator('[data-oracle-grain="reading"]');
  await expect(scroller).toHaveCount(1);
  await expect(grain).toHaveCount(1);
  await expect(grain).toHaveCSS('position', 'fixed');
  await expect(grain).toHaveCSS('background-repeat', 'repeat');
  await expect(grain).toHaveCSS('background-size', '768px 768px');

  const movement = await scroller.evaluate(async (element) => {
    const paper = document.querySelector<HTMLElement>('[data-oracle-grain="reading"]')!;
    const before = Number.parseFloat(getComputedStyle(paper).backgroundPositionY);
    const distance = Math.min(900, element.scrollHeight - element.clientHeight);
    element.scrollTop = distance;
    element.dispatchEvent(new Event('scroll'));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const after = Number.parseFloat(getComputedStyle(paper).backgroundPositionY);
    return {
      distance,
      travelled: before - after,
    };
  });

  expect(Math.abs(movement.travelled - movement.distance)).toBeLessThanOrEqual(2);
});

test('keeps the reading action bar fixed at the bottom', async ({ page }) => {
  await openReading(page);
  const shell = page.locator('.card-reading--mobile > section > div');
  const footer = shell.locator('> footer');

  await expect(footer).toBeVisible();
  await expect(footer).toHaveCSS('position', 'absolute');
  await expect(footer.locator('[data-bar-tab]')).toHaveCount(5);
  await expect(footer.locator('[data-bar-tab="deck"]')).toContainText('The 64');
  for (const [tab, href] of [
    ['family', '/family'],
    ['forme', '/profile'],
    ['deck', '/universal-language'],
    ['piece', 'https://adrianrasmussen.com/creations/UL-119?from=mandalacodes&card=22'],
    ['share', '#share'],
  ] as const) {
    const action = footer.locator(`[data-bar-tab="${tab}"]`);
    await expect(action).toBeVisible();
    await expect(action).toHaveAttribute('href', href);
  }
  expect(await footer.locator('[data-bar-tab="share"]').evaluate((link: HTMLAnchorElement) => `${link.pathname}${link.hash}`))
    .toBe('/universal-language/22#share');
  const bottoms = await shell.evaluate((element) => ({
    shell: element.getBoundingClientRect().bottom,
    footer: element.querySelector('footer')!.getBoundingClientRect().bottom,
  }));
  expect(Math.abs(bottoms.shell - bottoms.footer)).toBeLessThanOrEqual(1);
});

test('uses the full padded reading measure on phones', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReading(page);

  const prose = page.locator('section[data-chapter="ul"] > div > div[style*="flex-direction: column"] > p').first();
  const geometry = await prose.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      width: bounds.width,
      insetLeft: bounds.left,
      insetRight: innerWidth - bounds.right,
    };
  });

  expect(geometry.width).toBeGreaterThanOrEqual(338);
  expect(geometry.width).toBeLessThanOrEqual(344);
  expect(geometry.insetLeft).toBeGreaterThanOrEqual(20);
  expect(geometry.insetLeft).toBeLessThanOrEqual(28);
  expect(geometry.insetRight).toBeGreaterThanOrEqual(20);
  expect(geometry.insetRight).toBeLessThanOrEqual(28);
  expect(Math.abs(geometry.insetLeft - geometry.insetRight)).toBeLessThanOrEqual(1);
});

test('keeps the desktop title on one line and prose panels narrow', async ({ page }) => {
  await openReading(page);
  await page.setViewportSize({ width: 1148, height: 900 });
  const title = page.locator('.card-reading--desktop .card-reading__designed-header h1');
  const titleLines = await title.evaluate((element) => {
    const style = getComputedStyle(element);
    return element.getBoundingClientRect().height / parseFloat(style.lineHeight);
  });
  expect(titleLines).toBeLessThan(1.2);

  const chapterWidth = await page.locator('section[data-chapter="ul"] > div').first()
    .evaluate((element) => element.getBoundingClientRect().width);
  expect(chapterWidth).toBeLessThanOrEqual(680);

  const withRelations = await relationsOn(page);
  const proseSelectors = [
    { chapter: 'ul', selector: 'section[data-chapter="ul"] [data-oracle-reading-prose] > p' },
    { chapter: 'iching', selector: 'section[data-chapter="iching"] div[style*="flex-direction: column"] > p' },
    { chapter: 'genekeys', selector: 'section[data-chapter="genekeys"] [data-gk] div[style*="flex-direction: column"] > p' },
    { chapter: 'humandesign', selector: 'section[data-chapter="humandesign"] div[style*="flex-direction: column"] > p' },
    { chapter: 'body', selector: 'section[data-chapter="body"] div[style*="flex-direction: column"] > p' },
  ];

  for (const { chapter, selector } of proseSelectors) {
    const paragraphs = page.locator(selector);
    expect(await paragraphs.count(), `${chapter} should contain long-form prose`).toBeGreaterThan(0);
    const geometry = await paragraphs.first().evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      parentWidth: element.parentElement!.getBoundingClientRect().width,
    }));
    expect(geometry.width, `${chapter} prose should fill its direct parent`).toBeGreaterThanOrEqual(geometry.parentWidth * 0.9);
  }

  if (withRelations) {
    const relations = page.locator('section[data-chapter="relations"] > div > p').first();
    await expect(relations).toBeVisible();
    const style = await relations.evaluate((element) => ({
      width: element.getBoundingClientRect().width,
      fontStyle: getComputedStyle(element).fontStyle,
    }));
    expect(style.width).toBeLessThanOrEqual(680);
    expect(style.fontStyle).toBe('normal');
  }
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

test('keeps all reading content visible without IntersectionObserver', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'IntersectionObserver', { configurable: true, value: undefined });
  });
  await openReading(page);

  const reveals = page.locator('[data-oracle-reveal]');
  expect(await reveals.count()).toBeGreaterThan(0);
  for (const reveal of await reveals.all()) {
    await expect(reveal).toHaveCSS('opacity', '1');
    await expect(reveal).toHaveCSS('transform', 'none');
  }
});

test('reveals Oracle prose as individual authored beats', async ({ page }) => {
  await openReading(page);
  const prose = page.locator('[data-oracle-reading-prose]');
  const paragraphs = prose.locator(':scope > p');
  expect(await paragraphs.count()).toBeGreaterThan(1);

  for (const paragraph of await paragraphs.all()) {
    await expect(paragraph).toHaveAttribute('data-oracle-reveal', '');
  }
  await expect(prose).not.toHaveAttribute('data-oracle-reveal', '');

  const laterSystemParagraphs = page.locator([
    'section[data-chapter="iching"] div[style*="flex-direction: column"] > p',
    'section[data-chapter="genekeys"] [data-gk] div[style*="flex-direction: column"] > p',
    'section[data-chapter="humandesign"] div[style*="flex-direction: column"] > p',
    'section[data-chapter="body"] div[style*="flex-direction: column"] > p',
    ...((await relationsOn(page)) ? ['section[data-chapter="relations"] div[style*="flex-direction: column"] > p'] : []),
  ].join(','));
  expect(await laterSystemParagraphs.count()).toBeGreaterThan(5);
  for (const paragraph of await laterSystemParagraphs.all()) {
    await expect(paragraph).toHaveAttribute('data-oracle-reveal', '');
  }
});

test('arms invocation blocks that arrive after the reading observer', async ({ page }) => {
  await page.route('**/api/oracle/invocations/22/live', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        title: 'A late invocation',
        versionNumber: 1,
        blocks: [
          { type: 'heading', level: 2, children: [{ type: 'text', value: 'Listen' }] },
          { type: 'paragraph', children: [{ type: 'text', value: 'The invocation arrives in its own time.' }] },
        ],
      }),
    });
  });
  await openReading(page);

  const invocationBlocks = page.locator('.public-invocation > :is(h2,p)');
  await expect(invocationBlocks).toHaveCount(2);
  for (const block of await invocationBlocks.all()) {
    await expect(block).toHaveAttribute('data-oracle-reveal', '');
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
