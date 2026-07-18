/**
 * POST /api/atlas/event
 *
 * Admin-only. Append a ledger event for a single piece. Validates cityId,
 * type, then computes the hash chain via utils/ledger.appendEvent. After
 * the global ledger is persisted, regenerates atlas/public.json.
 */

import type { LedgerEvent, LedgerEventType, StewardRecord } from '../../../types';
import { appendEvent, groupChains } from '../../../utils/ledger';
import { INSCRIPTION_KINDS } from '../../../utils/inscriptions';
import { getCityById } from '../../../data/cities';
import type { PagesContext } from './_helpers';
import { json, mutateLedger, regeneratePublicState } from './_helpers';
import { applyRebind, cleanRebindInput } from './_transfer';
import type { RebindInput } from './_transfer';
import { requireAdmin, isAuthResponse } from '../_lib/auth';
import { checkRateLimit, tooManyRequests } from '../_lib/rate-limit.js';

const VALID_TYPES: ReadonlySet<LedgerEventType> = new Set<LedgerEventType>([
  'created',
  'placed',
  'moved',
  'withdrawn',
  'revealed',
  'retired',
  // M1 groundwork: admin can append a claim (Adrian lights #1 on launch day).
  // The two-phase steward claim flow that appends `claimed` lands in M2.
  'claimed',
  // M3: admin-recorded inscription commitments and artist-mediated
  // transfers. A `transferred` event MUST ride with a `rebind` body — the
  // only audited path that may change a bound steward record.
  'inscribed',
  'transferred',
]);

const TRANSFER_KINDS = new Set(['sale', 'gift', 'inheritance', 'artist-rebind']);

// `note` rides into the hashed chain payload, so once written it can never
// be edited or deleted — only tombstoned by a future moderator-redaction
// path, not by this endpoint. Per the plan's chain content invariant (see
// todo/plans/living-art-legacy.md, decision #6: "The existing
// LedgerEvent.note field is restricted to non-personal operational text
// from now on"), a note must be non-personal operational text ONLY — never
// a name, email, or free prose about a person. The length cap keeps it that
// way structurally: 280 characters is enough for an operational line
// ("shipped via courier, tracking on file") and too short to hold a story.
const NOTE_MAX_LENGTH = 280;

type CleanEventInput = Omit<LedgerEvent, 'hash' | 'prevHash'>;

/**
 * Validate a candidate event AND return a clean copy containing only the
 * known, allowed fields. Unknown extra keys are dropped here — before the
 * event reaches appendEvent/computeHash — so a client can never smuggle an
 * arbitrary field into the hashed payload (which would also make the hash
 * non-reproducible by anyone recomputing from the documented schema).
 *
 * Returns null when the input fails validation.
 *
 * Exported for the unit suite — the whitelist IS the chain content
 * invariant's enforcement point for admin-submitted events.
 */
