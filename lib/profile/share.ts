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
 * Wire shapes:
 *   - `v2.<33 hex chars>.<base64url place label>` (current)
 *   - `v1.<22 hex chars>.<base64url place label>` (legacy decoder only)
 *
 * Each position is encoded in POSITION_KEYS order as
 * `(gate - 1) * 6 + (line - 1)`, from 0 through 383. v2 uses exactly three
 * hexadecimal characters for each value. The old v1 encoder claimed to use a
 * byte, but its hexadecimal representation grew to three characters above
 * 255; valid two-character v1 links remain readable here.
 *   - place label encoded as UTF-8 → base64url so any characters survive
 */

export interface SharedProfile {
  computed: HologeneticProfile;
  placeLabel: string;
}

const VERSION = 'v2';
const LEGACY_VERSION = 'v1';
const POSITION_HEX_WIDTH = 3;

function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) {
    throw new Error('invalid base64url');
  }
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  if (b64urlEncode(out) !== s) throw new Error('non-canonical base64url');
  return out;
}

function decodePlaceLabel(label: string): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(b64urlDecode(label));
}

function decodePositions(hex: string, width: number): HologeneticProfile | null {
  if (hex.length !== POSITION_KEYS.length * width || !/^[0-9a-f]+$/i.test(hex)) {
    return null;
  }

  const computed = {} as HologeneticProfile;
  for (let i = 0; i < POSITION_KEYS.length; i++) {
    const code = Number.parseInt(hex.slice(i * width, i * width + width), 16);
    if (!Number.isSafeInteger(code) || code < 0 || code > 383) return null;
    const gate = Math.floor(code / 6) + 1;
    const line = (code % 6) + 1;
    if (gate < 1 || gate > 64 || line < 1 || line > 6) return null;
    computed[POSITION_KEYS[i]] = { gate, line };
  }
  return computed;
}

/** Encode a profile into a compact, URL-safe token. */
export function encodeSharedProfile(computed: HologeneticProfile, placeLabel: string): string {
  const hex = POSITION_KEYS.map((k: ProfileKey) => {
    const { gate, line } = computed[k];
    if (!Number.isInteger(gate) || gate < 1 || gate > 64 ||
        !Number.isInteger(line) || line < 1 || line > 6) {
      throw new RangeError(`Invalid gate.line for ${k}`);
    }
    const code = (gate - 1) * 6 + (line - 1); // 0..383
    return code.toString(16).padStart(POSITION_HEX_WIDTH, '0');
  }).join('');
  const label = b64urlEncode(new TextEncoder().encode(placeLabel || ''));
  return `${VERSION}.${hex}.${label}`;
}

/** Decode a shared-profile token. Returns null on any malformed input. */
export function decodeSharedProfile(token: string): SharedProfile | null {
  try {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [version, hex, label] = parts;
    const width = version === VERSION ? POSITION_HEX_WIDTH
      : version === LEGACY_VERSION ? 2
        : 0;
    if (!width) return null;
    const computed = decodePositions(hex, width);
    if (!computed) return null;
    const placeLabel = decodePlaceLabel(label);
    return { computed, placeLabel };
  } catch {
    return null;
  }
}
