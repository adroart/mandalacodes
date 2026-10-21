import { describe, expect, it } from 'vitest';
import { img } from '../../utils/media';
import { ulCardImageUrl } from '../../utils/universalLanguage';

describe('Universal Language image treatment', () => {
  it('can request Cloudflare background removal without changing the canvas', () => {
    expect(img('22_lldo5g', {
      w: 640,
      h: 640,
      crop: 'fill',
      gravity: 'center',
      format: 'png',
      backgroundRemoval: true,
    })).toBe(
      '/media/image/22_lldo5g?w=640&h=640&crop=fill&gravity=center&format=png&segment=foreground',
    );
  });

  it('shows card 22 as its original photo, never through background removal', () => {
    const url = ulCardImageUrl(22, 640);

    expect(url).toContain('/media/image/22_lldo5g?');
    expect(url).toContain('format=webp');
    expect(url).not.toContain('segment=foreground');
  });

  it('leaves unaffected cards on the normal optimized delivery path', () => {
    const url = ulCardImageUrl(21, 640);

    expect(url).toContain('/media/image/21_');
    expect(url).toContain('format=webp');
    expect(url).not.toContain('segment=foreground');
  });
});
