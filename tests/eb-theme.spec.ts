import { test, expect } from './fixtures';

const CARD = '/universal-language/1';
const SYSTEMS = ['ul', 'iching', 'genekeys', 'humandesign', 'body', 'tarot'];

for (const mode of ['light', 'dark'] as const) {
  test(`Earth's Breath — ${mode} mode`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(String(e)));

    // Set theme before any navigation (DarkModeContext reads localStorage on init).
    await page.addInitScript((m) => {
      localStorage.setItem('dark-mode', m === 'dark' ? 'true' : 'false');
      // Skip the ritual entrance so the reading is visible immediately.
      sessionStorage.setItem('eb-skip-entrance', '1');
    }, mode);

    for (const sys of SYSTEMS) {
      await page.goto(`${CARD}?system=${sys}`, { waitUntil: 'networkidle' });
      // Dismiss the entrance overlay if present (tap anywhere).
      const entrance = page.locator('[role="dialog"][aria-modal="true"]');
      if (await entrance.count()) {
        await entrance.first().click({ position: { x: 5, y: 5 } }).catch(() => {});
        await page.waitForTimeout(900);
      }
      await page.waitForTimeout(500);
      // Horizontal overflow check
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > window.innerWidth + 2);
      expect(overflow, `horizontal overflow on ${sys}`).toBeFalsy();
      // No error boundary / 404
      const body = await page.locator('body').innerText();
      expect(body).not.toContain('Something went wrong');
      expect(body.toLowerCase()).not.toContain('page not found');
      await page.screenshot({ path: `test-results/eb-${mode}-${sys}.png`, fullPage: true });
    }

    const unexpected = errors.filter(e =>
      !/401|403|favicon|Failed to load resource|net::ERR/i.test(e));
    expect(unexpected, `console errors: ${unexpected.join('\n')}`).toHaveLength(0);
  });
}
