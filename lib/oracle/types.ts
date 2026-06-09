/**
 * Shared oracle corpus types — used by the local MCP server (which builds a
 * corpus from disk) and the hosted Cloudflare Functions (which read a prebuilt
 * corpus JSON). Keeping the shape in one place means get_card / get_voice etc.
 * return the same structure everywhere.
 */

export interface MovingLine {
  line: number;
  image?: string;
  reading: string;
  becomes?: { hexagram: number; name: string };
}

export interface CardArtwork {
  id: string;
  title: string;
  coverImage?: string;
  year?: string;
  availability?: string;
}

export interface CanonicalCard {
  number: number;
  card_name: string;
  ring_name: string;
  ring_tarot?: string;
  keywords: string[];
  essence?: string;

  glance: { reading?: string; invocation?: string };

  iching: {
    hexagram_name?: string;
    trigram_combination?: string;
    reading?: string;
    judgement_lines?: string[];
    image_lines?: string[];
    upper_trigram?: { symbol?: string; name?: string; nature?: string };
    lower_trigram?: { symbol?: string; name?: string; nature?: string };
    lines: MovingLine[];
  };

  gene_keys: {
    shadow_name?: string;
    gift_name?: string;
    siddhi_name?: string;
    shadow?: string;
    repressive?: string;
    reactive?: string;
    gift?: string;
    siddhi?: string;
    programming_partner?: string;
  };

  human_design: {
    gate_number?: number;
    gate_keyword?: string;
    gate?: string;
    centre?: string;
    channel?: string;
  };

  tarot: { arcana?: string; ring_role?: string; tarot_resonance?: string };

  body: { physiology?: string; amino_acid?: string };

  relations: {
    programming_partner_number?: number | null;
    programming_partner?: string;
    codon_ring_siblings: number[];
  };

  reference?: Record<string, unknown>;

  artworks: CardArtwork[];

  /** Pre-joined lowercase blob of every searchable field. Present in the local
   *  corpus; stripped from the hosted corpus JSON (the index carries search). */
  searchText?: string;
}

export type Voice = 'glance' | 'iching' | 'gene_keys' | 'human_design' | 'tarot' | 'body';
