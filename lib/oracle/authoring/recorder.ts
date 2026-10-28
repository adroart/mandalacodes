import { chooseRecorderMimeType } from '../../../utils/oracleReflection';
import type { AuthoringSession, Capture, SectionMarker } from './types';
import { AuthoringStore, type SavedSession } from './storage';

/** Saves each delivered timeslice before reporting it durable. A browser/process crash may lose
 * the last undelivered slice. Recovered fragments can be incomplete containers on some phones. */
export async function startCapture(store: AuthoringStore, saved: SavedSession, sectionId: string | null, onFailure: (error: Error) => void) {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('Microphone recording needs a supported browser and a secure connection. You can import audio instead.');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  let recorder: MediaRecorder;
  try {
    const mimeType = chooseRecorderMimeType(t => MediaRecorder.isTypeSupported(t));
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  } catch (e) { stream.getTracks().forEach(t => t.stop()); throw e; }
  const capture: Capture = { id: crypto.randomUUID(), recordedAt: new Date().toISOString(), mimeType: recorder.mimeType || 'audio/webm', durationMs: 0, status: 'recording', origin: 'microphone' };
  let started = 0, index = 0, failed: Error | undefined, stopped = false;
  let queue = Promise.resolve();
  const markers: SectionMarker[] = [{ captureId: capture.id, atMs: 0, sectionId }];
  const session: AuthoringSession = { ...saved.session, captures: [...saved.session.captures, capture], markers: [...saved.session.markers, ...markers] };
  try { await store.save(session, saved.version); } catch (e) { stream.getTracks().forEach(t => t.stop()); throw e; }
  let resolveStopped: (saved: SavedSession) => void, rejectStopped: (error: Error) => void;
  const completion = new Promise<SavedSession>((resolve, reject) => { resolveStopped = resolve; rejectStopped = reject; });
  // The consumer may not call stop until later; attach a handler now to avoid unhandled rejection.
  void completion.catch(() => undefined);
  const halt = () => { if (recorder.state !== 'inactive') recorder.stop(); };
  recorder.ondataavailable = event => {
    if (!event.data.size || failed) return;
    const chunkIndex = index++, endMs = Math.max(1, Math.round(performance.now() - started));
    queue = queue.then(() => store.appendChunk(session.id, capture.id, chunkIndex, event.data, endMs)).catch(e => { failed = e instanceof Error ? e : new Error('Audio save failed'); onFailure(failed); halt(); });
  };
  const timeout = window.setTimeout(halt, 20 * 60 * 1000);
  recorder.onerror = () => { failed = new Error('Recording was interrupted. Recover the audio chunks already saved on this device.'); onFailure(failed); halt(); };
  recorder.onstop = async () => {
    stopped = true;
    window.clearTimeout(timeout); stream.getTracks().forEach(t => t.stop());
    try {
      await queue;
      const latest = await store.load(session.id);
      if (!latest) throw new Error('Recording session was not found');
      const next = { ...latest.session, markers: [...latest.session.markers.filter(m => m.captureId !== capture.id), ...markers], captures: latest.session.captures.map(c => c.id === capture.id ? { ...c, status: c.durationMs === 0 ? 'empty' as const : failed ? 'interrupted' as const : 'ready' as const } : c) };
      const version = await store.save(next, latest.version);
      resolveStopped!({ session: next, version });
    } catch (e) { rejectStopped!(e as Error); }
  };
  try { started = performance.now(); recorder.start(1000); } catch (e) {
    clearTimeout(timeout); stream.getTracks().forEach(t => t.stop());
    const current = await store.load(session.id);
    if (current) await recoverCapture(store, current, capture.id);
    throw e;
  }
  return {
    captureId: capture.id,
    elapsed: () => Math.round(performance.now() - started),
    mark: (id: string | null) => {
      if (stopped) return;
      const marker = { captureId: capture.id, atMs: Math.round(performance.now() - started), sectionId: id };
      markers.push(marker);
      // Markers use the same durable queue as audio, avoiding version races.
      queue = queue.then(async () => {
        const current = await store.load(session.id);
        if (!current) throw new Error('Recording session not found');
        await store.save({ ...current.session, markers: [...current.session.markers, marker] }, current.version);
      }).catch(e => { failed = e as Error; onFailure(failed); halt(); });
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
export async function importAudio(store: AuthoringStore, saved: SavedSession, file: Blob, durationMs: number, sectionId: string | null): Promise<SavedSession> {
  if (!file.type.startsWith('audio/') || file.size <= 0 || file.size > 10 * 1024 * 1024 || !Number.isFinite(durationMs) || durationMs <= 0 || durationMs > 20 * 60 * 1000) throw new Error('Choose an audio file up to 10 MiB and 20 minutes, with its duration.');
  const capture: Capture = { id: crypto.randomUUID(), recordedAt: new Date().toISOString(), durationMs, mimeType: file.type, status: 'ready', origin: 'import' };
  const session = { ...saved.session, captures: [...saved.session.captures, capture], markers: [...saved.session.markers, { captureId: capture.id, atMs: 0, sectionId }] };
  // Import metadata and audio atomically. Retain the same session identity and concurrency guard.
  return store.addImportedAudio(session, saved.version, capture.id, file, durationMs);
}
