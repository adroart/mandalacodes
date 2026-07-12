/**
 * GET /api/atlas/homecoming, the homecoming queue, admin only (Phase 2.5).
 *
 * Returns every homecoming request (pending and resolved) so the admin surface
 * can show the queue and a short recently-resolved tail. These records hold
 * private collector context (photos, story, email); the requireAdmin gate is
 * the whole privacy boundary, so nothing here is ever exposed to a non-admin.
 */

import type { PagesContext } from '../_helpers';
import { json } from '../_helpers';
import { requireAdmin, isAuthResponse } from '../../_lib/auth';
import { readHomecomingRequests } from '../_homecoming';

export async function onRequestGet(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireAdmin(request, env);
  if (isAuthResponse(auth)) return auth;

  const requests = await readHomecomingRequests(env);
  // Newest first, so the freshly-arrived pieces sit at the top of the queue.
  requests.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return json({ ok: true, requests });
}
