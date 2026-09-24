import { expect, test } from './fixtures';

test('card reading has one coin-casting ritual inside the I Ching panel', async ({ page }) => {
  const base = process.env.TEST_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? '';
  await page.goto(`${base}/universal-language/22`);

  const entrance = page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });
  if (await entrance.isVisible()) await entrance.click();

  await expect(page.getByRole('button', { name: 'Cast the coins', exact: true })).toHaveCount(2);
  await expect(
    page.getByRole('button', {
      name: 'Throw the coins. Begin the changing and see how this hexagram is moving.',
      exact: true,
    }),
  ).toHaveCount(0);
});

test('the coins are the primary fast cast control', async ({ page }) => {
  const base = process.env.TEST_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? '';
  await page.goto(`${base}/universal-language/22`);

  const entrance = page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });
  if (await entrance.isVisible()) await entrance.click();

  const castControls = page.getByRole('button', { name: 'Cast the coins', exact: true });
  await expect(castControls).toHaveCount(2);

  await castControls.evaluateAll((castButtons) => {
    const timing = {
      startedAt: null as number | null,
      disabledAt: null as number | null,
      resultAt: null as number | null,
    };
    const browserWindow = window as typeof window & { __coinCastTiming?: typeof timing };
    browserWindow.__coinCastTiming = timing;

    const isVisible = (element: HTMLElement) => {
      if (typeof element.checkVisibility === 'function') {
        return element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
      }
      for (let current: HTMLElement | null = element; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      }
      return element.getClientRects().length > 0;
    };
    const readState = () => {
      if (timing.startedAt === null || timing.resultAt !== null) return;
      const currentControls = [...document.querySelectorAll<HTMLButtonElement>('button')]
        .filter((button) => (
          button.getAttribute('aria-label') === 'Cast the coins'
          || button.textContent?.trim() === 'Cast the coins'
        ));
      if (currentControls.length === 2 && currentControls.every((button) => button.disabled)) {
        timing.disabledAt ??= performance.now();
      }
      const result = [...document.querySelectorAll<HTMLElement>('[data-chapter="iching"] div, [data-chapter="iching"] span')]
        .find((element) => element.textContent?.trim() === 'Hexagram 22 · Grace' && isVisible(element));
      if (result && timing.disabledAt !== null) {
        timing.resultAt = performance.now();
        return;
      }
      requestAnimationFrame(readState);
    };

    for (const castButton of castButtons) {
      castButton.addEventListener('click', () => {
        if (timing.startedAt !== null) return;
        timing.startedAt = performance.now();
        requestAnimationFrame(readState);
      }, { capture: true, once: true });
    }
  });

  await castControls.first().click();
  await expect(castControls.first()).toBeDisabled();
  await expect(castControls.last()).toBeDisabled();
  await expect(page.getByText('Hexagram 22 · Grace', { exact: true })).toBeVisible();
  await page.waitForFunction(() => (
    typeof (window as typeof window & { __coinCastTiming?: { resultAt: number | null } })
      .__coinCastTiming?.resultAt === 'number'
  ));
  const castDuration = await page.evaluate(() => {
    const timing = (window as typeof window & {
      __coinCastTiming?: {
        startedAt: number | null;
        disabledAt: number | null;
        resultAt: number | null;
      };
    }).__coinCastTiming;
    if (!timing || timing.startedAt === null || timing.disabledAt === null || timing.resultAt === null) {
      throw new Error('Coin cast timing marks were not recorded');
    }
    return timing.resultAt - timing.startedAt;
  });
  console.log(`Coin cast interaction to visible result: ${castDuration.toFixed(1)}ms`);
  expect(castDuration).toBeLessThan(650);
});

test('the coin control casts from the keyboard without motion', async ({ page }) => {
  const base = process.env.TEST_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? '';
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${base}/universal-language/22`);

  const entrance = page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });
  if (await entrance.isVisible()) await entrance.click();

  const coinControl = page.getByRole('button', { name: 'Cast the coins', exact: true }).first();
  await coinControl.focus();
  await page.keyboard.press('Enter');

  await expect(page.getByText('Hexagram 22 · Grace', { exact: true })).toBeVisible();
});

test('the resulting hexagram opens its reading directly', async ({ page }) => {
  const base = process.env.TEST_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? '';
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    Math.random = () => 0;
  });
  await page.goto(`${base}/universal-language/22`);

  const entrance = page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });
  if (await entrance.isVisible()) await entrance.click();

  await page.getByRole('button', { name: 'Cast the coins', exact: true }).first().click();
  await expect(page.getByText(/With all moving lines turned over together/)).toBeVisible();
  await expect(page.getByText(/Turned over, it leads to/)).toHaveCount(0);
  await expect(page.getByText('The lines in motion', { exact: true })).toBeVisible();
  await page.screenshot({ path: `test-results/cast-combined-${test.info().project.name}.png` });
  await page.getByRole('button', { name: /Turning into.*Hexagram 47.*Open that card/i }).click();

  await expect(page).toHaveURL(/\/universal-language\/47$/);
  await expect(page.getByRole('dialog', { name: 'The 64 Codes' })).toHaveCount(0);
});
