/**
 * Shared D1 access for atlas_inscriptions + the M2 → M3 conversion of
 * pendingFirstInscription. No HTTP handlers here (the leading underscore
 * keeps Pages from routing this file) — inscribe.ts, inscriptions.ts and
 * export.ts import these.
 *
 * The pure rules (validation, commitments, seal/attribution projection,
 * conversion planning) live in utils/inscriptions.ts; this module is the
 * thin I/O layer around them.
 */

import type { LedgerEvent, StewardRecord } from '../../../types';
import {
  buildInscribedDraft,
  computeContentHash,
  generateSaltHex,
  pendingInscriptionId,
  planPendingConversion,
} from '../../../utils/inscriptions';
import type { InscriptionRow } from '../../../utils/inscriptions';
import { appendEvent, groupChains } from '../../../utils/ledger';
import type { AtlasD1Database, AtlasEnv } from './_helpers';
import {
  isMissingTableError,
  migrationNotApplied,
  mutateLedger,
  mutateStewards,
} from './_helpers';

export function chainKey(pieceId: string, editionNumber?: number): string {
  return `${pieceId}:${editionNumber ?? 0}`;
}

// ---------- Row I/O ----------

export async function selectInscription(
  db: AtlasD1Database,
  id: string,
): Promise<InscriptionRow | null> {
  return db
    .prepare('SELECT * FROM atlas_inscriptions WHERE id = ?1')
    .bind(id)
    .first<InscriptionRow>();
}

export async function selectInscriptionsForPiece(
  db: AtlasD1Database,
  pieceId: string,
  editionNumber: number | undefined,
): Promise<InscriptionRow[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM atlas_inscriptions
       WHERE piece_id = ?1 AND edition_number = ?2
       ORDER BY created_at ASC, id ASC`,
    )
    .bind(pieceId, editionNumber ?? 0)
    .all<InscriptionRow>();
  return results;
}

export interface InsertInscriptionInput {
  id: string;
  pieceId: string;
  editionNumber?: number;
  authorClerkId: string;
  kind: string;
  body: string;
  bodyHash: string;
  contentSalt: string;
  sealedUntil?: string;
  createdAt: string;
}

export async function insertInscription(
  db: AtlasD1Database,
  input: InsertInscriptionInput,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO atlas_inscriptions
         (id, piece_id, edition_number, author_clerk_id, kind, body,
          body_hash, content_salt, sealed_until, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
    )
    .bind(
      input.id,
      input.pieceId,
      input.editionNumber ?? 0,
      input.authorClerkId,
      input.kind,
      input.body,
      input.bodyHash,
      input.contentSalt,
      input.sealedUntil ?? null,
      input.createdAt,
    )
    .run();
}

export async function deleteInscription(
  db: AtlasD1Database,
  id: string,
): Promise<void> {
  await db.prepare('DELETE FROM atlas_inscriptions WHERE id = ?1').bind(id).run();
}

// ---------- pendingFirstInscription conversion (idempotent) ----------

/**
 * Convert a steward record's pendingFirstInscription (the M2 claim-ritual
 * answer) into the real inscription model:
 *   - D1 row: kind 'intention', created_at = the stored authoring time,
 *     fresh salt + commitment, deterministic id (idempotency anchor),
 *   - chain: an `inscribed` event dated NOW carrying the row's commitment,
 *   - steward record: the field removed via mutateStewards.
 *
 * Runs at the top of the inscribe POST and inscriptions GET paths. Safe to
 * re-run after any partial failure: existing row → reused (its salt and
 * hash stand), existing event → skipped, field cleared only when the chain
 * side is in place. Returns a Response only on a missing-table 503 or a
 * mutator conflict; every no-op resolves to undefined.
 */
export async function convertPendingFirstInscription(
  env: AtlasEnv,
  record: StewardRecord,
  ledgerEvents: readonly LedgerEvent[],
): Promise<Response | undefined> {
  const pending = record.pendingFirstInscription;
  const db = env.DB;
  if (!pending || !record.clerkUserId || !db) return undefined;

  const chain =
    groupChains(ledgerEvents.slice()).get(
      chainKey(record.pieceId, record.editionNumber),
    ) ?? [];

  let row: InscriptionRow | null;
  try {
    // Deterministic id — re-runs find this row instead of duplicating it.
    row = await selectInscription(
      db,
      pendingInscriptionId(record.pieceId, record.editionNumber),
    );
  } catch (err) {
    if (isMissingTableError(err)) return migrationNotApplied();
    throw err;
  }

  const plan = planPendingConversion(record, row !== null, chain);
  if (!plan) return undefined;

  if (plan.insertRow) {
    const salt = generateSaltHex();
    const bodyHash = await computeContentHash(salt, pending.text);
    try {
      await insertInscription(db, {
        id: plan.inscriptionId,
        pieceId: record.pieceId,
        editionNumber: record.editionNumber,
        authorClerkId: record.clerkUserId,
        kind: 'intention',
        body: pending.text,
        bodyHash,
        contentSalt: salt,
        createdAt: pending.createdAt,
      });
    } catch (err) {
      if (isMissingTableError(err)) return migrationNotApplied();
      throw err;
    }
    row = await selectInscription(db, plan.inscriptionId);
  }
  if (!row) return undefined; // unreachable in practice; bail safely

  if (plan.appendEvent) {
    const commitment = row.body_hash;
    const now = new Date().toISOString();
    const outcome = await mutateLedger(env, async (events) => {
      const freshChain =
        groupChains(events).get(chainKey(record.pieceId, record.editionNumber)) ?? [];
      // Re-check inside the mutator: a concurrent request may have landed it.
      if (
        freshChain.some(
          (e) => e.type === 'inscribed' && e.inscriptionId === plan.inscriptionId,
        ) ||
        freshChain.length === 0
      ) {
        return { next: events, result: undefined };
      }
      const draft = buildInscribedDraft({
        pieceId: record.pieceId,
        editionNumber: record.editionNumber,
        actorRef: record.clerkUserId as string,
        now,
        inscriptionId: plan.inscriptionId,
        contentHash: commitment,
        inscriptionKind: 'intention',
      });
      const full = await appendEvent(freshChain, draft);
      return { next: [...events, full], result: full };
    });
    if (outcome instanceof Response) return outcome;
  }

  if (plan.clearField) {
    const outcome = await mutateStewards(env, (stewards) => ({
      next: stewards.map((s) => {
        if (
          s.pieceId !== record.pieceId ||
          (s.editionNumber ?? undefined) !== (record.editionNumber ?? undefined) ||
          !s.pendingFirstInscription
        ) {
          return s;
        }
        const { pendingFirstInscription: _pfi, ...rest } = s;
        return rest as StewardRecord;
      }),
      result: undefined,
    }));
    if (outcome instanceof Response) return outcome;
  }

  return undefined;
}
