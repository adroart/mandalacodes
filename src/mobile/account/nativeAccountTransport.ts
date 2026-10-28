import { Capacitor, CapacitorHttp } from '../../../mobile/node_modules/@capacitor/core';
import type { HttpOptions, HttpResponse } from '../../../mobile/node_modules/@capacitor/core';

export const ACCOUNT_ORIGIN = 'https://mandalacodes.com';
export const NATIVE_ORIGIN = 'capacitor://localhost';
const ACCOUNT_PATH = /^\/api\/(?:auth\/(?:get-session|email-otp\/send-verification-otp|sign-in\/email-otp|sign-out|sync-user)|profile\/(?:get|put|delete)|collections\/(?:list|create|update|delete|add-item|remove-item))$/;
export type NativeHttp = (options: HttpOptions) => Promise<HttpResponse>;

/** Only our account API can receive the native cookie jar. No arbitrary URL,
 * redirect, caller-supplied Cookie or Authorization header crosses this seam.
 * Capacitor's native URLSession keeps HttpOnly cookies; no session token is
 * copied into localStorage or exposed to the web app's persistence layer. */
export function createNativeAccountFetch(request: NativeHttp = CapacitorHttp.request, native = Capacitor.isNativePlatform()) {
  return async (path: string, init: RequestInit = {}): Promise<Response> => {
    if (!native) throw new Error('Account sync is available in the installed Oracle app.');
    if (!ACCOUNT_PATH.test(path)) throw new Error('Unsupported account request.');
    if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const method = (init.method || 'GET').toUpperCase();
    if (!['GET', 'POST', 'PUT', 'DELETE'].includes(method)) throw new Error('Unsupported account request.');
    let data: unknown;
    if (init.body != null) {
      if (typeof init.body !== 'string') throw new Error('Account requests must contain JSON.');
      data = JSON.parse(init.body);
    }
    const result = await request({
      url: ACCOUNT_ORIGIN + path, method, data,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Origin: NATIVE_ORIGIN },
      responseType: 'json', disableRedirects: true, connectTimeout: 15000, readTimeout: 15000,
    });
    if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (result.url && new URL(result.url).origin !== ACCOUNT_ORIGIN) throw new Error('Account service redirected unexpectedly.');
    if (result.status >= 300 && result.status < 400) throw new Error('Account service redirected unexpectedly.');
    // Exclude Set-Cookie from the JS-facing Response. Native storage owns it.
    return new Response(result.status === 204 ? null : JSON.stringify(result.data), {
      status: result.status, headers: { 'Content-Type': 'application/json' },
    });
  };
}

export async function accountResult(response: Response): Promise<any> {
  const body = await response.json().catch(() => null);
  if (response.ok) return body;
  if (response.status === 403 && /ORIGIN/i.test(String(body?.code))) throw new Error('Phone sign-in is not enabled on the server yet. Your local chart is safe.');
  if (response.status === 429) throw new Error('Too many attempts. Please wait before requesting another code.');
  if (response.status === 400 || response.status === 401) throw new Error('The email or code was not accepted. Check it and try again.');
  throw new Error('Account sync is unavailable right now. Your local chart is safe.');
}
