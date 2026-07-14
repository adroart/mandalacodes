import React, { useEffect, useRef, useState } from 'react';
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

const RecorderIcon: React.FC<{ name: 'pause' | 'play' | 'finish' | 'check' | 'journal' }> = ({ name }) => {
  if (name === 'pause') return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3v10M11 3v10" /></svg>;
  if (name === 'play') return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5 3 7 5-7 5Z" /></svg>;
  if (name === 'finish') return <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="4" width="8" height="8" /></svg>;
  if (name === 'check') return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>;
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.5h7.5A2.5 2.5 0 0 1 13 6v7H5.5A2.5 2.5 0 0 1 3 10.5Z" /><path d="M6 3.5v9.5" /></svg>;
};

export const ReflectionRecorderBar: React.FC<Props> = ({ hexagramNumber, recorder, onInvocationPublished }) => {
  const [journalOpen, setJournalOpen] = useState(false);
  const [composer, setComposer] = useState<{ sessionId: string; segments: RecorderSegment[] } | null>(null);
  const journalButtonRef = useRef<HTMLButtonElement>(null);
  const restoreJournalFocus = useRef(false);
  const { state } = recorder;
  if (state.status === 'idle') return null;
  const isRecording = state.status === 'recording';
  const isFinished = state.status === 'finished';
  const status = state.status === 'requesting_permission'
    ? 'Requesting microphone permission…'
    : state.status === 'committing'
    ? 'Saving segment…'
    : state.pendingCount > 0
      ? 'Saved on this device · retrying'
      : state.message ?? (isRecording ? 'Recording privately' : 'Paused');
  const shortStatus = state.status === 'requesting_permission'
    ? 'Waiting'
    : state.status === 'committing'
      ? 'Saving'
      : state.status === 'error'
        ? 'Error'
        : isFinished
          ? 'Saved'
        : state.pendingCount > 0
          ? 'Offline'
          : isRecording ? 'Recording' : 'Paused';

  useEffect(() => {
    if (!journalOpen && restoreJournalFocus.current) {
      restoreJournalFocus.current = false;
      journalButtonRef.current?.focus();
    }
  }, [journalOpen]);

  return <>
    {!journalOpen && <nav className="oracle-bottom-nav reflection-recorder-bar" aria-label="Private reflection recorder">
      <div className="oracle-bottom-nav__inner reflection-recorder-bar__inner">
        <button className="oracle-bottom-nav__slot reflection-recorder-bar__slot reflection-recorder-bar__control" type="button"
          disabled={state.status === 'committing' || state.status === 'requesting_permission' || isFinished}
          onClick={state.status === 'error' ? recorder.finish : isRecording ? recorder.pause : recorder.resume}
          aria-label={state.status === 'error' ? 'Dismiss recording error' : isRecording ? 'Pause and save this segment' : 'Resume recording a new segment'}>
          <RecorderIcon name={isRecording ? 'pause' : 'play'} />
          <span className="oracle-bottom-nav__label">{state.status === 'requesting_permission' ? 'Waiting' : state.status === 'committing' ? 'Saving' : state.status === 'error' ? 'Dismiss' : isRecording ? 'Pause' : 'Resume'}</span>
        </button>
        <div className="oracle-bottom-nav__slot reflection-recorder-bar__slot reflection-recorder-bar__metric" aria-label={`Elapsed time ${elapsed(state.elapsedMs)}`}>
          <span className="reflection-recorder-bar__value">{elapsed(state.elapsedMs)}</span>
          <span className="oracle-bottom-nav__label">Time</span>
        </div>
        <div className="oracle-bottom-nav__slot oracle-bottom-nav__current reflection-recorder-bar__slot reflection-recorder-bar__center">
          <span className="oracle-bottom-nav__number reflection-recorder-bar__number">{hexagramNumber}</span>
          <span className="oracle-bottom-nav__label reflection-recorder-bar__state"><i className={isRecording ? 'is-live' : ''} aria-hidden="true" />{shortStatus}</span>
        </div>
        <button className="oracle-bottom-nav__slot reflection-recorder-bar__slot reflection-recorder-bar__control" type="button" disabled={isFinished} onClick={() => void recorder.finish()} aria-label="Finish private reflection">
          <RecorderIcon name={isFinished ? 'check' : 'finish'} />
          <span className="oracle-bottom-nav__label">{isFinished ? 'Saved' : 'Finish'}</span>
        </button>
        <button ref={journalButtonRef} className="oracle-bottom-nav__slot reflection-recorder-bar__slot reflection-recorder-bar__control" type="button" disabled={isFinished} onClick={() => { restoreJournalFocus.current = true; setJournalOpen(true); }} aria-haspopup="dialog">
          <RecorderIcon name="journal" />
          <span className="oracle-bottom-nav__label">Journal</span>
        </button>
      </div>
      <span className="reflection-recorder-bar__announcement" aria-live="polite">{status}</span>
    </nav>}
    {journalOpen && <ReflectionJournal
      hexagramNumber={hexagramNumber}
      currentSessionId={state.sessionId}
      onClose={() => setJournalOpen(false)}
      onRecordMore={() => {
        setJournalOpen(false);
        if (state.status === 'paused') recorder.resume();
      }}
      onCompose={(sessionId, segments) => {
        restoreJournalFocus.current = false;
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
