/**
 * POST /api/atlas/sales/dismiss — drop a pending sale from the queue (M4).
 *
 * Admin-only. Body: { saleId, reason? }. The row stays in D1 as evidence
 * (status 'dismissed', the optional reason recorded beside it) — a
 * dismissed sale never touched the ledger or steward records, so there is
 * nothing else to undo.
 */

import type { PagesContext } from '../_helpers';
import { isMissingTableError, json, migrationNotApplied } from '../_helpers';
import { requireAdmin, isAuthResponse } from '../../_lib/auth';

const REASON_MAX = 500;

interface DismissBody {
  saleId?: unknown;
  reason?: unknown;
}

export async function onRequestPost(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireAdmin(request, env);
  if (isAuthResponse(auth)) return auth;

  if (!env.DB) return migrationNotApplied();
  const db = env.DB;

  let body: DismissBody;
  try {
    body = (await request.json()) as DismissBody;
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const saleId = typeof body.saleId === 'string' ? body.saleId.trim() : '';
  if (!saleId) return json({ ok: false, error: 'Missing saleId' }, 400);
  if (body.reason !== undefined && typeof body.reason !== 'string') {
    return json({ ok: false, error: 'reason must be a string' }, 400);
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (reason.length > REASON_MAX) {
    return json(
      { ok: false, error: `reason must be at most ${REASON_MAX} characters` },
      400,
    );
  }

  try {
    const result = await db
      .prepare(
        `UPDATE atlas_sale_events
         SET status = 'dismissed', confirmed_at = unixepoch(),
             dismissed_reason = ?2
         WHERE sale_id = ?1 AND status = 'pending'`,
      )
      .bind(saleId, reason || null)
      .run();
    if ((result.meta?.changes ?? 0) === 0) {
      return json({ ok: false, error: 'No pending sale with that id' }, 404);
    }
    return json({ ok: true });
  } catch (err) {
    if (isMissingTableError(err)) return migrationNotApplied();
    throw err;
  }
}
