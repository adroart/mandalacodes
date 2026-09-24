/**
 * Retry an artwork image once when it fails to load.
 *
 * The media Worker resizes artwork on demand. In a data center whose edge
 * cache is cold, a page that asks for many pieces at once can push the Worker
 * past its resource limits, and a handful of images come back as Cloudflare's
 * error 1102 page (measured 2026-09-24: 5 to 12 of 64 fresh sizes failed when
 * requested together; the same images loaded when requested again). The
 * visitor then sees the alt text where the artwork should be.
 *
 * The Worker now stores every variant it makes, so this should become rare,
 * but a variant's very first request can still land in the crowd. One delayed
 * retry per image turns that into a short wait instead of a broken card. The
 * retry adds `retry=1`, which the Worker ignores when it builds its cache and
 * storage keys, so the retry lands on the same stored variant.
 */

const RETRY_PARAM = 'retry';
const RETRY_DELAY_MS = 1500;

/** The same media URL with the retry marker, or null when it is not artwork or was already retried. */
export function retryMediaUrl(src: string, origin: string): string | null {
  let url: URL;
  try {
    url = new URL(src, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin || !url.pathname.startsWith('/media/')) return null;
  if (url.searchParams.has(RETRY_PARAM)) return null;
  url.searchParams.set(RETRY_PARAM, '1');
  return url.href;
}

/** A srcset with every media candidate marked for retry, or null when nothing in it qualifies. */
export function retryMediaSrcset(srcset: string, origin: string): string | null {
  let changed = false;
  const rewritten = srcset
    .split(',')
    .map((candidate) => {
      const [src, ...descriptor] = candidate.trim().split(/\s+/);
      const retried = src ? retryMediaUrl(src, origin) : null;
      if (!retried) return candidate.trim();
      changed = true;
      return [retried, ...descriptor].join(' ');
    })
    .join(', ');
  return changed ? rewritten : null;
}

export function installMediaRetry(): void {
  // Image errors do not bubble, so listen in the capture phase.
  document.addEventListener(
    'error',
    (event) => {
      const img = event.target;
      if (!(img instanceof HTMLImageElement)) return;
      const src = retryMediaUrl(img.currentSrc || img.src, location.origin);
      if (!src) return;
      const srcset = img.srcset ? retryMediaSrcset(img.srcset, location.origin) : null;
      window.setTimeout(() => {
        if (!img.isConnected) return;
        if (srcset) img.srcset = srcset;
        img.src = retryMediaUrl(img.src, location.origin) ?? src;
      }, RETRY_DELAY_MS);
    },
    true,
  );
}
