// utils/cloudinary.ts
// Centralized Cloudinary image URL builder.
// If we ever migrate to Cloudflare Images, only this file changes.

const CLOUD_NAME = 'dobbosnda';
const BASE = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload`;

export interface ImgOptions {
  /** Width in pixels. Omit for original size. */
  w?: number;
  /** Height in pixels. Omit for proportional scaling. */
  h?: number;
  /** Crop mode. Default: 'fill' (covers the area). Use 'fit' to contain. */
  crop?: 'fill' | 'fit' | 'scale' | 'thumb';
  /** Image quality. Default: 'auto' (Cloudinary optimizes). */
  quality?: number | 'auto';
  /** Gravity for crop. Default: 'auto' (AI-based smart crop). */
  gravity?: 'auto' | 'center' | 'face' | 'faces';
  /** Output format. Default: 'auto'. Use 'webp' or 'png' for images with transparency. */
  format?: 'auto' | 'webp' | 'png' | 'jpg';
  /** Remove the image background while preserving the original canvas. */
  backgroundRemoval?: boolean;
}

/**
 * Build a Cloudinary delivery URL with automatic format negotiation
 * and optional resizing.
 *
 * @param publicId - The image's Public ID in Cloudinary
 *                   (e.g., "adrian-website/creations/mandala/seed-of-life")
 * @param opts     - Transformation options
 * @returns        Full CDN URL ready for an <img> src
 *
 * @example
 * img('adrian-website/creations/mandala/seed-of-life', { w: 800 })
 * // => "https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_800,c_fill,g_auto/adrian-website/creations/mandala/seed-of-life"
 */
// Cloudinary only accepts a gravity parameter alongside these crop modes.
// Pairing g_ with 'fit' or 'scale' makes Cloudinary reject the whole
// transformation (HTTP 400 "Auto gravity can only be used with crop..."),
// which the browser then can't render: the <img> falls back to its alt
// text instead of the artwork.
const CROPS_SUPPORTING_GRAVITY = new Set(['fill', 'thumb', 'lfill', 'fill_pad', 'auto', 'auto_pad']);

export function img(publicId: string, opts: ImgOptions = {}): string {
  const transforms: string[] = [
    `f_${opts.format ?? 'auto'}`,
    `q_${opts.quality ?? 'auto'}`,
  ];

  if (opts.w) transforms.push(`w_${opts.w}`);
  if (opts.h) transforms.push(`h_${opts.h}`);
  if (opts.w || opts.h) {
    const crop = opts.crop ?? 'fill';
    transforms.push(`c_${crop}`);
    if (CROPS_SUPPORTING_GRAVITY.has(crop)) {
      transforms.push(`g_${opts.gravity ?? 'auto'}`);
    }
  }

  const effect = opts.backgroundRemoval ? 'e_background_removal/' : '';
  return `${BASE}/${effect}${transforms.join(',')}/${publicId}`;
}

/**
 * Generate a srcset string for responsive images.
 *
 * @param publicId - Cloudinary Public ID
 * @param widths   - Array of widths to generate (default: [400, 800, 1200, 1600])
 * @returns        srcset attribute value
 *
 * @example
 * <img src={img(id, { w: 800 })} srcSet={srcset(id)} sizes="(max-width: 768px) 100vw, 50vw" />
 */
export function srcset(
  publicId: string,
  widths: number[] = [400, 800, 1200, 1600],
): string {
  return widths
    .map((w) => `${img(publicId, { w })} ${w}w`)
    .join(', ');
}
