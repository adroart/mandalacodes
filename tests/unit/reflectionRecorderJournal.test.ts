import { describe, expect, it } from 'vitest';
import { cycleJournalFocusIndex, moveReflectionSegment, newestReflectionSegments } from '../../components/oracle/ReflectionJournal';

const segment = (id: string, recordedAt: string, sequence: number) => ({ id, recordedAt, sequence });

describe('reflection recorder journal ordering', () => {
  it('presents freshly loaded segments newest first without changing identity', () => {
    const rows = [segment('old', '2026-07-13T01:00:00Z', 0), segment('new', '2026-07-13T02:00:00Z', 1)];
    expect(newestReflectionSegments(rows).map(({ id }) => id)).toEqual(['new', 'old']);
  });

  it('moves a segment by immutable identity', () => {
    const rows = [segment('a', '2026-07-13T01:00:00Z', 0), segment('b', '2026-07-13T02:00:00Z', 1), segment('c', '2026-07-13T03:00:00Z', 2)];
    expect(moveReflectionSegment(rows, 'c', 'a').map(({ id }) => id)).toEqual(['c', 'a', 'b']);
    expect(moveReflectionSegment(rows, 'missing', 'a')).toBe(rows);
  });

  it('cycles keyboard focus inside the journal in both directions', () => {
    expect(cycleJournalFocusIndex(2, 3, 1)).toBe(0);
    expect(cycleJournalFocusIndex(0, 3, -1)).toBe(2);
    expect(cycleJournalFocusIndex(1, 3, 1)).toBe(2);
  });
});
