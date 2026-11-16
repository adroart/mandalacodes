import { expect, test } from './fixtures';

test('admin record hint stays inside the mobile reading footer', async ({ page }, testInfo) => {
  test.skip(!['Mobile 320', 'Mobile Chrome'].includes(testInfo.project.name), 'Mobile reading frame only');
  await page.route('**/api/oracle/reflections/capability', (route) => route.fulfill({
    json: { ok: true, admin: true },
  }));
  await page.goto('/universal-language/22');
  const entrance = page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });
  await entrance.waitFor({ state: 'visible', timeout: 3_000 }).catch(() => undefined);
  if (await entrance.isVisible()) await entrance.click();

  const deck = page.locator('.card-reading [data-current-hexagram]:visible');
  const hint = deck.getByText('Hold to record');
  await expect(hint).toBeVisible();
  const footer = deck.locator('xpath=ancestor::footer');
  const save = page.getByRole('button', { name: 'Save this code' });
  await expect(save).toBeVisible();
  await save.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('admin-record-hint-near-save.png') });

  const hintBox = await hint.boundingBox();
  const footerBox = await footer.boundingBox();
  expect(hintBox).not.toBeNull();
  expect(footerBox).not.toBeNull();
  expect(hintBox!.y).toBeGreaterThanOrEqual(footerBox!.y);
  expect(hintBox!.y + hintBox!.height).toBeLessThanOrEqual(footerBox!.y + footerBox!.height);
  const saveBox = await save.boundingBox();
  expect(saveBox!.y + saveBox!.height).toBeLessThanOrEqual(footerBox!.y);
  const deckBox = await deck.boundingBox();
  expect(deckBox!.width).toBeGreaterThanOrEqual(44);
  expect(deckBox!.height).toBeGreaterThanOrEqual(44);

  await deck.focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('navigation', { name: 'Private reflection recorder' })).toBeVisible();
});
