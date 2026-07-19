/**
 * Privacy assertion for utils/ledgerProjection.toPublicState.
 *
 * The public projection is what gets cached at /api/atlas and mirrored to
 * the public GitHub repo — Software Heritage archives that repo, so
 * anything personal that reaches it is unerasable globally. This suite
 * pins the contract: no emails, notes, consent, birth data, identities, or
 * event history ever appear in the output, and hidden pieces stay hidden.
 */
import { describe, expect, it } from 'vitest';
import { projectAll, toPublicState } from '../../utils/ledgerProjection';
import type { CityCentroid, LedgerEvent } from '../../types';

let counter = 0;
function evt(overrides: Partial<LedgerEvent> = {}): LedgerEvent {
  counter += 1;
  return {
    id: `evt-${counter}`,
    pieceId: 'UL-1',
    type: 'created',
    date: `2026-01-${String(counter).padStart(2, '0')}T00:00:00.000Z`,
    cityId: null,
    actor: 'admin',
    prevHash: null,
    hash: `hash-${counter}`,
    ...overrides,
  };
}

const lisbon: CityCentroid = {
  id: 'lisbon-pt',
  city: 'Lisbon',
  country: 'Portugal',
  countryCode: 'PT',
  lat: 38.7,
  lng: -9.1,
};

/** Recursively collect every object key in a JSON-serializable value. */
function collectKeys(value: unknown, into: Set<string>): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) collectKeys(v, into);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      into.add(k);
      collectKeys(v, into);
    }
  }
  return into;
}

/* Field names that must never surface publicly. `note`/`notes` are admin
   context; the rest are steward-record / consent / chart-era fields that
   live only in mutable private storage. */
const FORBIDDEN_KEYS = [
  'email',
  'name',
  'note',
  'notes',
  'consent',
  'consentHistory',
  'ring2MapPresence',
  'ring3ChartPresence',
  'ring4',
  'capturedBy',
  'pendingFirstInscription',
  'birth',
  'birthDate',
  'birthPlace',
  'clerkUserId',
  'actorRef',
  'heirs',
  'history',
  'hash',
  'prevHash',
  // M3 inscription fields — the body lives only in D1; even the contentless
  // chain pointers (inscriptionId/contentHash) stay off the public surface.
  'body',
  'inscriptionId',
  'contentHash',
  'inscriptionKind',
  'fromRef',
  'toRef',
  'erase_reason',
];

function buildState() {
  const events = [
    evt({ type: 'created', note: 'bought at the Lisbon opening — call Maria' }),
    evt({ type: 'placed', cityId: 'lisbon-pt', actorRef: 'user_abc123' }),
    // A claim carries the holder's opaque ref — it must never surface.
    evt({ type: 'claimed', actorRef: 'user_holder_xyz' }),
    evt({ pieceId: 'UL-2', type: 'created' }),
    evt({ pieceId: 'UL-2', type: 'placed', cityId: 'lisbon-pt' }),
    evt({ pieceId: 'UL-2', type: 'withdrawn', note: 'collector asked for privacy' }),
    evt({ pieceId: 'UL-3', type: 'created' }),
    evt({ pieceId: 'UL-3', type: 'retired', note: 'destroyed in transit' }),
  ];
  const meta = new Map([
    ['UL-1', { series: 'Universal Language', category: 'Multidimensional Art' }],
  ]);
  return toPublicState(projectAll(events), meta, [lisbon]);
}

