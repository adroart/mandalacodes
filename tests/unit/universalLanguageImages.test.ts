import { describe, expect, it } from 'vitest';
import { img } from '../../utils/cloudinary';
import { ulCardImageUrl } from '../../utils/universalLanguage';

describe('Universal Language image treatment', () => {
  it('can request Cloudinary background removal without changing the canvas', () => {
    expect(img('22_lldo5g', {
      w: 640,
      h: 640,
      crop: 'fill',
      gravity: 'center',
      format: 'png',
      backgroundRemoval: true,
    })).toBe(
      'https://res.cloudinary.com/dobbosnda/image/upload/e_background_removal/f_png,q_auto,w_640,h_640,c_fill,g_center/22_lldo5g',
    );
  });

  it('uses the transparent full-image treatment for card 22', () => {
    const url = ulCardImageUrl(22, 640);

    expect(url).toContain('/e_background_removal/f_png,q_auto,w_640,h_640,c_fill,g_center/22_lldo5g');
  });

  it('uses the transparent full-image treatment for card 6', () => {
    const url = ulCardImageUrl(6, 640);

    expect(url).toContain('/e_background_removal/f_png,q_auto,w_640,h_640,c_fill,g_center/6_');
  });

  it('leaves unaffected cards on the normal optimized delivery path', () => {
    const url = ulCardImageUrl(21, 640);

    expect(url).toContain('/f_webp,q_auto,w_640,h_640,c_fill,g_center/21_');
    expect(url).not.toContain('e_background_removal');
  });
});
