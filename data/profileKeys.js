// @ts-check
/**
 * Single source of truth for the 11-position Hologenetic Profile key list
 * (Activation -> Venus -> Pearl sequence order) and each key's sequence
 * membership.
 *
 * Plain JS, not .ts: `functions/api/profile/put.js` is a Cloudflare Pages
 * Function that imports only plain JS (it cannot import a `.ts` module), so
 * this file is the runtime source both the client bundle and the Function
 * bundle import. TypeScript consumers get literal types via the JSDoc
 * annotations below (no separate `.d.ts` needed; `allowJs` picks these up).
 *
 * This file shares ORDERED KEYS and SEQUENCE MEMBERSHIP ONLY. Per-surface
 * labels and role prose stay local to their consumers (they differ on
 * purpose across surfaces, e.g. "Core" in lib/oracle/recommendation.ts vs
 * "Vocation" in data/profilePositions.ts for the legacy `core` key). Do not
 * add label/role fields here.
 *
 * @typedef {'lifesWork' | 'evolution' | 'radiance' | 'purpose' | 'attraction' | 'iq' | 'eq' | 'sq' | 'core' | 'culture' | 'pearl'} ProfileKey
 * @typedef {'activation' | 'venus' | 'pearl'} ProfileSequence
 */

/**
 * All 11 profile keys, in canonical display order: Activation Sequence
 * first (lifesWork, evolution, radiance, purpose), then Venus Sequence
 * (attraction, iq, eq, sq), then Pearl (core, culture, pearl).
 *
 * @type {ReadonlyArray<ProfileKey>}
 */
export const PROFILE_KEYS = [
  'lifesWork',
  'evolution',
  'radiance',
  'purpose',
  'attraction',
  'iq',
  'eq',
  'sq',
  'core',
  'culture',
  'pearl',
];

/**
 * Ordered key plus sequence membership. No labels or prose here on purpose,
 * see file header.
 *
 * @type {ReadonlyArray<{ key: ProfileKey, sequence: ProfileSequence }>}
 */
export const PROFILE_SPHERES = [
  { key: 'lifesWork', sequence: 'activation' },
  { key: 'evolution', sequence: 'activation' },
  { key: 'radiance', sequence: 'activation' },
  { key: 'purpose', sequence: 'activation' },
  { key: 'attraction', sequence: 'venus' },
  { key: 'iq', sequence: 'venus' },
  { key: 'eq', sequence: 'venus' },
  { key: 'sq', sequence: 'venus' },
  { key: 'core', sequence: 'pearl' },
  { key: 'culture', sequence: 'pearl' },
  { key: 'pearl', sequence: 'pearl' },
];
