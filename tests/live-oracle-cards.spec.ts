import { test, expect } from '@playwright/test';

const CARDS = [1, 3, 23, 47, 52, 64];
const BASE = process.env.LIVE_ORACLE_BASE_URL ?? '';

test.skip(
  !BASE,
  'Set LIVE_ORACLE_BASE_URL to run the production Oracle card smoke tests.',
);

for (const n of CARDS) {
  test(`live card ${n} renders clean`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text());
    });
    page.on('pageerror', (e) => consoleErrors.push(String(e)));

    const resp = await page.goto(`${BASE}/universal-language/${n}`, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });
    expect(resp?.status(), `http status for card ${n}`).toBeLessThan(400);

    const body = await page.textContent('body');
    expect(body, `error boundary on card ${n}`).not.toContain('Something went wrong');
    expect(body?.toLowerCase(), `404 text on card ${n}`).not.toContain('page not found');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 2,
    );
    expect(overflow, `horizontal overflow on card ${n}`).toBe(false);

    // real content, not an empty shell
    expect((body || '').trim().length, `content length card ${n}`).toBeGreaterThan(400);

    const unexpected = consoleErrors.filter(
      (e) => !/401|403|favicon|net::ERR_/i.test(e),
    );
    expect(unexpected, `console errors on card ${n}`).toEqual([]);

    await page.screenshot({
      path: `test-results/live-card-${n}-${test.info().project.name.replace(/\s+/g, '-')}.png`,
      fullPage: false,
    });
  });
}
