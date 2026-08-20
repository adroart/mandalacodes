import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
describe('Atlas client state truth', () => {
  it('resolves a valid empty canonical state to the marked sample state (Adrian, 2026-08-20)', async () => {
    const canonical = {
      generatedAt: '2026-08-09T00:00:00.000Z',
      schemaVersion: 2,
      pieces: [],
      cities: [],
    };
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ok: true, state: canonical })));
    const { loadAtlasState } = await import('../../lib/atlas/state');

    const state = await loadAtlasState();
    // The truth-marker: a stand-in state must always say it is one.
    expect(state.placeholder).toBe(true);
    expect(state.pieces).toHaveLength(5);
  });

  it('passes a canonical state with real pieces through untouched (samples auto-hide)', async () => {
    const canonical = {
      generatedAt: '2026-08-09T00:00:00.000Z',
      schemaVersion: 2,
      pieces: [
        {
          pieceId: 'UL-122',
          cityId: 'denpasar-id',
          status: 'placed',
          claimOrdinal: 1,
        },
      ],
      cities: [
        {
          id: 'denpasar-id',
          city: 'Denpasar',
          country: 'Indonesia',
          countryCode: 'ID',
          lat: -8.65,
          lng: 115.2167,
        },
      ],
    };
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ok: true, state: canonical })));
    const { loadAtlasState } = await import('../../lib/atlas/state');

    const state = await loadAtlasState();
    expect(state).toEqual(canonical);
    expect(state.placeholder).toBeUndefined();
  });

  it('rejects canonical failure instead of inventing a snapshot or empty success', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline');
    }));
    const { loadAtlasState } = await import('../../lib/atlas/state');

    await expect(loadAtlasState()).rejects.toThrow('offline');
  });

  it('keeps fixtures explicit and development-only', async () => {
    const source = await readFile(resolve('lib/atlas/state.ts'), 'utf8');

    expect(source).not.toContain("from '../../data/atlasSeed'");
    expect(source).toContain('import.meta.env.DEV');
    expect(source).not.toContain('servedFallback');
  });
});
