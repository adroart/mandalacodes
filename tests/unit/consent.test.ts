/**
 * Consent capture + two-phase claim (M2).
 *
 * Pins the pure logic in utils/consent.ts that the steward claim/update
 * Functions compose inside the concurrency-safe mutators:
 *   - consent input validation (whitelist discipline — unknown fields out),
 *   - server-side stamping (version/capturedAt/capturedBy, Rings 3–4
 *     deferred),
 *   - the Phase A / Phase B outreachStatus state machine ('claimed' gates
 *     on consent, never on the bind),
 *   - first-claim-only `claimed` chain events with a fixed, PII-free
 *     payload,
 *   - Ring 2 mapping onto withdrawn/revealed semantics,
 *   - privacy: consent and pendingFirstInscription never reach public
 *     state, other stewards, or the admin roster view.
 */
import { describe, expect, it } from 'vitest';
import { CONSENT_VERSION } from '../../types';
import type {
  CityCentroid,
  ConsentState,
  LedgerEvent,
  StewardRecord,
} from '../../types';
import {
  applyConsentToSteward,
  bindStewardOnClaim,
  isSameConsentIgnoringCapturedAt,
  nextConsentState,
  nextRing3ConsentState,
  parseConsentInput,
  parseFirstInscription,
  planClaimChainEvents,
} from '../../utils/consent';
import { appendEvent, verifyChain } from '../../utils/ledger';
import { projectAll, toPublicState } from '../../utils/ledgerProjection';
import { toStewardView } from '../../functions/api/atlas/_helpers';

const NOW = '2026-06-10T12:00:00.000Z';
const USER = 'user_steward_abc';

// ---------- helpers ----------

let counter = 0;
async function buildChain(
  specs: Array<Partial<LedgerEvent> & { type: LedgerEvent['type'] }>,
): Promise<LedgerEvent[]> {
  let chain: LedgerEvent[] = [];
  for (const spec of specs) {
    counter += 1;
    const full = await appendEvent(chain, {
      id: `evt-${counter}`,
      pieceId: 'UL-1',
      type: spec.type,
      date: spec.date ?? `2026-01-${String(counter).padStart(2, '0')}T00:00:00.000Z`,
      cityId: spec.cityId ?? null,
      actor: spec.actor ?? 'admin',
      ...(spec.actorRef ? { actorRef: spec.actorRef } : {}),
    });
    chain = [...chain, full];
  }
  return chain;
}

function steward(overrides: Partial<StewardRecord> = {}): StewardRecord {
  return {
    pieceId: 'UL-1',
    email: 'collector@example.com',
    issuedAt: '2026-01-01T00:00:00.000Z',
    outreachStatus: 'invited',
    ...overrides,
  };
}

function consentState(overrides: Partial<ConsentState> = {}): ConsentState {
  return {
    version: CONSENT_VERSION,
    capturedAt: NOW,
    capturedBy: USER,
    ring2MapPresence: true,
    ring3ChartPresence: 'deferred',
    ring4: 'deferred',
    ...overrides,
  };
}

// ---------- consent shape validation ----------

describe('parseConsentInput', () => {
  it('accepts exactly { ring2MapPresence: boolean }', () => {
    for (const v of [true, false]) {
      const res = parseConsentInput({ ring2MapPresence: v });
      expect(res).toEqual({ ok: true, value: { ring2MapPresence: v } });
    }
  });

  it('rejects non-objects', () => {
    for (const bad of [null, undefined, 'yes', 42, true, ['ring2MapPresence']]) {
      expect(parseConsentInput(bad).ok).toBe(false);
    }
  });

  it('rejects a missing or non-boolean ring2MapPresence', () => {
    expect(parseConsentInput({}).ok).toBe(false);
    expect(parseConsentInput({ ring2MapPresence: 'true' }).ok).toBe(false);
    expect(parseConsentInput({ ring2MapPresence: 1 }).ok).toBe(false);
  });

  it('rejects unknown fields — including attempts to set server-stamped ones', () => {
    const smuggled = [
      { ring2MapPresence: true, version: 99 },
      { ring2MapPresence: true, capturedAt: '1999-01-01T00:00:00.000Z' },
      { ring2MapPresence: true, capturedBy: 'user_attacker' },
      { ring2MapPresence: true, ring3ChartPresence: true },
      { ring2MapPresence: true, ring4: { face: true } },
      { ring2MapPresence: true, anything: 'else' },
    ];
    for (const bad of smuggled) {
      expect(parseConsentInput(bad).ok).toBe(false);
    }
  });
});

