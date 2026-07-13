import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearReflectionOutbox,
  appendReflectionChunk,
  beginReflectionDraft,
  enqueueReflection,
  finalizeReflectionDraft,
  listReflectionDrafts,
  listReflectionChunks,
  listPendingReflections,
  removeReflection,
} from '../../lib/oracle/reflectionOutbox';

const pending = (id: string, recordedAt: string) => {
  const blob = new Blob(['voice'], { type: 'audio/mp4' });
  return {
    id,
    sessionId: '00000000-0000-4000-8000-000000000002',
    hexagramNumber: 22,
    recordedAt,
    durationMs: 1000,
    mimeType: blob.type,
    byteSize: blob.size,
    blob,
  };
};

describe('reflection outbox', () => {
  beforeEach(async () => clearReflectionOutbox());

  it('persists a Blob and stable segment id across reload-like reads', async () => {
    const row = pending('00000000-0000-4000-8000-000000000001', '2026-07-13T00:00:00Z');
    await enqueueReflection(row);
    const saved = (await listPendingReflections())[0];
    expect(saved.id).toBe(row.id);
    expect(saved.blob.size).toBe(5);
  });

  it('returns pending captures in recording order', async () => {
    await enqueueReflection(pending('later', '2026-07-13T02:00:00Z'));
    await enqueueReflection(pending('earlier', '2026-07-13T01:00:00Z'));
    expect((await listPendingReflections()).map(({ id }) => id)).toEqual(['earlier', 'later']);
  });

  it('removes one item only after durable server commit', async () => {
    await enqueueReflection(pending('keep', '2026-07-13T01:00:00Z'));
    await enqueueReflection(pending('remove', '2026-07-13T02:00:00Z'));
    await removeReflection('remove');
    expect((await listPendingReflections()).map(({ id }) => id)).toEqual(['keep']);
  });

  it('persists received timeslice chunks before the segment finishes', async () => {
    const row = pending('draft-1', '2026-07-13T01:00:00Z');
    const { blob: _blob, ...metadata } = row;
    await beginReflectionDraft({ ...metadata, byteSize: 0, durationMs: 0 });
    await appendReflectionChunk(row.id, 0, new Blob(['voi'], { type: row.mimeType }), 500);
    expect(await listReflectionChunks(row.id)).toHaveLength(1);
    expect(await listReflectionDrafts()).toEqual([expect.objectContaining({ id: row.id, byteSize: 3, durationMs: 500 })]);
  });

  it('recovers durable chunks after interruption and atomically promotes them to the outbox', async () => {
    const row = pending('draft-2', '2026-07-13T01:00:00Z');
    const { blob: _blob, ...metadata } = row;
    await beginReflectionDraft({ ...metadata, byteSize: 0, durationMs: 0 });
    await appendReflectionChunk(row.id, 0, new Blob(['voi'], { type: row.mimeType }), 500);
    await appendReflectionChunk(row.id, 1, new Blob(['ce'], { type: row.mimeType }), 1000);
    const finalized = await finalizeReflectionDraft(row.id);
    expect(await finalized.blob.text()).toBe('voice');
    expect((await listPendingReflections()).map(({ id }) => id)).toContain(row.id);
    expect(await listReflectionChunks(row.id)).toEqual([]);
    expect(await listReflectionDrafts()).toEqual([]);
  });
});
