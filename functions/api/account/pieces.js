/**
 * GET /api/account/pieces
 *
 * Every physical piece the signed-in steward holds — the missing "all my
 * pieces" surface named in todo/plans/overarching-plan.md Track B2. Lives
 * under /api/account, not /api/atlas, so the atlas 410 boundary
 * (functions/api/atlas/_middleware.ts) never touches it: this is a plain
 * read of the shared D1 database, not a mutation of the retired Mandala
 * ledger.
 *
 * The canonical collector-binding table is `keeper_pieces`, owned by
 * Adrian-Website (migrations/008_living_legacy.sql onward) in the SAME D1
 * database this site already binds as `DB` (identical database_id in both
 * wrangler.toml files). `keeper_user_id` is the Better Auth user id
 * directly — the same id requireUser() resolves here, because both sites'
 * Better Auth instances share one `user` table in that database (see
 * overarching-plan.md: "the same email resolves to one account row").
 *
 * Read-only. No writes happen on mandalacodes for this surface.
 */

import { FULL_ARCHIVE } from '../../../data/mockData';
import { img } from '../../../utils/media';
import { requireUser } from '../_lib/auth.js';

/** True when a D1 error means the shared migrations haven't landed yet. */
function isMissingTableError(err) {
  return err instanceof Error && /no such table/i.test(err.message);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function artworkFor(pieceId) {
  return FULL_ARCHIVE.find((a) => a.id === pieceId) ?? null;
}

export async function onRequestGet(context) {
  const { request, env } = context;

  if (!env.DB) return json({ ok: false, error: 'pieces_unavailable' }, 503);

  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;

  let pieceRows;
  try {
    const result = await env.DB
      .prepare(
        `SELECT id, piece_id, edition_number, current_display_location, claimed_at
           FROM keeper_pieces
          WHERE keeper_user_id = ?1 AND released_at IS NULL
          ORDER BY claimed_at DESC`,
      )
      .bind(auth.userId)
      .all();
    pieceRows = result.results ?? [];
  } catch (err) {
    if (isMissingTableError(err)) return json({ ok: false, error: 'pieces_unavailable' }, 503);
    return json({ ok: false, error: 'pieces_unavailable' }, 500);
  }

  // Check the companion schema even for a steward with no pieces. A missing
  // table means the shared binding is unavailable, not an empty collection.
  try {
    await env.DB.prepare('SELECT 1 FROM keeper_intentions LIMIT 1').all();
  } catch (err) {
    return json({ ok: false, error: 'pieces_unavailable' }, isMissingTableError(err) ? 503 : 500);
  }

  if (pieceRows.length === 0) return json({ ok: true, pieces: [] });

  // Latest confirmed, non-erased intention per (piece_id, edition_number),
  // narrowed to just this steward's pieces with a row-value IN list (plain
  // SQLite, supported by D1). "Latest per group" is picked in JS below
  // rather than in SQL — simplest thing that works for a steward's small
  // piece count, no window-function dependency.
  let intentionByPiece = new Map();
  try {
    const pairs = pieceRows.map(() => '(?,?)').join(',');
    const params = pieceRows.flatMap((r) => [r.piece_id, r.edition_number]);
    const rows = await env.DB
      .prepare(
        `SELECT piece_id, edition_number, kind, body, created_at
           FROM keeper_intentions
          WHERE confirmed_at IS NOT NULL AND erased_at IS NULL
            AND (piece_id, edition_number) IN (${pairs})
          ORDER BY created_at DESC`,
      )
      .bind(...params)
      .all();
    for (const row of rows.results ?? []) {
      const key = `${row.piece_id}:${row.edition_number}`;
      if (!intentionByPiece.has(key)) intentionByPiece.set(key, row);
    }
  } catch (err) {
    return json({ ok: false, error: 'pieces_unavailable' }, isMissingTableError(err) ? 503 : 500);
  }

  const pieces = pieceRows.map((row) => {
    const artwork = artworkFor(row.piece_id);
    const key = `${row.piece_id}:${row.edition_number}`;
    const intention = intentionByPiece.get(key) ?? null;
    return {
      id: row.id,
      pieceId: row.piece_id,
      editionNumber: row.edition_number,
      title: artwork ? artwork.title.replace(/\s*-\s*\d+$/, '') : row.piece_id,
      cardNumber: artwork?.cardNumber ?? null,
      artworkImage: artwork ? img(artwork.coverImage, { w: 640 }) : null,
      restsIn: row.current_display_location || null,
      intention: intention ? intention.body : null,
      claimedAt: row.claimed_at,
    };
  });

  return json({ ok: true, pieces });
}
