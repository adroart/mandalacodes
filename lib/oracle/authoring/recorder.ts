import { chooseRecorderMimeType } from '../../../utils/oracleReflection';
import type { AuthoringSession, Capture, SectionMarker } from './types';
import { AuthoringStore, type SavedSession } from './storage';
import { resumeAudioWhenVisible } from '../../../shared/voice/microphone';
import { onNativeRecordingEvent, setRecordingActive } from '../../../src/mobile/authoring/nativeRecordingGuard';

function microphoneError(error: unknown): Error {
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return new Error('Microphone access is blocked. Allow the microphone for this app in your browser or device settings, then try Record again. You can also import an audio recording.');
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return new Error('No microphone was found. Connect a microphone, then try Record again, or import an audio recording.');
  if (name === 'NotReadableError' || name === 'TrackStartError') return new Error('The microphone could not start. Close another app using it, check your microphone connection, then try Record again.');
  return error instanceof Error ? error : new Error('The microphone could not start. Check its connection and try Record again.');
}

const TAKE_LIMIT_MS = 20 * 60 * 1000, TIMESLICE_MS = 1000;
/** Speech bitrate: at 48 kbps a 19 minute take is about 7 megabytes, inside the 9 MiB byte ceiling. */
export const SPEECH_BITS_PER_SECOND = 48_000;
/**
 * Time between chunk arrivals beyond this is treated as a suspended page, not recorded audio.
 * Kept generous on purpose: a busy main thread can delay chunk delivery by a few seconds while
 * audio is still being captured, and a duration that is too SHORT makes the server drop the
 * words spoken after it. Too long is harmless below the take ceiling.
 */
export const ARRIVAL_GAP_MS = 10 * TIMESLICE_MS;
/** A meter level at or above this is real input, not a muted or silent microphone. */
export const REAL_INPUT_LEVEL = .025;

/** Why the microphone may be delivering silence: the track was muted (a call, Siri, the app
 * in the background), the phone took the audio session, or the input route changed. */
export interface CaptureInterruption { kind: 'muted' | 'interrupted' | 'route-changed'; since: number }

export interface CaptureOptions {
  /** A caller-owned stream enables rolling takes without repeated permissions. */
  stream?: MediaStream;
  retainStream?: boolean;
  maxDurationMs?: number;
  maxBytes?: number;
  onBoundary?: (reason: 'duration' | 'bytes') => void;
  /** Each delivered chunk, with the take's total bytes so far. */
  onChunk?: (bytes: number, totalBytes: number) => void;
  onInterruption?: (state: CaptureInterruption | null) => void;
  /** Prepare everything (capture record, meter) without starting the recorder; the handle's `go()` starts it
   * synchronously. A `go()` that throws leaves the take armed for one more try, then closes it. */
  armed?: boolean;
}

const SAVE_ATTEMPTS = 5;
/** Takes recording or still draining (final chunk, closing save) in this page. Recovery leaves these alone. */
const liveCaptures = new Map<string, Promise<void>>();
/** True while a take started in this page records or is still saving its last audio. */
export function isCaptureLive(captureId: string): boolean { return liveCaptures.has(captureId); }
/** Resolves once the take's closing save has settled, saved or failed; at once for a take not live here. */
export function whenCaptureSettled(captureId: string): Promise<void> { return liveCaptures.get(captureId) ?? Promise.resolve(); }
function registerLive(captureId: string): () => void {
  let settle!: () => void;
  liveCaptures.set(captureId, new Promise<void>(resolve => { settle = resolve; }));
  return () => { liveCaptures.delete(captureId); settle(); };
}

type CaptureChange = (capture: Capture | undefined, markers: SectionMarker[]) => { capture: Capture; markers: SectionMarker[] };
/** Changes one capture and its markers on the latest saved session, so another take's chunk writes cannot make it fail:
 * in one transaction where the store offers it, otherwise by re-reading and re-applying a few times. */
