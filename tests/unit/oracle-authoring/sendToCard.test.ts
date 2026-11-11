import {describe, expect, it} from 'vitest';
import {cardSections} from '../../../lib/oracle/authoring/cardSections';
import {manuscriptSource} from '../../../lib/oracle/authoring/source';
import type {WorkingSection} from '../../../lib/oracle/authoring/humanDrafts';
import type {SectionDraftSession} from '../../../lib/oracle/authoring/sectionDrafts';
import {buildVoiceBundle, parseVoiceBundle, type VoiceBundle} from '../../../lib/oracle/authoring/voiceExport';
import {
  newSinceSent, outcomeMessage, readSent, sendSectionsToCard, sendStatus, sentKey, sentRecordFor, voiceFileName,
} from '../../../components/oracle/authoring/studio/useSendToCard';

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

async function bundleWith({body = 'My own words about the chest.', code = true} = {}): Promise<VoiceBundle> {
  const source = await manuscriptSource(2, 'test-revision', MARKDOWN);
  const nodes = cardSections(source, INTRO);
  const node = (id: string) => nodes.find(n => n.id === id)!;
  const physiology = node('2/BODY/physiology'), amino = node('2/BODY/amino-acid');
  const working: WorkingSection[] = [{
    key: '2/BODY', cardNumber: 2, sectionId: 'BODY', revision: 1, sourceHash: source.hash, source, savedAt: AT,
    text: `${body}\n\n${amino.text}`, humanWords: 6, totalWords: 9,
    blocks: [
      {id: 'take-1', text: body, origin: 'human', replacedText: physiology.text, evidence: [{sessionId: 's1', transcriptId: 't1', captureId: 'c1', signature: body}]},
      {id: 'published', text: amino.text, origin: 'ai', evidence: []},
    ],
  }];
  if (code) working.push({
    key: '2/CODE', cardNumber: 2, sectionId: 'CODE', revision: 1, sourceHash: source.hash, source, savedAt: AT,
    text: 'My first paragraph, spoken.\n\nSecond code paragraph.', humanWords: 4, totalWords: 7,
    blocks: [
      {id: 'take-2', text: 'My first paragraph, spoken.', origin: 'human', replacedText: 'First code paragraph.', evidence: [{sessionId: 's1', transcriptId: 't2', captureId: 'c1', signature: 'My first paragraph, spoken.'}]},
      {id: 'published', text: 'Second code paragraph.', origin: 'ai', evidence: []},
    ],
  });
  return buildVoiceBundle({source, introText: INTRO, working, sessions: [] as SectionDraftSession[], exportedAt: AT});
}

async function emptyBundle() {
  const source = await manuscriptSource(2, 'test-revision', MARKDOWN);
  return buildVoiceBundle({source, introText: INTRO, working: [], sessions: [], exportedAt: AT});
}

function memory() {
  const map = new Map<string, string>();
  return {map, getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v)};
}

describe('send finished sections to the card', () => {
  it('says plainly when there is nothing to send', async () => {
    expect(sendStatus(await emptyBundle(), null)).toBe('Nothing to send yet. Apply a section first.');
    expect(sendStatus(null, null)).toBe('Checking your sections.');
  });

  it('counts the sections ready to send', async () => {
    const one = await bundleWith({code: false});
    expect(one.sections).toHaveLength(1);
    expect(sendStatus(one, null)).toBe('1 section with your words is ready.');
    const both = await bundleWith();
    expect(sendStatus(both, null)).toBe('2 sections with your words are ready.');
  });

  it('after sending everything, says nothing is new', async () => {
    const bundle = await bundleWith();
    expect(sendStatus(bundle, sentRecordFor(bundle, AT))).toBe('Sent 2 sections on 11 Nov. Nothing new since then.');
  });

  it('counts what is new since the last send', async () => {
    const sent = sentRecordFor(await bundleWith({code: false}), AT);
    const now = await bundleWith();
    expect([...newSinceSent(now, sent)]).toEqual(['2/CODE/reading']);
    expect(sendStatus(now, sent)).toBe('Sent 1 section on 11 Nov. 1 more since then.');
  });

  it('counts a section applied again after sending as new', async () => {
    const sent = sentRecordFor(await bundleWith(), AT);
    const again = await bundleWith({body: 'Different words about the chest, said again.'});
    expect([...newSinceSent(again, sent)]).toEqual(['2/BODY/physiology']);
    expect(sendStatus(again, sent)).toBe('Sent 2 sections on 11 Nov. 1 more since then.');
  });

  it('names the file by card and local date', () => {
    expect(voiceFileName(2, new Date(2026, 10, 11, 9))).toBe('oracle-voice-card-02-2026-11-11.json');
    expect(voiceFileName(41, new Date(2026, 0, 5))).toBe('oracle-voice-card-41-2026-01-05.json');
  });

  it('hands over a valid file and remembers what was sent', async () => {
    const storage = memory();
    const bundle = await bundleWith();
    let handed: {name: string; text: string} | undefined;
    const outcome = await sendSectionsToCard(2, {build: async () => bundle, handOff: async (name, text) => { handed = {name, text}; return 'shared'; }, storage, now: () => new Date(AT)});
    expect(outcome.kind).toBe('sent');
    expect(handed!.name).toMatch(/^oracle-voice-card-02-\d{4}-\d{2}-\d{2}\.json$/);
    const parsed = await parseVoiceBundle(handed!.text);
    expect(parsed.sections.map(s => s.id)).toEqual(bundle.sections.map(s => s.id));
    const record = readSent(2, storage)!;
    expect(record.at).toBe(AT);
    expect(record.sections).toEqual(bundle.sections.map(s => ({id: s.id, sha256: s.applied.sha256})));
    expect(outcomeMessage(outcome).text).toBe('Sent 2 sections. Open the file on your Mac to put them into the card.');
  });

  it('a cancelled share sheet records nothing', async () => {
    const storage = memory();
    const outcome = await sendSectionsToCard(2, {build: bundleWith, handOff: async () => 'cancelled', storage});
    expect(outcome.kind).toBe('cancelled');
    expect(storage.map.has(sentKey(2))).toBe(false);
    expect(outcomeMessage(outcome).text).toBe('Nothing was sent.');
  });

  it('a share sheet that only says it opened records nothing', async () => {
    const storage = memory();
    expect((await sendSectionsToCard(2, {build: bundleWith, handOff: async () => 'opened', storage})).kind).toBe('unconfirmed');
    expect(storage.map.size).toBe(0);
  });

  it('a failed hand-off records nothing and passes its plain reason on', async () => {
    const storage = memory();
    const outcome = await sendSectionsToCard(2, {build: bundleWith, handOff: async () => { throw new Error('The share sheet did not open. Nothing was sent.'); }, storage});
    expect(outcomeMessage(outcome)).toEqual({alert: true, text: 'The share sheet did not open. Nothing was sent.'});
    expect(storage.map.size).toBe(0);
  });

  it('sends nothing when the sections fail the check', async () => {
    const storage = memory();
    const bundle = await bundleWith();
    const broken = {...bundle, sections: [{...bundle.sections[0], applied: {...bundle.sections[0].applied, sha256: '0'.repeat(64)}}]};
    let called = false;
    const outcome = await sendSectionsToCard(2, {build: async () => broken, handOff: async () => { called = true; return 'shared'; }, storage});
    expect(outcome.kind).toBe('invalid');
    expect(called).toBe(false);
    expect(storage.map.size).toBe(0);
    expect(outcomeMessage(outcome).text).toBe('These sections could not be gathered safely, so nothing was sent.');
  });
});
