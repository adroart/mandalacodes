/**
 * Shared auth helpers for Pages Functions (profile / collections / sync-user).
 *
 * Validates the self-owned Better Auth session cookie. Return contract:
 * `{ userId, email, emailVerified, session, user }` or a 401 Response.
 *
 * `userId` is the Better Auth user id; the app's D1 users row stores it in
 * the vendor-neutral `auth_user_id` column.
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

/**
 * Coerce a post-handoff redirect target to a SAME-SITE relative path.
 * Rejects absolute URLs and protocol-relative (`//host`) / backslash tricks
 * so `?next=` on the login handoff (functions/api/auth/handoff.js and
 * functions/api/auth/handoff/accept.js) can never become an open redirect.
 * Mirrors the equivalent helper in Adrian-Website's functions/api/_lib/auth.ts.
 */
export function safeReturnPath(value, fallback = '/') {
  const safeFallback =
    typeof fallback === 'string' &&
    fallback.startsWith('/') &&
    !fallback.startsWith('//') &&
    !fallback.includes('\\')
      ? fallback
      : '/';

  if (typeof value !== 'string') return safeFallback;
  const candidate = value.trim();
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
    return safeFallback;
  }

  try {
    const parsed = new URL(candidate, 'https://internal.invalid');
    if (parsed.origin !== 'https://internal.invalid') return safeFallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return safeFallback;
  }
}
