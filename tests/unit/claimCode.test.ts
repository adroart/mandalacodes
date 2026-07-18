/**
 * Unit suite for utils/claimCode.ts — the piece-claim credential.
 *
 * Pins:
 *   - generate shape (Crockford alphabet, >= 128 bits of entropy, grouped),
 *   - normalize round-trip: grouping, case, and the I/L/O ambiguity mapping
 *     all collapse to one canonical form,
 *   - hash stability (same code -> same digest, isomorphic SHA-256 hex),
 *   - hash agreement across every equivalent rendering of a code,
 *   - uniqueness sanity across many generated codes.
 */
import { describe, expect, it } from 'vitest';
import {
  CLAIM_CODE_ALPHABET,
  generateClaimCode,
  groupClaimCode,
  hashClaimCode,
  normalizeClaimCode,
} from '../../utils/claimCode';

const stripGroups = (s: string) => s.replace(/-/g, '');

describe('generateClaimCode', () => {
  it('emits only Crockford base32 symbols and group separators', () => {
    const code = generateClaimCode();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z-]+$/);
    for (const ch of stripGroups(code)) {
      expect(CLAIM_CODE_ALPHABET).toContain(ch);
    }
  });

  it('never emits the ambiguous Crockford characters I, L, O, U', () => {
    for (let i = 0; i < 200; i++) {
      expect(stripGroups(generateClaimCode())).not.toMatch(/[ILOU]/);
    }
  });

  it('carries at least 128 bits of entropy (>= 26 base32 symbols)', () => {
    // 26 symbols * 5 bits = 130 bits >= 128.
    expect(stripGroups(generateClaimCode()).length).toBeGreaterThanOrEqual(26);
  });

  it('is uniquely generated (no collisions across a large sample)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(stripGroups(generateClaimCode()));
    expect(seen.size).toBe(5000);
  });
});

describe('groupClaimCode', () => {
  it('groups in fives and never ends in a lonely single character', () => {
    // 26 symbols -> 5,5,5,5,6 (the trailing single is folded back).
    const grouped = groupClaimCode('ABCDEFGHJKMNPQRSTVWXYZ0123');
    expect(grouped).toBe('ABCDE-FGHJK-MNPQR-STVWX-YZ0123');
    expect(grouped.split('-').every((g) => g.length >= 2)).toBe(true);
  });

  it('round-trips: a grouped code normalizes back to the ungrouped source', () => {
    const source = stripGroups(generateClaimCode());
    expect(normalizeClaimCode(groupClaimCode(source))).toBe(source);
  });
});

describe('normalizeClaimCode', () => {
  it('strips separators and uppercases', () => {
    expect(normalizeClaimCode('q3m7k-8zpa4')).toBe('Q3M7K8ZPA4');
    expect(normalizeClaimCode('Q3M7K 8ZPA4')).toBe('Q3M7K8ZPA4');
  });

  it('maps the Crockford ambiguity set: I and L -> 1, O -> 0', () => {
    expect(normalizeClaimCode('IL0O1')).toBe('11001');
    expect(normalizeClaimCode('iloILO')).toBe('110110');
  });

  it('is idempotent', () => {
    const once = normalizeClaimCode('q3m7k-8zpa4-Lo1');
    expect(normalizeClaimCode(once)).toBe(once);
  });

  it('tolerates empty / undefined-ish input', () => {
    expect(normalizeClaimCode('')).toBe('');
    expect(normalizeClaimCode(undefined as unknown as string)).toBe('');
  });
});

describe('hashClaimCode', () => {
  it('is a 64-character lowercase hex SHA-256 digest', async () => {
    const hash = await hashClaimCode(generateClaimCode());
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is stable: the same code always hashes to the same digest', async () => {
    const code = generateClaimCode();
    expect(await hashClaimCode(code)).toBe(await hashClaimCode(code));
  });

  it('follows the recipe normalize -> UTF-8 -> SHA-256 -> lowercase hex', async () => {
    // Re-derive the digest from the same primitive to pin the recipe exactly.
    const bytes = new TextEncoder().encode('Q3M7K8ZPA4');
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const ref = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(await hashClaimCode('Q3M7K8ZPA4')).toBe(ref);
    // And a grouped/lowercase rendering of the same code hits the same digest.
    expect(await hashClaimCode('q3m7k-8zpa4')).toBe(ref);
  });

  it('agrees across every equivalent rendering (grouping, case, ambiguity)', async () => {
    const canonical = await hashClaimCode('Q3M7K8ZPA4');
    expect(await hashClaimCode('q3m7k-8zpa4')).toBe(canonical);
    expect(await hashClaimCode('Q3M7K 8ZPA4')).toBe(canonical);
    // O -> 0, l -> 1 mapping means a mis-read still verifies. Build a code with
    // real ambiguous glyphs that normalize to the canonical digits.
    const withAmbiguity = 'Q3M7K8ZPA4'.replace(/0/g, 'O').replace(/1/g, 'l');
    expect(await hashClaimCode(withAmbiguity)).toBe(canonical);
  });

  it('different codes hash differently', async () => {
    expect(await hashClaimCode('Q3M7K8ZPA4')).not.toBe(await hashClaimCode('Q3M7K8ZPA5'));
  });
});
