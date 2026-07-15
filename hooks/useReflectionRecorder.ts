import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { REFLECTION_LIMITS, type ReflectionSegment } from '../types/oracleReflection';
import { chooseRecorderMimeType } from '../utils/oracleReflection';
import {
  createReflectionSession,
  getReflectionCapability,
  ReflectionApiError,
  transcribeReflectionSegment,
  uploadReflectionSegment,
} from '../lib/oracle/reflectionApi';
import {
  appendReflectionChunk,
  beginReflectionDraft,
  finalizeReflectionDraft,
  listReflectionDrafts,
  listPendingReflections,
  removeReflection,
} from '../lib/oracle/reflectionOutbox';
import { startMicrophoneMeter, triggerRecorderHaptic } from '../lib/oracle/reflectionRecorderFeedback';

export type ReflectionRecorderStatus = 'idle' | 'requesting_permission' | 'recording' | 'committing' | 'paused' | 'finished' | 'error';

export interface ReflectionRecorderState {
  status: ReflectionRecorderStatus;
  sessionId: string | null;
  segmentId: string | null;
  elapsedMs: number;
  pendingCount: number;
  message: string | null;
  confirmation: 'saved' | null;
  savedSegmentCount: number;
}

export type ReflectionRecorderAction =
  | { type: 'request_permission' }
  | { type: 'recording_started'; sessionId: string; segmentId: string }
  | { type: 'pause_requested'; message?: string }
  | { type: 'local_persisted' }
  | { type: 'commit_succeeded' }
  | { type: 'commit_deferred'; pendingCount: number; message?: string }
  | { type: 'resumed'; segmentId: string }
  | { type: 'elapsed'; elapsedMs: number }
  | { type: 'pending_changed'; pendingCount: number }
  | { type: 'warning'; message: string }
  | { type: 'transcription_notice'; message: string }
  | { type: 'failed'; message: string }
  | { type: 'unauthorized' }
  | { type: 'finish_confirmed' }
  | { type: 'clear_confirmation' }
  | { type: 'finished' };

export const initialReflectionRecorderState: ReflectionRecorderState = {
  status: 'idle', sessionId: null, segmentId: null, elapsedMs: 0, pendingCount: 0, message: null, confirmation: null, savedSegmentCount: 0,
};

const SEGMENT_DURATION_SAFETY_MS = 1_000;
const SEGMENT_SIZE_SAFETY_BYTES = 64 * 1024;

export function commitBoundaryReason(durationMs: number, estimatedBytes: number): 'duration' | 'size' | null {
  if (durationMs >= REFLECTION_LIMITS.maxSegmentDurationMs - SEGMENT_DURATION_SAFETY_MS) return 'duration';
  if (estimatedBytes >= REFLECTION_LIMITS.maxSegmentBytes - SEGMENT_SIZE_SAFETY_BYTES) return 'size';
  return null;
}

export function segmentLimitWarning(durationMs: number, estimatedBytes: number): string | null {
  if (durationMs >= REFLECTION_LIMITS.maxSegmentDurationMs * .9) return 'Approaching the 20 minute segment limit';
  if (estimatedBytes >= REFLECTION_LIMITS.maxSegmentBytes * .9) return 'Approaching the 10 MiB segment limit';
  return null;
}

export function transcriptionRecorderNotice(
  segment: Pick<ReflectionSegment, 'transcriptionStatus' | 'transcriptionError'>,
): string | null {
  if (segment.transcriptionStatus === 'transcribed') return null;
  return segment.transcriptionError ?? 'Audio is saved · transcription needs retry in Journal';
}

export function transcriptionRecorderFailureNotice(error: unknown): string {
  return error instanceof ReflectionApiError
    ? error.message
    : 'Audio is saved · transcription needs retry in Journal';
}

export async function finishAfterLocalPersistence<T>(
  startCommit: () => Promise<T> | T,
  getPersistence: () => Promise<void> | null,
  stopTracks: () => void,
): Promise<T> {
  const commit = Promise.resolve(startCommit());
  const persistence = getPersistence();
  if (persistence) await persistence;
  stopTracks();
  return await commit;
}

export function createSingleFlight(operation: () => Promise<void>): () => Promise<void> {
  let active: Promise<void> | null = null;
  return () => {
    if (active) return active;
    active = operation();
    void active.then(() => { active = null; }, () => { active = null; });
    return active;
  };
}

