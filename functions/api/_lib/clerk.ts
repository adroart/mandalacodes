/**
 * Clerk auth helpers for Cloudflare Pages Functions.
 *
 * Verifies the JWT in the `Authorization: Bearer ...` header against Clerk.
 * Two helpers:
 *   requireUser  — any signed-in Clerk user
 *   requireAdmin — signed-in AND email is in ADMIN_EMAILS env var
 *
 * Pattern ported from Adrian-Website/functions/api/_lib/clerk.js with the
 * admin allowlist check folded in.
 */

import { verifyToken } from '@clerk/backend';

export interface AuthEnv {
  CLERK_SECRET_KEY?: string;
  ADMIN_EMAILS?: string;
}

export interface AuthContext {
  userId: string;
  email: string | null;
  payload: Record<string, unknown>;
}

export function bearerToken(request: Request): string | null {
  const header =
    request.headers.get('authorization') || request.headers.get('Authorization');
  if (!header) return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

/**
 * Verify the request's bearer token. Returns `{userId, email, payload}` on
 * success, `null` on any failure (missing token, bad signature, expired,
 * no CLERK_SECRET_KEY env var configured).
 */
export async function verifyRequest(
  request: Request,
  env: AuthEnv,
): Promise<AuthContext | null> {
  const token = bearerToken(request);
  if (!token) return null;
  if (!env.CLERK_SECRET_KEY) return null;
  try {
    const payload = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
    if (!payload || typeof payload.sub !== 'string') return null;
    // Clerk includes the primary email in the JWT when configured. Fall back
    // to null and let the caller fetch the user record if needed.
    const rawEmail = (payload as Record<string, unknown>).email;
    const rawEmailAddresses = (payload as Record<string, unknown>).email_addresses;
    let email: string | null = null;
    if (typeof rawEmail === 'string') {
      email = rawEmail;
    } else if (Array.isArray(rawEmailAddresses) && rawEmailAddresses[0]) {
      const first = rawEmailAddresses[0] as { email_address?: unknown };
      if (typeof first.email_address === 'string') email = first.email_address;
    }
    return {
      userId: payload.sub,
      email,
      payload: payload as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

/**
 * Require a verified user. On success returns the auth context. On failure
 * returns a fully formed 401 Response that the handler should immediately
 * return to the client.
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
 * Returns the auth context on success, or a 401/403 Response on failure.
 *
 * ADMIN_EMAILS is a comma-separated list set in the Cloudflare Pages
 * dashboard. Compares case-insensitively. Empty / missing env var means
 * no one is admin — fail closed.
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
 * Type guard — narrows the union returned by requireAdmin/requireUser to
 * the AuthContext branch. Use at the top of every handler:
 *   const auth = await requireAdmin(request, env);
 *   if (auth instanceof Response) return auth;
 *   // auth is now AuthContext
 */
export function isAuthResponse(value: AuthContext | Response): value is Response {
  return value instanceof Response;
}
