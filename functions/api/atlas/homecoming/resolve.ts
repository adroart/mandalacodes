/**
 * POST /api/atlas/homecoming/resolve, Adrian recognizes (or sets aside) a
 * homecoming request (Phase 2.5). Admin only.
 *
 * Body:
 *   { requestId, action: 'bind', pieceId, title?, editionNumber?, pieceType? }
 *   { requestId, action: 'decline' }
 *
 * DECLINE just stamps the request 'declined', sacredness is protected by
 * Adrian's eye, so an unrecognized request simply waits or is set aside;
 * nothing else changes and no mail goes out.
 *
 * BIND is the whole point of the Homecoming: the piece is unknown to the
 * ledger, so recognition mints it into being. In one admin click it:
 *   1. appends the genesis `created` event for the new pieceId, then a
 *      `placed` event at the request's city (both hash-chained server-side),
 *   2. regenerates the public projection so the light appears,
 *   3. binds a steward record to the requester (email + clerkUserId from the
 *      request), outreachStatus 'invited', so the collector walks the normal
 *      consent + ceremony on their next signed-in visit (the bind grants
 *      access; consent stays theirs to give, mirrors the claim-request path),
 *   4. returns the claim path so the collector can be sent into the ceremony.
 *
 * The pieceId must be brand new: a chain already existing means the piece is
 * known and the ordinary claim-request path applies, so we refuse rather than
 * bind onto someone else's work.
 */

import type { LedgerEvent, StewardRecord } from '../../../../types';
import { appendEvent, groupChains } from '../../../../utils/ledger';
import type { PagesContext } from '../_helpers';
import {
  json,
  mutateLedger,
  mutateStewards,
  regeneratePublicState,
} from '../_helpers';
import { rebindStewardRecord } from '../_transfer';
import { getCityById } from '../../../../data/cities';
import { requireAdmin, isAuthResponse } from '../../_lib/auth';
import {
  readHomecomingRequests,
  mutateHomecomingRequests,
} from '../_homecoming';
import type { HomecomingRequest } from '../../../../lib/atlas/homecoming';
import {
  claimInviteEmailBody,
  claimInviteEmailSubject,
  sendLetterEmail,
} from '../_email';
import type { LetterEmailEnv } from '../_email';

// The genesis event's `note` is hashed operational text, capped at 280 by the
// chain content invariant. A piece title is non-personal, so it rides here as
// the piece's only human label until the catalog catches up.
const NOTE_MAX = 280;

interface ResolveBody {
  requestId?: unknown;
  action?: unknown;
  pieceId?: unknown;
  title?: unknown;
  editionNumber?: unknown;
  pieceType?: unknown;
}

