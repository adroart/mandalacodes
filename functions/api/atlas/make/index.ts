/**
 * GET /api/atlas/make — the make-request queue, admin only.
 *
 * Returns every make request (pending and resolved) so the admin surface
 * can show the queue and a short recently-resolved tail. These records hold
 * private context (the requester's email and note); the requireAdmin gate
 * is the whole privacy boundary.
 */

import type { PagesContext } from '../_helpers';
import { json } from '../_helpers';
import { requireAdmin, isAuthResponse } from '../../_lib/auth';
import { readMakeRequests } from '../_make';

export async function onRequestGet(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireAdmin(request, env);
  if (isAuthResponse(auth)) return auth;

  const requests = await readMakeRequests(env);
  // Newest first, so the freshly-arrived notes sit at the top of the queue.
  requests.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return json({ ok: true, requests });
}
