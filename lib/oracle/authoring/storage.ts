import { validatePassageToolsState } from './passageTools';
import type { AuthoringSession, StoredAudioChunk } from './types';
import { editorialReceipt, reviewDigest, sessionSources, sourceSnapshot, transcriptCard, validateTranscriptParent } from './workflow';
export interface SavedSession { session: AuthoringSession; version: number }
export interface StoredReceipt { id: string; sessionId: string; markdown: string; digest: string }
const MAX_BYTES = 10 * 1024 * 1024;
// WebKit can reject Blob/File persistence while accepting their identical bytes.
// Keep old Blob records readable; reconstruct the existing public Blob interface.
type AudioRecord = Omit<StoredAudioChunk, 'blob'> & { blob?: Blob; bytes?: ArrayBuffer; mimeType?: string };
const audioSize = (chunk: AudioRecord) => chunk.blob?.size ?? chunk.bytes?.byteLength ?? 0;
function audioChunk(record: AudioRecord): StoredAudioChunk {
  const { bytes, mimeType, ...rest } = record;
  if (record.blob) return { ...rest, blob: record.blob };
  if (!(bytes instanceof ArrayBuffer)) throw new Error('The saved audio chunk could not be read. Keep a copy of this session.');
  return { ...rest, blob: new Blob([bytes], { type: mimeType ?? '' }) };
}
async function audioRecord(chunk: StoredAudioChunk): Promise<AudioRecord> {
  const { blob, ...rest } = chunk;
  return { ...rest, bytes: await blob.arrayBuffer(), mimeType: blob.type };
}