async function updateCapture(store: AuthoringStore, sessionId: string, captureId: string, change: CaptureChange): Promise<SavedSession> {
  let lastError: unknown = new Error('The recording could not be saved. Received audio remains on this device.');
  for (let attempt = 0; attempt < SAVE_ATTEMPTS; attempt++) {
    try {
      if (typeof store.putCapture === 'function') return await store.putCapture(sessionId, captureId, change);
      const latest = await store.load(sessionId);
      if (!latest) throw new Error('Recording session was not found');
      const own = latest.session.captures.find(c => c.id === captureId), next = change(own, latest.session.markers.filter(m => m.captureId === captureId));
      const session = { ...latest.session, captures: own ? latest.session.captures.map(c => c.id === captureId ? next.capture : c) : [...latest.session.captures, next.capture], markers: [...latest.session.markers.filter(m => m.captureId !== captureId), ...next.markers] };
      return { session, version: await store.save(session, latest.version) };
    } catch (error) {
      lastError = error;
      if (/not found/i.test(String(error))) break;
    }
  }
  throw lastError;
}

let awakeHolds = 0;
/** Keeps the screen awake while anything records; overlapping takes share one hold.
 * Returns the release, which is safe to call more than once. */
export function holdRecordingActive(): () => void {
  if (awakeHolds++ === 0) setRecordingActive(true);
  let held = true;
  return () => { if (!held) return; held = false; if (--awakeHolds === 0) setRecordingActive(false); };
}

/** Recording goes on through a mute or interruption so nothing is lost if the audio comes
 * back, but the state is reported so nobody counts on it. Cleared on unmute, on the end of
 * the interruption, or by clear() when real input arrives again. */
export function watchInterruptions(stream: MediaStream, onChange?: (state: CaptureInterruption | null) => void) {
  const tracks = stream.getAudioTracks();
  let muted = tracks.some(t => t.muted), interrupted = false, routed = false, state: CaptureInterruption | null = null;
  const update = () => {
    const kind = muted ? 'muted' : interrupted ? 'interrupted' : routed ? 'route-changed' : null;
    if ((state?.kind ?? null) === kind) return;
    state = kind ? { kind, since: Date.now() } : null; onChange?.(state);
  };
  const onMute = () => { muted = true; update(); };
  const onUnmute = () => { muted = tracks.some(t => t.muted); update(); };
  tracks.forEach(t => { t.addEventListener('mute', onMute); t.addEventListener('unmute', onUnmute); });
  let unsubscribe: () => void = () => undefined;
  // Native events are optional: a browser without them keeps the track events.
  try {
    unsubscribe = onNativeRecordingEvent(event => {
      if (event.kind === 'interruption-began' || event.kind === 'inactive') interrupted = true;
      else if (event.kind === 'route-changed') routed = true;
      else { interrupted = false; routed = false; }
      update();
    });
  } catch { /* No window events here. */ }
  update();
  return {
    current: () => state,
    clear: () => { interrupted = false; routed = false; muted = tracks.some(t => t.muted); update(); },
    stop: () => { tracks.forEach(t => { t.removeEventListener('mute', onMute); t.removeEventListener('unmute', onUnmute); }); unsubscribe(); },
  };
}

export async function acquireCaptureMicrophone(): Promise<MediaStream> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Microphone recording needs a supported browser and a secure connection. You can import audio instead.');
  try { return await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (error) { throw microphoneError(error); }
}

/** Saves delivered audio without rewriting or deleting it. Media time excludes pauses;
 * a browser/process crash may still lose the last undelivered timeslice. */
