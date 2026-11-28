import { createAuth } from './auth.server.js';
import { googleRedirectHeaders, headers, random, sha, unb64, validChallenge, validState } from './handoff.server.js';
import { checkRateLimit, clientIp, tooManyRequests } from '../../functions/api/_lib/rate-limit.js';

const ORIGIN = 'https://mandalacodes.com';
const AUTHORIZE = ORIGIN + '/api/auth/lightweaver/authorize';
const CALLBACK = 'https://led.mandalacodes.com/api/account/mandala/callback';

function json(value, status) {
  const outgoing = headers();
  outgoing.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(value), { status, headers: outgoing });
}

function redirectToStudio(state, field, value) {
  const target = new URL(CALLBACK);
  target.searchParams.set('state', state);
  target.searchParams.set(field, value);
  const outgoing = headers();
  outgoing.set('Location', target.href);
  return new Response(null, { status: 302, headers: outgoing });
}

async function verifiedIdentity(user, adapter) {
  if (!user?.id || !user.emailVerified || !user.email) return null;
  const accounts = await adapter.findAccounts(user.id);
  const email = user.email.trim().toLowerCase();
  const google = accounts.filter(account => account.providerId === 'google');
  let subject = null;
  if (google.length) {
    // These are provider credentials previously stored by Better Auth after its
    // Google exchange. Never accept an ID token or an email from this request.
    for (const account of google) {
      if (!account.idToken) continue;
      let claims;
      try {
        claims = JSON.parse(new TextDecoder().decode(unb64(account.idToken.split('.')[1])));
      } catch {
        continue;
      }
      if (!['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss)
        || claims.sub !== account.accountId || !claims.sub || claims.email_verified !== true
        || claims.email?.toLowerCase() !== email
        || (!email.endsWith('@gmail.com') && !(typeof claims.hd === 'string' && /^[a-z0-9][a-z0-9.-]+$/i.test(claims.hd)))) continue;
      if (subject && subject !== account.accountId) return null;
      subject = account.accountId;
    }
    if (!subject) return null;
  }
  return { subject: user.id, email, email_verified: true, google_subject: subject };
}

async function continueWithGoogle(auth, request, state, challenge) {
  const resume = new URL(AUTHORIZE);
  resume.search = new URLSearchParams({ state, code_challenge: challenge, resumed: '1' });
  const cancel = new URL(resume);
  cancel.searchParams.set('cancelled', '1');
  const outgoing = await googleRedirectHeaders(auth, request, resume.href, cancel.href);
  return new Response(null, { status: 302, headers: outgoing });
}

export async function authorizeLightweaver(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  const challenge = url.searchParams.get('code_challenge');
  if (url.origin !== ORIGIN) return json({ error: 'invalid_host' }, 403);
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  if (!validState(state) || !validChallenge(challenge)) return json({ error: 'invalid_request' }, 400);
  if (url.searchParams.has('cancelled')) return redirectToStudio(state, 'error', 'access_denied');
  try {
    const rate = await checkRateLimit(env, 'auth:lw-start:' + clientIp(request), { limit: 40, windowMs: 600_000 });
    if (!rate.ok) return redirectToStudio(state, 'error', 'rate_limited');
    const auth = createAuth(env, context.waitUntil?.bind(context));
    const adapter = (await auth.$context).internalAdapter;
    const session = await auth.api.getSession({ headers: request.headers });
    const identity = await verifiedIdentity(session?.user, adapter);
    if (!identity) {
      if (url.searchParams.has('resumed')) return redirectToStudio(state, 'error', 'access_denied');
      return await continueWithGoogle(auth, request, state, challenge);
    }
    const code = random();
    await adapter.createVerificationValue({
      identifier: 'lightweaver-identity:' + await sha(code) + ':' + challenge,
      value: JSON.stringify(identity),
      expiresAt: new Date(Date.now() + 120_000),
    });
    return redirectToStudio(state, 'code', code);
  } catch {
    return redirectToStudio(state, 'error', 'sign_in_unavailable');
  }
}

export async function exchangeLightweaver(context) {
  const { request, env } = context;
  if (new URL(request.url).origin !== ORIGIN) return json({ error: 'invalid_host' }, 403);
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (request.headers.has('Origin') || !request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    return json({ error: 'invalid_request' }, 400);
  }
  try {
    const rate = await checkRateLimit(env, 'auth:lw-exchange:' + clientIp(request), { limit: 120, windowMs: 600_000 });
    if (!rate.ok) return tooManyRequests(rate.retryAfterSec);
    const text = await request.text();
    if (text.length > 1024) return json({ error: 'invalid_request' }, 400);
    const { code, code_verifier: verifier } = JSON.parse(text);
    if (!validChallenge(code) || typeof verifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) {
      return json({ error: 'invalid_request' }, 400);
    }
    const adapter = (await createAuth(env).$context).internalAdapter;
    const key = 'lightweaver-identity:' + await sha(code) + ':' + await sha(verifier);
    const row = await adapter.consumeVerificationValue(key);
    if (!row || new Date(row.expiresAt).getTime() <= Date.now()) return json({ error: 'invalid_grant' }, 400);
    return json(JSON.parse(row.value), 200);
  } catch {
    return json({ error: 'invalid_grant' }, 400);
  }
}
