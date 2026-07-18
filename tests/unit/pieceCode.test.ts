/**
 * Unit tests for utils/pieceCode.ts — the piece sigil.
 *
 * These FREEZE the prefix table and numbering rules. A sigil is printed onto
 * and shipped with a physical piece; once printed it can never change (the
 * forever contract, todo/plans/claim-code-integration.md). This suite is the
 * enforcement of that discipline: ADDITIONS ONLY, NEVER EDITS. If a change to
 * pieceCode.ts breaks one of these expectations, it is breaking a printed
 * promise — the change is wrong, not the test.
 */
import { describe, expect, it } from 'vitest';
import { pieceCode } from '../../utils/pieceCode';

describe('pieceCode — frozen prefix table', () => {
  it('Universal Language → UL № <card number>', () => {
    expect(pieceCode({ pieceId: 'UL-1', series: 'Universal Language', cardNumber: 1 })).toBe(
      'UL № 1',
    );
    expect(pieceCode({ pieceId: 'UL-64', series: 'Universal Language', cardNumber: 64 })).toBe(
      'UL № 64',
    );
  });

  it('Mandala → MA', () => {
    expect(pieceCode({ pieceId: 'MA-14', series: 'Mandala' })).toBe('MA № 14');
  });

  it('Light Codes → LC', () => {
    expect(pieceCode({ pieceId: 'LC-7', series: 'Light Codes' })).toBe('LC № 7');
  });

  it('Jewelry category → JW (when no named series)', () => {
    expect(pieceCode({ pieceId: 'JW-3', category: 'Jewelry' })).toBe('JW № 3');
  });

  it('signature pieces → SG', () => {
    expect(
      pieceCode({ pieceId: 'sig-22', category: 'Multidimensional Art', isSignaturePiece: true }),
    ).toBe('SG № 22');
  });

  it('a named series wins over the signature flag', () => {
    // Signature pieces live outside any named series, but if both are somehow
    // present the frozen series prefix leads.
    expect(
      pieceCode({ pieceId: 'MA-9', series: 'Mandala', isSignaturePiece: true }),
    ).toBe('MA № 9');
  });

  it('the signature flag wins over a category prefix', () => {
    expect(
      pieceCode({ pieceId: 'JW-5', category: 'Jewelry', isSignaturePiece: true }),
    ).toBe('SG № 5');
  });
});

describe('pieceCode — numbering precedence', () => {
  it('sigilNumber (curated lock) wins over everything', () => {
    expect(
      pieceCode({
        pieceId: 'UL-1',
        series: 'Universal Language',
        cardNumber: 1,
        sigilNumber: 900,
      }),
    ).toBe('UL № 900');
    // Even a piece with no number in its id gets the curated lock.
    expect(pieceCode({ pieceId: 'seed-of-life', series: 'Mandala', sigilNumber: 12 })).toBe(
      'MA № 12',
    );
  });

  it('cardNumber wins over the id when no sigilNumber', () => {
    expect(pieceCode({ pieceId: 'UL-99', series: 'Universal Language', cardNumber: 5 })).toBe(
      'UL № 5',
    );
  });

  it('trailing digits of the id when no cardNumber or sigilNumber', () => {
    expect(pieceCode({ pieceId: 'MA-014', series: 'Mandala' })).toBe('MA № 14');
    expect(pieceCode({ pieceId: 'LC-7', series: 'Light Codes' })).toBe('LC № 7');
  });

  it('stable hash fallback for an id with no trailing digits — deterministic', () => {
    const a = pieceCode({ pieceId: 'seed-of-life', series: 'Mandala' });
    const b = pieceCode({ pieceId: 'seed-of-life', series: 'Mandala' });
    expect(a).toBe(b); // stability across calls
    expect(a).toMatch(/^MA № \d+$/);
    // Freeze the exact hashed number so the printed sigil can never drift.
    expect(a).toBe('MA № 2');
    // A different id hashes to its own stable number.
    const other = pieceCode({ pieceId: 'flower-of-life', series: 'Mandala' });
    expect(other).toMatch(/^MA № \d+$/);
    expect(other).toBe('MA № 356');
  });
});

describe('pieceCode — pre-freeze last resort', () => {
  it('an unknown series derives an initials prefix (until it earns a frozen row)', () => {
    // This path exists ONLY for a series with no frozen row and no piece
    // printed yet. Freezing the behavior guards against silent drift.
    expect(pieceCode({ pieceId: 'ab-4', series: 'Aurora Bloom' })).toBe('AB № 4');
    expect(pieceCode({ pieceId: 'x-2', series: 'Solitude' })).toBe('SO № 2');
    expect(pieceCode({ pieceId: 'p-9' })).toBe('PI № 9'); // no series/category → the 'Piece' default
  });
});
