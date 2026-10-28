import { describe, expect, it } from 'vitest';
import { interpretPassageSpeech, matchPassages, passagesFromText, replaceAnchoredText, splitSpokenThoughts } from '../../../lib/oracle/authoring/passageContext';

describe('reading passage references', () => {
  it('retains exact offsets across CRLF, blank lines and repeated paragraphs', () => {
    const text = '  A quiet field.\r\n\r\nThe voice returns.\r\n \r\nA quiet field.  ';
    const anchors = passagesFromText(2, 'CODE', text, 7, 'hash');
    expect(anchors.map(a => a.text)).toEqual(['A quiet field.', 'The voice returns.', 'A quiet field.']);
    expect(new Set(anchors.map(a => a.id)).size).toBe(3);
    for (const anchor of anchors) {
      expect(text.slice(anchor.start, anchor.end)).toBe(anchor.text);
      expect(anchor).toMatchObject({ revision: 7, sourceHash: 'hash', cardNumber: 2, sectionId: 'CODE' });
    }
    expect(replaceAnchoredText(text, anchors[2], 'My exact new words.')).toBe('  A quiet field.\r\n\r\nThe voice returns.\r\n \r\nMy exact new words.  ');
  });
  it('accepts an unchanged unique target after surrounding edits, but rejects changed or ambiguous targets', () => {
    const text = 'First paragraph.\n\nThe quiet field receives.\n\nLast paragraph.';
    const anchor = passagesFromText(2, 'CODE', text)[1];
    expect(replaceAnchoredText('New opening.\n\nThe quiet field receives.\n\nLast paragraph.', anchor, 'A human revision.')).toBe('New opening.\n\nA human revision.\n\nLast paragraph.');
    expect(() => replaceAnchoredText(text.replace('quiet', 'open'), anchor, 'New words.')).toThrow(/changed/);
    expect(() => replaceAnchoredText(text + '\n\n' + anchor.text, anchor, 'New words.')).toThrow(/more than once/);
    expect(() => replaceAnchoredText(text, { ...anchor, start: 0 }, 'New words.')).toThrow(/invalid/);
    expect(() => replaceAnchoredText(text, anchor, '  ')).toThrow(/Add your words/);
  });
});

describe('conservative spoken instructions', () => {
  it('separates only explicit bounded instructions from literal replacement and addition', () => {
    expect(interpretPassageSpeech('Replace this paragraph with this: I keep my own, unusual phrasing.')).toEqual({ kind: 'replace', reference: 'this paragraph', words: 'I keep my own, unusual phrasing.' });
    expect(interpretPassageSpeech('Add these words after the opening: A second thought.')).toEqual({ kind: 'append', reference: 'the opening', words: 'A second thought.' });
    expect(interpretPassageSpeech("Here's what I mean by the quiet field: It receives the whole movement.")).toEqual({ kind: 'explain', reference: 'the quiet field', words: 'It receives the whole movement.' });
    expect(interpretPassageSpeech('These two passages belong together.')).toEqual({ kind: 'connect', reference: 'These two passages belong together.', words: '' });
  });
  it('understands spoken replacement commands without requiring punctuation', () => {
    expect(interpretPassageSpeech('replace that sentence with This is my wording')).toEqual({ kind: 'replace', reference: 'that sentence', words: 'This is my wording' });
    expect(interpretPassageSpeech('where you said “quiet field”, replace it with this is my actual voice')).toEqual({ kind: 'replace', reference: 'quiet field', words: 'this is my actual voice' });
    expect(interpretPassageSpeech('Replace that last sentence')).toEqual({ kind: 'replace', reference: 'that last sentence', words: '' });
    expect(interpretPassageSpeech('Well, you said “quiet field”')).toEqual({ kind: 'explain', reference: 'quiet field', words: '' });
    expect(interpretPassageSpeech('where you said the quiet field')).toEqual({ kind: 'explain', reference: 'the quiet field', words: '' });
    expect(interpretPassageSpeech('where you said the quiet field, replace it with My exact words.')).toEqual({ kind: 'replace', reference: 'the quiet field', words: 'My exact words.' });
    expect(interpretPassageSpeech('that last sentence')).toEqual({ kind: 'explain', reference: 'that last sentence', words: '' });
  });
  it('does not discard corrections or invent meaning for unsupported editing instructions', () => {
    for (const text of ['Actually, let me say that differently.', 'Keep the opening and change the rest.', 'Add this before the paragraph: My words.', 'The word replace is part of this sentence.']) expect(interpretPassageSpeech(text)).toEqual({ kind: 'explain', reference: '', words: text });
  });
});

describe('passage suggestions', () => {
  const anchors = [
    ...passagesFromText(2, 'CODE', 'The quiet field receives the whole movement.\n\nA clear voice crosses the threshold.'),
    ...passagesFromText(23, 'DESIGN', 'The quiet field receives the whole movement.\n\nThe body follows a different rhythm.'),
  ];
  it('finds read-aloud text across cards, keeping duplicate matches for human selection', () => {
    const result = matchPassages('Where you said the quiet field receives the whole movement', anchors);
    expect(result.map(r => r.anchor.cardNumber)).toEqual([2, 23]);
    expect(result[0].score).toBe(result[1].score);
  });
  it('finds combinations of quoted passages and respects explicit selected context', () => {
    const result = matchPassages('Combine “quiet field” with “clear voice”', anchors);
    expect(result).toHaveLength(3);
    const focused = [anchors[0].id, anchors[1].id];
    expect(matchPassages('both of these', anchors, focused).map(r => r.anchor.id)).toEqual(focused);
    expect(matchPassages('this passage', anchors)).toEqual([]);
  });
  it('uses focus for relative references and returns an exact final-sentence anchor', () => {
    const text = 'The first paragraph.\n\nThe current opening. The final sentence.\n\nThe next paragraph.';
    const local = passagesFromText(2, 'CODE', text);
    expect(matchPassages('paragraph above', local, [local[1].id])[0]?.anchor.id).toBe(local[0].id);
    expect(matchPassages('paragraph below', local, [local[1].id])[0]?.anchor.id).toBe(local[2].id);
    const last = matchPassages('that last sentence', local, [local[1].id])[0].anchor;
    expect(last.text).toBe('The final sentence.');
    expect(replaceAnchoredText(text, last, 'My new sentence.')).toBe(text.replace('The final sentence.', 'My new sentence.'));
    expect(matchPassages('paragraph above', local)).toEqual([]);
    expect(matchPassages('that last sentence', local)).toEqual([]);
  });
  it('uses distinctive overlap as a suggestion and avoids generic or empty false matches', () => {
    expect(matchPassages('the voice crossing a threshold', anchors)[0]?.anchor.text).toContain('clear voice');
    expect(matchPassages('the paragraph you said', anchors)).toEqual([]);
    expect(matchPassages('', anchors)).toEqual([]);
    expect(matchPassages('unrelated boats and weather', anchors)).toEqual([]);
  });
});

it('splits explicit transitions while preserving every spoken word and correction', () => {
  const text = "The field receives. Here's another concept. A voice responds. Now about hexagram 23. Actually, keep that sentence.";
  const pieces = splitSpokenThoughts(text);
  expect(pieces).toEqual(['The field receives.', "Here's another concept. A voice responds.", 'Now about hexagram 23.', 'Actually, keep that sentence.']);
  expect(pieces.join(' ')).toBe(text);
  expect(splitSpokenThoughts('I actually prefer this wording within a sentence.')).toEqual(['I actually prefer this wording within a sentence.']);
});
