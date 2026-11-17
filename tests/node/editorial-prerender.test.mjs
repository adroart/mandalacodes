import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest as about } from '../../functions/about.js';
import { onRequest as artists } from '../../functions/artists/index.js';
import { onRequest as artist } from '../../functions/artists/[[path]].js';

const html = (path) => `<html><div id="root" data-editorial-route="${path}"><h1>${path}</h1></div></html>`;
const context = (path, file, params = {}) => ({
  request: new Request(`https://mandalacodes.com${path}`),
  params,
  env: { ASSETS: { fetch: async (request) => {
    const requested = new URL(request.url).pathname;
    return new Response(requested === file ? html(path.replace(/\/$/, '')) : '<html>SPA shell</html>', { status: 200 });
  } } },
});

test('known editorial routes serve their matching prerendered HTML', async () => {
  const aboutResponse = await about(context('/about', '/about/index.html'));
  const hubResponse = await artists(context('/artists', '/artists/index.html'));
  const hubFromCatchall = await artist(context('/artists', '/artists/index.html', { path: [] }));
  const featureResponse = await artist(context('/artists/adrian-rasmussen', '/artists/adrian-rasmussen/index.html', { path: ['adrian-rasmussen'] }));
  for (const response of [aboutResponse, hubResponse, hubFromCatchall, featureResponse]) {
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(await response.text(), /data-editorial-route=/);
  }
});

test('a missing known artifact cannot turn into a successful SPA shell', async () => {
  const response = await artist(context('/artists/adrian-rasmussen', '/wrong-file', { path: ['adrian-rasmussen'] }));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /SPA shell/);
});

test('unknown artist paths return HTTP 404', async () => {
  for (const path of [['unknown'], ['unknown', 'deep']]) {
    const response = await artist(context(`/artists/${path.join('/')}`, '/index.html', { path }));
    assert.equal(response.status, 404);
  }
});
