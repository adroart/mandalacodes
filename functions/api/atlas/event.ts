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
import { json, mutateLedger, mutateStewards, regeneratePublicState } from './_helpers';
import { requireAdmin, isAuthResponse } from '../_lib/clerk';

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
  if (obj.note !== undefined && typeof obj.note !== 'string') return null;
  if (
    obj.pieceType !== undefined &&
    obj.pieceType !== 'mandala' &&
    obj.pieceType !== 'other'
  ) {
    return null;
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
  // pieceType is meaningful on the genesis event only; carry it there.
  if (obj.type === 'created' && obj.pieceType !== undefined) {
    clean.pieceType = obj.pieceType as 'mandala' | 'other';
  }

  // 'transferred' — opaque refs + kind, all three REQUIRED. Never an email
  // or a name: refs are Clerk userIds or other opaque identifiers. The new
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

// ---------- Transfer rebind (decision #2, server-enforced) ----------

/**
 * The new steward's contact details for a `transferred` event. Travels in
 * the request body NEXT TO the event — email and name never enter the
 * hashed payload. This rebind is the ONLY path that may change the email /
 * clerkUserId of a steward record that already has a bound clerkUserId
 * (issue.ts refuses duplicates; claim.ts never matches bound records by
 * email).
 */
interface RebindInput {
  email: string;
  clerkUserId?: string;
  name?: string;
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function cleanRebindInput(value: unknown): RebindInput | null {
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

/**
 * Build the post-transfer steward record. The piece's chain history stays
 * (it lives with the piece, ratified); the PERSONAL layer resets: the old
 * steward's email/name/consent/heirs/pendingFirstInscription never carry
 * over to the new holder's record. Admin notes (piece context) persist.
 */
function rebindStewardRecord(
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

export async function onRequestPost(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireAdmin(request, env);
  if (isAuthResponse(auth)) return auth;

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

    // Attribution: stamp the admin's opaque Clerk userId, overriding any
    // client-supplied value. Never an email or name.
    const fullEvent = await appendEvent(chain, {
      ...incoming,
      actorRef: auth.userId,
    });
    return { next: [...events, fullEvent], result: fullEvent };
  });
  if (outcome instanceof Response) return outcome;

  // Re-bind the steward record for a transfer — the audited path that
  // decision #2 reserves for changing a bound record. Replaces the record
  // in place (or creates one if the piece never had a steward); the chain
  // event above is the audit trail.
  let rebound: StewardRecord | null = null;
  if (incoming.type === 'transferred' && rebind) {
    const now = new Date().toISOString();
    const rebindInput = rebind;
    const stewardOutcome = await mutateStewards(env, (stewards) => {
      const idx = stewards.findIndex(
        (s) =>
          s.pieceId === incoming.pieceId &&
          (s.editionNumber ?? undefined) === (incoming.editionNumber ?? undefined),
      );
      const next = stewards.slice();
      const record = rebindStewardRecord(
        idx === -1 ? undefined : stewards[idx],
        incoming.pieceId,
        incoming.editionNumber,
        rebindInput,
        now,
      );
      if (idx === -1) next.push(record);
      else next[idx] = record;
      return { next, result: record };
    });
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
