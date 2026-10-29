import { chooseRecorderMimeType } from '../../../utils/oracleReflection';
import type { AuthoringSession, Capture, SectionMarker } from './types';
import { AuthoringStore, type SavedSession } from './storage';

function microphoneError(error: unknown): Error {
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return new Error('Microphone access is blocked. Allow the microphone for this app in your browser or device settings, then try Record again. You can also import an audio recording.');
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return new Error('No microphone was found. Connect a microphone, then try Record again, or import an audio recording.');
  if (name === 'NotReadableError' || name === 'TrackStartError') return new Error('The microphone could not start. Close another app using it, check your microphone connection, then try Record again.');
  return error instanceof Error ? error : new Error('The microphone could not start. Check its connection and try Record again.');
}

export interface CaptureOptions {
  /** A caller-owned stream enables rolling takes without repeated permissions. */
  stream?: MediaStream;
  retainStream?: boolean;
  maxDurationMs?: number;
  maxBytes?: number;
  onBoundary?: (reason: 'duration' | 'bytes') => void;
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
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  } catch (error) { releaseStream(); throw microphoneError(error); }
  const capture: Capture = { id: crypto.randomUUID(), recordedAt: new Date().toISOString(), mimeType: recorder.mimeType || 'audio/webm', durationMs: 0, status: 'recording', origin: 'microphone', visibleCardNumber };
  let started = 0, index = 0, failed: Error | undefined, stopped = false, saveFailed = false;
  let pausedAt: number | null = null, pausedTotal = 0, finalElapsed: number | null = null;
  let queue = Promise.resolve();
  let receivedBytes = 0, boundaryReached = false;
  const elapsed = () => finalElapsed ?? Math.max(0, Math.round((pausedAt ?? performance.now()) - started - pausedTotal));
  const markers: SectionMarker[] = [{ captureId: capture.id, atMs: 0, sectionId }];
  const session: AuthoringSession = { ...saved.session, captures: [...saved.session.captures, capture], markers: [...saved.session.markers, ...markers] };
  try { await store.save(session, saved.version); } catch (error) { releaseStream(); throw error; }
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
  let resolveStopped: (saved: SavedSession) => void, rejectStopped: (error: Error) => void;
  const completion = new Promise<SavedSession>((resolve, reject) => { resolveStopped = resolve; rejectStopped = reject; });
  void completion.catch(() => undefined);
  const halt = () => {
    if (recorder.state === 'inactive') return;
    finalElapsed = elapsed();
    recorder.stop();
  };
  const interrupt = (error: Error) => { if (stopped || failed) return; failed = error; onFailure(error); halt(); };
  const trackEnded = () => interrupt(new Error('The microphone disconnected or stopped. Your received audio is saved; reconnect it and recover this recording before continuing.'));
  const flushOnHide = () => { if (document.visibilityState === 'hidden' && recorder.state === 'recording') { try { recorder.requestData(); } catch { /* A simultaneous stop already flushes its final chunk. */ } } };
  const cleanup = () => {
    window.clearTimeout(timeout);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', flushOnHide);
    stream.getTracks().forEach(t => { t.removeEventListener('ended', trackEnded); if (!options.retainStream) t.stop(); });
    try { sourceNode?.disconnect(); analyser?.disconnect(); } catch { /* Already disconnected. */ }
    if (context && context.state !== 'closed') void context.close().catch(() => undefined);
    recorder.onpause = recorder.onresume = null;
  };
  recorder.onpause = () => { if (pausedAt === null && finalElapsed === null) pausedAt = performance.now(); };
  recorder.onresume = () => { if (pausedAt !== null) { pausedTotal += performance.now() - pausedAt; pausedAt = null; } };
  recorder.ondataavailable = event => {
    if (!event.data.size || saveFailed) return;
    receivedBytes += event.data.size;
    const chunkIndex = index++, endMs = Math.max(1, elapsed());
    queue = queue.then(() => { if (!saveFailed) return store.appendChunk(session.id, capture.id, chunkIndex, event.data, endMs); }).catch(error => {
      saveFailed = true; failed = error instanceof Error ? error : new Error('Audio save failed'); onFailure(failed); halt();
    });
    if (!boundaryReached && receivedBytes >= Math.min(options.maxBytes ?? 9 * 1024 * 1024, 9 * 1024 * 1024)) {
      boundaryReached = true; options.onBoundary?.('bytes'); halt();
    }
  };
  // The wall-clock ceiling also limits a recording left paused in a background tab.
  const timeout = window.setTimeout(() => { if (!boundaryReached) { boundaryReached = true; options.onBoundary?.('duration'); } halt(); }, Math.max(1000, Math.min(options.maxDurationMs ?? 20 * 60 * 1000, 20 * 60 * 1000)));
  stream.getTracks().forEach(t => t.addEventListener('ended', trackEnded));
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', flushOnHide);
  recorder.onerror = () => interrupt(new Error('Recording was interrupted. Recover the audio chunks already saved on this device.'));
  recorder.onstop = async () => {
    if (stopped) return;
    finalElapsed ??= elapsed(); stopped = true; cleanup();
    try {
      await queue;
      const latest = await store.load(session.id);
      if (!latest) throw new Error('Recording session was not found');
      const durationMs = latest.session.captures.find(c => c.id === capture.id)?.durationMs ?? 0;
      const next = { ...latest.session, markers: [...latest.session.markers.filter(m => m.captureId !== capture.id), ...markers.filter(m => m.atMs <= durationMs)], captures: latest.session.captures.map(c => c.id === capture.id ? { ...c, status: c.durationMs === 0 ? 'empty' as const : failed ? 'interrupted' as const : 'ready' as const } : c) };
      const version = await store.save(next, latest.version);
      resolveStopped!({ session: next, version });
    } catch (error) { rejectStopped!(error as Error); }
  };
  try { started = performance.now(); recorder.start(1000); } catch (error) {
    stopped = true; cleanup();
    const current = await store.load(session.id);
    if (current) await recoverCapture(store, current, capture.id);
    throw microphoneError(error);
  }
  return {
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
    level: (): number | null => {
      if (!analyser || !samples || context?.state !== 'running') return null;
      if (recorder.state !== 'recording') return 0;
      try { analyser.getFloatTimeDomainData(samples); return Math.min(1, Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length) * 4); }
      catch { return null; }
    },
    muted: () => stream.getAudioTracks().some(t => t.muted || !t.enabled || t.readyState === 'ended'),
    mark: (id: string | null) => {
      if (stopped || recorder.state === 'inactive') return;
      const marker = { captureId: capture.id, atMs: elapsed(), sectionId: id };
      markers.push(marker);
      queue = queue.then(async () => {
        if (saveFailed) return;
        const current = await store.load(session.id);
        if (!current) throw new Error('Recording session not found');
        await store.save({ ...current.session, markers: [...current.session.markers, marker] }, current.version);
      }).catch(error => { saveFailed = true; failed = error as Error; onFailure(failed); halt(); });
    },
    stop: () => { halt(); return completion; },
    completion,
  };
}
export type ActiveCapture = Awaited<ReturnType<typeof startCapture>>;

