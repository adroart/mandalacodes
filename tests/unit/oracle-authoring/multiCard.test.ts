import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { addTranscript, approveReview, approvedManuscripts, approvedMarkdown, correctTranscript, createSession, editorialReceipt, proposeSection, sourceSnapshot, sha256 } from '../../../lib/oracle/authoring/workflow';
import { AuthoringStore } from '../../../lib/oracle/authoring/storage';
import { exportBundle, importBundle } from '../../../lib/oracle/authoring/transfer';
const feedback = { changes: 'Preserved the spoken intent.', uncertainWords: '', omissions: '', contradictions: '', unsupportedAdditions: '' };
async function fixture() {
  const one = await sourceSnapshot(1, 'one-r1', 'One code.\nOne body.', [{ id: 'CODE', title: 'Code', start: 0, end: 9 }, { id: 'BODY', title: 'Body', start: 10, end: 19 }]);
  const two = await sourceSnapshot(2, 'two-r1', 'Two code.\nTwo body.', [{ id: 'CODE', title: 'Code', start: 0, end: 9 }, { id: 'BODY', title: 'Body', start: 10, end: 19 }]);
  let s = createSession(one); s.relatedSources = [two];
  s.captures.push({ id: 'clip', recordedAt: s.createdAt, mimeType: 'audio/webm', durationMs: 3000, status: 'ready', origin: 'import' });
  s = addTranscript(s, 'clip', [{ text: 'Card one words. Card two words.', startMs: 0, endMs: 3000, timing: 'recording', sectionId: null }], 'fixture');
  const parentId = s.transcript[0].id;
  s = correctTranscript(s, parentId, { referenceOnly: true });
  s = addTranscript(s, 'clip', [{ text: 'Card one words.', startMs: 0, endMs: 3000, timing: 'recording', sectionId: 'CODE', cardNumber: 1, parentId, order: 0 }, { text: 'Card two words.', startMs: 0, endMs: 3000, timing: 'recording', sectionId: 'CODE', cardNumber: 2, parentId, order: 1 }], 'fixture');
  for (const t of s.transcript.filter(t => !t.referenceOnly)) s = correctTranscript(s, t.id, { cardNumber: t.cardNumber, sectionId: 'CODE' });
  for (const t of s.transcript.filter(t => !t.referenceOnly)) s = proposeSection(s, { cardNumber: t.cardNumber, sectionId: 'CODE', text: `Revised ${t.cardNumber}.`, evidenceIds: [t.id], author: { kind: 'manual' }, feedback });
  return { s, one, two, parentId };
}
describe('multi-card authoring', () => {
  it('keeps identical section names separate and leaves undiscussed text intact', async () => {
    const { s, one, two } = await fixture();
    expect(s.proposals).toHaveLength(2);
    const approved = await approveReview(s, [one, two], 'Adrian', true);
    expect(await approvedManuscripts(approved, [one, two])).toEqual([{ cardNumber: 1, markdown: 'Revised 1.\nOne body.' }, { cardNumber: 2, markdown: 'Revised 2.\nTwo body.' }]);
    await expect(approvedMarkdown(approved, one)).rejects.toThrow(/every|all|sources/i);
    expect(await approvedMarkdown(approved, [one, two], 2)).toBe('Revised 2.\nTwo body.');
    expect(editorialReceipt(approved)).toContain('Card: 2');
  });
  it('rejects a stale or missing secondary source and routing/order changes invalidate approval', async () => {
    const { s, one, two } = await fixture();
    await expect(approveReview(s, one, 'Adrian', true)).rejects.toThrow(/every|all|sources/i);
    await expect(approveReview(s, [one, { ...two, revision: 'changed' }], 'Adrian', true)).rejects.toThrow(/changed/i);
    const approved = await approveReview(s, [one, two], 'Adrian', true);
    const reordered = correctTranscript(approved, approved.transcript[1].id, { order: 4 });
    await expect(approvedManuscripts(reordered, [one, two])).rejects.toThrow(/approval/i);
    expect(() => correctTranscript(s, s.transcript[1].id, { cardNumber: 64 })).toThrow(/source/i);
    expect(() => proposeSection(s, { ...s.proposals[0], cardNumber: 2 })).toThrow(/evidence/i);
  });
  it('preserves full raw parents and requires real parent relationships', async () => {
    const { s, parentId } = await fixture();
    expect(s.transcript.find(t => t.id === parentId)?.raw).toBe('Card one words. Card two words.');
    expect(() => addTranscript(s, 'clip', [{ text: 'wrong', startMs: 0, endMs: 3000, timing: 'recording', sectionId: 'CODE', cardNumber: 2, parentId: 'missing' }], 'fixture')).toThrow(/parent/i);
    const store = new AuthoringStore(`multi-${crypto.randomUUID()}`);
    const version = await store.save(s, 0);
    await expect(store.save({ ...s, transcript: s.transcript.map(t => t.id === s.transcript[1].id ? { ...t, parentId: 'changed' } : t) }, version)).rejects.toThrow(/original|parent/i);
    await expect(store.save({ ...s, relatedSources: [] }, version)).rejects.toThrow(/source/i);
  });
  it('transfers all source snapshots, routing and parent/order metadata with original audio', async () => {
    const { s } = await fixture();
    const store = new AuthoringStore(`multi-export-${crypto.randomUUID()}`);
    await store.save(s, 0); await store.appendChunk(s.id, 'clip', 0, new Blob(['audio'], { type: 'audio/webm' }), 3000);
    const other = new AuthoringStore(`multi-import-${crypto.randomUUID()}`);
    const result = await importBundle(other, await exportBundle(store, s.id));
    expect(result.session.relatedSources?.[0].cardNumber).toBe(2);
    expect(result.session.transcript[2]).toMatchObject({ cardNumber: 2, order: 1, parentId: s.transcript[0].id });
    expect(result.session.proposals).toHaveLength(2);
    expect(await (await other.audio(result.session.id, 'clip')).text()).toBe('audio');
    const broken = JSON.parse(await exportBundle(store, s.id));
    broken.session.relatedSources[0].markdown = 'Bad code.\nBad body.';
    broken.reviewHash = await sha256(JSON.stringify(broken.session));
    await expect(importBundle(other, JSON.stringify(broken))).rejects.toThrow(/hash/i);
  });
});
