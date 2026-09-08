import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { onRequest } from '../../functions/_middleware';
import { SECURITY_HEADERS } from '../../functions/_generated/security-headers';

/* todo/plans/overarching-plan.md, Track C, follow-up named in the C2 wave log
 * entry (2026-09-08): `public/_headers` only ever reaches static assets, so a
 * Pages Function response (the /universal-language/:number and /piece/:id
 * social-meta rewrites, every /qr redirect, every /api/* route) shipped with
 * none of the site's security headers. functions/_middleware.ts closes that
 * gap; this proves it against the actual header text `public/_headers`
 * declares for `/*`, not a hand-copied expectation that could drift from it. */

const HEADERS_FILE = readFileSync(resolve(process.cwd(), 'public/_headers'), 'utf8');

/** Parse the `/*` block out of `public/_headers` the same way the postbuild
 *  script parses `dist/_headers` — the source of truth for every non-CSP
 *  header value (those never change build to build) and for which header
 *  names must be present at all. */
function parseRootBlock(text: string): Record<string, string> {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.trim() === '/*');
  if (start === -1) throw new Error('no "/*" block found in public/_headers');
  const block: Record<string, string> = {};
  for (let i = start + 1; i < lines.length; i++) {
    const match = lines[i].match(/^  ([A-Za-z-]+):\s(.*)$/);
    if (!match) break;
    block[match[1]] = match[2];
  }
  return block;
}

const SOURCE_HEADERS = parseRootBlock(HEADERS_FILE);
const NON_CSP_HEADER_NAMES = Object.keys(SOURCE_HEADERS).filter(
  (name) => name !== 'Content-Security-Policy',
);

interface FakeContext {
  request: Request;
  next: () => Promise<Response>;
}

function contextFor(response: Response, url = 'https://mandalacodes.com/universal-language/33'): FakeContext {
  return { request: new Request(url), next: async () => response };
}

describe('functions/_middleware security headers', () => {
  it('adds every non-CSP header from public/_headers, unchanged, to an HTML function response', async () => {
    const fakeHtml = new Response('<html><body>a reading</body></html>', {
      headers: { 'content-type': 'text/html;charset=UTF-8' },
    });

    const result = await onRequest(contextFor(fakeHtml) as any);

    for (const name of NON_CSP_HEADER_NAMES) {
      expect(result.headers.get(name)).toBe(SOURCE_HEADERS[name]);
    }
  });

  it('gives an HTML function response the generated Content-Security-Policy, hashes included', async () => {
    const fakeHtml = new Response('<html><body>a reading</body></html>', {
      headers: { 'content-type': 'text/html;charset=UTF-8' },
    });

    const result = await onRequest(contextFor(fakeHtml) as any);

    expect(result.headers.get('Content-Security-Policy')).toBe(
      SECURITY_HEADERS['Content-Security-Policy'],
    );
  });

  it('never weakens a directive relative to the public/_headers template', async () => {
    const fakeHtml = new Response('<html></html>', {
      headers: { 'content-type': 'text/html' },
    });
    const result = await onRequest(contextFor(fakeHtml) as any);
    const shipped = result.headers.get('Content-Security-Policy') ?? '';

    // Every directive the human-edited template declares must still appear,
    // verbatim, in the generated policy — the build only ever ADDS script
    // hashes to script-src / script-src-elem, it never removes or loosens
    // any other directive.
    const templateDirectives = (SOURCE_HEADERS['Content-Security-Policy'] ?? '')
      .split(';')
      .map((d) => d.trim())
      .filter((d) => d && !d.startsWith('script-src'));

    for (const directive of templateDirectives) {
      expect(shipped).toContain(directive);
    }
    expect(shipped).toMatch(/script-src 'self'/);
    expect(shipped).toContain("object-src 'none'");
    expect(shipped).toContain("frame-ancestors 'none'");
  });

  it('leaves an API/JSON function response without a Content-Security-Policy', async () => {
    const fakeJson = new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json' },
    });

    const result = await onRequest(contextFor(fakeJson, 'https://mandalacodes.com/api/oracle/card') as any);

    expect(result.headers.has('Content-Security-Policy')).toBe(false);
  });

  it('still gives an API/JSON function response every non-CSP header', async () => {
    const fakeJson = new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json' },
    });

    const result = await onRequest(contextFor(fakeJson, 'https://mandalacodes.com/api/oracle/card') as any);

    for (const name of NON_CSP_HEADER_NAMES) {
      expect(result.headers.get(name)).toBe(SOURCE_HEADERS[name]);
    }
  });

  it('never overwrites a header a route already set', async () => {
    const fakeResponse = new Response(JSON.stringify({ ok: true }), {
      headers: {
        'content-type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Referrer-Policy': 'no-referrer', // deliberately different from the template
      },
    });

    const result = await onRequest(contextFor(fakeResponse, 'https://mandalacodes.com/api/oracle/mcp') as any);

    expect(result.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(result.headers.get('Referrer-Policy')).toBe('no-referrer');
  });

  it('preserves status and body of the wrapped response', async () => {
    const fakeHtml = new Response('<html><body>a reading</body></html>', {
      status: 404,
      headers: { 'content-type': 'text/html' },
    });

    const result = await onRequest(contextFor(fakeHtml) as any);

    expect(result.status).toBe(404);
    await expect(result.text()).resolves.toBe('<html><body>a reading</body></html>');
  });
});