describe('parseFirstInscription', () => {
  it('treats absent / blank input as "no inscription"', () => {
    expect(parseFirstInscription(undefined)).toEqual({ ok: true, value: undefined });
    expect(parseFirstInscription(null)).toEqual({ ok: true, value: undefined });
    expect(parseFirstInscription('   ')).toEqual({ ok: true, value: undefined });
  });

  it('trims and returns the text', () => {
    expect(parseFirstInscription('  hope and water  ')).toEqual({
      ok: true,
      value: 'hope and water',
    });
  });

  it('rejects non-strings and oversized input', () => {
    expect(parseFirstInscription(42).ok).toBe(false);
    expect(parseFirstInscription({}).ok).toBe(false);
    expect(parseFirstInscription('x'.repeat(2001)).ok).toBe(false);
  });
});

// ---------- server-side stamping ----------

describe('nextConsentState', () => {
  it('stamps version/capturedAt/capturedBy and defers Rings 3–4 on first capture', () => {
    const stamped = nextConsentState(
      { ring2MapPresence: true },
      undefined,
      USER,
      NOW,
    );
    expect(stamped).toEqual({
      version: CONSENT_VERSION,
      capturedAt: NOW,
      capturedBy: USER,
      ring2MapPresence: true,
      ring3ChartPresence: 'deferred',
      ring4: 'deferred',
    });
  });

  it('preserves Rings 3–4 when updating an existing consent', () => {
    const prev = consentState({
      ring3ChartPresence: true,
      ring4: { face: false, name: true, intention: false, business: false, mission: false },
    });
    const updated = nextConsentState(
      { ring2MapPresence: false },
      prev,
      'user_other_session',
      '2026-07-01T00:00:00.000Z',
    );
    expect(updated.ring2MapPresence).toBe(false);
    expect(updated.ring3ChartPresence).toBe(true);
    expect(updated.ring4).toEqual(prev.ring4);
    expect(updated.capturedAt).toBe('2026-07-01T00:00:00.000Z');
    expect(updated.capturedBy).toBe('user_other_session');
  });
});

describe('nextRing3ConsentState', () => {
  it('flips only ring3 + the stamp, carrying Rings 2 and 4 forward (M5)', () => {
    const prev = consentState({
      ring2MapPresence: true,
      ring3ChartPresence: 'deferred',
      ring4: { face: false, name: true, intention: false, business: false, mission: false },
    });
    const next = nextRing3ConsentState(true, prev, 'user_ring3', '2026-08-01T00:00:00.000Z');
    expect(next.ring3ChartPresence).toBe(true);
    expect(next.ring2MapPresence).toBe(true); // unchanged
    expect(next.ring4).toEqual(prev.ring4); // unchanged
    expect(next.version).toBe(CONSENT_VERSION);
    expect(next.capturedAt).toBe('2026-08-01T00:00:00.000Z');
    expect(next.capturedBy).toBe('user_ring3');
    // Turning it back off is symmetric.
    const off = nextRing3ConsentState(false, next, 'user_ring3', '2026-09-01T00:00:00.000Z');
    expect(off.ring3ChartPresence).toBe(false);
    expect(off.ring2MapPresence).toBe(true);
  });
});

// ---------- Phase A / Phase B state machine ----------

