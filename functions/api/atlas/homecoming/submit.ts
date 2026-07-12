/**
 * POST /api/atlas/homecoming/submit, a past collector brings home a piece
 * the atlas has NO record of (Phase 2.5).
 *
 * Authenticated (any signed-in user). The collector offers photos of the
 * piece, roughly when and where it came to them, and the city where it rests
 * now. Their email is taken from the verified session, never the body, it
 * seeds the steward record when Adrian recognizes the work.
 *
 * This binds nothing. It appends a pending request to the mutable homecoming
 * queue; recognition and minting happen only on Adrian's explicit confirm
 * (functions/api/atlas/homecoming/resolve.ts). Photos and story are private
 * admin context, they never touch the ledger, the public projection, or the
 * mirror.
 */

import type { PagesContext } from '../_helpers';
import { json } from '../_helpers';
import { getCityById } from '../../../../data/cities';
import { requireUser, isAuthResponse } from '../../_lib/auth';
import {
  mutateHomecomingRequests,
} from '../_homecoming';
import {
  parseHomecomingInput,
  planHomecomingRequest,
} from '../../../../lib/atlas/homecoming';

export async function onRequestPost(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireUser(request, env);
  if (isAuthResponse(auth)) return auth;
  const userId = auth.userId;
  const email = auth.email;
  if (!email) {
    // The email seeds the steward record when Adrian binds the piece , 
    // without one in the verified session there is nothing to bind to.
    return json(
      { ok: false, error: 'Your account has no email address, add one and try again.' },
      400,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const parsed = parseHomecomingInput(body);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);

  // City existence needs the cities table, so it lives here rather than in the
  // pure parser. ATLAS_PLACES resolves cities and country-level centroids.
  if (!getCityById(parsed.value.cityId)) {
    return json({ ok: false, error: 'Unknown city' }, 400);
  }

  const now = new Date().toISOString();
  const outcome = await mutateHomecomingRequests(env, (requests) => {
    const plan = planHomecomingRequest(requests, {
      input: parsed.value,
      requesterRef: userId,
      requesterEmail: email,
      id: crypto.randomUUID(),
      now,
    });
    if (!plan.ok) {
      const status = plan.error.includes('at most') ? 429 : 409;
      return json({ ok: false, error: plan.error }, status);
    }
    return { next: [...requests, plan.value], result: plan.value };
  });
  if (outcome instanceof Response) return outcome;

  return json({ ok: true, request: outcome.result });
}
