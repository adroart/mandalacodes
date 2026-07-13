/**
 * One-request publication of the claim ceremony's first dream (design ruling,
 * 2026-07-12).
 *
 * In the ceremony a single choice governs both the light and the dream:
 * "Show on the atlas" lights the marker publicly AND publishes the written
 * dream to the piece's public card, in the same motion. This module completes
 * the dream side of that motion, inside the same Phase B claim request, by
 * composing two existing paths and NOTHING new:
 *
 *   - the M2 to M3 conversion (_inscriptions.ts convertPendingFirstInscription):
 *     the pending first inscription becomes a real 'intention' row plus an
 *     `inscribed` commitment on the chain, and the steward field is cleared,
 *   - the share path (steward/share-intention.ts shareInscriptionOnMap): the
 *     converted intention is marked shared, so the regenerated public state
 *     carries the dream immediately.
 *
 * A private map choice (ring2MapPresence = false) takes NEITHER step: the
 * dream stays a private pendingFirstInscription exactly as before, and sealing
 * (light on, dream held private) remains available afterward through the
 * book's own share toggle. The caller gates on ring2MapPresence before
 * invoking this, so the ceremony's one choice is honoured once.
 *
 * Best-effort by contract: a failure here NEVER fails the claim. The light is
 * the binding act. If the dream cannot publish (no D1, a mutator conflict, a
 * piece not yet seeded), it simply stays pending and the steward can publish
 * it later from their book, on today's path, untouched.
 */

import type { StewardRecord } from '../../../types';
import { pendingInscriptionId } from '../../../utils/inscriptions';
import type { AtlasEnv } from './_helpers';
import { readLedger } from './_helpers';
import { convertPendingFirstInscription, selectInscription } from './_inscriptions';
import { shareInscriptionOnMap } from './steward/share-intention';

/**
 * For each freshly-claimed piece that carries a pending first dream, convert
 * it and mark it shared. Iterates the same matched-key set the Phase B claim
 * already built, so every lit piece publishes its dream in step with its
 * light. Returns nothing; every outcome (converted plus shared, no D1, a
 * conflict, a not-yet-seeded piece) resolves quietly, and the claim response
 * is unaffected.
 */
export async function publishFirstDreamsOnClaim(
  env: AtlasEnv,
  stewards: readonly StewardRecord[],
  matchedKeys: readonly { pieceId: string; editionNumber?: number }[],
  userId: string,
  now: string,
): Promise<void> {
  const db = env.DB;
  // No D1 binding: the dream stays a private pending inscription (today's
  // path); the conversion cannot run without the inscriptions table.
  if (!db) return;

  for (const key of matchedKeys) {
    const record = stewards.find(
      (s) =>
        s.pieceId === key.pieceId &&
        (s.editionNumber ?? undefined) === (key.editionNumber ?? undefined) &&
        s.clerkUserId === userId,
    );
    if (!record || !record.pendingFirstInscription) continue;

    // Convert: pending becomes a real 'intention' row plus an `inscribed`
    // chain event, then the steward field is cleared. Idempotent; a Response
    // means a missing table or a mutator conflict, so leave it pending and
    // move on.
    const events = await readLedger(env);
    const converted = await convertPendingFirstInscription(env, record, events);
    if (converted instanceof Response) continue;

    const inscriptionId = pendingInscriptionId(
      record.pieceId,
      record.editionNumber,
      userId,
    );
    const row = await selectInscription(db, inscriptionId);
    // No row (piece not seeded, so the conversion could not land a commitment
    // yet): nothing to share; the book will publish it on the steward's next
    // visit once the chain exists.
    if (!row) continue;

    // Mark it shared through the exact endpoint path. A Response here (failed
    // eligibility or conflict) is swallowed: the light is already lit, and the
    // dream can still be shared later from the book.
    await shareInscriptionOnMap(env, {
      row,
      pieceId: record.pieceId,
      editionNumber: record.editionNumber,
      inscriptionId,
      userId,
      now,
    });
  }
}
