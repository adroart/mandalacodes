import React, { useEffect, useRef, useState } from 'react';
import type { AuthoringSession, Feedback, Proposal, Transcript } from '../../../lib/oracle/authoring/types';
import { proposalCard, transcriptCard } from '../../../lib/oracle/authoring/workflow';
import { composeReconciliation, createReconciliation, evidenceKey, reconcileHunks, reviewProblems, wordDiff } from '../../../lib/oracle/authoring/reconciliation';
import EditableText from './EditableText';
import './reconciliation.css';

interface Props {
  session: AuthoringSession;
  proposal: Proposal;
  disabled?: boolean;
  save: (proposal: Proposal) => Promise<void>;
  listen: (passage: Transcript) => void;
  onComplete?: () => void;
}
const concernNames: Record<Exclude<keyof Feedback, 'changes'>, string> = {
  uncertainWords: 'Uncertain words', omissions: 'Possible omissions',
  contradictions: 'Contradictions', unsupportedAdditions: 'Unsupported additions',
};
const wordCount = (text: string) => text.match(/\S+/g)?.length ?? 0;
const time = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
function Difference({ before, after }: { before: string; after: string }) {
  const content=<div className="or-difference">{wordDiff(before, after).map((part, index) => part.kind === 'add'
    ? <ins key={index}>{part.text}</ins> : part.kind === 'remove'
      ? <del key={index}>{part.text}</del> : <span key={index}>{part.text}</span>)}</div>;
  if(before.length+after.length<1200)return content;
  return <><p className="or-excerpt"><del>{before.slice(0,180)}{before.length>180?'…':''}</del><br/><ins>{after.slice(0,180)}{after.length>180?'…':''}</ins></p><details><summary>Compare full change · {before.trim().split(/\s+/).length} current words / {after.trim().split(/\s+/).length} suggested words</summary>{content}</details></>;

}
export default function ReconciliationPanel({ session, proposal, disabled, save, listen, onComplete }: Props) {
  const [draft, setDraft] = useState(proposal), [pending, setPending] = useState(false), [error, setError] = useState('');
  const [unresolvedOnly, setUnresolvedOnly] = useState(false);
  const [focusedMode, setFocusedMode] = useState(true), [focusedId, setFocusedId] = useState(''), [focusTarget, setFocusTarget] = useState('');
  const [decisionHistory, setDecisionHistory] = useState<Proposal[]>([]);
  const [copyStatus, setCopyStatus] = useState(''), [copyFallback, setCopyFallback] = useState(false);
  const changeNodes = useRef(new Map<string, HTMLElement>()), navigationCursor = useRef('');
  const copyText = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { setDecisionHistory([]); navigationCursor.current = ''; setCopyStatus(''); setCopyFallback(false); setFocusedId(''); setFocusTarget(''); }, [session.id, proposal.cardNumber, proposal.sectionId]);
  useEffect(() => { if (copyFallback) { copyText.current?.focus(); copyText.current?.select(); } }, [copyFallback]);
  const pendingRef = useRef(false);
  useEffect(() => { if (!pendingRef.current) setDraft(proposal); }, [proposal]);
  const review = draft.reconciliation ?? createReconciliation(session, draft);
  const hunks = reconcileHunks(review.base, review.suggested).filter(h => h.changed);
  const unresolved = hunks.filter(h => !review.decisions[h.id] || review.decisions[h.id] === 'defer');
  const stale = review.evidenceKey !== evidenceKey(session, draft);
  const concerns = (Object.entries(concernNames) as [Exclude<keyof Feedback, 'changes'>, string][]).filter(([key]) => draft.feedback[key].trim());
  const evidence = draft.evidenceIds.map(id => session.transcript.find(t => t.id === id)).filter((t): t is Transcript => Boolean(t));
  const locked = disabled || pending;
  const currentHunk = hunks.find(h => h.id === focusedId) ?? unresolved[0] ?? hunks[0];
  const currentIndex = currentHunk ? hunks.indexOf(currentHunk) : -1;
  const visibleHunks = focusedMode ? (currentHunk ? [currentHunk] : []) : unresolvedOnly ? unresolved : hunks;
  const ready = !locked && !error && reviewProblems(session, draft).length === 0;
  useEffect(() => {
    if (!focusTarget || locked) return;
    const node = changeNodes.current.get(focusTarget);
    if (!node) return;
    node.scrollIntoView({ block: 'center', behavior: 'auto' });
    node.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
    setFocusTarget('');
  }, [focusTarget, currentHunk?.id, focusedMode, locked]);
  const visit = (id: string) => { navigationCursor.current = id; setFocusedId(id); setFocusTarget(id); };
  const acceptedCount = hunks.filter(h => review.decisions[h.id] === 'accept').length;
  const keptCount = hunks.filter(h => review.decisions[h.id] === 'keep').length;
  const deferredCount = hunks.filter(h => review.decisions[h.id] === 'defer').length;
  const wordChanges = wordDiff(review.base, draft.text);
  const addedWords = wordChanges.filter(part => part.kind === 'add').reduce((total, part) => total + wordCount(part.text), 0);
  const removedWords = wordChanges.filter(part => part.kind === 'remove').reduce((total, part) => total + wordCount(part.text), 0);
  const submit = async (next: Proposal) => {
    setDraft(next); setError(''); setPending(true); pendingRef.current = true;
    try { await save(next); return true; }
    catch (e) { setError(e instanceof Error ? e.message : 'This decision could not be saved. Try again.'); return false; }
    finally { setPending(false); pendingRef.current = false; }
  };
  const update = (nextReview: typeof review) => submit({ ...draft, reconciliation: nextReview, text: composeReconciliation(nextReview) });
  const decide = async (nextReview: typeof review, changedId?: string) => {
    const before = structuredClone(draft);
    if (await update(nextReview)) {
      setDecisionHistory(history => [...history, before].slice(-20));
      if (focusedMode && changedId) {
        const from = hunks.findIndex(h => h.id === changedId);
        const remaining = hunks.filter(h => h.id !== changedId && (!nextReview.decisions[h.id] || nextReview.decisions[h.id] === 'defer'));
        const next = remaining.find(h => hunks.indexOf(h) > from) ?? remaining[0];
        if (next) visit(next.id);
      }
    }
  };
  const undoDecision = async () => {
    const previous = decisionHistory.at(-1);
    if (!previous || stale || locked) return;
    // An edit or new evidence starts a new comparison, so old choices cannot
    // restore a different candidate or bypass its current evidence check.
    const previousReview = previous.reconciliation ?? createReconciliation(session, previous);
    if (previousReview.evidenceKey !== evidenceKey(session, previous) || previousReview.suggested !== review.suggested) {
      setDecisionHistory([]); return;
    }
    if (await submit(previous)) {
      setDecisionHistory(history => history.slice(0, -1));
      const restored = hunks.find(h => previousReview.decisions[h.id] !== review.decisions[h.id]);
      if (focusedMode && restored) visit(restored.id);
    }
  };
  const nextUnfinished = () => {
    if (!unresolved.length) return;
    const index = hunks.findIndex(h => h.id === navigationCursor.current);
    const next = unresolved.find(h => hunks.indexOf(h) > index) ?? unresolved[0];
    visit(next.id);
  };
  const copyWriting = async () => {
    setCopyStatus('');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(draft.text);
      setCopyFallback(false); setCopyStatus('Writing copied.');
    } catch {
      setCopyFallback(true); setCopyStatus('Select and copy the writing below. Your draft is unchanged.');
    }
  };
  const edit = async (text: string): Promise<void> => {
    setDecisionHistory([]);
    if (!await update({ ...review, suggested: text, decisions: {}, concerns: {}, history: [...review.history, draft.text].slice(-20) })) throw new Error('Your writing has not saved. Retry saving before leaving.');
  };
  const refresh = () => {
    setDecisionHistory([]);
    const evidenceIds = session.transcript.filter(t => !t.referenceOnly && transcriptCard(session, t) === proposalCard(session, draft) && t.sectionId === draft.sectionId)
      .sort((a, b) => (a.order ?? session.transcript.indexOf(a)) - (b.order ?? session.transcript.indexOf(b))).map(t => t.id);
    const next = { ...draft, evidenceIds };
    const reconciliation = { ...createReconciliation(session, next), history: review.history };
    return submit({ ...next, reconciliation, text: composeReconciliation(reconciliation) });
  };
  const all = (decision: 'accept' | 'keep') => decide({ ...review, decisions: Object.fromEntries(hunks.map(h => [h.id, decision])) });
  return <div className="oracle-reconciliation" aria-label="Reconcile writing">
    <div className="or-review-heading"><strong>{hunks.length ? `${hunks.length - unresolved.length} of ${hunks.length} changes reviewed` : 'No text changes'}</strong>
      {hunks.length > 1 && <label><input type="checkbox" checked={focusedMode} onChange={e => { setFocusedMode(e.target.checked); if (e.target.checked && currentHunk) setFocusedId(currentHunk.id); }} /> One change at a time</label>}
      {!focusedMode && hunks.length > 1 && <label><input type="checkbox" checked={unresolvedOnly} onChange={e => setUnresolvedOnly(e.target.checked)} /> Needs review</label>}
    </div>
    <div className="or-review-navigation">
      {!!unresolved.length && <button disabled={locked} onClick={nextUnfinished}>Next unfinished change</button>}
      {!!decisionHistory.length && <button disabled={locked || stale} onClick={() => void undoDecision()}>Undo last decision</button>}
    </div>
    <details className="or-review-summary"><summary>Review summary</summary><dl>
      <div><dt>Use suggestion</dt><dd>{acceptedCount}</dd></div><div><dt>Keep current</dt><dd>{keptCount}</dd></div>
      <div><dt>Decide later</dt><dd>{deferredCount}</dd></div><div><dt>Undecided</dt><dd>{unresolved.length - deferredCount}</dd></div>
      <div><dt>Words added / removed</dt><dd>{addedWords} / {removedWords}</dd></div>
      <div><dt>Current / final words</dt><dd>{wordCount(review.base)} / {wordCount(draft.text)}</dd></div>
    </dl></details>
    {stale && <div className="or-warning" role="status"><p>The spoken words, destination, or order changed after this writing was prepared. Compare it again before approving.</p><button disabled={locked} onClick={() => void refresh()}>Review with latest words</button></div>}
    {error && <div className="ov-error" role="alert"><p>{error}</p><button disabled={locked} onClick={() => void submit(draft)}>Retry saving decision</button></div>}
    <details className="or-source"><summary>Compare current text & spoken words · {evidence.length} passages</summary>
      <div className="or-context"><section><h3>Current card</h3><pre>{review.base}</pre></section>
        <section><h3>Your spoken words</h3>{evidence.map((t, index) => <div className="or-evidence" key={t.id}><div className="or-evidence-heading"><strong>Passage {index + 1}</strong><button disabled={disabled} onClick={() => listen(t)}>Listen {time(t.startMs)}</button></div><p>{t.corrected}</p>{t.corrected !== t.raw && <details><summary>Transcription corrections</summary><Difference before={t.raw} after={t.corrected} /></details>}</div>)}
          {!evidence.length && <p>No spoken passages are linked to this writing.</p>}
        </section></div>
    </details>
    {!!hunks.length && <>
      {focusedMode && hunks.length > 1 && <nav className="or-focused-navigation" aria-label="Changes in this section"><button disabled={locked || currentIndex <= 0} onClick={() => visit(hunks[currentIndex - 1].id)}>Previous change</button><span aria-live="polite">Change {currentIndex + 1} of {hunks.length}</span><button disabled={locked || currentIndex >= hunks.length - 1} onClick={() => visit(hunks[currentIndex + 1].id)}>Next change</button></nav>}
      <div className="or-legend"><span><ins>Added words</ins> <del>Removed words</del></span><span>Choose what stays.</span></div>
      {visibleHunks.map(h => <section className="or-change" key={h.id} ref={node => { if (node) changeNodes.current.set(h.id, node); else changeNodes.current.delete(h.id); }} onFocus={() => { navigationCursor.current = h.id; }} aria-label={`Change ${hunks.indexOf(h) + 1}`}>
        <div className="or-change-title"><strong>Change {hunks.indexOf(h) + 1}</strong><small>{review.decisions[h.id] === 'accept' ? 'Using suggestion' : review.decisions[h.id] === 'keep' ? 'Keeping current' : review.decisions[h.id] === 'defer' ? 'Set aside for review' : 'Needs your decision'}</small></div>
        <Difference before={h.before} after={h.after} />
        <div className="or-actions" role="group" aria-label={`Decision for change ${hunks.indexOf(h) + 1}`}>
          <button disabled={locked || stale} aria-pressed={review.decisions[h.id] === 'accept'} onClick={() => void decide({ ...review, decisions: { ...review.decisions, [h.id]: 'accept' } }, h.id)}>Use suggestion</button>
          <button disabled={locked || stale} aria-pressed={review.decisions[h.id] === 'keep'} onClick={() => void decide({ ...review, decisions: { ...review.decisions, [h.id]: 'keep' } }, h.id)}>Keep current</button>
          <button disabled={locked || stale} aria-pressed={review.decisions[h.id] === 'defer'} onClick={() => void decide({ ...review, decisions: { ...review.decisions, [h.id]: 'defer' } }, h.id)}>Decide later</button>
        </div>
      </section>)}
      {!focusedMode && unresolvedOnly && !unresolved.length && <p className="or-complete" role="status">Every text change has a decision.</p>}
      {hunks.length > 1 && <details><summary>Decide all {hunks.length} changes together</summary><div className="or-actions"><button disabled={locked || stale} onClick={() => void all('accept')}>Use all suggestions</button><button disabled={locked || stale} onClick={() => void all('keep')}>Keep all current text</button></div></details>}
    </>}
    {!hunks.length && !draft.reconciliation && <button disabled={locked || stale} onClick={() => void update(review)}>Confirm unchanged writing</button>}
    {!!concerns.length && <section className="or-concerns" aria-label="Editorial concerns"><h3>Check before approval</h3>{concerns.map(([key, label]) => <label key={key}><input type="checkbox" disabled={locked || stale} checked={Boolean(review.concerns[key])} onChange={e => void decide({ ...review, concerns: { ...review.concerns, [key]: e.target.checked } })} /><span><strong>{label}</strong><span>{draft.feedback[key]}</span><small>I checked this against my words.</small></span></label>)}</section>}
    <details className="or-reader"><summary>Read final writing</summary>
      {!!unresolved.length && <p className="ov-note">This includes suggestions you have not decided yet.</p>}
      <div className="or-read-text" aria-label="Final writing reading view">{draft.text}</div>
      <button disabled={locked} onClick={() => void copyWriting()}>Copy final writing</button>
      {copyStatus && <p className="or-copy-status" role="status">{copyStatus}</p>}
      {copyFallback && <label className="or-copy-fallback">Writing to copy<textarea ref={copyText} aria-label="Writing to copy" readOnly value={draft.text} onFocus={e => e.currentTarget.select()} /></label>}
    </details>
    <details className="or-candidate"><summary>Edit & preview final writing</summary><p className="ov-note">This combines your decisions. Editing starts a fresh comparison and keeps the previous version.</p>
      <EditableText label="Writing" value={draft.text} disabled={disabled} save={edit} />
      {!!review.history.length && <button disabled={locked} onClick={() => { setDecisionHistory([]); const history = review.history.slice(0, -1); void update({ ...review, suggested: review.history[review.history.length - 1], decisions: {}, concerns: {}, history }); }}>Undo last writing edit</button>}
    </details>
    <details><summary>Writing notes</summary><p>{draft.feedback.changes}</p><small>{draft.author.kind === 'ai' ? `${draft.author.provider} · ${draft.author.model}` : 'Written directly by you'}</small></details>
    {onComplete && ready && <div className="or-section-complete"><p>This section is reconciled.</p><button className="ov-primary" onClick={onComplete}>Next section</button></div>}
    <p className="or-review-state" role="status">{pending ? 'Saving decision…' : stale ? 'Review the latest words to continue.' : unresolved.length ? `${unresolved.length} ${unresolved.length === 1 ? 'change needs' : 'changes need'} a decision before approval.` : concerns.some(([key]) => !review.concerns[key]) ? 'Check the editorial concerns before approval.' : !draft.reconciliation ? 'Confirm the unchanged writing before approval.' : 'Ready for your final approval.'}</p>
  </div>;
}
