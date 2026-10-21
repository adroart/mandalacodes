import { MEDIA_SIZE_PAIRS, MEDIA_WIDTHS } from './mediaSizes';

const MEDIA_BASE = '/media/image';

export interface ImgOptions {
  w?: number;
  h?: number;
  crop?: 'fill' | 'fit' | 'scale' | 'thumb';
  quality?: number | 'auto';
  gravity?: 'auto' | 'center' | 'face' | 'faces';
  format?: 'auto' | 'webp' | 'png' | 'jpg';
  backgroundRemoval?: boolean;
}

/**
 * The smallest size the worker serves that is at least `w`, so a request never
 * falls off the worker's list and comes back full size. A square request rounds
 * to a square the worker also serves.
 */
export function servedWidth(w: number, square = false): number {
  const served = MEDIA_WIDTHS.filter((s) => !square || MEDIA_SIZE_PAIRS.has(`${s}x${s}`));
  return served.find((s) => s >= w) ?? served[served.length - 1];
}

export function img(publicId: string, opts: ImgOptions = {}): string {
  const path = publicId.split('/').map(encodeURIComponent).join('/');
  const params = new URLSearchParams();
  const square = Boolean(opts.w && opts.h === opts.w);
  const w = opts.w ? servedWidth(opts.w, square) : undefined;
  const h = square ? w : opts.h;
  if (w) params.set('w', String(w));
  if (h) params.set('h', String(h));
  if (opts.crop) params.set('crop', opts.crop);
  if (opts.quality !== undefined) params.set('q', String(opts.quality));
  if (opts.gravity) params.set('gravity', opts.gravity);
  if (opts.format && opts.format !== 'auto') params.set('format', opts.format);
  if (opts.backgroundRemoval) params.set('segment', 'foreground');
  const query = params.toString();
  return `${MEDIA_BASE}/${path}${query ? `?${query}` : ''}`;
}

export function srcset(
  publicId: string,
  widths: number[] = [400, 800, 1200, 1600],
): string {
  return widths.map((w) => `${img(publicId, { w })} ${w}w`).join(', ');
}
