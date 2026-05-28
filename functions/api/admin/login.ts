/**
 * POST /api/admin/login
 * Body: { password: string }
 *
 * Sets the `admin_session` HttpOnly cookie on success. The cookie value is
 * the password itself — `isAdmin()` in functions/api/atlas/_helpers.ts does
 * a direct equality check against ATLAS_ADMIN_PASSWORD_HASH. So the env var
 * is *also* the secret stored on the user's machine. Fine for a one-admin
 * site; revisit if multiple operators ever need atlas access.
 */

interface LoginEnv {
  ATLAS_ADMIN_PASSWORD_HASH: string;
}

interface PagesContext {
  request: Request;
  env: LoginEnv;
}

const COOKIE_NAME = 'admin_session';

function cookieHeader(value: string, isSecure: boolean): string {
  const base = `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`;
  return isSecure ? `${base}; Secure` : base;
}

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  let body: { password?: unknown };
  try {
    body = (await request.json()) as { password?: unknown };
  } catch {
    body = {};
  }

  const password = typeof body.password === 'string' ? body.password : '';
  if (!password || password !== env.ATLAS_ADMIN_PASSWORD_HASH) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  const isSecure = new URL(request.url).protocol === 'https:';
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Set-Cookie': cookieHeader(env.ATLAS_ADMIN_PASSWORD_HASH, isSecure),
    },
  });
}
