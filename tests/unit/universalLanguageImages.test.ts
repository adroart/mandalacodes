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

  it.each([6, 9, 19, 22, 32, 35, 39, 47, 51])(
    'uses the transparent full-image treatment for non-square card %i',
    (number) => {
      const url = ulCardImageUrl(number, 640);

      expect(url).toContain(`/e_background_removal/f_png,q_auto,w_640,h_640,c_fill,g_center/${number}_`);
    },
  );

  it.each([18, 21, 38, 41, 50, 53])(
    'leaves square card %i on the normal optimized delivery path',
    (number) => {
      const url = ulCardImageUrl(number, 640);

      expect(url).toContain(`/f_webp,q_auto,w_640,h_640,c_fill,g_center/${number}_`);
      expect(url).not.toContain('e_background_removal');
    },
  );
});
