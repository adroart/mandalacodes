/* ─── Card element → single primary element + tint ──────────────────────────
 * The oracle data stores `element` as prose ("Earth over Water", "Metal",
 * "Wood under Wind"). The deck redesign needs ONE primary element per card for
 * tinting the artwork placeholders, the element filter chips, and the
 * constellation nodes. We take the first recognised element word as primary.
 *
 * Tints are the warm wood/bronze-family two-stop gradients from the design
 * mock — they read as quiet element panels, never as loud colour. */

import { ALL_CARDS } from '../../data/oracleData';

export type Element = 'Fire' | 'Water' | 'Earth' | 'Metal' | 'Wood';

/** Two-stop gradient [light, dark] per element. */
export const ELEMENT_TINT: Record<Element, readonly [string, string]> = {
  Fire: ['#b06348', '#7c3e2b'],
  Water: ['#5c7079', '#3b4d54'],
  Earth: ['#9d7c48', '#65502f'],
  Metal: ['#949086', '#65625b'],
  Wood: ['#717a54', '#4a5238'],
};

/** Solid node colour per element (the lighter stop). */
export const ELEMENT_DOT: Record<Element, string> = {
  Fire: ELEMENT_TINT.Fire[0],
  Water: ELEMENT_TINT.Water[0],
  Earth: ELEMENT_TINT.Earth[0],
  Metal: ELEMENT_TINT.Metal[0],
  Wood: ELEMENT_TINT.Wood[0],
};

export const ELEMENTS: Element[] = ['Fire', 'Water', 'Earth', 'Metal', 'Wood'];

/** First recognised element word in the prose `element` field. Wind maps to
 *  Wood (the same trigram family); anything unrecognised falls back to Earth. */
export function primaryElement(elementProse: string): Element {
  const lc = elementProse.toLowerCase();
  // Order matters only for "wind" → wood; otherwise first hit wins by position.
  const order: Array<[Element, RegExp]> = [
    ['Fire', /fire/],
    ['Water', /water|lake|stream/],
    ['Metal', /metal|heaven/],
    ['Wood', /wood|wind|wind\)/],
    ['Earth', /earth|mountain/],
  ];
  // Find the element whose keyword appears earliest in the string.
  let best: Element = 'Earth';
  let bestIdx = Infinity;
  for (const [el, re] of order) {
    const m = lc.match(re);
    if (m && m.index !== undefined && m.index < bestIdx) {
      bestIdx = m.index;
      best = el;
    }
  }
  return best;
}

/** Pre-computed element per card number (built once). */
export const CARD_ELEMENT = new Map<number, Element>(
  ALL_CARDS.map((c) => [c.number, primaryElement(c.element)]),
);

export function elementForCard(number: number): Element {
  return CARD_ELEMENT.get(number) ?? 'Earth';
}

export function tintForCard(number: number): readonly [string, string] {
  return ELEMENT_TINT[elementForCard(number)];
}
