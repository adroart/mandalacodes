import { describe, expect, it, vi } from 'vitest';
import { onRequest } from '../../functions/universal-language/[number].js';

async function visit(number: string, missing = false) {
  const fetch = vi.fn(async (request: Request) => {
    const path = new URL(request.url).pathname;
    if (missing && path !== '/index.html') return new Response(null, { status: 404 });
    return new Response(path === '/index.html' ? 'synthetic SPA shell' : `synthetic card page: ${path}`);
  });
  const response = await onRequest({
    params: { number },
    request: new Request(`https://mandalacodes.com/universal-language/${encodeURIComponent(number)}?ref=qr`),
    env: { ASSETS: { fetch } },
  });
  return { response, fetch, paths: fetch.mock.calls.map(([request]) => new URL(request.url).pathname) };
}

describe('card route asset selection', () => {
  it('serves every canonical card prerender without falling through to the shell', async () => {
    for (let n = 1; n <= 64; n++) {
      const { response, paths, fetch } = await visit(String(n));
      expect(paths).toEqual([`/universal-language/${n}/index.html`]);
      expect(await response.text()).toBe(`synthetic card page: /universal-language/${n}/index.html`);
      expect(response.headers.get('content-type')).toBe('text/html;charset=UTF-8');
      expect(new URL(fetch.mock.calls[0][0].url).search).toBe('');
    }
  });

  it.each(['01', '064'])('keeps digit-only legacy number %s', async (number) => {
    expect((await visit(number)).paths).toEqual([`/universal-language/${Number(number)}/index.html`]);
  });

  it.each(['1junk', '64junk', '1.5', '1e1', '+1', ' 1', '1 ', '1\n', '1/2', '0', '65', '']) (
    'serves only the unknown-card shell for %j', async (number) => {
      const { response, paths } = await visit(number);
      expect(paths).toEqual(['/index.html']);
      expect(await response.text()).toBe('synthetic SPA shell');
    },
  );

  it('preserves the shell fallback if a valid prerender is unavailable', async () => {
    const { response, paths } = await visit('33', true);
    expect(paths).toEqual(['/universal-language/33/index.html', '/index.html']);
    expect(await response.text()).toBe('synthetic SPA shell');
  });
});
