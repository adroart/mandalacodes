import type { SegmentMetadataInput } from '../../types/oracleReflection';
import { createAudioDraftStore, type AudioChunk } from '../../shared/voice/audio-drafts';

export interface PendingReflection extends SegmentMetadataInput {
  blob: Blob;
}

export type ReflectionDraft = Omit<PendingReflection, 'blob'>;
export type ReflectionChunk = AudioChunk;

/* Saving while recording is the shared audio-drafts module. The database,
   store and index names are the ones this outbox has always used, so drafts
   and pending segments already on a device are read as before. */
const store = createAudioDraftStore<ReflectionDraft>({
  database: 'mandalacodes-oracle-reflections',
  version: 2,
  finished: { name: 'segments', indexes: { recordedAt: 'recordedAt' } },
  label: 'Reflection',
});

export const enqueueReflection = (value: PendingReflection): Promise<void> => store.putFinished(value);
export const listPendingReflections = (): Promise<PendingReflection[]> => store.listFinished('recordedAt');
export const removeReflection = (id: string): Promise<void> => store.removeFinished(id);
export const clearReflectionOutbox = (): Promise<void> => store.clear();
export const beginReflectionDraft = (value: ReflectionDraft): Promise<void> => store.begin(value);
export const appendReflectionChunk = (segmentId: string, index: number, blob: Blob, durationMs: number): Promise<void> =>
  store.append(segmentId, index, blob, durationMs);
export const listReflectionChunks = (segmentId: string): Promise<ReflectionChunk[]> => store.listChunks(segmentId);
export const listReflectionDrafts = (): Promise<ReflectionDraft[]> => store.listDrafts();
export const finalizeReflectionDraft = (segmentId: string): Promise<PendingReflection> => store.finalize(segmentId);
export const discardReflectionDraft = (segmentId: string): Promise<void> => store.discard(segmentId);
