/**
 * POST /api/atlas/claim-requests/resolve — admin resolution of a
 * stewardship request (M4). Body: { requestId, approve }.
 *
 * Approval semantics depend on the piece's steward state:
 *
 *   - UNCLAIMED piece (no record, or record without a bound clerkUserId):
 *     bind a steward record to the requester — email + clerkUserId from
 *     the request, outreachStatus 'invited' NOT 'claimed'. Why: claim.ts
 *     gates 'claimed' (and the `claimed` chain event, and Ring 2 map
 *     placement) on Phase B CONSENT capture, never on the bind alone. The
 *     approved requester signs in, Phase A matches their userId
 *     immediately, and they walk the normal consent step on that next
 *     visit — approval grants access, consent stays theirs to give. An
 *     existing UNBOUND record (pre-issuance hint) is replaced, same as the
 *     sale-confirm path.
 *
 *   - BOUND piece: these route to the holder by default (anti-takeover),
 *     but the admin may adjudicate — the plan's dispute process names the
 *     artist as arbiter, and resolution is always a ledger event. Approval
 *     here = the audited transferred + rebind path with transferKind
 *     'artist-rebind' (an admin adjudication, not a holder-witnessed sale
 *     or gift), fromRef = the old holder, toRef = the requester. NEVER
 *     automatic: this code runs only on the admin's explicit click.
 *
 * Declines just stamp the request.
 */

import type { StewardRecord } from '../../../../types';
import { resolveRequest } from '../../../../utils/claimRequests';
import type { PagesContext } from '../_helpers';
import {
  json,
  mutateClaimRequests,
  mutateStewards,
  readClaimRequests,
  readStewards,
} from '../_helpers';
import { executeTransfer, rebindStewardRecord } from '../_transfer';
import {
  claimInviteEmailBody,
  claimInviteEmailSubject,
  sendLetterEmail,
} from '../_email';
import type { LetterEmailEnv } from '../_email';
import { FULL_ARCHIVE } from '../../../../data/mockData';
import { requireAdmin, isAuthResponse } from '../../_lib/auth';

interface ResolveBody {
  requestId?: unknown;
  approve?: unknown;
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
  if (typeof body.approve !== 'boolean') {
    return json({ ok: false, error: 'approve must be a boolean' }, 400);
  }
  const approve = body.approve;

  const requests = await readClaimRequests(env);
  const claimRequest = requests.find((r) => r.id === requestId);
  if (!claimRequest) return json({ ok: false, error: 'No such request' }, 404);
  if (claimRequest.status !== 'pending') {
    return json({ ok: false, error: 'Request already resolved' }, 409);
  }

  // Stamp FIRST inside the concurrency-safe mutator: exactly one racing
  // resolution wins, so at most one bind/transfer can ever fire.
  const now = new Date().toISOString();
  const stamped = await mutateClaimRequests(env, (current) => {
    const idx = current.findIndex((r) => r.id === requestId);
    if (idx === -1) return json({ ok: false, error: 'No such request' }, 404);
    if (current[idx].status !== 'pending') {
      return json({ ok: false, error: 'Request already resolved' }, 409);
    }
    const next = current.slice();
    next[idx] = resolveRequest(current[idx], approve, auth.userId, now);
    return { next, result: next[idx] };
  });
  if (stamped instanceof Response) return stamped;

  if (!approve) return json({ ok: true, request: stamped.result });

  const revert = async (): Promise<void> => {
    await mutateClaimRequests(env, (current) => ({
      next: current.map((r) =>
        r.id === requestId && r.status === 'approved'
          ? { ...r, status: 'pending' as const, resolvedAt: undefined, resolvedBy: undefined }
          : r,
      ),
      result: undefined,
    }));
  };

  const stewards = await readStewards(env);
  const existing = stewards.find(
    (s) =>
      s.pieceId === claimRequest.pieceId &&
      (s.editionNumber ?? undefined) === (claimRequest.editionNumber ?? undefined),
  );

  let steward: StewardRecord;
  if (existing?.clerkUserId) {
    // Bound piece — admin adjudication via the audited transfer path.
    const outcome = await executeTransfer(env, {
      event: {
        pieceId: claimRequest.pieceId,
        editionNumber: claimRequest.editionNumber,
        actor: 'admin',
        actorRef: auth.userId,
        fromRef: existing.clerkUserId,
        toRef: claimRequest.requesterRef,
        transferKind: 'artist-rebind',
      },
      rebind: {
        email: claimRequest.requesterEmail,
        clerkUserId: claimRequest.requesterRef,
      },
    });
    if (outcome instanceof Response) {
      await revert();
      return outcome;
    }
    steward = outcome.steward;
  } else {
    // Unclaimed piece — bind a record to the requester (replacing any
    // unbound pre-issuance hint). Re-validated inside the mutator: if the
    // piece got BOUND meanwhile, bail rather than silently re-home it.
    const outcome = await mutateStewards(env, (current) => {
      const idx = current.findIndex(
        (s) =>
          s.pieceId === claimRequest.pieceId &&
          (s.editionNumber ?? undefined) === (claimRequest.editionNumber ?? undefined),
      );
      if (idx !== -1 && current[idx].clerkUserId) {
        return json(
          { ok: false, error: 'Piece was claimed while resolving — it now routes to the holder' },
          409,
        );
      }
      const record = rebindStewardRecord(
        idx === -1 ? undefined : current[idx],
        claimRequest.pieceId,
        claimRequest.editionNumber,
        {
          email: claimRequest.requesterEmail,
          clerkUserId: claimRequest.requesterRef,
        },
        now,
      );
      const next = current.slice();
      if (idx === -1) next.push(record);
      else next[idx] = record;
      return { next, result: record };
    });
    if (outcome instanceof Response) {
      await revert();
      return outcome;
    }
    steward = outcome.result;
  }

  // Approval succeeded (either branch): invite the requester to complete
  // the claim. Fire-and-forget, same pattern as _letters.ts: never awaited
  // on the response path, every failure swallowed inside the helper.
  // Declines returned earlier and send nothing.
  const pieceTitle = FULL_ARCHIVE.find((a) => a.id === claimRequest.pieceId)
    ?.title.replace(/\s*-\s*\d+$/, '');
  void sendLetterEmail(env as unknown as LetterEmailEnv, {
    to: claimRequest.requesterEmail,
    subject: claimInviteEmailSubject('request-approved'),
    body: claimInviteEmailBody('request-approved', pieceTitle),
  }).catch(() => undefined);

  return json({ ok: true, request: stamped.result, steward });
}
