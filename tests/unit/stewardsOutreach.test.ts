/**
 * Unit suite for POST /api/atlas/stewards/outreach
 * (functions/api/atlas/stewards/outreach.ts, Phase 2 item F).
 *
 * An admin Better Auth session is not reproducible in a plain Node unit
 * test (it needs a live D1-backed session store), so this suite mocks
 * `requireAdmin`/`isAuthResponse` at `functions/api/_lib/auth`, the exact
 * module `outreach.ts` imports, and drives the real handler end to end
 * against an in-memory R2 stand-in. The mock reproduces requireAdmin's real
 * 401 (no session) / 403 (signed in, not on the allowlist) contract so the
 * auth-gate assertions below are meaningful.
 *
 * NOTE (found while writing this suite): `functions/api/_lib/auth.js` is a
 * stale, tracked, compiled duplicate of `auth.ts`. Node's extension-less
 * resolution can prefer it and it has NO requireAdmin/isAuthResponse
 * export. This suite deliberately mocks the extension-less specifier
 * (matching how `outreach.ts` imports it) so it is immune to that
 * ambiguity, but the stale file itself is a pre-existing repo issue,
 * flagged in the PR rather than fixed here (out of scope for item F).
 *
 * This is NOT exercised via `wrangler pages dev` (no admin session
 * available in this non-interactive environment); see the PR description
 * for what that leaves unverified.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StewardRecord } from '../../types';

vi.mock('../../functions/api/_lib/auth', () => ({
  requireAdmin: async (request: Request) => {
    const mode = request.headers.get('x-mock-session');
    if (mode === 'admin') {
      return {
        userId: 'admin-1',
        email: 'admin@example.com',
        emailVerified: true,
        payload: {},
      };
    }
    if (!mode) {
      return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ ok: false, error: 'forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  },
  isAuthResponse: (value: unknown) => value instanceof Response,
}));

const { onRequestPost } = await import('../../functions/api/atlas/stewards/outreach');

interface FakeR2Entry {
  text: string;
  etag: string;
}

/** Minimal in-memory stand-in for the R2 conditional-put contract that
 *  mutateJsonArray (functions/api/atlas/_helpers.ts) relies on: etag-gated
 *  put, get returns null for a missing key. Good enough to drive the real
 *  mutateStewards code path without a live Cloudflare binding. */
function createFakeBucket(seed: Record<string, unknown[]> = {}) {
  const store = new Map<string, FakeR2Entry>();
  let etagCounter = 0;
  for (const [key, value] of Object.entries(seed)) {
    etagCounter += 1;
    store.set(key, { text: JSON.stringify(value), etag: `etag-${etagCounter}` });
  }
  return {
    store,
    async get(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      return {
        etag: entry.etag,
        async text() {
          return entry.text;
        },
      };
    },
    async put(
      key: string,
      value: string,
      opts?: { onlyIf?: { etagMatches?: string; etagDoesNotMatch?: string } },
    ) {
      const existing = store.get(key);
      if (opts?.onlyIf?.etagMatches !== undefined) {
        if (!existing || existing.etag !== opts.onlyIf.etagMatches) return null;
      }
      if (opts?.onlyIf?.etagDoesNotMatch === '*' && existing) {
        return null;
      }
      etagCounter += 1;
      const etag = `etag-${etagCounter}`;
      store.set(key, { text: value, etag });
      return { etag };
    },
  };
}

function steward(overrides: Partial<StewardRecord> = {}): StewardRecord {
  return {
    pieceId: 'UL-7',
    email: 'collector@example.com',
    issuedAt: '2026-01-01T00:00:00.000Z',
    outreachStatus: 'invited',
    ...overrides,
  };
}

function makeEnv(stewards: StewardRecord[] = []) {
  return {
    ATLAS_BUCKET: createFakeBucket({ 'atlas/stewards.json': stewards }),
    DB: {}, // truthy: verifyRequest bails out with null when !env.DB
    ADMIN_EMAILS: 'admin@example.com',
  };
}

