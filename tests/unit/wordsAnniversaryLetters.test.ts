/**
 * HTTP-layer coverage for the words-anniversary derive-on-read path in
 * GET /api/atlas/steward/letters (Phase 2 item D, "shall I keep carrying
 * these words?"). The pure due-logic (wordsAnniversaryYearDue) is pinned in
 * tests/unit/letters.test.ts; this suite exercises the actual
 * onRequestGet handler against an in-memory R2 mock (same shape the real
 * ATLAS_BUCKET binding exposes: get/put with conditional-write etags — see
 * functions/api/atlas/_helpers.ts mutateJsonArray) with auth mocked out, so
 * the derive-append-email wiring itself is proven, not just the math it
 * calls.
 *
 * A live steward session (Better Auth cookie + a real Cloudflare R2/D1
 * binding via wrangler) was not reproducible in this sandbox, so this is
 * the closest exercise of the actual route code short of a live/wrangler
 * run — see the PR description for what remains unverified end-to-end.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AtlasLetter, LedgerEvent, SharedIntention, StewardRecord } from '../../types';

vi.mock('../../functions/api/_lib/auth', () => ({
  requireUser: vi.fn(async () => ({
    userId: 'user_test_steward',
    email: 'steward@example.com',
    emailVerified: true,
    payload: {},
  })),
  isAuthResponse: (value: unknown) => value instanceof Response,
}));

import { onRequestGet } from '../../functions/api/atlas/steward/letters';
import {
  KEY_LEDGER,
  KEY_LETTERS,
  KEY_SHARED_INTENTIONS,
  KEY_STEWARDS,
} from '../../functions/api/atlas/_helpers';
import type { AtlasEnv, PagesContext } from '../../functions/api/atlas/_helpers';

const USER_ID = 'user_test_steward';
const PIECE_ID = 'UL-words-1';

/** Minimal in-memory R2 mock matching the local R2Bucket shape _helpers.ts
 *  declares (get/put with conditional etag writes) — enough to exercise the
 *  real mutateJsonArray retry-on-conflict machinery the route runs through. */
function createFakeBucket(seed: Record<string, unknown>) {
  const store = new Map<string, { data: string; etag: string }>();
  let etagCounter = 0;
  for (const [key, value] of Object.entries(seed)) {
    etagCounter++;
    store.set(key, { data: JSON.stringify(value), etag: `etag-${etagCounter}` });
  }
  return {
    async get(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      return { etag: entry.etag, text: async () => entry.data };
    },
    async put(
      key: string,
      value: string,
      options?: { onlyIf?: { etagMatches?: string; etagDoesNotMatch?: string } },
    ) {
      const existing = store.get(key);
      if (options?.onlyIf?.etagMatches !== undefined) {
        if (!existing || existing.etag !== options.onlyIf.etagMatches) return null;
      }
      if (options?.onlyIf?.etagDoesNotMatch !== undefined) {
        if (existing) return null; // '*' — must not already exist
      }
      etagCounter++;
      store.set(key, { data: value, etag: `etag-${etagCounter}` });
      return { success: true };
    },
    dump<T>(key: string): T {
      const entry = store.get(key);
      return entry ? (JSON.parse(entry.data) as T) : ([] as unknown as T);
    },
  };
}

function ledgerFor(pieceId: string, claimedAt: string): LedgerEvent[] {
  return [
    {
      id: 'evt-created',
      pieceId,
      type: 'created',
      date: '2020-01-01T00:00:00.000Z',
      actor: 'admin',
      prevHash: null,
      hash: 'hash-created',
    },
    {
      id: 'evt-claimed',
      pieceId,
      type: 'claimed',
      date: claimedAt,
      actor: 'steward',
      prevHash: 'hash-created',
      hash: 'hash-claimed',
    },
  ];
}

function stewardFor(pieceId: string): StewardRecord {
  return {
    pieceId,
    email: 'steward@example.com',
    clerkUserId: USER_ID,
    issuedAt: '2020-01-01T00:00:00.000Z',
    outreachStatus: 'claimed',
  };
}

function sharedIntentionFor(
  pieceId: string,
  overrides: Partial<SharedIntention> = {},
): SharedIntention {
  return {
    id: 'sin-1',
    pieceId,
    inscriptionId: 'insc-1',
    text: 'A dream about open water, and about returning eventually to the sea.',
    sharedAt: '2024-06-10T00:00:00.000Z',
    status: 'live',
    ...overrides,
  };
}

