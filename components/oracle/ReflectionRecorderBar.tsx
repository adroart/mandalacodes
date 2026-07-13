import React, { useState } from 'react';
import type { UseReflectionRecorderResult } from '../../hooks/useReflectionRecorder';
import ReflectionJournal from './ReflectionJournal';
import InvocationComposer from './invocation/InvocationComposer';
import type { RecorderSegment } from '../../lib/oracle/invocationTypes';
import './reflection-recorder.css';

interface Props {
  hexagramNumber: number;
  recorder: UseReflectionRecorderResult;
  onInvocationPublished?(): void;
}

const elapsed = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

export const ReflectionRecorderBar: React.FC<Props> = ({ hexagramNumber, recorder, onInvocationPublished }) => {
  const [journalOpen, setJournalOpen] = useState(false);
  const [composer, setComposer] = useState<{ sessionId: string; segments: RecorderSegment[] } | null>(null);
  const { state } = recorder;
  if (state.status === 'idle') return null;
  const isRecording = state.status === 'recording';
  const status = state.status === 'requesting_permission'
    ? 'Requesting microphone permission…'
    : state.status === 'committing'
    ? 'Saving segment…'
    : state.pendingCount > 0
      ? 'Saved on this device · retrying'
      : state.message ?? (isRecording ? 'Recording privately' : 'Paused');

  return <>
    <nav className="reflection-recorder-bar" aria-label="Private reflection recorder">
      <div className="reflection-recorder-bar__inner">
        <button className="reflection-recorder-bar__control" type="button"
          disabled={state.status === 'committing' || state.status === 'requesting_permission'}
          onClick={state.status === 'error' ? recorder.finish : isRecording ? recorder.pause : recorder.resume}
          aria-label={state.status === 'error' ? 'Dismiss recording error' : isRecording ? 'Pause and save this segment' : 'Resume recording a new segment'}>
          <span className={`reflection-recorder-bar__control-icon ${isRecording ? 'is-pause' : 'is-resume'}`} aria-hidden="true" />
          <span>{state.status === 'requesting_permission' ? 'Waiting' : state.status === 'committing' ? 'Saving' : state.status === 'error' ? 'Dismiss' : isRecording ? 'Pause' : 'Resume'}</span>
        </button>
        <div className="reflection-recorder-bar__center">
          <span className="reflection-recorder-bar__number">{hexagramNumber}</span>
          <span className={`reflection-recorder-bar__wave ${isRecording ? 'is-live' : ''}`} aria-hidden="true"><i /><i /><i /><i /><i /></span>
          <span className="reflection-recorder-bar__elapsed">{elapsed(state.elapsedMs)}</span>
          <span className="reflection-recorder-bar__status" aria-live="polite">{status}</span>
        </div>
        <button className="reflection-recorder-bar__control" type="button" onClick={() => setJournalOpen(true)} aria-haspopup="dialog">
          <span className="reflection-recorder-bar__journal-icon" aria-hidden="true" />
          <span>Journal</span>
        </button>
      </div>
    </nav>
    {journalOpen && <ReflectionJournal
      hexagramNumber={hexagramNumber}
      currentSessionId={state.sessionId}
      onClose={() => setJournalOpen(false)}
      onCompose={(sessionId, segments) => {
        setJournalOpen(false);
        setComposer({
          sessionId,
          segments: segments.map((segment) => ({
            id: segment.id,
            transcript: segment.transcript,
            sortOrder: segment.sequence,
            createdAt: segment.recordedAt,
          })),
        });
      }}
    />}
    {composer && <InvocationComposer
      hexagramNumber={hexagramNumber}
      sessionId={composer.sessionId}
      segments={composer.segments}
      onClose={() => setComposer(null)}
      onPublished={onInvocationPublished}
    />}
  </>;
};

export default ReflectionRecorderBar;
