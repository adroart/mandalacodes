import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { lightCodes, lightCodeByNumber, lightCodeImagePath } from '../../data/lightCodes.ts';
import { onRequest as hub } from '../../functions/light-codes/index.js';
import { onRequest as artwork } from '../../functions/light-codes/[[path]].js';

const imageHash = '239730c93510532b8834f136957e1df8fa46513128475dda8c799ae9e95dd39b';
const context = (path, file, params = {}) => ({
  request: new Request(`https://mandalacodes.com${path}`), params,
  env: { ASSETS: { fetch: async (request) => {
    const requested = new URL(request.url).pathname;
    return new Response(requested === file ? `<div data-editorial-route="${path}">Artwork</div>` : 'SPA shell');
  } } },
});

test('68 numbered artworks have complete bundled images and source categories', async () => {
  assert.equal(lightCodes.length, 68);
  const categories = { 'frequency-foundation': 0, 'embodied-vibration': 0, 'resonant-formations': 0 };
  const hash = createHash('sha256');
  for (const [index, card] of lightCodes.entries()) {
    assert.equal(card.number, index + 1);
    assert.ok(card.category in categories);
    categories[card.category]++;
    assert.equal(lightCodeByNumber(String(card.number))?.number, card.number);
    const bytes = await readFile(new URL(`../../public${lightCodeImagePath(card.number)}`, import.meta.url));
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    hash.update(bytes);
  }
  assert.deepEqual(categories, { 'frequency-foundation': 14, 'embodied-vibration': 26, 'resonant-formations': 28 });
  assert.equal(hash.digest('hex'), imageHash);
  assert.equal(lightCodeByNumber('09'), undefined);
  assert.equal(lightCodeByNumber('69'), undefined);
});

test('Light Codes HTTP routes use prerendered pages and reject unknown or missing artwork', async () => {
  assert.equal((await hub(context('/light-codes', '/light-codes/index.html'))).status, 200);
  assert.equal((await artwork(context('/light-codes/1', '/light-codes/1/index.html', { path: ['1'] }))).status, 200);
  assert.equal((await artwork(context('/light-codes/68', '/light-codes/68/index.html', { path: ['68'] }))).status, 200);
  assert.equal((await artwork(context('/light-codes/1', '/wrong-file', { path: ['1'] }))).status, 503);
  for (const number of ['0', '69', '01', 'x']) {
    assert.equal((await artwork(context(`/light-codes/${number}`, '/index.html', { path: [number] }))).status, 404);
  }
});
