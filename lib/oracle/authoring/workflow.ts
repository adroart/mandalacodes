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
export function addTranscript(session: AuthoringSession, captureId: string, input: TranscriptInput[], provider: string): AuthoringSession {
  const capture = session.captures.find(c => c.id === captureId);
  if (!capture || capture.status === 'recording') throw new Error('Finish or recover the recording first');
  const added = input.map(t => {
    if (!Number.isFinite(t.startMs) || !Number.isFinite(t.endMs) || t.startMs < 0 || t.endMs <= t.startMs || t.endMs > capture.durationMs) throw new Error('Transcript time range is outside the audio');
    if (!t.text.trim()) throw new Error('Transcript is empty');
    if (t.sectionId !== null && !session.source.sections.some(s => s.id === t.sectionId)) throw new Error('Unknown section');
    return { id: crypto.randomUUID(), captureId, startMs: t.startMs, endMs: t.endMs, raw: t.text, corrected: t.text, sectionId: t.sectionId, assignment: t.sectionId ? 'hint' as const : 'unresolved' as const, timing: t.timing, provider, receivedAt: new Date().toISOString() };
  });
  return { ...session, transcript: [...session.transcript, ...added] };
}
export function correctTranscript(session: AuthoringSession, id: string, patch: Partial<Pick<Transcript, 'corrected' | 'sectionId' | 'referenceOnly'>>): AuthoringSession {
  if (patch.sectionId !== undefined && patch.sectionId !== null && !session.source.sections.some(s => s.id === patch.sectionId)) throw new Error('Unknown section');
  if (!session.transcript.some(t => t.id === id)) throw new Error('Transcript not found');
  return { ...session, transcript: session.transcript.map(t => t.id !== id ? t : { ...t, ...patch, assignment: patch.sectionId === undefined ? t.assignment : patch.sectionId === null ? 'unresolved' : 'manual' }) };
}
function validateProposal(session: AuthoringSession, p: Proposal) {
  if (!session.source.sections.some(s => s.id === p.sectionId)) throw new Error('Unknown section');
  if (!p.text.trim()) throw new Error('Empty prose is a deletion; deletion is not supported in this capture workflow');
  if (!Array.isArray(p.evidenceIds) || !p.evidenceIds.length || new Set(p.evidenceIds).size !== p.evidenceIds.length || p.evidenceIds.some(id => !session.transcript.some(t => t.id === id && !t.referenceOnly && t.sectionId === p.sectionId))) throw new Error('Proposal requires transcript evidence assigned to this section');
  if (!p.feedback || ['changes', 'uncertainWords', 'omissions', 'contradictions', 'unsupportedAdditions'].some(key => typeof p.feedback[key as keyof typeof p.feedback] !== 'string') || !p.feedback.changes.trim()) throw new Error('Explain the changes in feedback before approval');
  if (!p.author || (p.author.kind !== 'manual' && (p.author.kind !== 'ai' || !p.author.provider?.trim() || !p.author.model?.trim()))) throw new Error('Proposal author/provider must be identified');
}
export function proposeSection(session: AuthoringSession, proposal: Proposal): AuthoringSession {
  validateProposal(session, proposal);
  return { ...session, proposals: [...session.proposals.filter(p => p.sectionId !== proposal.sectionId), structuredClone(proposal)] };
}
export async function reviewDigest(session: AuthoringSession): Promise<string> {
  // Includes all review context. Any correction, assignment, feedback or prose change needs a new approval.
  const { approvals: _approvals, ...review } = session;
  return sha256(JSON.stringify(review));
}
async function assertCurrent(session: AuthoringSession, current: SourceSnapshot) {
  const source = session.source;
  if (current.cardNumber !== source.cardNumber || current.revision !== source.revision || current.hash !== source.hash || await sha256(current.markdown) !== source.hash || await sha256(source.markdown) !== source.hash || JSON.stringify(current.sections) !== JSON.stringify(source.sections)) throw new Error('The canonical manuscript changed. Start a new review against the current source.');
}
export async function approveReview(session: AuthoringSession, current: SourceSnapshot, approvedBy: string, confirmed: boolean): Promise<AuthoringSession> {
  await assertCurrent(session, current);
  if (!confirmed || !approvedBy.trim()) throw new Error('Confirm the concrete changes and reviewer before approval');
  if (!session.proposals.length) throw new Error('No proposed changes to approve');
  if (session.captures.some(c => c.status === 'recording')) throw new Error('Finish the recording before approval');
  if (session.transcript.some(t => !t.referenceOnly && (t.assignment !== 'manual' || t.sectionId === null))) throw new Error('Review and assign every transcript excerpt, including section hints');
  if (new Set(session.proposals.map(p => p.sectionId)).size !== session.proposals.length) throw new Error('Duplicate proposal');
  session.proposals.forEach(p => validateProposal(session, p));
  const approval = { id: crypto.randomUUID(), digest: await reviewDigest(session), sourceHash: session.source.hash, sourceRevision: session.source.revision, approvedBy: approvedBy.trim(), approvedAt: new Date().toISOString() };
  return { ...session, approvals: [...session.approvals, approval] };
}
/** Prepares bytes only. Host must repeat its authoritative compare-and-swap immediately before writing. */
export async function approvedMarkdown(session: AuthoringSession, current: SourceSnapshot): Promise<string> {
  await assertCurrent(session, current);
  const digest = await reviewDigest(session);
  if (!session.approvals.some(a => a.digest === digest && a.sourceHash === current.hash && a.sourceRevision === current.revision)) throw new Error('This exact review needs explicit approval');
  let text = session.source.markdown;
  for (const section of [...session.source.sections].sort((a, b) => b.start - a.start)) {
    const p = session.proposals.find(p => p.sectionId === section.id);
    if (p) text = text.slice(0, section.start) + p.text + text.slice(section.end);
  }
  return text;
}
function literal(text: string): string {
  const fence = '`'.repeat(Math.max(3, ...Array.from(text.matchAll(/`+/g), m => m[0].length + 1)));
  return `${fence}\n${text}\n${fence}`;
}
export function editorialReceipt(session: AuthoringSession): string {
  const lines = [`# Oracle editorial receipt`, `Session: ${session.id}`, `Card: ${session.source.cardNumber}`, `Created: ${session.createdAt}`, `Original revision: ${session.source.revision}`, `Original SHA-256: ${session.source.hash}`, 'State: review record only; no manuscript application is recorded by this module.', '## Original canonical Markdown', literal(session.source.markdown), '## Audio sources'];
  for (const c of session.captures) lines.push(`${c.id}: ${c.recordedAt}, ${c.durationMs}ms, ${c.mimeType}, ${c.origin}, ${c.status}`);
  lines.push('## Visible section markers', literal(JSON.stringify(session.markers, null, 2)), '## Speech');
  for (const t of session.transcript) lines.push(`### ${t.id}`, `Audio: ${t.captureId} [${t.startMs}ms..${t.endMs}ms]; timing: ${t.timing}; provider: ${t.provider}; received: ${t.receivedAt}`, `Section: ${t.sectionId ?? 'unresolved'} (${t.assignment}); reference only: ${Boolean(t.referenceOnly)}`, 'Original transcript', literal(t.raw), 'Corrected transcript', literal(t.corrected));
  lines.push('## Proposed section replacements');
  for (const p of session.proposals) lines.push(`### ${p.sectionId}`, `Author: ${JSON.stringify(p.author)}; evidence: ${p.evidenceIds.join(', ')}`, literal(p.text), 'Feedback', literal(JSON.stringify(p.feedback, null, 2)));
  lines.push('## Explicit approvals', literal(JSON.stringify(session.approvals, null, 2)), 'Each approval covers its review digest only. Later edits require another approval. Sections without proposals remain unchanged.');
  return lines.join('\n\n') + '\n';
}
