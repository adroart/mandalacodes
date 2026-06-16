/**
 * GET /api/atlas/steward/inscriptions?pieceId=…&editionNumber=…
 *
 * Clerk-authenticated; the steward record for the piece must be bound to
 * the bearer's userId. Returns ALL inscriptions for the piece — ratified
 * erasure semantics: the history lives with the piece forever, so the
 * CURRENT steward (and every future one) reads the whole book, whoever
 * wrote each page. What they see per entry:
 *
 *   - erased entries (legal-erasure tombstones) → state 'erased', no body,
 *     no salt, no erase reason (that audit note is admin-only) — the UI
 *     renders "[entry removed]"; the chain commitment is untouched.
 *   - sealed entries (time capsules) → "sealed until <date>" or "sealed
 *     until the piece is passed on" WITHOUT the body — unless the
 *     requester authored it (the author may always reread their letter).
 *   - entries by previous stewards → attributed by role + generation
 *     derived from the chain ("first steward", "second steward"), never by
 *     name or email.
 *
 * Also runs the idempotent pendingFirstInscription conversion (M2 → M3),
 * so the claim-ritual answer surfaces as the book's first intention the
 * first time the steward opens their legacy view.
 */

import { groupChains } from '../../../../utils/ledger';
import { projectInscription } from '../../../../utils/inscriptions';
import type { PagesContext } from '../_helpers';
import {
  isMissingTableError,
  json,
  migrationNotApplied,
  readLedger,
  readStewards,
} from '../_helpers';
import {
  chainKey,
  convertPendingFirstInscription,
  selectInscriptionsForPiece,
} from '../_inscriptions';
import { requireUser, isAuthResponse } from '../../_lib/auth';

export async function onRequestGet(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireUser(request, env);
  if (isAuthResponse(auth)) return auth;
  const userId = auth.userId;

  if (!env.DB) return migrationNotApplied();
  const db = env.DB;

  const url = new URL(request.url);
  const pieceId = url.searchParams.get('pieceId') ?? '';
  if (!pieceId) return json({ ok: false, error: 'Missing pieceId' }, 400);
  const editionRaw = url.searchParams.get('editionNumber');
  const editionNumber =
    editionRaw !== null && editionRaw !== '' ? Number(editionRaw) : undefined;
  if (editionNumber !== undefined && !Number.isFinite(editionNumber)) {
    return json({ ok: false, error: 'Invalid editionNumber' }, 400);
  }

  // Authorize: bound steward only. The piece's book is the holder's —
  // never public, never another user's.
  const stewards = await readStewards(env);
  const record = stewards.find(
    (s) =>
      s.pieceId === pieceId &&
      (s.editionNumber ?? undefined) === (editionNumber ?? undefined),
  );
  if (!record || record.clerkUserId !== userId) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }

  // M2 → M3 conversion (idempotent; no-op for records without the field).
  let events = await readLedger(env);
  const converted = await convertPendingFirstInscription(env, record, events);
  if (converted instanceof Response) return converted;
  if (record.pendingFirstInscription) {
    // The conversion may have appended a chain event — re-read so the
    // freshly-landed entry projects with its commitment in view.
    events = await readLedger(env);
  }

  const chain = groupChains(events).get(chainKey(pieceId, editionNumber)) ?? [];

  let rows;
  try {
    rows = await selectInscriptionsForPiece(db, pieceId, editionNumber);
  } catch (err) {
    if (isMissingTableError(err)) return migrationNotApplied();
    throw err;
  }

  const now = new Date().toISOString();
  const inscriptions = rows.map((row) =>
    projectInscription(row, userId, chain, now),
  );

  return json({ ok: true, inscriptions });
}
