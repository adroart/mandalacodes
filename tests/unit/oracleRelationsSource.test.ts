import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { mapRelations, parseCardMarkdown } from '../../lib/oracle/card-markdown';
import type { OracleRelations } from '../../lib/oracle/types';

async function loadRelations(number: number): Promise<OracleRelations> {
  const filename = `${String(number).padStart(2, '0')}.md`;
  const context = `oracle/cards/${filename}`;
  const raw = await readFile(resolve(context), 'utf8');
  const relations = mapRelations(parseCardMarkdown(raw, context));

  expect(relations).toBeDefined();
  return relations as OracleRelations;
}

describe('Markdown-native Oracle Relations', () => {
  it('maps a normal pair and a self-inverse heading for Card 1', async () => {
    const relations = await loadRelations(1);

    expect(relations.number).toBe(1);
    expect(relations.card_name).toBe("Earth's Breath");
    expect(relations.unity_line).toBe(
      "What starts in you goes somewhere, and these are the ways it goes.",
    );
    expect(relations.pair).toMatchObject({
      number: 2,
      card_name: 'Beyond the Shell',
      hexagram_name: 'The Receptive',
    });
    expect(relations.pair.teaching).toContain("Beyond the Shell is where it goes next");
    expect(relations.inverse.number).toBe(1);
    expect(relations.inverse.is_self_inverse).toBe(true);
    expect(relations.inverse.teaching).toContain("There is no other side.");
  });

  it('reuses a referenced UL heading for Card 3 pair and inverse', async () => {
    const relations = await loadRelations(3);

    expect(relations.pair).toMatchObject({
      number: 4,
      card_name: 'Veils of Knowledge',
      hexagram_name: 'Youthful Folly',
    });
    expect(relations.inverse).toMatchObject({
      number: 4,
      is_self_inverse: false,
    });
    expect(relations.inverse.teaching).toBe(relations.pair.teaching);
    expect(relations.codon_ring.name).toBe('Ring of Life and Death');
    expect(relations.codon_ring.siblings).toEqual([20, 23, 24, 27, 42]);
  });

  it('maps Card 28 combined self-inverse and UL-reference headings by structure', async () => {
    const relations = await loadRelations(28);

    expect(relations.pair.number).toBe(27);
    expect(relations.pair.card_name).toBe('The Nourishing');
    expect(relations.pair.teaching).toContain('open jaws that take in and feed');
    expect(relations.inverse).toMatchObject({
      number: 28,
      is_self_inverse: true,
    });
    expect(relations.inverse.teaching).toContain('one of only eight codes');
  });

  it('keeps Card 29 Markdown frontmatter authoritative over legacy pair data', async () => {
    const relations = await loadRelations(29);

    expect(relations.pair.number).toBe(29);
    expect(relations.pair.card_name).toBe('The Abysmal Water');
    expect(relations.pair.hexagram_name).toBeUndefined();
    expect(relations.pair.teaching).toContain('Water over water reads the same from either end');
    expect(relations.inverse).toMatchObject({
      number: 29,
      is_self_inverse: true,
    });
    expect(relations.programming_partner).toMatchObject({
      number: 30,
      card_name: 'Sparking the Blaze',
    });
  });

  it('extracts Tarot, Immortals, Sky, and Hebrew prose without sourcing comments', async () => {
    const relations = await loadRelations(64);
    const serialized = JSON.stringify(relations);

    expect(relations.tarot).toMatchObject({ card: 'I · The Magician' });
    // The Tarot teaching is the line above the bullets, so it names how many Arcana
    // reach the card and by which route. The bullet prose moved out of this field when
    // the deck went to intro-plus-bullets; card 64 was the last card still in the old shape.
    expect(relations.tarot?.teaching).toContain("Four of the tarot's major cards");
    expect(relations.tarot?.teaching).toContain('through the ring and the two trigrams');
    expect(relations.immortals).toMatchObject({
      upper: { trigram: 'Fire', name: 'Lu Dong Bin' },
      lower: { trigram: 'Water', name: 'Li Tie Guai' },
      same_trigram: false,
    });
    // Mid-paragraph on purpose: names the immortal's own attribute rather than the
    // teaching's opening line, which editorial passes rewrite.
    expect(relations.immortals?.teaching).toContain('his medicine in a gourd');
    expect(relations.sky).toMatchObject({ value: 'Mercury' });
    expect(relations.sky?.teaching).toContain('quick messenger');
    expect(relations.hebrew_letter).toMatchObject({ letter: 'Beth' });
    expect(relations.hebrew_letter?.teaching).toContain('the room that gives a work four walls');
    expect(serialized).not.toMatch(/SOURCING LOG|sourcing_log|meta:fact_check|<!--|-->/i);
  });

  it('maps complete structural Relations and inverse prose for all 64 manuscripts', async () => {
    for (let number = 1; number <= 64; number += 1) {
      const relations = await loadRelations(number);
      const context = `Card ${number}`;

      expect(relations.number, context).toBe(number);
      expect(relations.pair.number, context).toBeGreaterThanOrEqual(1);
      expect(relations.inverse.number, context).toBeGreaterThanOrEqual(1);
      expect(relations.inverse.teaching, context).not.toBe('');
      expect(relations.programming_partner.number, context).toBeGreaterThanOrEqual(1);
      expect(relations.codon_ring.name, context).not.toBe('');
      expect(relations.tarot?.card, context).toBeTruthy();
      expect(relations.sky?.value, context).toBeTruthy();
      expect(relations.immortals?.upper.name, context).toBeTruthy();
      expect(relations.immortals?.lower.name, context).toBeTruthy();
      expect(relations.hebrew_letter?.letter, context).toBeTruthy();
    }
  });

  it('maps Card 61 self-inverse teaching from its authored Markdown heading', async () => {
    const relations = await loadRelations(61);

    expect(relations.inverse).toEqual({
      number: 61,
      is_self_inverse: true,
      teaching: 'Turn this energy end for end and it comes back the same. What is true at your centre looks the same from every side, so there is no hidden face behind it. What it lacks sits beside it, in its partner, never underneath.',
    });
  });
});
