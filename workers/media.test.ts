import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { variantObjectKey } from './media';

/**
 * Artwork failed on first load because the media Worker resized every image
 * on demand, per data center, and a page of artwork at once pushed it past its
 * resource limits (Cloudflare error 1102, measured 2026-09-24). The Worker now
 * stores each variant in R2 the first time it makes one; these tests hold it
 * to resizing a given variant once, and to never caching a failure.
 */

const ORIGIN = 'https://mandalacodes.com';

function fakeEnv() {
  const store = new Map<string, { bytes: ArrayBuffer; contentType?: string }>();
  store.set('image/2_kvndyq', { bytes: new Uint8Array([1, 2, 3]).buffer, contentType: 'image/png' });
  const bodyOf = (key: string) => {
    const entry = store.get(key);
    if (!entry) return null;
    return {
      body: new Response(entry.bytes).body,
      httpEtag: '"etag"',
      writeHttpMetadata: (headers: Headers) => {
        if (entry.contentType) headers.set('Content-Type', entry.contentType);
      },
    };
  };
  const transforms = { count: 0, ok: true };
  const env = {
    MEDIA_BUCKET: {
      get: vi.fn(async (key: string) => bodyOf(key)),
      put: vi.fn(async (key: string, bytes: ArrayBuffer, opts?: { httpMetadata?: { contentType?: string } }) => {
        store.set(key, { bytes, contentType: opts?.httpMetadata?.contentType });
      }),
    },
    IMAGES: {
      input: () => ({
        transform: () => ({
          output: async ({ format }: { format: string }) => {
            transforms.count += 1;
            return {
              response: () =>
                transforms.ok
                  ? new Response(new Uint8Array([9, 9]), { headers: { 'Content-Type': format } })
                  : new Response('boom', { status: 500 }),
            };
          },
        }),
      }),
    },
  };
  return { env, store, transforms };
}

function fakeCtx() {
  const pending: Promise<unknown>[] = [];
  return { ctx: { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException() {} }, settle: () => Promise.all(pending) };
}

const cachePut = vi.fn(async () => undefined);
beforeEach(() => {
  cachePut.mockClear();
  // A cold data center: the edge cache never has anything.
  (globalThis as unknown as { caches: unknown }).caches = { default: { match: async () => undefined, put: cachePut } };
});

const request = (query: string) => new Request(`${ORIGIN}/media/image/2_kvndyq?${query}`);

describe('the media Worker resizes a variant once, not once per data center', () => {
  it('stores a new variant in R2 and serves the next cold request from there', async () => {
    const { env, store, transforms } = fakeEnv();
    const first = fakeCtx();
    const res1 = await worker.fetch(request('w=400&h=400&format=webp'), env as never, first.ctx as never);
    expect(res1.status).toBe(200);
    await first.settle();
    expect(transforms.count).toBe(1);
    expect([...store.keys()].some((k) => k.startsWith('_variants/image/2_kvndyq/'))).toBe(true);

    const second = fakeCtx();
    const res2 = await worker.fetch(request('w=400&h=400&format=webp'), env as never, second.ctx as never);
    expect(res2.status).toBe(200);
    expect(res2.headers.get('Content-Type')).toBe('image/webp');
    expect(new Uint8Array(await res2.arrayBuffer())).toEqual(new Uint8Array([9, 9]));
    expect(transforms.count).toBe(1);
  });

  it('ignores the retry marker, so a retried image lands on the stored variant', async () => {
    const { env, transforms } = fakeEnv();
    const first = fakeCtx();
    await worker.fetch(request('w=400&h=400&format=webp'), env as never, first.ctx as never);
    await first.settle();
    const retry = fakeCtx();
    await worker.fetch(request('w=400&h=400&format=webp&retry=1'), env as never, retry.ctx as never);
    expect(transforms.count).toBe(1);
  });

  it('never stores or caches a failed resize', async () => {
    const { env, store, transforms } = fakeEnv();
    transforms.ok = false;
    const { ctx, settle } = fakeCtx();
    const res = await worker.fetch(request('w=400&h=400&format=webp'), env as never, ctx as never);
    await settle();
    expect(res.status).toBe(503);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(cachePut).not.toHaveBeenCalled();
    expect([...store.keys()].some((k) => k.startsWith('_variants/'))).toBe(false);
  });
});

describe('variant storage keys', () => {
  it('do not depend on parameter order and carry no raw slash from the format', () => {
    const a = new URL(`${ORIGIN}/x?w=400&format=image/webp&fit=cover`);
    const b = new URL(`${ORIGIN}/x?fit=cover&w=400&format=image/webp`);
    expect(variantObjectKey('image/1', a)).toBe(variantObjectKey('image/1', b));
    expect(variantObjectKey('image/1', a).split('/').pop()).toContain('format=image_webp');
  });
});
