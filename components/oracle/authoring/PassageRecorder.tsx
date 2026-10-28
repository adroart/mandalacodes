import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AuthoringServices, SourceSnapshot } from '../../../lib/oracle/authoring/types';
import type { PassageAnchor } from '../../../lib/oracle/authoring/passageContext';
import { AuthoringStore, type SavedSession } from '../../../lib/oracle/authoring/storage';
import { addTranscript, correctTranscript, createSession } from '../../../lib/oracle/authoring/workflow';
import { startCapture, type ActiveCapture } from '../../../lib/oracle/authoring/recorder';
import { applyPassageReplacement } from '../../../src/mobile/authoring/passageActions';
import './PassageRecorder.css';

interface Props {
  anchors: PassageAnchor[];
  source: SourceSnapshot;
  services: AuthoringServices;
  onApplied: (anchor:PassageAnchor) => void;
  onClose: () => void;
}
const elapsedLabel = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

/** One deliberate replacement: original → recorded words → explicit human check. */
export default function PassageRecorder({ anchors, source, services, onApplied, onClose }: Props) {
  const store = useMemo(() => new AuthoringStore(), []);
  const sorted = useMemo(() => [...anchors].sort((a, b) => a.start - b.start), [anchors]);
  const combined = useMemo<PassageAnchor | null>(() => {
    if (sorted.length < 2) return null;
    const first = sorted[0], last = sorted[sorted.length - 1];
    if (!sorted.every(a => a.cardNumber === first.cardNumber && a.sectionId === first.sectionId && a.sectionText === first.sectionText && a.revision === first.revision && a.sourceHash === first.sourceHash)) return null;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].start < sorted[i - 1].end || first.sectionText.slice(sorted[i - 1].end, sorted[i].start).trim()) return null;
    }
    return { ...first, id: 'combined', end: last.end, text: first.sectionText.slice(first.start, last.end) };
  }, [sorted]);
  const [targetId, setTargetId] = useState(combined ? 'combined' : anchors[0]?.id ?? '');
  const target = targetId === 'combined' ? combined : anchors.find(a => a.id === targetId) ?? null;
  const [saved, setSaved] = useState<SavedSession | null>(null);
  const [active, setActive] = useState<ActiveCapture | null>(null);
  const [monitor, setMonitor] = useState({ elapsed: 0, paused: false, muted: false, level: null as number | null });
  const [phase, setPhase] = useState<'prompt' | 'transcribing' | 'review'>('prompt');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [text, setText] = useState(''), [audioUrl, setAudioUrl] = useState('');
  const [captureId, setCaptureId] = useState(''), [uncertain, setUncertain] = useState<string[]>([]);
  const [fontSize, setFontSize] = useState(28), [speed, setSpeed] = useState(0);
  const prompt = useRef<HTMLDivElement>(null), editor = useRef<HTMLTextAreaElement>(null);
  const player = useRef<HTMLAudioElement>(null), handle = useRef<ActiveCapture | null>(null), mounted = useRef(true);
  const savedRef = useRef<SavedSession | null>(null), targetRef = useRef(target);
  targetRef.current = target;
  const report = (e: unknown) => { if (mounted.current) setError(e instanceof Error ? e.message : 'Your recording is saved. Try again.'); };
  const accept = (value: SavedSession) => { savedRef.current = value; if (mounted.current) setSaved(value); };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; void handle.current?.stop().catch(() => undefined); }; }, []);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);
  useEffect(() => { if (phase === 'review') editor.current?.focus(); }, [phase]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setMonitor({ elapsed: active.elapsed(), paused: active.state() === 'paused', muted: active.muted(), level: active.level() }), 150);
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => { clearInterval(timer); window.removeEventListener('beforeunload', warn); };
  }, [active]);
  useEffect(() => {
    if (!active || monitor.paused || !speed) return;
    const timer = window.setInterval(() => { if (prompt.current) prompt.current.scrollTop += speed / 10; }, 100);
    return () => clearInterval(timer);
  }, [active, monitor.paused, speed]);

  const transcribe = async (value: SavedSession, id: string) => {
    const selected = targetRef.current;
    if (!selected) return;
    setBusy(true); setPhase('transcribing'); setError('');
    try {
      if (!services.transcribe) throw new Error('Connect to your Mac to transcribe. Your recording is saved; try transcription again after connecting.');
      const latest = await store.load(value.session.id);
      if (!latest) throw new Error('The saved recording could not be opened.');
      const capture = latest.session.captures.find(c => c.id === id);
      if (!capture || capture.status === 'empty') throw new Error('No audio was received. Try recording again.');
      const blob = await store.audio(latest.session.id, id);
      if (mounted.current) setAudioUrl(URL.createObjectURL(blob));
      let next = latest;
      let segments = latest.session.transcript.filter(t => t.captureId === id);
      if (!segments.length) {
        const response = await services.transcribe(latest.session, capture, blob);
        const current = await store.load(latest.session.id);
        if (!current) throw new Error('The saved recording could not be opened.');
        const withReceipt = { ...current.session, captures: current.session.captures.map(c => c.id === id ? { ...c, durationMs: Math.max(c.durationMs, response.durationMs ?? 0), ...(response.arCreate ? { arCreate: response.arCreate } : {}) } : c) };
        const session = addTranscript(withReceipt, id, response.segments.map(segment => ({ ...segment, cardNumber: selected.cardNumber, sectionId: selected.sectionId })), response.provider);
        next = { session, version: await store.save(session, current.version) };
        segments = session.transcript.filter(t => t.captureId === id);
      }
      accept(next);
      if (!mounted.current) return;
      setText(segments.map(t => t.corrected).join('\n\n'));
      setUncertain(segments.flatMap(t => (t.words ?? []).filter(w => w.probability !== undefined && w.probability < .6).map(w => w.text)));
      setPhase('review');
      if (!segments.some(t => t.corrected.trim())) setError('No words were returned. Listen to your recording, then retry or type your words below.');
    } catch (e) { report(e); } finally { if (mounted.current) setBusy(false); }
  };
  const record = async () => {
    if (!target || busy || active) return;
    player.current?.pause(); setBusy(true); setError('');
    try {
      const currentSource = target.cardNumber === source.cardNumber ? source : await services.loadSource(target.cardNumber);
      const session = { ...createSession(currentSource), title: `Re-record · Code ${target.cardNumber} · ${target.text.slice(0, 70)}` };
      const value = { session, version: await store.save(session, 0) };
      accept(value);
      const capture = await startCapture(store, value, target.sectionId, report, target.cardNumber);
      handle.current = capture; setActive(capture); setCaptureId(capture.captureId); setPhase('prompt'); setText('');
      setMonitor({ elapsed: 0, paused: false, muted: false, level: null });
      if (prompt.current) prompt.current.scrollTop = 0;
      void capture.completion.then(async result => {
        handle.current = null;
        if (mounted.current) setActive(null);
        accept(result);
        if (mounted.current) await transcribe(result, capture.captureId);
      }).catch(e => { handle.current = null; if (mounted.current) { setActive(null); setBusy(false); } report(e); });
    } catch (e) { report(e); } finally { if (mounted.current) setBusy(false); }
  };
  const apply = async () => {
    if (!target || !text.trim() || busy) return;
    setBusy(true); setError('');
    try {
      let evidence: { sessionId: string; captureId: string; transcriptId: string } | undefined;
      if (savedRef.current && captureId) {
        const latest = await store.load(savedRef.current.session.id);
        if (!latest) throw new Error('Your recorded words could not be reopened. No replacement was made.');
        const transcripts = latest.session.transcript.filter(t => t.captureId === captureId);
        if (transcripts.length) {
          // Preserve raw provider segments. One corrected contribution owns the reviewed replacement.
          let session = correctTranscript(latest.session, transcripts[0].id, { corrected: text });
          session = { ...session, transcript: session.transcript.map(t => transcripts.slice(1).some(other => other.id === t.id) ? { ...t, referenceOnly: true } : t) };
          const value = { session, version: await store.save(session, latest.version) }; accept(value);
          evidence = { sessionId: session.id, captureId, transcriptId: transcripts[0].id };
        }
      }
      await applyPassageReplacement([target], text, services, evidence);
      onApplied(target); onClose();
    } catch (e) { report(e); } finally { if (mounted.current) setBusy(false); }
  };
  if (!target) return <section className="passage-recorder"><p>Select a passage in the card first.</p><button onClick={onClose}>Back to card</button></section>;
  return <section className="passage-recorder" aria-label="Re-record selected passage" data-authoring-protected={Boolean(active || busy)}>
    <header className="passage-recorder__header"><div><h2>{phase === 'review' ? 'Check your words' : 'Re-record this passage'}</h2><p>Code {target.cardNumber} · {target.sectionId==='CODE'?'Universal Language':source.sections.find(s => s.id === target.sectionId)?.title ?? target.sectionId}</p></div><button type="button" onClick={onClose} disabled={!!active || busy}>Back</button></header>
    {anchors.length > 1 && <label className="passage-recorder__target">Replace<select aria-label="Passage to replace" disabled={!!active || busy || !!captureId} value={targetId} onChange={e => setTargetId(e.target.value)}>{combined && <option value="combined">Combined selected passages</option>}{anchors.map((anchor, index) => <option value={anchor.id} key={anchor.id}>Passage {index + 1} · Code {anchor.cardNumber} · {anchor.text.slice(0, 65)}</option>)}</select></label>}
    {phase === 'review' ? <div className="passage-recorder__comparison"><div><h3>Original passage</h3><div className="passage-recorder__original">{target.text}</div></div><div><label htmlFor="passage-reviewed-words">Your words</label><textarea ref={editor} id="passage-reviewed-words" aria-label="Your replacement words" value={text} disabled={busy} onChange={e => setText(e.target.value)} /><p className="passage-recorder__note">Check the transcription. Only this passage will change.</p>{uncertain.length > 0 && <p className="passage-recorder__uncertain">Listen once more around: {uncertain.map((word, index) => <React.Fragment key={index}>{index > 0 ? ', ' : ''}<mark>{word}</mark></React.Fragment>)}</p>}</div></div> : <>
      <div className="passage-recorder__settings"><label>Text size<input type="range" aria-label="Teleprompter text size" min={20} max={42} step={2} value={fontSize} onChange={e => setFontSize(Number(e.target.value))} /></label><details><summary>Scrolling</summary><label>Scroll speed<input type="range" aria-label="Teleprompter scroll speed" min={0} max={40} step={2} value={speed} onChange={e => setSpeed(Number(e.target.value))} /></label><span>{speed ? `${speed} pixels per second while recording` : 'Manual · move the passage yourself'}</span></details></div>
      <div ref={prompt} className="passage-recorder__prompt" tabIndex={0} aria-label="Selected passage teleprompter" style={{ fontSize }}>{target.text}</div>
      <p className="passage-recorder__note">Use this as a reference. Say it your way; replacement waits for your check.</p>
    </>}
    {active && <div className="passage-recorder__monitor" role="status"><span>{monitor.paused ? 'Paused' : monitor.muted ? 'Microphone muted' : 'Recording'} · {elapsedLabel(monitor.elapsed)}</span>{monitor.level !== null && <meter min={0} max={1} value={monitor.level} aria-label="Microphone input level" />}</div>}
    {phase === 'transcribing' && <p role="status">{busy ? 'Your recording is saved. Transcribing your words…' : 'Your recording is saved. Transcription needs another try.'}</p>}
    {error && <p className="passage-recorder__error" role="alert">{error}</p>}
    {audioUrl && <audio ref={player} src={audioUrl} controls aria-label="Your passage recording" />}
    <footer className="passage-recorder__actions">{active ? <><button type="button" onClick={() => { if (active.state() === 'paused') active.resume(); else active.pause(); }}>{monitor.paused ? 'Resume' : 'Pause'}</button><button type="button" className="passage-recorder__primary" onClick={() => { setBusy(true); void active.stop().catch(e => { report(e); setBusy(false); }); }} disabled={busy}>Finish</button></> : phase === 'review' ? <><button type="button" onClick={() => { setPhase('prompt'); setError(''); }} disabled={busy}>Record again</button><button type="button" className="passage-recorder__primary" onClick={() => void apply()} disabled={busy || !text.trim()}>{busy ? 'Saving…' : 'Use my words'}</button></> : phase === 'transcribing' ? <><button type="button" className="passage-recorder__primary" onClick={() => { if (saved && captureId) void transcribe(saved, captureId); }} disabled={busy || !saved}>{busy ? 'Transcribing…' : 'Retry transcription'}</button>{!busy && <button type="button" onClick={() => { setPhase('prompt'); setError(''); }}>Record again</button>}</> : <button type="button" className="passage-recorder__primary" onClick={() => void record()} disabled={busy}>{busy ? 'Opening…' : 'Record'}</button>}</footer>
  </section>;
}
