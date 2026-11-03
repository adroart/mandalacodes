import { json, type ReflectionContext, type ReflectionEnv } from '../reflections/_shared';

/**
 * The Mac's pickup of phone recordings. It uses its own key, never a signed-in session and never an existing secret.
 * The key is the Pages secret AR_PICKUP_TOKEN. With no key set, every request is refused (nothing is open by default).
 */
export interface PickupEnv extends ReflectionEnv { AR_PICKUP_TOKEN?: string }
export interface PickupContext extends Omit<ReflectionContext, 'env'> { env: PickupEnv }

const MIN_KEY_LENGTH = 32;
const sha256 = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));

/** Compare two keys without leaking where they differ: hash both to the same length, then check every byte. */
async function sameKey(given: string, expected: string) {
  const [a, b] = await Promise.all([sha256(given), sha256(expected)]);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

/** Returns a refusal to send back, or null when the caller holds the key. */
export async function requirePickup(request: Request, env: PickupEnv): Promise<Response | null> {
  const expected = env.AR_PICKUP_TOKEN?.trim();
  if (!expected || expected.length < MIN_KEY_LENGTH) return json({ ok: false, error: 'pickup is not set up on this site' }, 503);
  const header = request.headers.get('Authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match || !(await sameKey(match[1], expected))) {
    const refusal = json({ ok: false, error: 'unauthorized' }, 401);
    refusal.headers.set('WWW-Authenticate', 'Bearer');
    return refusal;
  }
  return null;
}

/** Where the full word-by-word result for a segment is kept, next to its audio. */
export const resultKeyFor = (objectKey: string) => `${objectKey}.ar-create.json`;
