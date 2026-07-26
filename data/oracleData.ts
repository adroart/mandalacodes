import corpusData from './oracle-corpus.json';
import type { CanonicalCard } from '../lib/oracle/types';

/* ─── Stable browser-facing types ───────────────────────────────────────── */

export interface OracleTrigram {
  symbol: string;
  name: string;
  nature: string;
}

export interface OracleIChing {
  hexagram_name: string;
  essence: string;
  upper_trigram: OracleTrigram;
  lower_trigram: OracleTrigram;
}

export interface OracleGeneKeys {
  shadow: string;
  gift: string;
  siddhi: string;
  description: string;
}

export interface OracleHumanDesign {
  gate: number;
  keyword: string;
  description: string;
}

export interface OracleCard {
  number: number;
  card_name: string;
  iching: OracleIChing;
  element: string;
  traditional_colors: string;
  nature: string;
  gene_keys: OracleGeneKeys;
  codon_ring_siblings: number[];
  human_design: OracleHumanDesign;
  color_inspiration: string;
  ring_name: string;
  ring_tarot: string;
  ring_description: string;
}

export interface CodonRing {
  ring_name: string;
  tarot: string;
  description: string;
  cards: OracleCard[];
}

/* ─── Markdown-derived generated registry ───────────────────────────────── */

const canonicalCards = (corpusData as { cards: CanonicalCard[] }).cards;

export const ORACLE_META = {
  title: 'Universal Language Oracle',
  version: 'markdown-corpus-v1',
  author: 'Adrian Rasmussen',
  description: 'The 64-card Universal Language Oracle.',
};

function trigramLabel(value?: string): string {
  return (value ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function toOracleCard(card: CanonicalCard): OracleCard {
  const upper = card.iching.upper_trigram ?? {};
  const lower = card.iching.lower_trigram ?? {};
  const upperLabel = trigramLabel(upper.name);
  const lowerLabel = trigramLabel(lower.name);

  return {
    number: card.number,
    card_name: card.card_name,
    iching: {
      hexagram_name: card.iching.hexagram_name ?? '',
      essence: card.iching.reading ?? '',
      upper_trigram: {
        symbol: upper.symbol ?? '',
        name: upper.name ?? '',
        nature: upper.nature ?? '',
      },
      lower_trigram: {
        symbol: lower.symbol ?? '',
        name: lower.name ?? '',
        nature: lower.nature ?? '',
      },
    },
    element: upperLabel === lowerLabel ? upperLabel : `${upperLabel} over ${lowerLabel}`,
    traditional_colors: '',
    nature: card.iching.trigram_combination ?? card.iching.reading ?? '',
    gene_keys: {
      shadow: card.gene_keys.shadow_name ?? '',
      gift: card.gene_keys.gift_name ?? '',
      siddhi: card.gene_keys.siddhi_name ?? '',
      description: card.gene_keys.shadow ?? '',
    },
    codon_ring_siblings: card.relations.codon_ring.siblings,
    human_design: {
      gate: card.human_design.gate_number ?? card.number,
      keyword: card.human_design.gate_keyword ?? '',
      description: card.human_design.gate ?? '',
    },
    color_inspiration: '',
    ring_name: card.ring_name,
    ring_tarot: card.ring_tarot ?? '',
    ring_description: card.relations.codon_ring.teaching,
  };
}

/** All 64 cards sorted numerically. The artifact is generated from Markdown. */
export const ALL_CARDS: OracleCard[] = canonicalCards.map(toOracleCard)
  .sort((left, right) => left.number - right.number);

const ringMap = new Map<string, CodonRing>();
for (const card of ALL_CARDS) {
  const ring = ringMap.get(card.ring_name) ?? {
    ring_name: card.ring_name,
    tarot: card.ring_tarot,
    description: card.ring_description,
    cards: [],
  };
  ring.cards.push(card);
  ringMap.set(card.ring_name, ring);
}

export const CODON_RINGS: CodonRing[] = [...ringMap.values()];

export const CARD_BY_NUMBER = new Map<number, OracleCard>(
  ALL_CARDS.map(card => [card.number, card]),
);
