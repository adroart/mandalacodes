/**
 * GET /api/atlas/sales — the admin sale queue (M4).
 *
 * Admin-only. Returns every PENDING sale event plus the recently resolved
 * (confirmed/dismissed) tail for context. Buyer identity and price are
 * D1-only data, visible here because the admin is the master ledger
 * holder (ratified); raw_json (the verified webhook payload) is withheld —
 * it is dispute evidence, not dashboard data.
 *
 * Degrades with 503 until the 003_atlas_legacy D1 migration is applied.
 */

import { toSaleQueueItem } from '../../../../utils/saleBridge';
import type { SaleEventRow } from '../../../../utils/saleBridge';
import type { PagesContext } from '../_helpers';
import { isMissingTableError, json, migrationNotApplied } from '../_helpers';
import { requireAdmin, isAuthResponse } from '../../_lib/clerk';

/** How many resolved rows ride along with the pending queue. */
const RECENT_RESOLVED_LIMIT = 10;

export async function onRequestGet(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireAdmin(request, env);
  if (isAuthResponse(auth)) return auth;

  if (!env.DB) return migrationNotApplied();
  const db = env.DB;

  try {
    const pending = await db
      .prepare(
        `SELECT * FROM atlas_sale_events
         WHERE status = 'pending'
         ORDER BY received_at DESC, sale_id ASC`,
      )
      .all<SaleEventRow>();
    const resolved = await db
      .prepare(
        `SELECT * FROM atlas_sale_events
         WHERE status != 'pending'
         ORDER BY confirmed_at DESC, received_at DESC
         LIMIT ?1`,
      )
      .bind(RECENT_RESOLVED_LIMIT)
      .all<SaleEventRow>();

    return json({
      ok: true,
      pending: pending.results.map(toSaleQueueItem),
      resolved: resolved.results.map(toSaleQueueItem),
    });
  } catch (err) {
    if (isMissingTableError(err)) return migrationNotApplied();
    throw err;
  }
}
