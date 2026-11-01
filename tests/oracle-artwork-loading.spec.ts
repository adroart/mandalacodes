import { test, expect } from './fixtures';

for (const code of [1, 23]) {
  test(`card ${code} uses its own hexagram while artwork loads, then reveals it`, async ({ page }) => {
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    await page.route(/\/media\/image\//, async route => {
      await pending;
      await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#8a744e"/></svg>' });
    });
    await page.goto(`/universal-language/${code}`);
    const art = page.locator('.card-artwork');
    try {
      await expect(art).toHaveAttribute('data-state', 'loading');
      await expect(art.locator('img')).toHaveCSS('visibility', 'hidden');
      await expect(art.getByRole('status')).toContainText(`Code ${code}`);
      await expect(art.locator('[data-solid]')).toHaveCount(6);
      expect(await art.locator('[data-solid]').evaluateAll(lines => lines.map(line => line.getAttribute('data-solid'))))
        .toEqual(code === 1 ? Array(6).fill('true') : ['true', 'false', 'false', 'false', 'false', 'false']);
      await page.screenshot({ path: `/tmp/oracle-loading-${code}-${test.info().project.name.replaceAll(' ', '-')}.png` });
    } finally { release(); }
    await expect(art).toHaveAttribute('data-state', 'ready');
    await expect(art.locator('img')).toHaveCSS('visibility', 'visible');
    await expect(art.getByRole('status')).toHaveCount(0);
  });
}

test('failed artwork hides the broken image, stops motion, and can retry', async ({ page }) => {
  let fail = true;
  await page.route(/\/media\/image\//, route => route.fulfill(fail
    ? { status: 404, body: '' }
    : { contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>' }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/universal-language/23');
  const art = page.locator('.card-artwork');
  await expect(art).toHaveAttribute('data-state', 'error');
  await expect(art.locator('img')).toHaveCSS('visibility', 'hidden');
  await expect(art.locator('.card-artwork__orbit')).toHaveCSS('animation-name', 'none');
  fail = false;
  await art.getByRole('button', { name: 'Try again' }).click();
  await expect(art).toHaveAttribute('data-state', 'ready');
});

/* decode() is a courtesy, not a gate. On the live site it once never settled
   for card 23, so a downloaded plate sat behind the loading screen for good;
   some browsers also reject it for images that draw fine. A loaded plate is
   shown either way. */
for (const [label, decode] of [
  ['never settles', 'new Promise(() => {})'],
  ['rejects', 'Promise.reject(new DOMException("decode", "EncodingError"))'],
] as const) {
  test(`the artwork shows once loaded even when decode ${label}`, async ({ page }) => {
    await page.addInitScript(`HTMLImageElement.prototype.decode = function () { return ${decode}; };`);
    await page.route(/\/media\/image\//, route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#8a744e"/></svg>' }));
    await page.goto('/universal-language/23');
    const art = page.locator('.card-artwork');
    await expect(art).toHaveAttribute('data-state', 'ready');
    await expect(art.locator('img')).toHaveCSS('visibility', 'visible');
  });
}
