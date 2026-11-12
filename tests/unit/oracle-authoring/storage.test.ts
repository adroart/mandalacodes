import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSession, sourceSnapshot, addTranscript, correctTranscript, proposeSection, approveReview } from '../../../lib/oracle/authoring/workflow';
import { AuthoringStore } from '../../../lib/oracle/authoring/storage';
import { editPassage, parkPassage, setPassageNote } from '../../../lib/oracle/authoring/passageTools';
import { exportBundle, importBundle } from '../../../lib/oracle/authoring/transfer';
import { recoverCapture } from '../../../lib/oracle/authoring/recorder';
import type { AuthoringSession } from '../../../lib/oracle/authoring/types';

async function setup() {
  const name = `test-${crypto.randomUUID()}`;
  const store = new AuthoringStore(name);
  const s = createSession(await sourceSnapshot(1, 'r1', 'words', [{ id: 'CODE', title: 'Code', start: 0, end: 5 }]));
  s.captures.push({ id: 'clip', recordedAt: s.createdAt, mimeType: 'audio/webm', durationMs: 3000, status: 'interrupted', origin: 'microphone' });
  await store.save(s, 0);
  await store.appendChunk(s.id, 'clip', 0, new Blob(['first'], { type: 'audio/webm' }), 1000);
  return { store, s, name };
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
    let named = addTranscript(s, 'clip', [{ text: 'raw words', startMs: 0, endMs: 1000, timing: 'manual', sectionId: 'CODE' }], 'manual');
    named = editPassage(named, named.transcript[0].id, 'corrected words');
    named = setPassageNote(named, named.transcript[0].id, 'Check the original source');
    named = { ...parkPassage(named, named.transcript[0].id), title: 'Named review' };
    await store.save(named, (await store.load(s.id))!.version);
    const bundle = await exportBundle(store, s.id);
    const other = new AuthoringStore(`other-${crypto.randomUUID()}`);
    const imported = await importBundle(other, bundle);
    expect(imported.session.id).not.toBe(s.id);
    expect(imported.session.reflectionSessionId).toBe(s.id);
    expect(imported.session.approvals).toEqual([]);
    expect(imported.session.title).toBe('Named review');
    expect(imported.session.transcriptHistory).toEqual(named.transcriptHistory);
    expect(imported.session.passageNotes).toEqual(named.passageNotes);
    expect(imported.session.parkedPassageIds).toEqual(named.parkedPassageIds);
    expect(await (await other.audio(imported.session.id, 'clip')).text()).toBe('first');
    const broken = JSON.parse(bundle); broken.session.source.markdown = 'altered';
    await expect(importBundle(other, JSON.stringify(broken))).rejects.toThrow(/hash/i);
    const audioBroken = JSON.parse(bundle); audioBroken.audio[0].base64 = btoa('changed');
    await expect(importBundle(other, JSON.stringify(audioBroken))).rejects.toThrow(/hash/i);
  });
  it('reads legacy Blob chunks beside new audio bytes without changing original audio', async()=>{
    const {store,s,name}=await setup();
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(name,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    await new Promise<void>((resolve,reject)=>{const tx=db.transaction('chunks','readwrite');tx.objectStore('chunks').put({key:`${s.id}/clip/0`,sessionId:s.id,captureId:'clip',index:0,blob:new Blob(['legacy'],{type:'audio/webm'}),endMs:1000});tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
    await store.appendChunk(s.id,'clip',1,new Blob(['received'],{type:'audio/webm'}),3000);
    expect(await(await store.audio(s.id,'clip')).text()).toBe('legacyreceived');
    expect(await(await store.chunks(s.id))[0].blob.text()).toBe('legacy');
    const other=new AuthoringStore(`mixed-${crypto.randomUUID()}`);const moved=await importBundle(other,await exportBundle(store,s.id));
    expect(await(await other.audio(moved.session.id,'clip')).text()).toBe('legacyreceived');
  });

});

const MB = 1024 * 1024;
const rawPut = (name: string, records: object[]) => new Promise<void>((resolve, reject) => {
  const request = indexedDB.open(name, 1);
  request.onerror = () => reject(request.error);
  request.onsuccess = () => { const db = request.result, tx = db.transaction('chunks', 'readwrite'); records.forEach(r => tx.objectStore('chunks').put(r)); tx.oncomplete = () => { db.close(); resolve(); }; tx.onabort = () => { db.close(); reject(tx.error); }; };
});
function withCaptures(s: AuthoringSession, ids: string[]) {
  return { ...s, captures: [...s.captures, ...ids.map(id => ({ id, recordedAt: s.createdAt, mimeType: 'audio/webm', durationMs: 0, status: 'recording' as const, origin: 'microphone' as const }))] };
}
describe('chunk writes on a long session', () => {
  afterEach(() => { vi.restoreAllMocks(); });
  it('appends without reading any saved audio, and keeps a running total on the capture', async () => {
    const { store, s } = await setup();
    await store.save(withCaptures(s, ['other', 'live']), (await store.load(s.id))!.version);
    for (let i = 0; i < 5; i++) await store.appendChunk(s.id, 'other', i, new Blob([new Uint8Array(1000)]), (i + 1) * 1000);
    await store.appendChunk(s.id, 'live', 0, new Blob(['ab']), 1000);
    const storeReads = vi.spyOn(IDBObjectStore.prototype, 'getAll'), indexReads = vi.spyOn(IDBIndex.prototype, 'getAll');
    const before = (await store.load(s.id))!.version;
    await store.appendChunk(s.id, 'live', 1, new Blob(['cde']), 2000);
    expect(storeReads).not.toHaveBeenCalled(); expect(indexReads).not.toHaveBeenCalled();
    const saved = (await store.load(s.id))!;
    expect(saved.version).toBe(before + 1);
    expect(saved.session.captures.find(c => c.id === 'live')).toMatchObject({ audioBytes: 5, durationMs: 2000 });
    expect(saved.session.captures.find(c => c.id === 'other')?.audioBytes).toBe(5000);
  });
  it('totals a capture saved before the running total once, from that capture only, then stores it', async () => {
    const { store, s, name } = await setup();
    await store.save(withCaptures(s, ['old', 'big']), (await store.load(s.id))!.version);
    await rawPut(name, [
      { key: `${s.id}/old/0`, sessionId: s.id, captureId: 'old', index: 0, blob: new Blob([new Uint8Array(4 * MB)]), endMs: 1000 },
      { key: `${s.id}/old/1`, sessionId: s.id, captureId: 'old', index: 1, bytes: new Uint8Array(5 * MB).buffer, mimeType: 'audio/webm', endMs: 2000 },
      { key: `${s.id}/big/0`, sessionId: s.id, captureId: 'big', index: 0, bytes: new Uint8Array(9 * MB).buffer, mimeType: 'audio/webm', endMs: 1000 },
    ]);
    const reads = vi.spyOn(IDBObjectStore.prototype, 'getAll');
    await expect(store.appendChunk(s.id, 'old', 2, new Blob([new Uint8Array(MB + 1)]), 3000)).rejects.toThrow(/10 megabytes/);
    expect(reads).toHaveBeenCalledTimes(1);
    expect(((await store.captureChunks(s.id, 'old')).length)).toBe(2);
    reads.mockClear();
    await store.appendChunk(s.id, 'old', 2, new Blob([new Uint8Array(MB)]), 3000);
    expect(reads).toHaveBeenCalledTimes(1);
    const range = reads.mock.calls[0][0] as IDBKeyRange;
    expect([range.includes(`${s.id}/old/0`), range.includes(`${s.id}/big/0`), range.includes(`${s.id}/clip/0`)]).toEqual([true, false, false]);
    expect((await store.load(s.id))!.session.captures.find(c => c.id === 'old')?.audioBytes).toBe(10 * MB);
    reads.mockClear();
    await expect(store.appendChunk(s.id, 'old', 3, new Blob(['x']), 4000)).rejects.toThrow(/10 megabytes/);
    expect(reads).not.toHaveBeenCalled();
  });
  it('enforces the cap with a stored total and leaves the session unchanged when it refuses', async () => {
    const { store, s } = await setup();
    await store.save(withCaptures(s, ['live']), (await store.load(s.id))!.version);
    await store.appendChunk(s.id, 'live', 0, new Blob([new Uint8Array(10 * MB - 1)]), 1000);
    const before = (await store.load(s.id))!;
    await expect(store.appendChunk(s.id, 'live', 1, new Blob(['xy']), 2000)).rejects.toThrow('10 megabytes');
    expect(await store.load(s.id)).toEqual(before);
    await store.appendChunk(s.id, 'live', 1, new Blob(['z']), 2000);
    expect((await store.audio(s.id, 'live')).size).toBe(10 * MB);
  });
  it('plays chunks back in numeric order past index 10, mixing Blob and byte records', async () => {
    const { store, s, name } = await setup();
    await store.save(withCaptures(s, ['long']), (await store.load(s.id))!.version);
    await rawPut(name, [0, 1, 2].map(index => ({ key: `${s.id}/long/${index}`, sessionId: s.id, captureId: 'long', index, blob: new Blob([`<${index}>`], { type: 'audio/webm' }), endMs: (index + 1) * 1000 })));
    for (let index = 3; index < 13; index++) await store.appendChunk(s.id, 'long', index, new Blob([`<${index}>`], { type: 'audio/webm' }), (index + 1) * 1000);
    const expected = Array.from({ length: 13 }, (_, i) => `<${i}>`).join('');
    expect(await (await store.audio(s.id, 'long')).text()).toBe(expected);
    expect((await store.captureChunks(s.id, 'long')).map(c => c.index)).toEqual(Array.from({ length: 13 }, (_, i) => i));
    expect((await store.load(s.id))!.session.captures.find(c => c.id === 'long')?.audioBytes).toBe(expected.length);
    expect(await (await store.audio(s.id, 'clip')).text()).toBe('first');
    const recovered = await recoverCapture(store, (await store.load(s.id))!, 'long');
    expect(recovered.session.captures.find(c => c.id === 'long')).toMatchObject({ status: 'interrupted', durationMs: 13_000 });
  });
});
