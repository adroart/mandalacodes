import {describe, expect, it} from 'vitest';
import {cardSections} from '../../../lib/oracle/authoring/cardSections';
import {manuscriptSource} from '../../../lib/oracle/authoring/source';
import type {WorkingSection} from '../../../lib/oracle/authoring/humanDrafts';
import type {SectionDraftSession} from '../../../lib/oracle/authoring/sectionDrafts';
import {
  buildVoiceBundle, parseVoiceBundle, serializeVoiceBundle, validateVoiceBundle,
  VoiceBundleError, VOICE_BUNDLE_LIMITS, type VoiceBundle,
} from '../../../lib/oracle/authoring/voiceExport';
import {sha256} from '../../../lib/oracle/authoring/workflow';

/** A small synthetic manuscript with the six lenses the parser requires. */
const MARKDOWN = [
  '---', 'number: 2', 'card_name: Test card', 'meta:', '  centre: "The original entrance."', '---', '',
  '## CODE', '', 'First code paragraph.', '', 'Second code paragraph.', '',
  '## ICHING', '', '### Combination', 'Combination words.', '',
  '## KEYS', '', '### Gift', 'Gift words.', '',
  '## DESIGN', '', '### Gate', 'Gate words.', '',
  '## BODY', '', '### Physiology', 'Physiology words, all of them.', '', '### Amino acid', 'Amino acid words.', '',
  '## RELATIONS', '', '### Pair', 'Pair words.', '',
].join('\n');
const INTRO = 'The original entrance.';
const AT = '2026-11-11T10:00:00.000Z';

async function fixture() {
  const source = await manuscriptSource(2, 'test-revision', MARKDOWN);
  const nodes = cardSections(source, INTRO);
  const node = (id: string) => nodes.find(n => n.id === id)!;
  const code = node('2/CODE/reading'), physiology = node('2/BODY/physiology'), amino = node('2/BODY/amino-acid');

  // BODY: the whole Physiology section replaced by spoken words; Amino acid untouched.
  const bodyHuman = 'My own words about the chest.';
  const body: WorkingSection = {
    key: '2/BODY', cardNumber: 2, sectionId: 'BODY', revision: 1, sourceHash: source.hash, source, savedAt: AT,
    text: `${bodyHuman}\n\n${amino.text}`, humanWords: 6, totalWords: 9,
    blocks: [
      {id: 'take-1', text: bodyHuman, origin: 'human', replacedText: physiology.text, evidence: [{sessionId: 's1', transcriptId: 't1', captureId: 'c1', signature: bodyHuman}]},
      {id: 'published', text: amino.text, origin: 'ai', evidence: []},
    ],
  };
  // CODE: one paragraph replaced, the other left as written, so the section is partly his.
  const codeHuman = 'My first paragraph, spoken.';
  const codeKept = 'Second code paragraph.';
  const codeLens: WorkingSection = {
    key: '2/CODE', cardNumber: 2, sectionId: 'CODE', revision: 1, sourceHash: source.hash, source, savedAt: AT,
    text: `${codeHuman}\n\n${codeKept}`, humanWords: 4, totalWords: 7,
    blocks: [
      {id: 'take-2', text: codeHuman, origin: 'human', replacedText: 'First code paragraph.', evidence: [{sessionId: 's1', transcriptId: 't2', captureId: 'c1', signature: codeHuman}]},
      {id: 'published', text: codeKept, origin: 'ai', evidence: []},
    ],
  };
  // The entrance travels through a review receipt, and one heading has a title edit.
  const session = {
    id: 's1', cardNumber: 2, sourceHash: source.hash, createdAt: AT, updatedAt: AT, version: 3, source, sections: nodes, startSectionId: '2/INTRO',
    titleEdits: {'2/BODY/amino-acid': {text: 'Amino acid, said my way', updatedAt: AT}},
    markers: [], rawTranscript: 'A new entrance, in my words.', unassigned: [], state: 'review',
    results: [{sectionId: '2/INTRO', text: 'A new entrance, in my words.', evidenceQuotes: [], changes: [], warnings: [], checked: true, applied: true, editIntent: 'replace', appliedText: 'A new entrance, in my words.', beforeText: INTRO, appliedAt: AT}],
  } as unknown as SectionDraftSession;

  return {source, nodes, code, physiology, amino, working: [body, codeLens], sessions: [session]};
}

async function bundle(): Promise<VoiceBundle> {
  const f = await fixture();
  return buildVoiceBundle({source: f.source, introText: INTRO, working: f.working, sessions: f.sessions, exportedAt: AT});
}

