import { describe, expect, it } from 'vitest';
import { img } from '../../utils/media';
import { MEDIA_SIZE_PAIRS, MEDIA_WIDTHS } from '../../utils/mediaSizes';
import { ulCardHeroSrcset, ulCardImageUrl } from '../../utils/universalLanguage';

function size(url: string) {
  const params = new URL(url, 'https://mandalacodes.com').searchParams;
  return { w: params.get('w'), h: params.get('h') };
}

describe('every image request lands on a size the media worker serves', () => {
  it('rounds the deck tile, the cast plate and the card image up to served squares', () => {
    expect(size(ulCardImageUrl(22, 320))).toEqual({ w: '360', h: '360' });
    expect(size(ulCardImageUrl(22, 760))).toEqual({ w: '800', h: '800' });
    expect(size(ulCardImageUrl(22, 1080))).toEqual({ w: '1100', h: '1100' });
  });

  it('leaves a size the worker already serves alone', () => {
    expect(size(ulCardImageUrl(22, 1100))).toEqual({ w: '1100', h: '1100' });
    expect(size(img('48_ttflpq', { w: 1200, h: 630 }))).toEqual({ w: '1200', h: '630' });
  });

  it('never asks for a width or square the worker would drop', () => {
    for (let n = 1; n <= 2000; n++) {
      const { w } = size(img('x', { w: n }));
      expect(MEDIA_WIDTHS).toContain(Number(w));
      const square = size(img('x', { w: n, h: n }));
      expect(MEDIA_SIZE_PAIRS.has(`${square.w}x${square.h}`)).toBe(true);
    }
  });
});

describe('the card reading artwork is offered at every size it can show at', () => {
  it('lists served squares up to the hero plate, so a laptop never fetches 1100 for a 545 px slot', () => {
    const widths = ulCardHeroSrcset(22).split(', ').map((candidate) => {
      const [url, descriptor] = candidate.split(' ');
      const { w, h } = size(url);
      expect(w).toBe(h);
      expect(`${w}w`).toBe(descriptor);
      return Number(w);
    });
    expect(widths).toEqual([400, 640, 800, 1100]);
  });
});
