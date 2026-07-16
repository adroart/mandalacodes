import { describe, expect, it, vi } from 'vitest';
import {
  commitBoundaryReason,
  createSingleFlight,
  createSegmentStartGuard,
  exitAfterFinish,
  failReflectionRecorder,
  finishAfterLocalPersistence,
  initialReflectionRecorderState,
  reflectionRecorderReducer,
  segmentLimitWarning,
  transcriptionRecorderNotice,
  transcriptionRecorderFailureNotice,
} from '../../hooks/useReflectionRecorder';
import { ReflectionApiError } from '../../lib/oracle/reflectionApi';
import { REFLECTION_LIMITS } from '../../types/oracleReflection';
import {
  formatRecorderSegmentCount,
  normalizeRecorderAmplitude,
  startMicrophoneMeter,
  triggerRecorderHaptic,
} from '../../lib/oracle/reflectionRecorderFeedback';

describe('reflection recorder state machine', () => {
  it('formats compact saved-segment badges', () => {
    expect(formatRecorderSegmentCount(0)).toBeNull();
    expect(formatRecorderSegmentCount(1)).toBe('1');
    expect(formatRecorderSegmentCount(9)).toBe('9');
    expect(formatRecorderSegmentCount(10)).toBe('9+');
  });

  it('normalizes microphone samples into a restrained zero-to-one level', () => {
    expect(normalizeRecorderAmplitude(new Uint8Array([128, 128]))).toBe(0);
    expect(normalizeRecorderAmplitude(new Uint8Array([0, 255]))).toBeGreaterThan(.9);
  });

  it('uses capability-detected haptic patterns without requiring vibration support', () => {
    const patterns: Array<number | number[]> = [];
    triggerRecorderHaptic('press', (pattern) => { patterns.push(pattern); return true; });
    triggerRecorderHaptic('saved', (pattern) => { patterns.push(pattern); return true; });
    triggerRecorderHaptic('error', (pattern) => { patterns.push(pattern); return true; });
    triggerRecorderHaptic('press');
    expect(patterns).toEqual([8, [8, 40, 8], 20]);
  });

  it('stops and disconnects microphone metering cleanly', () => {
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    const analyser = { fftSize: 0, smoothingTimeConstant: 0, disconnect: vi.fn(), getByteTimeDomainData: vi.fn((samples: Uint8Array) => samples.fill(128)) };
    const close = vi.fn().mockResolvedValue(undefined);
    let frameCallback: FrameRequestCallback | null = null;
    const cancelAnimationFrame = vi.fn();
    class FakeAudioContext {
      createMediaStreamSource() { return source; }
      createAnalyser() { return analyser; }
      close() { return close(); }
    }
    vi.stubGlobal('window', {
      AudioContext: FakeAudioContext,
      requestAnimationFrame(callback: FrameRequestCallback) { frameCallback = callback; return 7; },
      cancelAnimationFrame,
    });
    const levels: number[] = [];
    const stop = startMicrophoneMeter({} as MediaStream, (level) => levels.push(level));
    expect(source.connect).toHaveBeenCalledWith(analyser);
    (frameCallback as FrameRequestCallback | null)?.(0);
    expect(levels).toContain(0);
    stop();
    expect(cancelAnimationFrame).toHaveBeenCalled();
    expect(source.disconnect).toHaveBeenCalled();
    expect(analyser.disconnect).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('cleans up and signals before reporting recorder failures', () => {
    const events: string[] = [];
    failReflectionRecorder(
      new Error('Draft failed'),
      () => events.push('cleanup'),
      () => events.push('haptic'),
      (message) => events.push(`report:${message}`),
    );
    expect(events).toEqual(['cleanup', 'haptic', 'report:Draft failed']);
  });

  it('moves from permission request into recording', () => {
    const requesting = reflectionRecorderReducer(initialReflectionRecorderState, { type: 'request_permission' });
    const recording = reflectionRecorderReducer(requesting, {
      type: 'recording_started',
      sessionId: 'session-1',
      segmentId: 'segment-1',
    });
    expect(recording).toMatchObject({ status: 'recording', sessionId: 'session-1', segmentId: 'segment-1' });
  });

  it('commits a paused segment and resumes with a new identity', () => {
    const recording = { ...initialReflectionRecorderState, status: 'recording' as const, sessionId: 'session-1', segmentId: 'segment-1' };
    const committing = reflectionRecorderReducer(recording, { type: 'pause_requested' });
    const paused = reflectionRecorderReducer(committing, { type: 'commit_succeeded' });
    const resumed = reflectionRecorderReducer(paused, { type: 'resumed', segmentId: 'segment-2' });
    expect(committing.status).toBe('committing');
    expect(paused.status).toBe('paused');
    expect(resumed).toMatchObject({ status: 'recording', segmentId: 'segment-2', sessionId: 'session-1' });
  });

  it('counts a segment only after local persistence and confirms it after upload', () => {
    const committing = { ...initialReflectionRecorderState, status: 'committing' as const, sessionId: 'session-1', segmentId: 'segment-1' };
    const local = reflectionRecorderReducer(committing, { type: 'local_persisted' });
    expect(local).toMatchObject({ status: 'committing', savedSegmentCount: 1, message: 'Uploading' });
    const saved = reflectionRecorderReducer(local, { type: 'commit_succeeded' });
    expect(saved).toMatchObject({ status: 'paused', savedSegmentCount: 1, confirmation: 'saved' });
    expect(reflectionRecorderReducer(saved, { type: 'clear_confirmation' })).toMatchObject({ confirmation: null, savedSegmentCount: 1 });
  });

  it('does not count or confirm a segment when persistence fails', () => {
    const committing = { ...initialReflectionRecorderState, status: 'committing' as const, sessionId: 'session-1', segmentId: 'segment-1' };
    const failed = reflectionRecorderReducer(committing, { type: 'failed', message: 'No audio was captured.' });
    expect(failed).toMatchObject({ status: 'error', savedSegmentCount: 0, confirmation: null });
  });

  it('keeps an offline commit pending and clears it after retry', () => {
    const committing = { ...initialReflectionRecorderState, status: 'committing' as const, sessionId: 'session-1', segmentId: 'segment-1' };
    const offline = reflectionRecorderReducer(committing, { type: 'commit_deferred', pendingCount: 1 });
    const retried = reflectionRecorderReducer(offline, { type: 'pending_changed', pendingCount: 0 });
    expect(offline).toMatchObject({ status: 'paused', pendingCount: 1 });
    expect(retried.pendingCount).toBe(0);
  });

  it('returns to idle on finish', () => {
    const recording = { ...initialReflectionRecorderState, status: 'recording' as const, sessionId: 'session-1', segmentId: 'segment-1' };
    const confirmed = reflectionRecorderReducer(recording, { type: 'finish_confirmed' });
    expect(confirmed).toMatchObject({ status: 'finished', message: 'Saved' });
    expect(reflectionRecorderReducer(confirmed, { type: 'finished' })).toEqual(initialReflectionRecorderState);
  });

  it('revokes the active recorder state after an unauthorized commit', () => {
    const recording = { ...initialReflectionRecorderState, status: 'committing' as const, sessionId: 'session-1', segmentId: 'segment-1' };
    expect(reflectionRecorderReducer(recording, { type: 'unauthorized' })).toMatchObject({
      status: 'error',
      sessionId: null,
      segmentId: null,
      message: 'Your administrator session ended. Sign in and try again.',
    });
  });

  it('creates a safe segment boundary before duration or size limits', () => {
    expect(commitBoundaryReason(REFLECTION_LIMITS.maxSegmentDurationMs - 1_001, 1)).toBeNull();
    expect(commitBoundaryReason(REFLECTION_LIMITS.maxSegmentDurationMs - 1_000, 1)).toBe('duration');
    expect(commitBoundaryReason(1, REFLECTION_LIMITS.maxSegmentBytes - 65_537)).toBeNull();
    expect(commitBoundaryReason(1, REFLECTION_LIMITS.maxSegmentBytes - 65_536)).toBe('size');
  });

  it('warns live before automatic duration and size boundaries', () => {
    expect(segmentLimitWarning(REFLECTION_LIMITS.maxSegmentDurationMs * .9, 1)).toBe('Approaching the 20 minute segment limit');
    expect(segmentLimitWarning(1, REFLECTION_LIMITS.maxSegmentBytes * .9)).toBe('Approaching the 10 MiB segment limit');
    expect(segmentLimitWarning(1_000, 1_000)).toBeNull();
  });

  it('keeps saved audio paused while surfacing a transcription failure', () => {
    const paused = { ...initialReflectionRecorderState, status: 'paused' as const, sessionId: 'session-1', savedSegmentCount: 1 };
    expect(reflectionRecorderReducer(paused, { type: 'transcription_notice', message: 'Groq transcription failed; retry later' })).toMatchObject({
      status: 'paused',
      message: 'Groq transcription failed; retry later',
      savedSegmentCount: 1,
    });
  });

  it('maps non-final transcription outcomes to useful recorder notices', () => {
    expect(transcriptionRecorderNotice({ transcriptionStatus: 'transcribed', transcriptionError: null })).toBeNull();
    expect(transcriptionRecorderNotice({ transcriptionStatus: 'failed', transcriptionError: 'Groq transcription failed; retry later' })).toBe('Groq transcription failed; retry later');
    expect(transcriptionRecorderNotice({ transcriptionStatus: 'transcription_pending', transcriptionError: null })).toBe('Audio is saved · transcription needs retry in Journal');
  });

  it('preserves the server message when a post-upload transcription request is rejected', () => {
    expect(transcriptionRecorderFailureNotice(new ReflectionApiError(503, 'Groq rate limit reached; retry later'))).toBe('Groq rate limit reached; retry later');
    expect(transcriptionRecorderFailureNotice(new Error('network down'))).toBe('Audio is saved · transcription needs retry in Journal');
  });

  it('waits for local persistence before stopping tracks but not for upload completion', async () => {
    const events: string[] = [];
    let persisted!: () => void;
    let uploaded!: () => void;
    const persistence = new Promise<void>((resolve) => { persisted = resolve; });
    const upload = new Promise<void>((resolve) => { uploaded = resolve; });
    const finishing = finishAfterLocalPersistence(
      () => { events.push('stop-recorder'); return upload; },
      () => persistence,
      () => events.push('stop-tracks'),
    );
    await Promise.resolve();
    expect(events).toEqual(['stop-recorder']);
    persisted();
    await Promise.resolve();
    expect(events).toEqual(['stop-recorder', 'stop-tracks']);
    uploaded();
    await finishing;
  });

  it('returns whether the recording was actually persisted before finish', async () => {
    await expect(finishAfterLocalPersistence(() => Promise.resolve(false), () => null, () => undefined)).resolves.toBe(false);
    await expect(finishAfterLocalPersistence(() => Promise.resolve(true), () => null, () => undefined)).resolves.toBe(true);
  });

  it('finishes persisted work before immediately clearing the reflection interface', async () => {
    const events: string[] = [];
    await exitAfterFinish(
      async () => { events.push('finish'); },
      () => events.push('reset'),
    );
    expect(events).toEqual(['finish', 'reset']);
  });

  it('coalesces simultaneous pagehide and visibility cleanup into one operation', async () => {
    let complete!: () => void;
    let calls = 0;
    const run = createSingleFlight(() => {
      calls += 1;
      return calls === 1 ? new Promise<void>((resolve) => { complete = resolve; }) : Promise.resolve();
    });
    const first = run();
    const second = run();
    expect(calls).toBe(1);
    expect(second).toBe(first);
    complete();
    await first;
    await run();
    expect(calls).toBe(2);
  });

  it('coalesces double resume while draft persistence is pending and remains commit-capable', async () => {
    let draftReady!: () => void;
    let starts = 0;
    let recorder: { state: 'recording' } | null = null;
    const draft = new Promise<void>((resolve) => { draftReady = resolve; });
    const start = createSegmentStartGuard(async () => {
      starts += 1;
      await draft;
      recorder = { state: 'recording' };
    });
    const first = start();
    const second = start();
    expect(starts).toBe(1);
    expect(second).toBe(first);
    draftReady();
    await first;
    expect(recorder).toEqual({ state: 'recording' });
  });
});
