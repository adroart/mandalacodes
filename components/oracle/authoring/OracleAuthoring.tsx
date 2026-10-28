import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AuthoringServices, AuthoringSession, Capture, Feedback, Proposal, SourceSnapshot, Transcript } from '../../../lib/oracle/authoring/types';
import { AuthoringStore, type SavedSession } from '../../../lib/oracle/authoring/storage';
import { addTranscript, approveReview, approvedMarkdown, correctTranscript, createSession, editorialReceipt, proposeSection, reviewDigest } from '../../../lib/oracle/authoring/workflow';
import { exportBundle, importBundle } from '../../../lib/oracle/authoring/transfer';
import { importAudio, recoverCapture, startCapture, type ActiveCapture } from '../../../lib/oracle/authoring/recorder';
import './authoring.css';

export interface OracleAuthoringProps {
  source: SourceSnapshot;
  services: AuthoringServices;
  visibleSectionId?: string | null;
  store?: AuthoringStore;
  onClose?: () => void;
  autoOpen?: boolean;
  exportFile?: (name: string, text: string, type: string) => Promise<void>;
}
const emptyFeedback: Feedback = { changes: '', uncertainWords: '', omissions: '', contradictions: '', unsupportedAdditions: '' };
const feedbackLabels: Record<keyof Feedback, string> = { changes: 'What changed and why', uncertainWords: 'Uncertain words', omissions: 'Omissions', contradictions: 'Contradictions', unsupportedAdditions: 'Unsupported additions' };
const time = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
function download(name: string, value: string, type = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** Isolated host entry point. This component never writes canonical manuscripts or deletes audio. */
export default function OracleAuthoring({ source, services, visibleSectionId, store: suppliedStore, onClose, autoOpen = false, exportFile }: OracleAuthoringProps) {
  const exportText = (name: string, text: string, type = 'text/markdown') => { if (exportFile) return exportFile(name, text, type); download(name, text, type); return Promise.resolve(); };
  const store = useMemo(() => suppliedStore ?? new AuthoringStore(), [suppliedStore]);
  const [saved, setSaved] = useState<SavedSession | null>(null);
  const savedRef = useRef<SavedSession | null>(null);
  const version = useRef(0), queue = useRef(Promise.resolve()), saveFailed = useRef(false);
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [tab, setTab] = useState<'capture' | 'speech' | 'review'>('capture');
  const [sectionId, setSectionId] = useState(visibleSectionId ?? source.sections[0]?.id ?? '');
  const [active, setActive] = useState<ActiveCapture | null>(null);
  const activeRef = useRef<ActiveCapture | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [approved, setApproved] = useState(false), [confirmed, setConfirmed] = useState(false);
  const [reviewer, setReviewer] = useState('Adrian');
  const [importDuration, setImportDuration] = useState('');
  const [selectedCaptureId, setSelectedCaptureId] = useState('');
  const [entry, setEntry] = useState(''), [startSeconds, setStartSeconds] = useState('0'), [endSeconds, setEndSeconds] = useState('');
  const [proposalText, setProposalText] = useState(''), [feedback, setFeedback] = useState<Feedback>({ ...emptyFeedback });
  const [mobileColumn, setMobileColumn] = useState('proposed');
  const player = useRef<HTMLAudioElement>(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [proposalDirty, setProposalDirty] = useState(false);
  const session = saved?.session;
  const section = session?.source.sections.find(s => s.id === sectionId);
  const selectedCapture = session?.captures.find(c => c.id === selectedCaptureId);
  const original = section && session ? session.source.markdown.slice(section.start, section.end) : '';

  const accept = (value: SavedSession) => { savedRef.current = value; version.current = value.version; setSaved(value); saveFailed.current = false; };
  const report = (e: unknown) => { setError(e instanceof Error ? e.message : String(e)); };
  const run = async (fn: () => Promise<void>, allowFailedSave = false) => {
    setBusy(true); setError(''); setMessage('');
    try { await queue.current; if (saveFailed.current && !allowFailedSave) throw new Error('Your last save failed. Export is unavailable until this session can be saved. Reopen the session to resolve a conflict.'); await fn(); } catch (e) { report(e); } finally { setBusy(false); }
  };
  const persist = (next: AuthoringSession): Promise<void> => {
    if (saveFailed.current) return Promise.reject(new Error('Resolve the save error before continuing'));
    setSaving(true); setApproved(false); setConfirmed(false);
    const nextSaved = { session: next, version: version.current };
    savedRef.current = nextSaved; setSaved(nextSaved);
    const task = queue.current.then(async () => {
      if (saveFailed.current) throw new Error('A previous save failed. Reopen this session.');
      version.current = await store.save(next, version.current);
      if (savedRef.current?.session === next) { const value = { session: next, version: version.current }; savedRef.current = value; setSaved(value); }
    });
    queue.current = task.catch(e => { saveFailed.current = true; report(e); });
    void task.finally(() => setSaving(false)).catch(() => undefined);
    return task;
  };
  useEffect(() => {
    let alive = true;
    void store.list().then(async list => {
      if (!alive) return;
      setSessions(list);
      if (autoOpen) {
        const existing = list.find(item => item.session.source.cardNumber === source.cardNumber);
        if (existing) accept(existing);
        else {
          const session = createSession(source);
          const nextVersion = await store.save(session, 0);
          if (alive) accept({ session, version: nextVersion });
        }
      }
    }).catch(report);
    return () => { alive = false; };
  }, [store, autoOpen, source.cardNumber]);
  useEffect(() => {
    const next = visibleSectionId;
    if (next && source.sections.some(s => s.id === next)) { setSectionId(next); activeRef.current?.mark(next); }
  }, [visibleSectionId, source]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setElapsed(active.elapsed()), 500);
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => { clearInterval(timer); window.removeEventListener('beforeunload', warn); };
  }, [active]);
  useEffect(() => () => { void activeRef.current?.stop(); }, []);
  useEffect(() => {
    let valid = true; let url = '';
    setAudioUrl('');
    if (session && selectedCapture && selectedCapture.status !== 'recording' && selectedCapture.status !== 'empty') void store.audio(session.id, selectedCapture.id).then(blob => { if (valid) { url = URL.createObjectURL(blob); setAudioUrl(url); } }).catch(report);
    return () => { valid = false; if (url) URL.revokeObjectURL(url); };
  }, [store, session?.id, selectedCaptureId, selectedCapture?.status]);
  useEffect(() => {
    const proposal = session?.proposals.find(p => p.sectionId === sectionId);
    setProposalText(proposal?.text ?? ''); setFeedback(proposal?.feedback ?? { ...emptyFeedback }); setProposalDirty(false); setConfirmed(false);
  }, [session?.id, sectionId, session?.proposals]);
  useEffect(() => {
    if (selectedCapture) { setStartSeconds('0'); setEndSeconds(String(selectedCapture.durationMs / 1000)); }
  }, [selectedCaptureId, selectedCapture?.durationMs]);
  useEffect(() => {
    let valid = true; setApproved(false);
    if (session) void reviewDigest(session).then(d => { if (valid) setApproved(session.approvals.some(a => a.digest === d)); });
    return () => { valid = false; };
  }, [session]);

  const selectSection = (id: string) => { setSectionId(id); activeRef.current?.mark(id || null); };
  const begin = () => run(async () => {
    if (!savedRef.current) return;
    const handle = await startCapture(store, { session: savedRef.current.session, version: version.current }, sectionId || null, report);
    activeRef.current = handle; setActive(handle); setElapsed(0);
    const current = await store.load(savedRef.current.session.id); if (current) accept(current);
    void handle.completion.then(value => {
      accept(value); setSelectedCaptureId(handle.captureId); setMessage('Recording saved on this device. Export a review file for backup or computer review.');
    }).catch(report).finally(() => { activeRef.current = null; setActive(null); });
  });
  const replay = (t: Transcript) => {
    setSelectedCaptureId(t.captureId);
    const play = () => { if (player.current) { player.current.currentTime = t.startMs / 1000; void player.current.play().catch(report); } };
    if (selectedCaptureId === t.captureId && player.current?.readyState) play();
    else {
      // onLoadedMetadata is keyed to the selected evidence via this ref.
      pendingReplay.current = t.startMs;
    }
  };
  const pendingReplay = useRef<number | null>(null);
  const changeTranscript = (id: string, patch: Parameters<typeof correctTranscript>[2]) => {
    if (savedRef.current) void persist(correctTranscript(savedRef.current.session, id, patch)).catch(report);
  };
  const transcribe = (capture: Capture) => run(async () => {
    if (!savedRef.current || !services.transcribe) return;
    if (savedRef.current.session.transcript.some(t => t.captureId === capture.id && t.provider !== 'manual entry')) throw new Error('This recording already has an original service transcript. Correct it or add a timed excerpt below.');
    const snapshot = savedRef.current.session;
    const result = await services.transcribe(snapshot, capture, await store.audio(snapshot.id, capture.id));
    await persist(addTranscript(snapshot, capture.id, result.segments, result.provider));
    setTab('speech'); setMessage('Original transcript saved. Check the audio and confirm each section assignment.');
  });
  const approve = () => run(async () => {
    if (!savedRef.current) return;
    if (proposalDirty) throw new Error('Save the proposed section before approving');
    const current = await services.loadSource(savedRef.current.session.source.cardNumber);
    const next = await approveReview(savedRef.current.session, current, reviewer, confirmed);
    await persist(next); setApproved(true); setMessage('Exact changes approved and receipt saved locally. Manuscript application is not connected.');
  });

  return <section className="oracle-authoring" aria-label="Oracle voice authoring">
    <header className="oa-header"><div><span className="oa-eyebrow">Oracle workshop</span><h1>Speak, then shape.</h1><p>Private authoring · Card {session?.source.cardNumber ?? source.cardNumber}</p></div>{onClose && <button onClick={onClose} disabled={!!active || busy || saving}>Close</button>}</header>
    <div role="status" className="oa-status">{saving ? 'Saving on this device…' : active ? `Recording ${time(elapsed)} · audio saves as chunks arrive` : message || (session ? 'Saved on this device · export for backup' : 'Audio and drafts stay in this browser until you export them.')}</div>
    {error && <div role="alert" className="oa-error">{error}</div>}
    {!session ? <div className="oa-start"><button className="oa-primary" disabled={busy} onClick={() => void run(async () => { const s = createSession(source); accept({ session: s, version: await store.save(s, 0) }); })}>New card review</button>
      <label className="oa-upload">Open review file<input type="file" accept=".json,application/json" disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file) void run(async () => { if (file.size > 80 * 1024 * 1024) throw new Error('Review file exceeds 80 MiB'); const value = await importBundle(store, await file.text()); accept(value); setSectionId(value.session.source.sections[0]?.id ?? ''); setTab('speech'); }); e.target.value = ''; }} /></label>
      {sessions.length > 0 && <div className="oa-session-list"><h2>On this device</h2>{sessions.map(item => <button key={item.session.id} disabled={busy} onClick={() => void run(async () => { const latest = await store.load(item.session.id); if (latest) { accept(latest); setSectionId(latest.session.source.sections[0]?.id ?? ''); } })}>Card {item.session.source.cardNumber} · {new Date(item.session.createdAt).toLocaleDateString()} · {item.session.captures.length} recordings</button>)}</div>}
    </div> : <>
      <div className="oa-toolbar"><label>Section<select value={sectionId} onChange={e => selectSection(e.target.value)} disabled={busy || proposalDirty}>{session.source.sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
        {active ? <button className="oa-primary" disabled={busy} onClick={() => void run(async () => { await active.stop(); })}>Finish recording</button> : <button className="oa-primary" disabled={busy || saving || proposalDirty || session.captures.some(c => c.status === 'recording')} onClick={begin}>Record</button>}
        <button disabled={!!active || busy || saving || proposalDirty} onClick={() => void run(async () => { await exportText(`oracle-card-${session.source.cardNumber}-review.json`, await exportBundle(store, session.id), 'application/json'); setMessage('Review file prepared with audio. Save it somewhere private, then open it on your computer.'); })}>Export review</button>
        <button disabled={!!active || busy || saving || proposalDirty} onClick={() => void run(async () => { setSessions(await store.list()); savedRef.current = null; setSaved(null); setSelectedCaptureId(''); setAudioUrl(''); }, true)}>Sessions</button>
      </div>
      {active && <p className="oa-hint">Switch sections as you speak to leave timestamped hints. Keep this screen open; phone background recording is not guaranteed.</p>}
      <nav className="oa-tabs" aria-label="Authoring steps">{(['capture', 'speech', 'review'] as const).map(t => <button key={t} aria-pressed={tab === t} disabled={!!active || busy || proposalDirty} onClick={() => setTab(t)}>{t === 'capture' ? 'Recordings' : t === 'speech' ? 'Check speech' : 'Compare & approve'}</button>)}</nav>
      <fieldset disabled={busy || !!active || saveFailed.current} className="oa-content">
      {tab === 'capture' && <>
        <div className="oa-import"><label>Duration, seconds<input type="number" min="1" max="1200" value={importDuration} onChange={e => setImportDuration(e.target.value)} /></label><label className="oa-upload">Import audio<input type="file" accept="audio/*" onChange={e => { const file = e.target.files?.[0]; if (file) void run(async () => { const value = await importAudio(store, { session: savedRef.current!.session, version: version.current }, file, Number(importDuration) * 1000, sectionId); accept(value); setSelectedCaptureId(value.session.captures.at(-1)!.id); }); e.target.value = ''; }} /></label></div>
        <p className="oa-hint">Up to 20 minutes and 10 MiB per recording. Import duration is supplied by you. Exported review files contain private audio and text.</p>
        {!session.captures.length && <p>Read the section below and record your reflection, or import an existing recording.</p>}
        <div className="oa-clips">{session.captures.map((c, i) => <div className="oa-clip" key={c.id}><button aria-pressed={selectedCaptureId === c.id} onClick={() => setSelectedCaptureId(c.id)}>Recording {i + 1} · {time(c.durationMs)}</button><span>{c.status === 'empty' ? 'No audio received · retained as a record' : c.status === 'interrupted' ? 'Recovered fragment · check playback' : c.status}</span>{c.status === 'recording' && <button onClick={() => void run(async () => accept(await recoverCapture(store, { session: savedRef.current!.session, version: version.current }, c.id)))}>Recover received audio</button>}{c.status !== 'recording' && c.status !== 'empty' && services.transcribe && <button onClick={() => transcribe(c)}>Transcribe privately</button>}</div>)}</div>
        {!services.transcribe && <p className="oa-hint">Automatic transcription is not connected here. Enter the original words under Check speech.</p>}
        {services.transcribe && <p className="oa-hint">Transcribe privately sends this recording to the connected transcription service. It may mishear words; check the audio.</p>}
        <details open={!session.captures.length}><summary>Current {section?.title}</summary><pre className="oa-prose">{original}</pre></details>
      </>}
      {(tab === 'speech' || tab === 'capture' || tab === 'review') && session.captures.length > 0 && <div className="oa-player"><label>Playback<select value={selectedCaptureId} onChange={e => setSelectedCaptureId(e.target.value)}><option value="">Choose recording</option>{session.captures.filter(c => c.status !== 'recording' && c.status !== 'empty').map((c, i) => <option key={c.id} value={c.id}>Recording {i + 1} · {time(c.durationMs)}</option>)}</select></label>{audioUrl && <audio ref={player} controls src={audioUrl} onLoadedMetadata={() => { if (pendingReplay.current !== null && player.current) { player.current.currentTime = pendingReplay.current / 1000; pendingReplay.current = null; void player.current.play().catch(report); } }} />}</div>}
      {tab === 'speech' && <>
        <p className="oa-hint">Keep the original words. Correct misheard words separately and confirm the section. For a recording spanning sections, keep the full transcript as reference and add timed excerpts for each section.</p>
        {session.transcript.map((t, i) => <article className="oa-transcript" key={t.id}><div className="oa-row"><h2>Excerpt {i + 1}</h2><button onClick={() => replay(t)}>Play {time(t.startMs)}–{time(t.endMs)}</button><span>{t.timing === 'recording' ? 'Whole-recording timing' : `${t.timing} timing`}</span></div>
          <details><summary>Original words · {t.provider}</summary><pre>{t.raw}</pre></details>
          <label>Corrected words<textarea value={t.corrected} onChange={e => changeTranscript(t.id, { corrected: e.target.value })} /></label>
          <div className="oa-row"><label>Section<select aria-label={`Section for excerpt ${i + 1}`} value={t.sectionId ?? ''} onChange={e => changeTranscript(t.id, { sectionId: e.target.value || null })}><option value="">Unresolved</option>{session.source.sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>{t.assignment === 'hint' && <button onClick={() => changeTranscript(t.id, { sectionId: t.sectionId })}>Confirm section hint</button>}<label className="oa-check"><input type="checkbox" checked={!!t.referenceOnly} onChange={e => changeTranscript(t.id, { referenceOnly: e.target.checked })} />Reference only, not rewrite evidence</label></div>
        </article>)}
        <form className="oa-entry" onSubmit={e => { e.preventDefault(); void run(async () => { if (!selectedCapture) throw new Error('Choose a recording first'); const next = addTranscript(savedRef.current!.session, selectedCapture.id, [{ text: entry, startMs: Number(startSeconds) * 1000, endMs: Number(endSeconds) * 1000, sectionId: sectionId || null, timing: 'manual' }], 'manual entry'); await persist(correctTranscript(next, next.transcript.at(-1)!.id, { sectionId: sectionId || null })); setEntry(''); }); }}><h2>Add original words or a timed excerpt</h2><div className="oa-row"><label>From, seconds<input type="number" step="0.1" min="0" value={startSeconds} onChange={e => setStartSeconds(e.target.value)} /></label><label>To, seconds<input type="number" step="0.1" min="0" value={endSeconds} onChange={e => setEndSeconds(e.target.value)} /></label><span>Assign to {section?.title}</span></div><label>Original words<textarea required value={entry} onChange={e => setEntry(e.target.value)} /></label><button type="submit" disabled={!selectedCapture || !entry.trim()}>Save excerpt</button></form>
      </>}
      {tab === 'review' && <>
        <p className="oa-hint">Only sections with a saved proposal will change. Compare the full section, including any subheadings. Untouched sections remain intact.</p>
        <nav className="oa-columns-switch" aria-label="Comparison view">{['current', 'spoken', 'proposed'].map(c => <button key={c} aria-pressed={mobileColumn === c} onClick={() => setMobileColumn(c)}>{c[0].toUpperCase() + c.slice(1)}</button>)}</nav>
        <div className="oa-comparison" data-column={mobileColumn}>
          <article className="oa-current"><h2>Current manuscript</h2><pre className="oa-prose">{original}</pre></article>
          <article className="oa-spoken"><h2>What you said</h2>{session.transcript.filter(t => t.sectionId === sectionId && !t.referenceOnly).map(t => <div key={t.id}><span>{time(t.startMs)}–{time(t.endMs)} · {t.assignment}</span><button onClick={() => replay(t)}>Play cited audio</button><p>{t.corrected}</p><details><summary>Original transcript</summary><pre>{t.raw}</pre></details></div>)}{!session.transcript.some(t => t.sectionId === sectionId && !t.referenceOnly) && <p>No speech assigned to this section.</p>}</article>
          <article className="oa-proposed"><h2>Proposed revision</h2><label>Full replacement section<textarea aria-label="Proposed section" value={proposalText} onChange={e => { setProposalText(e.target.value); setProposalDirty(true); setConfirmed(false); }} /></label><button disabled={!session.transcript.some(t => t.sectionId === sectionId && !t.referenceOnly)} onClick={() => { setConfirmed(false); setProposalText(session.transcript.filter(t => t.sectionId === sectionId && !t.referenceOnly).map(t => t.corrected).join('\n\n')); setProposalDirty(true); setFeedback({ ...emptyFeedback, changes: 'Copied the corrected speech in excerpt order. No AI rewriting performed.' }); }}>Use corrected words</button></article>
        </div>
        <div className="oa-feedback"><label>{feedbackLabels.changes}<textarea value={feedback.changes} onChange={e => { setFeedback({ ...feedback, changes: e.target.value }); setProposalDirty(true); }} /></label><details><summary>Words, omissions, contradictions and additions</summary>{(['uncertainWords', 'omissions', 'contradictions', 'unsupportedAdditions'] as const).map(k => <label key={k}>{feedbackLabels[k]}<textarea value={feedback[k]} placeholder="Record concerns, or leave empty after checking." onChange={e => { setFeedback({ ...feedback, [k]: e.target.value }); setProposalDirty(true); }} /></label>)}</details>
          <div className="oa-row"><button disabled={!proposalDirty || !proposalText.trim() || !feedback.changes.trim()} onClick={() => void run(async () => { const s = savedRef.current!.session; await persist(proposeSection(s, { sectionId, text: proposalText, evidenceIds: s.transcript.filter(t => t.sectionId === sectionId && !t.referenceOnly).map(t => t.id), author: { kind: 'manual' }, feedback })); setProposalDirty(false); })}>Save proposed section</button>{session.proposals.some(p => p.sectionId === sectionId) && <button onClick={() => void run(async () => { await persist({ ...savedRef.current!.session, proposals: savedRef.current!.session.proposals.filter(p => p.sectionId !== sectionId) }); })}>Keep current section</button>}</div>
        </div>
        {services.propose ? <button disabled={proposalDirty} onClick={() => void run(async () => { const s = savedRef.current!.session; const digest = await reviewDigest(s); const proposals = await services.propose!(structuredClone(s)); if (await reviewDigest(savedRef.current!.session) !== digest) throw new Error('Review changed while AI was working. Request again.'); let next = s; for (const p of proposals) { if (p.author.kind !== 'ai') throw new Error('AI proposal must name its provider and model'); next = proposeSection(next, p); } await persist(next); setMessage('AI proposals saved for review. Check changes and all feedback before approval.'); })}>Request AI suggestions</button> : <p className="oa-hint">AI rewriting is not connected. Proposals and feedback entered here are yours.</p>}
        {session.proposals.length > 0 && <div className="oa-approval"><h2>Approve {session.proposals.length} section {session.proposals.length === 1 ? 'change' : 'changes'}</h2><ul>{session.proposals.map(p => <li key={p.sectionId}><button onClick={() => selectSection(p.sectionId)}>{session.source.sections.find(s => s.id === p.sectionId)?.title}</button><span>{p.author.kind === 'ai' ? `${p.author.provider} / ${p.author.model}` : 'Manually prepared'}</span></li>)}</ul>{!approved && <><label>Reviewer<input value={reviewer} onChange={e => setReviewer(e.target.value)} /></label><label className="oa-check"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I reviewed every proposed section, compared it with my speech, and checked uncertain words, omissions, contradictions and additions.</label><button className="oa-primary" disabled={!confirmed || proposalDirty || saving} onClick={approve}>Approve exact changes</button></>}{approved && <p role="status">Approved receipt saved. Canonical manuscript has not been changed.</p>}</div>}
        <div className="oa-row"><button disabled={proposalDirty} onClick={() => void run(async () => { await exportText(`oracle-card-${session.source.cardNumber}-receipt.md`, editorialReceipt(session)); })}>Export editorial record</button>{approved && <button disabled={proposalDirty} onClick={() => void run(async () => { const current = await services.loadSource(session.source.cardNumber); await exportText(`oracle-card-${session.source.cardNumber}-approved.md`, await approvedMarkdown(session, current)); })}>Export approved manuscript</button>}</div>
      </>}
      </fieldset>
      <details className="oa-source"><summary>Source & storage details</summary><p>Original revision: {session.source.revision}</p><p>SHA-256: {session.source.hash}</p><p>Audio is local to this browser. Export review files for backup and computer review. Imported files require fresh approval. Editing audio is kept; verified application and deletion are not connected. Published listening audio is separate.</p></details>
    </>}
  </section>;
}
