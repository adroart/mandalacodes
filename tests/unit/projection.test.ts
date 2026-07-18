/**
 * Unit tests for utils/ledgerProjection.ts — replaying chains into state.
 *
 * Covers the projection rule for every existing event type, the
 * forward-compatibility of unknown event types (silently ignored), and
 * the per-edition keying of projectAll.
 */
import { describe, expect, it } from 'vitest';
import {
  deriveClaimOrdinals,
  deriveKind,
  derivePieceType,
  projectAll,
  projectPiece,
  toPublicState,
} from '../../utils/ledgerProjection';
import type { CityCentroid, LedgerEvent } from '../../types';

/* Projection never verifies hashes (that's verifyChain's job), so tests can
   fabricate events with dummy hash fields. */
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

describe('projectPiece event rules', () => {
  it('created → seeking, genesis cityId noted but not "placed"', () => {
    const record = projectPiece([evt({ type: 'created', cityId: 'lisbon-pt' })]);
    expect(record.status).toBe('seeking');
    expect(record.currentCityId).toBe('lisbon-pt');
    expect(record.isPublic).toBe(true);
  });

  it('placed → status placed with the event city', () => {
    const record = projectPiece([
      evt({ type: 'created' }),
      evt({ type: 'placed', cityId: 'lisbon-pt' }),
    ]);
    expect(record.status).toBe('placed');
    expect(record.currentCityId).toBe('lisbon-pt');
  });

  it('moved → city updates, stays placed', () => {
    const record = projectPiece([
      evt({ type: 'created' }),
      evt({ type: 'placed', cityId: 'lisbon-pt' }),
      evt({ type: 'moved', cityId: 'denpasar-id' }),
    ]);
    expect(record.status).toBe('placed');
    expect(record.currentCityId).toBe('denpasar-id');
  });

  it('withdrawn → isPublic false, city retained internally', () => {
    const record = projectPiece([
      evt({ type: 'created' }),
      evt({ type: 'placed', cityId: 'lisbon-pt' }),
      evt({ type: 'withdrawn' }),
    ]);
    expect(record.isPublic).toBe(false);
    expect(record.currentCityId).toBe('lisbon-pt');
  });

  it('revealed → isPublic true again', () => {
    const record = projectPiece([
      evt({ type: 'created' }),
      evt({ type: 'placed', cityId: 'lisbon-pt' }),
      evt({ type: 'withdrawn' }),
      evt({ type: 'revealed' }),
    ]);
    expect(record.isPublic).toBe(true);
    expect(record.status).toBe('placed');
  });

  it('retired → status retired, city cleared', () => {
    const record = projectPiece([
      evt({ type: 'created' }),
      evt({ type: 'placed', cityId: 'lisbon-pt' }),
      evt({ type: 'retired' }),
    ]);
    expect(record.status).toBe('retired');
    expect(record.currentCityId).toBeNull();
  });

  it('ignores unknown event types (forward compatibility)', () => {
    const future = evt({ cityId: 'lisbon-pt' });
    (future as { type: string }).type = 'inscribed';
    const record = projectPiece([
      evt({ type: 'created' }),
      evt({ type: 'placed', cityId: 'lisbon-pt' }),
      future,
    ]);
    expect(record.status).toBe('placed');
    expect(record.currentCityId).toBe('lisbon-pt');
  });

  it('claimed → records claimedAt from the first claim only', () => {
    const record = projectPiece([
      evt({ type: 'created' }),
      evt({ type: 'claimed', date: '2026-03-01T00:00:00.000Z' }),
      // A later claim (e.g. after a transfer) must not overwrite the first.
      evt({ type: 'claimed', date: '2026-06-01T00:00:00.000Z' }),
    ]);
    expect(record.claimedAt).toBe('2026-03-01T00:00:00.000Z');
  });

  it('claimed does not move or place the piece', () => {
    const record = projectPiece([
      evt({ type: 'created' }),
      evt({ type: 'claimed' }),
    ]);
    expect(record.status).toBe('seeking');
    expect(record.currentCityId).toBeNull();
  });

  it('created carries a pieceType override onto the record', () => {
    const record = projectPiece([evt({ type: 'created', pieceType: 'other' })]);
    expect(record.pieceType).toBe('other');
  });
});

const lisbon: CityCentroid = {
  id: 'lisbon-pt',
  city: 'Lisbon',
  country: 'Portugal',
  countryCode: 'PT',
  lat: 38.7,
  lng: -9.1,
};

describe('deriveClaimOrdinals (Founding Lights)', () => {
  it('ranks claimed pieces by first-claim date, 1-based and dense', () => {
    const records = projectAll([
      evt({ pieceId: 'A', type: 'created' }),
      evt({ pieceId: 'A', type: 'claimed', date: '2026-02-01T00:00:00.000Z' }),
      evt({ pieceId: 'B', type: 'created' }),
      evt({ pieceId: 'B', type: 'claimed', date: '2026-01-01T00:00:00.000Z' }),
      evt({ pieceId: 'C', type: 'created' }), // never claimed → no ordinal
    ]);
    const ord = deriveClaimOrdinals(records);
    expect(ord.get('B:0')).toBe(1); // earliest claim → first light
    expect(ord.get('A:0')).toBe(2);
    expect(ord.has('C:0')).toBe(false);
  });

  it('breaks ties on the claimed event id, stably', () => {
    // Two pieces claimed on the same date. The one whose claimed event id
    // sorts first wins the lower ordinal, regardless of insertion order.
    const records = projectAll([
      evt({ id: 'gen-z', pieceId: 'Z', type: 'created' }),
      evt({ id: 'claim-z', pieceId: 'Z', type: 'claimed', date: '2026-01-01T00:00:00.000Z' }),
      evt({ id: 'gen-a', pieceId: 'A', type: 'created' }),
      evt({ id: 'claim-a', pieceId: 'A', type: 'claimed', date: '2026-01-01T00:00:00.000Z' }),
    ]);
    const ord = deriveClaimOrdinals(records);
    expect(ord.get('A:0')).toBe(1); // 'claim-a' < 'claim-z'
    expect(ord.get('Z:0')).toBe(2);
  });
});

