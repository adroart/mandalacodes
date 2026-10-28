import { describe, expect, it } from 'vitest';
import { ALL_CARDS } from '../../data/oracleData';
import { searchCards } from '../../src/mobile/discovery/search';

describe('Oracle index discovery', () => {
  it('keeps all 64 cards in their canonical order with an empty query', () => {
    expect(searchCards(ALL_CARDS, '  ').map(card => card.number)).toEqual(ALL_CARDS.map(card => card.number));
    expect(searchCards(ALL_CARDS, '')).toHaveLength(64);
  });
  it('matches exact card numbers, including leading zeros and gate notation', () => {
    for (const query of ['1', '01', 'card 1', 'gate 1', '#1']) expect(searchCards(ALL_CARDS, query).map(card => card.number)).toEqual([1]);
    expect(searchCards(ALL_CARDS, '65')).toEqual([]);
  });
  it('finds names and Gene Keys metadata without inventing keywords', () => {
    const card = ALL_CARDS[28];
    expect(searchCards(ALL_CARDS, card.card_name.toUpperCase())).toContain(card);
    expect(searchCards(ALL_CARDS, card.gene_keys.gift)).toContain(card);
    expect(searchCards(ALL_CARDS, 'nonsense not-a-card')).toEqual([]);
  });
  it('requires every supplied search term', () => {
    const matches = searchCards(ALL_CARDS, 'heaven earth');
    expect(matches.length).toBeGreaterThan(0);
    const heaven = searchCards(ALL_CARDS, 'heaven');
    const earth = searchCards(ALL_CARDS, 'earth');
    expect(matches).toEqual(heaven.filter(card => earth.includes(card)));
    expect(searchCards(ALL_CARDS, 'heaven nonexistent-keyword')).toEqual([]);
  });
});
