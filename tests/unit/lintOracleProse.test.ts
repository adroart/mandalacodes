/**
 * Unit tests for scripts/lint-oracle-prose.ts — the prose lint that fails
 * `npm run build` on italics, a sentence-internal em dash, or an editorial
 * flag left in `oracle/cards/*.md` / `oracle/readings/*.md`, and warns
 * (never fails) on banned vocabulary and repeated opening stems.
 *
 * One fixture per rule, including a true and a false positive for the
 * em-dash rule (the structural-delimiter exemptions are the part most
 * likely to regress silently).
 */
import { describe, expect, it } from 'vitest';
import {
  BANNED_VOCAB,
  checkEditorialFlags,
  checkEmDash,
  checkItalics,
  checkVocab,
  isHeadingLine,
  lintContent,
} from '../../scripts/lint-oracle-prose.ts';

function card(body: string): string {
  return `---\nnumber: 1\ncard_name: Test\n---\n\n${body}\n`;
}

describe('checkItalics', () => {
  it('flags a single-asterisk span in prose', () => {
    expect(checkItalics("Cut from wood, *Earth's Breath* holds the fire.")).toHaveLength(1);
  });

  it('flags a single-underscore span in prose', () => {
    expect(checkItalics('The willingness to move _without being certain_, and to risk it.')).toHaveLength(1);
  });

  it('does not flag bold', () => {
    expect(checkItalics('This code is **the drive** toward completion.')).toHaveLength(0);
  });

  it('exempts the structural field-label markers `_Keywords:_` and `_image:_`', () => {
    expect(checkItalics('_Keywords:_ Freshness · Inner Fire · Pure Beginning')).toHaveLength(0);
    expect(checkItalics('**Line 1** · _image:_ the dragon still hidden under the water.')).toHaveLength(0);
  });

  it('does not misread a snake_case identifier as emphasis', () => {
    expect(checkItalics(
      "- **Hebrew letter — Beth, the House:** the dwelling. (FLAG: sky and letter derived from metaphysical_correspondence and golden_dawn_attribution; needs an Adrian pass.)",
    )).toHaveLength(0);
  });

  it('does not misread a backtick-quoted filename as emphasis', () => {
    expect(checkItalics(
      'Names follow the vault index `_hexagram-64.md` and `_per_card_reference.json`, which both wrongly listed the pair.',
    )).toHaveLength(0);
  });

  it('still finds the true outer span when a real emphasis wrap contains an unbackticked identifier', () => {
    const line = "the wind that begins. _(carried from _per_card_reference; the Emperor's tarot file is an empty stub.)_";
    const hits = checkItalics(line);
    expect(hits).toHaveLength(1);
    // The identifier inside is masked before matching (see maskSnakeCaseIdentifiers),
    // so assert the span's start/end rather than its exact interior text.
    expect(hits[0].index).toBe(line.indexOf('_(carried'));
    expect(hits[0].text.startsWith('_(carried from')).toBe(true);
    expect(hits[0].text.endsWith("empty stub.)_")).toBe(true);
    expect(hits[0].text).toHaveLength(
      line.length - line.indexOf('_(carried'),
    );
  });
});

describe('checkEmDash — true and false positives', () => {
  it('TRUE POSITIVE: flags an em dash inside a sentence', () => {
    const hits = checkEmDash('Not a plan, not a direction — just the first move, made for the joy of it.');
    expect(hits).toHaveLength(1);
  });

  it('TRUE POSITIVE: flags an em dash after a bullet label that sits outside the bold span', () => {
    // The bold label carries no dash; the dash introduces the value from
    // outside the label, so it is not the allowed `- **Label — Value**` shape.
    const hits = checkEmDash('- **Lake (lower)** — no keyed Major Arcana in the vault for this trigram.');
    expect(hits).toHaveLength(1);
  });

  it('FALSE POSITIVE (must not flag): a heading em dash is a structural delimiter', () => {
    expect(isHeadingLine('### The drive — Gate 24')).toBe(true);
    expect(checkEmDash('### The drive — Gate 24')).toHaveLength(0);
  });

  it('FALSE POSITIVE (must not flag): an em dash inside a `- **Label — Value**` bullet', () => {
    expect(checkEmDash('- **Sky — Mercury:** the quick intelligence that runs between worlds.')).toHaveLength(0);
  });

  it('still flags a second, genuinely sentence-internal dash on an otherwise-exempt bullet line', () => {
    const hits = checkEmDash('- **Sky — Mercury:** the quick intelligence — the one that runs between worlds.');
    expect(hits).toHaveLength(1);
  });
});

