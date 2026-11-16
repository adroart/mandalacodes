import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Guard = typeof import('../../../src/mobile/authoring/nativeRecordingGuard');

class FakeSentinel {
  released = false;
  release = vi.fn(async () => { this.released = true; });
}

function fakeDocument() {
  const target = new EventTarget() as EventTarget & { visibilityState: 'visible' | 'hidden' };
  target.visibilityState = 'visible';
  return target;
}

function fakeWakeLock() {
  const sentinels: FakeSentinel[] = [];
  const request = vi.fn(async (_type: 'screen') => { const lock = new FakeSentinel(); sentinels.push(lock); return lock; });
  return { api: { request }, request, sentinels };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

async function loadGuard(): Promise<Guard> {
  vi.resetModules();
  return import('../../../src/mobile/authoring/nativeRecordingGuard');
}

beforeEach(() => { vi.unstubAllGlobals(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('native recording guard', () => {
  it('posts to the native handler and prefers it over the wake lock', async () => {
    const postMessage = vi.fn();
    const lock = fakeWakeLock();
    vi.stubGlobal('window', Object.assign(new EventTarget(), { webkit: { messageHandlers: { oracleRecording: { postMessage } } } }));
    vi.stubGlobal('document', fakeDocument());
    vi.stubGlobal('navigator', { wakeLock: lock.api });
    const guard = await loadGuard();
    guard.setRecordingActive(true);
    guard.setRecordingActive(false);
    await flush();
    expect(postMessage.mock.calls).toEqual([[{ active: true }], [{ active: false }]]);
    expect(lock.request).not.toHaveBeenCalled();
  });

  it('tells native the take ended when the page unloads mid-take', async () => {
    const postMessage = vi.fn();
    const win = Object.assign(new EventTarget(), { webkit: { messageHandlers: { oracleRecording: { postMessage } } } });
    vi.stubGlobal('window', win);
    const guard = await loadGuard();
    guard.setRecordingActive(true);
    win.dispatchEvent(new Event('pagehide'));
    win.dispatchEvent(new Event('pagehide'));
    expect(postMessage.mock.calls).toEqual([[{ active: true }], [{ active: false }]]);
  });

  it('falls back to the screen wake lock and releases it on false', async () => {
    const lock = fakeWakeLock();
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('document', fakeDocument());
    vi.stubGlobal('navigator', { wakeLock: lock.api });
    const guard = await loadGuard();
    guard.setRecordingActive(true);
    await flush();
    expect(lock.request).toHaveBeenCalledWith('screen');
    guard.setRecordingActive(true);
    await flush();
    expect(lock.request).toHaveBeenCalledTimes(1);
    guard.setRecordingActive(false);
    await flush();
    expect(lock.sentinels[0].release).toHaveBeenCalledTimes(1);
  });

  it('releases a lock that arrives after recording already stopped', async () => {
    const lock = fakeWakeLock();
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('document', fakeDocument());
    vi.stubGlobal('navigator', { wakeLock: lock.api });
    const guard = await loadGuard();
    guard.setRecordingActive(true);
    guard.setRecordingActive(false);
    await flush();
    expect(lock.sentinels[0].release).toHaveBeenCalledTimes(1);
  });

  it('re-acquires the lock when the page becomes visible again while recording', async () => {
    const lock = fakeWakeLock();
    const doc = fakeDocument();
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('document', doc);
    vi.stubGlobal('navigator', { wakeLock: lock.api });
    const guard = await loadGuard();
    guard.setRecordingActive(true);
    await flush();
    // The browser drops the lock when the page is hidden.
    doc.visibilityState = 'hidden';
    lock.sentinels[0].released = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(lock.request).toHaveBeenCalledTimes(1);
    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(lock.request).toHaveBeenCalledTimes(2);
    guard.setRecordingActive(false);
    doc.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(lock.request).toHaveBeenCalledTimes(2);
    expect(lock.sentinels[1].release).toHaveBeenCalledTimes(1);
  });

  it('survives a refused wake lock request', async () => {
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('document', fakeDocument());
    vi.stubGlobal('navigator', { wakeLock: { request: vi.fn(async () => { throw new Error('NotAllowedError'); }) } });
    const guard = await loadGuard();
    expect(() => guard.setRecordingActive(true)).not.toThrow();
    await flush();
    expect(() => guard.setRecordingActive(false)).not.toThrow();
  });

  it('does nothing where neither the native handler nor the wake lock exists', async () => {
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('document', fakeDocument());
    vi.stubGlobal('navigator', {});
    const guard = await loadGuard();
    expect(() => { guard.setRecordingActive(true); guard.setRecordingActive(false); }).not.toThrow();
  });

  it('imports and runs with no window at all', async () => {
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('document', undefined);
    vi.stubGlobal('navigator', undefined);
    const guard = await loadGuard();
    expect(() => guard.setRecordingActive(true)).not.toThrow();
    const unsubscribe = guard.onNativeRecordingEvent(() => undefined);
    expect(() => unsubscribe()).not.toThrow();
    guard.setRecordingActive(false);
  });

  it('delivers native events until unsubscribed and ignores malformed ones', async () => {
    const win = new EventTarget();
    vi.stubGlobal('window', win);
    const guard = await loadGuard();
    const seen: unknown[] = [];
    const unsubscribe = guard.onNativeRecordingEvent(event => seen.push(event));
    const send = (detail: unknown) => win.dispatchEvent(new CustomEvent(guard.NATIVE_RECORDING_EVENT, { detail }));
    send({ kind: 'interruption-began' });
    send({ kind: 'interruption-ended', shouldResume: true });
    send({ kind: 'route-changed', reason: 'old-device-unavailable' });
    send({ kind: 'inactive' });
    send({ kind: 'active' });
    send({ kind: 'something-else' });
    send(null);
    unsubscribe();
    send({ kind: 'interruption-began' });
    expect(seen).toEqual([
      { kind: 'interruption-began' },
      { kind: 'interruption-ended', shouldResume: true },
      { kind: 'route-changed', reason: 'old-device-unavailable' },
      { kind: 'inactive' },
      { kind: 'active' },
    ]);
  });
});
