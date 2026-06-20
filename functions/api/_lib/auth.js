/**
 * Shared auth helpers for Pages Functions (profile / collections / sync-user).
 *
 * Validates the self-owned Better Auth session cookie. Return contract:
 * `{ userId, email, emailVerified, session, user }` or a 401 Response.
 *
 * `userId` is the Better Auth user id; the D1 users row stores it in the
 * `clerk_user_id` column — a legacy column name still scheduled for rename,
 * now holding the Better Auth id as the generic external-auth-id, so
 * `getUserByClerkId(env.DB, auth.userId)` keeps working until that rename.
 */

import { createAuth } from '../../../lib/account/auth.server.js';

/**
 * Verify the request's Better Auth session cookie.
 * @returns {Promise<null | { userId: string; email: string | null; session: any; user: any }>}
 */
export async function verifyRequest(request, env) {
  if (!env.DB) return null;
  try {
    const auth = createAuth(env);
    const data = await auth.api.getSession({ headers: request.headers });
    if (!data || !data.user?.id) return null;
    return {
      userId: data.user.id,
      email: data.user.email ?? null,
      emailVerified: data.user.emailVerified === true,
      session: data.session,
      user: data.user,
    };
  } catch {
    return null;
  }
}

export async function requireUser(request, env) {
  const auth = await verifyRequest(request, env);
  if (!auth) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return auth;
}

const ALLOWED_ORIGINS = [
  'https://mandalacodes.com',
  'https://www.mandalacodes.com',
  'https://mandalacodes.pages.dev',
];

export function isAllowedOrigin(origin, env) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Only relax to localhost when BETTER_AUTH_URL EXPLICITLY points at
  // localhost. A missing BETTER_AUTH_URL must NOT enable the dev relaxation
  // (that would open localhost CORS on a misconfigured prod deploy) — fail
  // closed instead.
  const isDev = env?.BETTER_AUTH_URL ? env.BETTER_AUTH_URL.includes('localhost') : false;
  if (isDev) {
    try {
      const url = new URL(origin);
      return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    } catch {
      return false;
    }
  }
  return false;
}

export function corsHeaders(origin, env) {
  if (!isAllowedOrigin(origin, env)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}

export function jsonResponse(body, init = {}, request = null, env = null) {
  const origin = request?.headers?.get?.('Origin') ?? null;
  const cors = origin && env ? corsHeaders(origin, env) : {};
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...cors, ...(init.headers || {}) },
  });
}
