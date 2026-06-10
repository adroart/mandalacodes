/**
 * POST /api/atlas/sale — the sale → ledger bridge webhook (M4).
 *
 * Machine auth, no Clerk: adrianrasmussen.com calls this on checkout
 * success with
 *   X-Sale-Timestamp: unix seconds
 *   X-Sale-Signature: hex(HMAC-SHA256(SALE_WEBHOOK_SECRET, ts + "." + rawBody))
 * verified with a constant-time comparison and a ±5-minute replay window.
 * Any auth failure answers a detail-free 401 — no oracle for an attacker
 * probing the secret. (Full recipe + worked example:
 * todo/handoff/adrian-website/sale-webhook-spec.md.)
 *
 * The verified payload lands as a PENDING row in D1 atlas_sale_events
 * (INSERT OR IGNORE on saleId — replays and retries are idempotent). This
 * endpoint NEVER writes the ledger or steward records: confirmation is
 * always an explicit admin action via /api/atlas/sales/confirm (ratified —
 * a forged webhook must never grant ownership; at worst it enqueues a row
 * the admin dismisses). buyerEmail and price are D1-only, never chain,
 * never public.
 *
 * Degrades with 503 until SALE_WEBHOOK_SECRET is provisioned and the
 * 003_atlas_legacy D1 migration is applied.
 */

import { parseSalePayload, verifySaleWebhook } from '../../../utils/saleBridge';
import type { PagesContext } from './_helpers';
import { isMissingTableError, json, migrationNotApplied } from './_helpers';

export async function onRequestPost(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const secret = env.SALE_WEBHOOK_SECRET;
  if (!secret) {
    return json(
      { ok: false, error: 'Sale bridge not configured (SALE_WEBHOOK_SECRET missing)' },
      503,
    );
  }
  if (!env.DB) return migrationNotApplied();
  const db = env.DB;

  // The signature covers the RAW body — read it before any parsing.
  const rawBody = await request.text();
  const verified = await verifySaleWebhook(
    secret,
    request.headers.get('X-Sale-Timestamp'),
    request.headers.get('X-Sale-Signature'),
    rawBody,
    Date.now(),
  );
  if (!verified) {
    // Deliberately detail-free: stale timestamp, bad signature, and wrong
    // secret are indistinguishable to the caller.
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }
  // `=== false` so the union narrows even without strictNullChecks (this
  // file is typechecked via the unit suite's import).
  const payload = parseSalePayload(parsedBody);
  if (payload.ok === false) return json({ ok: false, error: payload.error }, 400);
  const sale = payload.value;

  // Idempotent enqueue: saleId is the primary key, so a retry/replay of an
  // already-received sale changes nothing and reports 'duplicate'.
  // raw_json stores the VERIFIED payload as dispute evidence.
  try {
    const result = await db
      .prepare(
        `INSERT OR IGNORE INTO atlas_sale_events
           (sale_id, sku, piece_id, edition_number, buyer_email, buyer_name,
            sale_date, price_cents, currency, status, raw_json)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'pending', ?10)`,
      )
      .bind(
        sale.saleId,
        sale.sku ?? null,
        sale.pieceId ?? null,
        sale.editionNumber ?? null,
        sale.buyerEmail,
        sale.buyerName ?? null,
        sale.saleDate,
        sale.priceCents ?? null,
        sale.currency ?? null,
        rawBody,
      )
      .run();
    const inserted = (result.meta?.changes ?? 0) > 0;
    return json({ ok: true, status: inserted ? 'queued' : 'duplicate' });
  } catch (err) {
    if (isMissingTableError(err)) return migrationNotApplied();
    throw err;
  }
}
