import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import BetterTranscriptNote from './BetterTranscriptNote';
import type { ReflectionSegment, ReflectionSession } from '../../types/oracleReflection';
import { listPendingReflections, type PendingReflection } from '../../lib/oracle/reflectionOutbox';
import {
  listReflectionSegments,
  listReflectionSessions,
  reorderReflectionSegments,
  transcribeReflectionSegment,
  updateReflectionTranscript,
  ReflectionApiError,
} from '../../lib/oracle/reflectionApi';

type OrderedSegment = Pick<ReflectionSegment, 'id' | 'recordedAt' | 'sequence'>;

export function newestReflectionSegments<T extends OrderedSegment>(segments: T[]): T[] {
  return [...segments].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

export function pendingForCard<T extends Pick<PendingReflection, 'hexagramNumber' | 'recordedAt'>>(rows: T[], hexagramNumber: number): T[] {
  return rows.filter((row) => row.hexagramNumber === hexagramNumber).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
}

export function moveReflectionSegment<T extends { id: string }>(segments: T[], id: string, beforeId: string): T[] {
  const from = segments.findIndex((segment) => segment.id === id);
  const before = segments.findIndex((segment) => segment.id === beforeId);
  if (from < 0 || before < 0 || from === before) return segments;
  const next = [...segments];
  const [moved] = next.splice(from, 1);
  const destination = next.findIndex((segment) => segment.id === beforeId);
  next.splice(destination < 0 ? next.length : destination, 0, moved);
  return next;
}

export function cycleJournalFocusIndex(current: number, count: number, direction: 1 | -1): number {
  if (count <= 0) return -1;
  return (current + direction + count) % count;
}

const TRANSCRIPTION_LEASE_MS = 5 * 60 * 1000;
const TRANSCRIPTION_POLL_MS = 30_000;
type TranscriptionPollingWindow = { sessionId: string; expiresAt: number };

export function transcriptionPollingWindow(
  current: TranscriptionPollingWindow | null,
  sessionId: string | null,
  hasTranscribing: boolean,
  nowMs = Date.now(),
): TranscriptionPollingWindow | null {
  if (!sessionId || !hasTranscribing) return null;
  return current?.sessionId === sessionId
    ? current
    : { sessionId, expiresAt: nowMs + TRANSCRIPTION_POLL_MS };
}

export function shouldAutomaticallyTranscribe(
  segment: Pick<ReflectionSegment, 'transcriptionStatus' | 'transcriptionStartedAt'>,
  nowMs = Date.now(),
): boolean {
  if (segment.transcriptionStatus === 'transcription_pending') return true;
  if (segment.transcriptionStatus !== 'transcribing') return false;
  const started = segment.transcriptionStartedAt ? Date.parse(segment.transcriptionStartedAt) : NaN;
  return !Number.isFinite(started) || started <= nowMs - TRANSCRIPTION_LEASE_MS;
}

export function journalTranscriptionFailureMessage(error: unknown): string {
  return error instanceof ReflectionApiError
    ? error.message
    : 'Audio saved privately · retry transcription later';
}

interface Props {
  hexagramNumber: number;
  currentSessionId: string | null;
  pendingCount?: number;
  themeStyle?: React.CSSProperties;
  inactive?: boolean;
  onClose(): void;
  onDone(): void;
  onRecordMore?(): void;
  onCompose?(sessionId: string, segments: ReflectionSegment[]): void;
  onRetryPending?(): Promise<void>;
}

const formatTime = (value: string) => new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(value));

const formatDuration = (seconds: number) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};

const PrivateAudioPlayer: React.FC<{ segment: Pick<ReflectionSegment, 'id' | 'durationMs'>; index: number; src?: string }> = ({ segment, index, src }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(segment.durationMs / 1000);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try { await audio.play(); } catch { setPlaying(false); }
    } else {
      audio.pause();
    }
  };

  return <div className="reflection-segment__player">
    <audio
      ref={audioRef}
      className="reflection-segment__audio"
      preload="metadata"
      src={src ?? `/api/oracle/reflections/segments/${encodeURIComponent(segment.id)}/audio`}
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={() => { setPlaying(false); setCurrentTime(0); }}
      onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
      onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
    />
    <button type="button" className="reflection-segment__play" onClick={() => void toggle()} aria-label={`${playing ? 'Pause' : 'Play'} recording for segment ${index + 1}`}>
      <span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span>
    </button>
    <span className="reflection-segment__elapsed">{formatDuration(currentTime)}</span>
    <input
      type="range"
      min="0"
      max={Math.max(duration, 0.1)}
      step="0.1"
      value={Math.min(currentTime, Math.max(duration, 0.1))}
      aria-label={`Recording position for segment ${index + 1}`}
      onChange={(event) => {
        const next = Number(event.currentTarget.value);
        if (audioRef.current) audioRef.current.currentTime = next;
        setCurrentTime(next);
      }}
    />
    <span className="reflection-segment__duration">{formatDuration(duration)}</span>
    <span className="reflection-segment__private">Private audio</span>
  </div>;
};

