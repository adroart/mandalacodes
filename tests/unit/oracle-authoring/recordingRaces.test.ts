import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isCaptureLive, recoverCapture, startCapture, whenCaptureSettled } from '../../../lib/oracle/authoring/recorder';
import { AuthoringStore, type SavedSession } from '../../../lib/oracle/authoring/storage';
import { createSession, sourceSnapshot } from '../../../lib/oracle/authoring/workflow';

vi.mock('../../../src/mobile/authoring/nativeRecordingGuard', () => ({ setRecordingActive: () => undefined, onNativeRecordingEvent: () => () => undefined }));

class Track extends EventTarget { muted = false; enabled = true; readyState: MediaStreamTrackState = 'live'; stop = vi.fn(); }
class Recorder {
  static all: Recorder[] = [];
  static isTypeSupported = () => true;
  state: RecordingState = 'inactive'; mimeType = 'audio/webm';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null; onpause: (() => void) | null = null; onresume: (() => void) | null = null; onerror: (() => void) | null = null;
  constructor() { Recorder.all.push(this); }
  start = vi.fn(() => { this.state = 'recording'; });
  requestData = vi.fn();
  emit(text: string) { this.ondataavailable?.({ data: new Blob([text], { type: this.mimeType }) }); }
  pause = vi.fn(); resume = vi.fn();
  stop = vi.fn(() => { this.state = 'inactive'; this.emit('final'); this.onstop?.(); });
}
let now = 0, track: Track;
const stream = () => ({ getTracks: () => [track], getAudioTracks: () => [track] }) as unknown as MediaStream;
const idle = (ms = 5) => new Promise(resolve => setTimeout(resolve, ms));
beforeEach(() => {
  now = 0; track = new Track(); Recorder.all = [];
  vi.stubGlobal('MediaRecorder', Recorder);
  vi.stubGlobal('window', { setTimeout, clearTimeout });
  vi.stubGlobal('document', new EventTarget());
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function setup() {
  const store = new AuthoringStore(`races-${crypto.randomUUID()}`);
  const session = createSession(await sourceSnapshot(1, 'r1', 'words', [{ id: 'CODE', title: 'Code', start: 0, end: 5 }]));
  await store.save(session, 0);
  const options = { stream: stream(), retainStream: true };
  const failure = vi.fn();
  const first = await startCapture(store, (await store.load(session.id))!, 'CODE', failure, 1, options);
  const second = await startCapture(store, (await store.load(session.id))!, 'CODE', failure, 1, options);
  const [a, b] = Recorder.all;
  now = 1000; a.emit('a1'); b.emit('b1'); await idle();
  return { store, id: session.id, first, second, a, b, failure };
}
/** Every read lands a chunk from the other take right after it, the interleaving that broke read-then-save writes. */
function chunkAfterEveryLoad(store: AuthoringStore, sessionId: string, captureId: string, times = Infinity) {
  const load = store.load.bind(store);
  let index = 10, left = times;
  vi.spyOn(store, 'load').mockImplementation(async id => {
    const value = await load(id);
    if (left-- > 0) await store.appendChunk(sessionId, captureId, index++, new Blob(['other']), 1000 + index);
    return value;
  });
}

describe('saves that race the other take', () => {
  it('closes a take while the other take of the session appends chunks', async () => {
    const { store, id, first, second, b, failure } = await setup();
    chunkAfterEveryLoad(store, id, second.captureId);
    const put = store.putCapture.bind(store);
    vi.spyOn(store, 'putCapture').mockImplementationOnce(async (...args) => { await store.appendChunk(id, second.captureId, 50, new Blob(['between']), 1500); return put(...args); });
    now = 2000;
    const closing = first.stop();
    b.emit('b2'); b.emit('b3');
    const saved = await closing;
    await idle();
    expect(failure).not.toHaveBeenCalled();
    const latest = (await store.load(id))!;
    expect(saved.session.captures.find(c => c.id === first.captureId)?.status).toBe('ready');
    expect(latest.session.captures.find(c => c.id === first.captureId)).toMatchObject({ status: 'ready', durationMs: 2000 });
    expect(latest.session.captures.find(c => c.id === second.captureId)?.status).toBe('recording');
    expect((await store.captureChunks(id, second.captureId)).length).toBeGreaterThanOrEqual(4);
    expect(await (await store.audio(id, first.captureId)).text()).toBe('a1final');
    await second.stop();
  });
  it('closes a take through re-read and retry on a store without the one-step write', async () => {
    const { store, id, first, second } = await setup();
    const plain = new Proxy(store, { get: (target, key) => key === 'putCapture' ? undefined : (Reflect.get(target, key) as unknown as { bind?: (t: unknown) => unknown })?.bind?.(target) ?? Reflect.get(target, key) }) as AuthoringStore;
    const failure = vi.fn();
    const own = await startCapture(plain, (await store.load(id))!, 'CODE', failure, 1, { stream: stream(), retainStream: true });
    now = 1500; Recorder.all[2].emit('c1'); await idle();
    chunkAfterEveryLoad(store, id, second.captureId, 2);
    now = 2000;
    const saved = await own.stop();
    expect(failure).not.toHaveBeenCalled();
    expect(saved.session.captures.find(c => c.id === own.captureId)?.status).toBe('ready');
    await first.stop(); await second.stop();
  });
  it('saves a section mark while the other take appends chunks', async () => {
    const { store, id, first, second, failure } = await setup();
    chunkAfterEveryLoad(store, id, second.captureId);
    now = 1500; first.mark('ICHING');
    now = 2000; await first.stop();
    expect(failure).not.toHaveBeenCalled();
    const latest = (await store.load(id))!;
    expect(latest.session.markers.filter(m => m.captureId === first.captureId).map(m => [m.atMs, m.sectionId])).toEqual([[0, 'CODE'], [1500, 'ICHING']]);
    await second.stop();
  });
  it('leaves a take whose closing save keeps failing for recovery, and reports the failure', async () => {
    const { store, id, first, second } = await setup();
    const put = vi.spyOn(store, 'putCapture').mockRejectedValue(new Error('Disk full'));
    now = 2000;
    await expect(first.stop()).rejects.toThrow('Disk full');
    expect(put.mock.calls.length).toBeGreaterThan(1);
    expect(isCaptureLive(first.captureId)).toBe(false);
    const stranded = (await store.load(id))!;
    expect(stranded.session.captures.find(c => c.id === first.captureId)?.status).toBe('recording');
    put.mockRestore();
    const recovered = await recoverCapture(store, stranded, first.captureId);
    expect(recovered.session.captures.find(c => c.id === first.captureId)).toMatchObject({ status: 'interrupted', durationMs: 2000 });
    await second.stop();
  });
});

describe('recovery never closes a take still live in this page', () => {
  it('waits for a draining take and returns it closed by itself, with its final chunk', async () => {
    const { store, id, first, second } = await setup();
    const before: SavedSession = (await store.load(id))!;
    expect(isCaptureLive(first.captureId)).toBe(true);
    now = 2000;
    void first.stop();
    let returned = false;
    const recovering = recoverCapture(store, before, first.captureId).then(value => { returned = true; return value; });
    expect(isCaptureLive(first.captureId)).toBe(true);
    await whenCaptureSettled(first.captureId);
    const result = await recovering;
    expect(returned).toBe(true);
    expect(isCaptureLive(first.captureId)).toBe(false);
    expect(result.session.captures.find(c => c.id === first.captureId)).toMatchObject({ status: 'ready', durationMs: 2000 });
    expect(await (await store.audio(id, first.captureId)).text()).toBe('a1final');
    await second.stop();
  });
  it('waits for a take still recording until it stops', async () => {
    const { store, id, first, second } = await setup();
    let returned = false;
    const recovering = recoverCapture(store, (await store.load(id))!, first.captureId).then(value => { returned = true; return value; });
    await idle(20);
    expect(returned).toBe(false);
    expect((await store.load(id))!.session.captures.find(c => c.id === first.captureId)?.status).toBe('recording');
    now = 2000; await first.stop();
    expect((await recovering).session.captures.find(c => c.id === first.captureId)?.status).toBe('ready');
    await second.stop();
  });
});
