/** Serve the exact prerendered asset; missing output is a build failure, never a SPA shell. */
export async function serveEditorialPage(context, path) {
  const url = new URL(context.request.url);
  url.pathname = `${path}/index.html`;
  url.search = '';
  const asset = await context.env.ASSETS.fetch(new Request(url.toString(), { method: 'GET' }));
  if (!asset.ok) return new Response('Editorial page unavailable', { status: 503 });
  const html = await asset.text();
  if (!html.includes(`data-editorial-route="${path}"`)) {
    return new Response('Editorial page unavailable', { status: 503 });
  }
  return new Response(html, { headers: { 'content-type': 'text/html;charset=UTF-8' } });
}

export async function serveEditorialNotFound(context) {
  const url = new URL(context.request.url);
  url.pathname = '/index.html';
  url.search = '';
  const shell = await context.env.ASSETS.fetch(new Request(url.toString(), { method: 'GET' }));
  if (!shell.ok) return new Response('Page not found', { status: 404 });
  return new Response(await shell.text(), { status: 404, headers: { 'content-type': 'text/html;charset=UTF-8' } });
}
