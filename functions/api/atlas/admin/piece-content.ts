/**
 * POST /api/atlas/admin/piece-content
 *
 * Admin-only. Upserts the editorial row for one piece — story, extra
 * photos, materials, provenance — into `atlas_piece_content` (see
 * todo/handoff/adrian-website/004_piece_content.sql). This is the "admin
 * editor" half of the ratified piece-page content decision
 * (todo/handoff/GO-LIVE-RUNBOOK.md, "Piece-page content: D1 editorial
 * table + admin editor"): editorial content lives ONLY in this mutable D1
 * table, never in the hash chain or the ledger.
 *
 * Body: { pieceId, story?, materials?, provenance?, images? }
 * `story`/`materials`/`provenance` are free text; an empty/whitespace-only
 * string clears that field. `images` is a list of Cloudinary public ids
 * (see utils/cloudinary.ts), capped at 12.
 */

import type { PagesContext } from '../_helpers';
import { isMissingTableError, json, migrationNotApplied } from '../_helpers';
import { requireAdmin, isAuthResponse } from '../../_lib/auth';
import { FULL_ARCHIVE } from '../../../../data/mockData';
import {
  rowToPieceContent,
  serializeImages,
  validatePieceContentInput,
  type PieceContentRow,
} from '../../../../utils/pieceContent';

const KNOWN_PIECE_IDS = new Set(FULL_ARCHIVE.map((a) => a.id));

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  const auth = await requireAdmin(request, env);
  if (isAuthResponse(auth)) return auth;

  if (!env.DB) return migrationNotApplied();
  const db = env.DB;

  let body: { pieceId?: unknown } & Record<string, unknown>;
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const pieceId = typeof body.pieceId === 'string' ? body.pieceId.trim() : '';
  if (!pieceId) return json({ ok: false, error: 'Missing pieceId' }, 400);
  if (!KNOWN_PIECE_IDS.has(pieceId)) {
    return json({ ok: false, error: 'Unknown pieceId — not in the archive' }, 400);
  }

  const validated = validatePieceContentInput(body);
  if (!validated.ok) return json({ ok: false, error: validated.error }, 400);
  const { story, materials, provenance, images } = validated.value;

  const updatedAt = new Date().toISOString();

  try {
    await db
      .prepare(
        `INSERT INTO atlas_piece_content (piece_id, story, materials, images, provenance, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(piece_id) DO UPDATE SET
           story = excluded.story,
           materials = excluded.materials,
           images = excluded.images,
           provenance = excluded.provenance,
           updated_at = excluded.updated_at`,
      )
      .bind(
        pieceId,
        story ?? null,
        materials ?? null,
        serializeImages(images),
        provenance ?? null,
        updatedAt,
      )
      .run();
  } catch (err) {
    if (isMissingTableError(err)) return migrationNotApplied();
    throw err;
  }

  const row: PieceContentRow = {
    piece_id: pieceId,
    story: story ?? null,
    materials: materials ?? null,
    images: serializeImages(images),
    provenance: provenance ?? null,
    updated_at: updatedAt,
  };

  return json({ ok: true, content: rowToPieceContent(row) });
}

/** GET /api/atlas/admin/piece-content?pieceId=… — admin-only read-back for
 *  the editor (so it can prefill on load without going through the public,
 *  rate-limited endpoint). Same degrade-to-null behavior as the public
 *  route when the migration hasn't landed, since the editor should still
 *  render (just empty) rather than error out pre-migration. */
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  const auth = await requireAdmin(request, env);
  if (isAuthResponse(auth)) return auth;

  const url = new URL(request.url);
  const pieceId = url.searchParams.get('pieceId') ?? '';
  if (!pieceId) return json({ ok: false, error: 'Missing pieceId' }, 400);

  if (!env.DB) return json({ ok: true, content: null });

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
    if (isMissingTableError(err)) return json({ ok: true, content: null });
    throw err;
  }

  if (!row) return json({ ok: true, content: null });
  return json({ ok: true, content: rowToPieceContent(row) });
}
