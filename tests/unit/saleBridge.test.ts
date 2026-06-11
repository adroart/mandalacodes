/**
 * Unit suite for utils/saleBridge.ts + the /api/atlas/sale webhook handler
 * (M4 sale → ledger bridge).
 *
 * Pins:
 *   - the HMAC recipe (including the worked example published in
 *     todo/handoff/adrian-website/sale-webhook-spec.md — if this vector
 *     breaks, the Adrian-Website implementation breaks with it),
 *   - replay-window + tamper + wrong-secret rejection, constant-time compare,
 *   - strict payload validation,
 *   - webhook idempotency on saleId (duplicate → no second row),
 *   - the privacy invariant: nothing buyer- or price-shaped can ride in the
 *     chain event drafts the confirm path builds.
 */
import { describe, expect, it } from 'vitest';
import {
  SALE_TIMESTAMP_WINDOW_MS,
  buildSaleGenesisDraft,
  buildTransferredDraft,
  computeSaleSignature,
  isTimestampFresh,
  parseSalePayload,
  pendingTransferRef,
  timingSafeEqualHex,
  toSaleQueueItem,
  verifySaleWebhook,
} from '../../utils/saleBridge';
import type { SaleEventRow } from '../../utils/saleBridge';
import { onRequestPost as saleWebhook } from '../../functions/api/atlas/sale';
import type { AtlasEnv, PagesContext } from '../../functions/api/atlas/_helpers';

const SECRET = 'b1946ac92492d2347c6235b4d2611184e0f6a3bea7a1c0f5d9a8f3e2c4b5d6a7';
const TS = '1765432100';
const NOW_MS = Number(TS) * 1000; // exactly at the timestamp
const BODY = JSON.stringify({
  saleId: 'cs_test_a1B2c3',
  sku: 'UL-7',
  buyerEmail: 'collector@example.com',
  saleDate: '2026-06-10T14:02:11Z',
  priceCents: 120000,
  currency: 'EUR',
});
/** Published in sale-webhook-spec.md — the cross-repo contract vector. */
const SPEC_SIGNATURE =
  '7193320cead80526823cdb8804da33fcecb02c708ee98671d5e112bee4d396d3';

// ---------- HMAC verification ----------

describe('computeSaleSignature', () => {
  it('reproduces the worked example from the handoff spec', async () => {
    expect(await computeSaleSignature(SECRET, TS, BODY)).toBe(SPEC_SIGNATURE);
  });
});

describe('verifySaleWebhook', () => {
  it('accepts a valid signature inside the window', async () => {
    expect(await verifySaleWebhook(SECRET, TS, SPEC_SIGNATURE, BODY, NOW_MS)).toBe(true);
  });

  it('accepts an uppercase signature (hex is case-insensitive)', async () => {
    expect(
      await verifySaleWebhook(SECRET, TS, SPEC_SIGNATURE.toUpperCase(), BODY, NOW_MS),
    ).toBe(true);
  });

  it('rejects an expired timestamp (replay window)', async () => {
    const late = NOW_MS + SALE_TIMESTAMP_WINDOW_MS + 1000;
    expect(await verifySaleWebhook(SECRET, TS, SPEC_SIGNATURE, BODY, late)).toBe(false);
    const early = NOW_MS - SALE_TIMESTAMP_WINDOW_MS - 1000;
    expect(await verifySaleWebhook(SECRET, TS, SPEC_SIGNATURE, BODY, early)).toBe(false);
  });

  it('accepts at the edge of the window', async () => {
    const edge = NOW_MS + SALE_TIMESTAMP_WINDOW_MS;
    expect(await verifySaleWebhook(SECRET, TS, SPEC_SIGNATURE, BODY, edge)).toBe(true);
  });

  it('rejects a tampered body', async () => {
    const tampered = BODY.replace('120000', '1');
    expect(await verifySaleWebhook(SECRET, TS, SPEC_SIGNATURE, tampered, NOW_MS)).toBe(
      false,
    );
  });

  it('rejects a tampered timestamp (it is bound into the MAC)', async () => {
    const otherTs = String(Number(TS) + 60);
    expect(
      await verifySaleWebhook(SECRET, otherTs, SPEC_SIGNATURE, BODY, NOW_MS),
    ).toBe(false);
  });

  it('rejects a signature made with the wrong secret', async () => {
    const wrong = await computeSaleSignature('not-the-secret', TS, BODY);
    expect(await verifySaleWebhook(SECRET, TS, wrong, BODY, NOW_MS)).toBe(false);
  });

  it('rejects missing headers', async () => {
    expect(await verifySaleWebhook(SECRET, null, SPEC_SIGNATURE, BODY, NOW_MS)).toBe(false);
    expect(await verifySaleWebhook(SECRET, TS, null, BODY, NOW_MS)).toBe(false);
  });
});

