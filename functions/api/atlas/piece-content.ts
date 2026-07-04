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
 * Rate limited per IP like /api/atlas/holder-chart, so a scraper can't grind
 * through every pieceId. Cached for 60s, same convention as GET /api/atlas.
 */

import type { PagesContext } from './_helpers';
import { isMissingTableError, json } from './_helpers';
import { rowToPieceContent, type PieceContentRow } from '../../../utils/pieceContent';
import { checkRateLimit, clientIp, tooManyRequests } from '../_lib/rate-limit.js';

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  const { ok: withinLimit, retryAfterSec } = await checkRateLimit(
    env,
    `atlas:piece-content:${clientIp(request)}`,
    { limit: 120, windowMs: 60 * 60 * 1000 },
  );
  if (!withinLimit) return tooManyRequests(retryAfterSec);

  const url = new URL(request.url);
  const pieceId = url.searchParams.get('pieceId') ?? '';
  if (!pieceId) return json({ ok: false, error: 'Missing pieceId' }, 400);

  const cacheHeaders = { 'Cache-Control': 'public, max-age=60' };

  // No D1 / migration not applied → degrade to an empty result, not a 503:
  // the piece page must render fine before this table ever exists.
  if (!env.DB) return json({ ok: true, content: null }, 200, cacheHeaders);

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
    if (isMissingTableError(err)) return json({ ok: true, content: null }, 200, cacheHeaders);
    throw err;
  }

  if (!row) return json({ ok: true, content: null }, 200, cacheHeaders);

  return json({ ok: true, content: rowToPieceContent(row) }, 200, cacheHeaders);
}