describe('toPublicState privacy', () => {
  it('emits no private field names anywhere in the output', () => {
    const keys = collectKeys(buildState(), new Set<string>());
    for (const forbidden of FORBIDDEN_KEYS) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it('emits only the documented public piece fields', () => {
    const state = buildState();
    const allowed = new Set([
      'pieceId',
      'editionNumber',
      'series',
      'category',
      'cityId',
      'status',
      'placedAt',
      // M1 additions (schemaVersion 2): marker color category + Founding
      // Lights ordinal. Both are non-personal — derived from series/dates,
      // never from holder data. Added to the whitelist deliberately.
      'pieceType',
      'claimOrdinal',
      // The taxonomy facet the visitor filters by. Non-personal — derived from
      // series/category/pieceType, never from holder data. Whitelisted deliberately.
      'kind',
      // M5: a single derived BOOLEAN — "draw kinship arcs to this piece?".
      // Carries no holder data; the consent OBJECT and ring3ChartPresence
      // stay forbidden (above). Added to the whitelist deliberately.
      'kinshipEligible',
      // M6, Lens 2: the piece's public shared dream, attached only when the
      // keeper let it ride. Non-identifying prose. Whitelisted deliberately.
      'intention',
      // "Sign your dream" (Ring 4, 2026-07-19): the keeper's own name + one
      // link, present only alongside a public dream and only by their explicit,
      // revocable choice. The one identity field a keeper may consent public;
      // its nested `name` is the deliberate exception to the top-level 'name'
      // ban, which still guards every unconsented path (buildState carries no
      // signature, so the recursive forbidden-keys test above still holds).
      'signedBy',
    ]);
    for (const piece of state.pieces) {
      for (const key of Object.keys(piece)) {
        expect(allowed).toContain(key);
      }
    }
  });

  it('omits withdrawn and retired pieces entirely', () => {
    const ids = buildState().pieces.map((p) => p.pieceId);
    expect(ids).toContain('UL-1');
    expect(ids).not.toContain('UL-2'); // withdrawn — existence not disclosed
    expect(ids).not.toContain('UL-3'); // retired
  });

  it('never leaks note text or actor refs into the serialized output', () => {
    const serialized = JSON.stringify(buildState());
    expect(serialized).not.toContain('Maria');
    expect(serialized).not.toContain('privacy');
    expect(serialized).not.toContain('user_abc123');
    expect(serialized).not.toContain('user_holder_xyz');
  });

  it('threads kinshipEligible as a derived boolean, never the consent object', () => {
    // A claimed piece with ring3 = true is eligible; the ring3 map passed in
    // is consent-derived but only the boolean reaches the public state.
    const events = [
      evt({ type: 'created' }),
      evt({ type: 'placed', cityId: 'lisbon-pt' }),
      evt({ type: 'claimed', actorRef: 'user_holder' }),
    ];
    const meta = new Map([
      ['UL-1', { series: 'Universal Language', category: 'Multidimensional Art' }],
    ]);
    const ring3 = new Map<string, boolean | 'deferred'>([['UL-1:0', true]]);
    const state = toPublicState(projectAll(events), meta, [lisbon], ring3);
    const ul1 = state.pieces.find((p) => p.pieceId === 'UL-1');
    expect(ul1?.kinshipEligible).toBe(true);
    // The whole serialized state must still carry no consent fields.
    const keys = collectKeys(state, new Set<string>());
    expect(keys).not.toContain('ring3ChartPresence');
    expect(keys).not.toContain('consent');
    expect(keys.has('kinshipEligible')).toBe(true);
  });

  it('marks a claimed piece ineligible when ring3 is deferred or absent', () => {
    const events = [
      evt({ type: 'created' }),
      evt({ type: 'placed', cityId: 'lisbon-pt' }),
      evt({ type: 'claimed', actorRef: 'user_holder' }),
    ];
    const meta = new Map([['UL-1', { series: 'Universal Language' }]]);
    // No ring3 entry → fail-closed.
    const a = toPublicState(projectAll(events), meta, [lisbon]);
    expect(a.pieces.find((p) => p.pieceId === 'UL-1')?.kinshipEligible).toBe(false);
    // ring3 'deferred' → still ineligible.
    const b = toPublicState(
      projectAll(events),
      meta,
      [lisbon],
      new Map<string, boolean | 'deferred'>([['UL-1:0', 'deferred']]),
    );
    expect(b.pieces.find((p) => p.pieceId === 'UL-1')?.kinshipEligible).toBe(false);
  });

  it('keeps an artist-placed (unclaimed) piece eligible — unchanged behavior', () => {
    const events = [
      evt({ type: 'created' }),
      evt({ type: 'placed', cityId: 'lisbon-pt' }),
    ];
    const meta = new Map([['UL-1', { series: 'Universal Language' }]]);
    const state = toPublicState(projectAll(events), meta, [lisbon]);
    // No claim → artist's own data → eligible regardless of any consent map.
    expect(state.pieces.find((p) => p.pieceId === 'UL-1')?.kinshipEligible).toBe(true);
  });

  it('carries chain-tip hashes for VISIBLE pieces only (mirror tamper-evidence)', () => {
    // chainTips is the Continuity plank: the public mirror's commit history
    // over these opaque hashes is the tamper-evidence for the chains. Added
    // to the public surface DELIBERATELY — hashes only, and scoped to the
    // pieces already disclosed by the pieces array, so a withdrawn/retired
    // piece's existence stays undisclosed here too.
    const events = [
      evt({ type: 'created' }),
      evt({ type: 'placed', cityId: 'lisbon-pt' }),
      evt({ type: 'claimed', actorRef: 'user_holder_xyz' }),
      evt({ pieceId: 'UL-2', type: 'created' }),
      evt({ pieceId: 'UL-2', type: 'withdrawn' }),
      evt({ pieceId: 'UL-3', type: 'created' }),
      evt({ pieceId: 'UL-3', type: 'retired' }),
    ];
    const tipHash = events[2].hash; // UL-1's last event
    const state = toPublicState(projectAll(events), new Map(), [lisbon]);
    const tips = state.chainTips ?? {};
    // The tip is the last event's hash on the visible chain — an opaque
    // value, never an actorRef/email/note.
    expect(Object.keys(tips)).toEqual(['UL-1:0']);
    expect(tips['UL-1:0']).toBe(tipHash);
    expect(Object.keys(tips)).not.toContain('UL-2:0'); // withdrawn
    expect(Object.keys(tips)).not.toContain('UL-3:0'); // retired
  });

  it('exposes the Founding Lights ordinal but not the holder behind it', () => {
    const state = buildState();
    const ul1 = state.pieces.find((p) => p.pieceId === 'UL-1');
    expect(ul1?.claimOrdinal).toBe(1); // claimed → the 1st light
    // UL-1 is the only claimed, placed piece → status 'placed', not unawakened.
    expect(ul1?.status).toBe('placed');
  });
});
