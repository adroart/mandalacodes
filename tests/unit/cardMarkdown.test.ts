import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  mapBody,
  mapCode,
  mapDesign,
  mapIching,
  mapKeys,
  parseCardMarkdown,
} from '../../lib/oracle/card-markdown';
import { parseLegacyStatusMap } from '../../lib/oracle/manuscript-schema';

describe('Oracle card Markdown parser', () => {
  it('rejects unknown, missing, and invalid lens statuses', () => {
    expect(() => parseLegacyStatusMap({
      code: 'scaffold', iching: 'scaffold', keys: 'scaffold',
      design: 'scaffold', body: 'scaffold', relations: 'done',
    }, 'oracle/cards/23.md')).toThrow(/relations.*done.*scaffold.*in-progress.*final/i);

    expect(() => parseLegacyStatusMap({
      code: 'scaffold', iching: 'scaffold', keys: 'scaffold',
      design: 'scaffold', body: 'scaffold',
    }, 'oracle/cards/23.md')).toThrow(/relations.*missing/i);
  });

  it('maps every authored lens from Card 3', async () => {
    const path = resolve('oracle/cards/03.md');
    const raw = await readFile(path, 'utf8');
    const card = parseCardMarkdown(raw, path);

    expect(card.frontmatter.number).toBe(3);
    expect(card.frontmatter.card_name).toBe('Messengers of the Infinite');

    // Prose fixtures below are deliberately mid-paragraph phrases, not opening
    // sentences: editorial passes rewrite how a paragraph opens, so an opening-line
    // assertion breaks on every rewrite. Each phrase still appears in exactly one
    // field of oracle/cards/03.md, so a mis-mapped section still fails this test.
    const code = mapCode(card);
    expect(code?.keywords).toContain('New Beginnings');
    expect(code?.reading).toContain('pressing up the way a sprout forces the crust of the ground');

    const iching = mapIching(card);
    expect(iching?.hexagram_name).toBe('Difficulty at the Beginning');
    expect(iching?.reading).toContain('child in the long labour of being born');
    expect(iching?.lines).toHaveLength(6);
    expect(iching?.lines[0]?.becomes).toEqual({
      hexagram: 8,
      name: 'Holding Together',
    });

    const keys = mapKeys(card);
    expect(keys?.shadow_name).toBe('Chaos');
    expect(keys?.gift).toContain('an acorn keeps working toward a shape of tree it has never seen');

    const design = mapDesign(card);
    expect(design?.gate_number).toBe(3);
    expect(design?.gate).toContain('holding the insight until the world can receive it');

    const body = mapBody(card);
    expect(body?.meta).toEqual({
      organ: 'Navel',
      amino_acid_name: 'Leucine',
      codon_ring: 'Ring of Life and Death',
    });
    expect(body?.physiology).toContain('pulls the breath up out of the abdomen');
  });

  it('parses inline maps and nested arrays from frontmatter', () => {
    const card = parseCardMarkdown(`---
number: 9
relations_data:
  siblings: [1, 2, 3]
  tarot: { trigram: Water, cards: ["II · The High Priestess", "XII · The Hanged Man"] }
iching_lines:
  - { line: 1, becomes: { hexagram: 8, name: "Holding Together" } }
---

## CODE

_Keywords:_ Begin · Continue

Keep going.
`);

    expect(card.frontmatter.relations_data).toEqual({
      siblings: [1, 2, 3],
      tarot: {
        trigram: 'Water',
        cards: ['II · The High Priestess', 'XII · The Hanged Man'],
      },
    });
    expect(card.frontmatter.iching_lines).toEqual([
      { line: 1, becomes: { hexagram: 8, name: 'Holding Together' } },
    ]);
  });

  it('ignores inline YAML comments without stripping hashes inside quotes', () => {
    const card = parseCardMarkdown(`---
number: 45
relations_data:
  immortals: { upper: Zhong Li Quan, lower: Lan Cai He } # source note
  sky: Saturn # derived note
  quoted: "value # kept"
---

## RELATIONS

_A relation._
`);

    expect(card.frontmatter.relations_data).toEqual({
      immortals: { upper: 'Zhong Li Quan', lower: 'Lan Cai He' },
      sky: 'Saturn',
      quoted: 'value # kept',
    });
  });

  it('normalizes CRLF input before parsing', () => {
    const raw = [
      '---',
      'number: 12',
      '---',
      '',
      '## CODE',
      '',
      '_Keywords:_ Stillness · Exchange',
      '',
      'First line.',
      'Second line.',
    ].join('\r\n');

    const card = parseCardMarkdown(raw, 'crlf fixture');

    expect(card.frontmatter.number).toBe(12);
    expect(mapCode(card)).toMatchObject({
      keywords: ['Stillness', 'Exchange'],
      reading: 'First line. Second line.',
    });
  });

  it('removes whole multiline HTML comments before parsing sections', () => {
    const card = parseCardMarkdown(`---
number: 21
---

<!--
## KEYS
### Shadow — Leaked
This sourcing note must not become card prose.
-->

## CODE

_Keywords:_ Visible

Before <!-- hidden sourcing detail --> after.
`);

    expect(card.sections.KEYS).toBeUndefined();
    expect(mapCode(card)?.reading).toBe('Before  after.');
    expect(JSON.stringify(card)).not.toContain('sourcing note');
  });

  it('rejects input without frontmatter and identifies its context', () => {
    expect(() => parseCardMarkdown('## CODE\n\nNo frontmatter.', 'oracle/cards/99.md'))
      .toThrow('oracle/cards/99.md: missing YAML frontmatter');
  });

  it('rejects duplicate top-level lenses instead of silently overwriting one', () => {
    expect(() => parseCardMarkdown(`---
number: 50
---

## ICHING

First version.

## ICHING

Second version.
`, 'duplicate-lens.md')).toThrow(/duplicate-lens\.md: duplicate top-level section ICHING/i);
  });
});
