/**
 * POST /api/auth/sync-user
 *
 * Called once per session after Clerk reports a signed-in user. Idempotent:
 * upserts the D1 users row by clerk_user_id, returns the persisted row.
 *
 * Mandala Codes scope: no Stripe customer creation, no guest-order relink.
 * Sales live on adrianrasmussen.com, so this site only needs identity.
 */

import { requireUser, jsonResponse } from '../_lib/clerk.js';
import { upsertUser } from '../_lib/db.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;

  if (!env.DB) {
    return jsonResponse({ error: 'db_not_configured' }, { status: 503 }, request, env);
  }

  const email = auth.email;
  if (!email) {
    return jsonResponse({ error: 'email_missing_from_jwt' }, { status: 400 }, request, env);
  }

  const user = await upsertUser(env.DB, {
    clerkUserId: auth.userId,
    email,
  });

  return jsonResponse({ user }, { status: 200 }, request, env);
}
