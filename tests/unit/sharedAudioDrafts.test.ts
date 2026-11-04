import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createAudioDraftStore, type AudioDraft } from '../../shared/voice/audio-drafts';
import { chooseRecorderMimeType } from '../../shared/voice/microphone';

/* The shape another project uses: drafts only, no finished store, with its
   own fields riding on each draft. */
interface NoteDraft extends AudioDraft { userId: string; contextKey: string }
const store = createAudioDraftStore<NoteDraft>({ database: 'shared-audio-drafts-test', version: 1 });
const draft = (id: string, userId = 'u1'): NoteDraft => ({ id, mimeType: 'audio/webm', byteSize: 0, durationMs: 0, userId, contextKey: 'journal:1' });

describe('shared audio drafts', () => {
  beforeEach(async () => store.clear());

  it('joins chunks into one recording and keeps the project fields', async () => {
    await store.begin(draft('a'));
    await store.append('a', 0, new Blob(['voi']), 400);
    await store.append('a', 1, new Blob(['ce']), 900);
    const recording = await store.finalize('a');
    expect(await recording.blob.text()).toBe('voice');
    expect(recording).toMatchObject({ userId: 'u1', contextKey: 'journal:1', byteSize: 5, durationMs: 900 });
    expect(await store.listDrafts()).toEqual([]);
    expect(await store.listChunks('a')).toEqual([]);
  });

  it('leaves an interrupted recording on the device until it is finished', async () => {
    await store.begin(draft('b'));
    await store.append('b', 0, new Blob(['half']), 500);
    expect((await store.listDrafts()).map(({ id }) => id)).toEqual(['b']);
  });

  it('discards a draft and only its chunks', async () => {
    await store.begin(draft('keep', 'u1'));
    await store.begin(draft('drop', 'u2'));
    await store.append('keep', 0, new Blob(['k']), 100);
    await store.append('drop', 0, new Blob(['d']), 100);
    await store.discard('drop');
    expect((await store.listDrafts()).map(({ id }) => id)).toEqual(['keep']);
    expect(await store.listChunks('drop')).toEqual([]);
    expect(await store.listChunks('keep')).toHaveLength(1);
  });

  it('refuses finished-store calls when the project named none', () => {
    expect(() => store.listFinished()).toThrow(/no finished store/);
  });
});

describe('shared microphone format choice', () => {
  it('prefers mp4 by default and follows a project list when given', () => {
    const supported = (type: string) => type === 'audio/webm' || type === 'audio/mp4';
    expect(chooseRecorderMimeType(supported)).toBe('audio/mp4');
    expect(chooseRecorderMimeType(supported, ['audio/webm', 'audio/mp4'])).toBe('audio/webm');
    expect(chooseRecorderMimeType(() => false)).toBeNull();
  });
});
