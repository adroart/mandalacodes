import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createSession, sourceSnapshot, addTranscript, correctTranscript, proposeSection, approveReview } from '../../../lib/oracle/authoring/workflow';
import { AuthoringStore } from '../../../lib/oracle/authoring/storage';
import { exportBundle, importBundle } from '../../../lib/oracle/authoring/transfer';

async function setup() {
  const store = new AuthoringStore(`test-${crypto.randomUUID()}`);
  const s = createSession(await sourceSnapshot(1, 'r1', 'words', [{ id: 'CODE', title: 'Code', start: 0, end: 5 }]));
  s.captures.push({ id: 'clip', recordedAt: s.createdAt, mimeType: 'audio/webm', durationMs: 3000, status: 'interrupted', origin: 'microphone' });
  await store.save(s, 0);
  await store.appendChunk(s.id, 'clip', 0, new Blob(['first'], { type: 'audio/webm' }), 1000);
  return { store, s };
}
describe('durable authoring', () => {
  it('recovers received chunks and prevents concurrent tabs overwriting each other', async () => {
    const { store, s } = await setup();
    await store.appendChunk(s.id, 'clip', 1, new Blob(['second']), 3000);
    expect(await (await store.audio(s.id, 'clip')).text()).toBe('firstsecond');
    const loaded = await store.load(s.id);
    expect(loaded?.session.captures[0].durationMs).toBe(3000);
    await store.save({ ...loaded!.session, markers: [{ captureId: 'clip', atMs: 500, sectionId: null }] }, loaded!.version);
    await expect(store.save(s, loaded!.version)).rejects.toThrow(/another/i);
    expect((await store.list()).map(s => s.session.id)).toEqual([s.id]);
  });
  it('rejects edits to original transcript and atomically keeps approved receipts', async () => {
    const { store, s } = await setup();
    let review = addTranscript(s, 'clip', [{ text: 'raw', startMs: 0, endMs: 3000, timing: 'manual', sectionId: 'CODE' }], 'manual');
    let version = await store.save(review, (await store.load(s.id))!.version);
    await expect(store.save({ ...review, transcript: review.transcript.map(t => ({ ...t, raw: 'invented' })) }, version)).rejects.toThrow(/original/i);
    review = correctTranscript(review, review.transcript[0].id, { sectionId: 'CODE' });
    review = proposeSection(review, { sectionId: 'CODE', text: 'new words', evidenceIds: [review.transcript[0].id], author: { kind: 'manual' }, feedback: { changes: 'clarified', uncertainWords: '', omissions: '', contradictions: '', unsupportedAdditions: '' } });
    review = await approveReview(review, review.source, 'Adrian', true);
    version = await store.save(review, version);
    expect(await store.receipts(s.id)).toEqual([expect.objectContaining({ markdown: expect.stringContaining('new words') })]);
    review = correctTranscript(review, review.transcript[0].id, { corrected: 'later' });
    await store.save(review, version);
    expect((await store.receipts(s.id))[0].markdown).not.toContain('later');
  });
  it('moves original audio and review to a new device without overwriting a local session', async () => {
    const { store, s } = await setup();
    const bundle = await exportBundle(store, s.id);
    const other = new AuthoringStore(`other-${crypto.randomUUID()}`);
    const imported = await importBundle(other, bundle);
    expect(imported.session.id).not.toBe(s.id);
    expect(imported.session.reflectionSessionId).toBe(s.id);
    expect(imported.session.approvals).toEqual([]);
    expect(await (await other.audio(imported.session.id, 'clip')).text()).toBe('first');
    const broken = JSON.parse(bundle); broken.session.source.markdown = 'altered';
    await expect(importBundle(other, JSON.stringify(broken))).rejects.toThrow(/hash/i);
    const audioBroken = JSON.parse(bundle); audioBroken.audio[0].base64 = btoa('changed');
    await expect(importBundle(other, JSON.stringify(audioBroken))).rejects.toThrow(/hash/i);
  });
});
