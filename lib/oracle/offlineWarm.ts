import { getSynthesis } from '../../data/synthesisData';
import { getParsedCard } from '../../data/cardMarkdown';

// Per-document completion: hashed prose is cheap to revisit through the worker,
// and a new deployment or evicted cache must never trust an old storage flag.
const passes = new WeakMap<Window, { complete: Set<number>; running: boolean }>();

export const DECK_SIZE = 64;

function idle(fn: () => void): void {
  const withIdle = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void };
  if (typeof withIdle.requestIdleCallback === 'function') {
    withIdle.requestIdleCallback(fn, { timeout: 4000 });
  } else {
    window.setTimeout(fn, 200);
  }
}

/**
 * One card's offline footprint: its prose chunks. Both are same-origin,
 * content-hashed assets the service worker's runtime route stores on first
 * fetch (vite.config.ts, oracle-app-chunks).
 *
 * The artwork is deliberately NOT part of this. The worker no longer caches
 * production media at all (see the long note in vite.config.ts), so
 * prefetching the 64 hero images stored nothing and cost every fresh browser
 * about 17 MB of Cloudinary bandwidth. Measured 2026-09-13: the Playwright
 * suite alone, opening card pages ~75 times a run across ~35 CI runs a day,
 * drove 200K image deliveries and 70 GB in one day, nearly three times the
 * free plan's monthly allowance. If artwork is to work offline again, the
 * worker has to cache it first; only then does a prefetch have somewhere to
 * put what it fetches.
 */
export async function warmCard(number: number): Promise<boolean> {
  const results = await Promise.allSettled([
    getSynthesis(number),
    getParsedCard(number),
  ]);
  return results.every(result => result.status === 'fulfilled' && result.value != null);
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
 * Quietly makes the full 64-card deck's text available offline: fetches
 * every card's prose chunks, one card at a time, on the browser's idle
 * schedule, once per document. Completed chunks come from the worker cache. This is what turns "the cards you've already
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

  let pass = passes.get(window);
  if (!pass) {
    pass = { complete: new Set(), running: false };
    passes.set(window, pass);
    // One recovery trigger, no timer loop and no media warming.
    window.addEventListener('online', () => warmOracleForOffline(options));
  }
  if (pass.running) return;
  const order = deckWarmOrder(hasStart ? startAt : undefined)
    .filter(number => !pass.complete.has(number));
  if (!order.length) return;
  pass.running = true;
  let i = 0;
  const step = () => {
    if (i >= order.length || !navigator.onLine) {
      pass.running = false;
      return;
    }
    const current = order[i++];
    warmCard(current).then(success => {
      if (success) pass.complete.add(current);
    }).finally(() => idle(step));
  };
  idle(step);
}
