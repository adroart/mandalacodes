/**
 * POST /api/atlas/inscriptions/erase — the legal escape hatch (M3).
 *
 * ADMIN-ONLY, by design and by ratified decision: the history lives with
 * the piece forever, so there is NO self-serve erasure for stewards. This
 * endpoint exists solely to honor an explicit legal data-erasure demand.
 *
 * Body: { inscriptionId, reason }
 *
 * What it does:
 *   - deletes the body AND the content salt from the D1 row — without the
 *     salt, the chain's SHA-256(salt || body) commitment becomes
 *     unlinkable: it matches nothing recomputable from any text,
 *   - sets erased_at and logs the reason into erase_reason (admin-only;
 *     never returned to stewards),
 *   - appends NOTHING to the chain. The commitment stays; every hash stays
 *     valid; the steward-facing projection simply shows the tombstone
 *     ("[entry removed]").
 *
 * Idempotent: erasing an already-erased entry succeeds without rewriting
 * the original erased_at.
 */

import type { PagesContext } from '../_helpers';
import {
  isMissingTableError,
  json,
  migrationNotApplied,
} from '../_helpers';
import { selectInscription } from '../_inscriptions';
import { requireAdmin, isAuthResponse } from '../../_lib/clerk';

export async function onRequestPost(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireAdmin(request, env);
  if (isAuthResponse(auth)) return auth;

  if (!env.DB) return migrationNotApplied();
  const db = env.DB;

  let body: { inscriptionId?: unknown; reason?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const inscriptionId =
    typeof body.inscriptionId === 'string' ? body.inscriptionId : '';
  if (!inscriptionId) {
    return json({ ok: false, error: 'Missing inscriptionId' }, 400);
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!reason) {
    return json(
      { ok: false, error: 'Missing reason — legal erasures must be justified' },
      400,
    );
  }

  try {
    const row = await selectInscription(db, inscriptionId);
    if (!row) {
      return json({ ok: false, error: 'No such inscription' }, 404);
    }
    if (row.erased_at) {
      // Already a tombstone — idempotent success, original audit kept.
      return json({ ok: true, inscriptionId, erasedAt: row.erased_at });
    }
    const erasedAt = new Date().toISOString();
    await db
      .prepare(
        `UPDATE atlas_inscriptions
         SET body = NULL, content_salt = NULL, erased_at = ?2, erase_reason = ?3
         WHERE id = ?1`,
      )
      .bind(inscriptionId, erasedAt, reason)
      .run();
    return json({ ok: true, inscriptionId, erasedAt });
  } catch (err) {
    if (isMissingTableError(err)) return migrationNotApplied();
    throw err;
  }
}
