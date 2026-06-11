/**
 * GET /qr/piece/:pieceId            → /piece/:pieceId
 * GET /qr/piece/:pieceId/:edition   → /piece/:pieceId/:edition
 *
 * The QR plaque on the back of a physical piece points here, not directly at
 * the SPA route, so the destination can change without reprinting the plaque
 * (same indirection rationale as /qr/:number for the oracle deck). The QR is a
 * pointer, never a credential — it lands the visitor on the public, pre-auth
 * piece page where the artwork, story, and public history spine are visible
 * with no account. The piece-key convention is `pieceId:editionNumber ?? 0`;
 * a plaque without an edition omits the trailing segment and the page resolves
 * via the `:0` no-edition fallback.
 *
 * The catch-all `[[path]]` param captures the rest of the path after
 * /qr/piece/ as an array of segments.
 */

export function onRequest({ params }) {
  const segments = Array.isArray(params.path) ? params.path : params.path ? [params.path] : [];
  const pieceId = (segments[0] || '').trim();

  if (!pieceId) {
    return new Response('Not found', { status: 404 });
  }

  const edition = segments[1];
  const path =
    edition && /^\d+$/.test(edition)
      ? `/piece/${encodeURIComponent(pieceId)}/${edition}`
      : `/piece/${encodeURIComponent(pieceId)}`;

  return Response.redirect(`https://mandalacodes.com${path}?ref=qr`, 302);
}
