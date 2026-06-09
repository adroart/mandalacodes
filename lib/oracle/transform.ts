/**
 * Map a canonical corpus card into the ranker's minimal SearchDoc shape.
 * Shared so the build-time index generator, the local MCP server, and any
 * hosted caller all produce identical search documents.
 */
import type { SearchDoc } from './ranker';
import type { CanonicalCard } from './types';

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
