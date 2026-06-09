import type { HologeneticProfile, ProfileKey } from '../astrology/types';
import { POSITION_KEYS } from '../../data/profilePositions';

/**
 * Shared-profile codec.
 *
 * A shared link carries ONLY the eleven gate.line positions and the place
 * label, never the raw birth date or time. The positions are not secret (they
 * are the readable chart), so they travel safely in the URL itself and the
 * shared page needs no backend, no token, and no storage.
 *
 * Wire shape: `v1.<22 hex chars>.<base64url place label>`
 *   - one byte per position, in POSITION_KEYS order, value = (gate-1)*6 + (line-1)
 *     (0..383 fits a byte since gate<=64, line<=6 → max 378)
 *   - place label encoded as UTF-8 → base64url so any characters survive
 */

export interface SharedProfile {
  computed: HologeneticProfile;
  placeLabel: string;
}

const VERSION = 'v1';

function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Encode a profile into a compact, URL-safe token. */
export function encodeSharedProfile(computed: HologeneticProfile, placeLabel: string): string {
  const hex = POSITION_KEYS.map((k: ProfileKey) => {
    const { gate, line } = computed[k];
    const code = (gate - 1) * 6 + (line - 1); // 0..378
    return code.toString(16).padStart(2, '0');
  }).join('');
  const label = b64urlEncode(new TextEncoder().encode(placeLabel || ''));
  return `${VERSION}.${hex}.${label}`;
}

/** Decode a shared-profile token. Returns null on any malformed input. */
export function decodeSharedProfile(token: string): SharedProfile | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== VERSION) return null;
    const [, hex, label] = parts;
    if (hex.length !== POSITION_KEYS.length * 2) return null;

    const computed = {} as HologeneticProfile;
    for (let i = 0; i < POSITION_KEYS.length; i++) {
      const code = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      if (Number.isNaN(code) || code < 0 || code > 383) return null;
      const gate = Math.floor(code / 6) + 1;
      const line = (code % 6) + 1;
      if (gate < 1 || gate > 64 || line < 1 || line > 6) return null;
      computed[POSITION_KEYS[i]] = { gate, line };
    }

    const placeLabel = new TextDecoder().decode(b64urlDecode(label));
    return { computed, placeLabel };
  } catch {
    return null;
  }
}