async function getLetters(bucket: ReturnType<typeof createFakeBucket>, pieceId: string) {
  const request = new Request(
    `https://mandalacodes.com/api/atlas/steward/letters?pieceId=${pieceId}`,
  );
  const env = { ATLAS_BUCKET: bucket } as unknown as AtlasEnv;
  const res = await onRequestGet({ request, env } as PagesContext);
  const body = (await res.json()) as { ok: boolean; letters: AtlasLetter[]; unread: number };
  return { res, body };
}

const NOW_OVER_A_YEAR_AFTER_SHARE = '2025-07-10T00:00:00.000Z';

describe('GET /api/atlas/steward/letters — words-anniversary derive-on-read', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_OVER_A_YEAR_AFTER_SHARE));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates exactly one words-anniversary letter for a live intention over a year old, and none on a second GET', async () => {
    const bucket = createFakeBucket({
      [KEY_LEDGER]: ledgerFor(PIECE_ID, '2024-06-10T00:00:00.000Z'),
      [KEY_STEWARDS]: [stewardFor(PIECE_ID)],
      [KEY_SHARED_INTENTIONS]: [sharedIntentionFor(PIECE_ID)],
      [KEY_LETTERS]: [],
    });

    const first = await getLetters(bucket, PIECE_ID);
    expect(first.res.status).toBe(200);
    expect(first.body.ok).toBe(true);
    const wordsLettersAfterFirst = first.body.letters.filter(
      (l) => l.kind === 'words-anniversary',
    );
    expect(wordsLettersAfterFirst).toHaveLength(1);
    expect(wordsLettersAfterFirst[0].body).toContain('A dream about open water');

    const second = await getLetters(bucket, PIECE_ID);
    const wordsLettersAfterSecond = second.body.letters.filter(
      (l) => l.kind === 'words-anniversary',
    );
    // Idempotent: the second open must not append a duplicate.
    expect(wordsLettersAfterSecond).toHaveLength(1);
    expect(wordsLettersAfterSecond[0].id).toBe(wordsLettersAfterFirst[0].id);
  });

  it('never generates the ask for a rehomed intention', async () => {
    const pieceId = 'UL-words-rehomed';
    const bucket = createFakeBucket({
      [KEY_LEDGER]: ledgerFor(pieceId, '2024-06-10T00:00:00.000Z'),
      [KEY_STEWARDS]: [stewardFor(pieceId)],
      [KEY_SHARED_INTENTIONS]: [sharedIntentionFor(pieceId, { status: 'rehomed' })],
      [KEY_LETTERS]: [],
    });

    const { body } = await getLetters(bucket, pieceId);
    expect(body.letters.filter((l) => l.kind === 'words-anniversary')).toHaveLength(0);
  });

  it('never generates the ask for a withdrawn intention', async () => {
    const pieceId = 'UL-words-withdrawn';
    const bucket = createFakeBucket({
      [KEY_LEDGER]: ledgerFor(pieceId, '2024-06-10T00:00:00.000Z'),
      [KEY_STEWARDS]: [stewardFor(pieceId)],
      [KEY_SHARED_INTENTIONS]: [sharedIntentionFor(pieceId, { status: 'withdrawn' })],
      [KEY_LETTERS]: [],
    });

    const { body } = await getLetters(bucket, pieceId);
    expect(body.letters.filter((l) => l.kind === 'words-anniversary')).toHaveLength(0);
  });

  it('never generates the ask when nothing has ever been shared', async () => {
    const pieceId = 'UL-words-none';
    const bucket = createFakeBucket({
      [KEY_LEDGER]: ledgerFor(pieceId, '2024-06-10T00:00:00.000Z'),
      [KEY_STEWARDS]: [stewardFor(pieceId)],
      [KEY_SHARED_INTENTIONS]: [],
      [KEY_LETTERS]: [],
    });

    const { body } = await getLetters(bucket, pieceId);
    expect(body.letters.filter((l) => l.kind === 'words-anniversary')).toHaveLength(0);
  });

  it('does not generate the ask before the intention has been live a full year', async () => {
    const pieceId = 'UL-words-recent';
    const bucket = createFakeBucket({
      [KEY_LEDGER]: ledgerFor(pieceId, '2024-06-10T00:00:00.000Z'),
      [KEY_STEWARDS]: [stewardFor(pieceId)],
      [KEY_SHARED_INTENTIONS]: [
        sharedIntentionFor(pieceId, { sharedAt: '2025-06-15T00:00:00.000Z' }),
      ],
      [KEY_LETTERS]: [],
    });

    const { body } = await getLetters(bucket, pieceId);
    expect(body.letters.filter((l) => l.kind === 'words-anniversary')).toHaveLength(0);
  });
});