export function createSegmentStartGuard<Args extends unknown[]>(operation: (...args: Args) => Promise<void>): (...args: Args) => Promise<void> {
  let active: Promise<void> | null = null;
  return (...args) => {
    if (active) return active;
    active = operation(...args);
    void active.then(() => { active = null; }, () => { active = null; });
    return active;
  };
}

export function reflectionRecorderReducer(state: ReflectionRecorderState, action: ReflectionRecorderAction): ReflectionRecorderState {
  switch (action.type) {
    case 'request_permission': return { ...state, status: 'requesting_permission', message: null, confirmation: null };
    case 'recording_started': return { ...state, status: 'recording', sessionId: action.sessionId, segmentId: action.segmentId, message: null, confirmation: null };
    case 'pause_requested': return state.status === 'recording' ? { ...state, status: 'committing', message: action.message ?? 'Saving', confirmation: null } : state;
    case 'local_persisted': return { ...state, savedSegmentCount: state.savedSegmentCount + 1, message: 'Uploading' };
    case 'commit_succeeded': return { ...state, status: 'paused', segmentId: null, message: null, confirmation: 'saved' };
    case 'commit_deferred': return { ...state, status: 'paused', segmentId: null, pendingCount: action.pendingCount, message: action.message ?? 'Saved on device', confirmation: 'saved' };
    case 'resumed': return state.sessionId ? { ...state, status: 'recording', segmentId: action.segmentId, message: null, confirmation: null } : state;
    case 'elapsed': return { ...state, elapsedMs: action.elapsedMs };
    case 'pending_changed': return { ...state, pendingCount: action.pendingCount, message: action.pendingCount ? state.message : null };
    case 'warning': return state.status === 'recording' ? { ...state, message: action.message } : state;
    case 'transcription_notice': return { ...state, message: action.message };
    case 'failed': return { ...state, status: 'error', message: action.message, confirmation: null };
    case 'unauthorized': return { ...initialReflectionRecorderState, status: 'error', message: 'Your administrator session ended. Sign in and try again.' };
    case 'finish_confirmed': return { ...state, status: 'finished', segmentId: null, message: 'Saved' };
    case 'clear_confirmation': return { ...state, confirmation: null };
    case 'finished': return initialReflectionRecorderState;
  }
}

function newId(): string {
  return crypto.randomUUID();
}

function recorderError(error: unknown): string {
  if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
    return 'Microphone access is off. Enable it in Safari Settings and hold again.';
  }
  if (error instanceof ReflectionApiError && error.status === 401) return 'Your administrator session ended. Sign in and try again.';
  return error instanceof Error ? error.message : 'Recording could not start. Try again.';
}

export function failReflectionRecorder(
  error: unknown,
  cleanup: () => void,
  haptic: () => void,
  report: (message: string) => void,
): void {
  cleanup();
  haptic();
  report(recorderError(error));
}

export interface UseReflectionRecorderResult {
  isAdmin: boolean;
  capabilityReady: boolean;
  state: ReflectionRecorderState;
  micLevel: number;
  startRecording(): Promise<void>;
  pause(): Promise<void>;
  resume(): void;
  finish(): Promise<void>;
  cancel(): Promise<void>;
  retryPending(): Promise<void>;
}

