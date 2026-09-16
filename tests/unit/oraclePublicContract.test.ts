import { describe, expect, it } from 'vitest';

import corpusData from '../../data/oracle-corpus.json';
import { PUBLIC_TOOL_DEFS } from '../../lib/oracle/tool-defs';
import type { CanonicalCard } from '../../lib/oracle/types';

function findForbiddenKeys(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findForbiddenKeys(entry, `${path}[${index}]`));
  }
  if (!value || typeof value !== 'object') return [];

  const forbidden = new Set(['status', 'meta', 'sourcing_log', 'fact_check']);
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => [
    ...(forbidden.has(key) ? [`${path}.${key}`] : []),
    ...findForbiddenKeys(child, `${path}.${key}`),
  ]);
}

describe('Oracle public contract', () => {
  const cards = (corpusData as { cards: CanonicalCard[] }).cards;

  it('publishes 64 cards without internal editorial fields', () => {
    expect(cards).toHaveLength(64);
    expect(findForbiddenKeys(cards)).toEqual([]);
  });

  it('keeps the documented card surface stable for Card 23', () => {
    const card = cards.find(candidate => candidate.number === 23);
    expect(card).toBeDefined();
    expect(Object.keys(card!).sort()).toEqual([
      'artworks', 'body', 'card_name', 'essence', 'gene_keys', 'glance',
      'human_design', 'iching', 'keywords', 'number', 'reference', 'relations',
      'ring_name', 'ring_tarot', 'tarot',
    ]);
    expect(card).toMatchObject({
      number: 23,
      card_name: 'Beneath the Surface',
      ring_name: 'Ring of Life and Death',
      keywords: expect.arrayContaining(['Cutting Back to What Matters', 'Knowing Before the Words Come', 'Room to Breathe']),
      relations: {
        pair: { number: 24 },
        inverse: { number: 24 },
        programming_partner: { number: 43 },
        codon_ring: { siblings: [3, 20, 24, 27, 42] },
      },
    });
  });

  it('keeps all seven public tool names stable', () => {
    expect(PUBLIC_TOOL_DEFS.map(tool => tool.name)).toEqual([
      'search_oracle',
      'get_card',
      'get_voice',
      'get_line',
      'list_cards',
      'find_artworks',
      'cast_hexagram',
    ]);
  });
});
