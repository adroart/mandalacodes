import React, { useEffect, useMemo, useRef, useState } from 'react';
import {Mic,Square,Pause,Play,ChevronLeft,Check,SlidersHorizontal} from 'lucide-react';
import {CARD_BY_NUMBER} from '../../../data/oracleData';
import WordChanges from './WordChanges';
import type { AuthoringServices, SourceSnapshot, AlignedWord } from '../../../lib/oracle/authoring/types';
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
  const [captureId, setCaptureId] = useState(''), [uncertain, setUncertain] = useState<AlignedWord[]>([]);
  const [reviewView,setReviewView]=useState<'original'|'words'>('words');
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
      setUncertain(segments.flatMap(t => (t.words ?? []).filter(w => w.probability !== undefined && w.probability < .6)));
      setReviewView('words');
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
  const finishRecording=()=>{if(!active||busy)return;setBusy(true);void active.stop().catch(e=>{report(e);setBusy(false);});};
  const shortcut=(event:React.KeyboardEvent)=>{if(!(event.metaKey||event.ctrlKey)||event.key!=='Enter'||event.repeat)return;event.preventDefault();if(busy)return;if(active)finishRecording();else if(phase==='review')void apply();else if(phase==='prompt')void record();};
  const checkWord=(word:AlignedWord)=>{setReviewView('words');const start=text.toLocaleLowerCase().indexOf(word.text.toLocaleLowerCase());requestAnimationFrame(()=>{editor.current?.focus();if(start>=0)editor.current?.setSelectionRange(start,start+word.text.length);});if(player.current){player.current.currentTime=Math.max(0,word.startMs/1000);void player.current.play().catch(report);}};
  if (!target) return <section className="passage-recorder"><p>Select a passage in the card first.</p><button onClick={onClose}>Back to card</button></section>;
  const card=CARD_BY_NUMBER.get(target.cardNumber),state=active?'recording':phase==='review'?'review':phase==='transcribing'?'processing':'ready';
  const lens=target.sectionId==='CODE'?'Universal Language':source.sections.find(s=>s.id===target.sectionId)?.title??target.sectionId;
  const heading=state==='recording'?'Say it your way':state==='review'?'Check your words':state==='processing'?'Your words are on their way':'Re-record this passage';
  return <section className="passage-recorder" aria-label="Re-record selected passage" data-state={state} data-authoring-protected={Boolean(active || busy)} onKeyDown={shortcut}>
    <header className="passage-recorder__header">
      <div className="passage-recorder__identity"><img src={`/oracle-art/${target.cardNumber}.webp`} alt=""/><div><p>{card?.card_name??`Code ${target.cardNumber}`}</p><span>Code {target.cardNumber} · {lens}</span></div></div>
      <button type="button" className="passage-recorder__back" onClick={onClose} disabled={!!active || busy}><ChevronLeft size={16} aria-hidden="true"/>Back</button>
    </header>
    <div className="passage-recorder__stage-heading"><h2>{heading}</h2><ol aria-label="Recording steps"><li aria-current={state==='ready'?'step':undefined}>Ready</li><li aria-current={state==='recording'||state==='processing'?'step':undefined}>{state==='processing'?'Processing':'Recording'}</li><li aria-current={state==='review'?'step':undefined}>Review</li></ol></div>
    {anchors.length > 1 && <label className="passage-recorder__target">Passage to replace<select aria-label="Passage to replace" disabled={!!active || busy || !!captureId} value={targetId} onChange={e => setTargetId(e.target.value)}>{combined && <option value="combined">Combined selected passages</option>}{anchors.map((anchor, index) => <option value={anchor.id} key={anchor.id}>Passage {index + 1} · Code {anchor.cardNumber} · {anchor.text.slice(0, 65)}</option>)}</select></label>}
    <div className="passage-recorder__body">
      {phase === 'review' ? <>
        <div className="passage-recorder__review-tabs" role="tablist" aria-label="Compare passage"><button type="button" role="tab" id="passage-original-tab" aria-controls="passage-original-pane" aria-selected={reviewView==='original'} tabIndex={reviewView==='original'?0:-1} onKeyDown={event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();setReviewView('words');document.getElementById('passage-words-tab')?.focus();}}} onClick={()=>setReviewView('original')}>Original</button><button type="button" role="tab" id="passage-words-tab" aria-controls="passage-words-pane" aria-selected={reviewView==='words'} tabIndex={reviewView==='words'?0:-1} onKeyDown={event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();setReviewView('original');document.getElementById('passage-original-tab')?.focus();}}} onClick={()=>setReviewView('words')}>Your version</button></div>
        <div className="passage-recorder__comparison">
          <section id="passage-original-pane" className="passage-recorder__pane" data-active={reviewView==='original'} role="tabpanel" aria-labelledby="passage-original-tab"><h3>Original passage</h3><div className="passage-recorder__original">{target.text}</div></section>
          <section id="passage-words-pane" className="passage-recorder__pane" data-active={reviewView==='words'} role="tabpanel" aria-labelledby="passage-words-tab"><label htmlFor="passage-reviewed-words">Your version</label><textarea ref={editor} id="passage-reviewed-words" aria-label="Your replacement words" value={text} disabled={busy} onChange={e => setText(e.target.value)} /><p className="passage-recorder__note">Your wording stays exact. Only the selected passage will change.</p>{uncertain.filter(w=>text.toLocaleLowerCase().includes(w.text.toLocaleLowerCase())).length>0&&<div className="passage-recorder__uncertain"><span>Check these words</span>{uncertain.filter(w=>text.toLocaleLowerCase().includes(w.text.toLocaleLowerCase())).map((word,index)=><button key={`${word.startMs}-${index}`} type="button" onClick={()=>checkWord(word)} aria-label={`Replay uncertain word: ${word.text}`}><Play size={12} aria-hidden="true"/>{word.text}</button>)}</div>}</section>
        </div>
        <details className="passage-recorder__changes"><summary>See word changes</summary><WordChanges original={target.text} revised={text}/></details>
      </> : <>
        <section className="passage-recorder__passage-card"><div className="passage-recorder__prompt-label"><span>Selected passage</span><details className="passage-recorder__settings"><summary title="Text size and scroll speed"><SlidersHorizontal size={15} aria-hidden="true"/>Reading controls</summary><div><label>Text size<input type="range" aria-label="Teleprompter text size" min={20} max={42} step={2} value={fontSize} onChange={e => setFontSize(Number(e.target.value))} /></label><label>Scroll speed<input type="range" aria-label="Teleprompter scroll speed" min={0} max={40} step={2} value={speed} onChange={e => setSpeed(Number(e.target.value))} /></label><span>{speed ? `${speed} pixels per second while recording` : 'Manual scrolling'}</span></div></details></div>
        <div ref={prompt} className="passage-recorder__prompt" tabIndex={0} aria-label="Selected passage teleprompter" style={{ fontSize }}>{target.text}</div></section>
        <p className="passage-recorder__note">Read, rethink, or depart from these words. Replacement waits for your check.</p>
      </>}
      {phase === 'transcribing' && <p className="passage-recorder__processing" role="status">{busy ? 'Recording saved. Preparing your editable transcription…' : 'Recording saved. Try transcription again when connected.'}</p>}
      {error && <p className="passage-recorder__error" role="alert">{error}</p>}
      {audioUrl && <audio ref={player} src={audioUrl} controls aria-label="Your passage recording" />}
    </div>
    <footer className="passage-recorder__footer">
      <div className="passage-recorder__monitor" role={active?'status':undefined}>{active?<><span className={`passage-recorder__record-light${monitor.paused?' is-paused':''}`} aria-hidden="true"/><span>{monitor.paused ? 'Paused' : monitor.muted ? 'Microphone muted' : 'Recording'}</span><time>{elapsedLabel(monitor.elapsed)}</time>{monitor.level!==null&&<meter min={0} max={1} value={monitor.level} aria-label="Microphone input level"/>}</>:<span className="passage-recorder__shortcut">⌘ / Ctrl + Enter · {phase==='review'?'Use my words':'Record / finish'}</span>}</div>
      <div className="passage-recorder__actions">{active ? <><button type="button" onClick={() => { if (active.state() === 'paused') active.resume(); else active.pause(); }}>{monitor.paused?<Play size={16} aria-hidden="true"/>:<Pause size={16} aria-hidden="true"/>}{monitor.paused ? 'Resume' : 'Pause'}</button><button type="button" className="passage-recorder__primary" onClick={finishRecording} disabled={busy}><Square size={15} aria-hidden="true"/>{busy?'Finishing…':'Finish'}</button></> : phase === 'review' ? <><button type="button" onClick={() => { setPhase('prompt'); setError(''); }} disabled={busy}>Record again</button><button type="button" className="passage-recorder__primary" onClick={() => void apply()} disabled={busy || !text.trim()}><Check size={17} aria-hidden="true"/>{busy ? 'Saving…' : 'Use my words'}</button></> : phase === 'transcribing' ? <><button type="button" className="passage-recorder__primary" onClick={() => { if (saved && captureId) void transcribe(saved, captureId); }} disabled={busy || !saved}>{busy ? 'Transcribing…' : 'Retry transcription'}</button>{!busy && <button type="button" onClick={() => { setPhase('prompt'); setError(''); }}>Record again</button>}</> : <button type="button" className="passage-recorder__primary" onClick={() => void record()} disabled={busy}><Mic size={18} aria-hidden="true"/>{busy ? 'Opening…' : 'Record'}</button>}</div>
    </footer>
  </section>;
}
