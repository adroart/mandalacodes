import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
describe('Atlas client state truth', () => {
  it('passes a valid EMPTY canonical state through untouched, inventing nothing (2026-09-01)', async () => {
    const canonical = {
      generatedAt: '2026-08-09T00:00:00.000Z',
      schemaVersion: 2,
      pieces: [],
      cities: [],
    };
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ok: true, state: canonical })));
    const { loadAtlasState } = await import('../../lib/atlas/state');

    const state = await loadAtlasState();
    // The record is the premise: a light means a life is attached. An empty
    // record stays empty, so the globe stands honestly dark rather than
    // carrying stand-in pieces, invented claim ordinals, or a sample dream.
    expect(state).toEqual(canonical);
    expect(state.pieces).toHaveLength(0);
    expect(state.cities).toHaveLength(0);
  });

  it('passes a canonical state with real pieces through untouched', async () => {
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

  it('carries no builder that can stand pieces in for an empty record', async () => {
    const source = await readFile(resolve('lib/atlas/state.ts'), 'utf8');

    // The five fabricated launch samples were removed on 2026-09-01. Nothing
    // in the loader may reintroduce a stand-in sky: no placeholder builder,
    // and no branch that reacts to a zero-length pieces array.
    expect(source).not.toContain('buildPlaceholderAtlasState');
    expect(source).not.toContain('atlasPlaceholder');
    expect(source).not.toMatch(/pieces\.length === 0/);

    // The only fixture left is DEV-gated and WITHHOLDS rather than invents:
    // it resolves an empty record so the honest empty sky can be previewed.
    const devBlock = source.slice(source.indexOf('import.meta.env.DEV'));
    expect(devBlock.slice(0, 400)).toContain('emptysky');
  });

  it('gives an empty sky its own honest line instead of a row of zeroes', async () => {
    const source = await readFile(resolve('components/AtlasPage.tsx'), 'utf8');

    // Same awaiting sentence the wall, ledger and registry carry, so the
    // whole surface speaks one voice about an empty record.
    expect(source).toContain('the sky is waiting for its first light');
    // Gated on the record actually being empty, not on a stand-in flag.
    expect(source).toContain('totalCount === 0');
    // No sample vocabulary survives anywhere on the page.
    expect(source).not.toContain('sample sky');
    expect(source).not.toContain('placeholder === true');
  });
});
