import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});
describe('Atlas client state truth', () => {
  it('honors a valid empty canonical state without injecting local pieces', async () => {
    const canonical = {
      generatedAt: '2026-08-09T00:00:00.000Z',
      schemaVersion: 2,
      pieces: [],
      cities: [],
    };
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ok: true, state: canonical })));
    const { loadAtlasState } = await import('../../lib/atlas/state');

    await expect(loadAtlasState()).resolves.toEqual(canonical);
  });

  it('represents canonical failure without invented placements, ordinals, or dreams', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('offline');
    }));
    const { loadAtlasState } = await import('../../lib/atlas/state');

    const state = await loadAtlasState();

    expect(state.servedFallback).toBe(true);
    expect(state.pieces).toEqual([]);
    expect(state.cities).toEqual([]);
  });

  it('keeps fixtures explicit and development-only', async () => {
    const source = await readFile(resolve('lib/atlas/state.ts'), 'utf8');

    expect(source).not.toContain("from '../../data/atlasSeed'");
    expect(source).toContain('import.meta.env.DEV');
  });
});