export async function recoverCapture(store: AuthoringStore, saved: SavedSession, captureId: string): Promise<SavedSession> {
  const chunks = (await store.chunks(saved.session.id)).filter(c => c.captureId === captureId);
  const durationMs = Math.max(0, ...chunks.map(c => c.endMs));
  const session = { ...saved.session, captures: saved.session.captures.map(c => c.id === captureId ? { ...c, durationMs, status: chunks.length ? 'interrupted' as const : 'empty' as const } : c), markers: saved.session.markers.filter(m => m.captureId !== captureId || m.atMs <= durationMs) };
  return { session, version: await store.save(session, saved.version) };
}
export async function importAudio(store: AuthoringStore, saved: SavedSession, file: Blob, durationMs: number, sectionId: string | null, visibleCardNumber = saved.session.source.cardNumber): Promise<SavedSession> {
  if (!file.type.startsWith('audio/') || file.size <= 0 || file.size > 10 * 1024 * 1024 || !Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 20 * 60 * 1000) throw new Error('Choose an audio file up to 10 MiB and 20 minutes, with its duration.');
  const capture: Capture = { id: crypto.randomUUID(), recordedAt: new Date().toISOString(), durationMs, mimeType: file.type, status: 'ready', origin: 'import', visibleCardNumber };
  const session = { ...saved.session, captures: [...saved.session.captures, capture], markers: [...saved.session.markers, { captureId: capture.id, atMs: 0, sectionId }] };
  // Import metadata and audio atomically. Retain the same session identity and concurrency guard.
  return store.addImportedAudio(session, saved.version, capture.id, file, durationMs);
}
