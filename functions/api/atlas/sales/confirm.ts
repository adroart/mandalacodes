/**
 * POST /api/atlas/sales/confirm — turn a pending sale into ledger reality
 * (M4). Admin-only; this human click IS the trust boundary the webhook
 * deliberately lacks (ratified: no auto-fire).
 *
 * Body: { saleId, pieceId, editionNumber?, pieceType? }
 *   pieceId/editionNumber come from the admin (prefilled in the UI from
 *   the payload's pieceId/sku when present) — the webhook's word alone
 *   never decides which piece changes hands.
 *
 * Three cases, by the piece's steward state:
 *
 *   1. No steward record → FIRST SALE: issue a steward record seeded with
 *      the buyer's email/name (shared issueStewardRecord — same dedupe as
 *      the manual issue endpoint), and append a genesis `created` event
 *      (with pieceType when given) if the piece has no chain yet. The
 *      buyer then claims via the normal /atlas/claim flow.
 *
 *   2. Unbound steward record (no clerkUserId) → a pre-issuance hint, not
 *      an identity binding. If it already carries the buyer's email this
 *      is a confirm retry — reuse it. Otherwise replace it with the
 *      buyer's record: equivalent to the revoke + re-issue the admin could
 *      always do manually; the audited transfer path is reserved for
 *      records with a BOUND clerkUserId.
 *
 *   3. Bound steward record → SECONDARY SALE: the audited transferred +
 *      rebind path (_transfer.ts). transferKind 'sale', fromRef = the old
 *      holder's clerkUserId, toRef = pendingTransferRef(saleId) — see that
 *      function's doc for what the refs mean before the buyer claims.
 *
 * In every case buyerEmail/buyerName seed the MUTABLE steward record only
 * and the price stays in D1 — nothing from the sale payload enters a
 * hashed payload or the public projection (chain content invariant).
 *
 * Finally the row flips to 'confirmed' with the piece it was confirmed
 * against (edition normalized to the chain-key convention ?? 0, so the
 * steward-book price join is exact).
 */

import type { LedgerEvent, StewardRecord } from '../../../../types';
import { appendEvent, groupChains } from '../../../../utils/ledger';
import {
  buildSaleGenesisDraft,
  pendingTransferRef,
} from '../../../../utils/saleBridge';
import type { SaleEventRow } from '../../../../utils/saleBridge';
import type { PagesContext } from '../_helpers';
import {
  isMissingTableError,
  issueStewardRecord,
  json,
  migrationNotApplied,
  mutateLedger,
  mutateStewards,
  readStewards,
  regeneratePublicState,
} from '../_helpers';
import { executeTransfer, rebindStewardRecord } from '../_transfer';
import {
  claimInviteEmailBody,
  claimInviteEmailSubject,
  sendLetterEmail,
} from '../_email';
import type { LetterEmailEnv } from '../_email';
import { FULL_ARCHIVE } from '../../../../data/mockData';
import { requireAdmin, isAuthResponse } from '../../_lib/auth';

interface ConfirmBody {
  saleId?: unknown;
  pieceId?: unknown;
  editionNumber?: unknown;
  pieceType?: unknown;
}

