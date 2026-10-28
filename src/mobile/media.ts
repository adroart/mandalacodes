import { FULL_ARCHIVE } from '../../data/mockData';
import type { ImgOptions } from '../../utils/media';
const plates = new Map(FULL_ARCHIVE.filter(a => a.series === 'Universal Language' && a.cardNumber).map(a => [a.coverImage, a.cardNumber]));
export function img(id: string, opts: ImgOptions = {}): string {
  const number = plates.get(id);
  if (number) return `/oracle-art/${number}.webp`;
  const params = new URLSearchParams({ w: String(opts.w ?? 800) });
  return `https://mandalacodes.com/media/image/${id.split('/').map(encodeURIComponent).join('/')}?${params}`;
}
export function srcset(id: string, widths = [400, 800, 1200, 1600]): string {
  return widths.map(w => `${img(id, { w })} ${w}w`).join(', ');
}