const PendingAudioPlayer: React.FC<{ segment: PendingReflection; index: number }> = ({ segment, index }) => {
  const [src, setSrc] = useState('');
  useEffect(() => {
    const url = URL.createObjectURL(segment.blob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [segment.blob]);
  return src ? <PrivateAudioPlayer segment={segment} index={index} src={src} /> : null;
};

export const ReflectionJournal: React.FC<Props> = ({ hexagramNumber, currentSessionId, pendingCount, themeStyle, inactive = false, onClose, onDone, onRecordMore, onCompose, onRetryPending }) => {
  const [sessions, setSessions] = useState<{ current: ReflectionSession | null; history: ReflectionSession[] }>({ current: null, history: [] });
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(currentSessionId);
  const [segments, setSegments] = useState<ReflectionSegment[]>([]);
  const [pending, setPending] = useState<PendingReflection[]>([]);
  const [sending, setSending] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [authoredOrder, setAuthoredOrder] = useState(false);
  const draggedId = useRef<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const autoTranscriptionRef = useRef(new Set<string>());
  const transcriptionPollingRef = useRef<TranscriptionPollingWindow | null>(null);
  const previousPendingCount = useRef(pendingCount);
  const hasTranscribing = segments.some((segment) => segment.transcriptionStatus === 'transcribing');

  const loadPending = useCallback(async () => {
    const rows = await listPendingReflections();
    setPending(pendingForCard(rows, hexagramNumber));
  }, [hexagramNumber]);

  const loadSegments = useCallback(async (sessionId: string, preserveOrder = false) => {
    const rows = await listReflectionSegments(sessionId);
    setSegments(preserveOrder ? rows.sort((a, b) => a.sequence - b.sequence) : newestReflectionSegments(rows));
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    listReflectionSessions(hexagramNumber).then(async (value) => {
      if (!live) return;
      setSessions(value);
      const sessionId = currentSessionId ?? value.current?.id ?? value.history[0]?.id ?? null;
      setSelectedSessionId(sessionId);
      if (sessionId) await loadSegments(sessionId);
    }).catch(() => setMessage('Journal could not be loaded. Try again.')).finally(() => live && setLoading(false));
    closeRef.current?.focus();
    return () => { live = false; };
  }, [currentSessionId, hexagramNumber, loadSegments]);

  useEffect(() => {
    const refresh = () => { void loadPending().catch(() => setMessage('Device recordings could not be loaded. Try reopening Journal.')); };
    window.addEventListener('online', refresh);
    return () => window.removeEventListener('online', refresh);
  }, [loadPending]);

  useEffect(() => {
    void loadPending().catch(() => setMessage('Device recordings could not be loaded. Try reopening Journal.'));
  }, [loadPending, pendingCount]);

  useEffect(() => {
    const previous = previousPendingCount.current;
    previousPendingCount.current = pendingCount;
    if (previous === undefined || pendingCount === undefined || pendingCount >= previous) return;
    void listReflectionSessions(hexagramNumber)
      .then(async (value) => {
        setSessions(value);
        const sessionId = selectedSessionId ?? value.current?.id ?? value.history[0]?.id ?? null;
        if (sessionId) { setSelectedSessionId(sessionId); await loadSegments(sessionId); }
      })
      .catch(() => setMessage('Recording sent, but Journal could not refresh. Reopen it to check.'));
  }, [hexagramNumber, loadSegments, pendingCount, selectedSessionId]);

  const sendPending = async () => {
    if (!onRetryPending || sending) return;
    setSending(true);
    setMessage('Trying to send recordings…');
    try {
      await onRetryPending();
      await loadPending();
      const value = await listReflectionSessions(hexagramNumber);
      setSessions(value);
      const sessionId = selectedSessionId ?? value.current?.id ?? value.history[0]?.id ?? null;
      if (sessionId) { setSelectedSessionId(sessionId); await loadSegments(sessionId); }
      setMessage((await listPendingReflections()).some((row) => row.hexagramNumber === hexagramNumber)
        ? 'Still saved on this device. Connect and try sending again.'
        : 'Recordings sent.');
    } catch {
      await loadPending().catch(() => undefined);
      setMessage('Could not confirm delivery. Recordings still on this device may need another try.');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const trapFocus = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
    ) ?? []).filter((element) => !element.hasAttribute('hidden'));
    if (!focusable.length) return;
    const current = focusable.indexOf(document.activeElement as HTMLElement);
    const next = current < 0
      ? (event.shiftKey ? focusable.length - 1 : 0)
      : cycleJournalFocusIndex(current, focusable.length, event.shiftKey ? -1 : 1);
    if ((event.shiftKey && current <= 0) || (!event.shiftKey && current === focusable.length - 1) || current < 0) {
      event.preventDefault();
      focusable[next].focus();
    }
  };

  useEffect(() => {
    const polling = transcriptionPollingWindow(transcriptionPollingRef.current, selectedSessionId, hasTranscribing);
    transcriptionPollingRef.current = polling;
    if (!polling || Date.now() >= polling.expiresAt) return;
    const timer = window.setInterval(() => {
      if (Date.now() >= polling.expiresAt) return window.clearInterval(timer);
      void loadSegments(selectedSessionId, authoredOrder);
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [authoredOrder, hasTranscribing, loadSegments, selectedSessionId]);

  const selectSession = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setAuthoredOrder(false);
    setLoading(true);
    setHistoryOpen(false);
    try { await loadSegments(sessionId); }
    catch { setMessage('Session could not be loaded.'); }
    finally { setLoading(false); }
  };

  const persistOrder = async (next: ReflectionSegment[]) => {
    if (!selectedSessionId) return;
    const previous = segments;
    setSegments(next);
    setAuthoredOrder(true);
    try {
      const saved = await reorderReflectionSegments(selectedSessionId, next.map(({ id }) => id));
      setSegments(saved.sort((a, b) => a.sequence - b.sequence));
      setMessage('Order saved.');
    } catch {
      setSegments(previous);
      setMessage('Order was not saved. Your previous order is restored.');
    }
  };

  const moveBy = (id: string, offset: number) => {
    const index = segments.findIndex((segment) => segment.id === id);
    const destination = index + offset;
    if (index < 0 || destination < 0 || destination >= segments.length) return;
    const next = [...segments];
    [next[index], next[destination]] = [next[destination], next[index]];
    void persistOrder(next);
  };

  const saveTranscript = async (segment: ReflectionSegment) => {
    try {
      const saved = await updateReflectionTranscript(segment.id, draft);
      setSegments((rows) => rows.map((row) => row.id === saved.id ? saved : row));
      setEditingId(null);
      setMessage('Transcript saved.');
    } catch { setMessage('Transcript was not saved. Try again.'); }
  };

  const transcribe = useCallback(async (id: string) => {
    const saved = await transcribeReflectionSegment(id);
    setSegments((rows) => rows.map((row) => row.id === saved.id ? saved : row));
    return saved;
  }, []);

  const retry = async (id: string) => {
    setMessage('Retrying transcription…');
    try {
      const saved = await transcribe(id);
      setMessage(saved.transcriptionStatus === 'transcribed' ? 'Transcription ready.' : 'Audio saved privately · retry transcription later');
    } catch (error) { setMessage(journalTranscriptionFailureMessage(error)); }
  };

  useEffect(() => {
    const pending = segments.filter((segment) =>
      shouldAutomaticallyTranscribe(segment)
      && !autoTranscriptionRef.current.has(segment.id));
    if (!pending.length) return;
    pending.forEach((segment) => autoTranscriptionRef.current.add(segment.id));
    setMessage(pending.length === 1 ? 'Transcribing saved reflection…' : `Transcribing ${pending.length} saved reflections…`);
    void Promise.all(pending.map((segment) => transcribe(segment.id)))
      .then((saved) => setMessage(saved.every((segment) => segment.transcriptionStatus === 'transcribed') ? 'Transcription ready.' : 'Some audio is still waiting for transcription.'))
      .catch((error) => setMessage(journalTranscriptionFailureMessage(error)));
  }, [segments, transcribe]);

  const journal = (
    <section className="reflection-journal" style={themeStyle} role="dialog" aria-modal="true" aria-hidden={inactive || undefined} data-inactive={inactive || undefined} aria-labelledby="reflection-journal-title" onKeyDown={trapFocus}>
      <div ref={sheetRef} className="reflection-journal__sheet">
        <header className="reflection-journal__header">
          <div><span className="reflection-journal__eyebrow">Private reflection</span><h2 id="reflection-journal-title">Journal · {hexagramNumber}</h2></div>
          <button ref={closeRef} className="reflection-journal__close" type="button" onClick={onClose} aria-label="Close journal">Close</button>
        </header>

        {sessions.history.length > 0 && <div className="reflection-journal__history">
          <button type="button" aria-expanded={historyOpen} onClick={() => setHistoryOpen((open) => !open)}>History <span>{sessions.history.length}</span></button>
          {historyOpen && <div className="reflection-journal__history-list">{sessions.history.map((session) =>
            <button key={session.id} type="button" aria-current={selectedSessionId === session.id ? 'true' : undefined} onClick={() => void selectSession(session.id)}>
              {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(session.createdAt))}
            </button>)}</div>}
        </div>}

        <p className="reflection-journal__announce" aria-live="polite">{message}</p>
        {pending.length > 0 && <div className="reflection-journal__pending" aria-label="Recordings waiting to send">
          <div className="reflection-journal__pending-heading"><div><h3>On this device</h3><p>Waiting to send when connected. Keep this browser’s data until they have sent.</p></div>
            {onRetryPending && <button type="button" disabled={sending} onClick={() => void sendPending()}>{sending ? 'Sending…' : 'Try sending'}</button>}</div>
          {pending.map((segment, index) => <article className="reflection-segment reflection-segment--pending" key={segment.id}>
            <header className="reflection-segment__header"><span>RECORDING · {formatTime(segment.recordedAt)}</span><span className="reflection-segment__pending-state">Saved on this device · waiting to send</span></header>
            <PendingAudioPlayer segment={segment} index={index} />
          </article>)}
        </div>}
        <div className="reflection-journal__segments" aria-busy={loading}>
          {!loading && segments.length === 0 && pending.length === 0 && <p className="reflection-journal__empty">Pause a recording to add the first segment.</p>}
          {segments.map((segment, index) => <article
            className={`reflection-segment${index === 0 ? ' is-newest' : ''}`} key={segment.id} draggable
            onDragStart={() => { draggedId.current = segment.id; }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => { if (draggedId.current) void persistOrder(moveReflectionSegment(segments, draggedId.current, segment.id)); draggedId.current = null; }}>
            <header className="reflection-segment__header">
              <span className="reflection-segment__handle" aria-hidden="true">⠿</span>
              <span>SEGMENT {segment.sequence + 1} · {formatTime(segment.recordedAt)}</span>
              <span className="reflection-segment__moves">
                <button type="button" onClick={() => moveBy(segment.id, -1)} disabled={index === 0} aria-label={`Move segment ${index + 1} up`}>↑</button>
                <button type="button" onClick={() => moveBy(segment.id, 1)} disabled={index === segments.length - 1} aria-label={`Move segment ${index + 1} down`}>↓</button>
              </span>
              <button className="reflection-segment__edit" type="button" onClick={() => { setEditingId(segment.id); setDraft(segment.transcript); }}>Edit</button>
            </header>
            <PrivateAudioPlayer segment={segment} index={index} />
            {editingId === segment.id ? <div className="reflection-segment__editor">
              <label htmlFor={`reflection-${segment.id}`}>Transcript</label>
              <textarea id={`reflection-${segment.id}`} value={draft} onChange={(event) => setDraft(event.target.value)} autoFocus />
              <div><button type="button" onClick={() => void saveTranscript(segment)}>Save</button><button type="button" onClick={() => setEditingId(null)}>Cancel</button></div>
            </div> : <div className="reflection-segment__body">
              {segment.transcript ? <p className="reflection-segment__transcript">{segment.transcript}</p> : <p className="reflection-segment__status">{
                segment.transcriptionStatus === 'uploading' ? 'Uploading audio…'
                  : segment.transcriptionStatus === 'transcribing' ? 'Transcribing audio…'
                    : segment.transcriptionStatus === 'failed' ? 'Transcription needs retry'
                      : 'Queued for transcription'
              }</p>}
              <span className="reflection-segment__transcription-state" data-state={segment.transcriptionStatus}>{
                segment.transcriptionStatus === 'transcribed' ? 'Ready'
                  : segment.transcriptionStatus === 'uploading' ? 'Uploading'
                    : segment.transcriptionStatus === 'transcribing' ? 'Transcribing'
                      : segment.transcriptionStatus === 'failed' ? 'Needs retry'
                        : 'Queued'
              }</span>
              {segment.transcriptionError && <p className="reflection-segment__transcription-error">{segment.transcriptionError}</p>}
              <BetterTranscriptNote segment={segment} onMessage={setMessage}
                onSegment={(saved) => setSegments((rows) => rows.map((row) => row.id === saved.id ? saved : row))} />
              {(segment.transcriptionStatus === 'transcription_pending' || segment.transcriptionStatus === 'failed') && <button type="button" onClick={() => void retry(segment.id)}>Retry</button>}
            </div>}
          </article>)}
        </div>
        <footer className="reflection-journal__actions" aria-label="Journal actions">
          <button type="button" onClick={onRecordMore ?? onClose}>Record more</button>
          <button type="button" disabled={!selectedSessionId || segments.length === 0 || !onCompose} onClick={() => { if (selectedSessionId && onCompose) onCompose(selectedSessionId, segments); }}>Shift to invocation</button>
          <button type="button" className="is-primary" onClick={onDone} aria-label="Done with reflection">Done</button>
        </footer>
      </div>
    </section>
  );

  return createPortal(journal, document.body);
};

export default ReflectionJournal;
