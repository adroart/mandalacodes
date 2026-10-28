import { describe, expect, it } from 'vitest';
import { composeReconciliation, createReconciliation, evidenceKey, reconcileHunks, reviewProblems, validateReconciliation, wordDiff } from '../../../lib/oracle/authoring/reconciliation';
import { addTranscript, approveReview, correctTranscript, createSession, proposeSection, sourceSnapshot } from '../../../lib/oracle/authoring/workflow';
import type { Proposal } from '../../../lib/oracle/authoring/types';

async function fixture() {
  const markdown = 'First thought.\n\nSecond thought.\n\nLast thought.\n';
  const source = await sourceSnapshot(1, 'r1', markdown, [{ id: 'CODE', title: 'Code', start: 0, end: markdown.length }]);
  let session = createSession(source);
  session.captures.push({ id: 'clip', recordedAt: session.createdAt, mimeType: 'audio/webm', durationMs: 5000, status: 'ready', origin: 'import' });
  session = addTranscript(session, 'clip', [{ startMs: 0, endMs: 2000, text: 'The first thought opens.', sectionId: 'CODE', timing: 'provider' }, { startMs: 2000, endMs: 5000, text: 'The last thought settles.', sectionId: 'CODE', timing: 'provider' }], 'test');
  const proposal: Proposal = { sectionId: 'CODE', text: 'First thought opens.\n\nSecond thought.\n\nLast thought settles.\n', evidenceIds: session.transcript.map(t => t.id), author: { kind: 'manual' }, feedback: { changes: 'Expanded first and last thoughts.', uncertainWords: '', omissions: '', contradictions: '', unsupportedAdditions: '' } };
  return { session, proposal };
}

