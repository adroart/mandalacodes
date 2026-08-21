import { getSynthesis } from '../../data/synthesisData';
import { getParsedCard } from '../../data/cardMarkdown';
import { ulCardImageUrl } from '../../utils/universalLanguage';

const WARM_FLAG_KEY = 'mc-oracle-warmed-v1';

function idle(fn: () => void): void {
  const withIdle = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void };
  if (typeof withIdle.requestIdleCallback === 'function') {
    withIdle.requestIdleCallback(fn, { timeout: 4000 });
  } else {
    window.setTimeout(fn, 200);
  }
}

/** Loads an image via a plain Image element (governed by img-src, not
 * connect-src) so the runtime CacheFirst route for res.cloudinary.com
 * picks it up as a real — not opaque — cached response. */
function prefetchImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

async function warmOne(number: number): Promise<void> {
  await Promise.allSettled([
    getSynthesis(number),
    getParsedCard(number),
    prefetchImage(ulCardImageUrl(number, 1080)),
  ]);
}

/**
 * Quietly makes the full 64-card deck available offline: fetches every
 * card's text and hero artwork, one at a time, on the browser's idle
 * schedule, once per device. This is what turns "the cards you've already
 * opened work offline" (the service worker's runtime cache does that for
 * free) into "the whole deck works offline" — the actual ask, since a
 * reading can land on any of the 64.
 *
 * No UI, no progress indicator, no "downloading for offline" banner — the
 * oracle simply becomes available; it doesn't announce that it's doing so.
 */
export function warmOracleForOffline(): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (!navigator.onLine) return;
  if (window.localStorage.getItem(WARM_FLAG_KEY)) return;

  let n = 1;
  const step = () => {
    if (n > 64) {
      window.localStorage.setItem(WARM_FLAG_KEY, '1');
      return;
    }
    const current = n++;
    warmOne(current).finally(() => idle(step));
  };
  idle(step);
}
