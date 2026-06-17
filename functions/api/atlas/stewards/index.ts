/**
 * GET /api/atlas/stewards
 *
 * Admin-only. Returns the steward roster. No HMAC hashes anymore — Clerk
 * holds the user identity — but `clerkUserId` is still useful context for
 * the admin dashboard.
 */

import type { PagesContext } from '../_helpers';
import { json, readStewards } from '../_helpers';
import { requireAdmin, isAuthResponse } from '../../_lib/auth';

export async function onRequestGet(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireAdmin(request, env);
  if (isAuthResponse(auth)) return auth;

  const stewards = await readStewards(env);
  // The claim-ritual answer (pendingFirstInscription) is private Ring 1
  // content belonging to the authoring steward only — not even the admin
  // roster sees it. Everything else on the record is admin context.
  const roster = stewards.map(
    ({ pendingFirstInscription: _pfi, ...rest }) => rest,
  );
  return json({ ok: true, stewards: roster });
}