describe('checkEditorialFlags', () => {
  it.each(['[FLAG: needs verification]', 'TODO: confirm the source', '_[FLAG: wrapped]_', '[[wiki-link]]'])(
    'flags %s left in shipped text',
    (text) => {
      expect(checkEditorialFlags(text).length).toBeGreaterThan(0);
    },
  );

  it('does not flag ordinary prose', () => {
    expect(checkEditorialFlags('The turn comes not from fighting it but from meeting it.')).toHaveLength(0);
  });
});

describe('checkVocab (warning only)', () => {
  it('finds a banned term case-insensitively and reports its position', () => {
    const hits = checkVocab('This is the sacred alignment the code asks you to embrace.');
    const terms = hits.map(h => h.term).sort();
    expect(terms).toEqual(['alignment', 'embrace', 'sacred'].sort());
  });

  it('matches the multi-word terms "step into" and "you are being"', () => {
    expect(checkVocab('You are being asked to step into the work.').map(h => h.term).sort()).toEqual(
      ['step into', 'you are being'].sort(),
    );
  });

  it('BANNED_VOCAB carries the terms the 2026-09-08 survey named', () => {
    for (const term of ['alignment', 'vibration', 'sacred', 'invited']) {
      expect(BANNED_VOCAB).toContain(term);
    }
  });
});

describe('lintContent — end to end on small fixtures', () => {
  it('is clean on a card with none of the three violations', () => {
    const raw = card([
      '## CODE',
      '',
      '_Keywords:_ Freshness · Inner Fire',
      '',
      'This code is the pressure to begin. It moves without asking permission.',
      '',
      '## RELATIONS',
      '',
      '_Met by UL 2, this is the world coming into form._',
      '',
      '### Pair — UL 2, Beyond the Shell',
      'These two are the deck\'s first pair, and they teach the same thing from opposite ends.',
    ].join('\n'));

    const result = lintContent(raw, 'oracle/cards/01.md');
    expect(result.errors).toHaveLength(0);
  });

  it('exempts the RELATIONS unity-line and named-field outer-emphasis wrap, matching lib/oracle/card-markdown.ts withoutOuterEmphasis', () => {
    const raw = card([
      '## RELATIONS',
      '',
      '_Met by UL 2, this is the world coming into form, the creative force and the field that receives it._',
      '',
      '### Pair — UL 2, Beyond the Shell',
      '_These two are the deck\'s first pair, and they teach the same thing from opposite ends._',
    ].join('\n'));

    expect(lintContent(raw, 'oracle/cards/01.md').errors).toHaveLength(0);
  });

  it('does NOT exempt a fully-italicised bullet — RELATIONS only unwraps the six named field paragraphs, never a bare list item', () => {
    const raw = card([
      '## RELATIONS',
      '',
      '_Met by UL 2, this is the world coming into form._',
      '',
      '### Tarot',
      'One Arcana answers here, the Magician.',
      '',
      '- *(Fire, the lower trigram, carries no keyed Major Arcana in the vault source.)*',
    ].join('\n'));

    const errors = lintContent(raw, 'oracle/cards/01.md').errors;
    expect(errors).toHaveLength(1);
    expect(errors[0].rule).toBe('italics');
  });

  it('catches emphasis that soft-wraps across two physical lines, like oracle/readings/UL-122.md', () => {
    const raw = card([
      'The willingness to make the first move *without being',
      'certain*, to take the untrodden step, to risk the mistake.',
    ].join('\n'));

    const errors = lintContent(raw, 'oracle/readings/UL-122.md').errors;
    expect(errors).toHaveLength(1);
    expect(errors[0].rule).toBe('italics');
    expect(errors[0].line).toBe(6); // first physical line of the joined paragraph
  });

  it('never scans YAML frontmatter or an HTML comment block for any error rule', () => {
    const raw = [
      '---',
      'card_name: "Has an — em dash and *italics* right in the frontmatter"',
      '---',
      '',
      '<!--',
      'meta:',
      '  note: "also has an — em dash and [FLAG: not shipped] in a comment"',
      '-->',
      '',
      'This is the only real prose sentence, and it is clean.',
    ].join('\n');

    expect(lintContent(raw, 'oracle/cards/02.md').errors).toHaveLength(0);
  });

  it('blanks an unclosed HTML comment to end of file rather than letting it leak into later prose (the card 64 fault)', () => {
    const raw = [
      '---',
      'card_name: Test',
      '---',
      '',
      '## RELATIONS',
      '',
      'Ordinary prose here.',
      '',
      '<!-- FLAG: this comment is deliberately never closed in the fixture',
      'Even though this line would otherwise contain a [FLAG left unclosed,',
      'it must not surface as an editorial-flag error once inside the comment.',
    ].join('\n');

    expect(lintContent(raw, 'oracle/cards/64.md').errors).toHaveLength(0);
  });
});