describe('claim phases — outreachStatus gating', () => {
  it('Phase A binds the userId but never flips outreachStatus', () => {
    const bound = bindStewardOnClaim(steward(), USER, NOW);
    expect(bound.clerkUserId).toBe(USER);
    expect(bound.lastClaimAt).toBe(NOW);
    expect(bound.outreachStatus).toBe('invited'); // unchanged — gated on consent
    expect(bound.consent).toBeUndefined();
  });

  it('Phase A never re-binds an already-bound record', () => {
    const bound = bindStewardOnClaim(
      steward({ clerkUserId: 'user_original' }),
      USER,
      NOW,
    );
    expect(bound.clerkUserId).toBe('user_original');
  });

  it('Phase B writes consent, appends to history, and flips to claimed', () => {
    const consent = consentState();
    const next = applyConsentToSteward(steward(), consent);
    expect(next.outreachStatus).toBe('claimed');
    expect(next.consent).toEqual(consent);
    expect(next.consentHistory).toEqual([consent]);
    expect(next.clerkUserId).toBe(USER); // bound via capturedBy
  });

  it('Phase B re-capture grows the history without losing earlier states', () => {
    const first = consentState({ ring2MapPresence: false });
    const second = consentState({
      ring2MapPresence: true,
      capturedAt: '2026-07-01T00:00:00.000Z',
    });
    const afterFirst = applyConsentToSteward(steward(), first);
    const afterSecond = applyConsentToSteward(afterFirst, second);
    expect(afterSecond.consent).toEqual(second);
    expect(afterSecond.consentHistory).toEqual([first, second]);
  });

  it('stores the first inscription once and never overwrites it', () => {
    const withFirst = applyConsentToSteward(
      steward(),
      consentState(),
      'may it hold our mornings',
    );
    expect(withFirst.pendingFirstInscription).toEqual({
      text: 'may it hold our mornings',
      createdAt: NOW,
    });
    const second = applyConsentToSteward(
      withFirst,
      consentState({ capturedAt: '2026-07-01T00:00:00.000Z' }),
      'a different answer',
    );
    expect(second.pendingFirstInscription).toEqual(withFirst.pendingFirstInscription);
  });

  it('leaves pendingFirstInscription absent when the prompt was skipped', () => {
    const next = applyConsentToSteward(steward(), consentState());
    expect(next.pendingFirstInscription).toBeUndefined();
  });
});

// ---------- idempotent consent stamping (Phase B retry) ----------

describe('isSameConsentIgnoringCapturedAt', () => {
  it('treats two states as the same when only capturedAt differs', () => {
    const a = consentState({ capturedAt: NOW });
    const b = consentState({ capturedAt: '2026-07-01T00:00:00.000Z' });
    expect(isSameConsentIgnoringCapturedAt(a, b)).toBe(true);
  });

  it('treats states as different when any other field differs', () => {
    const base = consentState();
    expect(
      isSameConsentIgnoringCapturedAt(base, { ...base, ring2MapPresence: false }),
    ).toBe(false);
    expect(
      isSameConsentIgnoringCapturedAt(base, { ...base, capturedBy: 'someone_else' }),
    ).toBe(false);
    expect(
      isSameConsentIgnoringCapturedAt(base, { ...base, ring3ChartPresence: true }),
    ).toBe(false);
    expect(
      isSameConsentIgnoringCapturedAt(base, {
        ...base,
        ring4: { face: true, name: false, intention: false, business: false, mission: false },
      }),
    ).toBe(false);
  });
});