/** Separate database from personal reflections and published listening assets. No deletion API. */
export class AuthoringStore {
  constructor(private readonly name = 'oracle-authoring-v1') {}
  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.name, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('sessions', { keyPath: 'session.id' });
        const chunks = req.result.createObjectStore('chunks', { keyPath: 'key' });
        chunks.createIndex('sessionId', 'sessionId');
        const receipts = req.result.createObjectStore('receipts', { keyPath: 'id' });
        receipts.createIndex('sessionId', 'sessionId');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Cannot open local authoring storage'));
    });
  }
  private async tx<T>(names: string[], mode: IDBTransactionMode, run: (stores: Record<string, IDBObjectStore>, done: (value: T) => void, fail: (error: Error) => void) => void): Promise<T> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(names, mode);
      let value: T; let failure: Error | undefined;
      const fail = (e: Error) => { failure = e; tx.abort(); };
      tx.oncomplete = () => { db.close(); resolve(value); };
      tx.onerror = event => { const request = event.target as IDBRequest; failure ??= request.error ?? tx.error ?? undefined; };
      tx.onabort = () => { db.close(); reject(failure ?? tx.error ?? new Error('Local save failed; keep this page open and export your work')); };
      try { run(Object.fromEntries(names.map(n => [n, tx.objectStore(n)])), v => { value = v; }, fail); } catch (e) { fail(e as Error); }
    });
  }
  load(id: string): Promise<SavedSession | undefined> {
    return this.tx(['sessions'], 'readonly', (s, done) => { const r = s.sessions.get(id); r.onsuccess = () => done(r.result); });
  }
  list(): Promise<SavedSession[]> {
    return this.tx(['sessions'], 'readonly', (s, done) => { const r = s.sessions.getAll(); r.onsuccess = () => done(r.result.sort((a: SavedSession, b: SavedSession) => b.session.createdAt.localeCompare(a.session.createdAt))); });
  }
  async save(session: AuthoringSession, expectedVersion: number): Promise<number> {
    validatePassageToolsState(session);
    const sources = sessionSources(session);
    for (const source of sources) {
      const checked = await sourceSnapshot(source.cardNumber, source.revision, source.markdown, source.sections);
      if (checked.hash !== source.hash) throw new Error('Original source hash mismatch');
    }
    for (const t of session.transcript) {
      if (!sources.some(s => s.cardNumber === transcriptCard(session, t))) throw new Error('Original source snapshot is required for every transcript card');
      validateTranscriptParent(session, t);
    }
    // Compute outside the IDB transaction: awaiting crypto inside it would close the transaction.
    const digest = await reviewDigest(session);
    const receipt = editorialReceipt(session);
    return this.tx(['sessions', 'receipts'], 'readwrite', (s, done, fail) => {
      const req = s.sessions.get(session.id);
      req.onsuccess = () => {
        const existing = req.result as SavedSession | undefined;
        if ((existing?.version ?? 0) !== expectedVersion) return fail(new Error('Another tab changed this session. Reopen it before editing.'));
        if (existing && JSON.stringify(existing.session.source) !== JSON.stringify(session.source)) return fail(new Error('Original source snapshot is immutable'));
        if (existing && (existing.session.relatedSources ?? []).some(source => !session.relatedSources?.some(next => JSON.stringify(source) === JSON.stringify(next)))) return fail(new Error('Original related source snapshots are immutable'));
        if (existing && existing.session.transcript.some(t => {
          const next = session.transcript.find(n => n.id === t.id);
          return !next || JSON.stringify(next.words) !== JSON.stringify(t.words) || next.speaker !== t.speaker || ['raw', 'captureId', 'startMs', 'endMs', 'timing', 'provider', 'receivedAt', 'parentId'].some(k => next[k as keyof typeof next] !== t[k as keyof typeof t]);
        })) return fail(new Error('Original transcript and timestamps are immutable'));
        if (existing && existing.session.approvals.some(a => !session.approvals.some(n => JSON.stringify(a) === JSON.stringify(n)))) return fail(new Error('Original approvals are immutable'));
        for (const approval of session.approvals) {
          if (existing?.session.approvals.some(a => a.id === approval.id)) continue;
          if (approval.digest !== digest) return fail(new Error('Approval does not match this review'));
          s.receipts.add({ id: approval.id, sessionId: session.id, markdown: receipt, digest } satisfies StoredReceipt);
        }
        const version = expectedVersion + 1;
        s.sessions.put({ session, version }); done(version);
      };
    });
  }
  async appendChunk(sessionId: string, captureId: string, index: number, blob: Blob, endMs: number): Promise<void> {
    if (blob.size > MAX_BYTES) throw new Error('Recording reached 10 MiB. Received chunks remain on this device.');
    const encoded = await audioRecord({ key: `${sessionId}/${captureId}/${index}`, sessionId, captureId, index, blob, endMs });
    return this.tx(['sessions', 'chunks'], 'readwrite', (s, done, fail) => {
      const r = s.sessions.get(sessionId);
      const chunks = s.chunks.index('sessionId').getAll(sessionId);
      let ready = 0;
      const finish = () => {
        if (++ready !== 2) return;
        const saved = r.result as SavedSession | undefined;
        const capture = saved?.session.captures.find(c => c.id === captureId);
        if (!saved || !capture) return fail(new Error('Recording session not found'));
        const existing = (chunks.result as AudioRecord[]).filter(c => c.captureId === captureId);
        if (existing.reduce((total, c) => total + audioSize(c), 0) + blob.size > MAX_BYTES) return fail(new Error('Recording reached 10 MiB. Received chunks remain on this device.'));
        s.chunks.add(encoded);
        capture.durationMs = Math.max(capture.durationMs, Math.round(endMs));
        s.sessions.put({ session: saved.session, version: saved.version + 1 }); done();
      };
      r.onsuccess = chunks.onsuccess = finish;
    });
  }
  async addImportedAudio(session: AuthoringSession, expectedVersion: number, captureId: string, blob: Blob, durationMs: number): Promise<SavedSession> {
    const encoded = await audioRecord({ key: `${session.id}/${captureId}/0`, sessionId: session.id, captureId, index: 0, blob, endMs: durationMs });
    return this.tx(['sessions', 'chunks'], 'readwrite', (s, done, fail) => {
      const r = s.sessions.get(session.id);
      r.onsuccess = () => {
        const existing = r.result as SavedSession | undefined;
        if (!existing || existing.version !== expectedVersion) return fail(new Error('Another tab changed this session. Reopen it before importing.'));
        if (JSON.stringify(existing.session.source) !== JSON.stringify(session.source) || JSON.stringify(existing.session.relatedSources ?? []) !== JSON.stringify(session.relatedSources ?? []) || JSON.stringify(existing.session.transcript) !== JSON.stringify(session.transcript) || JSON.stringify(existing.session.approvals) !== JSON.stringify(session.approvals)) return fail(new Error('Audio import cannot change original review evidence'));
        const saved = { session, version: expectedVersion + 1 };
        s.chunks.add(encoded);
        s.sessions.put(saved); done(saved);
      };
    });
  }
  chunks(sessionId: string): Promise<StoredAudioChunk[]> {
    return this.tx(['chunks'], 'readonly', (s, done, fail) => { const r = s.chunks.index('sessionId').getAll(sessionId); r.onsuccess = () => { try { done((r.result as AudioRecord[]).map(audioChunk)); } catch (e) { fail(e as Error); } }; });
  }
  async audio(sessionId: string, captureId: string): Promise<Blob> {
    const saved = await this.load(sessionId);
    const capture = saved?.session.captures.find(c => c.id === captureId);
    const chunks = (await this.chunks(sessionId)).filter(c => c.captureId === captureId).sort((a, b) => a.index - b.index);
    if (!capture || !chunks.length) throw new Error('No durable audio was received for this recording');
    return new Blob(chunks.map(c => c.blob), { type: capture.mimeType });
  }
  receipts(sessionId: string): Promise<StoredReceipt[]> {
    return this.tx(['receipts'], 'readonly', (s, done) => { const r = s.receipts.index('sessionId').getAll(sessionId); r.onsuccess = () => done(r.result); });
  }
  /** One transaction prevents a failed transfer from leaving an apparently usable partial import. */
  async importNew(session: AuthoringSession, chunks: StoredAudioChunk[], receipts: StoredReceipt[] = []): Promise<void> {
    const encoded = await Promise.all(chunks.map(audioRecord));
    return this.tx(['sessions', 'chunks', 'receipts'], 'readwrite', (s, done) => {
      s.sessions.add({ session, version: 1 }); encoded.forEach(c => s.chunks.add(c)); receipts.forEach(r => s.receipts.add(r)); done();
    });
  }
}
