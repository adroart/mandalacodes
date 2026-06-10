/**
 * Unit tests for utils/ledgerProjection.ts — replaying chains into state.
 *
 * Covers the projection rule for every existing event type, the
 * forward-compatibility of unknown event types (silently ignored), and
 * the per-edition keying of projectAll.
 */
import { describe, expect, it } from 'vitest';
import { projectAll, projectPiece } from '../../utils/ledgerProjection';
import type { LedgerEvent } from '../../types';

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

  it('throws on an empty chain', () => {
    expect(() => projectPiece([])).toThrow();
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
