import type { AuthoringSession, Proposal } from './types';

export type ReconciliationDecision = 'accept' | 'keep' | 'defer';
export interface Reconciliation {
  base: string;
  suggested: string;
  evidenceKey: string;
  decisions: Record<string, ReconciliationDecision>;
  concerns: Record<string, boolean>;
  history: string[];
}
export interface ReconciliationHunk { id: string; before: string; after: string; changed: boolean }
export interface WordChange { text: string; kind: 'same' | 'add' | 'remove' }
type ReviewableProposal = Proposal & { reconciliation?: Reconciliation };
type Edit = { kind: WordChange['kind']; text: string };

/** Validate imported metadata before it reaches the editable comparison. */
export function validateReconciliation(value: unknown): asserts value is Reconciliation {
  const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
  const text = (v: unknown): v is string => typeof v === 'string' && v.length <= 2_000_000;
  if (!object(value) || !text(value.base) || !text(value.suggested) || !text(value.evidenceKey) || !object(value.decisions) || !object(value.concerns) || !Array.isArray(value.history) || value.history.length > 20 || !value.history.every(text)) throw new Error('Invalid reconciliation metadata. Refresh the comparison.');
  if (Object.keys(value.decisions).length > 50_000 || Object.entries(value.decisions).some(([key, decision]) => key.length > 100 || !['accept', 'keep', 'defer'].includes(decision as string))) throw new Error('Invalid reconciliation decisions. Refresh the comparison.');
  if (Object.keys(value.concerns).length > 100 || Object.entries(value.concerns).some(([key, resolved]) => key.length > 100 || typeof resolved !== 'boolean')) throw new Error('Invalid reconciliation concerns. Refresh the comparison.');
  // The total size matters as well: twenty individually large history entries
  // must not turn a portable review into an unbounded local allocation.
  if (JSON.stringify(value).length > 2_000_000) throw new Error('Reconciliation metadata is too large. Keep a copy and refresh the comparison.');
}

// Bound the LCS table so a long recording cannot freeze the editor. Above this
// limit, retain identical edges and show the middle as one explicit change.
function diff(a: string[], b: string[]): Edit[] {
  if (a.length * b.length > 250_000) {
    let start = 0, aEnd = a.length, bEnd = b.length;
    while (start < aEnd && start < bEnd && a[start] === b[start]) start++;
    while (aEnd > start && bEnd > start && a[aEnd - 1] === b[bEnd - 1]) { aEnd--; bEnd--; }
    const bounded: Edit[] = [
      { kind: 'same', text: a.slice(0, start).join('') },
      { kind: 'remove', text: a.slice(start, aEnd).join('') },
      { kind: 'add', text: b.slice(start, bEnd).join('') },
      { kind: 'same', text: a.slice(aEnd).join('') },
    ];
    return bounded.filter(v => v.text);
  }
  const rows = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--)
    rows[i][j] = a[i] === b[j] ? rows[i + 1][j + 1] + 1 : Math.max(rows[i + 1][j], rows[i][j + 1]);
  const edits: Edit[] = [];
  const append = (kind: Edit['kind'], text: string) => {
    const last = edits[edits.length - 1];
    if (last?.kind === kind) last.text += text;
    else edits.push({ kind, text });
  };
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { append('same', a[i]); i++; j++; }
    else if (i < a.length && (j === b.length || rows[i + 1][j] >= rows[i][j + 1])) append('remove', a[i++]);
    else append('add', b[j++]);
  }
  return edits;
}
const lines = (text: string): string[] => text.match(/[^\n]*\n|[^\n]+$/g) ?? [];
const words = (text: string): string[] => text.match(/\s+|[^\s]+/g) ?? [];

/** Includes unchanged runs: joining before/after reconstructs either input byte for byte. */
export function reconcileHunks(base: string, suggested: string): ReconciliationHunk[] {
  const hunks: ReconciliationHunk[] = [];
  for (const edit of diff(lines(base), lines(suggested))) {
    const changed = edit.kind !== 'same', last = hunks[hunks.length - 1];
    if (changed && last?.changed) {
      if (edit.kind === 'remove') last.before += edit.text;
      else last.after += edit.text;
    } else hunks.push({ id: `change-${hunks.length + 1}`, before: edit.kind === 'add' ? '' : edit.text, after: edit.kind === 'remove' ? '' : edit.text, changed });
  }
  return hunks;
}

