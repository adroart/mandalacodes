/**
 * Pure, I/O-free claim-code logic for the Atlas piece-claim credential.
 *
 * The claim code is printed on the piece's back insert (the part the keeper
 * pulls out); possession of the piece is the credential. Like utils/consent.ts
 * and utils/saleBridge.ts, everything here is deterministic and isomorphic —
 * only WebCrypto's `crypto.getRandomValues` / `crypto.subtle.digest`, both
 * present in Node, Workers, and the browser — so the unit suite can pin the
 * rules without mocking Cloudflare.
 *
 * The security envelope (sanctioned in living-art-legacy.md):
 *   - high entropy: >= 128 bits per code,
 *   - Crockford base32 so it is human-transcribable (no ambiguous chars),
 *   - stored ONLY as a SHA-256 hash, never in plaintext,
 *   - single use, reissuable (a reissue invalidates the old hash),
 *   - inert once the piece is claimed.
 *
 * Nothing here ever logs, stores, or returns a plaintext code beyond the
 * value it generates and hands back once.
 */

/** Crockford base32 alphabet: 0-9 A-Z minus I, L, O, U (ambiguity + accidents).
 *  32 symbols, 5 bits each. */
export const CLAIM_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** Bump when the code recipe (length / alphabet / hashing) changes. Stamped
 *  onto the steward record as `claimCodeVersion`. */
export const CLAIM_CODE_VERSION = 1;

/** Random bytes per code. 16 bytes = 128 bits of entropy (the sanctioned
 *  floor). Encodes to 26 Crockford symbols. */
const CLAIM_CODE_BYTES = 16;

/** Display grouping size. Groups are cosmetic — normalizeClaimCode strips them
 *  before hashing, so any grouping round-trips. */
const GROUP_SIZE = 5;

/**
 * Encode bytes as Crockford base32 (big-endian bit accumulator). 16 bytes ->
 * 26 symbols (ceil(128 / 5)); the final symbol carries the last 3 bits.
 */
function encodeCrockford(bytes: Uint8Array): string {
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (let i = 0; i < bytes.length; i++) {
    buffer = (buffer << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += CLAIM_CODE_ALPHABET[(buffer >>> bits) & 31];
    }
  }
  if (bits > 0) {
    out += CLAIM_CODE_ALPHABET[(buffer << (5 - bits)) & 31];
  }
  return out;
}

/**
 * Insert a separator every GROUP_SIZE characters for display, e.g.
 * `A1B2C3D4...` -> `A1B2C-3D4...`. A trailing group of a single character is
 * merged back into the previous group so a printed code never ends in a lonely
 * digit (26 symbols -> groups of 5,5,5,5,6). Purely cosmetic.
 */
export function groupClaimCode(normalized: string): string {
  const groups: string[] = [];
  for (let i = 0; i < normalized.length; i += GROUP_SIZE) {
    groups.push(normalized.slice(i, i + GROUP_SIZE));
  }
  if (groups.length >= 2 && groups[groups.length - 1].length === 1) {
    const tail = groups.pop() as string;
    groups[groups.length - 1] += tail;
  }
  return groups.join('-');
}

/**
 * Generate a fresh claim code as a grouped display string, e.g.
 * `Q3M7K-8ZPA4-...`. 128 bits of entropy, Crockford base32. Return value is
 * the ONLY time the plaintext exists — the caller shows it once and stores
 * only its hash.
 */
export function generateClaimCode(): string {
  const bytes = new Uint8Array(CLAIM_CODE_BYTES);
  crypto.getRandomValues(bytes);
  return groupClaimCode(encodeCrockford(bytes));
}

/**
 * Normalize user input to the canonical form used for hashing:
 *   - strip every separator / non-alphanumeric character (hyphens, spaces),
 *   - uppercase,
 *   - map the Crockford ambiguity set: I -> 1, L -> 1, O -> 0.
 * So `q3m7k-8zpa4`, `Q3M7K 8ZPA4`, and `q3m7k8zpa4` all normalize identically,
 * and a keeper who reads `O` for `0` or `l` for `1` still matches.
 */
export function normalizeClaimCode(input: string): string {
  return (input || '')
    .replace(/[^0-9a-zA-Z]/g, '')
    .toUpperCase()
    .replace(/[ILO]/g, (ch) => (ch === 'O' ? '0' : '1'));
}

/** Lowercase hex of a byte buffer. */
function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

/**
 * SHA-256 hex of a claim code. Normalizes first, so the plaintext handed to
 * the keeper (grouped, any case) and the value the keeper later types both
 * hash to the same digest. This is the ONLY representation ever stored. Uses
 * WebCrypto's subtle.digest so it is identical in Node, Workers, and browsers.
 */
export async function hashClaimCode(code: string): Promise<string> {
  const normalized = normalizeClaimCode(code);
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return toHex(digest);
}
