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
  'birth',
  'birthDate',
  'birthPlace',
  'clerkUserId',
  'actorRef',
  'heirs',
  'history',
  'hash',
  'prevHash',
];

function buildState() {
  const events = [
    evt({ type: 'created', note: 'bought at the Lisbon opening — call Maria' }),
    evt({ type: 'placed', cityId: 'lisbon-pt', actorRef: 'user_abc123' }),
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

  it('never leaks note text into the serialized output', () => {
    const serialized = JSON.stringify(buildState());
    expect(serialized).not.toContain('Maria');
    expect(serialized).not.toContain('privacy');
    expect(serialized).not.toContain('user_abc123');
  });
});
