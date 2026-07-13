import type { SegmentMetadataInput } from '../../types/oracleReflection';

export interface PendingReflection extends SegmentMetadataInput {
  blob: Blob;
}

export type ReflectionDraft = Omit<PendingReflection, 'blob'>;
export interface ReflectionChunk { key: string; segmentId: string; index: number; blob: Blob; }

const DATABASE = 'mandalacodes-oracle-reflections';
const STORE = 'segments';
const DRAFTS = 'drafts';
const CHUNKS = 'chunks';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        const store = database.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('recordedAt', 'recordedAt');
      }
      if (!database.objectStoreNames.contains(DRAFTS)) database.createObjectStore(DRAFTS, { keyPath: 'id' });
      if (!database.objectStoreNames.contains(CHUNKS)) {
        const chunks = database.createObjectStore(CHUNKS, { keyPath: 'key' });
        chunks.createIndex('segmentId', 'segmentId');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Unable to open reflection outbox'));
  });
}

async function transact<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void): Promise<T> {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    let result: T;
    let hasResult = false;
    const succeed = (value: T) => { result = value; hasResult = true; };
    const fail = (reason?: unknown) => {
      database.close();
      reject(reason ?? transaction.error ?? new Error('Reflection outbox transaction failed'));
    };
    transaction.onerror = fail;
    transaction.onabort = fail;
    try {
      run(transaction.objectStore(STORE), succeed, fail);
    } catch (error) {
      fail(error);
    }
    transaction.oncomplete = () => {
      database.close();
      if (hasResult) resolve(result);
      else reject(new Error('Reflection outbox transaction completed without a result'));
    };
  });
}

async function transactStores<T>(names: string[], mode: IDBTransactionMode, run: (stores: Record<string, IDBObjectStore>, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void): Promise<T> {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(names, mode);
    let result: T;
    let hasResult = false;
    const succeed = (value: T) => { result = value; hasResult = true; };
    const fail = (reason?: unknown) => { database.close(); reject(reason ?? transaction.error ?? new Error('Reflection outbox transaction failed')); };
    transaction.onerror = fail;
    transaction.onabort = fail;
    const stores = Object.fromEntries(names.map((name) => [name, transaction.objectStore(name)]));
    try { run(stores, succeed, fail); } catch (error) { fail(error); }
    transaction.oncomplete = () => {
      database.close();
      if (hasResult) resolve(result);
      else reject(new Error('Reflection outbox transaction completed without a result'));
    };
  });
}

export function enqueueReflection(value: PendingReflection): Promise<void> {
  return transact('readwrite', (store, resolve, reject) => {
    const request = store.put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function listPendingReflections(): Promise<PendingReflection[]> {
  return transact('readonly', (store, resolve, reject) => {
    const request = store.index('recordedAt').getAll();
    request.onsuccess = () => resolve(request.result as PendingReflection[]);
    request.onerror = () => reject(request.error);
  });
}

export function removeReflection(id: string): Promise<void> {
  return transact('readwrite', (store, resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function clearReflectionOutbox(): Promise<void> {
  return transactStores([STORE, DRAFTS, CHUNKS], 'readwrite', (stores, resolve) => {
    stores[STORE].clear();
    stores[DRAFTS].clear();
    stores[CHUNKS].clear();
    resolve();
  });
}

export function beginReflectionDraft(value: ReflectionDraft): Promise<void> {
  return transactStores([DRAFTS], 'readwrite', (stores, resolve, reject) => {
    const request = stores[DRAFTS].put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function appendReflectionChunk(segmentId: string, index: number, blob: Blob, durationMs: number): Promise<void> {
  return transactStores([DRAFTS, CHUNKS], 'readwrite', (stores, resolve, reject) => {
    const request = stores[DRAFTS].get(segmentId);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const draft = request.result as ReflectionDraft | undefined;
      if (!draft) return reject(new Error('Reflection draft not found'));
      const chunk: ReflectionChunk = { key: `${segmentId}:${String(index).padStart(8, '0')}`, segmentId, index, blob };
      stores[CHUNKS].put(chunk);
      stores[DRAFTS].put({ ...draft, byteSize: draft.byteSize + blob.size, durationMs: Math.max(draft.durationMs, Math.round(durationMs)) });
      resolve();
    };
  });
}

export function listReflectionChunks(segmentId: string): Promise<ReflectionChunk[]> {
  return transactStores([CHUNKS], 'readonly', (stores, resolve, reject) => {
    const request = stores[CHUNKS].index('segmentId').getAll(segmentId);
    request.onsuccess = () => resolve((request.result as ReflectionChunk[]).sort((a, b) => a.index - b.index));
    request.onerror = () => reject(request.error);
  });
}

export function listReflectionDrafts(): Promise<ReflectionDraft[]> {
  return transactStores([DRAFTS], 'readonly', (stores, resolve, reject) => {
    const request = stores[DRAFTS].getAll();
    request.onsuccess = () => resolve(request.result as ReflectionDraft[]);
    request.onerror = () => reject(request.error);
  });
}

export function finalizeReflectionDraft(segmentId: string): Promise<PendingReflection> {
  return transactStores([STORE, DRAFTS, CHUNKS], 'readwrite', (stores, resolve, reject) => {
    const draftRequest = stores[DRAFTS].get(segmentId);
    const chunksRequest = stores[CHUNKS].index('segmentId').getAll(segmentId);
    const finalize = () => {
      if (draftRequest.readyState !== 'done' || chunksRequest.readyState !== 'done') return;
      const draft = draftRequest.result as ReflectionDraft | undefined;
      if (!draft) return reject(new Error('Reflection draft not found'));
      const chunks = (chunksRequest.result as ReflectionChunk[]).sort((a, b) => a.index - b.index);
      if (!chunks.length) return reject(new Error('Reflection draft has no audio chunks'));
      const blob = new Blob(chunks.map((chunk) => chunk.blob), { type: draft.mimeType });
      const pending: PendingReflection = { ...draft, durationMs: Math.max(1, draft.durationMs), byteSize: blob.size, blob };
      stores[STORE].put(pending);
      stores[DRAFTS].delete(segmentId);
      chunks.forEach((chunk) => stores[CHUNKS].delete(chunk.key));
      resolve(pending);
    };
    draftRequest.onsuccess = finalize;
    chunksRequest.onsuccess = finalize;
    draftRequest.onerror = () => reject(draftRequest.error);
    chunksRequest.onerror = () => reject(chunksRequest.error);
  });
}
