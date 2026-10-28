import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { cardHumanPercent, editWorkingText, reconcileHumanPassages, sectionHumanPercent, WorkingCardStore } from '../../../lib/oracle/authoring/humanDrafts';
import type { SourceSnapshot, Transcript } from '../../../lib/oracle/authoring/types';
const source: SourceSnapshot = { cardNumber: 23, revision: 'base', hash: 'original', markdown: 'AI scaffold', sections: ['CODE', 'ICHING', 'KEYS', 'DESIGN', 'BODY', 'RELATIONS'].map(id => ({ id, title: id, start: 0, end: 11 })) };
const passage = (id: string, corrected: string): Transcript => ({ id, corrected, raw: corrected, captureId: 'capture', startMs: 0, endMs: 100, sectionId: 'CODE', assignment: 'manual', timing: 'manual', provider: 'human', receivedAt: '2026-10-28', cardNumber: 23 });
const initial = () => reconcileHumanPassages(undefined, source, [passage('one', 'My own words stay exactly here.')], 'session').draft;

describe('human working words', () => {
  it('replaces the initial AI scaffold with literal words and leaves canonical source alone', () => {
    const original = structuredClone(source);
    const draft = initial();
    expect(draft.text).toBe('My own words stay exactly here.');
    expect(draft.text).not.toContain('AI scaffold');
    expect(source).toEqual(original);
    expect(sectionHumanPercent(draft)).toBe(100);
    expect(cardHumanPercent([draft])).toBe(16);
    expect(cardHumanPercent(source.sections.map(s => ({ ...draft, sectionId: s.id })))).toBe(100);
  });
  it('appends distinct human speech while replaying known passages is idempotent', () => {
    const draft = initial();
    const next = reconcileHumanPassages(draft, source, [passage('one', draft.text), passage('two', 'Breathing opens space.')], 'session');
    expect(next.issues).toEqual([]);
    expect(next.draft.text).toBe(draft.text + '\n\nBreathing opens space.');
    const replay = reconcileHumanPassages(next.draft, source, [passage('two', 'Breathing opens space.')], 'session');
    expect(replay.alreadyApplied).toBe(true);
    expect(replay.draft.text).toBe(next.draft.text);
    expect(draft.blocks).toHaveLength(1);
  });
  it('updates untouched evidence corrections once without duplicating it', () => {
    const corrected = passage('one', 'My corrected words stay exactly here.');
    const next = reconcileHumanPassages(initial(), source, [corrected], 'session');
    expect(next.issues).toEqual([]);
    expect(next.draft.text).toBe(corrected.corrected);
    expect(reconcileHumanPassages(next.draft, source, [corrected], 'session').alreadyApplied).toBe(true);
  });
  it('preserves manual edits and evidence when a transcript correction arrives later', () => {
    const draft = initial();
    const edited = editWorkingText(draft, 'I refined these words myself.');
    expect(edited.blocks[0].evidence).toEqual(draft.blocks[0].evidence);
    const result = reconcileHumanPassages(edited, source, [passage('one', 'Provider changed these words.')], 'session');
    expect(result.draft.text).toBe(edited.text);
    expect(result.issues[0].code).toBe('revision');
  });
  it('asks about likely revisions and allows an explicit append or replacement', () => {
    const p = { ...passage('two', 'Actually, change that to a different thought.'), captureId: 'later-recording' };
    expect(reconcileHumanPassages(initial(), source, [p], 'session').issues[0].code).toBe('revision');
    expect(reconcileHumanPassages(initial(), source, [p], 'session', 'append').draft.blocks).toHaveLength(2);
    expect(reconcileHumanPassages(initial(), source, [p], 'session', 'replace').draft.text).toBe(p.corrected);
  });
  it('allows continuous elaboration within the same capture without revision prompts', () => {
    const one = passage('one', 'My own words stay exactly here.');
    const two = passage('two', 'My own words also stay exactly here in the body.');
    const batch = reconcileHumanPassages(undefined, source, [one, two], 'session');
    expect(batch.issues).toEqual([]);
    const continuation = reconcileHumanPassages(initial(), source, [two], 'session');
    expect(continuation.issues).toEqual([]);
    expect(continuation.draft.blocks).toHaveLength(2);
    expect(reconcileHumanPassages(initial(), source, [{ ...two, captureId: 'another' }], 'session').issues[0].code).toBe('revision');
  });
  it('explicitly appends a correction after manual edits once and preserves both versions', () => {
    const edited = editWorkingText(initial(), 'I refined these words myself.');
    const correction = passage('one', 'Corrected source speech.');
    const auto = reconcileHumanPassages(edited, source, [correction], 'session');
    expect(auto.issues[0].code).toBe('revision');
    const appended = reconcileHumanPassages(edited, source, [correction], 'session', 'append');
    expect(appended.issues).toEqual([]);
    expect(appended.draft.text).toBe('I refined these words myself.\n\nCorrected source speech.');
    expect(new Set(appended.draft.blocks.map(b => b.id)).size).toBe(2);
    const replay = reconcileHumanPassages(appended.draft, source, [correction], 'session');
    expect(replay.alreadyApplied).toBe(true);
    expect(replay.draft).toEqual(appended.draft);
  });
  it('uses exact literal evidence and retains duplicate capture provenance without repeating prose', () => {
    const draft = initial();
    expect(draft.blocks[0].evidence[0].signature).toBe(draft.text);
    const next = reconcileHumanPassages(draft, source, [{ ...passage('other', draft.text), captureId: 'second-capture' }], 'session');
    expect(next.draft.text).toBe(draft.text);
    expect(next.draft.blocks[0].evidence.map(e => e.captureId)).toEqual(['capture', 'second-capture']);
  });
  it('uses proportionate confidence checks and detects obvious transcription artifacts', () => {
    const withProbabilities = (...probabilities: number[]) => ({ ...passage('two', 'Breathing opens space.'), words: probabilities.map(probability => ({ text: 'word', startMs: 0, endMs: 20, probability })) });
    expect(reconcileHumanPassages(undefined, source, [withProbabilities(.64, .5)], 'session').issues).toEqual([]);
    expect(reconcileHumanPassages(undefined, source, [withProbabilities(.59, .59)], 'session').issues[0].code).toBe('confidence');
    expect(reconcileHumanPassages(undefined, source, [withProbabilities(.44)], 'session').issues[0].code).toBe('confidence');
    for (const text of ['Thanks for watching.', 'Subtitles by Amara', '[Music]', '♪']) {
      expect(reconcileHumanPassages(undefined, source, [passage('artifact', text)], 'session').issues[0].code).toBe('uncertain');
    }
  });
  it('reviewed IDs bypass only word checks and never accept ambiguous revisions or assignments', () => {
    const p = { ...passage('two', 'Actually, this is a chain.'), captureId: 'later-recording', words: [{ text: 'chain', startMs: 0, endMs: 20, probability: .2 }] };
    const reviewed = reconcileHumanPassages(initial(), source, [p], 'session', 'auto', ['two']);
    expect(reviewed.issues.map(i => i.code)).toEqual(['revision']);
    expect(reviewed.draft.text).toBe(initial().text);
    expect(reconcileHumanPassages(initial(), source, [p], 'session', 'append', ['two']).issues).toEqual([]);
    expect(reconcileHumanPassages(initial(), source, [{ ...p, assignment: 'unresolved' }], 'session', 'append', ['two']).issues[0].code).toBe('assignment');
    expect(reconcileHumanPassages(undefined, source, [p], 'session', 'auto', ['different-id']).issues.map(i => i.code)).toEqual(['confidence', 'uncertain']);
  });
  it('reports uncertain words and refuses unresolved or wrong-card assignments', () => {
    const p = { ...passage('two', 'This is a chain.'), words: [{ text: 'chain', startMs: 0, endMs: 20, probability: .4 }] };
    expect(reconcileHumanPassages(undefined, source, [p], 'session').issues.map(i => i.code)).toEqual(['confidence', 'uncertain']);
    expect(reconcileHumanPassages(undefined, source, [{ ...p, cardNumber: 9 }], 'session').draft.text).toBe('');
  });
});

describe('private working history', () => {
  it('atomically rejects stale revisions, preserves history, and informs other store instances', async () => {
    const name = `working-${crypto.randomUUID()}`;
    const store = new WorkingCardStore(name), second = new WorkingCardStore(name);
    let notified = 0; const stop = second.subscribe(() => notified++);
    const first = await store.save(initial(), 0);
    expect(first.revision).toBe(1);
    const next = await second.save(editWorkingText(first, 'Human edited prose.'), 1);
    await expect(store.save(editWorkingText(first, 'Stale prose.'), 1)).rejects.toThrow('Another tab');
    expect((await store.get(23, 'CODE'))?.text).toBe('Human edited prose.');
    expect(await store.versions(23, 'CODE')).toEqual([first, next]);
    expect(await store.list(23)).toEqual([next]);
    expect(notified).toBe(2); stop();
  });
});
