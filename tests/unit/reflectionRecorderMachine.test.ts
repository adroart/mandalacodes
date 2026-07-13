import { describe, expect, it } from 'vitest';
import {
  commitBoundaryReason,
  createSingleFlight,
  createSegmentStartGuard,
  finishAfterLocalPersistence,
  initialReflectionRecorderState,
  reflectionRecorderReducer,
  segmentLimitWarning,
} from '../../hooks/useReflectionRecorder';
import { REFLECTION_LIMITS } from '../../types/oracleReflection';

describe('reflection recorder state machine', () => {
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

  it('keeps an offline commit pending and clears it after retry', () => {
    const committing = { ...initialReflectionRecorderState, status: 'committing' as const, sessionId: 'session-1', segmentId: 'segment-1' };
    const offline = reflectionRecorderReducer(committing, { type: 'commit_deferred', pendingCount: 1 });
    const retried = reflectionRecorderReducer(offline, { type: 'pending_changed', pendingCount: 0 });
    expect(offline).toMatchObject({ status: 'paused', pendingCount: 1 });
    expect(retried.pendingCount).toBe(0);
  });

  it('returns to idle on finish', () => {
    const recording = { ...initialReflectionRecorderState, status: 'recording' as const, sessionId: 'session-1', segmentId: 'segment-1' };
    expect(reflectionRecorderReducer(recording, { type: 'finished' })).toEqual(initialReflectionRecorderState);
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
    expect(segmentLimitWarning(1, REFLECTION_LIMITS.maxSegmentBytes * .9)).toBe('Approaching the 25 MiB segment limit');
    expect(segmentLimitWarning(1_000, 1_000)).toBeNull();
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