export async function onRequestPost(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireAdmin(request, env);
  if (isAuthResponse(auth)) return auth;

  if (!env.DB) return migrationNotApplied();
  const db = env.DB;

  let body: ConfirmBody;
  try {
    body = (await request.json()) as ConfirmBody;
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const saleId = typeof body.saleId === 'string' ? body.saleId.trim() : '';
  if (!saleId) return json({ ok: false, error: 'Missing saleId' }, 400);
  const pieceId = typeof body.pieceId === 'string' ? body.pieceId.trim() : '';
  if (!pieceId) return json({ ok: false, error: 'Missing pieceId' }, 400);
  const editionNumber =
    typeof body.editionNumber === 'number' ? body.editionNumber : undefined;
  if (
    editionNumber !== undefined &&
    (!Number.isInteger(editionNumber) || editionNumber < 0)
  ) {
    return json({ ok: false, error: 'Invalid editionNumber' }, 400);
  }
  if (
    body.pieceType !== undefined &&
    body.pieceType !== 'mandala' &&
    body.pieceType !== 'other'
  ) {
    return json({ ok: false, error: 'Invalid pieceType' }, 400);
  }
  const pieceType = body.pieceType as 'mandala' | 'other' | undefined;

  let sale: SaleEventRow | null;
  try {
    sale = await db
      .prepare('SELECT * FROM atlas_sale_events WHERE sale_id = ?1')
      .bind(saleId)
      .first<SaleEventRow>();
  } catch (err) {
    if (isMissingTableError(err)) return migrationNotApplied();
    throw err;
  }
  if (!sale) return json({ ok: false, error: 'No such sale' }, 404);
  if (sale.status !== 'pending') {
    return json({ ok: false, error: `Sale already ${sale.status}` }, 409);
  }

  const buyerEmail = sale.buyer_email;
  const buyerName = sale.buyer_name ?? undefined;
  const now = new Date().toISOString();

  const stewards = await readStewards(env);
  const existing = stewards.find(
    (s) =>
      s.pieceId === pieceId &&
      (s.editionNumber ?? undefined) === (editionNumber ?? undefined),
  );

  let steward: StewardRecord;
  let transferEvent: LedgerEvent | null = null;
  if (existing?.clerkUserId) {
    // Case 3 — secondary sale of a CLAIMED piece: the audited transferred +
    // rebind path. The buyer has no auth userId yet; the chain records the
    // opaque sale ref (see pendingTransferRef) and the rebound record binds
    // their identity on first sign-in via the normal claim flow.
    const outcome = await executeTransfer(env, {
      event: {
        pieceId,
        editionNumber,
        actor: 'admin',
        actorRef: auth.userId,
        fromRef: existing.clerkUserId,
        toRef: pendingTransferRef(saleId),
        transferKind: 'sale',
      },
      rebind: {
        email: buyerEmail,
        ...(buyerName ? { name: buyerName } : {}),
      },
    });
    if (outcome instanceof Response) return outcome;
    steward = outcome.steward;
    transferEvent = outcome.event;
  } else if (existing && (existing.email ?? '').toLowerCase() === buyerEmail.toLowerCase()) {
    // Case 2a — unbound record already issued to this buyer: a confirm
    // retry (or the admin beat the webhook). Reuse it.
    steward = existing;
  } else if (existing) {
    // Case 2b — unbound record issued to a DIFFERENT email. Replace it:
    // an unbound record is a pre-issuance hint, never an identity binding,
    // so this equals the revoke + re-issue the admin could do manually.
    // Records with a bound clerkUserId never reach this branch.
    const outcome = await mutateStewards(env, (current) => {
      const idx = current.findIndex(
        (s) =>
          s.pieceId === pieceId &&
          (s.editionNumber ?? undefined) === (editionNumber ?? undefined),
      );
      if (idx !== -1 && current[idx].clerkUserId) {
        // Re-validated against fresh state: someone bound it meanwhile.
        return json(
          { ok: false, error: 'Piece was claimed while confirming — retry to transfer instead' },
          409,
        );
      }
      const record = rebindStewardRecord(
        idx === -1 ? undefined : current[idx],
        pieceId,
        editionNumber,
        { email: buyerEmail, ...(buyerName ? { name: buyerName } : {}) },
        now,
      );
      const next = current.slice();
      if (idx === -1) next.push(record);
      else next[idx] = record;
      return { next, result: record };
    });
    if (outcome instanceof Response) return outcome;
    steward = outcome.result;
  } else {
    // Case 1 — first sale, no record: shared issuance (same dedupe as the
    // manual issue endpoint, re-validated inside the mutator).
    const outcome = await issueStewardRecord(env, {
      pieceId,
      editionNumber,
      email: buyerEmail,
      ...(buyerName ? { name: buyerName } : {}),
    });
    if (outcome instanceof Response) return outcome;
    steward = outcome.result;
  }

  // Genesis: a brand-new piece gets its `created` event so the claim flow
  // has a chain to land on. Dated NOW (saleDate stays in D1 — backdating
  // would corrupt chain ordering); pieceType rides on genesis only.
  // Existing chains are untouched — the transfer above (case 3) is already
  // their entry, and cases 1/2 only need a chain if none exists.
  let genesisEvent: LedgerEvent | null = null;
  if (!transferEvent) {
    const ledgerOutcome = await mutateLedger<LedgerEvent | null>(env, async (events) => {
      const chain = groupChains(events).get(`${pieceId}:${editionNumber ?? 0}`);
      if (chain && chain.length > 0) return { next: events, result: null };
      const draft = buildSaleGenesisDraft({
        pieceId,
        editionNumber,
        actorRef: auth.userId,
        ...(pieceType ? { pieceType } : {}),
        now,
      });
      const full = await appendEvent([], draft);
      return { next: [...events, full], result: full };
    });
    if (ledgerOutcome instanceof Response) return ledgerOutcome;
    genesisEvent = ledgerOutcome.result;
    if (genesisEvent) {
      await regeneratePublicState(env, ledgerOutcome.next);
    }
  }

  // Flip the row last: if anything above failed, the sale stays pending
  // and the confirm can be retried (every branch is retry-safe).
  try {
    await db
      .prepare(
        `UPDATE atlas_sale_events
         SET status = 'confirmed', confirmed_at = unixepoch(),
             piece_id = ?2, edition_number = ?3
         WHERE sale_id = ?1 AND status = 'pending'`,
      )
      .bind(saleId, pieceId, editionNumber ?? 0)
      .run();
  } catch (err) {
    if (isMissingTableError(err)) return migrationNotApplied();
    throw err;
  }

  // Tell the buyer their piece is ready to claim. Fire-and-forget, same
  // pattern as _letters.ts: never awaited on the response path, and every
  // failure mode is swallowed inside the helper (the void + catch is belt
  // and braces). Sent from all three steward branches above. Known
  // acceptable duplicate: case 2a is a confirm retry, so a retried confirm
  // re-sends this invite; confirms are rare admin actions, no dedupe state.
  const pieceTitle = FULL_ARCHIVE.find((a) => a.id === pieceId)
    ?.title.replace(/\s*-\s*\d+$/, '');
  void sendLetterEmail(env as unknown as LetterEmailEnv, {
    to: buyerEmail,
    subject: claimInviteEmailSubject('sale'),
    body: claimInviteEmailBody('sale', pieceTitle),
  }).catch(() => undefined);

  return json({
    ok: true,
    steward,
    ...(transferEvent ? { event: transferEvent } : {}),
    ...(genesisEvent ? { event: genesisEvent } : {}),
  });
}