describe('derivePieceType', () => {
  it('mandala for Universal Language, other otherwise', () => {
    const seeking = projectPiece([evt({ type: 'created' })]);
    expect(derivePieceType(seeking, 'Universal Language')).toBe('mandala');
    expect(derivePieceType(seeking, 'Light Codes')).toBe('other');
    expect(derivePieceType(seeking, undefined)).toBe('other');
  });

  it('genesis override beats the series-derived value', () => {
    const overridden = projectPiece([evt({ type: 'created', pieceType: 'other' })]);
    expect(derivePieceType(overridden, 'Universal Language')).toBe('other');
  });
});

describe('deriveKind (the taxonomy facet)', () => {
  const seeking = () => projectPiece([evt({ type: 'created' })]);

  it('Universal Language → sixty-four', () => {
    expect(deriveKind(seeking(), { series: 'Universal Language' })).toBe('sixty-four');
  });

  it('Mandala series → mandala', () => {
    expect(deriveKind(seeking(), { series: 'Mandala' })).toBe('mandala');
  });

  it('pieceType mandala outside UL → mandala', () => {
    const overridden = projectPiece([evt({ type: 'created', pieceType: 'mandala' })]);
    expect(deriveKind(overridden, { series: 'Light Codes' })).toBe('mandala');
  });

  it('signature piece → signature', () => {
    expect(
      deriveKind(seeking(), { category: 'Multidimensional Art', isSignaturePiece: true }),
    ).toBe('signature');
  });

  it('otherwise a slug of the category', () => {
    expect(deriveKind(seeking(), { category: 'Jewelry' })).toBe('jewelry');
    expect(deriveKind(seeking(), { category: 'Multidimensional Art' })).toBe(
      'multidimensional-art',
    );
  });

  it('no series and no category → other', () => {
    expect(deriveKind(seeking(), undefined)).toBe('other');
  });
});

describe('toPublicState — claim-aware status + ordinals', () => {
  function meta() {
    return new Map([
      ['UL-1', { series: 'Universal Language', category: 'Multidimensional Art' }],
    ]);
  }

  it('placed + claimed → status placed with an ordinal', () => {
    const state = toPublicState(
      projectAll([
        evt({ pieceId: 'UL-1', type: 'created' }),
        evt({ pieceId: 'UL-1', type: 'placed', cityId: 'lisbon-pt' }),
        evt({ pieceId: 'UL-1', type: 'claimed' }),
      ]),
      meta(),
      [lisbon],
    );
    const p = state.pieces.find((x) => x.pieceId === 'UL-1');
    expect(p?.status).toBe('placed');
    expect(p?.claimOrdinal).toBe(1);
    expect(p?.pieceType).toBe('mandala');
    expect(p?.kind).toBe('sixty-four');
    expect(state.schemaVersion).toBe(2);
  });

  it('carries the kind facet for a non-UL piece from its meta', () => {
    const state = toPublicState(
      projectAll([
        evt({ pieceId: 'JW-1', type: 'created' }),
        evt({ pieceId: 'JW-1', type: 'placed', cityId: 'lisbon-pt' }),
        evt({ pieceId: 'JW-1', type: 'claimed' }),
      ]),
      new Map([['JW-1', { category: 'Jewelry' }]]),
      [lisbon],
    );
    const p = state.pieces.find((x) => x.pieceId === 'JW-1');
    expect(p?.kind).toBe('jewelry');
    expect(p?.pieceType).toBe('other');
  });

  it('placed but unclaimed → status unawakened, no ordinal', () => {
    const state = toPublicState(
      projectAll([
        evt({ pieceId: 'UL-1', type: 'created' }),
        evt({ pieceId: 'UL-1', type: 'placed', cityId: 'lisbon-pt' }),
      ]),
      meta(),
      [lisbon],
    );
    const p = state.pieces.find((x) => x.pieceId === 'UL-1');
    expect(p?.status).toBe('unawakened');
    expect(p?.claimOrdinal).toBeUndefined();
  });
});

describe('projectAll', () => {
  it('keys records by pieceId:editionNumber with 0 for missing editions', () => {
    const records = projectAll([
      evt({ pieceId: 'UL-1', type: 'created' }),
      evt({ pieceId: 'UL-2', editionNumber: 3, type: 'created' }),
    ]);
    expect(Array.from(records.keys()).sort()).toEqual(['UL-1:0', 'UL-2:3']);
  });

  it('projects sibling editions as separate records', () => {
    const records = projectAll([
      evt({ pieceId: 'UL-1', editionNumber: 1, type: 'created' }),
      evt({ pieceId: 'UL-1', editionNumber: 1, type: 'placed', cityId: 'lisbon-pt' }),
      evt({ pieceId: 'UL-1', editionNumber: 2, type: 'created' }),
    ]);
    expect(records.get('UL-1:1')?.status).toBe('placed');
    expect(records.get('UL-1:2')?.status).toBe('seeking');
  });
});
