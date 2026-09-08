/**
 * Root Pages Function middleware — the security headers `_headers` never reaches.
 *
 * `public/_headers` (rewritten into `dist/_headers` at build time by
 * scripts/build-csp-headers.mjs) is a Cloudflare Pages convention that only
 * ever applies to static assets. Any response a Pages Function produces
 * skips it completely: the social-meta rewrites at /universal-language/:number
 * and /piece/:id (both serve a hand-edited copy of the SPA shell), every /qr
 * redirect, and every /api/* route shipped with no X-Frame-Options, no CSP,
 * no HSTS — measured live on /universal-language/33 while C2 (sitemap + per-
 * card meta, todo/plans/overarching-plan.md) was landing.
 *
 * This runs first, for every request under the project. It lets the request
 * fall through to whatever would have answered it anyway — a leaf function,
 * a nested `_middleware.ts` (e.g. functions/api/atlas/_middleware.ts), or a
 * static asset already carrying the full header set from `_headers` — then
 * fills in only what is missing:
 *
 *   - every response gets the non-CSP headers `_headers` gives `/*`
 *     (X-Frame-Options, X-Content-Type-Options, Referrer-Policy,
 *     Permissions-Policy, X-XSS-Protection, Strict-Transport-Security);
 *   - an HTML response additionally gets the Content-Security-Policy the
 *     static shell gets, script hashes included — CSP has no meaning for a
 *     JSON body, so an /api/* response never carries one;
 *   - a header a route already set (a static asset's own `_headers` values,
 *     an /api/oracle/* route's CORS headers, a leaf's own Cache-Control)
 *     is never overwritten — `Headers.has()` gates every write.
 *
 * SECURITY_HEADERS (functions/_generated/security-headers.ts) is generated,
 * not hand-copied, from the exact same rewritten dist/_headers text — see
 * that file's header comment and scripts/build-csp-headers.mjs.
 */
import { SECURITY_HEADERS } from './_generated/security-headers';

const CSP_HEADER = 'Content-Security-Policy';

// A minimal local shape rather than the ambient `PagesFunction` type: this
// file (via tests/unit/functionSecurityHeaders.test.ts) is reachable from
// the root tsconfig, which does not load @cloudflare/workers-types — the
// same reason functions/api/atlas/_middleware.ts defines its own context
// interface instead of using the global one.
interface MiddlewareContext {
  request: Request;
  next(): Promise<Response>;
}

function isHtmlResponse(response: Response): boolean {
  return (response.headers.get('content-type') ?? '').toLowerCase().includes('text/html');
}

export const onRequest = async (context: MiddlewareContext): Promise<Response> => {
  const response = await context.next();
  const html = isHtmlResponse(response);
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (name === CSP_HEADER && !html) continue; // CSP is HTML-only; API/JSON responses skip it
    if (headers.has(name)) continue; // a route (or `_headers`, for a static asset) already decided
    headers.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
