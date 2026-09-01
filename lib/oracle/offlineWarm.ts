import { getSynthesis } from '../../data/synthesisData';
import { getParsedCard } from '../../data/cardMarkdown';
import { ulCardHeroImageUrl } from '../../utils/universalLanguage';

const WARM_FLAG_KEY = 'mc-oracle-warmed-v1';

export const DECK_SIZE = 64;

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
 * picks it up as a real, not opaque, cached response. */
function prefetchImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

/**
 * One card's whole offline footprint: its prose chunk and the artwork URL its
 * reading actually requests (see ulCardHeroImageUrl, which both sides read).
 */
export async function warmCard(number: number): Promise<void> {
  await Promise.allSettled([
    getSynthesis(number),
    getParsedCard(number),
    prefetchImage(ulCardHeroImageUrl(number)),
  ]);
}

/**
 * The order the deck is warmed in. Starting at the card the visitor is
 * actually looking at matters for a plaque scan: that card is the one they
 * will reopen, and warming from 1 every time left it up to sixty-three cards
 * away from being stored. Every card still gets warmed, exactly once.
 */
export function deckWarmOrder(startAt?: number): number[] {
  const first = Number.isInteger(startAt) && (startAt as number) >= 1 && (startAt as number) <= DECK_SIZE
    ? (startAt as number)
    : 1;
  return Array.from({ length: DECK_SIZE }, (_, i) => ((first - 1 + i) % DECK_SIZE) + 1);
}

export interface WarmOptions {
  /**
   * The card on screen. Warmed first, and warmed even when the full pass has
   * already finished, so the card a visitor is holding in their hand is never
   * the one the device is missing.
   */
  startAt?: number;
}

/**
 * Quietly makes the full 64-card deck available offline: fetches every
 * card's text and hero artwork, one at a time, on the browser's idle
 * schedule, once per device. This is what turns "the cards you've already
 * opened work offline" (the service worker's runtime cache does that for
 * free) into "the whole deck works offline", the actual ask, since a
 * reading can land on any of the 64.
 *
 * Called from the deck index and from a card page, because a printed plaque
 * sends a visitor straight to a card and never past the index. A scan is the
 * likeliest moment for signal to be poor, so it is the last arrival that
 * should be left unwarmed.
 *
 * No UI, no progress indicator, no "downloading for offline" banner: the
 * oracle simply becomes available; it doesn't announce that it's doing so.
 */
export function warmOracleForOffline(options: WarmOptions = {}): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (!navigator.onLine) return;

  const { startAt } = options;
  const hasStart = Number.isInteger(startAt) && (startAt as number) >= 1 && (startAt as number) <= DECK_SIZE;

  if (window.localStorage.getItem(WARM_FLAG_KEY)) {
    /* The deck is already stored. Re-warming the card on screen is close to
       free (it answers from the cache) and covers the one case the flag lies
       about: a card whose artwork was added or replaced since the pass ran. */
    if (hasStart) idle(() => { void warmCard(startAt as number); });
    return;
  }

  const order = deckWarmOrder(hasStart ? startAt : undefined);
  let i = 0;
  const step = () => {
    if (i >= order.length) {
      window.localStorage.setItem(WARM_FLAG_KEY, '1');
      return;
    }
    const current = order[i++];
    warmCard(current).finally(() => idle(step));
  };
  idle(step);
}
