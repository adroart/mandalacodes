import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => vi.unstubAllGlobals());
it('reports a failed city download and retries instead of caching no matches', async () => {
  vi.resetModules();
  const fetch = vi.fn().mockResolvedValueOnce(new Response('', {status:503})).mockResolvedValueOnce(Response.json([{name:'Denpasar',country:'Indonesia',cc:'ID',lat:-8,lng:115,tz:'Asia/Makassar'}]));
  vi.stubGlobal('fetch',fetch);
  const { searchPlaces } = await import('../../lib/astrology/places');
  await expect(searchPlaces('Denpasar')).rejects.toThrow('City search is unavailable');
  await expect(searchPlaces('Denpasar')).resolves.toHaveLength(1);
  expect(fetch).toHaveBeenCalledTimes(2);
});
