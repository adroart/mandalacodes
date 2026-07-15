import { afterEach, describe, expect, it, vi } from 'vitest';
import { cycleJournalFocusIndex, journalTranscriptionFailureMessage, moveReflectionSegment, newestReflectionSegments, shouldAutomaticallyTranscribe, transcriptionPollingWindow } from '../../components/oracle/ReflectionJournal';
import { ReflectionApiError } from '../../lib/oracle/reflectionApi';

const segment = (id: string, recordedAt: string, sequence: number) => ({ id, recordedAt, sequence });

describe('reflection recorder journal ordering', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps one bounded polling deadline across repeated segment reloads', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));
    let window = transcriptionPollingWindow(null, 'session-1', true, Date.now());
    const originalDeadline = window?.expiresAt;

    for (let reload = 0; reload < 10; reload += 1) {
      vi.advanceTimersByTime(2_000);
      window = transcriptionPollingWindow(window, 'session-1', true, Date.now());
      expect(window?.expiresAt).toBe(originalDeadline);
      expect(window?.expiresAt).toBeGreaterThan(Date.now());
    }

    vi.advanceTimersByTime(10_001);
    window = transcriptionPollingWindow(window, 'session-1', true, Date.now());
    expect(window?.expiresAt).toBe(originalDeadline);
    expect(Date.now()).toBeGreaterThan(window!.expiresAt);
  });

  it('does not create a polling window for failed or absent transcription work', () => {
    expect(transcriptionPollingWindow(null, 'session-1', false, Date.now())).toBeNull();
    expect(transcriptionPollingWindow(null, null, true, Date.now())).toBeNull();
  });
  it('automatically reclaims only pending or expired transcription work', () => {
    const now = Date.parse('2026-07-15T12:00:00.000Z');
    expect(shouldAutomaticallyTranscribe({ transcriptionStatus: 'transcription_pending', transcriptionStartedAt: null }, now)).toBe(true);
    expect(shouldAutomaticallyTranscribe({ transcriptionStatus: 'transcribing', transcriptionStartedAt: '2026-07-15T11:54:59.999Z' }, now)).toBe(true);
    expect(shouldAutomaticallyTranscribe({ transcriptionStatus: 'transcribing', transcriptionStartedAt: '2026-07-15T11:55:00.001Z' }, now)).toBe(false);
    expect(shouldAutomaticallyTranscribe({ transcriptionStatus: 'failed', transcriptionStartedAt: null }, now)).toBe(false);
  });

  it('preserves a rejected transcription response message for the journal', () => {
    expect(journalTranscriptionFailureMessage(new ReflectionApiError(503, 'Groq unavailable for this recording'))).toBe('Groq unavailable for this recording');
    expect(journalTranscriptionFailureMessage(new Error('offline'))).toBe('Audio saved privately · retry transcription later');
  });
  it('presents freshly loaded segments newest first without changing identity', () => {
    const rows = [segment('old', '2026-07-13T01:00:00Z', 0), segment('new', '2026-07-13T02:00:00Z', 1)];
    expect(newestReflectionSegments(rows).map(({ id }) => id)).toEqual(['new', 'old']);
  });

  it('moves a segment by immutable identity', () => {
    const rows = [segment('a', '2026-07-13T01:00:00Z', 0), segment('b', '2026-07-13T02:00:00Z', 1), segment('c', '2026-07-13T03:00:00Z', 2)];
    expect(moveReflectionSegment(rows, 'c', 'a').map(({ id }) => id)).toEqual(['c', 'a', 'b']);
    expect(moveReflectionSegment(rows, 'missing', 'a')).toBe(rows);
  });

  it('cycles keyboard focus inside the journal in both directions', () => {
    expect(cycleJournalFocusIndex(2, 3, 1)).toBe(0);
    expect(cycleJournalFocusIndex(0, 3, -1)).toBe(2);
    expect(cycleJournalFocusIndex(1, 3, 1)).toBe(2);
  });
});
