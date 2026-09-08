/**
 * The cross-site login handoff (identity direction,
 * i64os/substrate/directions/identity.md): a signed-in session on this site
 * mints a Better Auth one-time-token (functions/api/auth/handoff.js) and the
 * other site's accept endpoint (functions/api/auth/handoff/accept.js)
 * verifies it and sets its own session cookie. Both endpoints exist in both
 * repos; this file proves the shape once against a real Better Auth
 * instance running on a real `node:sqlite` in-memory database (Better Auth
 * 1.6 duck-types a `node:sqlite` DatabaseSync the same way it duck-types a
 * D1 binding — no shim needed, see @better-auth/kysely-adapter's dialect
 * detection). A real email-OTP sign-in produces the starting session
 * cookie, exactly as a browser would get one.
 *
 * The schema below mirrors Adrian-Website's migrations/006_better_auth.sql
 * exactly (this repo owns no migrations of its own — see the comment atop
 * wrangler.toml — so it cannot read that file at test time; Adrian-Website
 * is the schema's single source of truth, this is a proving copy only).
 *
 * Adrian-Website carries the mirror image of this test against its own
 * copy of the two endpoints.
 */
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { createAuth } from '../../lib/account/auth.server.js';
import { onRequest as mintHandoff } from '../../functions/api/auth/handoff.js';
import { onRequest as acceptHandoff } from '../../functions/api/auth/handoff/accept.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS user (
  id            TEXT PRIMARY KEY,
  name          TEXT,
  email         TEXT NOT NULL UNIQUE,
  emailVerified INTEGER NOT NULL DEFAULT 0,
  image         TEXT,
  createdAt     INTEGER NOT NULL,
  updatedAt     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS session (
  id        TEXT PRIMARY KEY,
  userId    TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  token     TEXT NOT NULL UNIQUE,
  expiresAt INTEGER NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_session_userId ON session(userId);
CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);

CREATE TABLE IF NOT EXISTS account (
  id                    TEXT PRIMARY KEY,
  userId                TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  accountId             TEXT NOT NULL,
  providerId            TEXT NOT NULL,
  accessToken           TEXT,
  refreshToken          TEXT,
  accessTokenExpiresAt  INTEGER,
  refreshTokenExpiresAt INTEGER,
  scope                 TEXT,
  idToken               TEXT,
  password              TEXT,
  createdAt             INTEGER NOT NULL,
  updatedAt             INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_account_userId ON account(userId);

CREATE TABLE IF NOT EXISTS verification (
  id         TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value      TEXT NOT NULL,
  expiresAt  INTEGER NOT NULL,
  createdAt  INTEGER NOT NULL,
  updatedAt  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification(identifier);
`;

function freshDb() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

function baseEnv(db: DatabaseSync, overrides: Record<string, unknown> = {}) {
  return {
    DB: db,
    BETTER_AUTH_SECRET: 'test-only-handoff-secret-not-a-real-value',
    BETTER_AUTH_URL: 'https://mandalacodes.com',
    RESEND_API_KEY: 'test-only-resend-key',
    HANDOFF_TARGET_ORIGIN: 'https://adrianrasmussen.test',
    ...overrides,
  };
}

/** Real email-OTP sign-in against the given env, returning the session cookie header. */
async function signIn(env: ReturnType<typeof baseEnv>, email = 'collector@example.com') {
  const originalFetch = globalThis.fetch;
  let capturedOtp = '';
  globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const match = /code is (\d+)/.exec(body.text);
    capturedOtp = match ? match[1] : '';
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as typeof fetch;

  try {
    const auth = createAuth(env);
    const sendReq = new Request('https://mandalacodes.com/api/auth/email-otp/send-verification-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, type: 'sign-in' }),
    });
    const sendRes = await auth.handler(sendReq);
    expect(sendRes.status).toBe(200);

    const signInReq = new Request('https://mandalacodes.com/api/auth/sign-in/email-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp: capturedOtp }),
    });
    const signInRes = await auth.handler(signInReq);
    expect(signInRes.status).toBe(200);
    const cookies = signInRes.headers.getSetCookie();
    expect(cookies.length).toBeGreaterThan(0);
    return cookies.map((c) => c.split(';')[0]).join('; ');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function mintRequest(cookie: string | null, search = '') {
  return new Request(`https://mandalacodes.com/api/auth/handoff${search}`, {
    method: 'GET',
    headers: cookie ? { cookie } : {},
  });
}

function acceptRequest(query: string) {
  return new Request(`https://adrianrasmussen.test/api/auth/handoff/accept${query}`, { method: 'GET' });
}

