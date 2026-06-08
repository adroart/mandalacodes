/**
 * Search over the canonical corpus — a thin adapter over the shared ranker in
 * lib/oracle/ranker.ts (the single source of truth the website also uses). This
 * file only maps a CanonicalCard into the ranker's SearchDoc shape; all scoring
 * lives in the shared ranker so Claude and the site rank identically.
 */
import type { CanonicalCard } from './corpus.ts';
import { rank, type RankHit, type SearchDoc } from '../../../lib/oracle/ranker.ts';

export type Voice = 'glance' | 'iching' | 'gene_keys' | 'human_design' | 'tarot' | 'body';

export interface SearchHit extends RankHit {
  artwork_count: number;
}

/** Map a corpus card to the ranker's minimal searchable shape. */
export function toSearchDoc(card: CanonicalCard): SearchDoc {
  return {
    number: card.number,
    card_name: card.card_name,
    ring_name: card.ring_name,
    keywords: card.keywords ?? [],
    fields: {
      essence: card.essence,
      glance: card.glance.reading,
      iching: [card.iching.reading, card.iching.trigram_combination, card.iching.hexagram_name].filter(Boolean).join(' '),
      gene_keys: [card.gene_keys.shadow_name, card.gene_keys.gift_name, card.gene_keys.siddhi_name, card.gene_keys.gift, card.gene_keys.shadow, card.gene_keys.siddhi].filter(Boolean).join(' '),
      human_design: [card.human_design.gate_keyword, card.human_design.gate].filter(Boolean).join(' '),
      tarot: [card.tarot.ring_role, card.tarot.tarot_resonance].filter(Boolean).join(' '),
      body: [card.body.physiology, card.body.amino_acid].filter(Boolean).join(' '),
    },
    artwork: {
      id: card.artworks[0]?.id,
      image: card.artworks[0]?.coverImage,
      count: card.artworks.length,
    },
  };
}

export function searchCorpus(
  corpus: CanonicalCard[],
  query: string,
  opts: { limit?: number; systems?: string[] } = {},
): SearchHit[] {
  const docs = corpus.map(toSearchDoc);
  return rank(docs, query, opts).map((h) => ({ ...h, artwork_count: h.artwork.count }));
}
