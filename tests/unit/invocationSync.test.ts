import { describe, expect, it } from 'vitest';
import { addProseBlock, applyBlockEdit, applySegmentEdit, blocksFromSegments, moveBlock, removeProseBlock } from '../../lib/oracle/invocationSync';
import type { InvocationBlock } from '../../lib/oracle/invocationTypes';

const linked: InvocationBlock = { id: 'segment:seg-a', kind: 'segment', segmentId: 'seg-a', markdown: 'Before', sortOrder: 0 };
const prose: InvocationBlock = { id: 'prose-1', kind: 'prose', segmentId: null, markdown: 'Bridge', sortOrder: 1 };

describe('invocation synchronization', () => {
  it('imports recorder order and preserves segment identity', () => {
    expect(blocksFromSegments([
      { id: 'seg-a', transcript: 'Earlier', sortOrder: 1, createdAt: 'a' },
      { id: 'seg-b', transcript: 'Newest', sortOrder: 0, createdAt: 'b' },
    ])).toEqual([
      { id: 'segment:seg-b', kind: 'segment', segmentId: 'seg-b', markdown: 'Newest', sortOrder: 0 },
      { id: 'segment:seg-a', kind: 'segment', segmentId: 'seg-a', markdown: 'Earlier', sortOrder: 1 },
    ]);
  });

  it('synchronizes linked edits in both directions', () => {
    expect(applyBlockEdit([linked], linked.id, 'Changed').segmentUpdate).toEqual({ segmentId: 'seg-a', transcript: 'Changed' });
    expect(applySegmentEdit([linked, prose], 'seg-a', 'From recorder')[0].markdown).toBe('From recorder');
  });

  it('manages prose and contiguous composition order', () => {
    expect(addProseBlock([linked], 'prose-2', ' A bridge. ', 1)[1]).toMatchObject({ kind: 'prose', segmentId: null, markdown: 'A bridge.' });
    expect(moveBlock([linked, prose], 'prose-1', 0).map((block) => [block.id, block.sortOrder])).toEqual([['prose-1', 0], [linked.id, 1]]);
    expect(removeProseBlock([linked, prose], 'prose-1')).toEqual([{ ...linked, sortOrder: 0 }]);
    expect(() => removeProseBlock([linked], linked.id)).toThrow('linked segment blocks cannot be removed');
  });
});
