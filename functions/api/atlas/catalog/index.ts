/**
 * GET /api/atlas/catalog
 *
 * Public, no auth. The merged catalog's PUBLIC face: every R2 catalog entry
 * projected to its safe fields (utils/catalog.toPublicCatalogEntry) — id,
 * title, kind, series, year, dimensions, material, coverImage, images, status,
 * cityId, and price + acquireUrl ONLY when the piece is 'available'.
 *
 * NEVER keeperEmail, NEVER notes — the chain/privacy invariant holds here as
 * everywhere. Cacheable briefly, like /api/atlas.
 */

import type { PagesContext } from '../_helpers';
import { readCatalog } from '../_helpers';
import { toPublicCatalogEntry } from '../../../../utils/catalog';

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { env } = context;

  const catalog = await readCatalog(env);
  const entries = catalog.entries.map(toPublicCatalogEntry);

  return new Response(JSON.stringify({ ok: true, entries }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    },
  });
}