describe('voice bundle export', () => {
  it('carries every changed section with its origin, and nothing unchanged', async () => {
    const f = await fixture();
    const b = await bundle();
    expect(b).toMatchObject({format: 'mandala-codes/oracle-voice-bundle', version: 1, cardNumber: 2, exportedAt: AT, manuscript: {path: 'oracle/cards/02.md', revision: 'test-revision', sha256: f.source.hash}});
    expect(b.sections.map(s => s.id)).toEqual(['2/INTRO', '2/CODE/reading', '2/BODY/physiology']);

    const physiology = b.sections.find(s => s.id === '2/BODY/physiology')!;
    expect(physiology).toMatchObject({kind: 'manuscript', lensId: 'BODY', path: ['Body', 'Physiology'], authorship: 'human', fullyHuman: true, appliedAt: AT});
    expect(physiology.original).toEqual({text: f.physiology.text, sha256: await sha256(f.physiology.text), length: f.physiology.text.length});
    expect(physiology.applied.text).toBe('My own words about the chest.');
    expect(physiology.blocks).toEqual([{origin: 'human', text: 'My own words about the chest.'}]);

    const code = b.sections.find(s => s.id === '2/CODE/reading')!;
    expect(code).toMatchObject({authorship: 'mixed', fullyHuman: false});
    expect(code.applied.text).toBe('My first paragraph, spoken.\n\nSecond code paragraph.');
    expect(code.blocks.map(block => block.origin)).toEqual(['human', 'unknown', 'ai']);
    expect(code.blocks.map(block => block.text).join('')).toBe(code.applied.text);

    const intro = b.sections.find(s => s.id === '2/INTRO')!;
    expect(intro).toMatchObject({kind: 'intro', lensId: 'INTRO', path: ['Intro'], authorship: 'human', fullyHuman: true, original: {text: INTRO}, applied: {text: 'A new entrance, in my words.'}});

    expect(b.titleEdits).toEqual([{sectionId: '2/BODY/amino-acid', path: ['Body', 'Amino acid'], original: 'Amino acid', edited: 'Amino acid, said my way'}]);
    expect(b.omitted).toEqual([]);
  });

  it('lists a lens made from an older manuscript as omitted instead of guessing', async () => {
    const f = await fixture();
    const older = await manuscriptSource(2, 'older', MARKDOWN.replace('Gate words.', 'Older gate words.'));
    const stale: WorkingSection = {key: '2/DESIGN', cardNumber: 2, sectionId: 'DESIGN', revision: 1, sourceHash: older.hash, source: older, savedAt: AT, text: 'Spoken gate words.', humanWords: 3, totalWords: 3, blocks: [{id: 'm', text: 'Spoken gate words.', origin: 'human', evidence: []}]};
    const b = await buildVoiceBundle({source: f.source, introText: INTRO, working: [...f.working, stale], sessions: f.sessions, exportedAt: AT});
    expect(b.sections.some(s => s.lensId === 'DESIGN')).toBe(false);
    expect(b.omitted).toEqual([expect.objectContaining({sectionId: '2/DESIGN/gate', path: ['Human Design']})]);
  });

  it('accepts its own output, also through JSON', async () => {
    const b = await bundle();
    await expect(validateVoiceBundle(structuredClone(b))).resolves.toEqual(b);
    await expect(parseVoiceBundle(serializeVoiceBundle(b))).resolves.toEqual(b);
  });

  const rejects = async (mutate: (b: any) => void, message: RegExp) => {
    const b: any = structuredClone(await bundle());
    mutate(b);
    const error = await validateVoiceBundle(b).catch(e => e);
    expect(error).toBeInstanceOf(VoiceBundleError);
    expect(error.message).toMatch(message);
  };

  it('rejects malformed bundles', async () => {
    await rejects(b => { b.format = 'something-else'; }, /format/);
    await rejects(b => { b.version = 2; }, /version/);
    await rejects(b => { b.extra = true; }, /unexpected field "extra"/);
    await rejects(b => { b.cardNumber = 65; }, /cardNumber/);
    await rejects(b => { b.manuscript.path = 'oracle/cards/03.md'; }, /manuscript.path/);
    await rejects(b => { b.sections[1].id = '3/CODE/reading'; }, /belongs to card 3/);
    await rejects(b => { b.sections[1].lensId = 'KEYS'; }, /lensId/);
    await rejects(b => { b.sections[2].applied.text = 'Tampered words.'; b.sections[2].applied.length = 15; b.sections[2].blocks = [{origin: 'human', text: 'Tampered words.'}]; }, /applied.sha256: does not match/);
    await rejects(b => { b.sections[2].applied.length += 1; }, /length/);
    await rejects(b => { b.sections[1].blocks.pop(); }, /do not add up/);
    await rejects(b => { b.sections[1].fullyHuman = true; }, /disagrees with authorship/);
    await rejects(b => { b.sections[2].applied = structuredClone(b.sections[2].original); b.sections[2].blocks = [{origin: 'human', text: b.sections[2].original.text}]; }, /same as the original/);
    await rejects(b => { b.sections.push(structuredClone(b.sections[0])); }, /appears twice/);
    await rejects(b => { b.sections[0].appliedAt = 'yesterday'; }, /appliedAt/);
    await rejects(b => { b.sections[0].path = []; }, /path/);
    await rejects(b => { b.sections[2].blocks[0].text = 'bad\u0000'; }, /control characters/);
    await expect(validateVoiceBundle(null)).rejects.toBeInstanceOf(VoiceBundleError);
    await expect(validateVoiceBundle([])).rejects.toBeInstanceOf(VoiceBundleError);
  });

  it('rejects oversized input and non-JSON before reading it', async () => {
    await expect(parseVoiceBundle('{not json')).rejects.toThrow(/not valid JSON/);
    await expect(parseVoiceBundle(' '.repeat(VOICE_BUNDLE_LIMITS.maxJsonChars + 1))).rejects.toThrow(/larger than/);
    const b: any = structuredClone(await bundle());
    const long = 'x'.repeat(VOICE_BUNDLE_LIMITS.maxTextChars + 1);
    b.sections[2].applied = {text: long, sha256: await sha256(long), length: long.length};
    b.sections[2].blocks = [{origin: 'human', text: long}];
    await expect(validateVoiceBundle(b)).rejects.toThrow(/longer than/);
  });
});
