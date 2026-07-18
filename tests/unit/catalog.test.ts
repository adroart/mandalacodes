/**
 * Unit tests for utils/catalog.ts — the Catalog Room's pure core.
 *
 * These FREEZE the two rules a printed piece depends on: id + sigil minting
 * (prefix from the kind, number never reused) and the public projection (the
 * private fields never leak, price/acquire ride only on an available piece).
 * A change that breaks one of these breaks a printed promise (the forever
 * contract) — the change is wrong, not the test.
 */
import { describe, expect, it } from 'vitest';
import type { CatalogEntry } from '../../types';
import {
  catalogPrefixFor,
  catalogSigil,
  kindToCodeParts,
  mintCatalogId,
  parseCatalogInput,
  toPublicCatalogEntry,
  publicCatalogEntryToArtwork,
} from '../../utils/catalog';

describe('catalog — prefix + sigil minting', () => {
  it('resolves the frozen prefix per kind', () => {
    expect(catalogPrefixFor('mandala')).toBe('MA');
    expect(catalogPrefixFor('signature')).toBe('SG');
    expect(catalogPrefixFor('jewelry')).toBe('JW');
    // 'other' derives from the series name: a frozen row wins…
    expect(catalogPrefixFor('other', 'Light Codes')).toBe('LC');
    // …else the pre-freeze initials fallback.
    expect(catalogPrefixFor('other', 'Aurora Bloom')).toBe('AB');
  });

  it('mints sequential ids that never roll back', () => {
    const store = { nextNumberByPrefix: {} as Record<string, number> };
    const a = mintCatalogId(store, 'mandala');
    expect(a.id).toBe('MA-1');
    expect(a.sigilNumber).toBe(1);

    const b = mintCatalogId({ nextNumberByPrefix: a.nextNumberByPrefix }, 'mandala');
    expect(b.id).toBe('MA-2');

    // A different prefix has its own counter.
    const c = mintCatalogId({ nextNumberByPrefix: b.nextNumberByPrefix }, 'jewelry');
    expect(c.id).toBe('JW-1');

    // Deleting MA-2 does NOT rewind the counter: the store keeps MA at 3.
    const d = mintCatalogId({ nextNumberByPrefix: c.nextNumberByPrefix }, 'mandala');
    expect(d.id).toBe('MA-3');
  });

  it("aligns the id's trailing digits with the rendered sigil forever", () => {
    const store = { nextNumberByPrefix: { MA: 7 } };
    const mint = mintCatalogId(store, 'mandala');
    expect(mint.id).toBe('MA-7');
    const entry: CatalogEntry = {
      id: mint.id,
      title: 'Seed of Light',
      kind: 'mandala',
      status: 'with-artist',
      sigilNumber: mint.sigilNumber,
      createdAt: '2026-07-18T00:00:00Z',
    };
    expect(catalogSigil(entry)).toBe('MA № 7');
  });

  it('maps each kind to the pieceCode parts its sigil is built from', () => {
    expect(kindToCodeParts('mandala')).toEqual({ series: 'Mandala' });
    expect(kindToCodeParts('signature')).toEqual({ isSignaturePiece: true });
    expect(kindToCodeParts('jewelry')).toEqual({ category: 'Jewelry' });
    expect(kindToCodeParts('other', 'Light Codes')).toEqual({ series: 'Light Codes' });
  });
});

describe('catalog — parse + trim', () => {
  it('accepts a well-formed entry and trims', () => {
    const r = parseCatalogInput({
      title: '  Seed of Light  ',
      kind: 'mandala',
      status: 'with-artist',
      year: ' 2024 ',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.title).toBe('Seed of Light');
      expect(r.value.year).toBe('2024');
    }
  });

  it('rejects a missing title, a bad kind, and a bad status', () => {
    expect(parseCatalogInput({ kind: 'mandala', status: 'with-artist' }).ok).toBe(false);
    expect(parseCatalogInput({ title: 'x', kind: 'nope', status: 'with-artist' }).ok).toBe(false);
    expect(parseCatalogInput({ title: 'x', kind: 'mandala', status: 'nope' }).ok).toBe(false);
  });

  it('requires a series name for kind other', () => {
    expect(parseCatalogInput({ title: 'x', kind: 'other', status: 'with-artist' }).ok).toBe(false);
    expect(
      parseCatalogInput({ title: 'x', kind: 'other', series: 'Light Codes', status: 'available' }).ok,
    ).toBe(true);
  });

  it('requires price to be a whole number of minor units', () => {
    expect(
      parseCatalogInput({ title: 'x', kind: 'mandala', status: 'available', price: 1800 }).ok,
    ).toBe(true);
    expect(
      parseCatalogInput({ title: 'x', kind: 'mandala', status: 'available', price: 18.5 }).ok,
    ).toBe(false);
    expect(
      parseCatalogInput({ title: 'x', kind: 'mandala', status: 'available', price: -5 }).ok,
    ).toBe(false);
  });

  it('rejects an invalid keeper email', () => {
    expect(
      parseCatalogInput({ title: 'x', kind: 'mandala', status: 'with-keeper', keeperEmail: 'nope' })
        .ok,
    ).toBe(false);
    expect(
      parseCatalogInput({
        title: 'x',
        kind: 'mandala',
        status: 'with-keeper',
        keeperEmail: 'a@b.co',
      }).ok,
    ).toBe(true);
  });
});

describe('catalog — public projection privacy', () => {
  const base: CatalogEntry = {
    id: 'MA-1',
    title: 'Seed of Light',
    kind: 'mandala',
    status: 'with-keeper',
    sigilNumber: 1,
    createdAt: '2026-07-18T00:00:00Z',
    keeperEmail: 'collector@example.com',
    notes: 'bought at the Vienna fair',
    cityId: 'lisbon-pt',
    price: 180000,
    acquireUrl: 'https://example.com/buy',
  };

  it('never exposes keeperEmail or notes', () => {
    const pub = toPublicCatalogEntry(base) as unknown as Record<string, unknown>;
    expect(pub.keeperEmail).toBeUndefined();
    expect(pub.notes).toBeUndefined();
    expect('keeperEmail' in pub).toBe(false);
    expect('notes' in pub).toBe(false);
  });

  it('hides price + acquireUrl unless the piece is available', () => {
    const withKeeper = toPublicCatalogEntry(base);
    expect(withKeeper.price).toBeUndefined();
    expect(withKeeper.acquireUrl).toBeUndefined();

    const available = toPublicCatalogEntry({ ...base, status: 'available' });
    expect(available.price).toBe(180000);
    expect(available.acquireUrl).toBe('https://example.com/buy');
  });

  it('builds a public Artwork whose sigil aligns without a sigilNumber field', () => {
    const pub = toPublicCatalogEntry({ ...base, status: 'available' });
    const art = publicCatalogEntryToArtwork(pub);
    expect(art.id).toBe('MA-1');
    expect(art.series).toBe('Mandala');
    // No sigilNumber on the public entry — the id's trailing digit carries it.
    expect(art.sigilNumber).toBeUndefined();
  });
});