export function cleanEventInput(e: unknown): CleanEventInput | null {
  if (!e || typeof e !== 'object') return null;
  const obj = e as Record<string, unknown>;
  if (typeof obj.id !== 'string' || !obj.id) return null;
  if (typeof obj.pieceId !== 'string' || !obj.pieceId) return null;
  if (typeof obj.type !== 'string') return null;
  if (!VALID_TYPES.has(obj.type as LedgerEventType)) return null;
  if (typeof obj.date !== 'string' || !obj.date) return null;
  if (obj.actor !== 'admin' && obj.actor !== 'steward' && obj.actor !== 'heir') {
    return null;
  }
  if (obj.cityId !== undefined && obj.cityId !== null && typeof obj.cityId !== 'string') {
    return null;
  }
  if (obj.editionNumber !== undefined && typeof obj.editionNumber !== 'number') {
    return null;
  }
  if (obj.note !== undefined) {
    if (typeof obj.note !== 'string') return null;
    if (obj.note.length > NOTE_MAX_LENGTH) return null;
  }
  if (
    obj.pieceType !== undefined &&
    obj.pieceType !== 'mandala' &&
    obj.pieceType !== 'other'
  ) {
    return null;
  }
  // series/category are non-personal facts carried on the genesis event so a
  // piece outside FULL_ARCHIVE still projects series/category (and the kind
  // facet) into public state. Bounded to keep the chain payload disciplined.
  if (obj.series !== undefined) {
    if (typeof obj.series !== 'string' || obj.series.length > 120) return null;
  }
  if (obj.category !== undefined) {
    if (typeof obj.category !== 'string' || obj.category.length > 120) return null;
  }

  // Whitelist: copy only known fields. actorRef is intentionally NOT copied
  // from the client — the handler stamps it from the verified token below.
  const clean: CleanEventInput = {
    id: obj.id,
    pieceId: obj.pieceId,
    type: obj.type as LedgerEventType,
    date: obj.date,
    actor: obj.actor,
  };
  if (obj.editionNumber !== undefined) clean.editionNumber = obj.editionNumber as number;
  if (obj.cityId !== undefined) clean.cityId = obj.cityId as string | null;
  if (obj.note !== undefined) clean.note = obj.note as string;
  // pieceType, series, category are meaningful on the genesis event only.
  if (obj.type === 'created') {
    if (obj.pieceType !== undefined) clean.pieceType = obj.pieceType as 'mandala' | 'other';
    if (obj.series !== undefined) clean.series = obj.series as string;
    if (obj.category !== undefined) clean.category = obj.category as string;
  }

  // 'transferred' — opaque refs + kind, all three REQUIRED. Never an email
  // or a name: refs are auth userIds or other opaque identifiers. The new
  // steward's email travels in the request body's `rebind`, OUTSIDE the
  // hashed payload.
  if (obj.type === 'transferred') {
    if (typeof obj.fromRef !== 'string' || !obj.fromRef) return null;
    if (typeof obj.toRef !== 'string' || !obj.toRef) return null;
    if (typeof obj.transferKind !== 'string' || !TRANSFER_KINDS.has(obj.transferKind)) {
      return null;
    }
    clean.fromRef = obj.fromRef;
    clean.toRef = obj.toRef;
    clean.transferKind = obj.transferKind as LedgerEvent['transferKind'];
  }

  // 'inscribed' — pointer + salted commitment + kind, all REQUIRED. The
  // body itself lives only in D1 (chain content invariant); this admin
  // path exists for recovery/migration, the normal write path is
  // steward/inscribe.ts.
  if (obj.type === 'inscribed') {
    if (typeof obj.inscriptionId !== 'string' || !obj.inscriptionId) return null;
    if (typeof obj.contentHash !== 'string' || !/^[0-9a-f]{64}$/.test(obj.contentHash)) {
      return null;
    }
    if (
      typeof obj.inscriptionKind !== 'string' ||
      !(INSCRIPTION_KINDS as readonly string[]).includes(obj.inscriptionKind)
    ) {
      return null;
    }
    clean.inscriptionId = obj.inscriptionId;
    clean.contentHash = obj.contentHash;
    clean.inscriptionKind = obj.inscriptionKind as LedgerEvent['inscriptionKind'];
  }

  return clean;
}

/**
 * True when a chain already carries a `claimed` event. Mirrors the genesis
 * ('created') guard below: a chain may only ever originate one Founding
 * Lights ordinal, so a second admin-submitted 'claimed' event must be
 * rejected rather than silently accepted (the steward claim flow's own
 * planClaimChainEvents already skips repeats for its own path — this is the
 * same invariant enforced on the admin path). Pure and exported for the unit
 * suite.
 */
export function chainHasClaimedEvent(chain: readonly LedgerEvent[]): boolean {
  return chain.some((e) => e.type === 'claimed');
}

