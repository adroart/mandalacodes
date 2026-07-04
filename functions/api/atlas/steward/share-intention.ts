/**
 * POST /api/atlas/steward/share-intention
 *
 * Let one intention-kind inscription ride publicly on the map, alone (M6,
 * Lens 2 — "the map of dreams"). Authenticated; the steward record for
 * (pieceId, editionNumber) must be bound to the bearer's userId.
 *
 * Body: { pieceId, editionNumber?, inscriptionId, share: boolean }
 *
 * Eligibility (utils/intentions.ts checkShareEligibility) — a SORT, not an
 * approval gate (Adrian, 2026-07-04: an approval step on someone's dream
 * demotes the project):
 *   - the inscription belongs to this (pieceId, editionNumber),
 *   - kind === 'intention' — words about a business, a place, or a name have
 *     their own homes and never ride the anonymous dream layer,
 *   - authored by the bearer,
 *   - not sealed (a time capsule stays private until it opens),
 *   - not erased.
 *
 * share:true cuts the display text to 280 characters (utils/intentions.ts
 * toDisplayText) and creates or revives the one live entry for this piece;
 * share:false withdraws it. Either way regenerates public state so the
 * globe's `intention` field follows immediately.
 *
 * Quality assurance happens AFTER sharing, via the admin tending queue
 * (GET /api/atlas/intentions, POST /api/atlas/intentions/tend) — never
 * before. Sharing is sorted at write time, not approved.
 */

import type { SharedIntention } from '../../../../types';
import { groupChains } from '../../../../utils/ledger';
import {
  checkShareEligibility,
  parseShareIntentionInput,
  planShareIntention,
  planWithdrawIntention,
  toDisplayText,
} from '../../../../utils/intentions';
import type { PagesContext } from '../_helpers';
import {
  isMissingTableError,
  json,
  migrationNotApplied,
  mutateSharedIntentions,
  readLedger,
  readStewards,
  regeneratePublicState,
} from '../_helpers';
import { chainKey, selectInscription } from '../_inscriptions';
import { requireUser, isAuthResponse } from '../../_lib/auth';

export async function onRequestPost(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireUser(request, env);
  if (isAuthResponse(auth)) return auth;
  const userId = auth.userId;

  if (!env.DB) return migrationNotApplied();
  const db = env.DB;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }
  const input = parseShareIntentionInput(raw);
  if (!input.ok) return json({ ok: false, error: input.error }, 400);
  const { pieceId, editionNumber, inscriptionId, share } = input.value;

  // Authorize: steward record for this piece, bound to this user.
  const stewards = await readStewards(env);
  const record = stewards.find(
    (s) =>
      s.pieceId === pieceId &&
      (s.editionNumber ?? undefined) === (editionNumber ?? undefined),
  );
  if (!record || record.clerkUserId !== userId) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }

  let row;
  try {
    row = await selectInscription(db, inscriptionId);
  } catch (err) {
    if (isMissingTableError(err)) return migrationNotApplied();
    throw err;
  }
  // The inscription must belong to THIS piece — an id valid for a different
  // chain must never be shareable here.
  if (
    row &&
    (row.piece_id !== pieceId || row.edition_number !== (editionNumber ?? 0))
  ) {
    row = null;
  }

  const now = new Date().toISOString();

  if (!share) {
    // Withdraw: no-op quietly if nothing is live (see planWithdrawIntention).
    // Ownership is still checked so a steward can't withdraw someone else's
    // entry by inscriptionId guessing — but a missing/foreign row simply
    // means "nothing of yours is live," not an error.
    if (!row || row.author_clerk_id !== userId) {
      return json({ ok: true, shared: false });
    }
    const outcome = await mutateSharedIntentions(env, (current) => ({
      next: planWithdrawIntention(current, inscriptionId),
      result: undefined,
    }));
    if (outcome instanceof Response) return outcome;
    const events = await readLedger(env);
    await regeneratePublicState(env, events);
    return json({ ok: true, shared: false });
  }

  // share:true — check eligibility against the piece's chain (for the seal
  // check) and the D1 row.
  const events = await readLedger(env);
  const chain = groupChains(events).get(chainKey(pieceId, editionNumber)) ?? [];
  const eligibility = checkShareEligibility(row, userId, chain, now);
  if (!eligibility.ok) {
    return json({ ok: false, error: eligibility.message }, 400);
  }

  const text = toDisplayText(row!.body as string);
  const outcome = await mutateSharedIntentions(env, (current) => ({
    next: planShareIntention(current, { pieceId, editionNumber, inscriptionId, text }, now),
    result: undefined,
  }));
  if (outcome instanceof Response) return outcome;

  const publicState = await regeneratePublicState(env, events);

  const entry: SharedIntention | undefined = outcome.next.find(
    (e) => e.inscriptionId === inscriptionId && e.status === 'live',
  );

  return json({
    ok: true,
    shared: true,
    entry: entry ?? null,
    // Convenience echo — the caller can confirm the globe will show this.
    livePubliclyMapped: publicState.pieces.some(
      (p) =>
        p.pieceId === pieceId &&
        (p.editionNumber ?? undefined) === (editionNumber ?? undefined) &&
        p.intention !== undefined,
    ),
  });
}
