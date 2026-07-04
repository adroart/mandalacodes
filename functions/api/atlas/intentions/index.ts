/**
 * GET /api/atlas/intentions
 *
 * Admin-only. The map-of-dreams roster (M6, Lens 2) — every shared
 * intention, newest first. `untended` flags a LIVE entry that has never
 * been through the tending queue (POST /api/atlas/intentions/tend), so the
 * admin surface can point at what still needs a look.
 *
 * Sharing itself is never approval-gated (Adrian, 2026-07-04) — this list
 * is the quality-assurance pass AFTER publication, not a moderation queue
 * blocking it. Every entry here is (or was) already live on the globe.
 */

import { readSharedIntentions } from '../_helpers';
import type { PagesContext } from '../_helpers';
import { json } from '../_helpers';
import { requireAdmin, isAuthResponse } from '../../_lib/auth';

export async function onRequestGet(
  context: PagesContext,
): Promise<Response> {
  const { request, env } = context;

  const auth = await requireAdmin(request, env);
  if (isAuthResponse(auth)) return auth;

  const entries = await readSharedIntentions(env);
  const sorted = entries
    .slice()
    .sort((a, b) => (a.sharedAt < b.sharedAt ? 1 : a.sharedAt > b.sharedAt ? -1 : 0));

  const intentions = sorted.map((e) => ({
    ...e,
    untended: e.status === 'live' && !e.tended,
  }));

  return json({ ok: true, intentions });
}
