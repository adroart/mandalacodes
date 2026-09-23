import { describe, expect, it } from 'vitest';
import { POSITION_KEYS } from '../../data/profilePositions';
import { decodeSharedProfile, encodeSharedProfile } from '../../lib/profile/share';
import type { HologeneticProfile, ProfileKey } from '../../lib/astrology/types';

function profile(position: { gate: number; line: number }): HologeneticProfile {
  return Object.fromEntries(POSITION_KEYS.map((key) => [key, { ...position }])) as unknown as HologeneticProfile;
}

function mixedProfile(): HologeneticProfile {
  return Object.fromEntries(POSITION_KEYS.map((key, index) => [
    key,
    { gate: ((index * 17) % 64) + 1, line: ((index * 5) % 6) + 1 },
  ])) as unknown as HologeneticProfile;
}

function legacyV1Token(computed: HologeneticProfile, label = ''): string {
  const hex = POSITION_KEYS.map((key) => {
    const { gate, line } = computed[key];
    return ((gate - 1) * 6 + (line - 1)).toString(16).padStart(2, '0');
  }).join('');
  const bytes = new TextEncoder().encode(label);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `v1.${hex}.${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

describe('shared profile codec', () => {
  it('round-trips every gate and line in every profile position', () => {
    for (const key of POSITION_KEYS) {
      for (let gate = 1; gate <= 64; gate++) {
        for (let line = 1; line <= 6; line++) {
          const computed = profile({ gate: 1, line: 1 });
          computed[key] = { gate, line };
          expect(decodeSharedProfile(encodeSharedProfile(computed, 'Denpasar'))).toEqual({
            computed,
            placeLabel: 'Denpasar',
          });
        }
      }
    }
  });

  it('round-trips a mixed chart and a Unicode place label without birth inputs', () => {
    const computed = mixedProfile();
    const decoded = decodeSharedProfile(encodeSharedProfile(computed, 'Denpasar, Bali 🌺 日本'));
    expect(decoded).toEqual({ computed, placeLabel: 'Denpasar, Bali 🌺 日本' });
    expect(decoded).not.toHaveProperty('inputs');
    expect(JSON.stringify(decoded)).not.toMatch(/birth|date|time/i);
  });

  it('decodes every formerly valid v1 URL', () => {
    for (const key of POSITION_KEYS) {
      for (let code = 0; code <= 255; code++) {
        const computed = profile({ gate: 1, line: 1 });
        computed[key] = { gate: Math.floor(code / 6) + 1, line: (code % 6) + 1 };
        expect(decodeSharedProfile(legacyV1Token(computed, 'Å'))).toEqual({ computed, placeLabel: 'Å' });
      }
    }
  });

  it('rejects malformed versions, position values, and labels', () => {
    const good = encodeSharedProfile(profile({ gate: 64, line: 6 }), 'Place');
    const [, hex, label] = good.split('.');
    const invalid = [
      '', 'v3.' + hex + '.' + label, 'v2.' + hex.slice(1) + '.' + label,
      'v2.' + hex.slice(0, -1) + 'g.' + label,
      'v2.' + '180'.repeat(POSITION_KEYS.length) + '.' + label,
      'v2.' + hex + '.%', 'v2.' + hex + '.A', 'v2.' + hex + '.AB',
      'v2.' + hex + '.wA', 'v2.' + hex + '.' + label + '.',
      'v1.' + '00'.repeat(POSITION_KEYS.length - 1) + '100.' + label,
    ];
    for (const token of invalid) expect(decodeSharedProfile(token)).toBeNull();
  });

  it('rejects invalid input positions while encoding', () => {
    const computed = profile({ gate: 1, line: 1 });
    computed[POSITION_KEYS[0] as ProfileKey] = { gate: 65, line: 1 };
    expect(() => encodeSharedProfile(computed, '')).toThrow(RangeError);
  });
});
