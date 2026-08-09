import { afterEach, describe, expect, it, vi } from 'vitest';

import { onRequestGet, onRequestHead } from '../../functions/api/atlas/index';
import { onRequestGet as onRequestPieceGet } from '../../functions/piece/[[path]]';
import { FULL_ARCHIVE } from '../../data/mockData';

const CANONICAL_ATLAS_URL = 'https://adrianrasmussen.com/api/atlas';

function legacyBucket(state: unknown) {
  return {
    get: vi.fn(async () => ({
      etag: 'historical-etag',
      text: async () => JSON.stringify(state),
    })),
    put: vi.fn(),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Mandala Codes public Atlas read', () => {
  it('reads the canonical public state from Adrian-Website instead of legacy R2', async () => {
    const canonical = { ok: true, state: { pieces: [{ pieceId: 'UL-64' }] } };
    const fetch = vi.fn(async () => Response.json(canonical));
    vi.stubGlobal('fetch', fetch);
    const bucket = legacyBucket({ pieces: [{ pieceId: 'UL-1' }] });

    const response = await onRequestGet({
      request: new Request('https://mandalacodes.com/api/atlas'),
      env: { ATLAS_BUCKET: bucket },
    } as never);

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: CANONICAL_ATLAS_URL,
        method: 'GET',
      }),
    );
    expect(bucket.get).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(canonical);
  });

  it('uses an explicit ATLAS_CANONICAL_URL override', async () => {
    const fetch = vi.fn(async () => Response.json({ ok: true, state: { pieces: [] } }));
    vi.stubGlobal('fetch', fetch);

    await onRequestGet({
      request: new Request('https://mandalacodes.com/api/atlas'),
      env: {
        ATLAS_BUCKET: legacyBucket({ pieces: [] }),
        ATLAS_CANONICAL_URL: 'https://preview.adrianrasmussen.com/public-atlas',
      },
    } as never);

    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://preview.adrianrasmussen.com/public-atlas',
      }),
    );
  });

  it('fails closed without fetching when the source points back to Mandala Codes', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    const response = await onRequestGet({
      request: new Request('https://mandalacodes.com/api/atlas'),
      env: {
        ATLAS_BUCKET: legacyBucket({ pieces: [] }),
        ATLAS_CANONICAL_URL: 'https://mandalacodes.com/api/atlas',
      },
    } as never);

    expect(fetch).not.toHaveBeenCalled();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'atlas_source_loop',
      destination: CANONICAL_ATLAS_URL,
    });
  });

  it('passes through canonical endpoint failures without falling back to legacy R2', async () => {
    const fetch = vi.fn(async () =>
      Response.json({ ok: false, error: 'unavailable' }, { status: 503 }),
    );
    vi.stubGlobal('fetch', fetch);
    const bucket = legacyBucket({ pieces: [{ pieceId: 'UL-1' }] });

    const response = await onRequestGet({
      request: new Request('https://mandalacodes.com/api/atlas'),
      env: { ATLAS_BUCKET: bucket },
    } as never);

    expect(response.status).toBe(503);
    expect(bucket.get).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'unavailable',
    });
  });

  it('implements public HEAD by fetching canonical JSON with GET and stripping the body', async () => {
    const fetch = vi.fn(async () =>
      Response.json({ ok: true, state: { pieces: [] } }, {
        headers: { 'X-Canonical-Atlas': 'true' },
      }),
    );
    vi.stubGlobal('fetch', fetch);

    const response = await onRequestHead({
      request: new Request('https://mandalacodes.com/api/atlas', { method: 'HEAD' }),
      env: {},
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({ url: CANONICAL_ATLAS_URL, method: 'GET' }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Canonical-Atlas')).toBe('true');
    await expect(response.text()).resolves.toBe('');
  });

  it('keeps public piece metadata alive from canonical state without rewriting historical R2', async () => {
    const art = FULL_ARCHIVE[0];
    const fetch = vi.fn(async () =>
      Response.json({
        ok: true,
        state: {
          pieces: [
            {
              pieceId: art.id,
              series: art.series,
              category: art.category,
            },
          ],
        },
      }),
    );
    vi.stubGlobal('fetch', fetch);
    const bucket = {
      get: vi.fn(async () => null),
      put: vi.fn(async () => null),
    };

    const response = await onRequestPieceGet({
      request: new Request(`https://mandalacodes.com/piece/${art.id}`),
      params: { path: [art.id] },
      env: {
        ATLAS_BUCKET: bucket,
        ASSETS: {
          fetch: vi.fn(async () =>
            new Response(
              '<title>Mandala Codes</title><meta name="description" content=""><meta property="og:title" content=""><meta property="og:description" content=""><meta property="og:image" content=""><meta property="og:image:width" content=""><meta property="og:image:height" content=""><meta name="twitter:title" content=""><meta name="twitter:description" content=""><meta name="twitter:image" content=""><meta name="twitter:card" content="">',
            ),
          ),
        },
      },
    } as never);

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({ url: CANONICAL_ATLAS_URL }),
    );
    expect(bucket.get).not.toHaveBeenCalled();
    expect(bucket.put).not.toHaveBeenCalled();
  });
});
