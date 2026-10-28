import type { OracleCard } from '../../../data/oracleData';

const normalise = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Search only the card's real names and metadata, never generated interpretation. */
export function searchCards(cards: readonly OracleCard[], query: string): OracleCard[] {
  const clean = normalise(query);
  if (!clean) return [...cards];
  const numbered = clean.match(/^(?:card\s*|gate\s*|#\s*)?(\d+)$/);
  if (numbered) return cards.filter(card => card.number === Number(numbered[1]));
  const tokens = clean.split(/\s+/);
  return cards.filter(card => {
    const text = normalise([
      card.card_name, card.iching.hexagram_name, card.element, card.nature,
      card.iching.upper_trigram.name, card.iching.lower_trigram.name,
      card.gene_keys.shadow, card.gene_keys.gift, card.gene_keys.siddhi,
      card.human_design.keyword, card.ring_name,
    ].join(' '));
    return tokens.every(token => text.includes(token));
  });
}
