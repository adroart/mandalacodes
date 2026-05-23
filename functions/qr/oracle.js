/**
 * GET /qr/oracle
 *
 * Redirects the gateway QR plaque to the Mandala Codes home / deck entrance.
 */

export function onRequest() {
  return Response.redirect('https://mandalacodes.com/?ref=qr', 302);
}
