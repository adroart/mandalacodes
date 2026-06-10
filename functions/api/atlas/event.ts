/**
 * POST /api/atlas/event
 *
 * Admin-only. Append a ledger event for a single piece. Validates cityId,
 * type, then computes the hash chain via utils/ledger.appendEvent. After
 * the global ledger is persisted, regenerates atlas/public.json.
 */

import type { LedgerEvent, LedgerEventType } from '../../../types';
import { appendEvent, groupChains } from '../../../utils/ledger';
import { getCityById } from '../../../data/cities';
import type { PagesContext } from './_helpers';
import { json, mutateLedger, regeneratePublicState } from './_helpers';
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
  // inscribed | transferred stay reserved for M3 — not added here.
  'claimed',
]);

type CleanEventInput = Omit<LedgerEvent, 'hash' | 'prevHash'>;

/**
 * Validate a candidate event AND return a clean copy containing only the
 * known, allowed fields. Unknown extra keys are dropped here — before the
 * event reaches appendEvent/computeHash — so a client can never smuggle an
 * arbitrary field into the hashed payload (which would also make the hash
 * non-reproducible by anyone recomputing from the documented schema).
 *
 * Returns null when the input fails validation.
 */
function cleanEventInput(e: unknown): CleanEventInput | null {
  if (!e || typeof e !== 'object') return null;
  const obj = e as Record<string, unknown>;
  if (typeof obj.id !== 'string' || !obj.id) return null;
  if (typeof obj.pieceId !== 'string' || !obj.pieceId) return null;
  if (typeof obj.type !== 'string') return null;
  if (!VALID_TYPES.has(obj.type as LedgerEventType)) return null;
  if (typeof obj.date !== 'string' || !obj.date) return null;
  if (obj.actor !== 'admin' && obj.actor !== 'steward') return null;
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
  return clean;
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

  await regeneratePublicState(env, outcome.next);

  return json({ ok: true, event: outcome.result });
}
