import { describe, expect, it } from 'vitest';
import { verifyCardLinkContract, type CardLinkContract } from '../../scripts/card-link-contract';

function fixture(): CardLinkContract {
  const artworks = Array.from({ length: 64 }, (_, i) => ({
    id: `UL-${200 - i}`, series: 'Universal Language', cardNumber: i + 1, coverImage: `${i + 1}_fixture`,
  }));
  const cards = artworks.map(a => ({ number: a.cardNumber, artworks: [{ id: a.id, coverImage: a.coverImage }] }));
  const canonical = (art: { coverImage: string }) => `https://mandalacodes.com/universal-language/${Number(art.coverImage.split('_')[0])}`;
  return {
    mandalaArtworks: artworks,
    artistArtworks: structuredClone(artworks),
    sourceCards: cards,
    hostedCards: structuredClone(cards),
    artistCardNumber: image => Number(image.split('_')[0]),
    companionCardUrl: canonical,
    contextualCardReturn: (art, search) => {
      const params = new URLSearchParams(search);
      return params.get('from') === 'mandalacodes' && params.get('card') === art.coverImage.split('_')[0] ? canonical(art) : null;
    },
    artDesignHref: (id, n) => `https://adrianrasmussen.com/creations/${id}?from=mandalacodes&card=${n}`,
    mandalaQR: n => Response.redirect(`https://mandalacodes.com/universal-language/${n}?ref=qr`, 302),
    artistQR: n => Response.redirect(`https://mandalacodes.com/oracle/universal-language/${n}?ref=qr`, 302),
    mandalaRedirects: '/oracle/universal-language/* /universal-language/:splat 301\n',
  };
}

describe('cross-project 64-card identity contract', () => {
  it('accepts all 64 mappings without relying on catalogue ID suffixes or archive order', async () => {
    const input = fixture();
    input.artistArtworks.reverse();
    input.hostedCards.reverse();
    await expect(verifyCardLinkContract(input)).resolves.toBeUndefined();
  });

  const mutations: [string, (input: CardLinkContract) => void, RegExp][] = [
    ['missing artist artwork', i => { i.artistArtworks.pop(); }, /exactly 64 UL artworks/],
    ['duplicated catalogue ID', i => { i.artistArtworks[0].id = i.artistArtworks[1].id; }, /duplicate artwork IDs/],
    ['duplicated image', i => { i.artistArtworks[0].coverImage = i.artistArtworks[1].coverImage; }, /duplicate artwork images/],
    ['missing card number', i => { i.mandalaArtworks[0].cardNumber = 65; }, /cover 1–64 exactly once/],
    ['swapped catalogue identities', i => {
      [i.artistArtworks[0].id, i.artistArtworks[1].id] = [i.artistArtworks[1].id, i.artistArtworks[0].id];
    }, /image differs between projects/],
    ['swapped source binding', i => { i.sourceCards[0].artworks = i.sourceCards[1].artworks; }, /Source card 1: artwork mismatch/],
    ['swapped hosted binding', i => { i.hostedCards[0].artworks = i.hostedCards[1].artworks; }, /Hosted card 1: artwork mismatch/],
    ['hosted card omitted', i => { i.hostedCards.pop(); }, /Hosted: expected cards/],
    ['wrong companion destination', i => { i.companionCardUrl = () => 'https://mandalacodes.com/universal-language/2'; }, /companion destination mismatch/],
    ['wrong artwork route', i => { i.artDesignHref = () => 'https://adrianrasmussen.com/creations/WRONG'; }, /artwork route mismatch/],
    ['wrong return context', i => { i.artDesignHref = id => `https://adrianrasmussen.com/creations/${id}?from=mandalacodes&card=2`; }, /round-trip context mismatch/],
    ['wrong Mandala QR', i => { i.mandalaQR = () => Response.redirect('https://mandalacodes.com/universal-language/2?ref=qr', 302); }, /Mandala QR 1: wrong destination/],
    ['wrong Artist QR', i => { i.artistQR = () => Response.redirect('https://mandalacodes.com/oracle/universal-language/2?ref=qr', 302); }, /Artist QR 1: wrong destination/],
    ['missing legacy redirect', i => { i.mandalaRedirects = ''; }, /legacy card redirect/],
  ];
  for (const [name, mutate, expected] of mutations) {
    it(`rejects ${name}`, async () => {
      const input = fixture();
      mutate(input);
      await expect(verifyCardLinkContract(input)).rejects.toThrow(expected);
    });
  }
});
