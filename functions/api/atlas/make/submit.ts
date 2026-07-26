/**
 * POST /api/atlas/make/submit — "Begin your piece": a visitor asks the
 * studio to make one (which code, what size, what palette, a note).
 *
 * Authenticated (any signed-in user with a verified email — the address the
 * reply goes to; it is taken from the session, never the body). This binds
 * nothing and promises nothing: it appends a pending note to the mutable
 * make queue. Adrian reads the queue and answers by email; the conversation
 * lives in mail, only its beginning lives here.
 */

import type { PagesContext } from '../_helpers';
import { json } from '../_helpers';
import { requireUser, isAuthResponse } from '../../_lib/auth';
import { mutateMakeRequests } from '../_make';
import { parseMakeInput, planMakeRequest } from '../../../../lib/atlas/make';

export async function onRequestPost(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireUser(request, env);
  if (isAuthResponse(auth)) return auth;
  const userId = auth.userId;
  const email = auth.email;
  if (!email) {
    // Adrian replies by email; without one on the verified session there is
    // nowhere for the conversation to begin.
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

  const parsed = parseMakeInput(body);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);

  const now = new Date().toISOString();
  const outcome = await mutateMakeRequests(env, (requests) => {
    const plan = planMakeRequest(requests, {
      input: parsed.value,
      requesterRef: userId,
      requesterEmail: email,
      id: crypto.randomUUID(),
      now,
    });
    if (!plan.ok) {
      return json({ ok: false, error: plan.error }, 429);
    }
    return { next: [...requests, plan.value], result: plan.value };
  });
  if (outcome instanceof Response) return outcome;

  return json({ ok: true, request: outcome.result });
}
