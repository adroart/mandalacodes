/**
 * Shared transferred + rebind logic (M3/M4). No HTTP handlers here (the
 * leading underscore keeps Pages from routing this file) — event.ts, the
 * sale-queue confirm, and the claim-request approval paths import these.
 *
 * Decision #2 (server-enforced): re-binding a steward record that already
 * has a bound clerkUserId is impossible EXCEPT through an audited
 * `transferred` chain event, and the rebind always rides in the same
 * operation. This module is that path's single implementation:
 *
 *   - /api/atlas/event with a client-built `transferred` event + rebind
 *     body (artist-mediated transfer, M3),
 *   - /api/atlas/sales/confirm on an already-claimed piece (M4),
 *   - claim-request approvals — by the current holder, or by the admin
 *     adjudicating per the documented dispute process (M4).
 *
 * The new steward's email/name only ever touch the MUTABLE steward record;
 * the chain event carries opaque refs exclusively (chain content
 * invariant).
 */

import type { StewardRecord } from '../../../types';
import { appendEvent, groupChains, BackdatedEventError } from '../../../utils/ledger';
import { buildTransferredDraft } from '../../../utils/saleBridge';
import type { TransferredDraftOptions } from '../../../utils/saleBridge';
import type { AtlasEnv, MutateSuccess } from './_helpers';
import { json, mutateLedger, mutateStewards, regeneratePublicState } from './_helpers';
import type { LedgerEvent } from '../../../types';

// ---------- Rebind input (validated client/sale data, never chain data) ----------

/**
 * The new steward's contact details for a `transferred` event. Travels in
 * the request body NEXT TO the event — email and name never enter the
 * hashed payload. This rebind is the ONLY path that may change the email /
 * clerkUserId of a steward record that already has a bound clerkUserId
 * (issue.ts refuses duplicates; claim.ts never matches bound records by
 * email).
 */
export interface RebindInput {
  email: string;
  clerkUserId?: string;
  name?: string;
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function cleanRebindInput(value: unknown): RebindInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (key !== 'email' && key !== 'clerkUserId' && key !== 'name') return null;
  }
  const email = typeof obj.email === 'string' ? obj.email.trim() : '';
  if (!email || !isValidEmail(email)) return null;
  if (obj.clerkUserId !== undefined && typeof obj.clerkUserId !== 'string') return null;
  if (obj.name !== undefined && typeof obj.name !== 'string') return null;
  return {
    email,
    ...(obj.clerkUserId ? { clerkUserId: obj.clerkUserId as string } : {}),
    ...(obj.name ? { name: obj.name as string } : {}),
  };
}

// ---------- Steward record rebind ----------

/**
 * Build the post-transfer steward record. The piece's chain history stays
 * (it lives with the piece, ratified); the PERSONAL layer resets: the old
 * steward's email/name/consent/heirs/pendingFirstInscription never carry
 * over to the new holder's record. Admin notes (piece context) persist.
 */
export function rebindStewardRecord(
  previous: StewardRecord | undefined,
  pieceId: string,
  editionNumber: number | undefined,
  rebind: RebindInput,
  now: string,
): StewardRecord {
  return {
    pieceId,
    editionNumber,
    email: rebind.email,
    ...(rebind.clerkUserId ? { clerkUserId: rebind.clerkUserId } : {}),
    ...(rebind.name ? { name: rebind.name } : {}),
    ...(previous?.notes ? { notes: previous.notes } : {}),
    issuedAt: now,
    // The new steward walks the normal funnel: claim bind + Phase B
    // consent flip this to 'claimed'.
    outreachStatus: 'invited',
  };
}

/**
 * Apply a rebind to the steward list: replaces the record for the piece in
 * place (or creates one if the piece never had a steward). Must only ever
 * run alongside a `transferred` chain event — that event is the audit
 * trail decision #2 demands.
 */
export function applyRebind(
  env: AtlasEnv,
  pieceId: string,
  editionNumber: number | undefined,
  rebind: RebindInput,
  now: string,
): Promise<MutateSuccess<StewardRecord, StewardRecord> | Response> {
  return mutateStewards(env, (stewards) => {
    const idx = stewards.findIndex(
      (s) =>
        s.pieceId === pieceId &&
        (s.editionNumber ?? undefined) === (editionNumber ?? undefined),
    );
    const next = stewards.slice();
    const record = rebindStewardRecord(
      idx === -1 ? undefined : stewards[idx],
      pieceId,
      editionNumber,
      rebind,
      now,
    );
    if (idx === -1) next.push(record);
    else next[idx] = record;
    return { next, result: record };
  });
}

// ---------- The full server-built transfer (M4 approval paths) ----------

export interface ExecuteTransferOptions {
  event: Omit<TransferredDraftOptions, 'now' | 'eventId'>;
  rebind: RebindInput;
}

export interface ExecuteTransferResult {
  event: LedgerEvent;
  steward: StewardRecord;
}

/**
 * Append a server-built `transferred` event (fixed field set via
 * buildTransferredDraft — nothing client-supplied reaches the hashed
 * payload) and re-bind the steward record in the same operation, then
 * regenerate public state. Used by the sale-queue confirm and the
 * claim-request approval paths; the admin /api/atlas/event route keeps its
 * own event construction (client-built, whitelist-cleaned) but shares
 * applyRebind above.
 */
export async function executeTransfer(
  env: AtlasEnv,
  opts: ExecuteTransferOptions,
): Promise<ExecuteTransferResult | Response> {
  const now = new Date().toISOString();

  const ledgerOutcome = await mutateLedger(env, async (events) => {
    const chain =
      groupChains(events).get(
        `${opts.event.pieceId}:${opts.event.editionNumber ?? 0}`,
      ) ?? [];
    const draft = buildTransferredDraft({ ...opts.event, now });
    try {
      const full = await appendEvent(chain, draft);
      return { next: [...events, full], result: full };
    } catch (err) {
      // Chain tip dated in the future (admin forward-dated event) —
      // appending "now" would backdate. Same 409 as steward/update.
      if (err instanceof BackdatedEventError) {
        return json({ ok: false, error: err.message }, 409);
      }
      throw err;
    }
  });
  if (ledgerOutcome instanceof Response) return ledgerOutcome;

  const stewardOutcome = await applyRebind(
    env,
    opts.event.pieceId,
    opts.event.editionNumber,
    opts.rebind,
    now,
  );
  if (stewardOutcome instanceof Response) return stewardOutcome;

  await regeneratePublicState(env, ledgerOutcome.next);

  return { event: ledgerOutcome.result, steward: stewardOutcome.result };
}