describe('cross-site login handoff', () => {
  it('a valid token yields a session for the same user id on the other side', async () => {
    const db = freshDb();
    const env = baseEnv(db);
    const cookie = await signIn(env);

    const mintRes = await mintHandoff({ request: mintRequest(cookie), env, waitUntil: () => {} } as any);
    expect(mintRes.status).toBe(302);
    const location = new URL(mintRes.headers.get('Location')!);
    expect(location.origin).toBe('https://adrianrasmussen.test');
    expect(location.pathname).toBe('/api/auth/handoff/accept');
    const token = location.searchParams.get('token');
    expect(token).toBeTruthy();

    const auth = createAuth(env);
    const originalSession = await auth.api.getSession({ headers: new Headers({ cookie }) });

    const acceptRes = await acceptHandoff({
      request: acceptRequest(`?token=${encodeURIComponent(token!)}&next=${encodeURIComponent('/account')}`),
      env,
      waitUntil: () => {},
    } as any);
    expect(acceptRes.status).toBe(302);
    expect(acceptRes.headers.get('Location')).toBe('/account');
    const acceptedCookies = acceptRes.headers.getSetCookie();
    expect(acceptedCookies.length).toBeGreaterThan(0);

    const acceptedCookieHeader = acceptedCookies.map((c) => c.split(';')[0]).join('; ');
    const acceptedSession = await auth.api.getSession({ headers: new Headers({ cookie: acceptedCookieHeader }) });
    expect(acceptedSession?.user?.id).toBeTruthy();
    expect(acceptedSession!.user.id).toBe(originalSession!.user.id);
  });

  it('a second use of the same token is rejected', async () => {
    const db = freshDb();
    const env = baseEnv(db);
    const cookie = await signIn(env);

    const mintRes = await mintHandoff({ request: mintRequest(cookie), env, waitUntil: () => {} } as any);
    const token = new URL(mintRes.headers.get('Location')!).searchParams.get('token')!;

    const first = await acceptHandoff({
      request: acceptRequest(`?token=${encodeURIComponent(token)}`),
      env,
      waitUntil: () => {},
    } as any);
    expect(first.status).toBe(302);

    const second = await acceptHandoff({
      request: acceptRequest(`?token=${encodeURIComponent(token)}`),
      env,
      waitUntil: () => {},
    } as any);
    expect(second.status).toBe(400);
    expect(second.headers.getSetCookie().length).toBe(0);
  });

  it('an expired token is rejected', async () => {
    const db = freshDb();
    const env = baseEnv(db);
    const cookie = await signIn(env);

    const mintRes = await mintHandoff({ request: mintRequest(cookie), env, waitUntil: () => {} } as any);
    const token = new URL(mintRes.headers.get('Location')!).searchParams.get('token')!;

    // The plugin stores the token hashed (storeToken: 'hashed'), so force
    // every pending verification row into the past rather than trying to
    // recompute the hash ourselves — there is only one at this point.
    db.exec(`UPDATE verification SET expiresAt = ${Date.now() - 60_000} WHERE identifier LIKE 'one-time-token:%'`);

    const res = await acceptHandoff({
      request: acceptRequest(`?token=${encodeURIComponent(token)}`),
      env,
      waitUntil: () => {},
    } as any);
    expect(res.status).toBe(400);
  });

  it('an unauthenticated caller of the mint endpoint gets 401', async () => {
    const db = freshDb();
    const env = baseEnv(db);

    const res = await mintHandoff({ request: mintRequest(null), env, waitUntil: () => {} } as any);
    expect(res.status).toBe(401);
  });

  it('next with an external URL is rejected on both the mint and the accept side', async () => {
    const db = freshDb();
    const env = baseEnv(db);
    const cookie = await signIn(env);

    const mintRes = await mintHandoff({
      request: mintRequest(cookie, `?next=${encodeURIComponent('https://evil.example/steal')}`),
      env,
      waitUntil: () => {},
    } as any);
    const location = new URL(mintRes.headers.get('Location')!);
    expect(location.searchParams.get('next')).toBe('/account');

    const token = location.searchParams.get('token')!;
    const acceptRes = await acceptHandoff({
      request: acceptRequest(
        `?token=${encodeURIComponent(token)}&next=${encodeURIComponent('//evil.example/steal')}`,
      ),
      env,
      waitUntil: () => {},
    } as any);
    expect(acceptRes.status).toBe(302);
    expect(acceptRes.headers.get('Location')).toBe('/account');
  });

  it('resolves the target origin from BETTER_AUTH_URL when HANDOFF_TARGET_ORIGIN is unset', async () => {
    const db = freshDb();
    const prodEnv = baseEnv(db, { HANDOFF_TARGET_ORIGIN: undefined });
    const cookie = await signIn(prodEnv);
    const prodRes = await mintHandoff({ request: mintRequest(cookie), env: prodEnv, waitUntil: () => {} } as any);
    expect(new URL(prodRes.headers.get('Location')!).origin).toBe('https://adrianrasmussen.com');

    const devDb = freshDb();
    const devEnv = baseEnv(devDb, {
      HANDOFF_TARGET_ORIGIN: undefined,
      BETTER_AUTH_URL: 'http://localhost:2222',
    });
    const devCookie = await signIn(devEnv);
    const devRes = await mintHandoff({ request: mintRequest(devCookie), env: devEnv, waitUntil: () => {} } as any);
    expect(new URL(devRes.headers.get('Location')!).origin).toBe('http://localhost:5555');
  });
});
