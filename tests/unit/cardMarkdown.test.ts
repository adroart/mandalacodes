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

describe('Oracle card Markdown parser', () => {
  it('maps every authored lens from Card 3', async () => {
    const path = resolve('oracle/cards/03.md');
    const raw = await readFile(path, 'utf8');
    const card = parseCardMarkdown(raw, path);

    expect(card.frontmatter.number).toBe(3);
    expect(card.frontmatter.card_name).toBe('Messengers of the Infinite');

    const code = mapCode(card);
    expect(code?.keywords).toContain('New Beginnings');
    expect(code?.reading).toContain('Something has begun in you');

    const iching = mapIching(card);
    expect(iching?.hexagram_name).toBe('Difficulty at the Beginning');
    expect(iching?.reading).toContain('moment just after a thing has begun');
    expect(iching?.lines).toHaveLength(6);
    expect(iching?.lines[0]?.becomes).toEqual({
      hexagram: 8,
      name: 'Holding Together',
    });

    const keys = mapKeys(card);
    expect(keys?.shadow_name).toBe('Chaos');
    expect(keys?.gift).toContain('Stop outrunning the unsettled feeling');

    const design = mapDesign(card);
    expect(design?.gate_number).toBe(3);
    expect(design?.gate).toContain('giving form to something that has only just arrived');

    const body = mapBody(card);
    expect(body?.meta).toEqual({
      organ: 'Navel',
      amino_acid_name: 'Leucine',
      codon_ring: 'Ring of Life and Death',
    });
    expect(body?.physiology).toContain('soft middle where the news of impermanence is felt');
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
