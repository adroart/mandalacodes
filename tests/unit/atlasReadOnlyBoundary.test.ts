import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { onRequest } from '../../functions/api/atlas/_middleware';

const CANONICAL_ATLAS_URL = 'https://adrianrasmussen.com/api/atlas';

function middlewareContext(
  method: string,
  path = '/api/atlas/steward/claim',
  env: { ATLAS_CANONICAL_URL?: string } = {},
) {
  const next = vi.fn(async () => new Response('continued', { status: 200 }));
  return {
    context: {
      request: new Request(`https://mandalacodes.com${path}`, { method }),
      env,
      next,
    },
    next,
  };
}

describe('Atlas read-only boundary', () => {
  it('is installed as Pages middleware for the complete /api/atlas subtree', async () => {
    const source = await readFile(
      resolve('functions/api/atlas/_middleware.ts'),
      'utf8',
    ).catch(() => '');

    expect(source).toContain('export async function onRequest');
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'PROPFIND'])(
    'rejects %s before any Atlas route can write',
    async (method) => {
      const { context, next } = middlewareContext(method);

      const response = await onRequest(context);

      expect(next).not.toHaveBeenCalled();
      expect(response.status).toBe(410);
      expect(response.headers.get('Allow')).toBe('GET, HEAD, OPTIONS');
      expect(response.headers.get('Link')).toBe(
        `<${CANONICAL_ATLAS_URL}>; rel="canonical"`,
      );
      await expect(response.json()).resolves.toEqual({
        ok: false,
        error: 'atlas_moved',
        message:
          'The Atlas collector record moved to Adrian-Website and is read-only on Mandala Codes.',
        readOnly: true,
        movedAt: '2026-08-09',
        destination: CANONICAL_ATLAS_URL,
      });
    },
  );

  it.each([
    '/api/atlas',
    '/api/atlas/card/UL-1',
    '/api/atlas/piece-content?pieceId=UL-1',
  ])('continues the surviving canonical public GET %s', async (path) => {
      const { context, next } = middlewareContext('GET', path);

      const response = await onRequest(context);

      expect(next).toHaveBeenCalledOnce();
      expect(response.status).toBe(200);
  });

  it.each([
    '/api/atlas/steward/certificate?piece=UL-1',
    '/api/atlas/steward/inscriptions?pieceId=UL-1',
    '/api/atlas/steward/export?pieceId=UL-1',
    '/api/atlas/steward/letters?pieceId=UL-1',
    '/api/atlas/holder-chart?pieceId=UL-1',
    '/api/atlas/stewards',
    '/api/atlas/claim-requests',
    '/api/atlas/steward/claim-requests',
    '/api/atlas/catalog',
    '/api/atlas/catalog/admin',
    '/api/atlas/make',
    '/api/atlas/homecoming',
    '/api/atlas/intentions',
    '/api/atlas/sales',
    '/api/atlas/admin/piece-content?pieceId=UL-1',
  ])('retires legacy Atlas GET %s before frozen authority can be read', async (path) => {
    const { context, next } = middlewareContext('GET', path);

    const response = await onRequest(context);

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toBe(410);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'atlas_reader_moved',
      destination: CANONICAL_ATLAS_URL,
    });
  });

  it('retires legacy HEAD without a response body', async () => {
    const { context, next } = middlewareContext(
      'HEAD',
      '/api/atlas/steward/certificate?piece=UL-1',
    );

    const response = await onRequest(context);

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toBe(410);
    await expect(response.text()).resolves.toBe('');
  });

  it('answers OPTIONS without invoking a write handler', async () => {
    const { context, next } = middlewareContext('OPTIONS');

    const response = await onRequest(context);

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toBe(204);
    expect(response.headers.get('Allow')).toBe('GET, HEAD, OPTIONS');
  });

  it('names the configured canonical endpoint in the moved response', async () => {
    const destination = 'https://preview.adrianrasmussen.com/public-atlas';
    const { context } = middlewareContext('POST', '/api/atlas/event', {
      ATLAS_CANONICAL_URL: destination,
    });

    const response = await onRequest(context);

    await expect(response.json()).resolves.toMatchObject({ destination });
    expect(response.headers.get('Link')).toBe(
      `<${destination}>; rel="canonical"`,
    );
  });

  it('does not mutate frozen steward evidence from account deletion', async () => {
    const authSource = await readFile(resolve('lib/account/auth.server.js'), 'utf8');

    expect(authSource).not.toContain('unbindStewardsForUser');
  });
});