export async function onRequestPost(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireAdmin(request, env);
  if (isAuthResponse(auth)) return auth;

  let body: ResolveBody;
  try {
    body = (await request.json()) as ResolveBody;
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const requestId = typeof body.requestId === 'string' ? body.requestId : '';
  if (!requestId) return json({ ok: false, error: 'Missing requestId' }, 400);
  if (body.action !== 'bind' && body.action !== 'decline') {
    return json({ ok: false, error: "action must be 'bind' or 'decline'" }, 400);
  }
  const action = body.action;

  const requests = await readHomecomingRequests(env);
  const req = requests.find((r) => r.id === requestId);
  if (!req) return json({ ok: false, error: 'No such request' }, 404);
  if (req.status !== 'pending') {
    return json({ ok: false, error: 'Request already resolved' }, 409);
  }

  const now = new Date().toISOString();

  // ---- Decline: stamp and stop. ----
  if (action === 'decline') {
    const stamped = await stampResolved(env, requestId, {
      status: 'declined',
      resolvedAt: now,
      resolvedBy: auth.userId,
    });
    if (stamped instanceof Response) return stamped;
    return json({ ok: true, request: stamped });
  }

  // ---- Bind: validate the mint inputs. ----
  const pieceId = typeof body.pieceId === 'string' ? body.pieceId.trim() : '';
  if (!pieceId) {
    return json({ ok: false, error: 'Give the piece an id to recognize it' }, 400);
  }
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
  const title =
    typeof body.title === 'string' ? body.title.trim().slice(0, NOTE_MAX) : '';

  if (!getCityById(req.cityId)) {
    return json({ ok: false, error: 'The request has an unknown city' }, 400);
  }

  // Stamp FIRST inside the concurrency-safe mutator so exactly one racing
  // resolution wins; revert on any downstream failure so the request can be
  // retried. Mirrors resolve-claim-request.ts.
  const stamped = await stampResolved(env, requestId, {
    status: 'bound',
    resolvedAt: now,
    resolvedBy: auth.userId,
    boundPieceId: pieceId,
    boundEditionNumber: editionNumber,
    ...(title ? { boundTitle: title } : {}),
  });
  if (stamped instanceof Response) return stamped;

  const revert = async (): Promise<void> => {
    await mutateHomecomingRequests(env, (current) => ({
      next: current.map((r) =>
        r.id === requestId && r.status === 'bound'
          ? {
              ...r,
              status: 'pending' as const,
              resolvedAt: undefined,
              resolvedBy: undefined,
              boundPieceId: undefined,
              boundEditionNumber: undefined,
              boundTitle: undefined,
            }
          : r,
      ),
      result: undefined,
    }));
  };

  // Mint the piece: genesis + placed, both chained, in one ledger mutation so
  // the piece is never half-born. Refuse if a chain already exists.
  const ledgerOutcome = await mutateLedger<{ created: LedgerEvent; placed: LedgerEvent }>(
    env,
    async (events) => {
      const key = `${pieceId}:${editionNumber ?? 0}`;
      const chain = groupChains(events).get(key) ?? [];
      if (chain.length > 0) {
        return json(
          {
            ok: false,
            error:
              'A piece with that id is already in the ledger, use the claim-request path, not the Homecoming.',
          },
          409,
        );
      }
      const created = await appendEvent([], {
        id: crypto.randomUUID(),
        pieceId,
        ...(editionNumber !== undefined ? { editionNumber } : {}),
        type: 'created',
        date: now,
        cityId: null,
        ...(title ? { note: title } : {}),
        actor: 'admin',
        actorRef: auth.userId,
        ...(pieceType ? { pieceType } : {}),
      });
      const placed = await appendEvent([created], {
        id: crypto.randomUUID(),
        pieceId,
        ...(editionNumber !== undefined ? { editionNumber } : {}),
        type: 'placed',
        date: now,
        cityId: req.cityId,
        actor: 'admin',
        actorRef: auth.userId,
      });
      return { next: [...events, created, placed], result: { created, placed } };
    },
  );
  if (ledgerOutcome instanceof Response) {
    await revert();
    return ledgerOutcome;
  }

  await regeneratePublicState(env, ledgerOutcome.next);

  // Bind the steward record to the requester. A brand-new piece has no record;
  // re-validate inside the mutator that nothing bound it meanwhile.
  const stewardOutcome = await mutateStewards<StewardRecord>(env, (current) => {
    const idx = current.findIndex(
      (s) =>
        s.pieceId === pieceId &&
        (s.editionNumber ?? undefined) === (editionNumber ?? undefined),
    );
    if (idx !== -1 && current[idx].clerkUserId) {
      return json(
        { ok: false, error: 'Piece was claimed while recognizing it' },
        409,
      );
    }
    const record = rebindStewardRecord(
      idx === -1 ? undefined : current[idx],
      pieceId,
      editionNumber,
      { email: req.requesterEmail, clerkUserId: req.requesterRef },
      now,
    );
    const next = current.slice();
    if (idx === -1) next.push(record);
    else next[idx] = record;
    return { next, result: record };
  });
  if (stewardOutcome instanceof Response) {
    // The ledger event landed but the bind failed. The chain is intact; the
    // request goes back to pending so the admin can retry the bind (the retry
    // hits the chain-exists guard, so re-issue the steward manually if needed).
    await revert();
    return stewardOutcome;
  }

  // Invite the collector into the ceremony. Fire-and-forget, same pattern as
  // the other approval paths: never awaited, every failure swallowed inside.
  void sendLetterEmail(env as unknown as LetterEmailEnv, {
    to: req.requesterEmail,
    subject: claimInviteEmailSubject('request-approved'),
    body: claimInviteEmailBody('request-approved', title || undefined),
  }).catch(() => undefined);

  return json({
    ok: true,
    request: stamped,
    steward: stewardOutcome.result,
    // The collector is sent here to walk the normal consent + ceremony.
    claimPath: '/atlas/claim',
  });
}

/**
 * Stamp a homecoming request's resolution fields inside the concurrency-safe
 * mutator, guarding that it is still pending (so exactly one resolution wins).
 * Returns the updated record, or a Response on conflict.
 */
async function stampResolved(
  env: PagesContext['env'],
  requestId: string,
  patch: Partial<HomecomingRequest> & { status: HomecomingRequest['status'] },
): Promise<HomecomingRequest | Response> {
  const outcome = await mutateHomecomingRequests<HomecomingRequest>(env, (current) => {
    const idx = current.findIndex((r) => r.id === requestId);
    if (idx === -1) return json({ ok: false, error: 'No such request' }, 404);
    if (current[idx].status !== 'pending') {
      return json({ ok: false, error: 'Request already resolved' }, 409);
    }
    const next = current.slice();
    next[idx] = { ...current[idx], ...patch };
    return { next, result: next[idx] };
  });
  if (outcome instanceof Response) return outcome;
  return outcome.result;
}
