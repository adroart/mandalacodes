/**
 * GET /api/atlas/claim-requests — the admin claim-request queue (M4).
 *
 * Admin-only. Returns every request, pending first (FIFO within each
 * group). Holder-routed requests appear too — the admin sees the whole
 * picture and may adjudicate per the documented dispute process — but the
 * routedTo flag tells the dashboard who the DEFAULT decider is.
 */

import type { ClaimRequest } from '../../../../types';
import type { PagesContext } from '../_helpers';
import { json, readClaimRequests } from '../_helpers';
import { requireAdmin, isAuthResponse } from '../../_lib/clerk';

function sortKey(r: ClaimRequest): string {
  return `${r.status === 'pending' ? '0' : '1'}:${r.createdAt}`;
}

export async function onRequestGet(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireAdmin(request, env);
  if (isAuthResponse(auth)) return auth;

  const requests = await readClaimRequests(env);
  const sorted = requests
    .slice()
    .sort((a, b) => (sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0));

  return json({ ok: true, requests: sorted });
}
