import { describe, expect, it } from 'vitest';
import { addTranscript, createSession, sourceSnapshot } from '../../../lib/oracle/authoring/workflow';
import { splitPassage } from '../../../lib/oracle/authoring/organization';
import { applyReplacement, editPassage, parkPassage, previewReplacement, restorePassage, setPassageNote, undoPassage, validatePassageToolsState } from '../../../lib/oracle/authoring/passageTools';

async function fixture(text = 'The first spoken thought.') {
  let session = createSession(await sourceSnapshot(2, 'r1', 'Current card.', [{ id: 'CODE', title: 'Code', start: 0, end: 13 }]));
  session.captures.push({ id: 'audio', recordedAt: session.createdAt, mimeType: 'audio/wav', durationMs: 1000, status: 'ready', origin: 'import' });
  session = addTranscript(session, 'audio', [{ text, startMs: 0, endMs: 1000, sectionId: 'CODE', timing: 'provider', order: 4 }], 'fixture');
  return session;
}
describe('passage editing tools', () => {
  it('undoes corrected words through a bounded history while retaining immutable evidence', async () => {
    const original = await fixture(); const id = original.transcript[0].id;
    let next = editPassage(original, id, 'A corrected thought.');
    next = editPassage(next, id, 'A second correction.');
    next = undoPassage(next, id);
    expect(next.transcript[0].corrected).toBe('A corrected thought.');
    next = undoPassage(next, id);
    expect(next.transcript).toEqual(original.transcript);
    expect(undoPassage(next, id)).toBe(next);
    for (let n = 0; n < 25; n++) next = editPassage(next, id, `Edit ${n}`);
    expect(next.transcriptHistory?.[id]).toHaveLength(20);
    expect(next.transcript[0].raw).toBe(original.transcript[0].raw);
    expect(next.captures).toBe(original.captures); expect(next.source).toBe(original.source); expect(next.proposals).toBe(original.proposals);
    expect(original.transcript[0].corrected).toBe('The first spoken thought.');
  });
  it('previews and applies exact literal replacements without interpreting replacement tokens', async () => {
    const original = await fixture('a.chain a.chain A.chain $& \\'); const id = original.transcript[0].id;
    const preview = previewReplacement(original, [id], 'a.chain', '$&\\');
    expect(preview).toEqual([{ id, before: original.transcript[0].corrected, after: '$&\\ $&\\ A.chain $& \\', count: 2 }]);
    expect(original.transcript[0].corrected).toBe('a.chain a.chain A.chain $& \\');
    const changed = applyReplacement(original, [id], 'a.chain', '$&\\');
    expect(changed.transcript[0].corrected).toBe(preview[0].after);
    expect(undoPassage(changed, id).transcript[0]).toEqual(original.transcript[0]);
    expect(previewReplacement(original, [id], 'missing', 'x')).toEqual([]);
    expect(previewReplacement(original, [id], 'a.chain', 'a.chain')).toEqual([]);
  });
  it('counts nonoverlapping matches, validates all targets, and uses the current words', async () => {
    const original = await fixture('aaaa'); const id = original.transcript[0].id;
    expect(previewReplacement(original, [id], 'aa', 'x')[0]).toMatchObject({ after: 'xx', count: 2 });
    const latest = editPassage(original, id, 'aa added aa');
    expect(applyReplacement(latest, [id], 'aa', 'x').transcript[0].corrected).toBe('x added x');
    expect(() => previewReplacement(original, [id], '  ', 'x')).toThrow(/exact words/);
    expect(() => previewReplacement(original, [id, id], 'aa', 'x')).toThrow(/once/);
    expect(() => applyReplacement(original, [id, 'missing'], 'aa', 'x')).toThrow(/no longer/);
    expect(original.transcript[0].corrected).toBe('aaaa');
  });
  it('parks and restores only explicitly set-aside leaf passages with their order intact', async () => {
    const original = await fixture(); const id = original.transcript[0].id;
    const parked = parkPassage(original, id);
    expect(parked.transcript[0].referenceOnly).toBe(true); expect(parked.parkedPassageIds).toEqual([id]);
    expect(parked.proposals).toBe(original.proposals);
    expect(() => previewReplacement(parked, [id], 'first', 'second')).toThrow(/Restore/);
    const restored = restorePassage(parked, id);
    expect(restored.transcript[0]).toMatchObject({ corrected: original.transcript[0].corrected, raw: original.transcript[0].raw, referenceOnly: false, order: 4 });
    expect(restored.parkedPassageIds).toEqual([]);
    expect(() => restorePassage(restored, id)).toThrow(/Only a passage/);
    const split = splitPassage(original, id, 10, original.transcript[0].corrected);
    expect(() => restorePassage(split, id)).toThrow(/Original transcript/);
    expect(() => parkPassage(split, id)).toThrow(/active passage/);
    expect(() => restorePassage({ ...split, parkedPassageIds: [id] }, id)).toThrow(/Original transcript/);
  });
  it('attaches editable notes without changing evidence and rejects unknown targets', async () => {
    const original = await fixture(); const id = original.transcript[0].id;
    const annotated = setPassageNote(original, id, 'Check the spoken hexagram number.');
    expect(annotated.passageNotes?.[id]).toBe('Check the spoken hexagram number.');
    expect(annotated.transcript).toBe(original.transcript);
    expect(setPassageNote(annotated, id, '').passageNotes?.[id]).toBe('');
    expect(() => setPassageNote(original, id, 'x'.repeat(4001))).toThrow(/4,000/);
    for (const operation of [() => editPassage(original, 'missing', 'x'), () => undoPassage(original, 'missing'), () => parkPassage(original, 'missing'), () => restorePassage(original, 'missing'), () => setPassageNote(original, 'missing', 'x')]) expect(operation).toThrow(/no longer/);
  });
});

it('validates optional imported editor state without rejecting older drafts', async () => {
 const original = await fixture(); const id = original.transcript[0].id;
 expect(() => validatePassageToolsState(original)).not.toThrow();
 const valid = setPassageNote(editPassage(original, id, 'Corrected words.'), id, 'A note.');
 expect(() => validatePassageToolsState({ ...parkPassage(valid, id), title: 'A named draft' })).not.toThrow();
 for (const patch of [
  { title: 42 }, { title: 'x'.repeat(121) },
  { transcriptHistory: [] }, { transcriptHistory: { missing: ['old words'] } },
  { transcriptHistory: { [id]: Array(21).fill('words') } }, { transcriptHistory: { [id]: [false] } },
  { passageNotes: { missing: 'note' } }, { passageNotes: { [id]: null } }, { passageNotes: { [id]: 'x'.repeat(4001) } },
  { parkedPassageIds: [id] }, { parkedPassageIds: ['missing'] }, { parkedPassageIds: [id, id] }, { parkedPassageIds: {} },
 ]) expect(() => validatePassageToolsState({ ...original, ...patch } as never)).toThrow();
 const split = splitPassage(original, id, 10, original.transcript[0].corrected);
 expect(() => validatePassageToolsState({ ...split, parkedPassageIds: [id] })).toThrow(/protected/);
});
