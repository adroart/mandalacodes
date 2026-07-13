import { describe, it, expect, afterEach } from 'vitest';
import {
  DEFAULT_MESSAGES,
  PIECE_OVERRIDES,
  creatorMessageFor,
} from '../../functions/api/atlas/_creatorMessages';

describe('creatorMessageFor', () => {
  afterEach(() => {
    for (const key of Object.keys(PIECE_OVERRIDES)) delete PIECE_OVERRIDES[key];
  });

  it('ships exactly six placeholder defaults, each marked PLACEHOLDER', () => {
    expect(DEFAULT_MESSAGES).toHaveLength(6);
    for (const m of DEFAULT_MESSAGES) {
      expect(m).toContain('PLACEHOLDER');
    }
  });

  it('is deterministic: the same pieceId always draws the same default', () => {
    const a = creatorMessageFor('UL-142');
    const b = creatorMessageFor('UL-142');
    expect(a).toBe(b);
    expect(DEFAULT_MESSAGES).toContain(a as string);
  });

  it('spreads across the pool rather than always returning one line', () => {
    const ids = Array.from({ length: 200 }, (_, i) => `UL-${i}`);
    const seen = new Set(ids.map((id) => creatorMessageFor(id)));
    // A stable hash over 200 ids should cover more than one of six buckets.
    expect(seen.size).toBeGreaterThan(1);
  });

  it('lets a per-piece override win over the deterministic default', () => {
    PIECE_OVERRIDES['UL-777'] = 'A bespoke line for this one piece.';
    expect(creatorMessageFor('UL-777')).toBe('A bespoke line for this one piece.');
  });
});
