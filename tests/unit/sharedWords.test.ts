import { describe, expect, it } from 'vitest';
import { applyKnownFixes, buildWordsPrompt, estimateTokens, wordSnapshot, type WordSnapshot } from '../../shared/words';
import { ORACLE_WORDS_PROFILE } from '../../shared/oracleWords';

const entry = (spelling: string, variants: WordSnapshot['entries'][number]['variants'] = [], extra = {}) => ({ spelling, category: 'person', status: 'confirmed', variants, ...extra });

describe('the committed shared word snapshot', () => {
  it('is a versioned AR Create export with words in it', () => {
    expect(wordSnapshot.schema).toBe('ar-create.word-library.export.v1');
    expect(wordSnapshot.version).toMatch(/^\d+\.[a-f0-9]{8}$/);
    expect(wordSnapshot.entries.length).toBeGreaterThan(100);
  });

  it('with no profile builds exactly the prompt AR Create exports, so the two never drift', () => {
    const exported = (wordSnapshot as unknown as { prompts: { en: string } }).prompts.en;
    expect(buildWordsPrompt(wordSnapshot).prompt).toBe(exported);
  });
});

describe('the oracle prompt', () => {
  const built = buildWordsPrompt(wordSnapshot, ORACLE_WORDS_PROFILE);

  it('leads with the oracle sentence and its own terms, inside the token budget', () => {
    expect(built.prompt.startsWith('A private reflection about the Mandala Codes oracle')).toBe(true);
    for (const term of ['Siddhi', 'I Ching', 'Gene Keys', 'Human Design']) expect(built.words).toContain(term);
    expect(estimateTokens(built.prompt)).toBeLessThanOrEqual(160);
    expect(built.tokens).toBe(estimateTokens(built.prompt));
  });

  it('spends no budget on the tea vocabulary', () => {
    expect(built.words).not.toContain('Da Hong Pao');
    expect(built.words.some(word => /puerh/i.test(word))).toBe(false);
  });

  it('is repeatable and ends as a sentence', () => {
    expect(buildWordsPrompt(wordSnapshot, ORACLE_WORDS_PROFILE).prompt).toBe(built.prompt);
    expect(built.prompt.endsWith('.')).toBe(true);
  });

  it('falls back to the plain sentence when the library has nothing', () => {
    const empty = buildWordsPrompt({ entries: [] }, ORACLE_WORDS_PROFILE);
    expect(empty.words).toEqual([]);
    expect(empty.prompt).toMatch(/Preserve these spellings and natural punctuation\.$/);
  });
});

describe('known mishearing fixes', () => {
  it('fixes a heard spelling, keeps the original string untouched and reports the change', () => {
    const raw = 'I was reading jean keys and my iching book today.';
    const fixed = applyKnownFixes(raw, wordSnapshot);
    expect(fixed.text).toBe('I was reading Gene Keys and my I Ching book today.');
    expect(fixed.fixes).toEqual(expect.arrayContaining([{ from: 'jean keys', to: 'Gene Keys', count: 1 }, { from: 'iching', to: 'I Ching', count: 1 }]));
    expect(raw).toBe('I was reading jean keys and my iching book today.');
  });

  it('leaves text with nothing to fix exactly as it was', () => {
    const text = 'Nothing to change here.';
    expect(applyKnownFixes(text, wordSnapshot)).toEqual({ text, fixes: [] });
  });

  it('never rewrites an alias, which is another valid name', () => {
    const snap: WordSnapshot = { entries: [entry('Baisao', [{ text: 'by sow', kind: 'alias' }, { text: 'bai sao', kind: 'heard' }])] };
    expect(applyKnownFixes('by sow and bai sao', snap).text).toBe('by sow and Baisao');
  });

  it('matches whole words only, ignoring case', () => {
    const snap: WordSnapshot = { entries: [entry('Lu Yu', [{ text: 'luyu', kind: 'heard' }])] };
    expect(applyKnownFixes('Luyu wrote it. Not xluyux.', snap).text).toBe('Lu Yu wrote it. Not xluyux.');
  });

  it('skips a mishearing two words claim, one that is another word\'s spelling, and very short ones', () => {
    const snap: WordSnapshot = { entries: [
      entry('Alpha', [{ text: 'shared sound', kind: 'heard' }, { text: 'ab', kind: 'heard' }]),
      entry('Beta', [{ text: 'shared sound', kind: 'heard' }, { text: 'gamma', kind: 'heard' }]),
      entry('Gamma'),
    ] };
    expect(applyKnownFixes('shared sound ab gamma', snap)).toEqual({ text: 'shared sound ab gamma', fixes: [] });
  });

  it('ignores entries that are not confirmed', () => {
    const snap: WordSnapshot = { entries: [{ ...entry('Lu Yu', [{ text: 'luyu', kind: 'heard' }]), status: 'proposed' }] };
    expect(applyKnownFixes('luyu', snap).text).toBe('luyu');
  });
});
