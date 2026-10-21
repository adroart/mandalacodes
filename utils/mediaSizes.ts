/**
 * The only sizes the media worker will resize to. A width outside this list is
 * dropped by the worker and the full-size original comes back instead: the deck
 * asked for 320 and got a 1512 px, 590 KB plate per tile, seventeen times the
 * weight of the 360 one (measured 2026-10-21). Shared by the worker, which
 * enforces it, and by img(), which rounds every request onto it.
 */
export const MEDIA_WIDTHS = [80, 150, 160, 200, 240, 280, 360, 400, 560, 600, 640, 675, 700, 720, 800, 900, 1100, 1200, 1280, 1400, 1600, 1800];

export const MEDIA_SIZE_PAIRS = new Set([
  '80x80', '150x150', '160x160', '200x200', '240x240', '280x280',
  '360x360', '400x400', '560x560', '600x600', '640x640', '700x700',
  '720x720', '800x800', '900x900', '1100x1100', '1200x1200', '1600x1600',
  '1200x400', '1200x630', '1200x675', '1200x800', '1600x1200', '800x900', '900x1100',
]);