export async function onRequestPost(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireAdmin(request, env);
  if (isAuthResponse(auth)) return auth;

  // Fail-open D1-backed limiter (see functions/api/_lib/rate-limit.js) —
  // admin is a single trusted actor, but this still bounds a runaway script
  // or a compromised session from hammering the ledger.
  const { ok: withinLimit, retryAfterSec } = await checkRateLimit(
    env,
    `atlas:admin-event:${auth.userId}`,
    { limit: 60, windowMs: 60 * 60 * 1000 },
  );
  if (!withinLimit) return tooManyRequests(retryAfterSec);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const incoming = cleanEventInput((body as { event?: unknown })?.event);
  if (!incoming) {
    return json({ ok: false, error: 'Invalid event' }, 400);
  }

  if (incoming.cityId && !getCityById(incoming.cityId)) {
    return json({ ok: false, error: 'Unknown cityId' }, 400);
  }

  // A transfer is an ownership operation, not just a chain entry: the
  // steward record re-binds in the same request. The new holder's email
  // (and optional clerkUserId/name) ride OUTSIDE the event payload so they
  // never touch a hash.
  let rebind: RebindInput | null = null;
  if (incoming.type === 'transferred') {
    rebind = cleanRebindInput((body as { rebind?: unknown })?.rebind);
    if (!rebind) {
      return json(
        {
          ok: false,
          error:
            'transferred events require a rebind body: { email, clerkUserId?, name? } — the new steward record is re-issued in the same audited operation',
        },
        400,
      );
    }
  }

  // All chain checks run INSIDE the mutator so they re-apply against fresh
  // data if a concurrent write forces a retry.
  const outcome = await mutateLedger(env, async (events) => {
    const chains = groupChains(events);
    const key = `${incoming.pieceId}:${incoming.editionNumber ?? 0}`;
    const chain = chains.get(key) ?? [];

    // Genesis guard: a 'created' event for a piece that already has a chain
    // would corrupt the projection. Reject with 409 per spec.
    if (incoming.type === 'created' && chain.length > 0) {
      return json(
        { ok: false, error: 'Genesis event already exists for this piece' },
        409,
      );
    }

    // Claimed guard: a chain may only ever carry one 'claimed' event — it is
    // the Founding Lights ordinal source, and a second one would corrupt the
    // claim-order projection. Mirrors the genesis guard above.
    if (incoming.type === 'claimed' && chainHasClaimedEvent(chain)) {
      return json(
        { ok: false, error: 'A claimed event already exists for this piece' },
        409,
      );
    }

    // Backdated guard: chains sort by date, so an event dated before the
    // current tip would reorder the chain and break verification.
    const tip = chain[chain.length - 1];
    if (tip && incoming.date < tip.date) {
      return json(
        {
          ok: false,
          error: `Event date ${incoming.date} is earlier than the chain tip (${tip.date}). Backdated events would break chain verification — use a date at or after the tip.`,
        },
        400,
      );
    }

    // Attribution: stamp the admin's opaque auth userId, overriding any
    // client-supplied value. Never an email or name.
    const fullEvent = await appendEvent(chain, {
      ...incoming,
      actorRef: auth.userId,
    });
    return { next: [...events, fullEvent], result: fullEvent };
  });
  if (outcome instanceof Response) return outcome;

  // Re-bind the steward record for a transfer — the audited path that
  // decision #2 reserves for changing a bound record (shared with the M4
  // sale-queue / claim-request approvals via _transfer.ts). Replaces the
  // record in place (or creates one if the piece never had a steward); the
  // chain event above is the audit trail.
  let rebound: StewardRecord | null = null;
  if (incoming.type === 'transferred' && rebind) {
    const stewardOutcome = await applyRebind(
      env,
      incoming.pieceId,
      incoming.editionNumber,
      rebind,
      new Date().toISOString(),
    );
    if (stewardOutcome instanceof Response) return stewardOutcome;
    rebound = stewardOutcome.result;
  }

  await regeneratePublicState(env, outcome.next);

  return json({
    ok: true,
    event: outcome.result,
    ...(rebound ? { steward: rebound } : {}),
  });
}
