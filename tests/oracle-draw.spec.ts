import { expect, test } from './fixtures';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/universal-language');
  await page.getByRole('button', { name: 'Draw a card', exact: true }).first().click();
});

test('selects the lower trigram first, previews the card, and opens it', async ({ page }) => {
  const dialog = page.getByRole('dialog', { name: 'Draw a card' });
  await dialog.getByRole('tab', { name: 'Choose trigrams' }).click();
  await expect(dialog.getByRole('heading', { name: 'Choose the bottom half' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Fire', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Now choose the top half' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Water', exact: true }).click();
  await expect(dialog.getByText('Hexagram 63', { exact: true })).toBeVisible();
  const bounds = await dialog.boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
  await expect(dialog.getByRole('button', { name: 'Close draw a card' })).toBeInViewport();
  await expect(dialog.getByText('After Completion', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Upper trigram', { exact: true })).toContainText('Water');
  await expect(dialog.getByLabel('Lower trigram', { exact: true })).toContainText('Fire');
  await expect(dialog.getByRole('button', { name: /^Open card \d+$/ }).first()).toBeInViewport();
  await page.screenshot({ path: `test-results/oracle-draw-trigrams-${test.info().project.name}.png` });
  await dialog.getByRole('button', { name: /^Open card \d+$/ }).first().click();
  await expect(page).toHaveURL(/\/universal-language\/63$/);
});

test('allows editing either trigram and restores focus on close', async ({ page }) => {
  const dialog = page.getByRole('dialog', { name: 'Draw a card' });
  await dialog.getByRole('tab', { name: 'Choose trigrams' }).click();
  await dialog.getByRole('button', { name: 'Heaven', exact: true }).click();
  await dialog.getByRole('button', { name: 'Heaven', exact: true }).click();
  await expect(dialog.getByText('Hexagram 1', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: /1.*Bottom half.*Heaven/ }).click();
  await dialog.getByRole('button', { name: 'Earth', exact: true }).click();
  await expect(dialog.getByText('Hexagram 12', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Draw a card', exact: true }).first()).toBeFocused();
});

for (const moving of [false, true]) {
  test(`coin cast ${moving ? 'keeps changing lines when opened' : 'explains a cast with no changing lines'}`, async ({ page }) => {
    await page.evaluate((moves) => { let toss = 0; Math.random = () => moves ? 0 : (++toss % 3 === 0 ? 0.9 : 0.1); }, moving);
    const dialog = page.getByRole('dialog', { name: 'Draw a card' });
    await expect(dialog.getByRole('tab').first()).toHaveText('Cast coins');
    await expect(dialog.getByRole('tab', { name: 'Cast coins' })).toHaveAttribute('aria-selected', 'true');
    await dialog.getByRole('button', { name: 'Throw the coins', exact: true }).click();
    await expect(dialog.getByText(`Hexagram ${moving ? 2 : 1}`, { exact: true })).toBeVisible();
    await expect(dialog.getByText('Currently at', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Moving to', { exact: true })).toHaveCount(moving ? 1 : 0);
    await expect(dialog.getByText(/Changing lines:/)).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Throw the coins', exact: true })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Cast again', exact: true })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: /^Open card \d+$/ }).first()).toBeInViewport();
    await page.screenshot({ path: `test-results/oracle-draw-${moving ? 'moving' : 'stable'}-${test.info().project.name}.png` });
    await dialog.getByRole('button', { name: /^Open card \d+$/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`/universal-language/${moving ? 2 : 1}$`));
    {
      const entrance = page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });
      await expect(entrance).toBeVisible();
      await entrance.click();
      await expect(page.getByRole('button', { name: 'Throw the coins', exact: true })).toHaveCount(0);
      await expect(page.getByText('Your throw', { exact: true })).toBeVisible();
      if (moving) await expect(page.getByText('The lines in motion', { exact: true })).toBeVisible();
    }
  });
}

test('coins animate once and are replaced by the result', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const dialog = page.getByRole('dialog', { name: 'Draw a card' });
  const coins = dialog.getByRole('button', { name: 'Throw the coins', exact: true });
  await coins.click();
  await expect(dialog.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Skip to card', exact: true }).click();
  await expect(dialog.getByRole('button', { name: /^Open card \d+$/ }).first()).toBeVisible();
  await expect(coins).toHaveCount(0);
  await dialog.getByRole('tab', { name: 'Choose trigrams' }).click();
  await dialog.getByRole('tab', { name: 'Cast coins' }).click();
  await expect(coins).toHaveCount(0);
});

test('the 40 to 54 cast fits as a connected pair on a phone', async ({ page }) => {
  await page.evaluate(() => {
    const tosses = [0,0,0, 0,0,1, 0,1,1, 0,0,1, 0,1,1, 0,1,1];
    let index = 0;
    Math.random = () => tosses[index++ % tosses.length];
  });
  const dialog = page.getByRole('dialog', { name: 'Draw a card' });
  await dialog.getByRole('button', { name: 'Throw the coins', exact: true }).click();
  await expect(dialog.getByRole('figure', { name: 'Your throw' })).toContainText('Hexagram 40');
  await expect(dialog.getByRole('figure', { name: 'Changes to' })).toContainText('Hexagram 54');
  await expect(dialog.getByRole('figure', { name: 'Your throw' })).toContainText('Thunder over Water');
  await expect(dialog.getByRole('button', { name: /^Open card \d+$/ }).first()).toBeInViewport();
  await page.screenshot({ path: `test-results/oracle-draw-paired-${test.info().project.name}.png` });
});

test('casting keeps focus in the result and leaves the page behind inert', async ({ page }) => {
  const dialog = page.getByRole('dialog', { name: 'Draw a card' });
  await expect(page.locator('#root')).toHaveAttribute('inert', '');
  await dialog.getByRole('button', { name: 'Throw the coins', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(dialog.getByRole('region', { name: 'Your hexagram' })).toBeFocused();
  await expect(dialog.getByRole('button', { name: /^Open card \d+$/ }).first()).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(page.locator('#root')).not.toHaveAttribute('inert', '');
  await expect(page.getByRole('button', { name: 'Draw a card', exact: true }).first()).toBeFocused();
});

test('the cast plays once with explicit Open buttons and no replay', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => { Math.random = () => 0; });
  const dialog = page.getByRole('dialog', { name: 'Draw a card' });
  await dialog.getByRole('button', { name: 'Throw the coins', exact: true }).click();
  await dialog.getByRole('button', { name: 'Skip to card', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Open card 2', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Open card 1', exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Replay change', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Throw the coins', exact: true })).toHaveCount(0);
  await dialog.locator('.oracle-draw-pair').evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished)));
  await page.screenshot({ path: `test-results/oracle-draw-buttons-${test.info().project.name}.png` });
});

