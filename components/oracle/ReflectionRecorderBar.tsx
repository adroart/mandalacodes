import React, { useEffect, useRef, useState } from 'react';
import type { UseReflectionRecorderResult } from '../../hooks/useReflectionRecorder';
import ReflectionJournal from './ReflectionJournal';
import InvocationComposer from './invocation/InvocationComposer';
import type { RecorderSegment } from '../../lib/oracle/invocationTypes';
import { formatRecorderSegmentCount, triggerRecorderHaptic } from '../../lib/oracle/reflectionRecorderFeedback';
import './reflection-recorder.css';

const REFLECTION_HISTORY_KEY = '__mandalaReflectionLayer';

interface Props {
  hexagramNumber: number;
  recorder: UseReflectionRecorderResult;
  onInvocationPublished?(): void;
}

type ReflectionThemeStyle = React.CSSProperties & Record<`--${string}`, string>;

const reflectionThemeStyle = (): ReflectionThemeStyle => {
  if (typeof document === 'undefined') return {} as ReflectionThemeStyle;
  const source = document.querySelector<HTMLElement>('[data-oracle-reader]') ?? document.documentElement;
  const computed = getComputedStyle(source);
  return ['--l-bg', '--l-1', '--l-2', '--l-3', '--l-rule', '--l-soft', '--accent', '--font-display', '--font-ui']
    .reduce<ReflectionThemeStyle>((theme, property) => {
      const value = computed.getPropertyValue(property).trim();
      if (value) theme[property as `--${string}`] = value;
      return theme;
    }, {} as ReflectionThemeStyle);
};

const elapsed = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

const RecorderIcon: React.FC<{ name: 'pause' | 'play' | 'finish' | 'check' | 'journal' }> = ({ name }) => {
  if (name === 'pause') return <svg className="is-pause" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3v10M11 3v10" /></svg>;
  if (name === 'play') return <svg className="is-play" viewBox="0 0 16 16" aria-hidden="true"><path d="m5 3 7 5-7 5Z" /></svg>;
  if (name === 'finish') return <svg className="is-finish" viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="4" width="8" height="8" /></svg>;
  if (name === 'check') return <svg className="is-check" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>;
  return <svg className="is-journal" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.5h7.5A2.5 2.5 0 0 1 13 6v7H5.5A2.5 2.5 0 0 1 3 10.5Z" /><path d="M6 3.5v9.5" /></svg>;
};

