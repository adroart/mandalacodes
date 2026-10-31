export interface GoogleAuthenticationBridge { postMessage(value: unknown): void }
export interface GoogleHandoff { code: string; verifier: string; state: string }

const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const opaque = /^[A-Za-z0-9_-]{32,128}$/;
// Only fixed native stages affect UI text. Never reflect native error details.
function nativeFailureMessage(stage: unknown): string {
  switch (stage) {
    case 'presentation-unavailable': return 'Google sign-in could not open on this iPhone. Please try again.';
    case 'system-error': return 'The iPhone could not return from Google sign-in. Please try again.';
    case 'callback-missing': return 'Google sign-in closed without returning to the app. Please try again.';
    case 'callback-url-shape':
    case 'callback-query-count': return 'Google sign-in returned an unexpected app link. Please try again.';
    case 'callback-state-mismatch': return 'Google sign-in could not be verified. Please try again.';
    case 'callback-server-error': return 'Google sign-in could not be confirmed by the server. Please try again.';
    case 'callback-code-invalid': return 'Google sign-in returned an invalid response. Please try again.';
    default: return 'Google sign-in did not finish. Please try again.';
  }
}

/** The proof stays in memory for this attempt. The system browser returns only
 * a short-lived code; the account HTTP transport exchanges it for its cookie. */
export async function startNativeGoogleSignIn(
  bridge = (window as unknown as { webkit?: { messageHandlers?: { oracleGoogleAuth?: GoogleAuthenticationBridge } } }).webkit?.messageHandlers?.oracleGoogleAuth,
  events: EventTarget = window,
  cryptography: Crypto = crypto,
): Promise<GoogleHandoff> {
  if (!bridge) throw new Error('Google sign-in needs the updated Oracle app.');
  const verifier = encode(cryptography.getRandomValues(new Uint8Array(32)));
  const state = encode(cryptography.getRandomValues(new Uint8Array(32)));
  const challenge = encode(new Uint8Array(await cryptography.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const id = cryptography.randomUUID();
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); events.removeEventListener('oracle-google-result', receive); };
    const receive = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.id !== id) return;
      cleanup();
      if (detail.state !== state) { reject(new Error('Google sign-in could not be verified. Please try again.')); return; }
      if (detail.error) {
        reject(new Error(detail.error === 'cancelled' ? 'Google sign-in was cancelled.' : nativeFailureMessage(detail.stage)));
        return;
      }
      if (typeof detail.code !== 'string' || !opaque.test(detail.code)) { reject(new Error('Google sign-in returned an invalid response.')); return; }
      resolve({code: detail.code, verifier, state});
    };
    const timer = setTimeout(() => {
      cleanup();
      try { bridge.postMessage({action:'cancel', id}); } catch { /* The attempt still expires if the bridge has closed. */ }
      reject(new Error('Google sign-in timed out. Please try again.'));
    }, 5 * 60 * 1000);
    events.addEventListener('oracle-google-result', receive);
    try { bridge.postMessage({action:'start', id, state, challenge}); }
    catch { cleanup(); reject(new Error('Could not open Google sign-in. Please try again.')); }
  });
}