describe('applyConsentToSteward — idempotent on a Phase B retry', () => {
  it('does not grow consentHistory when the resubmitted consent only differs by capturedAt', () => {
    const first = consentState({ capturedAt: NOW });
    const afterFirst = applyConsentToSteward(steward(), first);
    expect(afterFirst.consentHistory).toEqual([first]);

    // Simulate the retry: the ledger append after the first stamp failed,
    // the client resubmitted the identical choice, and nextConsentState
    // recomputed a state identical to `first` except for a later "now".
    const retryConsent = consentState({ capturedAt: '2026-06-10T12:00:05.000Z' });
    const afterRetry = applyConsentToSteward(afterFirst, retryConsent);

    expect(afterRetry.consentHistory).toEqual([first]); // no duplicate appended
    expect(afterRetry.consent).toEqual(first); // kept as-is, not replaced
  });

  it('still appends when a genuinely different choice follows (not a retry)', () => {
    const first = consentState({ ring2MapPresence: false, capturedAt: NOW });
    const afterFirst = applyConsentToSteward(steward(), first);
    const second = consentState({
      ring2MapPresence: true,
      capturedAt: '2026-07-01T00:00:00.000Z',
    });
    const afterSecond = applyConsentToSteward(afterFirst, second);
    expect(afterSecond.consentHistory).toEqual([first, second]);
    expect(afterSecond.consent).toEqual(second);
  });

  it('a first-ever capture (no prior history) is never treated as a retry', () => {
    const next = applyConsentToSteward(steward(), consentState());
    expect(next.consentHistory).toHaveLength(1);
  });
});

// ---------- chain events: first-claim-only + Ring 2 ----------

describe('planClaimChainEvents', () => {
  it('appends a claimed event with the exact PII-free payload, first claim only', async () => {
    const chain = await buildChain([
      { type: 'created' },
      { type: 'placed', cityId: 'lisbon-pt' },
    ]);
    const appended = await planClaimChainEvents(chain, {
      pieceId: 'UL-1',
      actorRef: USER,
      now: NOW,
      ring2MapPresence: true,
    });
    expect(appended).toHaveLength(1);
    const claimed = appended[0];
    expect(claimed.type).toBe('claimed');
    expect(claimed.actor).toBe('steward');
    expect(claimed.actorRef).toBe(USER);
    expect(claimed.date).toBe(NOW);
    // Whitelist: exactly these keys, nothing client-supplied. No cityId,
    // no note, no PII. (editionNumber is undefined → dropped by the
    // canonicalizer; it isn't an own key here.)
    expect(Object.keys(claimed).sort()).toEqual(
      ['actor', 'actorRef', 'date', 'hash', 'id', 'pieceId', 'prevHash', 'type'].sort(),
    );
    // The extended chain still verifies.
    expect(await verifyChain([...chain, ...appended])).toEqual({ ok: true });
  });

  it('does NOT append a second claimed event to an already-claimed chain', async () => {
    const chain = await buildChain([
      { type: 'created' },
      { type: 'placed', cityId: 'lisbon-pt' },
      { type: 'claimed', actor: 'steward', actorRef: 'user_first_holder' },
    ]);
    const appended = await planClaimChainEvents(chain, {
      pieceId: 'UL-1',
      actorRef: USER,
      now: NOW,
      ring2MapPresence: true,
    });
    expect(appended.filter((e) => e.type === 'claimed')).toHaveLength(0);
  });

  it('Ring 2 declined on a public piece appends withdrawn (actor steward)', async () => {
    const chain = await buildChain([
      { type: 'created' },
      { type: 'placed', cityId: 'lisbon-pt' },
    ]);
    const appended = await planClaimChainEvents(chain, {
      pieceId: 'UL-1',
      actorRef: USER,
      now: NOW,
      ring2MapPresence: false,
    });
    expect(appended.map((e) => e.type)).toEqual(['claimed', 'withdrawn']);
    const withdrawn = appended[1];
    expect(withdrawn.actor).toBe('steward');
    expect(withdrawn.actorRef).toBe(USER);
    expect(withdrawn.cityId).toBe('lisbon-pt');
    expect(await verifyChain([...chain, ...appended])).toEqual({ ok: true });
  });

  it('Ring 2 granted on a withdrawn piece appends revealed', async () => {
    const chain = await buildChain([
      { type: 'created' },
      { type: 'placed', cityId: 'lisbon-pt' },
      { type: 'withdrawn', cityId: 'lisbon-pt' },
    ]);
    const appended = await planClaimChainEvents(chain, {
      pieceId: 'UL-1',
      actorRef: USER,
      now: NOW,
      ring2MapPresence: true,
    });
    expect(appended.map((e) => e.type)).toEqual(['claimed', 'revealed']);
  });

  it('Ring 2 granted on an already-public piece appends nothing extra', async () => {
    const chain = await buildChain([
      { type: 'created' },
      { type: 'placed', cityId: 'lisbon-pt' },
      { type: 'claimed', actor: 'steward', actorRef: USER },
    ]);
    const appended = await planClaimChainEvents(chain, {
      pieceId: 'UL-1',
      actorRef: USER,
      now: NOW,
      ring2MapPresence: true,
    });
    expect(appended).toHaveLength(0);
  });

  it('returns nothing for an empty chain (record issued before any seed event)', async () => {
    const appended = await planClaimChainEvents([], {
      pieceId: 'UL-1',
      actorRef: USER,
      now: NOW,
      ring2MapPresence: true,
    });
    expect(appended).toEqual([]);
  });
});

