import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LedgerEvent, PublicAtlasState, StewardRecord } from '../../types';
import { FULL_ARCHIVE } from '../../data/mockData';

vi.mock('workers-og', () => ({
  ImageResponse: class extends Response {
    constructor() {
      super(new Uint8Array([137, 80, 78, 71]), {
        headers: { 'Content-Type': 'image/png' },
      });
    }
  },
}));

vi.mock('../../functions/api/_lib/auth', () => ({
  requireUser: vi.fn(async () => ({
    userId: 'user_read_only',
    email: 'keeper@example.com',
    emailVerified: true,
  })),
  isAuthResponse: (value: unknown) => value instanceof Response,
}));

vi.mock('../../functions/api/atlas/_email', () => ({
  letterEmailBody: vi.fn(() => 'body'),
  letterEmailSubject: vi.fn(() => 'subject'),
  sendLetterEmail: vi.fn(async () => undefined),
}));

import { onRequestGet as getCard } from '../../functions/api/atlas/card/[[path]]';
import { onRequestGet as getInscriptions } from '../../functions/api/atlas/steward/inscriptions';
import { onRequestGet as getLetters } from '../../functions/api/atlas/steward/letters';
import { sendLetterEmail } from '../../functions/api/atlas/_email';
import {
  KEY_LEDGER,
  KEY_LETTERS,
  KEY_SHARED_INTENTIONS,
  KEY_STEWARDS,
} from '../../functions/api/atlas/_helpers';

const USER_ID = 'user_read_only';
const PIECE_ID = FULL_ARCHIVE[0].id;

function steward(overrides: Partial<StewardRecord> = {}): StewardRecord {
  return {
    pieceId: PIECE_ID,
    clerkUserId: USER_ID,
    email: 'keeper@example.com',
    issuedAt: '2020-01-01T00:00:00.000Z',
    outreachStatus: 'claimed',
    ...overrides,
  };
}

function readonlyBucket(seed: Record<string, unknown>) {
  const put = vi.fn(async () => {
    throw new Error('GET attempted an R2 write');
  });
  const get = vi.fn(async (key: string) => {
    if (!(key in seed)) return null;
    return {
      etag: `etag-${key}`,
      text: async () => JSON.stringify(seed[key]),
    };
  });
  return { get, put };
}

function readOnlyDb() {
  const writes: string[] = [];
  return {
    writes,
    prepare(sql: string) {
      const isWrite = /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(sql);
      if (isWrite) writes.push(sql);
      return {
        bind() {
          return this;
        },
        async all() {
          return { results: [] };
        },
        async first() {
          return null;
        },
        async run() {
          throw new Error(`GET attempted a D1 write: ${sql}`);
        },
      };
    },
  };
}

function transferredLedger(): LedgerEvent[] {
  return [
    {
      id: 'created',
      pieceId: PIECE_ID,
      type: 'created',
      date: '2020-01-01T00:00:00.000Z',
      actor: 'admin',
      prevHash: null,
      hash: 'created-hash',
    },
    {
      id: 'claimed',
      pieceId: PIECE_ID,
      type: 'claimed',
      date: '2020-01-02T00:00:00.000Z',
      actor: 'steward',
      prevHash: 'created-hash',
      hash: 'claimed-hash',
    },
    {
      id: 'transferred',
      pieceId: PIECE_ID,
      type: 'transferred',
      date: '2020-01-03T00:00:00.000Z',
      actor: 'admin',
      prevHash: 'claimed-hash',
      hash: 'transferred-hash',
    },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('surviving Atlas GET routes are side-effect-free', () => {
  it.each(['holder-chart.ts', 'piece-content.ts'])(
    '%s does not mutate D1 through rate-limit bookkeeping',
    (filename) => {
      const source = readFileSync(
        resolve(process.cwd(), 'functions/api/atlas', filename),
        'utf8',
      );

      expect(source).not.toContain('checkRateLimit');
    },
  );

  it('renders a card from canonical public state without touching historical R2', async () => {
    const canonical: PublicAtlasState = {
      generatedAt: '2026-08-09T00:00:00.000Z',
      schemaVersion: 2,
      pieces: [],
      cities: [],
    };
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === 'https://adrianrasmussen.com/api/atlas') {
        return Response.json({ ok: true, state: canonical });
      }
      return new Response(new Uint8Array([1]), { status: 200 });
    });
    vi.stubGlobal('fetch', fetch);
    const bucket = readonlyBucket({});

    const response = await getCard({
      request: new Request(`https://mandalacodes.com/api/atlas/card/${PIECE_ID}`),
      params: { path: [PIECE_ID] },
      env: {
        ATLAS_BUCKET: bucket,
        ASSETS: { fetch: vi.fn(async () => new Response(new Uint8Array([1]))) },
      },
    } as never);

    expect(response.status).toBe(200);
    expect(bucket.get).not.toHaveBeenCalled();
    expect(bucket.put).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://adrianrasmussen.com/api/atlas',
        method: 'GET',
      }),
    );
  });

  it('reads stored inscriptions without converting a pending first inscription', async () => {
    const bucket = readonlyBucket({
      [KEY_STEWARDS]: [
        steward({
          pendingFirstInscription: {
            text: 'A pending dream must not convert on GET.',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        }),
      ],
      [KEY_LEDGER]: [],
      [KEY_SHARED_INTENTIONS]: [],
    });
    const db = readOnlyDb();

    const response = await getInscriptions({
      request: new Request(
        `https://mandalacodes.com/api/atlas/steward/inscriptions?pieceId=${PIECE_ID}`,
      ),
      env: { ATLAS_BUCKET: bucket, DB: db },
    } as never);

    expect(response.status).toBe(200);
    expect(db.writes).toEqual([]);
    expect(bucket.put).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ ok: true, inscriptions: [] });
  });

  it('returns stored letters without deriving, persisting, or emailing new ones', async () => {
    const bucket = readonlyBucket({
      [KEY_STEWARDS]: [steward()],
      [KEY_LEDGER]: transferredLedger(),
      [KEY_SHARED_INTENTIONS]: [],
      [KEY_LETTERS]: [],
    });

    const response = await getLetters({
      request: new Request(
        `https://mandalacodes.com/api/atlas/steward/letters?pieceId=${PIECE_ID}`,
      ),
      env: { ATLAS_BUCKET: bucket },
    } as never);

    expect(response.status).toBe(200);
    expect(bucket.put).not.toHaveBeenCalled();
    expect(sendLetterEmail).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      ok: true,
      letters: [],
      unread: 0,
    });
  });
});
