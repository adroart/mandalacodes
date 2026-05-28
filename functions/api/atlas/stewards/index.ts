/**
 * GET /api/atlas/stewards
 *
 * Admin-only. Returns the steward roster. No HMAC hashes anymore — Clerk
 * holds the user identity — but `clerkUserId` is still useful context for
 * the admin dashboard.
 */

import type { PagesContext } from '../_helpers';
import { json, readStewards } from '../_helpers';
import { requireAdmin, isAuthResponse } from '../../_lib/clerk';

export async function onRequestGet(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireAdmin(request, env);
  if (isAuthResponse(auth)) return auth;

  const stewards = await readStewards(env);
  return json({ ok: true, stewards });
}
