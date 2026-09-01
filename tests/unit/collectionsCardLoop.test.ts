import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  cardCollectionItem,
  cardNumberFromItem,
  collectionsHolding,
  sameItem,
} from '../../lib/collections/items';
import type { Collection } from '../../lib/collections/context';

/* Collections were a dead end: a visitor could create one and open its page,
 * but nothing anywhere called addItem, so every collection stayed empty. These
 * tests hold the loop closed at both ends. The round-trip half proves the card
 * page and the collections page agree on the shape of a saved card; the wiring
 * half proves the save control is actually mounted on the card page. Both fail
 * against the unwired state. */

const collection = (id: number, name: string, items: Collection['items']): Collection => ({
  id,
  name,
  createdAt: '2026-09-01T00:00:00.000Z',
  items,
});

describe('the saved-card contract shared by the card page and the collections page', () => {
  it('round-trips a card number through the item the save control writes', () => {
    for (const cardNumber of [1, 7, 41, 64]) {
      const item = cardCollectionItem(cardNumber);
      expect(item.kind).toBe('card');
      expect(item.ref).toBe(String(cardNumber));
      // What the collections page reads back is the card the card page saved.
      expect(cardNumberFromItem(item)).toBe(cardNumber);
    }
  });

  it('refuses to resolve items that are not cards, and malformed refs', () => {
    expect(cardNumberFromItem({ kind: 'artwork', ref: '12' })).toBeNull();
    expect(cardNumberFromItem({ kind: 'card', ref: 'UL-122' })).toBeNull();
    expect(cardNumberFromItem({ kind: 'card', ref: '' })).toBeNull();
    expect(cardNumberFromItem({ kind: 'card', ref: '0' })).toBeNull();
    expect(cardNumberFromItem({ kind: 'card', ref: '65' })).toBeNull();
  });

  it('matches a saved card only against the same kind and reference', () => {
    const item = cardCollectionItem(41);
    expect(sameItem(item, { kind: 'card', ref: '41' })).toBe(true);
    expect(sameItem(item, { kind: 'card', ref: '14' })).toBe(false);
    expect(sameItem(item, { kind: 'artwork', ref: '41' })).toBe(false);
  });

  it('names every collection already holding the card, so the control can offer removal', () => {
    const saved = cardCollectionItem(41);
    const collections = [
      collection(1, 'Studies', [{ kind: 'card', ref: '41' }]),
      collection(2, 'For the wall', [{ kind: 'card', ref: '7' }]),
      collection(3, 'Second look', [{ kind: 'artwork', ref: '41' }, { kind: 'card', ref: '41' }]),
    ];
    expect(collectionsHolding(collections, saved).map((c) => c.name)).toEqual([
      'Studies',
      'Second look',
    ]);
    expect(collectionsHolding([], saved)).toEqual([]);
  });
});

describe('the saved card survives the round trip through the API', () => {
  it('writes a kind the add-item endpoint accepts, and a ref it will not truncate', async () => {
    const server = await readFile(resolve('functions/api/collections/add-item.js'), 'utf8');
    const kinds = server.match(/const KINDS = new Set\(\[([^\]]+)\]\)/);
    expect(kinds, 'add-item.js still declares its accepted kinds').not.toBeNull();
    const accepted = kinds![1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));

    for (const cardNumber of [1, 64]) {
      const item = cardCollectionItem(cardNumber);
      expect(accepted).toContain(item.kind);
      // The endpoint trims and cuts refs at 80 characters; a code never nears it.
      expect(item.ref.trim()).toBe(item.ref);
      expect(item.ref.length).toBeGreaterThan(0);
      expect(item.ref.length).toBeLessThanOrEqual(80);
    }
  });

  it('reads back the same field names the list endpoint returns', async () => {
    const list = await readFile(resolve('functions/api/collections/list.js'), 'utf8');
    // list.js builds each item as { kind, ref } inside a collection's items array.
    expect(list).toContain('{ kind: it.kind, ref: it.ref }');
    expect(list).toContain('items: itemsByCol.get(c.id) ?? []');
  });
});

describe('the save control is mounted on the card page', () => {
  it('renders SaveToCollectionButton for this card, through the header slot', async () => {
    const source = await readFile(resolve('components/UniversalLanguageCard.tsx'), 'utf8');
    expect(source).toContain("from './account/SaveToCollectionButton'");
    expect(source).toContain('<SaveToCollectionButton');
    // Built through the shared helper, so the card page and the collections
    // page cannot drift on how a saved code is written down.
    expect(source).toContain('item={cardCollectionItem(card.number)}');
  });

  it('keeps the card page free of a signup wall, prompting sign-in on click instead', async () => {
    const button = await readFile(
      resolve('components/account/SaveToCollectionButton.tsx'),
      'utf8',
    );
    // Signed-out visitors get the same modal trigger the rest of the site uses.
    expect(button).toContain('SignInTrigger');
    // Unconfigured accounts hide the control rather than blocking the reading.
    expect(button).toContain('if (!account.available) return null;');
  });

  it('carries no em dash and no italics in the control copy', async () => {
    for (const file of [
      'components/UniversalLanguageCard.tsx',
      'components/account/SaveToCollectionButton.tsx',
      'components/account/CollectionsManager.tsx',
    ]) {
      const source = await readFile(resolve(file), 'utf8');
      expect(source, `${file} em dash`).not.toContain('—');
      expect(source, `${file} italic`).not.toMatch(/font-style:\s*italic/);
      expect(source, `${file} italic class`).not.toMatch(/\bitalic\b/);
    }
  });
});
