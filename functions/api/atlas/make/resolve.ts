/**
 * POST /api/atlas/make/resolve — admin marks a make request handled.
 *
 * Body: { requestId, action: 'answered' | 'dismissed' }. 'answered' records
 * that Adrian replied by email; 'dismissed' closes a note that needs no
 * reply. Neither touches the ledger; the queue is bookkeeping for a human
 * conversation.
 */

import type { PagesContext } from '../_helpers';
import { json } from '../_helpers';
import { requireAdmin, isAuthResponse } from '../../_lib/auth';
import { mutateMakeRequests } from '../_make';
import type { MakeRequest } from '../../../../lib/atlas/make';

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
  const obj = (body ?? {}) as Record<string, unknown>;
  const requestId = typeof obj.requestId === 'string' ? obj.requestId : '';
  const action = obj.action;
  if (!requestId || (action !== 'answered' && action !== 'dismissed')) {
    return json({ ok: false, error: 'Invalid request' }, 400);
  }

  const now = new Date().toISOString();
  const outcome = await mutateMakeRequests(env, (requests) => {
    const idx = requests.findIndex((r) => r.id === requestId);
    if (idx === -1) return json({ ok: false, error: 'Unknown request' }, 404);
    const existing = requests[idx];
    if (existing.status !== 'pending') {
      return json({ ok: false, error: 'Already resolved' }, 409);
    }
    const resolved: MakeRequest = {
      ...existing,
      status: action,
      resolvedAt: now,
      resolvedBy: auth.userId,
    };
    const next = requests.slice();
    next[idx] = resolved;
    return { next, result: resolved };
  });
  if (outcome instanceof Response) return outcome;

  return json({ ok: true, request: outcome.result });
}