describe('section reconciliation', () => {
  it('preserves exact input bytes, whitespace, CRLF and empty edges in either direction', () => {
    for (const [before, after] of [['', 'New\n'], ['Old\n', ''], ['One\r\n\r\nTwo  \n', 'One\r\n\r\nChanged\n'], ['same', 'same'], ['a\nb\nc\n', 'c\nb\na\n'], ['a', 'a\n']]) {
      const hunks = reconcileHunks(before, after);
      expect(hunks.map(h => h.before).join('')).toBe(before);
      expect(hunks.map(h => h.after).join('')).toBe(after);
      expect(hunks).toEqual(reconcileHunks(before, after));
    }
  });
  it('accepts and keeps independent changes without losing unchanged paragraphs', async () => {
    const { session, proposal } = await fixture();
    const review = createReconciliation(session, proposal), changes = reconcileHunks(review.base, review.suggested).filter(h => h.changed);
    expect(changes).toHaveLength(2);
    expect(reviewProblems(session, { ...proposal, reconciliation: review })).toContain('Choose the writing to use for each change.');
    review.decisions[changes[0].id] = 'accept'; review.decisions[changes[1].id] = 'keep';
    const composed = composeReconciliation(review);
    expect(composed).toBe('First thought opens.\n\nSecond thought.\n\nLast thought.\n');
    expect(reviewProblems(session, { ...proposal, text: composed, reconciliation: review })).toEqual([]);
    review.decisions[changes[1].id] = 'defer';
    expect(reviewProblems(session, { ...proposal, reconciliation: review })).toContain('Resolve the changes left for later.');
  });
  it('requires explicit acknowledgement of editorial concerns and catches unreviewed edits', async () => {
    const { session, proposal } = await fixture();
    proposal.feedback.contradictions = 'The spoken opening contradicts the old ending.';
    const review = createReconciliation(session, proposal);
    for (const h of reconcileHunks(review.base, review.suggested).filter(h => h.changed)) review.decisions[h.id] = 'accept';
    expect(reviewProblems(session, { ...proposal, reconciliation: review })).toEqual(['Review contradictions.']);
    review.concerns.contradictions = true;
    expect(reviewProblems(session, { ...proposal, reconciliation: review })).toEqual([]);
    expect(reviewProblems(session, { ...proposal, text: 'A new unreviewed edit.', reconciliation: review })).toContain('The edited writing needs a fresh comparison.');
  });
  it('detects changed words, new evidence, moved evidence and reordered passages but not confirmation', async () => {
    const { session, proposal } = await fixture();
    const originalKey = evidenceKey(session, proposal);
    expect(evidenceKey(correctTranscript(session, session.transcript[0].id, { sectionId: 'CODE' }), proposal)).toBe(originalKey);
    expect(evidenceKey(correctTranscript(session, session.transcript[0].id, { corrected: 'A correction.' }), proposal)).not.toBe(originalKey);
    expect(evidenceKey(correctTranscript(session, session.transcript[0].id, { sectionId: null }), proposal)).not.toBe(originalKey);
    expect(evidenceKey(correctTranscript(session, session.transcript[0].id, { order: 9 }), proposal)).not.toBe(originalKey);
    const added = addTranscript(session, 'clip', [{ startMs: 1000, endMs: 2000, text: 'Additional thought.', sectionId: 'CODE', timing: 'provider' }], 'test');
    expect(evidenceKey(added, proposal)).not.toBe(originalKey);
    const review = createReconciliation(session, proposal);
    expect(reviewProblems(added, { ...proposal, reconciliation: review })).toContain('The words or destination changed. Refresh this comparison.');
  });
  it('reconstructs both versions in word highlights and bounds a large comparison', () => {
    const before = 'Keep this,  change that.\n', after = 'Keep this,  expand that.\n';
    const diff = wordDiff(before, after);
    expect(diff.filter(w => w.kind !== 'add').map(w => w.text).join('')).toBe(before);
    expect(diff.filter(w => w.kind !== 'remove').map(w => w.text).join('')).toBe(after);
    const largeBefore = Array.from({ length: 2000 }, (_, i) => `line ${i}\n`).join('');
    const largeAfter = largeBefore.replace('line 1000\n', 'a revised line\n');
    const hunks = reconcileHunks(largeBefore, largeAfter);
    expect(hunks.map(h => h.before).join('')).toBe(largeBefore);
    expect(hunks.map(h => h.after).join('')).toBe(largeAfter);
    expect(hunks.filter(h => h.changed)).toHaveLength(1);
  });
  it('blocks approval for pending, deferred and stale comparisons then permits explicit choices', async () => {
    const { proposal, session: original } = await fixture();
    let session = original;
    for (const t of session.transcript) session = correctTranscript(session, t.id, { sectionId: 'CODE' });
    const review = createReconciliation(session, proposal);
    session = proposeSection(session, { ...proposal, reconciliation: review });
    await expect(approveReview(session, session.source, 'Adrian', true)).rejects.toThrow(/choose|review|reconcil/i);
    const choices = reconcileHunks(review.base, review.suggested).filter(h => h.changed);
    for (const h of choices) review.decisions[h.id] = 'accept';
    review.decisions[choices[0].id] = 'defer';
    session = proposeSection(session, { ...proposal, reconciliation: review });
    await expect(approveReview(session, session.source, 'Adrian', true)).rejects.toThrow(/later|defer|review|reconcil/i);
    review.decisions[choices[0].id] = 'keep';
    session = proposeSection(session, { ...proposal, text: composeReconciliation(review), reconciliation: review });
    const stale = correctTranscript(session, session.transcript[0].id, { corrected: 'Changed after comparison.' });
    await expect(approveReview(stale, session.source, 'Adrian', true)).rejects.toThrow(/changed|refresh|review|reconcil/i);
    expect((await approveReview(session, session.source, 'Adrian', true)).approvals).toHaveLength(1);
  });
  it('rejects malformed or oversized imported metadata before composing', async () => {
    const { session, proposal } = await fixture(), review = createReconciliation(session, proposal);
    expect(() => validateReconciliation(review)).not.toThrow();
    for (const bad of [null, {}, { ...review, decisions: [] }, { ...review, decisions: { 'change-1': 'maybe' } }, { ...review, concerns: { omissions: 'yes' } }, { ...review, history: Array(21).fill('old') }, { ...review, suggested: 'x'.repeat(2_000_001) }]) {
      expect(() => validateReconciliation(bad)).toThrow(/reconciliation/i);
      expect(reviewProblems(session, { ...proposal, reconciliation: bad as typeof review }).length).toBeGreaterThan(0);
    }
  });
});
