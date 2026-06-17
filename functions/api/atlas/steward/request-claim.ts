/**
 * POST /api/atlas/steward/request-claim — self-serve stewardship request
 * (M4). One mechanism for secondary sale, auction, gift, retroactive
 * collector, and inheritance: anyone signed in may ASK; a human resolves.
 *
 * Clerk-authenticated (any user). Body: { pieceId, editionNumber?, note? }
 * — the note is optional evidence (≤500 chars, e.g. "bought at the Vienna
 * auction, lot 12") and lives ONLY in the mutable request record.
 *
 * Routing (anti-takeover): if the piece has a BOUND steward the request
 * routes to that holder — the current holder, never the admin queue,
 * decides whether their piece moves. Unclaimed pieces route to the admin.
 * A request never binds anything by itself.
 *
 * Guardrails (re-validated inside the concurrency-safe mutator):
 *   - dedupe: one open request per (requester, piece, edition),
 *   - rate limit: max 3 open requests per requester,
 *   - self-guard: the bound steward of a piece can't request it.
 */

import {
  parseClaimRequestInput,
  planClaimRequest,
} from '../../../../utils/claimRequests';
import type { PagesContext } from '../_helpers';
import { json, mutateClaimRequests, readStewards } from '../_helpers';
import { requireUser, isAuthResponse } from '../../_lib/auth';

export async function onRequestPost(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireUser(request, env);
  if (isAuthResponse(auth)) return auth;
  const userId = auth.userId;
  const email = auth.email;
  if (!email) {
    // The email seeds the steward record on approval — without one in the
    // verified token there is nothing to bind.
    return json(
      { ok: false, error: 'Your account has no email address — add one and retry.' },
      400,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }
  const input = parseClaimRequestInput(body);
  if (!input.ok) return json({ ok: false, error: input.error }, 400);

  // Routing looks at the piece's CURRENT steward record. Read once here —
  // a racing bind between this read and the write below only affects which
  // queue sees the request, never whether anything binds.
  const stewards = await readStewards(env);
  const steward = stewards.find(
    (s) =>
      s.pieceId === input.value.pieceId &&
      (s.editionNumber ?? undefined) === (input.value.editionNumber ?? undefined),
  );

  const now = new Date().toISOString();
  const outcome = await mutateClaimRequests(env, (requests) => {
    const plan = planClaimRequest(requests, {
      input: input.value,
      requesterRef: userId,
      requesterEmail: email,
      steward,
      now,
    });
    if (!plan.ok) {
      const status = plan.error.includes('at most') ? 429 : 409;
      return json({ ok: false, error: plan.error }, status);
    }
    return { next: [...requests, plan.value], result: plan.value };
  });
  if (outcome instanceof Response) return outcome;

  // The requester sees their own record (it is their data) minus nothing —
  // requesterRef/email are theirs.
  return json({ ok: true, request: outcome.result });
}
