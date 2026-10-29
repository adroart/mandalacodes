import React, { useEffect, useId, useRef, useState } from 'react';
import type { AuthoringSession, Capture } from '../../../lib/oracle/authoring/types';
import './capture-shelf.css';
interface Props {
  session: AuthoringSession;
  expanded?: boolean;
  disabled: boolean;
  processingCapture?: string;
  onListen: (captureId: string) => void;
  onTranscribe: (captureId: string) => Promise<void>;
  onImport: (file: File, durationMs: number) => Promise<void>;
}
const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const date = (value: string) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Saved recording' : parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};
export default function CaptureShelf({ session, disabled, processingCapture, onListen, onTranscribe, onImport, expanded=false }: Props) {
  const [file, setFile] = useState<File | null>(null), [seconds, setSeconds] = useState('');
  const [reading, setReading] = useState(false), [detected, setDetected] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [action, setAction] = useState('');
  const importPanel=useRef<HTMLDetailsElement>(null);
  const chooser = useRef<HTMLInputElement>(null), inputId = useId();
  const locked = disabled || Boolean(action);
  useEffect(() => { setFile(null); setSeconds(''); setError(''); setNotice(''); if (chooser.current) chooser.current.value = ''; }, [session.id]);
  useEffect(() => {
    if (!file) { setReading(false); setDetected(false); return; }
    let alive = true, finished = false;
    const audio = document.createElement('audio'), url = URL.createObjectURL(file);
    setReading(true); setDetected(false); setSeconds('');
    const finish = () => {
      if (!alive || finished) return;
      finished = true; setReading(false);
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDetected(true); setSeconds(String(Math.ceil(audio.duration * 1000) / 1000));
        if (audio.duration > 1200) setError('Choose audio no longer than 20 minutes.');
      } else setNotice('This file does not report its length. Enter its duration below.');
    };
    audio.preload = 'metadata'; audio.onloadedmetadata = finish; audio.onerror = finish;
    const timeout = window.setTimeout(finish, 8000);
    audio.src = url;
    return () => { alive = false; window.clearTimeout(timeout); audio.onloadedmetadata = null; audio.onerror = null; audio.removeAttribute('src'); try { audio.load(); } catch { /* Metadata cleanup is best effort. */ } URL.revokeObjectURL(url); };
  }, [file]);
  const choose = (selected: File | undefined) => {
    setError(''); setNotice(''); setFile(null); setSeconds('');
    if (!selected) return;
    if (!selected.type.startsWith('audio/')) { setError('Choose an audio file with a recognized format, such as MP3, M4A or WAV.'); return; }
    if (!selected.size || selected.size > 10 * 1024 * 1024) { setError('Choose an audio file up to 10 MiB. Empty files cannot be transcribed.'); return; }
    setFile(selected);
  };
  const durationMs = Math.round(Number(seconds) * 1000);
  const validDuration = Number.isFinite(durationMs) && durationMs > 0 && durationMs <= 1200000;
  const useAudio = async () => {
    if (!file || !validDuration || reading || locked) return;
    setAction('import'); setError(''); setNotice('');
    try { await onImport(file, durationMs); setFile(null); setSeconds(''); if (chooser.current) chooser.current.value = ''; setNotice('');if(importPanel.current)importPanel.current.open=false; }
    catch (e) { setError(e instanceof Error ? e.message : 'The audio could not be saved. Your selected file is still here to try again.'); }
    finally { setAction(''); }
  };
  const transcribe = async (capture: Capture) => {
    if (locked || processingCapture || session.transcript.some(t => t.captureId === capture.id) || !['ready', 'interrupted'].includes(capture.status)) return;
    setAction(capture.id); setError(''); setNotice('');
    try { await onTranscribe(capture.id); }
    catch (e) { setError(e instanceof Error ? e.message : 'Transcription could not finish. The recording is still saved.'); }
    finally { setAction(''); }
  };
  const recordings=<div className="ov-capture-list">{session.captures.map((capture, index) => {
      const transcribed = session.transcript.some(t => t.captureId === capture.id), working = processingCapture === capture.id || action === capture.id;
      const status = working ? 'Transcribing…' : capture.status === 'empty' ? 'No audio received' : capture.status === 'recording' ? 'Recording in progress' : transcribed ? 'Transcript saved' : capture.status === 'interrupted' ? 'Interrupted · saved audio can be transcribed' : 'Ready to transcribe';
      return <article key={capture.id} className="ov-capture-item" aria-label={`Recording ${index + 1}`}><div><strong>Recording {index + 1} · {clock(capture.durationMs)}</strong><small>{date(capture.recordedAt)} · {capture.origin === 'import' ? 'Added audio' : 'Microphone'}</small><span className="ov-capture-state" role={working ? 'status' : undefined}>{status}</span></div><div className="ov-capture-actions"><button disabled={disabled || capture.status === 'empty' || capture.status === 'recording'} onClick={() => onListen(capture.id)}>Replay recording</button>{!transcribed && ['ready', 'interrupted'].includes(capture.status) && <button disabled={locked || Boolean(processingCapture)} onClick={() => void transcribe(capture)}>Transcribe recording</button>}</div></article>;
    })}</div>;
  const importFields=<><p className="ov-note">Use a recording already on this device, up to 10 MiB and 20 minutes.</p><label htmlFor={inputId}>Audio file<input id={inputId} aria-label="Add audio file" ref={chooser} type="file" accept="audio/*" disabled={locked || Boolean(processingCapture)} onChange={event => choose(event.target.files?.[0])} /></label>
      {file && <div className="ov-import-preview"><strong>{file.name}</strong>{reading ? <p role="status">Reading audio length…</p> : detected ? <p>Duration · {clock(durationMs)}{durationMs > 1200000 && ' · over 20 minutes'}</p> : <label>Duration in seconds<input aria-label="Audio duration in seconds" type="number" min="0.001" max="1200" step="0.001" value={seconds} disabled={locked} onChange={event => setSeconds(event.target.value)} /></label>}<button disabled={locked || Boolean(processingCapture) || reading || !validDuration} onClick={() => void useAudio()}>{action === 'import' ? 'Saving audio…' : 'Use this audio'}</button></div>}
</>;
  return <section className="ov-capture-shelf" aria-label="Saved recordings and audio import">
    {!!session.captures.length&&(expanded?<section><h3>Recordings · {session.captures.length}</h3>{recordings}</section>:<details><summary>Recordings · {session.captures.length}</summary>{recordings}</details>)}
    {expanded?<section className="ov-audio-import"><h3>Add audio</h3>{importFields}</section>:<details ref={importPanel} className="ov-audio-import"><summary>Add audio</summary>{importFields}</details>}
    {error && <p className="ov-capture-error" role="alert">{error}</p>}{notice && <p className="ov-note" role="status">{notice}</p>}
  </section>;
}