export function useReflectionRecorder(hexagramNumber: number): UseReflectionRecorderResult {
  const [state, dispatch] = useReducer(reflectionRecorderReducer, initialReflectionRecorderState);
  const [isAdmin, setIsAdmin] = useState(false);
  const [capabilityReady, setCapabilityReady] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const capturedBytesRef = useRef(0);
  const segmentStartedRef = useRef(0);
  const elapsedBeforeSegmentRef = useRef(0);
  const intervalRef = useRef<number | null>(null);
  const confirmationTimerRef = useRef<number | null>(null);
  const meterCleanupRef = useRef<(() => void) | null>(null);
  const commitPromiseRef = useRef<Promise<boolean> | null>(null);
  const persistencePromiseRef = useRef<Promise<void> | null>(null);
  const persistenceResolvedRef = useRef<(() => void) | null>(null);
  const authorizationRevokedRef = useRef(false);
  const lifecycleGenerationRef = useRef(0);
  const finishOperationRef = useRef<() => Promise<void>>(async () => undefined);
  const finishOnceRef = useRef<(() => Promise<void>) | null>(null);
  if (!finishOnceRef.current) finishOnceRef.current = createSingleFlight(() => finishOperationRef.current());
  type SegmentStartArgs = [MediaStream, string, string, boolean];
  const segmentStartOperationRef = useRef<(...args: SegmentStartArgs) => Promise<void>>(async () => undefined);
  const segmentStartGuardRef = useRef<((...args: SegmentStartArgs) => Promise<void>) | null>(null);
  if (!segmentStartGuardRef.current) {
    segmentStartGuardRef.current = createSegmentStartGuard((...args: SegmentStartArgs) => segmentStartOperationRef.current(...args));
  }
  const autoCommitRef = useRef<(reason: 'duration' | 'size') => void>(() => undefined);
  const chunkIndexRef = useRef(0);
  const chunkWriteChainRef = useRef<Promise<void>>(Promise.resolve());
  const stateRef = useRef(state);
  stateRef.current = state;

  const clearClock = useCallback(() => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  const scheduleConfirmationClear = useCallback(() => {
    if (confirmationTimerRef.current !== null) window.clearTimeout(confirmationTimerRef.current);
    confirmationTimerRef.current = window.setTimeout(() => {
      confirmationTimerRef.current = null;
      dispatch({ type: 'clear_confirmation' });
    }, 900);
  }, []);

  const stopMeter = useCallback(() => {
    meterCleanupRef.current?.();
    meterCleanupRef.current = null;
    setMicLevel(0);
  }, []);

  const startMeter = useCallback((stream: MediaStream) => {
    stopMeter();
    meterCleanupRef.current = startMicrophoneMeter(stream, setMicLevel);
  }, [stopMeter]);

  const stopTracks = useCallback(() => {
    clearClock();
    stopMeter();
    const activeRecorder = recorderRef.current;
    recorderRef.current = null;
    if (activeRecorder && activeRecorder.state !== 'inactive') {
      activeRecorder.onstop = null;
      try { activeRecorder.stop(); } catch { /* The track may already have ended. */ }
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    capturedBytesRef.current = 0;
  }, [clearClock, stopMeter]);

  const failRecorder = useCallback((error: unknown) => {
    failReflectionRecorder(
      error,
      stopTracks,
      () => triggerRecorderHaptic('error'),
      (message) => dispatch({ type: 'failed', message }),
    );
  }, [stopTracks]);

  const retryPending = useCallback(async () => {
    if (!isAdmin) return;
    const drafts = (await listReflectionDrafts()).filter((draft) => draft.id !== stateRef.current.segmentId);
    for (const draft of drafts) {
      try { await finalizeReflectionDraft(draft.id); }
      catch { /* A draft without a received chunk remains recoverable. */ }
    }
    const rows = await listPendingReflections();
    dispatch({ type: 'pending_changed', pendingCount: rows.length });
    for (const row of rows) {
      try {
        await uploadReflectionSegment(row);
        await removeReflection(row.id);
        void transcribeReflectionSegment(row.id)
          .then((segment) => {
            const message = transcriptionRecorderNotice(segment);
            if (message) dispatch({ type: 'transcription_notice', message });
          })
          .catch((error) => dispatch({ type: 'transcription_notice', message: transcriptionRecorderFailureNotice(error) }));
      } catch (error) {
        if (error instanceof ReflectionApiError && error.status === 401) {
          setIsAdmin(false);
          authorizationRevokedRef.current = true;
          dispatch({ type: 'unauthorized' });
          stopTracks();
        }
        break;
      }
      dispatch({ type: 'pending_changed', pendingCount: (await listPendingReflections()).length });
    }
  }, [isAdmin, stopTracks]);

  const beginSegment = useCallback(async (stream: MediaStream, sessionId: string, segmentId: string, resumed: boolean) => {
    if (typeof MediaRecorder === 'undefined') throw new Error('Voice recording is not supported in this browser.');
    const mimeType = chooseRecorderMimeType(MediaRecorder.isTypeSupported.bind(MediaRecorder));
    if (!mimeType) throw new Error('Voice recording is not supported in this browser.');
    const recorder = new MediaRecorder(stream, { mimeType });
    capturedBytesRef.current = 0;
    chunkIndexRef.current = 0;
    chunkWriteChainRef.current = Promise.resolve();
    segmentStartedRef.current = performance.now();
    await beginReflectionDraft({
      id: segmentId, sessionId, hexagramNumber, recordedAt: new Date().toISOString(),
      durationMs: 0, mimeType, byteSize: 0,
    });
    recorder.ondataavailable = ({ data }) => {
      if (!data.size) return;
      capturedBytesRef.current += data.size;
      const index = chunkIndexRef.current++;
      const durationMs = performance.now() - segmentStartedRef.current;
      chunkWriteChainRef.current = chunkWriteChainRef.current
        .then(() => appendReflectionChunk(segmentId, index, data, durationMs))
        .catch((error) => { failRecorder(error); throw error; });
      const reason = commitBoundaryReason(performance.now() - segmentStartedRef.current, capturedBytesRef.current);
      if (reason && recorder.state === 'recording') autoCommitRef.current(reason);
      else {
        const warning = segmentLimitWarning(performance.now() - segmentStartedRef.current, capturedBytesRef.current);
        if (warning) dispatch({ type: 'warning', message: warning });
      }
    };
    recorderRef.current = recorder;
    recorder.start(1_000);
    startMeter(stream);
    dispatch(resumed ? { type: 'resumed', segmentId } : { type: 'recording_started', sessionId, segmentId });
    clearClock();
    intervalRef.current = window.setInterval(() => {
      const segmentElapsed = performance.now() - segmentStartedRef.current;
      dispatch({ type: 'elapsed', elapsedMs: elapsedBeforeSegmentRef.current + segmentElapsed });
      const reason = commitBoundaryReason(segmentElapsed, capturedBytesRef.current);
      if (reason && recorder.state === 'recording') autoCommitRef.current(reason);
      else {
        const warning = segmentLimitWarning(segmentElapsed, capturedBytesRef.current);
        if (warning) dispatch({ type: 'warning', message: warning });
      }
    }, 250);
  }, [clearClock, failRecorder, startMeter]);
  segmentStartOperationRef.current = beginSegment;
  const startSegment = segmentStartGuardRef.current;

  const startRecording = useCallback(async () => {
    if (!isAdmin || stateRef.current.status !== 'idle') return;
    const generation = ++lifecycleGenerationRef.current;
    dispatch({ type: 'request_permission' });
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Voice recording is not supported in this browser.');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (generation !== lifecycleGenerationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const sessionId = newId();
      await createReflectionSession(sessionId, hexagramNumber);
      if (generation !== lifecycleGenerationRef.current) {
        stopTracks();
        return;
      }
      await startSegment(stream, sessionId, newId(), false);
    } catch (error) {
      failRecorder(error);
    }
  }, [failRecorder, hexagramNumber, isAdmin, startSegment, stopTracks]);

  const commitCurrentSegment = useCallback(async (boundaryReason?: 'duration' | 'size') => {
    if (commitPromiseRef.current) return commitPromiseRef.current;
    const recorder = recorderRef.current;
    const current = stateRef.current;
    if (!recorder || recorder.state === 'inactive' || current.status !== 'recording' || !current.sessionId || !current.segmentId) return current.status === 'paused';
    dispatch({ type: 'pause_requested', message: boundaryReason === 'duration' ? '20 minute limit reached · saving segment' : boundaryReason === 'size' ? 'Audio size limit near · saving segment' : undefined });
    clearClock();
    stopMeter();
    const durationMs = Math.max(1, Math.round(performance.now() - segmentStartedRef.current));
    elapsedBeforeSegmentRef.current += durationMs;
    persistencePromiseRef.current = new Promise<void>((resolve) => { persistenceResolvedRef.current = resolve; });
    const commit = new Promise<boolean>((resolve) => { recorder.onstop = async () => {
      recorderRef.current = null;
      let locallyPersisted = false;
      try {
        await chunkWriteChainRef.current;
        const pending = await finalizeReflectionDraft(current.segmentId!);
        const blob = pending.blob;
        if (durationMs > REFLECTION_LIMITS.maxSegmentDurationMs) throw new Error('Segment is longer than 20 minutes. Start a new segment.');
        if (blob.size > REFLECTION_LIMITS.maxSegmentBytes) throw new Error('Segment is larger than 10 MiB. Start a shorter segment.');
        if (!blob.size) throw new Error('No audio was captured. Resume and try again.');
        locallyPersisted = true;
        dispatch({ type: 'local_persisted' });
        triggerRecorderHaptic('saved');
        persistenceResolvedRef.current?.();
        persistenceResolvedRef.current = null;
        try {
          await uploadReflectionSegment(pending);
          await removeReflection(pending.id);
          dispatch({ type: 'commit_succeeded' });
          scheduleConfirmationClear();
          void transcribeReflectionSegment(pending.id)
            .then((segment) => {
              const message = transcriptionRecorderNotice(segment);
              if (message) dispatch({ type: 'transcription_notice', message });
            })
            .catch((error) => dispatch({ type: 'transcription_notice', message: transcriptionRecorderFailureNotice(error) }));
        } catch (error) {
          if (error instanceof ReflectionApiError && error.status === 401) {
            setIsAdmin(false);
            authorizationRevokedRef.current = true;
            dispatch({ type: 'unauthorized' });
            stopTracks();
          } else {
            dispatch({ type: 'commit_deferred', pendingCount: (await listPendingReflections()).length });
            scheduleConfirmationClear();
          }
        }
      } catch (error) {
        failRecorder(error);
      } finally {
        persistenceResolvedRef.current?.();
        persistenceResolvedRef.current = null;
      }
      resolve(locallyPersisted);
    }; });
    commitPromiseRef.current = commit.finally(() => { commitPromiseRef.current = null; });
    if (recorder.state === 'recording') recorder.requestData();
    recorder.stop();
    return commitPromiseRef.current;
  }, [clearClock, failRecorder, hexagramNumber, scheduleConfirmationClear, stopMeter, stopTracks]);

  autoCommitRef.current = (reason) => { void commitCurrentSegment(reason); };

  const pause = useCallback(async () => { await commitCurrentSegment(); }, [commitCurrentSegment]);

  const resume = useCallback(() => {
    const current = stateRef.current;
    if (current.status !== 'paused' || !current.sessionId || !streamRef.current) return;
    void startSegment(streamRef.current, current.sessionId, newId(), true)
      .catch(failRecorder);
  }, [failRecorder, startSegment]);

  const performFinish = useCallback(async () => {
    const startingStatus = stateRef.current.status;
    lifecycleGenerationRef.current += 1;
    if (startingStatus === 'requesting_permission') {
      stopTracks();
      dispatch({ type: 'finished' });
      return;
    }
    const saved = await finishAfterLocalPersistence(
      () => commitCurrentSegment(),
      () => persistencePromiseRef.current,
      stopTracks,
    );
    elapsedBeforeSegmentRef.current = 0;
    if (!authorizationRevokedRef.current && saved) {
      dispatch({ type: 'finish_confirmed' });
      window.setTimeout(() => dispatch({ type: 'finished' }), 650);
    } else if (!authorizationRevokedRef.current && stateRef.current.status === 'error') {
      dispatch({ type: 'finished' });
    }
  }, [commitCurrentSegment, stopTracks]);
  finishOperationRef.current = performFinish;
  const finish = useCallback(() => finishOnceRef.current!(), []);
  const cancel = finish;

  useEffect(() => {
    let live = true;
    getReflectionCapability()
      .then(() => { if (live) setIsAdmin(true); })
      .catch(() => { if (live) setIsAdmin(false); })
      .finally(() => { if (live) setCapabilityReady(true); });
    return () => { live = false; };
  }, []);

  useEffect(() => () => {
    if (confirmationTimerRef.current !== null) window.clearTimeout(confirmationTimerRef.current);
  }, []);

  useEffect(() => { if (isAdmin) void retryPending(); }, [isAdmin, retryPending]);
  useEffect(() => {
    const online = () => void retryPending();
    const hide = () => { void finish(); };
    const visibility = () => { if (document.visibilityState === 'hidden') void finish(); };
    window.addEventListener('online', online);
    window.addEventListener('pagehide', hide);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('pagehide', hide);
      document.removeEventListener('visibilitychange', visibility);
      void finish();
    };
  }, [finish, hexagramNumber, retryPending]);

  return { isAdmin, capabilityReady, state, micLevel, startRecording, pause, resume, finish, cancel, retryPending };
}
