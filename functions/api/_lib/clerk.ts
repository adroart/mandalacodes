/**
 * Auth helpers for Cloudflare Pages Functions (atlas steward + admin).
 *
 * NOTE ON THE NAME: still clerk.ts so the endpoints importing
 * requireUser/requireAdmin/isAuthResponse don't all change. It no longer uses
 * Clerk — it validates the self-owned Better Auth session cookie.
 *
 *   requireUser  — any signed-in user
 *   requireAdmin — signed-in AND email is on the ADMIN_EMAILS allowlist
 *
 * Return contract unchanged (AuthContext | Response).
 */

import { createAuth } from '../../../lib/account/auth.server.js';

export interface AuthEnv {
  DB?: unknown;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  ADMIN_EMAILS?: string;
}

export interface AuthContext {
  userId: string;
  email: string | null;
  /** True when the session's email is proven (email-code / Google sign-in, or
   *  a verified password account). Gates email-fallback steward binding so an
   *  unverified password signup can't claim a piece issued to someone else's
   *  email. */
  emailVerified: boolean;
  payload: Record<string, unknown>;
}

/** Kept for back-compat; bearer tokens are no longer used. */
export function bearerToken(request: Request): string | null {
  const header =
    request.headers.get('authorization') || request.headers.get('Authorization');
  if (!header) return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/**
 * Verify the request's Better Auth session cookie. Returns the auth context
 * on success, `null` on any failure.
 */
export async function verifyRequest(
  request: Request,
  env: AuthEnv,
): Promise<AuthContext | null> {
  if (!env.DB) return null;
  try {
    const auth = createAuth(env as Record<string, unknown>);
    const data = await auth.api.getSession({ headers: request.headers });
    if (!data || !data.user?.id) return null;
    return {
      userId: data.user.id,
      email: data.user.email ?? null,
      emailVerified: data.user.emailVerified === true,
      payload: { session: data.session, user: data.user },
    };
  } catch {
    return null;
  }
}

/**
 * Require a verified user. On success returns the auth context. On failure
 * returns a 401 Response the handler should return immediately.
 */
export async function requireUser(
  request: Request,
  env: AuthEnv,
): Promise<AuthContext | Response> {
  const auth = await verifyRequest(request, env);
  if (!auth) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
  return auth;
}

/**
 * Require a signed-in user whose email is on the ADMIN_EMAILS allowlist.
 * Comma-separated, case-insensitive. Empty/missing = no one is admin (fail closed).
 */
export async function requireAdmin(
  request: Request,
  env: AuthEnv,
): Promise<AuthContext | Response> {
  const auth = await verifyRequest(request, env);
  if (!auth) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
  const allowlist = (env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const email = (auth.email || '').toLowerCase();
  if (!email || !allowlist.includes(email)) {
    return new Response(JSON.stringify({ ok: false, error: 'forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
  return auth;
}

/**
 * Type guard — narrows the union returned by requireAdmin/requireUser.
 *   const auth = await requireAdmin(request, env);
 *   if (isAuthResponse(auth)) return auth;
 */
export function isAuthResponse(value: AuthContext | Response): value is Response {
  return value instanceof Response;
}
