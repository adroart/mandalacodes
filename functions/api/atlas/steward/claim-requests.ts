/**
 * GET /api/atlas/steward/claim-requests — pending stewardship requests
 * routed to the CALLER as current holder (M4).
 *
 * Authenticated. Returns every pending request with routedTo
 * 'holder' whose piece is bound to the caller's auth userId. The holder
 * sees the requester's email and evidence note (they must be able to
 * recognize "yes, that's the person I sold it to") but never the opaque
 * requesterRef or anyone else's requests.
 */

import { toHolderRequestView } from '../../../../utils/claimRequests';
import type { PagesContext } from '../_helpers';
import { json, readClaimRequests, readStewards } from '../_helpers';
import { requireUser, isAuthResponse } from '../../_lib/auth';

export async function onRequestGet(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireUser(request, env);
  if (isAuthResponse(auth)) return auth;
  const userId = auth.userId;

  const [stewards, requests] = await Promise.all([
    readStewards(env),
    readClaimRequests(env),
  ]);

  // The pieces this caller currently stewards (bound records only).
  const heldKeys = new Set(
    stewards
      .filter((s) => s.clerkUserId === userId)
      .map((s) => `${s.pieceId}:${s.editionNumber ?? 0}`),
  );

  const mine = requests
    .filter(
      (r) =>
        r.status === 'pending' &&
        r.routedTo === 'holder' &&
        heldKeys.has(`${r.pieceId}:${r.editionNumber ?? 0}`),
    )
    .map(toHolderRequestView);

  return json({ ok: true, requests: mine });
}
