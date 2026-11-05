/**
 * GET /qr/:number
 *
 * Redirects a physical QR code scan to the card reading page.
 * This indirection means the destination URL can change any time without
 * reprinting physical plaques — just update this file and redeploy.
 *
 * Examples:
 *   /qr/1  →  /universal-language/1?ref=qr
 *   /qr/41 →  /universal-language/41?ref=qr
 */

export function onRequest({ params }) {
  if (params.number === 'oracle') {
    return Response.redirect('https://mandalacodes.com/?ref=qr', 302);
  }

  // Accept the complete digit-only plaque number, including legacy zero padding.
  // parseInt would silently turn malformed values such as "1junk" into card 1.
  const number = params.number;
  const n = Number(number);

  if (typeof number !== 'string' || !number.length || /[^0-9]/.test(number)
    || !Number.isInteger(n) || n < 1 || n > 64) {
    return new Response('Not found', { status: 404 });
  }

  return Response.redirect(
    `https://mandalacodes.com/universal-language/${n}?ref=qr`,
    302,
  );
}
