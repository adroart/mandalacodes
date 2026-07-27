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

/** Markdown-native kinship data shared by the browser, corpus, REST, and MCP. */
export interface OracleRelations {
  number: number;
  card_name: string;
  status?: string;
  unity_line: string;
  pair: {
    number: number;
    card_name?: string;
    hexagram_name?: string;
    teaching: string;
  };
  inverse: {
    number: number;
    is_self_inverse: boolean;
    teaching: string;
  };
  programming_partner: {
    number: number;
    card_name?: string;
    teaching: string;
  };
  codon_ring: {
    name: string;
    tarot?: string;
    siblings: number[];
    teaching: string;
  };
  tarot?: {
    card?: string;
    teaching: string;
  };
  sky?: {
    value: string;
    type?: string;
    teaching: string;
  };
  immortals?: {
    upper: { trigram?: string; name: string };
    lower: { trigram?: string; name: string };
    same_trigram: boolean;
    teaching: string;
  };
  hebrew_letter?: {
    letter: string;
    teaching: string;
  };
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

  relations: OracleRelations;

  reference?: Record<string, unknown>;

  artworks: CardArtwork[];

  /** Pre-joined lowercase blob of every searchable field. Present in the local
   *  corpus; stripped from the hosted corpus JSON (the index carries search). */
  searchText?: string;
}

export type Voice = 'glance' | 'iching' | 'gene_keys' | 'human_design' | 'tarot' | 'body';