export const ReflectionRecorderBar: React.FC<Props> = ({ hexagramNumber, recorder, onInvocationPublished }) => {
  const [journalOpen, setJournalOpen] = useState(false);
  const [composer, setComposer] = useState<{ sessionId: string; segments: RecorderSegment[] } | null>(null);
  const [themeStyle, setThemeStyle] = useState<ReflectionThemeStyle>(() => reflectionThemeStyle());
  const journalButtonRef = useRef<HTMLButtonElement>(null);
  const restoreJournalFocus = useRef(false);
  const historyDepthRef = useRef(0);
  const ignoreNextPopRef = useRef(false);
  const { state } = recorder;
  if (state.status === 'idle') return null;
  const isRecording = state.status === 'recording';
  const isFinished = state.status === 'finished';
  const isSavedConfirmation = state.confirmation === 'saved' && !isFinished;
  const transcriptionNeedsRetry = state.status === 'paused'
    && Boolean(state.message)
    && state.pendingCount === 0;
  const segmentBadge = formatRecorderSegmentCount(state.savedSegmentCount);
  const status = state.status === 'requesting_permission'
    ? 'Requesting microphone permission…'
    : state.status === 'committing'
    ? state.message === 'Uploading' ? 'Uploading private reflection…' : 'Saving private reflection…'
    : state.status === 'error'
      ? state.message ?? 'Recording needs retry'
    : transcriptionNeedsRetry
      ? state.message!
    : isSavedConfirmation
      ? 'Saved privately'
    : state.pendingCount > 0
      ? 'Saved on device'
      : state.message ?? (isRecording ? 'Recording privately' : 'Paused');
  const shortStatus = state.status === 'requesting_permission'
    ? 'Requesting mic'
    : state.status === 'committing'
      ? state.message === 'Uploading' ? 'Uploading' : 'Saving'
      : state.status === 'error'
        ? 'Needs retry'
        : isFinished
          ? 'Saved'
        : transcriptionNeedsRetry
          ? 'Transcript retry'
        : isSavedConfirmation
          ? 'Saved privately'
        : state.pendingCount > 0
          ? 'Saved on device'
          : isRecording ? 'Recording' : 'Paused';

  useEffect(() => {
    if (!journalOpen && restoreJournalFocus.current) {
      restoreJournalFocus.current = false;
      journalButtonRef.current?.focus();
    }
  }, [journalOpen]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (ignoreNextPopRef.current) {
        ignoreNextPopRef.current = false;
        return;
      }
      const layer = (event.state as Record<string, unknown> | null)?.[REFLECTION_HISTORY_KEY];
      if (layer === 'journal') {
        historyDepthRef.current = 1;
        setComposer(null);
        setJournalOpen(true);
        return;
      }
      historyDepthRef.current = 0;
      setComposer(null);
      setJournalOpen(false);
      void recorder.exit();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [recorder]);

  const pushReflectionLayer = (layer: 'journal' | 'invocation') => {
    window.history.pushState({
      ...(window.history.state as Record<string, unknown> | null),
      [REFLECTION_HISTORY_KEY]: layer,
    }, '', window.location.href);
    historyDepthRef.current += 1;
  };

  const openJournal = () => {
    if (!journalOpen) pushReflectionLayer('journal');
    setThemeStyle(reflectionThemeStyle());
    setJournalOpen(true);
  };

  const openJournalAfterFinish = async () => {
    const saved = await recorder.pause();
    if (saved) openJournal();
  };

  const exitReflection = async () => {
    const historyDepth = historyDepthRef.current;
    historyDepthRef.current = 0;
    setComposer(null);
    setJournalOpen(false);
    if (historyDepth > 0) {
      ignoreNextPopRef.current = true;
      window.history.go(-historyDepth);
    }
    await recorder.exit();
  };

  return <>
    {!journalOpen && <nav className="oracle-bottom-nav reflection-recorder-bar" style={themeStyle} aria-label="Private reflection recorder">
      <div className="oracle-bottom-nav__inner reflection-recorder-bar__inner">
        <button className={`oracle-bottom-nav__slot reflection-recorder-bar__slot reflection-recorder-bar__control${!isRecording && state.status === 'paused' ? ' is-primary' : ''}`} type="button"
          disabled={state.status === 'committing' || state.status === 'requesting_permission' || isFinished}
          onPointerDown={() => triggerRecorderHaptic('press')}
          onClick={state.status === 'error' ? recorder.finish : isRecording ? recorder.pause : recorder.resume}
          aria-label={state.status === 'error' ? 'Dismiss recording error' : isRecording ? 'Pause and save this segment' : 'Resume recording a new segment'}>
          <RecorderIcon name={isRecording ? 'pause' : 'play'} />
          <span className="oracle-bottom-nav__label">{state.status === 'requesting_permission' ? 'Waiting' : state.status === 'committing' ? 'Saving' : state.status === 'error' ? 'Dismiss' : isRecording ? 'Pause' : 'Resume'}</span>
        </button>
        <div className="oracle-bottom-nav__slot reflection-recorder-bar__slot reflection-recorder-bar__metric" aria-label={`Elapsed time ${elapsed(state.elapsedMs)}`}>
          <span className="reflection-recorder-bar__value">{elapsed(state.elapsedMs)}</span>
          <span className="oracle-bottom-nav__label">Time</span>
        </div>
        <div className={`oracle-bottom-nav__slot oracle-bottom-nav__current reflection-recorder-bar__slot reflection-recorder-bar__center${isSavedConfirmation ? ' is-saved' : ''}`}>
          <span className="reflection-recorder-bar__center-top">
            <span className="oracle-bottom-nav__number reflection-recorder-bar__number">{isSavedConfirmation ? '✓' : hexagramNumber}</span>
            {isRecording && <span className="reflection-recorder-bar__meter" aria-hidden="true">
              {[{ base: .42, weight: .45 }, { base: .7, weight: .3 }, { base: .5, weight: .42 }].map(({ base, weight }, index) => <i
                className="reflection-recorder-bar__meter-bar"
                key={index}
                style={{ transform: `scaleY(${Math.min(1, base + recorder.micLevel * weight)})`, opacity: Math.max(.68, recorder.micLevel) }}
                data-bar={index + 1}
              />)}
            </span>}
          </span>
          <span className="oracle-bottom-nav__label reflection-recorder-bar__state"><i className={isRecording ? 'is-live' : ''} aria-hidden="true" />{shortStatus}</span>
        </div>
        <button className="oracle-bottom-nav__slot reflection-recorder-bar__slot reflection-recorder-bar__control" type="button" disabled={isFinished || state.status === 'requesting_permission' || state.status === 'committing'} onPointerDown={() => triggerRecorderHaptic('press')} onClick={() => void openJournalAfterFinish()} aria-label="Finish private reflection">
          <RecorderIcon name={isFinished ? 'check' : 'finish'} />
          <span className="oracle-bottom-nav__label">{isFinished ? 'Saved' : 'Finish'}</span>
        </button>
        <button ref={journalButtonRef} className="oracle-bottom-nav__slot reflection-recorder-bar__slot reflection-recorder-bar__control reflection-recorder-bar__journal" type="button" disabled={isFinished} onPointerDown={() => triggerRecorderHaptic('press')} onClick={() => { restoreJournalFocus.current = true; openJournal(); }} aria-haspopup="dialog" aria-label={segmentBadge ? `Journal, ${state.savedSegmentCount} saved ${state.savedSegmentCount === 1 ? 'segment' : 'segments'}` : 'Journal'}>
          <RecorderIcon name="journal" />
          <span className="oracle-bottom-nav__label">Journal</span>
          {segmentBadge && <span className="reflection-recorder-bar__badge" aria-hidden="true">{segmentBadge}</span>}
        </button>
      </div>
      {transcriptionNeedsRetry && <div className="reflection-recorder-bar__transcription-notice" role="status">
        <span>Audio saved privately</span>
        <strong>{state.message}</strong>
      </div>}
      <span className="reflection-recorder-bar__announcement" aria-live="polite">{status}</span>
    </nav>}
    {journalOpen && <ReflectionJournal
      hexagramNumber={hexagramNumber}
      currentSessionId={state.sessionId}
      themeStyle={themeStyle}
      inactive={Boolean(composer)}
      onClose={() => void exitReflection()}
      onDone={() => void exitReflection()}
      onRecordMore={() => {
        historyDepthRef.current = Math.max(0, historyDepthRef.current - 1);
        ignoreNextPopRef.current = true;
        window.history.back();
        setJournalOpen(false);
        if (state.status === 'paused') recorder.resume();
      }}
      onCompose={(sessionId, segments) => {
        restoreJournalFocus.current = false;
        pushReflectionLayer('invocation');
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
      themeStyle={themeStyle}
      onClose={() => window.history.back()}
      onDone={() => void exitReflection()}
      onPublished={onInvocationPublished}
    />}
  </>;
};

export default ReflectionRecorderBar;
