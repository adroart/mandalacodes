import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import type { SearchDoc } from '../../lib/oracle/ranker';
import type { CanonicalCard } from '../../lib/oracle/types';

const corpusFile = resolve('data/oracle-corpus.json');
const searchFile = resolve('data/oracle-search-index.json');

async function readArtifacts(): Promise<{
  corpusRaw: string;
  cards: CanonicalCard[];
  searchRaw: string;
  searchDocs: SearchDoc[];
}> {
  const [corpusRaw, searchRaw] = await Promise.all([
    readFile(corpusFile, 'utf8'),
    readFile(searchFile, 'utf8'),
  ]);

  return {
    corpusRaw,
    cards: (JSON.parse(corpusRaw) as { cards: CanonicalCard[] }).cards,
    searchRaw,
    searchDocs: JSON.parse(searchRaw) as SearchDoc[],
  };
}

describe('generated Oracle artifacts', () => {
  it('contain all 64 cards once and in stable numeric order', async () => {
    const { cards, searchDocs } = await readArtifacts();
    const expected = Array.from({ length: 64 }, (_, index) => index + 1);

    expect(cards.map(card => card.number)).toEqual(expected);
    expect(searchDocs.map(card => card.number)).toEqual(expected);
    expect(new Set(cards.map(card => card.number))).toHaveLength(64);
    expect(new Set(searchDocs.map(card => card.number))).toHaveLength(64);
  });

  it('retains Markdown-authored Card 3 content across the full corpus and search index', async () => {
    const { cards, searchDocs } = await readArtifacts();
    const card = cards.find(candidate => candidate.number === 3);
    const searchDoc = searchDocs.find(candidate => candidate.number === 3);

    expect(card?.keywords).toContain('New Beginnings');
    // Deliberately mid-paragraph prose fixtures, one per lens, each unique to its
    // own field in oracle/cards/03.md. Opening sentences get rewritten; these do not.
    expect(card?.glance.reading).toContain('Something new is already alive in you and it does not have a shape yet');
    expect(card?.iching.reading).toContain('does not yet have ground to stand on');
    expect(card?.gene_keys.gift).toContain('It starts to give');
    expect(card?.human_design.gate).toContain('yours to give a shape to');
    expect(card?.body.physiology).toContain('where a beginning was once made the hard way');

    expect(searchDoc?.keywords).toContain('New Beginnings');
    expect(searchDoc?.fields.glance).toContain('Something new is already alive in you and it does not have a shape yet');
    expect(searchDoc?.fields.iching).toContain('does not yet have ground to stand on');
  });

  it('retains rich Markdown Relations and the Markdown-authoritative Card 29 pair', async () => {
    const { cards } = await readArtifacts();
    const card3 = cards.find(card => card.number === 3);
    const card29 = cards.find(card => card.number === 29);

    expect(card29?.relations.pair.number).toBe(29);
    expect(card3?.relations.codon_ring).toMatchObject({
      name: 'Ring of Life and Death',
      siblings: [20, 23, 24, 27, 42],
    });
    // Mid-paragraph on purpose: the Tarot teaching's opening line is editorial.
    expect(card3?.relations.tarot?.teaching).toContain('Water above as the High Priestess and the Hanged Man');
    expect(card3?.relations.sky).toMatchObject({ value: 'Scorpio' });
    expect(card3?.relations.immortals?.teaching).toContain('Li Tie Guai, the healer');
    expect(card3?.relations.hebrew_letter).toMatchObject({ letter: 'Nun' });
  });

  it('contains no stripped Markdown comment or sourcing-log text', async () => {
    const { corpusRaw, searchRaw } = await readArtifacts();

    for (const artifact of [corpusRaw, searchRaw]) {
      expect(artifact).not.toContain('<!--');
      expect(artifact).not.toContain('-->');
      expect(artifact).not.toContain('SOURCING LOG');
    }
  });

  it('uses one canonical deterministic JSON serialization', async () => {
    const { corpusRaw, cards, searchRaw, searchDocs } = await readArtifacts();

    expect(corpusRaw).toBe(`${JSON.stringify({ cards })}\n`);
    expect(searchRaw).toBe(`${JSON.stringify(searchDocs)}\n`);
  });
});
