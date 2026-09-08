/**
 * Cloudflare Pages Function — /universal-language/[number]
 *
 * `public/_routes.json` sends every request under /universal-language/* here
 * first, so this decides what gets served, not the static-asset router.
 *
 * `npm run build` prerenders a full static page per card (see
 * scripts/prerender-cards.ts) with correct title, canonical, description,
 * Open Graph / Twitter tags, and a JSON-LD CreativeWork already baked in —
 * that's what makes the card SEO-findable and gives crawlers/social bots a
 * real page with no JS required. For a known card number this function just
 * serves that prerendered file straight from the asset bundle. It falls back
 * to the plain SPA shell only for a card number outside 1-64 (React renders
 * the "not yet arrived" state) or if the prerendered file is somehow missing
 * (defensive — should never happen when the build ran).
 */

export async function onRequest(context) {
  const { params, env, request } = context;
  const num = parseInt(params.number, 10);

  // Known card (1-64) — serve the file scripts/prerender-cards.ts wrote at
  // build time. It already carries the correct title, canonical, meta
  // description, Open Graph / Twitter tags, and JSON-LD, and boots the SPA
  // with the exact same script/link tags as dist/index.html.
  if (Number.isInteger(num) && num >= 1 && num <= 64) {
    const prerenderedUrl = new URL(request.url);
    prerenderedUrl.pathname = `/universal-language/${num}/index.html`;
    prerenderedUrl.search = '';
    const prerendered = await env.ASSETS.fetch(new Request(prerenderedUrl.toString(), { method: 'GET' }));
    if (prerendered.ok) {
      return new Response(await prerendered.text(), {
        headers: { 'content-type': 'text/html;charset=UTF-8' },
      });
    }
    // Defensive fallback — the prerendered file should always exist for a
    // number in range once the build ran. Fall through to the plain shell
    // rather than error the request.
  }

  // Unknown card, or the defensive fallback above — plain shell, React
  // handles the "not yet arrived" state.
  const indexUrl = new URL(request.url);
  indexUrl.pathname = '/index.html';
  indexUrl.search = '';
  const shell = await env.ASSETS.fetch(new Request(indexUrl.toString(), { method: 'GET' }));
  return new Response(await shell.text(), {
    headers: { 'content-type': 'text/html;charset=UTF-8' },
  });
}