describe('timingSafeEqualHex', () => {
  it('compares without early exit (XOR fold over every char)', () => {
    expect(timingSafeEqualHex('abcd', 'abcd')).toBe(true);
    expect(timingSafeEqualHex('abcd', 'abce')).toBe(false);
    expect(timingSafeEqualHex('abcd', 'xbcd')).toBe(false);
    expect(timingSafeEqualHex('abcd', 'abc')).toBe(false);
    expect(timingSafeEqualHex('', '')).toBe(true);
  });
});

describe('isTimestampFresh', () => {
  it('rejects malformed timestamps', () => {
    expect(isTimestampFresh('not-a-number', NOW_MS)).toBe(false);
    expect(isTimestampFresh('17654321.5', NOW_MS)).toBe(false);
    expect(isTimestampFresh('-1765432100', NOW_MS)).toBe(false);
    expect(isTimestampFresh('', NOW_MS)).toBe(false);
  });
});

// ---------- Payload validation ----------

describe('parseSalePayload', () => {
  const valid = {
    saleId: 'cs_123',
    buyerEmail: 'maya@example.com',
    saleDate: '2026-06-10',
  };

  it('accepts the minimal payload', () => {
    const r = parseSalePayload(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual(valid);
  });

  it('accepts the full payload and normalizes currency to uppercase', () => {
    const r = parseSalePayload({
      ...valid,
      sku: 'UL-7',
      pieceId: 'ul-7',
      editionNumber: 2,
      buyerName: 'Maya',
      priceCents: 120000,
      currency: 'eur',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.currency).toBe('EUR');
      expect(r.value.editionNumber).toBe(2);
    }
  });

  it('rejects unknown fields (whitelist discipline)', () => {
    expect(parseSalePayload({ ...valid, admin: true }).ok).toBe(false);
  });

  it('rejects missing/invalid required fields', () => {
    expect(parseSalePayload({}).ok).toBe(false);
    expect(parseSalePayload({ ...valid, saleId: '' }).ok).toBe(false);
    expect(parseSalePayload({ ...valid, buyerEmail: 'not-an-email' }).ok).toBe(false);
    expect(parseSalePayload({ ...valid, saleDate: 'last tuesday' }).ok).toBe(false);
    expect(parseSalePayload(null).ok).toBe(false);
    expect(parseSalePayload([valid]).ok).toBe(false);
  });

  it('rejects bad numeric fields', () => {
    expect(parseSalePayload({ ...valid, priceCents: -1 }).ok).toBe(false);
    expect(parseSalePayload({ ...valid, priceCents: 12.5 }).ok).toBe(false);
    expect(parseSalePayload({ ...valid, priceCents: '12000' }).ok).toBe(false);
    expect(parseSalePayload({ ...valid, editionNumber: -2 }).ok).toBe(false);
    expect(parseSalePayload({ ...valid, editionNumber: 1.5 }).ok).toBe(false);
  });

  it('rejects bad currency codes', () => {
    expect(parseSalePayload({ ...valid, currency: 'EURO' }).ok).toBe(false);
    expect(parseSalePayload({ ...valid, currency: '€' }).ok).toBe(false);
  });
});

// ---------- Chain event drafts (privacy invariant) ----------

describe('chain event drafts', () => {
  it('transferred draft carries exactly the documented opaque field set', () => {
    const draft = buildTransferredDraft({
      pieceId: 'UL-7',
      editionNumber: 2,
      actor: 'admin',
      actorRef: 'user_admin',
      fromRef: 'user_old_holder',
      toRef: pendingTransferRef('cs_123'),
      transferKind: 'sale',
      now: '2026-06-10T00:00:00.000Z',
      eventId: 'evt-1',
    });
    expect(Object.keys(draft).sort()).toEqual([
      'actor', 'actorRef', 'date', 'editionNumber', 'fromRef',
      'id', 'pieceId', 'toRef', 'transferKind', 'type',
    ]);
    expect(draft.toRef).toBe('sale:cs_123');
  });

  it('genesis draft carries exactly the documented field set', () => {
    const draft = buildSaleGenesisDraft({
      pieceId: 'UL-7',
      actorRef: 'user_admin',
      pieceType: 'mandala',
      now: '2026-06-10T00:00:00.000Z',
      eventId: 'evt-2',
    });
    expect(Object.keys(draft).sort()).toEqual([
      'actor', 'actorRef', 'date', 'id', 'pieceId', 'pieceType', 'type',
    ]);
  });

  it('never lets buyer identity or price into a serialized draft', () => {
    // Even if a confused caller had buyer data in scope, the builders take
    // a fixed option set — assert the OUTPUT shape carries nothing
    // email/price-shaped (chain content invariant).
    const drafts = [
      buildTransferredDraft({
        pieceId: 'UL-7',
        actor: 'steward',
        actorRef: 'user_holder',
        fromRef: 'user_holder',
        toRef: 'user_requester',
        transferKind: 'gift',
        now: '2026-06-10T00:00:00.000Z',
      }),
      buildSaleGenesisDraft({
        pieceId: 'UL-7',
        actorRef: 'user_admin',
        now: '2026-06-10T00:00:00.000Z',
      }),
    ];
    for (const d of drafts) {
      const serialized = JSON.stringify(d);
      for (const forbidden of ['email', 'Email', 'buyer', 'price', 'cents', 'name', '@']) {
        expect(serialized).not.toContain(forbidden);
      }
    }
  });
});

// ---------- Queue item mapping ----------

describe('toSaleQueueItem', () => {
  it('maps a full row and withholds raw_json', () => {
    const row: SaleEventRow = {
      sale_id: 'cs_123',
      sku: 'UL-7',
      piece_id: 'ul-7',
      edition_number: 2,
      buyer_email: 'maya@example.com',
      buyer_name: 'Maya',
      sale_date: '2026-06-10',
      price_cents: 120000,
      currency: 'EUR',
      status: 'pending',
      received_at: 1765432100,
      confirmed_at: null,
      dismissed_reason: null,
      raw_json: '{"secret":"evidence"}',
    };
    const item = toSaleQueueItem(row);
    expect(item.saleId).toBe('cs_123');
    expect(item.priceCents).toBe(120000);
    expect(JSON.stringify(item)).not.toContain('evidence');
    expect('confirmedAt' in item).toBe(false);
  });
});

// ---------- Webhook handler (mock D1) ----------

interface MockRow {
  sale_id: string;
  raw_json: string;
  status: string;
}

/** Minimal D1 mock: just enough for sale.ts's INSERT OR IGNORE. */
function mockDb(rows: Map<string, MockRow>, opts: { missingTable?: boolean } = {}) {
  return {
    prepare(query: string) {
      let bound: unknown[] = [];
      const stmt = {
        bind(...values: unknown[]) {
          bound = values;
          return stmt;
        },
        async first() {
          return null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          if (opts.missingTable) {
            throw new Error('no such table: atlas_sale_events');
          }
          if (!/INSERT OR IGNORE/i.test(query)) {
            throw new Error(`unexpected query: ${query}`);
          }
          const saleId = bound[0] as string;
          if (rows.has(saleId)) return { success: true, meta: { changes: 0 } };
          rows.set(saleId, {
            sale_id: saleId,
            raw_json: bound[9] as string,
            status: 'pending',
          });
          return { success: true, meta: { changes: 1 } };
        },
      };
      return stmt;
    },
  };
}

async function postSale(
  env: Partial<AtlasEnv>,
  rawBody: string,
  headers: Record<string, string>,
): Promise<Response> {
  const request = new Request('https://mandalacodes.com/api/atlas/sale', {
    method: 'POST',
    headers,
    body: rawBody,
  });
  return saleWebhook({ request, env: env as AtlasEnv } as PagesContext);
}

async function signedHeaders(rawBody: string): Promise<Record<string, string>> {
  const ts = String(Math.floor(Date.now() / 1000));
  return {
    'X-Sale-Timestamp': ts,
    'X-Sale-Signature': await computeSaleSignature(SECRET, ts, rawBody),
  };
}

describe('POST /api/atlas/sale', () => {
  const goodBody = JSON.stringify({
    saleId: 'cs_live_777',
    buyerEmail: 'maya@example.com',
    saleDate: '2026-06-10',
    priceCents: 90000,
    currency: 'EUR',
  });

  it('503s when SALE_WEBHOOK_SECRET is missing', async () => {
    const res = await postSale({ DB: mockDb(new Map()) }, goodBody, {});
    expect(res.status).toBe(503);
  });

  it('503s when the D1 binding is missing', async () => {
    const res = await postSale(
      { SALE_WEBHOOK_SECRET: SECRET },
      goodBody,
      await signedHeaders(goodBody),
    );
    expect(res.status).toBe(503);
  });

  it('503s when the migration is not applied (missing table)', async () => {
    const res = await postSale(
      { SALE_WEBHOOK_SECRET: SECRET, DB: mockDb(new Map(), { missingTable: true }) },
      goodBody,
      await signedHeaders(goodBody),
    );
    expect(res.status).toBe(503);
  });

  it('401s with no detail on bad signature', async () => {
    const headers = await signedHeaders(goodBody);
    headers['X-Sale-Signature'] = 'f'.repeat(64);
    const res = await postSale(
      { SALE_WEBHOOK_SECRET: SECRET, DB: mockDb(new Map()) },
      goodBody,
      headers,
    );
    expect(res.status).toBe(401);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe('unauthorized'); // no oracle
  });

  it('401s on a stale timestamp even with a matching signature', async () => {
    const staleTs = String(Math.floor(Date.now() / 1000) - 3600);
    const res = await postSale(
      { SALE_WEBHOOK_SECRET: SECRET, DB: mockDb(new Map()) },
      goodBody,
      {
        'X-Sale-Timestamp': staleTs,
        'X-Sale-Signature': await computeSaleSignature(SECRET, staleTs, goodBody),
      },
    );
    expect(res.status).toBe(401);
  });

  it('400s on a correctly signed but invalid payload', async () => {
    const bad = JSON.stringify({ saleId: 'x', buyerEmail: 'maya@example.com' });
    const res = await postSale(
      { SALE_WEBHOOK_SECRET: SECRET, DB: mockDb(new Map()) },
      bad,
      await signedHeaders(bad),
    );
    expect(res.status).toBe(400);
  });

  it('queues a valid sale and reports duplicates idempotently', async () => {
    const rows = new Map<string, MockRow>();
    const env = { SALE_WEBHOOK_SECRET: SECRET, DB: mockDb(rows) };

    const first = await postSale(env, goodBody, await signedHeaders(goodBody));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, status: 'queued' });
    expect(rows.size).toBe(1);
    expect(rows.get('cs_live_777')?.status).toBe('pending');
    // raw_json stores the verified payload for dispute evidence.
    expect(rows.get('cs_live_777')?.raw_json).toBe(goodBody);

    const second = await postSale(env, goodBody, await signedHeaders(goodBody));
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true, status: 'duplicate' });
    expect(rows.size).toBe(1); // no second row — INSERT OR IGNORE on saleId
  });
});
