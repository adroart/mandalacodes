import { expect, test } from './fixtures';

/* The draw dialog makes the page behind it inert while it is open. Opening a
   card from it mounted the card page while that was still true, the card
   page's entrance read the inert as the app's own state, and on tap to begin
   it put it back: the card page could not be tapped or scrolled. */
for (const method of ['coins', 'trigrams'] as const) {
  test(`a card opened from the draw (${method}) can be scrolled and tapped after the entrance`, async ({ page }) => {
    await page.goto('/universal-language');
    await page.getByRole('button', { name: 'Draw a card', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Draw a card' });
    if (method === 'coins') {
      await page.evaluate(() => { Math.random = () => 0.1; });
      await dialog.getByRole('button', { name: 'Throw the coins', exact: true }).click();
      await dialog.getByRole('button', { name: /^Skip/ }).click().catch(() => {});
    } else {
      await dialog.getByRole('tab', { name: 'Choose trigrams' }).click();
      await dialog.getByRole('button', { name: 'Fire', exact: true }).click();
      await dialog.getByRole('button', { name: 'Water', exact: true }).click();
    }
    await dialog.getByRole('button', { name: /^Open card \d+$/ }).first().click({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/universal-language\/\d+$/);

    const entrance = page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });
    await expect(entrance).toBeVisible();
    await entrance.click();
    await expect(entrance).toHaveCount(0);
    await page.waitForTimeout(1500);

    expect(await page.evaluate(() => document.getElementById('root')!.hasAttribute('inert'))).toBe(false);
    expect(await page.evaluate(() => document.getElementById('root')!.inert)).toBe(false);
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
    const scroller = page.locator('.card-reading [data-scroll]');
    const box = (await scroller.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 800);
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    // A tap lands on the page itself, not on something laid over it.
    const menu = page.getByRole('button', { name: 'Save this code' });
    await expect(menu).toBeVisible();
    await menu.click({ trial: true });
  });
}
