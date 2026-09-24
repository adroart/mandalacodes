import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import presentationData from '../../data/oracle-presentation.json';
import { getSynthesis } from '../../data/synthesisData';
import { ALL_CARDS } from '../../data/oracleData';
import { elementForCard } from '../../lib/oracle/elements';

describe('browser Oracle Markdown source contract', () => {
  it('bundles only the closed range of canonical manuscripts 01-64', async () => {
    const source = await readFile(resolve('data/cardMarkdown.ts'), 'utf8');
    expect(source).toContain("../oracle/cards/0[1-9].md");
    expect(source).toContain("../oracle/cards/[1-5][0-9].md");
    expect(source).toContain("../oracle/cards/6[0-4].md");
    expect(source).not.toContain("../oracle/cards/*.md");
    expect(source).not.toContain("../oracle/cards/[0-9][0-9].md");
  });

  it('does not depend on the legacy aggregate as a test authority', async () => {
    const testSource = await readFile(resolve('tests/unit/oracleBrowserSource.test.ts'), 'utf8');
    const legacyAggregatePath = ['oracle/oracle', 'cards', 'complete.json'].join('_');

    expect(testSource).not.toContain(legacyAggregatePath);
  });

  it('contains no runtime imports or globs for legacy prose sources', async () => {
    const source = (await Promise.all([
      'data/cardMarkdown.ts',
      'data/synthesisData.ts',
      'data/oracleData.ts',
      'components/UniversalLanguageCard.tsx',
      'lib/oracle/card-markdown.ts',
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

  it('defines complete, substantive presentation metadata for exactly 64 cards', () => {
    expect(Object.keys(presentationData).sort()).toEqual(['_meta', 'cards']);
    expect(presentationData.cards).toHaveLength(64);
    expect(new Set(presentationData.cards.map(card => card.number)).size).toBe(64);
    expect(presentationData.cards.map(card => card.number).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 64 }, (_, index) => index + 1),
    );

    for (const card of presentationData.cards) {
      expect(Object.keys(card).sort()).toEqual([
        'color_inspiration',
        'element',
        'number',
        'traditional_colors',
      ]);
      expect(card.element.trim().length).toBeGreaterThan(0);
      expect(card.traditional_colors.trim().length).toBeGreaterThan(20);
      expect(card.color_inspiration.trim().length).toBeGreaterThan(20);
    }
  });

  it('uses the presentation manifest as the browser metadata source', () => {
    expect(ALL_CARDS.map(({
      number,
      element,
      traditional_colors,
      color_inspiration,
    }) => ({
      number,
      element,
      traditional_colors,
      color_inspiration,
    }))).toEqual(presentationData.cards);
  });

  it('preserves representative element filter and tint classifications', () => {
    expect(ALL_CARDS[0].element).toBe(
      'Metal, the Transformative Moment of autumn and inward gathering',
    );
    expect(ALL_CARDS[2].element).toBe('Water over Wood');
    expect(ALL_CARDS[8].element).toBe('Wood/Wind over Metal');
    expect(ALL_CARDS[13].element).toBe('Fire over Metal');
    expect(ALL_CARDS[23].element).toBe('Earth over Wood');

    expect([1, 3, 9, 14, 24].map(elementForCard)).toEqual([
      'Metal',
      'Water',
      'Wood',
      'Fire',
      'Earth',
    ]);
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
      // The shadow's two named faces, and the reference fields the card
      // page's tag chips and section headers bind. Every card carries them.
      expect(card?.synthesis.gene_keys.repressive_name).not.toBe('');
      expect(card?.synthesis.gene_keys.reactive_name).not.toBe('');
      expect(card?.reference?.hd_center).toMatch(/Cent(er|re)$/);
      expect(card?.reference?.hd_channel_label).toMatch(/^(Channels? of|Integration cluster)/);
      expect(card?.reference?.body_physiology).not.toBe('');
      expect(card?.reference?.body_amino_acid).not.toBe('');
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
      // Deliberately mid-paragraph prose fixtures (see cardMarkdown.test.ts), so a
      // rewrite of opening sentences does not break the browser synthesis contract.
      essence: expect.stringContaining('to see what it wants to become'),
      synthesis: {
        gene_keys: { gift: expect.stringContaining('only a change you have judged') },
        human_design: { gate: expect.stringContaining('toward a form it can live in') },
        body: { physiology: expect.stringContaining('the scar that closed it') },
      },
    });
  });

  it('binds the card page panels per card instead of carrying Earth\'s Breath literals', async () => {
    // The generated reading markup once hard-coded card 1's repressive and
    // reactive prose, its Human Design chips, and its Body headers, so all 64
    // cards read as Earth's Breath in those three places. Each must be bound.
    const markup = await readFile(resolve('components/oracle/eb/generated/EBReading.generated.tsx'), 'utf8');
    for (const literal of [
      'Repressive · Depressive',
      'Reactive · Frenetic',
      'meet the numbness by going still',
      'Identity Center',
      'Channel of Inspiration 1–8',
      'Ring of Fire',
      'Physiology · The Liver',
      'Amino Acid · Lysine',
      "alt=\"Earth's Breath",
    ]) {
      expect(markup, literal).not.toContain(literal);
    }
    for (const binding of [
      'vals.gkRepressiveName', 'vals.gkRepressiveFace', 'vals.gkRepressiveParas', 'vals.gkReactiveName', 'vals.gkReactiveFace', 'vals.gkReactiveParas',
      'vals.hdGateChip', 'vals.hdCentreChip', 'vals.hdChannelChip',
      'vals.bodyPhysHeading', 'vals.bodyAminoHeading',
    ]) {
      expect(markup, binding).toContain(binding);
    }

    const [c23, c47] = await Promise.all([getSynthesis(23), getSynthesis(47)]);
    expect(c23?.synthesis.gene_keys).toMatchObject({ repressive_name: 'Dumb', reactive_name: 'Fragmented' });
    expect(c23?.reference).toMatchObject({ hd_center: 'Throat Center', hd_harmonic_gate: '43', body_physiology: 'Throat (thyroid)', body_amino_acid: 'Leucine' });
    expect(c47?.synthesis.gene_keys).toMatchObject({ repressive_name: 'Hopeless', reactive_name: 'Dogmatic' });
    expect(c47?.reference).toMatchObject({ hd_center: 'Ajna Center', hd_channel_label: 'Channel of Abstraction (47–64)', body_physiology: 'Neocortex' });
  });

  it('fails closed when the required numbered Markdown manuscript is absent', async () => {
    await expect(getSynthesis(65)).rejects.toThrow(
      /oracle\/cards\/65\.md.*missing Markdown source/i,
    );
  });
});
