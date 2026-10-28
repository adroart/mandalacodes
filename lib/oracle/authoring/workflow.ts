import { reviewProblems, composeReconciliation, validateReconciliation } from './reconciliation';
import type { AuthoringSession, SourceSection, SourceSnapshot, TranscriptInput, Proposal, Transcript } from './types';

export async function sha256(text: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join('');
}
export async function sourceSnapshot(cardNumber: number, revision: string, markdown: string, sections: SourceSection[]): Promise<SourceSnapshot> {
  if (!Number.isInteger(cardNumber) || cardNumber < 1 || cardNumber > 64 || !revision.trim()) throw new Error('Card and source revision are required');
  const ids = new Set<string>();
  let lastEnd = 0;
  for (const s of [...sections].sort((a, b) => a.start - b.start)) {
    if (!s.id || ids.has(s.id) || !Number.isInteger(s.start) || !Number.isInteger(s.end) || s.start < lastEnd || s.end <= s.start || s.end > markdown.length) throw new Error('Invalid or overlapping section range');
    ids.add(s.id); lastEnd = s.end;
  }
  return { cardNumber, revision, markdown, sections: structuredClone(sections), hash: await sha256(markdown) };
}
export function createSession(source: SourceSnapshot): AuthoringSession {
  return { schema: 1, id: crypto.randomUUID(), createdAt: new Date().toISOString(), source: structuredClone(source), captures: [], markers: [], transcript: [], proposals: [], approvals: [] };
}
export function sessionSources(session: AuthoringSession): SourceSnapshot[] {
  const sources = [session.source, ...(session.relatedSources ?? [])];
  if (sources.length > 64 || new Set(sources.map(s => s.cardNumber)).size !== sources.length) throw new Error('Each card must have exactly one source snapshot');
  return sources;
}
export const transcriptCard = (session: AuthoringSession, t: Pick<Transcript, 'cardNumber'>): number => t.cardNumber ?? session.source.cardNumber;
export const proposalCard = (session: AuthoringSession, p: Pick<Proposal, 'cardNumber'>): number => p.cardNumber ?? session.source.cardNumber;
function sourceFor(session: AuthoringSession, cardNumber: number): SourceSnapshot {
  const source = sessionSources(session).find(s => s.cardNumber === cardNumber);
  if (!source) throw new Error('Load the original source snapshot before assigning this card');
  return source;
}
export function validateTranscriptParent(session: AuthoringSession, t: Pick<Transcript, 'parentId' | 'captureId' | 'startMs' | 'endMs'>) {
  if (t.parentId === undefined) return;
  const parent = session.transcript.find(p => p.id === t.parentId);
  if (!parent || !parent.referenceOnly || parent.captureId !== t.captureId || parent.startMs > t.startMs || parent.endMs < t.endMs || parent.parentId !== undefined) throw new Error('A derived excerpt requires its retained original parent and matching audio time range');
}
export function addTranscript(session: AuthoringSession, captureId: string, input: TranscriptInput[], provider: string): AuthoringSession {
  const capture = session.captures.find(c => c.id === captureId);
  if (!capture || capture.status === 'recording') throw new Error('Finish or recover the recording first');
  const added = input.map(t => {
    if (!Number.isFinite(t.startMs) || !Number.isFinite(t.endMs) || t.startMs < 0 || t.endMs <= t.startMs || t.endMs > capture.durationMs) throw new Error('Transcript time range is outside the audio');
    if (!t.text.trim()) throw new Error('Transcript is empty');
    if (t.speaker !== undefined && (typeof t.speaker !== 'string' || t.speaker.length > 256)) throw new Error('Invalid speaker identity');
    if (t.words !== undefined && (!Array.isArray(t.words) || t.words.length > 50000 || t.words.some(word => !Number.isFinite(word.startMs) || !Number.isFinite(word.endMs) || word.startMs < 0 || word.endMs < word.startMs || word.endMs > capture.durationMs || typeof word.text !== 'string' || word.text.length > 1000 || (word.probability !== undefined && (!Number.isFinite(word.probability) || word.probability < 0 || word.probability > 1))))) throw new Error('Invalid provider word alignment');
    const source = sourceFor(session, t.cardNumber ?? session.source.cardNumber);
    if (t.sectionId !== null && !source.sections.some(s => s.id === t.sectionId)) throw new Error('Unknown section');
    if (t.order !== undefined && (!Number.isInteger(t.order) || t.order < 0)) throw new Error('Excerpt order must be a nonnegative integer');
    validateTranscriptParent(session, { ...t, captureId });
    return { id: crypto.randomUUID(), captureId, startMs: t.startMs, endMs: t.endMs, raw: t.text, corrected: t.text, sectionId: t.sectionId, assignment: t.sectionId ? 'hint' as const : 'unresolved' as const, timing: t.timing, provider, receivedAt: new Date().toISOString(), ...(t.cardNumber === undefined ? {} : { cardNumber: t.cardNumber }), ...(t.order === undefined ? {} : { order: t.order }), ...(t.parentId === undefined ? {} : { parentId: t.parentId }), ...(t.words === undefined ? {} : { words: structuredClone(t.words) }), ...(t.speaker === undefined ? {} : { speaker: t.speaker }) };
  });
  return { ...session, transcript: [...session.transcript, ...added] };
}
export function correctTranscript(session: AuthoringSession, id: string, patch: Partial<Pick<Transcript, 'corrected' | 'sectionId' | 'referenceOnly' | 'cardNumber' | 'order'>>): AuthoringSession {
  const existing = session.transcript.find(t => t.id === id);
  if (!existing) throw new Error('Transcript not found');
  const cardNumber = patch.cardNumber ?? transcriptCard(session, existing);
  const source = sourceFor(session, cardNumber);
  const sectionId = patch.sectionId === undefined ? existing.sectionId : patch.sectionId;
  if (sectionId !== null && !source.sections.some(s => s.id === sectionId)) throw new Error('Unknown section');
  if (patch.order !== undefined && (!Number.isInteger(patch.order) || patch.order < 0)) throw new Error('Excerpt order must be a nonnegative integer');
  if (patch.referenceOnly === false && session.transcript.some(t => t.parentId === id)) throw new Error('Keep the original parent as reference while derived excerpts exist');
  return { ...session, transcript: session.transcript.map(t => t.id !== id ? t : { ...t, ...patch, assignment: patch.sectionId === undefined && patch.cardNumber === undefined ? t.assignment : sectionId === null ? 'unresolved' : 'manual' }) };
}
function validateProposal(session: AuthoringSession, p: Proposal) {
  if (p.reconciliation !== undefined) validateReconciliation(p.reconciliation);
  const card = proposalCard(session, p);
  if (!sourceFor(session, card).sections.some(s => s.id === p.sectionId)) throw new Error('Unknown section');
  if (!p.text.trim()) throw new Error('Empty prose is a deletion; deletion is not supported in this capture workflow');
  if (!Array.isArray(p.evidenceIds) || !p.evidenceIds.length || new Set(p.evidenceIds).size !== p.evidenceIds.length || p.evidenceIds.some(id => !session.transcript.some(t => t.id === id && !t.referenceOnly && t.sectionId === p.sectionId && transcriptCard(session, t) === card))) throw new Error('Proposal requires transcript evidence assigned to this card and section');
  if (!p.feedback || ['changes', 'uncertainWords', 'omissions', 'contradictions', 'unsupportedAdditions'].some(key => typeof p.feedback[key as keyof typeof p.feedback] !== 'string') || !p.feedback.changes.trim()) throw new Error('Explain the changes in feedback before approval');
  if (!p.author || (p.author.kind !== 'manual' && (p.author.kind !== 'ai' || !p.author.provider?.trim() || !p.author.model?.trim()))) throw new Error('Proposal author/provider must be identified');
}
export function proposeSection(session: AuthoringSession, proposal: Proposal): AuthoringSession {
  validateProposal(session, proposal);
  return { ...session, proposals: [...session.proposals.filter(p => p.sectionId !== proposal.sectionId || proposalCard(session, p) !== proposalCard(session, proposal)), structuredClone(proposal)] };
}
export async function reviewDigest(session: AuthoringSession): Promise<string> {
  // Includes card routing, excerpt ordering and every source snapshot as well as prose.
  const { approvals: _approvals, ...review } = session;
  return sha256(JSON.stringify(review));
}
async function assertCurrent(session: AuthoringSession, current: SourceSnapshot | SourceSnapshot[]) {
  const sources = sessionSources(session), fresh = Array.isArray(current) ? current : [current];
  if (fresh.length !== sources.length || new Set(fresh.map(s => s.cardNumber)).size !== fresh.length) throw new Error('Check every card source before approving or exporting this review');
  for (const source of sources) {
    const latest = fresh.find(s => s.cardNumber === source.cardNumber);
    if (!latest) throw new Error('Check all card sources before approving or exporting this review');
    if (latest.revision !== source.revision || latest.hash !== source.hash || await sha256(latest.markdown) !== source.hash || await sha256(source.markdown) !== source.hash || JSON.stringify(latest.sections) !== JSON.stringify(source.sections)) throw new Error('The canonical manuscript changed. Start a new review against the current source.');
  }
}
export async function approveReview(session: AuthoringSession, current: SourceSnapshot | SourceSnapshot[], approvedBy: string, confirmed: boolean): Promise<AuthoringSession> {
  await assertCurrent(session, current);
  if (!confirmed || !approvedBy.trim()) throw new Error('Confirm the concrete changes and reviewer before approval');
  if (!session.proposals.length) throw new Error('No proposed changes to approve');
  if (session.captures.some(c => c.status === 'recording')) throw new Error('Finish the recording before approval');
  if (session.transcript.some(t => !t.referenceOnly && (t.assignment !== 'manual' || t.sectionId === null))) throw new Error('Review and assign every transcript excerpt, including section hints');
  if (new Set(session.proposals.map(p => `${proposalCard(session, p)}:${p.sectionId}`)).size !== session.proposals.length) throw new Error('Duplicate proposal');
  session.transcript.forEach(t => { sourceFor(session, transcriptCard(session, t)); validateTranscriptParent(session, t); });
  session.proposals.forEach(p => {
    validateProposal(session, p);
    if (p.reconciliation) {
      const problems = reviewProblems(session, p);
      if (problems.length) throw new Error(`Reconcile this writing before approval: ${problems.join('; ')}`);
      if (composeReconciliation(p.reconciliation) !== p.text) throw new Error('The reviewed decisions do not match the writing. Review it again.');
    }
  });
  const sources = sessionSources(session);
  const approval = { id: crypto.randomUUID(), digest: await reviewDigest(session), sourceHash: session.source.hash, sourceRevision: session.source.revision, approvedBy: approvedBy.trim(), approvedAt: new Date().toISOString(), ...(sources.length === 1 ? {} : { sourceHashes: Object.fromEntries(sources.map(s => [s.cardNumber, s.hash])), sourceRevisions: Object.fromEntries(sources.map(s => [s.cardNumber, s.revision])) }) };
  return { ...session, approvals: [...session.approvals, approval] };
}
/** Prepares bytes only. Host must repeat an authoritative compare-and-swap before any write. */
export async function approvedManuscripts(session: AuthoringSession, current: SourceSnapshot[]): Promise<{ cardNumber: number; markdown: string }[]> {
  await assertCurrent(session, current);
  const digest = await reviewDigest(session), sources = sessionSources(session);
  if (!session.approvals.some(a => a.digest === digest && sources.every(s => sources.length === 1 ? a.sourceHash === s.hash && a.sourceRevision === s.revision : a.sourceHashes?.[s.cardNumber] === s.hash && a.sourceRevisions?.[s.cardNumber] === s.revision))) throw new Error('This exact review needs explicit approval');
  return sources.map(source => {
    let text = source.markdown;
    for (const section of [...source.sections].sort((a, b) => b.start - a.start)) {
      const p = session.proposals.find(p => p.sectionId === section.id && proposalCard(session, p) === source.cardNumber);
      if (p) text = text.slice(0, section.start) + p.text + text.slice(section.end);
    }
    return { cardNumber: source.cardNumber, markdown: text };
  });
}
export async function approvedMarkdown(session: AuthoringSession, current: SourceSnapshot | SourceSnapshot[], selectedCardNumber = session.source.cardNumber): Promise<string> {
  const results = await approvedManuscripts(session, Array.isArray(current) ? current : [current]);
  const selected = results.find(s => s.cardNumber === selectedCardNumber);
  if (!selected) throw new Error('Card source not included in this review');
  return selected.markdown;
}
function literal(text: string): string {
  const fence = '`'.repeat(Math.max(3, ...Array.from(text.matchAll(/`+/g), m => m[0].length + 1)));
  return `${fence}\n${text}\n${fence}`;
}
export function editorialReceipt(session: AuthoringSession): string {
  const lines = [`# Oracle editorial receipt`, `Session: ${session.id}`, `Card: ${session.source.cardNumber}`, `Created: ${session.createdAt}`, `Original revision: ${session.source.revision}`, `Original SHA-256: ${session.source.hash}`, 'State: review record only; no manuscript application is recorded by this module.', '## Original canonical Markdown', literal(session.source.markdown), '## Audio sources'];
  for (const source of session.relatedSources ?? []) lines.push(`## Original canonical Markdown · Card: ${source.cardNumber}`, `Revision: ${source.revision}; SHA-256: ${source.hash}`, literal(source.markdown));
  for (const c of session.captures) { if (c.arCreate) lines.push(`AR Create receipt: ${JSON.stringify(c.arCreate)}`); lines.push(`${c.id}: ${c.recordedAt}, ${c.durationMs}ms, ${c.mimeType}, ${c.origin}, ${c.status}`); }
  lines.push('## Visible section markers', literal(JSON.stringify(session.markers, null, 2)), '## Speech');
  for (const t of session.transcript) lines.push(`### ${t.id}`, `Audio: ${t.captureId} [${t.startMs}ms..${t.endMs}ms]; timing: ${t.timing}; provider: ${t.provider}; received: ${t.receivedAt}`, `Card: ${transcriptCard(session, t)}; order: ${t.order ?? session.transcript.indexOf(t)}; parent: ${t.parentId ?? 'original'}; Section: ${t.sectionId ?? 'unresolved'} (${t.assignment}); reference only: ${Boolean(t.referenceOnly)}`, 'Original transcript', literal(t.raw), 'Provider alignment', literal(JSON.stringify({ words: t.words ?? [], speaker: t.speaker ?? null })), 'Corrected transcript', literal(t.corrected));
  lines.push('## Proposed section replacements');
  for (const p of session.proposals) lines.push(`### Card: ${proposalCard(session, p)} · ${p.sectionId}`, `Author: ${JSON.stringify(p.author)}; evidence: ${p.evidenceIds.join(', ')}`, literal(p.text), 'Feedback', literal(JSON.stringify(p.feedback, null, 2)));
  lines.push('## Explicit approvals', literal(JSON.stringify(session.approvals, null, 2)), 'Each approval covers its review digest only. Later edits require another approval. Sections without proposals remain unchanged.');
  return lines.join('\n\n') + '\n';
}
