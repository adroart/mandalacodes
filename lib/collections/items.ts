import type { Collection, CollectionItem } from './context';

/**
 * The one place that knows how a saved card is written down.
 *
 * The card page writes the item, the collections page reads it back, and for a
 * long while nothing wrote at all: the save control was built but never
 * mounted, so every collection stayed empty. Both ends now go through these
 * helpers, so the shape they agree on is a single testable fact rather than a
 * string literal repeated in two components.
 */

/** Cards run 1 to 64. Anything outside that is not a card reference. */
const CARD_COUNT = 64;

/** The item a card page saves for the code it is showing. */
export function cardCollectionItem(cardNumber: number): CollectionItem {
  return { kind: 'card', ref: String(cardNumber) };
}

/**
 * The card number behind a saved item, or null when the item is not a card or
 * its reference is not a real code. Callers render nothing rather than a
 * broken row when this returns null.
 */
export function cardNumberFromItem(item: CollectionItem): number | null {
  if (item.kind !== 'card') return null;
  if (!/^\d+$/.test(item.ref)) return null;
  const n = Number(item.ref);
  if (!Number.isInteger(n) || n < 1 || n > CARD_COUNT) return null;
  return n;
}

/** Two items are the same saved thing when both kind and reference match. */
export function sameItem(a: CollectionItem, b: CollectionItem): boolean {
  return a.kind === b.kind && a.ref === b.ref;
}

/**
 * Every collection that already holds this item, in the order the collections
 * were given. The save control uses this to offer removal instead of a second
 * silent save, so each row in the chooser says what the click will do.
 */
export function collectionsHolding(
  collections: Collection[],
  item: CollectionItem,
): Collection[] {
  return collections.filter((c) => c.items.some((i) => sameItem(i, item)));
}