test('trigram preview edits either half without losing the other', async ({ page }) => {
  const dialog = page.getByRole('dialog', { name: 'Draw a card' });
  await dialog.getByRole('tab', { name: 'Choose trigrams' }).click();
  await dialog.getByRole('button', { name: 'Fire', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Choose the upper trigram');
  await dialog.getByRole('button', { name: 'Water', exact: true }).click();
  await dialog.getByRole('button', { name: 'Edit lower trigram, Fire' }).click();
  await dialog.getByRole('button', { name: 'Water', exact: true }).click();
  await expect(dialog.getByText('Hexagram 29', { exact: true })).toBeVisible();
});

test('trigram selection keeps its frame and joins both halves with uniform spacing', async ({ page }) => {
  const dialog = page.getByRole('dialog', { name: 'Draw a card' });
  await dialog.getByRole('tab', { name: 'Choose trigrams' }).click();
  const before = await dialog.boundingBox();
  const glyphBefore = await dialog.getByLabel('Combined hexagram', { exact: true }).boundingBox();
  await dialog.getByRole('button', { name: 'Fire', exact: true }).click();
  const middle = await dialog.boundingBox();
  await dialog.getByRole('button', { name: 'Fire', exact: true }).click();
  const after = await dialog.boundingBox();
  const glyphAfter = await dialog.getByLabel('Combined hexagram', { exact: true }).boundingBox();
  expect(after).toEqual(before);
  expect(middle).toEqual(before);
  expect(glyphAfter).toEqual(glyphBefore);
  const tabs = await dialog.getByRole('tablist').boundingBox();
  const lowerStep = await dialog.getByRole('button', { name: /1.*Bottom half.*Fire/ }).boundingBox();
  expect(lowerStep!.y).toBeGreaterThanOrEqual(tabs!.y + tabs!.height);
  const rows = await dialog.locator('.oracle-draw-selection > svg > g').evaluateAll(groups => groups.map(group => (group as SVGGraphicsElement).getBBox().y));
  expect(rows).toEqual([0, 14, 28, 42, 56, 70]);
  await expect(dialog.getByText('Hexagram 30', { exact: true })).toBeVisible();
  await page.screenshot({ path: `test-results/oracle-draw-joined-${test.info().project.name}.png` });
});

test('all eight trigrams and the result fit together without scrolling on a phone', async ({ page }) => {
  test.skip(page.viewportSize()!.width > 600, 'Phone composition');
  const dialog = page.getByRole('dialog', { name: 'Draw a card' });
  await dialog.getByRole('tab', { name: 'Choose trigrams' }).click();
  const checkFit = async () => {
    const bounds = await dialog.boundingBox();
    const choices = dialog.getByRole('group', { name: /trigram choices/ });
    for (const button of await choices.getByRole('button').all()) {
      const box = await button.boundingBox();
      expect(box!.y).toBeGreaterThanOrEqual(bounds!.y);
      expect(box!.y + box!.height).toBeLessThanOrEqual(bounds!.y + bounds!.height);
      await expect(button).toBeInViewport({ ratio: 1 });
    }
    await expect(dialog.getByLabel('Combined hexagram', { exact: true })).toBeInViewport({ ratio: 1 });
    await expect(dialog.getByRole('button', { name: /^Open card/ })).toBeInViewport({ ratio: 1 });
    const overflow = await dialog.locator('.oracle-draw-body, .oracle-draw-controls, .oracle-draw-trigrams, .oracle-draw-preview').evaluateAll(elements => elements.map(element => ({ scroll: element.scrollHeight, client: element.clientHeight })));
    for (const size of overflow) expect(size.scroll).toBeLessThanOrEqual(size.client + 1);
  };
  await checkFit();
  await dialog.getByRole('button', { name: 'Fire', exact: true }).click();
  await checkFit();
  await dialog.getByRole('button', { name: 'Fire', exact: true }).click();
  await checkFit();
  await page.screenshot({ path: `test-results/oracle-draw-all-eight-${test.info().project.name}.png` });
});

test('each displayed hexagram opens its own card from one header', async ({ page }) => {
  await page.evaluate(() => { Math.random = () => 0; });
  const dialog = page.getByRole('dialog', { name: 'Draw a card' });
  await expect(dialog.locator('header')).toHaveCount(1);
  await expect(dialog.locator('header').getByRole('tablist')).toBeVisible();
  await dialog.getByRole('button', { name: 'Throw the coins', exact: true }).click();
  await expect(dialog.getByRole('figure', { name: 'Your throw' }).getByRole('button', { name: 'Open card 2', exact: true })).toBeInViewport();
  await expect(dialog.locator('.oracle-draw-footer')).toHaveCount(0);
  await page.screenshot({ path: `test-results/oracle-draw-direct-open-${test.info().project.name}.png` });
  await dialog.getByRole('figure', { name: 'Changes to' }).getByRole('button', { name: 'Open card 1', exact: true }).click();
  await expect(page).toHaveURL(/\/universal-language\/1$/);
});

test('dialog keeps the same size across both methods and the cast result', async ({ page }) => {
  await page.evaluate(() => { Math.random = () => 0; });
  const dialog = page.getByRole('dialog', { name: 'Draw a card' });
  const original = await dialog.boundingBox();
  await dialog.getByRole('tab', { name: 'Choose trigrams' }).click();
  expect(await dialog.boundingBox()).toEqual(original);
  await dialog.getByRole('button', { name: 'Fire', exact: true }).click();
  await dialog.getByRole('button', { name: 'Fire', exact: true }).click();
  expect(await dialog.boundingBox()).toEqual(original);
  await dialog.getByRole('tab', { name: 'Cast coins' }).click();
  expect(await dialog.boundingBox()).toEqual(original);
  await dialog.getByRole('button', { name: 'Throw the coins', exact: true }).click();
  await expect(dialog.getByRole('figure', { name: 'Your throw' })).toBeVisible();
  expect(await dialog.boundingBox()).toEqual(original);
  await dialog.getByRole('tab', { name: 'Choose trigrams' }).click();
  expect(await dialog.boundingBox()).toEqual(original);
  await dialog.getByRole('tab', { name: 'Cast coins' }).click();
  expect(await dialog.boundingBox()).toEqual(original);
  await page.screenshot({ path: `test-results/oracle-draw-steady-${test.info().project.name}.png` });
});

test('the dialog never fades with the page behind it, so the site menu cannot show through', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/universal-language');
  // Stretch the page's 0.3s fade-in so the click below reliably lands during it, as a quick tap does.
  await page.addStyleTag({ content: '.route-fade-in { animation-duration: 60s !important; }' });
  await page.getByRole('button', { name: 'Draw a card', exact: true }).first().click();
  // The page fades in for 0.3s. If the dialog lives inside that fading page it fades with it,
  // and the site menu behind shows through its top bar. Every ancestor must be fully opaque.
  const opacity = await page.evaluate(() => {
    let value = 1;
    for (let el: Element | null = document.querySelector('.oracle-draw'); el; el = el.parentElement) value *= Number(getComputedStyle(el).opacity);
    return value;
  });
  expect(opacity).toBe(1);
});