function makeRequest(
  body: unknown,
  sessionMode: 'admin' | 'user' | 'none' = 'admin',
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (sessionMode !== 'none') headers['x-mock-session'] = sessionMode;
  return new Request('https://mandalacodes.com/api/atlas/stewards/outreach', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('POST /api/atlas/stewards/outreach', () => {
  let env: ReturnType<typeof makeEnv>;

  beforeEach(() => {
    env = makeEnv([steward()]);
  });

  it('rejects without a signed-in session (401)', async () => {
    const res = await onRequestPost({
      request: makeRequest(
        { pieceId: 'UL-7', outreachStatus: 'contacted' },
        'none',
      ),
      env,
    } as never);
    expect(res.status).toBe(401);
  });

  it('rejects a signed-in non-admin session (403)', async () => {
    const res = await onRequestPost({
      request: makeRequest(
        { pieceId: 'UL-7', outreachStatus: 'contacted' },
        'user',
      ),
      env,
    } as never);
    expect(res.status).toBe(403);
  });

  it('rejects a manual write of "claimed" with 400, even for an admin', async () => {
    const res = await onRequestPost({
      request: makeRequest({ pieceId: 'UL-7', outreachStatus: 'claimed' }),
      env,
    } as never);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.ok).toBe(false);
    expect(data.error).toMatch(/claimed/i);

    // And the underlying record is untouched.
    const raw = env.ATLAS_BUCKET.store.get('atlas/stewards.json')!;
    const stored = JSON.parse(raw.text) as StewardRecord[];
    expect(stored[0].outreachStatus).toBe('invited');
  });

  it('rejects an unknown outreachStatus value with 400', async () => {
    const res = await onRequestPost({
      request: makeRequest({ pieceId: 'UL-7', outreachStatus: 'ghosted' }),
      env,
    } as never);
    expect(res.status).toBe(400);
  });

  it('rejects unknown body fields with 400', async () => {
    const res = await onRequestPost({
      request: makeRequest({
        pieceId: 'UL-7',
        outreachStatus: 'contacted',
        notes: 'sneaking this in',
      }),
      env,
    } as never);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { ok: boolean; error: string };
    expect(data.error).toMatch(/notes/);
  });

  it('404s when no steward record matches the (pieceId, editionNumber) tuple', async () => {
    const res = await onRequestPost({
      request: makeRequest({ pieceId: 'UL-999', outreachStatus: 'contacted' }),
      env,
    } as never);
    expect(res.status).toBe(404);
  });

  for (const status of ['contacted', 'paused', 'declined', 'no-contact', 'invited']) {
    it(`accepts a manual "${status}" write from an admin and persists it`, async () => {
      const res = await onRequestPost({
        request: makeRequest({ pieceId: 'UL-7', outreachStatus: status }),
        env,
      } as never);
      expect(res.status).toBe(200);
      const data = (await res.json()) as { ok: boolean; record: StewardRecord };
      expect(data.ok).toBe(true);
      expect(data.record.outreachStatus).toBe(status);

      // Persists: re-reading the bucket (a fresh "GET"-equivalent, i.e.
      // "reload") shows the write landed, not just the in-memory response.
      const raw = env.ATLAS_BUCKET.store.get('atlas/stewards.json')!;
      const stored = JSON.parse(raw.text) as StewardRecord[];
      const record = stored.find((s) => s.pieceId === 'UL-7');
      expect(record?.outreachStatus).toBe(status);
    });
  }

  it('identifies the record by pieceId + editionNumber, not pieceId alone', async () => {
    env = makeEnv([
      steward({ pieceId: 'UL-7', editionNumber: 1, outreachStatus: 'invited' }),
      steward({ pieceId: 'UL-7', editionNumber: 2, outreachStatus: 'invited' }),
    ]);
    const res = await onRequestPost({
      request: makeRequest({
        pieceId: 'UL-7',
        editionNumber: 2,
        outreachStatus: 'contacted',
      }),
      env,
    } as never);
    expect(res.status).toBe(200);
    const raw = env.ATLAS_BUCKET.store.get('atlas/stewards.json')!;
    const stored = JSON.parse(raw.text) as StewardRecord[];
    expect(stored.find((s) => s.editionNumber === 1)?.outreachStatus).toBe('invited');
    expect(stored.find((s) => s.editionNumber === 2)?.outreachStatus).toBe('contacted');
  });
});
