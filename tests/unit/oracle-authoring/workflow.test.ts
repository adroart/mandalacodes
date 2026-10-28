import { describe, expect, it } from 'vitest';
import { createSession, sourceSnapshot, addTranscript, correctTranscript, proposeSection, approveReview, approvedMarkdown, editorialReceipt, reviewDigest } from '../../../lib/oracle/authoring/workflow';

const manuscript = '# Card 1\n\n## Code\nOriginal code.\n\n## Body\nOriginal body.\n';
const snapshot = () => sourceSnapshot(1, 'git:abc', manuscript, [
  { id: 'CODE', title: 'Code', start: manuscript.indexOf('Original code.'), end: manuscript.indexOf('Original code.') + 'Original code.'.length },
  { id: 'BODY', title: 'Body', start: manuscript.indexOf('Original body.'), end: manuscript.indexOf('Original body.') + 'Original body.'.length },
]);
async function draft() {
  let s = createSession(await snapshot());
  s.captures.push({ id: 'audio', recordedAt: '2026-10-28T00:00:00Z', mimeType: 'audio/webm', durationMs: 5000, status: 'ready', origin: 'import' });
  s = addTranscript(s, 'audio', [{ startMs: 0, endMs: 5000, text: 'My spoken code', sectionId: 'CODE', timing: 'recording' }], 'manual');
  s = correctTranscript(s, s.transcript[0].id, { sectionId: 'CODE' });
  return proposeSection(s, { sectionId: 'CODE', text: 'My revised code.', evidenceIds: [s.transcript[0].id], author: { kind: 'manual' }, feedback: { changes: 'Clarified the spoken idea.', uncertainWords: '', omissions: '', contradictions: '', unsupportedAdditions: '' } });
}
describe('reviewed authoring', () => {
  it('preserves every undisclosed section byte for byte', async () => {
    const s = await draft();
    const approved = await approveReview(s, await snapshot(), 'Adrian', true);
    expect(await approvedMarkdown(approved, await snapshot())).toBe(manuscript.replace('Original code.', 'My revised code.'));
    expect(editorialReceipt(approved)).toContain('Original body.');
    expect(editorialReceipt(approved)).toContain('My spoken code');
  });
  it('requires concrete approval and rejects a stale canonical source', async () => {
    const s = await draft();
    await expect(approveReview(s, await snapshot(), 'Adrian', false)).rejects.toThrow(/confirm/i);
    const newer = await sourceSnapshot(1, 'git:new', manuscript.replace('Original body.', 'Changed body.'), []);
    await expect(approveReview(s, newer, 'Adrian', true)).rejects.toThrow(/changed/i);
    const approved = await approveReview(s, await snapshot(), 'Adrian', true);
    await expect(approvedMarkdown(approved, newer)).rejects.toThrow(/changed/i);
  });
  it('keeps raw words immutable and invalidates approval after corrections or proposal edits', async () => {
    const s = await approveReview(await draft(), await snapshot(), 'Adrian', true);
    const next = correctTranscript(s, s.transcript[0].id, { corrected: 'A corrected word', sectionId: 'CODE' });
    expect(next.transcript[0].raw).toBe('My spoken code');
    expect(s.transcript[0].corrected).toBe('My spoken code');
    expect(await reviewDigest(next)).not.toBe(s.approvals[0].digest);
    await expect(approvedMarkdown(next, await snapshot())).rejects.toThrow(/approval/i);
    const changed = { ...s, proposals: s.proposals.map(p => ({ ...p, text: 'Other prose' })) };
    await expect(approvedMarkdown(changed, await snapshot())).rejects.toThrow(/approval/i);
  });
  it('requires reviewed section assignments, evidence, feedback, and explicit deletion', async () => {
    const s = await draft();
    const unresolved = correctTranscript(s, s.transcript[0].id, { sectionId: null });
    await expect(approveReview(unresolved, await snapshot(), 'Adrian', true)).rejects.toThrow(/assign/i);
    const hinted = { ...s, transcript: s.transcript.map(t => ({ ...t, assignment: 'hint' as const })) };
    await expect(approveReview(hinted, await snapshot(), 'Adrian', true)).rejects.toThrow(/assign/i);
    expect(() => proposeSection(s, { ...s.proposals[0], evidenceIds: [] })).toThrow(/evidence/i);
    expect(() => proposeSection(s, { ...s.proposals[0], text: '' })).toThrow(/deletion/i);
    const noFeedback = { ...s, proposals: s.proposals.map(p => ({ ...p, feedback: { ...p.feedback, changes: '' } })) };
    await expect(approveReview(noFeedback, await snapshot(), 'Adrian', true)).rejects.toThrow(/feedback/i);
  });
  it('rejects invalid ranges and allows unresolved recording-level transcripts without inventing timestamps', async () => {
    await expect(sourceSnapshot(1, 'r', manuscript, [{ id: 'CODE', title: 'Code', start: 10000, end: 10001 }])).rejects.toThrow(/range/i);
    const s = await draft();
    expect(() => addTranscript(s, 'audio', [{ startMs: -1, endMs: 9, text: 'bad', sectionId: null, timing: 'manual' }], 'manual')).toThrow(/time/i);
    const next = addTranscript(s, 'audio', [{ startMs: 0, endMs: 5000, text: 'Uncertain words', sectionId: null, timing: 'recording' }], 'manual');
    expect(next.transcript.at(-1)?.assignment).toBe('unresolved');
    expect(next.transcript.at(-1)?.timing).toBe('recording');
  });
});
