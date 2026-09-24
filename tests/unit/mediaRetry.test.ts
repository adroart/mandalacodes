import { describe, expect, it } from 'vitest';
import { retryMediaSrcset, retryMediaUrl } from '../../src/lib/mediaRetry';

const ORIGIN = 'https://mandalacodes.com';

describe('the page retries a failed artwork image once', () => {
  it('marks a media URL for retry, and only once', () => {
    const once = retryMediaUrl('/media/image/2_kvndyq?w=1100', ORIGIN);
    expect(once).toBe(`${ORIGIN}/media/image/2_kvndyq?w=1100&retry=1`);
    expect(retryMediaUrl(once!, ORIGIN)).toBeNull();
  });

  it('leaves images that are not artwork alone', () => {
    expect(retryMediaUrl('/assets/logo.png', ORIGIN)).toBeNull();
    expect(retryMediaUrl('https://example.com/media/x.png', ORIGIN)).toBeNull();
  });

  it('rewrites every media candidate in a srcset and keeps the descriptors', () => {
    expect(retryMediaSrcset('/media/a?w=400 400w, /media/a?w=800 800w', ORIGIN)).toBe(
      `${ORIGIN}/media/a?w=400&retry=1 400w, ${ORIGIN}/media/a?w=800&retry=1 800w`,
    );
    expect(retryMediaSrcset('/assets/a.png 1x', ORIGIN)).toBeNull();
  });
});
