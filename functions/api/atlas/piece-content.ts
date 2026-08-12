/**
 * GET /api/atlas/piece-content?pieceId=…
 *
 * Public, no auth. Reads the admin-authored editorial row for one piece
 * (story, extra photos, materials, provenance) from `atlas_piece_content` —
 * see todo/handoff/adrian-website/004_piece_content.sql and the "Piece-page
 * content" decision record in todo/handoff/GO-LIVE-RUNBOOK.md. PiecePage.tsx
 * merges the result over the static FULL_ARCHIVE fields.
 *
 * Degrades to an empty result — never a 503 — on every failure mode: no
 * pieceId, no DB binding, the 004 migration not yet applied, no row for this
 * piece, or a malformed row. Unlike the admin write endpoint, a public piece
 * page must never break because the editorial layer isn't there yet.
 *
 * Cached for 60s, same convention as GET /api/atlas.
 */

import type { PagesContext } from './_helpers';
import { isMissingTableError, json } from './_helpers';
import { rowToPieceContent, type PieceContentRow } from '../../../utils/pieceContent';

type CacheAwareContext = PagesContext & {
  waitUntil?: (promise: Promise<unknown>) => void;
};

function storeAtEdge(
  context: CacheAwareContext,
  cache: Cache | null,
  response: Response,
): Response {
  if (cache && context.waitUntil) {
    context.waitUntil(cache.put(context.request, response.clone()).catch(() => undefined));
  }
  return response;
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  const url = new URL(request.url);
  const pieceId = url.searchParams.get('pieceId') ?? '';
  if (!pieceId) return json({ ok: false, error: 'Missing pieceId' }, 400);

  // The Cache API is a derived edge cache, not application state. It keeps a
  // hot public piece from querying D1 on every request and fails open where
  // the Pages preview/local runtime does not expose `caches.default`.
  let edgeCache: Cache | null = null;
  try {
    edgeCache =
      typeof caches === 'undefined'
        ? null
        : (caches as unknown as { default: Cache }).default;
    const cached = edgeCache ? await edgeCache.match(request) : undefined;
    if (cached) return cached;
  } catch {
    edgeCache = null;
  }

  // Cloudflare's shared edge cache absorbs repeated public lookups without
  // writing D1 rate-limit counters on GET. Browsers keep a short copy; the
  // edge may hold it for five minutes and serve stale during revalidation.
  const cacheHeaders = {
    'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400',
    'CDN-Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
  };

  // No D1 / migration not applied → degrade to an empty result, not a 503:
  // the piece page must render fine before this table ever exists.
  if (!env.DB) {
    return storeAtEdge(
      context as CacheAwareContext,
      edgeCache,
      json({ ok: true, content: null }, 200, cacheHeaders),
    );
  }

  let row: PieceContentRow | null = null;
  try {
    row = await env.DB.prepare(
      `SELECT piece_id, story, materials, images, provenance, updated_at
         FROM atlas_piece_content
        WHERE piece_id = ?1`,
    )
      .bind(pieceId)
      .first<PieceContentRow>();
  } catch (err) {
    if (isMissingTableError(err)) {
      return storeAtEdge(
        context as CacheAwareContext,
        edgeCache,
        json({ ok: true, content: null }, 200, cacheHeaders),
      );
    }
    throw err;
  }

  if (!row) {
    return storeAtEdge(
      context as CacheAwareContext,
      edgeCache,
      json({ ok: true, content: null }, 200, cacheHeaders),
    );
  }

  return storeAtEdge(
    context as CacheAwareContext,
    edgeCache,
    json({ ok: true, content: rowToPieceContent(row) }, 200, cacheHeaders),
  );
}
