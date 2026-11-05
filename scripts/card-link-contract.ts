/** Offline identity join. Keep editorial titles and descriptions out of the contract. */
import assert from 'node:assert/strict';

export interface LinkArtwork {
  id: string;
  series?: string;
  coverImage: string;
  cardNumber?: number;
}
export interface LinkedCard {
  number: number;
  artworks: { id: string; coverImage?: string }[];
}
export interface CardLinkContract {
  mandalaArtworks: LinkArtwork[];
  artistArtworks: LinkArtwork[];
  sourceCards: LinkedCard[];
  hostedCards: LinkedCard[];
  artistCardNumber: (coverImage: string) => number | null;
  companionCardUrl: (art: LinkArtwork) => string | null;
  contextualCardReturn: (art: LinkArtwork, search: string) => string | null;
  artDesignHref: (id: string, number: number) => string;
  mandalaQR: (number: string) => Response | Promise<Response>;
  artistQR: (number: string) => Response | Promise<Response>;
  mandalaRedirects: string;
}

const numbers = Array.from({ length: 64 }, (_, i) => i + 1);

export async function verifyCardLinkContract(input: CardLinkContract): Promise<void> {
  // Artist QR plaques retain their legacy path; the Mandala compatibility rule
  // must still deliver that path to the canonical reader.
  assert.match(input.mandalaRedirects, /^\/oracle\/universal-language\/\*\s+\/universal-language\/:splat\s+301\s*$/m,
    'Mandala legacy card redirect must reach the canonical reader');
  const mandala = input.mandalaArtworks.filter(a => a.series === 'Universal Language');
  const artist = input.artistArtworks.filter(a => a.series === 'Universal Language');
  for (const [label, artworks] of [['Mandala', mandala], ['Artist', artist]] as const) {
    assert.equal(artworks.length, 64, `${label}: expected exactly 64 UL artworks`);
    assert.equal(new Set(artworks.map(a => a.id)).size, 64, `${label}: duplicate artwork IDs`);
    assert.equal(new Set(artworks.map(a => a.coverImage)).size, 64, `${label}: duplicate artwork images`);
  }
  assert.deepEqual(mandala.map(a => a.cardNumber).sort((a, b) => a! - b!), numbers,
    'Mandala cardNumber must cover 1–64 exactly once');
  assert.deepEqual(artist.map(a => input.artistCardNumber(a.coverImage)).sort((a, b) => a! - b!), numbers,
    'Artist image identity must cover 1–64 exactly once');

  for (const [label, cards] of [['Source', input.sourceCards], ['Hosted', input.hostedCards]] as const) {
    assert.deepEqual(cards.map(c => c.number).sort((a, b) => a - b), numbers, `${label}: expected cards 1–64 exactly once`);
    for (const card of cards) {
      const piece = mandala.find(a => a.cardNumber === card.number)!;
      assert.deepEqual(card.artworks.map(a => ({ id: a.id, coverImage: a.coverImage })),
        [{ id: piece.id, coverImage: piece.coverImage }], `${label} card ${card.number}: artwork mismatch`);
    }
  }

  for (const piece of mandala) {
    const n = piece.cardNumber!;
    const counterpart = artist.find(a => a.id === piece.id);
    assert.ok(counterpart, `Card ${n}: Artist artwork ${piece.id} missing`);
    assert.equal(counterpart.coverImage, piece.coverImage, `Card ${n}: artwork image differs between projects`);
    assert.equal(input.artistCardNumber(counterpart.coverImage), n, `Card ${n}: Artist image resolves to a different card`);
    const canonical = `https://mandalacodes.com/universal-language/${n}`;
    assert.equal(input.companionCardUrl(counterpart), canonical, `Card ${n}: companion destination mismatch`);
    const design = new URL(input.artDesignHref(piece.id, n));
    assert.equal(design.origin, 'https://adrianrasmussen.com', `Card ${n}: artwork host mismatch`);
    assert.equal(design.pathname, `/creations/${encodeURIComponent(counterpart.id)}`, `Card ${n}: artwork route mismatch`);
    assert.equal(input.contextualCardReturn(counterpart, design.search), canonical, `Card ${n}: round-trip context mismatch`);
    for (const [label, handler, path] of [
      ['Mandala', input.mandalaQR, `/universal-language/${n}`],
      ['Artist', input.artistQR, `/oracle/universal-language/${n}`],
    ] as const) {
      const response = await handler(String(n));
      assert.equal(response.status, 302, `${label} QR ${n}: expected temporary redirect`);
      assert.equal(response.headers.get('Location'), `https://mandalacodes.com${path}?ref=qr`, `${label} QR ${n}: wrong destination`);
    }
  }
}
