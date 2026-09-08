import { test, expect } from '@playwright/test';

/* todo/plans/overarching-plan.md Track C, follow-up named in the C2 wave log
 * entry (2026-09-08): functions/_middleware.ts gives every Pages Function
 * response the security headers `public/_headers` gives static assets,
 * Content-Security-Policy included for HTML. tests/unit/functionSecurityHeaders
 * .test.ts proves the middleware's own header logic against a fake response;
 * this proves the deployed shape end to end — the actual edge function
 * serving /universal-language/:number under an actual CSP does not trip its
 * own policy and still renders the reading.
 *
 * Needs the functions layer, which the plain `npm run dev` (Vite) server does
 * not run — build first, then serve with wrangler:
 *
 *   npm run build && npx wrangler pages dev dist --port 8799 --ip 127.0.0.1
 *   FUNCTION_HEADERS_BASE_URL=http://127.0.0.1:8799 npx playwright test function-headers-csp
 */

const BASE = process.env.FUNCTION_HEADERS_BASE_URL ?? '';

test.skip(
  !BASE,
  'Set FUNCTION_HEADERS_BASE_URL to a running `wrangler pages dev dist` origin to run this spec.',
);

test('the CSP a real edge response carries does not block its own reading', async ({ page }) => {
  const cspViolations: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && /content security policy|csp/i.test(msg.text())) {
      cspViolations.push(msg.text());
    }
  });
  // A CSP violation fires as a real 'securitypolicyviolation' event, not only
  // a console line — listen for both so a directive that silently blocks
  // something without logging (rare, but directive-dependent) still fails.
  await page.addInitScript(() => {
    window.addEventListener('securitypolicyviolation', (e) => {
      (window as unknown as { __cspViolations: string[] }).__cspViolations ??= [];
      (window as unknown as { __cspViolations: string[] }).__cspViolations.push(
        `${e.violatedDirective}: ${e.blockedURI}`,
      );
    });
  });

  const response = await page.goto(`${BASE}/universal-language/33`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  expect(response?.status()).toBeLessThan(400);

  // The header this whole spec exists to prove is actually present.
  expect(response?.headers()['content-security-policy']).toBeTruthy();

  const eventViolations = await page.evaluate(
    () => (window as unknown as { __cspViolations?: string[] }).__cspViolations ?? [],
  );

  await expect(page.locator('[data-oracle-flow]')).toBeAttached();
  const body = await page.textContent('body');
  expect(body, 'reading text present').toBeTruthy();
  expect((body ?? '').trim().length).toBeGreaterThan(400);

  expect(cspViolations, 'console CSP violations').toEqual([]);
  expect(eventViolations, 'securitypolicyviolation events').toEqual([]);
});
