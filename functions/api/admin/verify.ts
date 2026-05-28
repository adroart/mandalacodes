/**
 * GET /api/admin/verify
 * Returns { ok: true } if the admin session cookie is valid.
 */

interface VerifyEnv {
  ATLAS_ADMIN_PASSWORD_HASH: string;
}

interface PagesContext {
  request: Request;
  env: VerifyEnv;
}

const COOKIE_NAME = 'admin_session';

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie') || '';
  const match = header
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

export async function onRequestGet({ request, env }: PagesContext): Promise<Response> {
  const session = getCookie(request, COOKIE_NAME);
  const ok = !!session && session === env.ATLAS_ADMIN_PASSWORD_HASH;
  return new Response(JSON.stringify({ ok }), {
    status: ok ? 200 : 401,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