// ---------- country-only placement still glows ----------

describe('country-only placement', () => {
  const portugal: CityCentroid = {
    id: 'country-pt',
    city: 'Portugal',
    country: 'Portugal',
    countryCode: 'PT',
    lat: 39.56,
    lng: -7.84,
  };

  it('a piece placed at a country centroid renders as a lit light, not hidden', async () => {
    const chain = await buildChain([
      { type: 'created' },
      { type: 'placed', cityId: 'country-pt' },
      { type: 'claimed', actor: 'steward', actorRef: USER },
    ]);
    const state = toPublicState(projectAll(chain), new Map(), [portugal]);
    const piece = state.pieces.find((p) => p.pieceId === 'UL-1');
    expect(piece?.status).toBe('placed'); // city + claim = lit
    expect(piece?.cityId).toBe('country-pt');
    expect(state.cities.map((c) => c.id)).toContain('country-pt');
  });
});

// ---------- privacy: consent + the ritual answer stay private ----------

describe('steward-view privacy', () => {
  const record = steward({
    clerkUserId: USER,
    notes: 'paid cash at the studio — follow up',
    consent: consentState(),
    consentHistory: [consentState()],
    pendingFirstInscription: { text: 'may it hold our mornings', createdAt: NOW },
  });

  it('returns pendingFirstInscription only to the authoring steward', () => {
    const own = toStewardView(record, USER);
    expect(own.pendingFirstInscription?.text).toBe('may it hold our mornings');
    expect((own as Record<string, unknown>).notes).toBeUndefined();
  });

  it('strips pendingFirstInscription for any other viewer (or no viewer)', () => {
    expect(toStewardView(record, 'user_someone_else').pendingFirstInscription)
      .toBeUndefined();
    expect(toStewardView(record).pendingFirstInscription).toBeUndefined();
  });

  it('keeps the steward\'s own consent visible to them (it is their data)', () => {
    const own = toStewardView(record, USER);
    expect(own.consent?.ring2MapPresence).toBe(true);
    expect(own.consentHistory).toHaveLength(1);
  });

  it('consent and the ritual answer never reach the public projection', async () => {
    // Even if a (buggy) caller projected a chain for a consented piece, the
    // public state is built from events only — consent lives exclusively on
    // the mutable steward record and can never leak through this path.
    const chain = await buildChain([
      { type: 'created' },
      { type: 'placed', cityId: 'country-pt' },
      { type: 'claimed', actor: 'steward', actorRef: USER },
    ]);
    const serialized = JSON.stringify(
      toPublicState(projectAll(chain), new Map(), []),
    );
    for (const needle of [
      'consent',
      'ring2MapPresence',
      'pendingFirstInscription',
      'may it hold our mornings',
      USER,
    ]) {
      expect(serialized).not.toContain(needle);
    }
  });
});
