/**
 * Unit tests for utils/ledger.ts — the append-only hash chain.
 *
 * Covers the append → verify round-trip, tamper detection (payload edits
 * and link breaks), the backdated-event guard, and the hash-safety of
 * optional fields (canonicalize drops undefined, so additive schema
 * changes never invalidate stored hashes).
 */
import { describe, expect, it } from 'vitest';
import {
  appendEvent,
  BackdatedEventError,
  canonicalize,
  computeHash,
  groupChains,
  verifyChain,
} from '../../utils/ledger';
import type { LedgerEvent } from '../../types';

type Draft = Omit<LedgerEvent, 'hash' | 'prevHash'>;

function draft(overrides: Partial<Draft> = {}): Draft {
  return {
    id: `evt-${Math.random().toString(36).slice(2)}`,
    pieceId: 'UL-1',
    type: 'created',
    date: '2026-01-01T00:00:00.000Z',
    cityId: null,
    actor: 'admin',
    ...overrides,
  };
}

async function buildChain(drafts: Draft[]): Promise<LedgerEvent[]> {
  const chain: LedgerEvent[] = [];
  for (const d of drafts) {
    chain.push(await appendEvent(chain, d));
  }
  return chain;
}

describe('appendEvent / verifyChain round-trip', () => {
  it('verifies a freshly appended chain', async () => {
    const chain = await buildChain([
      draft({ type: 'created', date: '2026-01-01T00:00:00.000Z' }),
      draft({ type: 'placed', date: '2026-01-02T00:00:00.000Z', cityId: 'lisbon-pt' }),
      draft({ type: 'moved', date: '2026-01-03T00:00:00.000Z', cityId: 'denpasar-id' }),
    ]);
    expect(chain[0].prevHash).toBeNull();
    expect(chain[1].prevHash).toBe(chain[0].hash);
    expect(chain[2].prevHash).toBe(chain[1].hash);
    expect(await verifyChain(chain)).toEqual({ ok: true });
  });

  it('detects a tampered payload field', async () => {
    const chain = await buildChain([
      draft({ type: 'created', date: '2026-01-01T00:00:00.000Z' }),
      draft({ type: 'placed', date: '2026-01-02T00:00:00.000Z', cityId: 'lisbon-pt' }),
    ]);
    const tampered = chain.map((e, i) =>
      i === 1 ? { ...e, cityId: 'denpasar-id' } : e,
    );
    const result = await verifyChain(tampered);
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(1);
  });

  it('detects a rewritten historical event via the broken link', async () => {
    const chain = await buildChain([
      draft({ type: 'created', date: '2026-01-01T00:00:00.000Z' }),
      draft({ type: 'placed', date: '2026-01-02T00:00:00.000Z', cityId: 'lisbon-pt' }),
      draft({ type: 'withdrawn', date: '2026-01-03T00:00:00.000Z' }),
    ]);
    // Rewrite event 1 AND recompute its hash — the next event's prevHash
    // no longer matches, so the forgery is still caught downstream.
    const forged = { ...chain[1], cityId: 'denpasar-id' };
    const { hash: _drop, ...payload } = forged;
    forged.hash = await computeHash(payload);
    const result = await verifyChain([chain[0], forged, chain[2]]);
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(2);
  });

  it('rejects a genesis event with a non-null prevHash', async () => {
    const chain = await buildChain([draft()]);
    const broken = [{ ...chain[0], prevHash: 'deadbeef' }];
    const result = await verifyChain(broken);
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(0);
  });
});

describe('backdated-event rejection', () => {
  it('throws BackdatedEventError when the new event predates the tip', async () => {
    const chain = await buildChain([
      draft({ type: 'created', date: '2026-01-02T00:00:00.000Z' }),
    ]);
    await expect(
      appendEvent(chain, draft({ type: 'placed', date: '2026-01-01T00:00:00.000Z' })),
    ).rejects.toBeInstanceOf(BackdatedEventError);
  });

  it('allows an event dated exactly at the tip', async () => {
    const date = '2026-01-02T00:00:00.000Z';
    const chain = await buildChain([draft({ type: 'created', date })]);
    const next = await appendEvent(chain, draft({ type: 'placed', date }));
    expect(await verifyChain([...chain, next])).toEqual({ ok: true });
  });
});

describe('hash-safety of additive optional fields', () => {
  it('canonicalize drops undefined, so old events keep their hashes', async () => {
    const bare = draft();
    const withUndefined = { ...bare, actorRef: undefined };
    expect(canonicalize(withUndefined)).toBe(canonicalize(bare));
    expect(await computeHash({ ...withUndefined, prevHash: null })).toBe(
      await computeHash({ ...bare, prevHash: null }),
    );
  });

  it('a present actorRef changes the hash (it is part of the payload)', async () => {
    const bare = draft();
    const attributed = { ...bare, actorRef: 'user_123' };
    expect(await computeHash({ ...attributed, prevHash: null })).not.toBe(
      await computeHash({ ...bare, prevHash: null }),
    );
  });
});

describe('groupChains', () => {
  it('keys chains by pieceId:editionNumber with 0 for missing editions', async () => {
    const a = await buildChain([draft({ pieceId: 'UL-1' })]);
    const b = await buildChain([draft({ pieceId: 'UL-2', editionNumber: 2 })]);
    const groups = groupChains([...a, ...b]);
    expect(Array.from(groups.keys()).sort()).toEqual(['UL-1:0', 'UL-2:2']);
  });
});
