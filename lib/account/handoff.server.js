export const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64 = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
export const random = () => b64(crypto.getRandomValues(new Uint8Array(32)));
export const sha = async value => b64(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
export const validState = value => typeof value === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(value);
export const validChallenge = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
export const headers = () => new Headers({'Cache-Control':'no-store', 'Referrer-Policy':'no-referrer', 'X-Content-Type-Options':'nosniff'});
export function copyCookies(source, destination) {
  const cookies = source?.getSetCookie?.() ?? source?.getAll?.('Set-Cookie') ?? [];
  if (!cookies.length && source?.has('set-cookie')) throw new Error('Cookie forwarding is unavailable');
  for (const cookie of cookies) destination.append('Set-Cookie',cookie);
  return cookies.length;
}

// Both first-party handoffs start Google through the same Better Auth provider.
// Carry its state cookies onto the redirect unchanged for the browser callback.
export async function googleRedirectHeaders(auth, request, callbackURL, errorCallbackURL) {
  const result = await auth.api.signInSocial({
    headers: request.headers,
    body: { provider: 'google', callbackURL, errorCallbackURL, disableRedirect: true },
    returnHeaders: true,
  });
  const target = new URL(result.response.url);
  if (target.origin !== 'https://accounts.google.com' || target.username || target.password) {
    throw new Error('Unexpected Google destination');
  }
  const outgoing = headers();
  copyCookies(result.headers, outgoing);
  outgoing.set('Location', target.href);
  return outgoing;
}
