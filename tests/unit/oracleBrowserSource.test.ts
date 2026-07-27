import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { getSynthesis } from '../../data/synthesisData';
import { ALL_CARDS } from '../../data/oracleData';
import legacyOracleData from '../../oracle/oracle_cards_complete.json';

interface LegacyPresentationCard {
  number: number;
  element: string;
  traditional_colors: string;
  color_inspiration: string;
}

describe('browser Oracle Markdown source contract', () => {
  it('contains no runtime imports or globs for legacy prose sources', async () => {
    const source = (await Promise.all([
      'data/synthesisData.ts',
      'data/oracleData.ts',
      'components/UniversalLanguageCard.tsx',
    ].map(file => readFile(resolve(file), 'utf8')))).join('\n');

    expect(source).not.toMatch(/oracle\/synthesis/i);
    expect(source).not.toMatch(/oracle\/sections/i);
    expect(source).not.toMatch(/oracle\/generated/i);
    expect(source).not.toMatch(/oracle_cards_complete/i);
    expect(source).not.toMatch(/dual[- ]path/i);
    expect(source).not.toMatch(/expandedOracleData/i);
    expect(source).not.toMatch(/(?:getLineText|data\/ichingLines)/i);
  });

  it('builds the synchronous browser card registry from the canonical generated artifact', () => {
    expect(ALL_CARDS).toHaveLength(64);
    expect(ALL_CARDS.map(card => card.number)).toEqual(
      Array.from({ length: 64 }, (_, index) => index + 1),
    );
    expect(ALL_CARDS[2]).toMatchObject({
      card_name: 'Messengers of the Infinite',
      iching: { hexagram_name: 'Difficulty at the Beginning' },
      gene_keys: { shadow: 'Chaos', gift: 'Innovation', siddhi: 'Innocence' },
      human_design: { gate: 3, keyword: 'Ordering' },
    });
  });

  it('preserves established presentation metadata for all 64 browser cards', () => {
    const expected = legacyOracleData.codon_rings
      .flatMap(ring => ring.cards as LegacyPresentationCard[])
      .sort((left, right) => left.number - right.number)
      .map(({ number, element, traditional_colors, color_inspiration }) => ({
        number,
        element,
        traditional_colors,
        color_inspiration,
      }));

    expect(expected).toHaveLength(64);
    expect(ALL_CARDS.map(({
      number,
      element,
      traditional_colors,
      color_inspiration,
    }) => ({ number, element, traditional_colors, color_inspiration }))).toEqual(expected);
  });

  it('builds all 64 complete browser synthesis objects from card Markdown', async () => {
    const cards = await Promise.all(
      Array.from({ length: 64 }, (_, index) => getSynthesis(index + 1)),
    );

    expect(cards).toHaveLength(64);
    expect(cards.every(Boolean)).toBe(true);
    expect(cards.map(card => card?.number)).toEqual(
      Array.from({ length: 64 }, (_, index) => index + 1),
    );

    for (const card of cards) {
      expect(card?.keywords?.length).toBeGreaterThan(0);
      expect(card?.essence).not.toBe('');
      expect(card?.synthesis.iching.reading).not.toBe('');
      expect(card?.synthesis.gene_keys.shadow).not.toBe('');
      expect(card?.synthesis.human_design.gate).not.toBe('');
      expect(card?.synthesis.body.physiology).not.toBe('');
      expect(card?.synthesis.tarot.ring_role).not.toBe('');
      expect(card?.relations?.unity_line).not.toBe('');
    }

    expect(cards[2]).toMatchObject({
      number: 3,
      card_name: 'Messengers of the Infinite',
      ring_name: 'Ring of Life and Death',
      keywords: expect.arrayContaining(['New Beginnings']),
      essence: expect.stringContaining('Something has begun in you'),
      synthesis: {
        gene_keys: { gift: expect.stringContaining('Stop outrunning the unsettled feeling') },
        human_design: { gate: expect.stringContaining('giving form to something that has only just arrived') },
        body: { physiology: expect.stringContaining('soft middle where the news of impermanence is felt') },
      },
    });
  });

  it('fails closed when the required numbered Markdown manuscript is absent', async () => {
    await expect(getSynthesis(65)).rejects.toThrow(
      /oracle\/cards\/65\.md.*missing Markdown source/i,
    );
  });
});