export async function startCapture(store: AuthoringStore, saved: SavedSession, sectionId: string | null, onFailure: (error: Error) => void, visibleCardNumber = saved.session.source.cardNumber, options: CaptureOptions = {}) {
  const stream = options.stream ?? await acquireCaptureMicrophone();
  const releaseStream = () => { if (!options.retainStream) stream.getTracks().forEach(t => t.stop()); };
  let recorder: MediaRecorder;
  try {
    const mimeType = chooseRecorderMimeType(t => MediaRecorder.isTypeSupported(t));
    // Some browsers reject the bitrate option; record without it rather than not at all.
    try { recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: SPEECH_BITS_PER_SECOND }); }
    catch { recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined); }
  } catch (error) { releaseStream(); throw microphoneError(error); }
  const capture: Capture = { id: crypto.randomUUID(), recordedAt: new Date().toISOString(), mimeType: recorder.mimeType || 'audio/webm', durationMs: 0, status: 'recording', origin: 'microphone', visibleCardNumber };
  let started = 0, index = 0, failed: Error | undefined, stopped = false, saveFailed = false;
  let pausedAt: number | null = null, pausedTotal = 0, finalElapsed: number | null = null;
  let queue = Promise.resolve();
  let receivedBytes = 0, boundaryReached = false;
  const ceilingMs = Math.max(1000, Math.min(options.maxDurationMs ?? TAKE_LIMIT_MS, TAKE_LIMIT_MS));
  // Recorded time follows delivered audio: pauses and any stretch beyond ARRIVAL_GAP_MS without a chunk
  // (a suspended page) do not count, and a take never reads longer than its ceiling.
  let lastArrival = 0, lostTotal = 0;
  const mediaClock = () => (pausedAt ?? performance.now()) - started - pausedTotal;
  const counted = (clock: number) => clock - lostTotal - Math.max(0, clock - lastArrival - ARRIVAL_GAP_MS);
  const elapsed = () => finalElapsed ?? Math.min(ceilingMs, Math.max(0, Math.round(counted(mediaClock()))));
  const markers: SectionMarker[] = [{ captureId: capture.id, atMs: 0, sectionId }];
  const session: AuthoringSession = { ...saved.session, captures: [...saved.session.captures, capture], markers: [...saved.session.markers, ...markers] };
  const settleLive = registerLive(capture.id);
  try {
    try { await store.save(session, saved.version); }
    catch (error) {
      // Another take's chunk moved the version on: add this capture to the latest session instead.
      if (!/another tab|version/i.test(String(error))) throw error;
      await updateCapture(store, session.id, capture.id, () => ({ capture, markers: [...markers] }));
    }
  } catch (error) { settleLive(); releaseStream(); throw error; }
  let context: AudioContext | undefined, sourceNode: MediaStreamAudioSourceNode | undefined, analyser: AnalyserNode | undefined, samples: Float32Array<ArrayBuffer> | undefined;
  // Metering is optional. Recording must work when Web Audio is unavailable or suspended.
  try {
    const AudioContextClass = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      context = new AudioContextClass();
      sourceNode = context.createMediaStreamSource(stream); analyser = context.createAnalyser();
      analyser.fftSize = 256; samples = new Float32Array(analyser.fftSize);
      sourceNode.connect(analyser);
      if (context.state === 'suspended') void context.resume().catch(() => undefined);
    }
  } catch { /* The microphone and durable recording remain usable without a meter. */ }
  const stopResuming = resumeAudioWhenVisible(context), watch = watchInterruptions(stream, options.onInterruption), awake = holdRecordingActive();
  let resolveStopped: (saved: SavedSession) => void, rejectStopped: (error: Error) => void;
  const completion = new Promise<SavedSession>((resolve, reject) => { resolveStopped = resolve; rejectStopped = reject; });
  void completion.catch(() => undefined);
  const halt = () => {
    if (recorder.state === 'inactive') return;
    finalElapsed = elapsed();
    recorder.stop();
  };
  const interrupt = (error: Error) => { if (stopped || failed) return; failed = error; onFailure(error); halt(); awake(); };
  const trackEnded = () => interrupt(new Error('The microphone disconnected or stopped. Your received audio is saved; reconnect it and recover this recording before continuing.'));
  const flushOnHide = () => { if (document.visibilityState === 'hidden' && recorder.state === 'recording') { try { recorder.requestData(); } catch { /* A simultaneous stop already flushes its final chunk. */ } } };
  let timeout: number | undefined;
  const cleanup = () => {
    window.clearTimeout(timeout);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', flushOnHide);
    stream.getTracks().forEach(t => { t.removeEventListener('ended', trackEnded); if (!options.retainStream) t.stop(); });
    try { sourceNode?.disconnect(); analyser?.disconnect(); } catch { /* Already disconnected. */ }
    if (context && context.state !== 'closed') void context.close().catch(() => undefined);
    stopResuming(); watch.stop(); awake();
    recorder.onpause = recorder.onresume = null;
  };
  const level = (): number | null => {
    if (!analyser || !samples || context?.state !== 'running') return null;
    if (recorder.state !== 'recording') return 0;
    try { analyser.getFloatTimeDomainData(samples); return Math.min(1, Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length) * 4); }
    catch { return null; }
  };
  // Optional so callers and fakes that predate them stay valid.
  const signals: { meterAvailable?: () => boolean; interruption?: () => CaptureInterruption | null } = {
    /** False when Web Audio is missing or suspended: show "meter unavailable", not silence. */
    meterAvailable: () => !!analyser && context?.state === 'running',
    interruption: watch.current,
  };
  recorder.onpause = () => { if (pausedAt === null && finalElapsed === null) pausedAt = performance.now(); };
  recorder.onresume = () => { if (pausedAt !== null) { pausedTotal += performance.now() - pausedAt; pausedAt = null; } };
  recorder.ondataavailable = event => {
    if (!event.data.size || saveFailed) return;
    if (finalElapsed === null) { const clock = mediaClock(); lostTotal += Math.max(0, clock - lastArrival - ARRIVAL_GAP_MS); lastArrival = clock; }
    receivedBytes += event.data.size;
    options.onChunk?.(event.data.size, receivedBytes);
    if (watch.current() && (level() ?? 0) >= REAL_INPUT_LEVEL) watch.clear();
    const chunkIndex = index++, endMs = Math.max(1, elapsed());
    queue = queue.then(() => { if (!saveFailed) return store.appendChunk(session.id, capture.id, chunkIndex, event.data, endMs); }).catch(error => {
      saveFailed = true; failed = error instanceof Error ? error : new Error('Audio save failed'); onFailure(failed); halt();
    });
    if (!boundaryReached && receivedBytes >= Math.min(options.maxBytes ?? 9 * 1024 * 1024, 9 * 1024 * 1024)) {
      boundaryReached = true; options.onBoundary?.('bytes'); halt();
    }
  };
  stream.getTracks().forEach(t => t.addEventListener('ended', trackEnded));
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', flushOnHide);
  recorder.onerror = () => interrupt(new Error('Recording was interrupted. Recover the audio chunks already saved on this device.'));
  recorder.onstop = async () => {
    if (stopped) return;
    finalElapsed ??= elapsed(); stopped = true; cleanup();
    try {
      await queue;
      // Closed on the latest session in one step, so the other take's chunks cannot make it fail. If it still
      // fails, the capture stays 'recording' and leaves the live list: recovery closes and queues it.
      const next = await updateCapture(store, session.id, capture.id, c => {
        if (!c) throw new Error('Recording session was not found');
        return { capture: { ...c, status: c.durationMs === 0 ? 'empty' : failed ? 'interrupted' : 'ready' }, markers: markers.filter(m => m.atMs <= c.durationMs) };
      });
      settleLive(); resolveStopped!(next);
    } catch (error) { settleLive(); rejectStopped!(error as Error); }
  };
  let live = false, attempts = 0;
  const begin = () => {
    started = performance.now(); recorder.start(1000); live = true;
    // The wall-clock ceiling also limits a recording left paused in a background tab.
    timeout = window.setTimeout(() => { if (!boundaryReached) { boundaryReached = true; options.onBoundary?.('duration'); } halt(); }, ceilingMs);
  };
  // A take that never started is closed with what it saved (nothing), so it is not left 'recording'.
  const close = async () => {
    stopped = true; cleanup(); settleLive();
    const current = await store.load(session.id);
    if (current) await recoverCapture(store, current, capture.id);
  };
  const go = () => {
    if (live) return;
    if (stopped) throw new Error('This recording was closed before it started.');
    try { begin(); }
    catch (error) { if (++attempts >= 2) void close().catch(() => undefined); throw microphoneError(error); }
  };
  if (!options.armed) {
    try { begin(); } catch (error) { await close(); throw microphoneError(error); }
  }
  return {
    ...(options.armed ? { go } : {}),
    captureId: capture.id,
    elapsed,
    state: (): RecordingState => recorder.state,
    pause: () => {
      if (stopped || recorder.state !== 'recording') return;
      try { recorder.requestData(); recorder.pause(); }
      catch (error) { interrupt(microphoneError(error)); }
    },
    resume: () => {
      if (stopped || recorder.state !== 'paused') return;
      try { recorder.resume(); }
      catch (error) { interrupt(microphoneError(error)); }
    },
    level,
    ...signals,
    muted: () => stream.getAudioTracks().some(t => t.muted || !t.enabled || t.readyState === 'ended'),
    mark: (id: string | null) => {
      if (stopped || recorder.state === 'inactive') return;
      const marker = { captureId: capture.id, atMs: elapsed(), sectionId: id };
      markers.push(marker);
      queue = queue.then(async () => {
        if (saveFailed) return;
        await updateCapture(store, session.id, capture.id, (c, own) => {
          if (!c) throw new Error('Recording session not found');
          return { capture: c, markers: [...own, marker] };
        });
      }).catch(error => { saveFailed = true; failed = error as Error; onFailure(failed); halt(); });
    },
    stop: () => { halt(); return completion; },
    completion,
  };
}
export type ActiveCapture = Awaited<ReturnType<typeof startCapture>>;

