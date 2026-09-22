import { test, expect } from './fixtures';

const CARD = '/universal-language/1';
const SYSTEMS = ['ul', 'iching', 'genekeys', 'humandesign', 'body', 'tarot'];

for (const mode of ['light', 'dark'] as const) {
  for (const sys of SYSTEMS) {
    test(`Earth's Breath — ${mode} mode — ${sys}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', e => errors.push(String(e)));

      // Set theme before navigation (DarkModeContext reads localStorage on init).
      await page.addInitScript((m) => {
        localStorage.setItem('dark-mode', m === 'dark' ? 'true' : 'false');
        // Retained for compatibility with the earlier entrance implementation.
        sessionStorage.setItem('eb-skip-entrance', '1');
      }, mode);

      await page.goto(`${CARD}?system=${sys}`, { waitUntil: 'networkidle' });
      const entrance = page.getByRole('dialog', { name: 'Card entrance. Tap to begin.' });
      let entranceAppeared = true;
      try {
        await entrance.waitFor({ state: 'visible', timeout: 1_500 });
      } catch {
        entranceAppeared = false;
      }
      if (entranceAppeared) {
        await entrance.click();
        await expect(entrance).toBeHidden();
      }
      await expect(page.locator('.eb-reading').first()).toBeVisible();

      // Horizontal overflow check
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > window.innerWidth + 2);
      expect(overflow, `horizontal overflow on ${sys}`).toBeFalsy();
      // No error boundary / 404
      const body = await page.locator('body').innerText();
      expect(body).not.toContain('Something went wrong');
      expect(body.toLowerCase()).not.toContain('page not found');
      await page.screenshot({ path: `test-results/eb-${mode}-${sys}.png`, fullPage: true });

      const unexpected = errors.filter(e =>
        !/401|403|favicon|Failed to load resource|net::ERR/i.test(e));
      expect(unexpected, `console errors: ${unexpected.join('\n')}`).toHaveLength(0);
    });
  }
}
