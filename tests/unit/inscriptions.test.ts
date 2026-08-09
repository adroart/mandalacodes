/**
 * Ring 1 legacy inscriptions + heirs (M3).
 *
 * Pins the pure logic in utils/inscriptions.ts plus the event whitelist in
 * functions/api/atlas/event.ts:
 *   - salted commitment round-trip and erasure UNLINKABILITY (delete salt
 *     + body → the chain commitment matches nothing recomputable),
 *   - `inscribed` / `transferred` event payload shapes (whitelist
 *     discipline — the body and emails can never be smuggled into a hash),
 *   - sealed-entry visibility (time capsules: date seals, seal-until-
 *     transfer, author-always-reads),
 *   - role + generation attribution ("first steward", never a name),
 *   - heir registration validation (hints only, mutable storage only),
 *   - pendingFirstInscription conversion planning idempotency,
 *   - privacy: inscription bodies and heir emails never reach public state
 *     or any hashed payload.
 *
 * D1 note: the handlers' D1 interactions (inscribe/inscriptions/erase/
 * export) are thin compositions over this pure layer + the mutators tested
 * elsewhere; we test the pure layer here rather than mocking the binding.
 */
import { describe, expect, it } from 'vitest';
import type { LedgerEvent, StewardRecord } from '../../types';
import {
  addHeir,
  attributionFor,
  buildInscribedDraft,
  computeContentHash,
  deriveStewardGenerations,
  generateSaltHex,
  isSealClosed,
  parseHeirInput,
  parseInscriptionInput,
  pendingInscriptionId,
  planPendingConversion,
  projectInscription,
  revokeHeir,
  sealLabel,
  stewardOrdinalLabel,
  INSCRIPTION_MAX_LENGTH,
  SEAL_UNTIL_TRANSFER,
} from '../../utils/inscriptions';
import type { InscriptionRow } from '../../utils/inscriptions';
import { appendEvent, canonicalize, verifyChain } from '../../utils/ledger';
import { projectAll, toPublicState } from '../../utils/ledgerProjection';
import { cleanEventInput } from '../../functions/api/atlas/event';

const NOW = '2026-06-10T12:00:00.000Z';
const STEWARD_A = 'user_first_steward';
const STEWARD_B = 'user_second_steward';

let counter = 0;
async function buildChain(
  specs: Array<Partial<LedgerEvent> & { type: LedgerEvent['type'] }>,
): Promise<LedgerEvent[]> {
  let chain: LedgerEvent[] = [];
  for (const spec of specs) {
    counter += 1;
    const { type, date, ...rest } = spec;
    const full = await appendEvent(chain, {
      id: `evt-${counter}`,
      pieceId: 'UL-1',
      type,
      date: date ?? `2026-01-${String(counter).padStart(2, '0')}T00:00:00.000Z`,
      actor: 'admin',
      ...rest,
    } as Omit<LedgerEvent, 'hash' | 'prevHash'>);
    chain = [...chain, full];
  }
  return chain;
}

function row(overrides: Partial<InscriptionRow> = {}): InscriptionRow {
  return {
    id: 'ins-1',
    piece_id: 'UL-1',
    edition_number: 0,
    author_user_id: STEWARD_A,
    kind: 'intention',
    body: 'May this piece hold our family together.',
    body_hash: 'a'.repeat(64),
    content_salt: 'b'.repeat(32),
    sealed_until: null,
    created_at: '2026-02-01T00:00:00.000Z',
    erased_at: null,
    ...overrides,
  };
}

// ---------- salted commitment ----------