export function wordDiff(before: string, after: string): WordChange[] { return diff(words(before), words(after)); }

/** A deterministic local comparison key, not a security hash or provider attribution. */
export function evidenceKey(session: AuthoringSession, proposal: Proposal): string {
  const card = proposal.cardNumber ?? session.source.cardNumber;
  const source = [session.source, ...(session.relatedSources ?? [])].find(s => s.cardNumber === card);
  const section = source?.sections.find(s => s.id === proposal.sectionId);
  const relevant = session.transcript.map((t, index) => ({ t, index }))
    .filter(({ t }) => proposal.evidenceIds.includes(t.id) || (!t.referenceOnly && (t.cardNumber ?? session.source.cardNumber) === card && t.sectionId === proposal.sectionId))
    .sort((a, b) => (a.t.order ?? a.index) - (b.t.order ?? b.index))
    .map(({ t }) => [t.id, t.corrected, t.cardNumber ?? session.source.cardNumber, t.sectionId, !!t.referenceOnly, t.parentId ?? null]);
  return JSON.stringify([card, proposal.sectionId, source?.hash, source?.revision, section && source?.markdown.slice(section.start, section.end), [...proposal.evidenceIds].sort(), relevant]);
}

export function createReconciliation(session: AuthoringSession, proposal: Proposal): Reconciliation {
  const card = proposal.cardNumber ?? session.source.cardNumber;
  const source = [session.source, ...(session.relatedSources ?? [])].find(s => s.cardNumber === card);
  const section = source?.sections.find(s => s.id === proposal.sectionId);
  if (!source || !section) throw new Error('The original card section is required for reconciliation.');
  return { base: source.markdown.slice(section.start, section.end), suggested: proposal.text, evidenceKey: evidenceKey(session, proposal), decisions: {}, concerns: {}, history: [] };
}

export function composeReconciliation(review: Reconciliation): string {
  validateReconciliation(review);
  return reconcileHunks(review.base, review.suggested).map(h => h.changed && review.decisions[h.id] === 'keep' ? h.before : h.after).join('');
}

export function reviewProblems(session: AuthoringSession, proposal: ReviewableProposal): string[] {
  const review = proposal.reconciliation;
  if (!review) return ['Compare this writing with the current card before approving.'];
  try { validateReconciliation(review); } catch { return ['Invalid reconciliation metadata. Refresh the comparison.']; }
  const problems: string[] = [];
  if (review.evidenceKey !== evidenceKey(session, proposal)) problems.push('The words or destination changed. Refresh this comparison.');
  const card = proposal.cardNumber ?? session.source.cardNumber;
  const source = [session.source, ...(session.relatedSources ?? [])].find(s => s.cardNumber === card);
  const section = source?.sections.find(s => s.id === proposal.sectionId);
  if (!source || !section || source.markdown.slice(section.start, section.end) !== review.base) problems.push('The current card text changed. Refresh this comparison.');
  const changes = reconcileHunks(review.base, review.suggested).filter(h => h.changed);
  if (changes.some(h => !['accept', 'keep', 'defer'].includes(review.decisions[h.id]))) problems.push('Choose the writing to use for each change.');
  if (changes.some(h => review.decisions[h.id] === 'defer')) problems.push('Resolve the changes left for later.');
  for (const [key, value] of Object.entries(proposal.feedback))
    if (key !== 'changes' && value.trim() && !review.concerns[key]) problems.push(`Review ${({ uncertainWords: 'uncertain words', omissions: 'omissions', contradictions: 'contradictions', unsupportedAdditions: 'unsupported additions' } as Record<string, string>)[key] ?? key}.`);
  if (proposal.text !== composeReconciliation(review)) problems.push('The edited writing needs a fresh comparison.');
  return problems;
}
