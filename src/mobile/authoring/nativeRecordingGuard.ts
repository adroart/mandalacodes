/**
 * Keeps the screen awake while a take is recording and reports when the phone
 * takes the microphone away. In the iOS app the native "oracleRecording" handler
 * holds the idle timer and observes the audio session; in a browser the Screen
 * Wake Lock API holds the screen; elsewhere nothing happens.
 * Nothing touches window, document or navigator until a function is called.
 */

export const NATIVE_RECORDING_EVENT = 'oracle-recording-native';

export type NativeRecordingEventKind = 'interruption-began' | 'interruption-ended' | 'route-changed' | 'inactive' | 'active';

export interface NativeRecordingEvent {
  kind: NativeRecordingEventKind;
  shouldResume?: boolean;
  reason?: string;
}

const KINDS: readonly string[] = ['interruption-began', 'interruption-ended', 'route-changed', 'inactive', 'active'];

type RecordingHandler = { postMessage(value: unknown): void };
type WakeLockSentinelLike = { released?: boolean; release(): Promise<void> };
type WakeLockLike = { request(type: 'screen'): Promise<WakeLockSentinelLike> };

let active = false;
let sentinel: WakeLockSentinelLike | null = null;
let requesting = false;
let watchingVisibility = false;
let watchingPageHide = false;

function nativeHandler(): RecordingHandler | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { webkit?: { messageHandlers?: { oracleRecording?: RecordingHandler } } }).webkit?.messageHandlers?.oracleRecording;
}

function wakeLockApi(): WakeLockLike | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as unknown as { wakeLock?: WakeLockLike }).wakeLock;
}

function postNative(handler: RecordingHandler, value: boolean): void {
  try { handler.postMessage({ active: value }); } catch { /* the guard is a convenience, never a reason to stop a take */ }
}

/** A page that unloads mid-take cannot say it stopped; tell native on the way out. */
function onPageHide(): void {
  const handler = nativeHandler();
  active = false;
  watchPageHide(false);
  if (handler) postNative(handler, false);
}

function watchPageHide(on: boolean): void {
  if (typeof window === 'undefined' || on === watchingPageHide) return;
  watchingPageHide = on;
  if (on) window.addEventListener('pagehide', onPageHide);
  else window.removeEventListener('pagehide', onPageHide);
}

async function acquireWakeLock(): Promise<void> {
  const api = wakeLockApi();
  if (!api || requesting || (sentinel && sentinel.released !== true)) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  requesting = true;
  try {
    const lock = await api.request('screen');
    if (!active || (sentinel && sentinel.released !== true)) { void lock.release().catch(() => undefined); return; }
    sentinel = lock;
  } catch {
    // Refused (low battery, hidden page, policy): the take goes on without it.
  } finally {
    requesting = false;
  }
}

function releaseWakeLock(): void {
  const lock = sentinel;
  sentinel = null;
  if (lock && lock.released !== true) void lock.release().catch(() => undefined);
}

/** The browser drops the lock whenever the page is hidden; take it back on return. */
function onVisibilityChange(): void {
  if (active && typeof document !== 'undefined' && document.visibilityState === 'visible') void acquireWakeLock();
}

function watchVisibility(on: boolean): void {
  if (typeof document === 'undefined' || on === watchingVisibility) return;
  watchingVisibility = on;
  if (on) document.addEventListener('visibilitychange', onVisibilityChange);
  else document.removeEventListener('visibilitychange', onVisibilityChange);
}

/** Call with true when a take starts recording and false whenever it stops, for any reason. */
export function setRecordingActive(next: boolean): void {
  active = next;
  const handler = nativeHandler();
  if (handler) {
    watchPageHide(next);
    postNative(handler, next);
    return;
  }
  if (!wakeLockApi()) return;
  watchVisibility(next);
  if (next) void acquireWakeLock();
  else releaseWakeLock();
}

/** Listen for the native app's microphone events. Returns the unsubscribe function. */
export function onNativeRecordingEvent(listener: (event: NativeRecordingEvent) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handle = (event: Event) => {
    const detail = (event as CustomEvent).detail as Record<string, unknown> | null | undefined;
    if (!detail || typeof detail.kind !== 'string' || !KINDS.includes(detail.kind)) return;
    const result: NativeRecordingEvent = { kind: detail.kind as NativeRecordingEventKind };
    if (typeof detail.shouldResume === 'boolean') result.shouldResume = detail.shouldResume;
    if (typeof detail.reason === 'string') result.reason = detail.reason;
    listener(result);
  };
  window.addEventListener(NATIVE_RECORDING_EVENT, handle);
  return () => window.removeEventListener(NATIVE_RECORDING_EVENT, handle);
}