describe('salted content commitment', () => {
  it('round-trips: same salt + body always recomputes the same hash', async () => {
    const salt = generateSaltHex();
    const body = 'For my daughter, when she is grown.';
    const h1 = await computeContentHash(salt, body);
    const h2 = await computeContentHash(salt, body);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('lands on the chain and the chain verifies', async () => {
    const salt = generateSaltHex();
    const body = 'A story about where this piece has hung.';
    const contentHash = await computeContentHash(salt, body);
    const chain = await buildChain([{ type: 'created' }]);
    const draft = buildInscribedDraft({
      pieceId: 'UL-1',
      actorRef: STEWARD_A,
      now: NOW,
      inscriptionId: 'ins-xyz',
      contentHash,
      inscriptionKind: 'story',
    });
    const full = await appendEvent(chain, draft);
    const verified = await verifyChain([...chain, full]);
    expect(verified.ok).toBe(true);
    expect(full.contentHash).toBe(contentHash);
  });

  it('erasure makes the commitment unlinkable: without the salt, no body recomputes it', async () => {
    const salt = generateSaltHex();
    const body = 'Sensitive personal text subject to a legal erasure demand.';
    const commitment = await computeContentHash(salt, body);

    // Erasure deletes body AND salt together. An adversary holding the
    // commitment plus a guess of the original text cannot confirm it:
    expect(await computeContentHash('', body)).not.toBe(commitment);
    // ...nor with any other salt:
    expect(await computeContentHash(generateSaltHex(), body)).not.toBe(commitment);
    // ...nor does the bare-body hash (no salt at all) match:
    const bare = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(body),
    );
    const bareHex = Array.from(new Uint8Array(bare))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(bareHex).not.toBe(commitment);
  });
});

// ---------- input validation ----------

describe('parseInscriptionInput', () => {
  it('accepts the documented shape and trims the body', () => {
    const r = parseInscriptionInput({ kind: 'dedication', body: '  to mum  ' });
    expect(r).toEqual({ ok: true, value: { kind: 'dedication', body: 'to mum' } });
  });

  it('rejects unknown fields (whitelist discipline)', () => {
    expect(parseInscriptionInput({ kind: 'story', body: 'x', email: 'a@b.c' }).ok).toBe(false);
    expect(parseInscriptionInput({ kind: 'story', body: 'x', actorRef: 'u' }).ok).toBe(false);
  });

  it('rejects bad kinds, empty and oversized bodies', () => {
    expect(parseInscriptionInput({ kind: 'memo', body: 'x' }).ok).toBe(false);
    expect(parseInscriptionInput({ kind: 'story', body: '   ' }).ok).toBe(false);
    expect(
      parseInscriptionInput({ kind: 'story', body: 'y'.repeat(INSCRIPTION_MAX_LENGTH + 1) }).ok,
    ).toBe(false);
  });

  it('handles seals: ISO date, transfer flag, never both', () => {
    const dated = parseInscriptionInput({
      kind: 'intention', body: 'x', sealedUntil: '2030-01-01',
    });
    expect(dated.ok && dated.value.sealedUntil).toBe('2030-01-01');

    const transfer = parseInscriptionInput({
      kind: 'intention', body: 'x', sealUntilTransfer: true,
    });
    expect(transfer.ok && transfer.value.sealedUntil).toBe(SEAL_UNTIL_TRANSFER);

    expect(
      parseInscriptionInput({
        kind: 'intention', body: 'x', sealedUntil: '2030-01-01', sealUntilTransfer: true,
      }).ok,
    ).toBe(false);
    expect(
      parseInscriptionInput({ kind: 'intention', body: 'x', sealedUntil: 'someday' }).ok,
    ).toBe(false);
  });
});

// ---------- event whitelist (chain content invariant) ----------

describe('inscribed/transferred event whitelists', () => {
  it('inscribed draft carries EXACTLY the documented field set — no body', () => {
    const draft = buildInscribedDraft({
      pieceId: 'UL-1',
      editionNumber: 2,
      actorRef: STEWARD_A,
      now: NOW,
      inscriptionId: 'ins-1',
      contentHash: 'c'.repeat(64),
      inscriptionKind: 'intention',
      eventId: 'evt-fixed',
    });
    expect(Object.keys(draft).sort()).toEqual([
      'actor', 'actorRef', 'contentHash', 'date', 'editionNumber',
      'id', 'inscriptionId', 'inscriptionKind', 'pieceId', 'type',
    ]);
    expect(canonicalize(draft)).not.toContain('body');
  });

  it('cleanEventInput accepts a valid transferred event with exact keys', () => {
    const clean = cleanEventInput({
      id: 'evt-1', pieceId: 'UL-1', type: 'transferred', date: NOW,
      actor: 'admin', fromRef: STEWARD_A, toRef: STEWARD_B, transferKind: 'inheritance',
      // smuggling attempts — must be dropped:
      email: 'heir@example.com', body: 'secret', buyerName: 'Jane',
    });
    expect(clean).not.toBeNull();
    expect(Object.keys(clean!).sort()).toEqual([
      'actor', 'date', 'fromRef', 'id', 'pieceId', 'toRef', 'transferKind', 'type',
    ]);
  });

  it('cleanEventInput rejects transferred events missing refs or with bad kinds', () => {
    const base = { id: 'e', pieceId: 'p', type: 'transferred', date: NOW, actor: 'admin' };
    expect(cleanEventInput({ ...base, toRef: 'b', transferKind: 'sale' })).toBeNull();
    expect(cleanEventInput({ ...base, fromRef: 'a', transferKind: 'sale' })).toBeNull();
    expect(cleanEventInput({ ...base, fromRef: 'a', toRef: 'b', transferKind: 'theft' })).toBeNull();
  });

  it('cleanEventInput validates inscribed events (pointer + 64-hex commitment + kind)', () => {
    const base = { id: 'e', pieceId: 'p', type: 'inscribed', date: NOW, actor: 'steward' };
    const ok = cleanEventInput({
      ...base, inscriptionId: 'ins-1', contentHash: 'd'.repeat(64), inscriptionKind: 'story',
    });
    expect(ok).not.toBeNull();
    expect(Object.keys(ok!).sort()).toEqual([
      'actor', 'contentHash', 'date', 'id', 'inscriptionId', 'inscriptionKind', 'pieceId', 'type',
    ]);
    expect(cleanEventInput({ ...base, inscriptionId: 'ins-1', contentHash: 'short', inscriptionKind: 'story' })).toBeNull();
    expect(cleanEventInput({ ...base, inscriptionId: 'ins-1', contentHash: 'd'.repeat(64), inscriptionKind: 'memo' })).toBeNull();
    expect(cleanEventInput({ ...base, contentHash: 'd'.repeat(64), inscriptionKind: 'story' })).toBeNull();
  });

  it('does not copy transfer/inscription fields onto other event types', () => {
    const clean = cleanEventInput({
      id: 'e', pieceId: 'p', type: 'placed', date: NOW, actor: 'admin',
      cityId: 'lisbon-pt', fromRef: 'a', toRef: 'b', transferKind: 'sale',
      inscriptionId: 'ins-1', contentHash: 'd'.repeat(64), inscriptionKind: 'story',
    });
    expect(clean).not.toBeNull();
    expect(clean!.fromRef).toBeUndefined();
    expect(clean!.inscriptionId).toBeUndefined();
  });

  it('accepts the heir actor', () => {
    const clean = cleanEventInput({
      id: 'e', pieceId: 'p', type: 'placed', date: NOW, actor: 'heir', cityId: 'lisbon-pt',
    });
    expect(clean?.actor).toBe('heir');
  });
});

// ---------- sealed-entry visibility ----------

describe('sealed-entry visibility', () => {
  it('a date seal hides the body from non-authors until the date passes', async () => {
    const chain = await buildChain([{ type: 'created' }]);
    const sealed = row({ sealed_until: '2030-01-01' });

    const otherView = projectInscription(sealed, STEWARD_B, chain, NOW);
    expect(otherView.state).toBe('sealed');
    expect(otherView.body).toBeUndefined();
    expect(otherView.sealedLabel).toBe('sealed until 2030-01-01');

    const afterOpen = projectInscription(sealed, STEWARD_B, chain, '2030-01-02T00:00:00.000Z');
    expect(afterOpen.state).toBe('readable');
    expect(afterOpen.body).toBe(sealed.body);
  });

  it('the author always reads their own sealed letter', async () => {
    const chain = await buildChain([{ type: 'created' }]);
    const sealed = row({ sealed_until: '2030-01-01' });
    const view = projectInscription(sealed, STEWARD_A, chain, NOW);
    expect(view.state).toBe('sealed');
    expect(view.body).toBe(sealed.body);
  });

  it('seal-until-transfer opens only after a transferred event dated past the entry', async () => {
    const sealed = row({ sealed_until: SEAL_UNTIL_TRANSFER });
    const before = await buildChain([
      { type: 'created', date: '2026-01-01T00:00:00.000Z' },
    ]);
    expect(isSealClosed(sealed, before, NOW)).toBe(true);

    const after = await buildChain([
      { type: 'created', date: '2026-01-01T00:00:00.000Z' },
      {
        type: 'transferred', date: '2026-03-01T00:00:00.000Z',
        fromRef: STEWARD_A, toRef: STEWARD_B, transferKind: 'inheritance',
      },
    ]);
    expect(isSealClosed(sealed, after, NOW)).toBe(false);
    const heirView = projectInscription(sealed, STEWARD_B, after, NOW);
    expect(heirView.state).toBe('readable');
    expect(heirView.body).toBe(sealed.body);
    expect(sealLabel(SEAL_UNTIL_TRANSFER)).toBe('sealed until the piece is passed on');
  });

  it('erased entries are tombstones for everyone — no body, no audit reason', async () => {
    const chain = await buildChain([{ type: 'created' }]);
    const erased = row({
      body: null, content_salt: null,
      erased_at: '2026-05-01T00:00:00.000Z', erase_reason: 'GDPR Art.17 demand',
    });
    for (const viewer of [STEWARD_A, STEWARD_B]) {
      const view = projectInscription(erased, viewer, chain, NOW);
      expect(view.state).toBe('erased');
      expect(view.body).toBeUndefined();
      expect(JSON.stringify(view)).not.toContain('GDPR');
      // The commitment survives — the chain is untouched by erasure.
      expect(view.contentHash).toBe(erased.body_hash);
    }
  });
});

// ---------- shared flag (M6, Lens 2 — the map of dreams) ----------

describe('projectInscription — shared flag', () => {
  it('defaults to shared: false when no set is passed', async () => {
    const chain = await buildChain([{ type: 'created' }]);
    const view = projectInscription(row(), STEWARD_A, chain, NOW);
    expect(view.shared).toBe(false);
  });

  it('defaults to shared: false when the set is passed but empty', async () => {
    const chain = await buildChain([{ type: 'created' }]);
    const view = projectInscription(row(), STEWARD_A, chain, NOW, new Set());
    expect(view.shared).toBe(false);
  });

  it('is true when the inscription id is in the live-shared set', async () => {
    const chain = await buildChain([{ type: 'created' }]);
    const entry = row({ id: 'ins-shared' });
    const view = projectInscription(entry, STEWARD_A, chain, NOW, new Set(['ins-shared']));
    expect(view.shared).toBe(true);
  });

  it('is false for a different inscription id even when others are live-shared', async () => {
    const chain = await buildChain([{ type: 'created' }]);
    const entry = row({ id: 'ins-not-shared' });
    const view = projectInscription(entry, STEWARD_A, chain, NOW, new Set(['ins-other']));
    expect(view.shared).toBe(false);
  });

  it('reflects shared: true even on a tombstoned/erased row — the flag is independent of readability', async () => {
    const chain = await buildChain([{ type: 'created' }]);
    const erased = row({
      id: 'ins-erased-shared',
      body: null,
      content_salt: null,
      erased_at: '2026-05-01T00:00:00.000Z',
    });
    const view = projectInscription(erased, STEWARD_A, chain, NOW, new Set(['ins-erased-shared']));
    expect(view.state).toBe('erased');
    expect(view.shared).toBe(true);
  });
});

// ---------- attribution (role + generation, never names) ----------

describe('role + generation attribution', () => {
  it('derives generations from claimed + transferred refs', async () => {
    const chain = await buildChain([
      { type: 'created', date: '2026-01-01T00:00:00.000Z' },
      { type: 'claimed', date: '2026-01-02T00:00:00.000Z', actor: 'steward', actorRef: STEWARD_A },
      {
        type: 'transferred', date: '2026-02-01T00:00:00.000Z',
        fromRef: STEWARD_A, toRef: STEWARD_B, transferKind: 'sale',
      },
    ]);
    expect(deriveStewardGenerations(chain)).toEqual([STEWARD_A, STEWARD_B]);
    // The second steward reads the first's entry attributed by role only:
    expect(attributionFor(STEWARD_A, STEWARD_B, chain)).toBe('first steward');
    expect(attributionFor(STEWARD_B, STEWARD_B, chain)).toBe('you');
    expect(attributionFor('user_unknown', STEWARD_B, chain)).toBe('a previous steward');
    expect(attributionFor(null, STEWARD_B, chain)).toBe('a previous steward');
  });

  it('ordinal labels degrade gracefully past ten', () => {
    expect(stewardOrdinalLabel(1)).toBe('first steward');
    expect(stewardOrdinalLabel(2)).toBe('second steward');
    expect(stewardOrdinalLabel(10)).toBe('tenth steward');
    expect(stewardOrdinalLabel(11)).toBe('steward 11');
  });
});

// ---------- heirs ----------

describe('heir registrations', () => {
  const record: StewardRecord = {
    pieceId: 'UL-1',
    email: 'holder@example.com',
    clerkUserId: STEWARD_A,
    issuedAt: '2026-01-01T00:00:00.000Z',
    outreachStatus: 'claimed',
  };

  it('validates input with whitelist discipline', () => {
    expect(parseHeirInput({ email: 'kid@example.com', name: 'Kid' }).ok).toBe(true);
    expect(parseHeirInput({ email: 'not-an-email' }).ok).toBe(false);
    expect(parseHeirInput({ email: 'kid@example.com', status: 'active' }).ok).toBe(false);
    expect(parseHeirInput({ email: 'kid@example.com', name: 'x'.repeat(201) }).ok).toBe(false);
  });

  it('adds a pending hint, rejects duplicates, revokes by email', () => {
    const added = addHeir(record, { email: 'kid@example.com', name: 'Kid' }, STEWARD_A, NOW);
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(added.value.heirs).toEqual([
      {
        email: 'kid@example.com', name: 'Kid',
        registeredAt: NOW, registeredBy: STEWARD_A, status: 'pending',
      },
    ]);

    expect(addHeir(added.value, { email: 'KID@example.com' }, STEWARD_A, NOW).ok).toBe(false);

    const revoked = revokeHeir(added.value, 'kid@example.com');
    expect(revoked.ok && revoked.value.heirs?.[0].status).toBe('revoked');
    // Re-registering after revocation is allowed:
    if (revoked.ok) {
      expect(addHeir(revoked.value, { email: 'kid@example.com' }, STEWARD_A, NOW).ok).toBe(true);
    }
    expect(revokeHeir(record, 'nobody@example.com').ok).toBe(false);
  });
});

// ---------- pendingFirstInscription conversion ----------

describe('pendingFirstInscription conversion planning', () => {
  const base: Pick<
    StewardRecord,
    'pieceId' | 'editionNumber' | 'pendingFirstInscription' | 'clerkUserId'
  > = {
    pieceId: 'UL-1',
    editionNumber: undefined,
    clerkUserId: STEWARD_A,
    pendingFirstInscription: { text: 'hope', createdAt: '2026-02-01T00:00:00.000Z' },
  };

  it('is a no-op without a pending field or a bound user', async () => {
    const chain = await buildChain([{ type: 'created' }]);
    expect(planPendingConversion({ ...base, pendingFirstInscription: undefined }, false, chain)).toBeNull();
    expect(planPendingConversion({ ...base, clerkUserId: undefined }, false, chain)).toBeNull();
  });

  it('plans all three steps on first run, with a deterministic row id', async () => {
    const chain = await buildChain([{ type: 'created' }]);
    const plan = planPendingConversion(base, false, chain);
    expect(plan).toEqual({
      inscriptionId: pendingInscriptionId('UL-1', undefined, STEWARD_A),
      insertRow: true,
      appendEvent: true,
      clearField: true,
    });
    expect(pendingInscriptionId('UL-1', undefined, STEWARD_A)).toBe(
      pendingInscriptionId('UL-1', undefined, STEWARD_A),
    );
  });

  it('re-runs converge: existing row and existing event are not redone', async () => {
    const id = pendingInscriptionId('UL-1', undefined, STEWARD_A);
    const chain = await buildChain([
      { type: 'created', date: '2026-01-01T00:00:00.000Z' },
      {
        type: 'inscribed', date: '2026-03-01T00:00:00.000Z', actor: 'steward',
        actorRef: STEWARD_A, inscriptionId: id, contentHash: 'e'.repeat(64),
        inscriptionKind: 'intention',
      },
    ]);
    const plan = planPendingConversion(base, true, chain);
    expect(plan).toEqual({
      inscriptionId: id,
      insertRow: false,
      appendEvent: false,
      clearField: true,
    });
  });

  it('waits for a chain: never clears the field before the commitment can land', () => {
    const plan = planPendingConversion(base, false, []);
    expect(plan?.appendEvent).toBe(false);
    expect(plan?.clearField).toBe(false);
    expect(plan?.insertRow).toBe(true);
  });

  it("a second steward's ritual answer never collides with the first steward's converted entry", async () => {
    // The piece changed hands: the first steward's answer was converted
    // (row + event under THEIR deterministic id), then the new steward
    // claimed with their own firstInscription. The ids are author-scoped, so
    // the new steward's plan must insert a FRESH row and event — without the
    // author scope, rowExists/eventExists would match the first steward's
    // entry and the second answer would be cleared without ever landing.
    const firstId = pendingInscriptionId('UL-1', undefined, STEWARD_A);
    const secondId = pendingInscriptionId('UL-1', undefined, STEWARD_B);
    expect(secondId).not.toBe(firstId);

    const chain = await buildChain([
      { type: 'created', date: '2026-01-01T00:00:00.000Z' },
      { type: 'claimed', date: '2026-01-02T00:00:00.000Z', actor: 'steward', actorRef: STEWARD_A },
      {
        type: 'inscribed', date: '2026-01-03T00:00:00.000Z', actor: 'steward',
        actorRef: STEWARD_A, inscriptionId: firstId, contentHash: 'a'.repeat(64),
        inscriptionKind: 'intention',
      },
      {
        type: 'transferred', date: '2026-02-01T00:00:00.000Z',
        fromRef: STEWARD_A, toRef: STEWARD_B, transferKind: 'sale',
      },
    ]);

    // rowExists=false: the handler looks the row up by the SECOND steward's
    // id, which does not exist yet.
    const plan = planPendingConversion(
      {
        pieceId: 'UL-1',
        editionNumber: undefined,
        clerkUserId: STEWARD_B,
        pendingFirstInscription: { text: 'a new hope', createdAt: '2026-03-01T00:00:00.000Z' },
      },
      false,
      chain,
    );
    expect(plan).toEqual({
      inscriptionId: secondId,
      insertRow: true,
      appendEvent: true,
      clearField: true,
    });
  });
});

// ---------- privacy (the chain content invariant + public surface) ----------

describe('privacy: bodies and heir emails stay out of hashes and public state', () => {
  it('a full chain with inscriptions canonicalizes to no body text and no emails', async () => {
    const salt = generateSaltHex();
    const body = 'Very personal words for the family only.';
    const contentHash = await computeContentHash(salt, body);
    const chain = await buildChain([
      { type: 'created', date: '2026-01-01T00:00:00.000Z' },
      { type: 'claimed', date: '2026-01-02T00:00:00.000Z', actor: 'steward', actorRef: STEWARD_A },
      ...[],
    ]);
    const inscribed = await appendEvent(
      chain,
      buildInscribedDraft({
        pieceId: 'UL-1', actorRef: STEWARD_A, now: NOW,
        inscriptionId: 'ins-9', contentHash, inscriptionKind: 'dedication',
      }),
    );
    const full = [...chain, inscribed];
    const serialized = canonicalize(full);
    expect(serialized).not.toContain('personal words');
    expect(serialized).not.toContain('@');
    expect((await verifyChain(full)).ok).toBe(true);
  });

  it('public state ignores inscribed/transferred events and never carries heirs', async () => {
    const chain = await buildChain([
      { type: 'created', date: '2026-01-01T00:00:00.000Z' },
      { type: 'placed', date: '2026-01-02T00:00:00.000Z', cityId: 'lisbon-pt' },
      { type: 'claimed', date: '2026-01-03T00:00:00.000Z', actor: 'steward', actorRef: STEWARD_A },
      {
        type: 'inscribed', date: '2026-01-04T00:00:00.000Z', actor: 'steward',
        actorRef: STEWARD_A, inscriptionId: 'ins-2', contentHash: 'f'.repeat(64),
        inscriptionKind: 'story',
      },
      {
        type: 'transferred', date: '2026-01-05T00:00:00.000Z',
        fromRef: STEWARD_A, toRef: STEWARD_B, transferKind: 'gift',
      },
    ]);
    const state = toPublicState(
      projectAll(chain),
      new Map([['UL-1', { series: 'Universal Language', category: 'Art' }]]),
      [{
        id: 'lisbon-pt', city: 'Lisbon', country: 'Portugal',
        countryCode: 'PT', lat: 38.7, lng: -9.1,
      }],
    );
    const serialized = JSON.stringify(state);
    expect(serialized).not.toContain('heir');
    expect(serialized).not.toContain('@');
    expect(serialized).not.toContain('inscription');
    expect(serialized).not.toContain(STEWARD_A);
    expect(serialized).not.toContain(STEWARD_B);
    // The piece itself still projects normally (transfer/inscribe are
    // invisible to the public surface — additive event types).
    expect(state.pieces).toHaveLength(1);
    expect(state.pieces[0].status).toBe('placed');
  });
});
