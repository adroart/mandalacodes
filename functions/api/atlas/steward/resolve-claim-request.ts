/**
 * POST /api/atlas/steward/resolve-claim-request — the current holder
 * decides a stewardship request routed to them (M4).
 *
 * Authenticated. Body: { requestId, approve, transferKind? } —
 * transferKind ('sale' | 'gift', the holder's call) is required on
 * approval.
 *
 * Authorization: the caller must be the BOUND steward of the request's
 * piece, and the request must be pending and routed to 'holder'. This is
 * the anti-takeover guarantee made concrete — only the person who holds
 * the piece can hand it on.
 *
 * Approval = the audited transferred + rebind path (_transfer.ts):
 *   chain: `transferred` {actor 'steward', actorRef holder, fromRef
 *   holder, toRef requesterRef, transferKind} — opaque refs only;
 *   record: rebound to the requester (email + clerkUserId from the
 *   request). The requester then walks the normal claim flow — Phase B
 *   consent still gates outreachStatus 'claimed'.
 *
 * NOTE for the approving holder: the transfer rebinds the record
 * immediately — they hand over write access in the same click.
 *
 * Declines just stamp the request; nothing else changes.
 */

import { resolveRequest } from '../../../../utils/claimRequests';
import type { PagesContext } from '../_helpers';
import { json, mutateClaimRequests, readClaimRequests, readStewards } from '../_helpers';
import { executeTransfer } from '../_transfer';
import { requireUser, isAuthResponse } from '../../_lib/auth';

interface ResolveBody {
  requestId?: unknown;
  approve?: unknown;
  transferKind?: unknown;
}

export async function onRequestPost(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireUser(request, env);
  if (isAuthResponse(auth)) return auth;
  const userId = auth.userId;

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
  if (
    body.transferKind !== undefined &&
    body.transferKind !== 'sale' &&
    body.transferKind !== 'gift'
  ) {
    return json({ ok: false, error: "transferKind must be 'sale' or 'gift'" }, 400);
  }
  const transferKind = body.transferKind as 'sale' | 'gift' | undefined;
  if (approve && !transferKind) {
    return json(
      { ok: false, error: 'Approval requires transferKind (sale or gift)' },
      400,
    );
  }

  const [requests, stewards] = await Promise.all([
    readClaimRequests(env),
    readStewards(env),
  ]);
  const claimRequest = requests.find((r) => r.id === requestId);
  if (!claimRequest) return json({ ok: false, error: 'No such request' }, 404);
  if (claimRequest.status !== 'pending' || claimRequest.routedTo !== 'holder') {
    return json({ ok: false, error: 'Request is not pending for a holder' }, 409);
  }

  // The caller must hold the piece NOW (bound clerkUserId match).
  const record = stewards.find(
    (s) =>
      s.pieceId === claimRequest.pieceId &&
      (s.editionNumber ?? undefined) === (claimRequest.editionNumber ?? undefined),
  );
  if (!record || record.clerkUserId !== userId) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }

  // Stamp the request FIRST — the pending→resolved flip happens inside the
  // concurrency-safe mutator, so exactly one racing resolution wins and at
  // most one transfer can ever fire for a request.
  const now = new Date().toISOString();
  const stamped = await mutateClaimRequests(env, (current) => {
    const idx = current.findIndex((r) => r.id === requestId);
    if (idx === -1) return json({ ok: false, error: 'No such request' }, 404);
    if (current[idx].status !== 'pending') {
      return json({ ok: false, error: 'Request already resolved' }, 409);
    }
    const next = current.slice();
    next[idx] = resolveRequest(current[idx], approve, userId, now);
    return { next, result: next[idx] };
  });
  if (stamped instanceof Response) return stamped;

  if (approve && transferKind) {
    const outcome = await executeTransfer(env, {
      event: {
        pieceId: claimRequest.pieceId,
        editionNumber: claimRequest.editionNumber,
        actor: 'steward',
        actorRef: userId,
        fromRef: userId,
        toRef: claimRequest.requesterRef,
        transferKind,
      },
      rebind: {
        email: claimRequest.requesterEmail,
        clerkUserId: claimRequest.requesterRef,
      },
    });
    if (outcome instanceof Response) {
      // Transfer failed — put the request back so the holder can retry.
      await mutateClaimRequests(env, (current) => ({
        next: current.map((r) =>
          r.id === requestId && r.status === 'approved'
            ? { ...r, status: 'pending' as const, resolvedAt: undefined, resolvedBy: undefined }
            : r,
        ),
        result: undefined,
      }));
      return outcome;
    }
  }

  return json({ ok: true, request: stamped.result });
}
