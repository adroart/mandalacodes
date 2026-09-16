import { describe, expect, it } from 'vitest';

import { onRequestGet as getCard } from '../../functions/api/oracle/card';
import { onRequestGet as searchCards } from '../../functions/api/oracle/search';
import { loadCorpus } from '../../mcp/oracle-server/src/corpus';
import { searchCorpus } from '../../mcp/oracle-server/src/search';
import { toSearchDoc } from '../../lib/oracle/transform';
import type { CanonicalCard } from '../../lib/oracle/types';
import generatedSearchDocs from '../../data/oracle-search-index.json';

function withoutSearchText(card: CanonicalCard): Omit<CanonicalCard, 'searchText'> {
  const { searchText: _searchText, ...published } = card;
  return published;
}

function withoutLocalSearchExtras<T extends { artwork_count: number }>(hit: T): Omit<T, 'artwork_count'> {
  const { artwork_count: _artworkCount, ...published } = hit;
  return published;
}

describe('hosted Oracle REST parity', () => {
  it('returns all 64 Markdown-derived local cards exactly through hosted REST', async () => {
    const local = await loadCorpus();
    const hosted = await Promise.all(local.map(async card => {
      const response = await getCard({
        request: new Request(`https://example.test/api/oracle/card?n=${card.number}`),
      } as never);
      expect(response.status).toBe(200);
      return response.json();
    }));

    expect(hosted).toEqual(local.map(withoutSearchText));
    expect(hosted[2]).toMatchObject({
      // Mid-paragraph prose fixture on purpose (see cardMarkdown.test.ts).
      glance: { reading: expect.stringContaining('fullness and not knowing in one breath') },
      relations: { codon_ring: { name: 'Ring of Life and Death' } },
    });
  });

  it('generates every hosted search document from the complete local card projection', async () => {
    const expected = (await loadCorpus()).map(toSearchDoc);

    expect(generatedSearchDocs).toEqual(expected);
    expect(generatedSearchDocs).toHaveLength(64);
  });

  it('searches the same complete Markdown-derived fields as the local MCP', async () => {
    const corpus = await loadCorpus();
    const localHits = searchCorpus(corpus, 'rough moves', { limit: 8, expand: false })
      .map(withoutLocalSearchExtras);
    const response = await searchCards({
      request: new Request('https://example.test/api/oracle/search?q=rough%20moves&limit=8&literal=1'),
    } as never);
    const body = await response.json() as { query: string; hits: unknown[] };

    expect(body.query).toBe('rough moves');
    expect(body.hits).toEqual(localHits);
    expect(body.hits).toContainEqual(expect.objectContaining({
      number: 3,
      matched: expect.arrayContaining(['rough']),
    }));
  });
});
