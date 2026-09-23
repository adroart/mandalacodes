/**
 * Recover once from a lazy chunk that failed to load.
 *
 * During the seconds a deploy switches over, a visitor can ask for a chunk
 * the edge is not serving yet (or no longer). Cloudflare Pages used to answer
 * that with the single-page-app fallback: 200, text/html, and a 4-hour
 * browser cache from the zone's Browser Cache TTL. The browser then kept
 * refusing the "script" and the card page stayed blank for four hours
 * (measured 2026-09-23 after the deploy of 3ea6f4f). Missing assets now 404
 * (public/assets/404.html), but a browser that already holds a poisoned copy
 * still needs curing, and a 404 mid-switch still needs one retry.
 *
 * Vite fires `vite:preloadError` whenever a dynamic import rejects. We then:
 *   1. refetch the failing URL with `cache: 'reload'`, which overwrites the
 *      browser's HTTP cache entry with whatever the edge serves now;
 *   2. drop it from the service worker's chunk cache;
 *   3. reload the page, once per tab session, so a chunk that is truly gone
 *      cannot loop the page.
 */

const GUARD_KEY = 'mc-chunk-reload';
const CHUNK_CACHE = 'oracle-app-chunks';

function failingUrl(err: unknown): string | null {
  const text = err instanceof Error ? err.message : String(err ?? '');
  const match = text.match(/(?:https?:\/\/[^\s'"]+)?\/assets\/[^\s'"]+\.(?:js|css)/);
  return match ? new URL(match[0], location.origin).href : null;
}

async function purge(url: string | null): Promise<void> {
  if (!url) return;
  await Promise.allSettled([
    fetch(url, { cache: 'reload', credentials: 'same-origin' }),
    'caches' in window ? caches.open(CHUNK_CACHE).then((c) => c.delete(url)) : Promise.resolve(),
  ]);
}

export function installChunkRecovery(): void {
  window.addEventListener('vite:preloadError', (event) => {
    let alreadyTried = false;
    try {
      alreadyTried = sessionStorage.getItem(GUARD_KEY) === '1';
      if (!alreadyTried) sessionStorage.setItem(GUARD_KEY, '1');
    } catch {
      // Storage blocked: a reload could loop, so let the error surface instead.
      return;
    }
    if (alreadyTried) return;

    event.preventDefault();
    const url = failingUrl((event as Event & { payload?: unknown }).payload);
    void purge(url).finally(() => location.reload());
  });

  // A page that got this far loaded its chunks, so the next failure deserves
  // its own retry.
  window.addEventListener('load', () => {
    setTimeout(() => {
      try {
        sessionStorage.removeItem(GUARD_KEY);
      } catch {
        /* ignore */
      }
    }, 10_000);
  });
}
