/**
 * POST /api/atlas/steward/inscribe — write a Ring 1 legacy entry (M3).
 *
 * Authenticated; the steward record for (pieceId, editionNumber)
 * must be bound to the bearer's userId (same auth pattern as update.ts).
 *
 * Body: { pieceId, editionNumber?, kind, body, sealedUntil? | sealUntilTransfer? }
 *   - kind: 'intention' | 'story' | 'dedication'
 *   - body: trimmed, 1–2000 chars — lives ONLY in the mutable D1 row
 *   - sealedUntil: ISO date (time capsule), or sealUntilTransfer: true
 *     (a letter to whoever inherits — opens on the next `transferred`)
 *
 * Write path:
 *   1. Convert any pendingFirstInscription (M2 ritual answer) — idempotent.
 *   2. INSERT the D1 row: id + random 16-byte salt + contentHash =
 *      SHA-256(salt || body).
 *   3. Append the `inscribed` chain event via mutateLedger with the FIXED
 *      field set {id, pieceId, editionNumber?, type, date, actor:'steward',
 *      actorRef, inscriptionId, contentHash, inscriptionKind} — whitelist
 *      discipline; the body and any names/emails NEVER enter the hashed
 *      payload (chain content invariant).
 *
 * No public-state regeneration — inscriptions are never public; the public
 * projector ignores `inscribed` events entirely.
 *
 * Degrades with 503 "migration not applied" until the 003_atlas_legacy D1
 * migration lands (todo/handoff/adrian-website/).
 */

import type { LedgerEvent } from '../../../../types';
import { appendEvent, groupChains, BackdatedEventError } from '../../../../utils/ledger';
import {
  buildInscribedDraft,
  computeContentHash,
  generateSaltHex,
  genInscriptionId,
  parseInscriptionInput,
  projectInscription,
} from '../../../../utils/inscriptions';
import type { PagesContext } from '../_helpers';
import {
  isMissingTableError,
  json,
  migrationNotApplied,
  mutateLedger,
  readLedger,
  readStewards,
} from '../_helpers';
import {
  chainKey,
  convertPendingFirstInscription,
  deleteInscription,
  insertInscription,
  selectInscription,
} from '../_inscriptions';
import { requireUser, isAuthResponse } from '../../_lib/auth';
import { checkRateLimit, tooManyRequests } from '../../_lib/rate-limit.js';

export async function onRequestPost(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireUser(request, env);
  if (isAuthResponse(auth)) return auth;
  const userId = auth.userId;

  // Fail-open D1 limiter, per-user — see functions/api/_lib/rate-limit.js.
  const { ok: withinLimit, retryAfterSec } = await checkRateLimit(
    env,
    `atlas:inscribe:${userId}`,
    { limit: 30, windowMs: 60 * 60 * 1000 },
  );
  if (!withinLimit) return tooManyRequests(retryAfterSec);

  if (!env.DB) return migrationNotApplied();
  const db = env.DB;

  let body: Record<string, unknown>;
  try {
    const parsed = (await request.json()) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return json({ ok: false, error: 'Body must be a JSON object' }, 400);
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const pieceId = typeof body.pieceId === 'string' ? body.pieceId : '';
  if (!pieceId) return json({ ok: false, error: 'Missing pieceId' }, 400);
  const editionNumber =
    typeof body.editionNumber === 'number' ? body.editionNumber : undefined;

  // Routing fields handled; everything else must pass the inscription
  // whitelist (kind/body/sealedUntil/sealUntilTransfer, nothing more).
  const { pieceId: _p, editionNumber: _e, ...inscriptionFields } = body;
  const input = parseInscriptionInput(inscriptionFields);
  if (!input.ok) return json({ ok: false, error: input.error }, 400);

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

  // M2 → M3 migration: land the pending first inscription before this one
  // so the book's first page exists when the second is written. Idempotent.
  const events = await readLedger(env);
  const converted = await convertPendingFirstInscription(env, record, events);
  if (converted instanceof Response) return converted;

  const now = new Date().toISOString();
  const inscriptionId = genInscriptionId();
  const salt = generateSaltHex();
  const contentHash = await computeContentHash(salt, input.value.body);

  // 1. D1 row first — the content store. If the chain append below fails,
  //    we best-effort delete it so no orphaned body lingers.
  try {
    await insertInscription(db, {
      id: inscriptionId,
      pieceId,
      editionNumber,
      authorClerkId: userId,
      kind: input.value.kind,
      body: input.value.body,
      bodyHash: contentHash,
      contentSalt: salt,
      sealedUntil: input.value.sealedUntil,
      createdAt: now,
    });
  } catch (err) {
    if (isMissingTableError(err)) return migrationNotApplied();
    throw err;
  }

  // 2. The chain commitment. Whitelisted draft — see buildInscribedDraft.
  const outcome = await mutateLedger(env, async (allEvents) => {
    const chain = groupChains(allEvents).get(chainKey(pieceId, editionNumber));
    if (!chain || chain.length === 0) {
      return json({ ok: false, error: 'No chain for this piece' }, 403);
    }
    const draft = buildInscribedDraft({
      pieceId,
      editionNumber,
      actorRef: userId,
      now,
      inscriptionId,
      contentHash,
      inscriptionKind: input.value.kind,
    });
    try {
      const full = await appendEvent(chain, draft);
      return { next: [...allEvents, full], result: full };
    } catch (err) {
      if (err instanceof BackdatedEventError) {
        return json({ ok: false, error: err.message }, 409);
      }
      throw err;
    }
  });
  if (outcome instanceof Response) {
    // Chain side failed — remove the orphaned body so a retry starts clean.
    await deleteInscription(db, inscriptionId).catch(() => undefined);
    return outcome;
  }

  // NO regeneratePublicState: inscriptions never touch the public surface.

  const row = await selectInscription(db, inscriptionId);
  const chain =
    groupChains(outcome.next).get(chainKey(pieceId, editionNumber)) ?? [];
  return json({
    ok: true,
    inscription: row ? projectInscription(row, userId, chain, now) : null,
    event: outcome.result satisfies LedgerEvent,
  });
}
