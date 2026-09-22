/**
 * The offline path for a plaque scan.
 *
 * A printed sculpture's QR code lands a visitor on one card page, never on the
 * deck index, and a plaque is exactly where signal tends to be poor. Two
 * defects met there and neither had a test, which is why both survived: the
 * card page never warmed the deck, and a prose fetch that failed was swallowed
 * so every lens rendered permanently, silently blank.
 *
 * These tests hold the agreements that keep that fixed: the card page warms,
 * the warm pass fetches prose only (never artwork, which the worker does not
 * store and which cost 70 GB of Cloudinary bandwidth in a day when it did),
 * and a failed prose load is handed to the connection notice rather than
 * eaten.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

/* The prose loaders are what the warm pass calls; record the card numbers
   they are asked for so the tests can watch the order without a network. */
const prose = vi.hoisted(() => ({ requested: [] as number[] }));
vi.mock('../../data/synthesisData', () => ({
  getSynthesis: async (n: number) => { prose.requested.push(n); return {}; },
}));
vi.mock('../../data/cardMarkdown', () => ({
  getParsedCard: async () => ({}),
}));

import { deckWarmOrder, warmOracleForOffline } from '../../lib/oracle/offlineWarm';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

/* Written by lib/oracle/offlineWarm.ts. Spelled out rather than imported so a
   rename of the key is a visible decision here too. */
const WARM_FLAG_KEY = 'mc-oracle-warmed-v1';

interface Harness {
  requested: number[];
  images: number;
  store: Map<string, string>;
  pumpUntil(condition: () => boolean, limit?: number): Promise<void>;
}

/** A browser just real enough for the warm pass: an idle queue this test
 *  drives by hand, a localStorage, and an Image that counts how often it is
 *  constructed (the answer has to stay zero). */
function browser(seed: Record<string, string> = {}): Harness {
  const queue: Array<() => void> = [];
  const store = new Map(Object.entries(seed));
  prose.requested.length = 0;
  const h: Harness = {
    requested: prose.requested,
    images: 0,
    store,
    async pumpUntil(condition, limit = 60) {
      for (let i = 0; i < limit; i += 1) {
        queue.shift()?.();
        await new Promise((r) => setTimeout(r, 0));
        if (condition()) return;
      }
    },
  };

  vi.stubGlobal('window', {
    addEventListener: () => {},
    setTimeout: (fn: () => void) => { queue.push(fn); return 0; },
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
    },
  });
  vi.stubGlobal('navigator', { onLine: true, serviceWorker: {} });
  vi.stubGlobal('Image', class FakeImage {
    constructor() { h.images += 1; }
  });

  return h;
}

/* The warm pass reschedules itself after each card, so a test that ends
   mid-deck leaves one step still queued. Swap in an inert browser rather than
   removing it: the next step then lands in a no-op setTimeout and the chain
   ends quietly instead of tearing down the run. */
afterEach(() => {
  vi.stubGlobal('window', {
    setTimeout: () => 0,
    localStorage: { getItem: () => null, setItem: () => {} },
  });
});

describe('warming the deck from a scanned card', () => {
  it('warms the card the visitor is looking at before the rest of the deck', async () => {
    const h = browser();

    warmOracleForOffline({ startAt: 7 });
    await h.pumpUntil(() => h.requested.length >= 2);

    expect(h.requested.slice(0, 2)).toEqual([7, 8]);
  });

  it('still starts at card one when no card is named, as the deck index does', async () => {
    const h = browser();

    warmOracleForOffline();
    await h.pumpUntil(() => h.requested.length >= 1);

    expect(h.requested[0]).toBe(1);
  });

  it('does not trust a legacy persistent warm flag after reload', async () => {
    const h = browser({ [WARM_FLAG_KEY]: '1' });

    warmOracleForOffline({ startAt: 23 });
    await h.pumpUntil(() => h.requested.length >= 1);

    expect(h.requested[0]).toBe(23);
    await h.pumpUntil(() => h.requested.length >= 2);
    expect(h.requested.slice(0, 2)).toEqual([23, 24]);
  });

  it('covers all 64 cards exactly once whichever card it starts from', () => {
    const order = deckWarmOrder(60);

    expect(order.slice(0, 6)).toEqual([60, 61, 62, 63, 64, 1]);
    expect(new Set(order).size).toBe(64);
    expect([...order].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 64 }, (_, i) => i + 1),
    );
  });

  it('is called from the card page, which is where a plaque scan lands', () => {
    const source = read('components/oracle/reading/CardReadingData.tsx');

    expect(source).toContain('warmOracleForOffline');
    expect(source).toContain('startAt: cardNumber');
  });
});

describe('the warm pass never fetches artwork', () => {
  /* The worker does not cache production media (vite.config.ts), so an
     artwork prefetch stores nothing and only spends bandwidth: 64 images,
     about 17 MB, for every fresh browser that opens a card or the deck. The
     Playwright suite alone burned 70 GB in one day that way (2026-09-12). */
  it('constructs no Image while warming a whole deck', async () => {
    const h = browser();

    warmOracleForOffline({ startAt: 12 });
    await h.pumpUntil(() => h.requested.length >= 3);

    expect(h.requested.length).toBeGreaterThanOrEqual(3);
    expect(h.images).toBe(0);
  });

  it('does not reach for the artwork helpers at all', () => {
    const source = read('lib/oracle/offlineWarm.ts');

    expect(source).not.toContain('ulCardHeroImageUrl');
    expect(source).not.toContain('new Image(');
  });
});

describe('a reading that cannot load its words says so', () => {
  it('hands the failure to the connection notice instead of swallowing it', () => {
    const source = read('components/oracle/reading/CardReadingData.tsx');

    expect(source).toContain('isChunkLoadError');
    expect(source).toMatch(/if \(loadFailure !== null && isChunkLoadError\(loadFailure\)\) throw loadFailure;/);
    /* The silent blank: a rejected prose load discarded on the spot. */
    expect(source).not.toMatch(/getSynthesis\(cardNumber\)[\s\S]{0,120}\.catch\(\(\) => \{\}\)/);
  });

  it('reuses the one existing notice rather than a second error style', () => {
    const source = read('components/oracle/reading/CardReadingData.tsx');

    expect(source).not.toContain('needs a connection');
  });

  it('keeps the notice calm, honest, and inside the house rules', () => {
    const boundary = read('components/ChunkErrorBoundary.tsx');
    const copy = boundary.slice(boundary.indexOf('This part of the oracle'));
    const sentence = copy.slice(0, copy.indexOf('</p>'));

    expect(sentence).toContain('needs a connection');
    /* Says what is still available, not only what is missing. */
    expect(sentence).toMatch(/already opened are still/);
    /* Adrian's two locked rules: no em dash, no italics. Built from its code
       point so the character itself never appears in the repository. */
    expect(boundary).not.toContain(String.fromCharCode(0x2014));
    expect(boundary).not.toMatch(/fontStyle:\s*'italic'/);
  });
});