/** Closes a capture left 'recording' with the audio it saved. A take still recording or draining in this page is not
 * touched: it is waited for, and the latest saved session comes back with the take as it closed itself (normally
 * 'ready' with all its audio). Only if that closing save failed is it recovered here. */
export async function recoverCapture(store: AuthoringStore, saved: SavedSession, captureId: string): Promise<SavedSession> {
  if (isCaptureLive(captureId)) {
    await whenCaptureSettled(captureId);
    const latest = await store.load(saved.session.id), own = latest?.session.captures.find(c => c.id === captureId);
    if (!latest || !own) return saved;
    if (own.status !== 'recording') return latest;
    saved = latest;
  }
  const chunks = await store.captureChunks(saved.session.id, captureId);
  const durationMs = Math.min(TAKE_LIMIT_MS, Math.max(0, ...chunks.map(c => c.endMs)));
  const session = { ...saved.session, captures: saved.session.captures.map(c => c.id === captureId ? { ...c, durationMs, status: chunks.length ? 'interrupted' as const : 'empty' as const } : c), markers: saved.session.markers.filter(m => m.captureId !== captureId || m.atMs <= durationMs) };
  return { session, version: await store.save(session, saved.version) };
}
export async function importAudio(store: AuthoringStore, saved: SavedSession, file: Blob, durationMs: number, sectionId: string | null, visibleCardNumber = saved.session.source.cardNumber): Promise<SavedSession> {
  if (!file.type.startsWith('audio/') || file.size <= 0 || file.size > 10 * 1024 * 1024 || !Number.isFinite(durationMs) || durationMs <= 0 || durationMs > TAKE_LIMIT_MS) throw new Error('Choose an audio file up to 10 megabytes and 20 minutes, with its duration.');
  const capture: Capture = { id: crypto.randomUUID(), recordedAt: new Date().toISOString(), durationMs, mimeType: file.type, status: 'ready', origin: 'import', visibleCardNumber };
  const session = { ...saved.session, captures: [...saved.session.captures, capture], markers: [...saved.session.markers, { captureId: capture.id, atMs: 0, sectionId }] };
  // Import metadata and audio atomically. Retain the same session identity and concurrency guard.
  return store.addImportedAudio(session, saved.version, capture.id, file, durationMs);
}
