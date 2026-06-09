import type { ProfileKey, ProfileSequence } from '../lib/astrology/types';

export interface ProfilePositionMeta {
  key: ProfileKey;
  sequence: ProfileSequence;
  label: string;
  planet: 'sun' | 'earth' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter';
  side: 'persona' | 'design';
  /**
   * Anatomical anchor reserved for Adrian to fill in. Empty strings are
   * rendered as just the position label.
   */
  body: string;
  /** One-sentence role description in the site's voice (no em dashes). */
  role: string;
  /**
   * Normalized position on the mandala (0..1 each axis, origin top-left),
   * measured from the official Gene Keys body-map so the layout mirrors it.
   */
  x: number;
  y: number;
}

/**
 * The eleven positions in display order: Activation Sequence first, then
 * Venus, then Pearl. The order is meaningful — ProfileGraph and
 * YourPositionCallout rely on it.
 *
 * Position copy drafts here for review by Adrian; the `body` field is left
 * empty intentionally so anatomical anchors can be added later without a
 * schema change. The label vocabulary follows the Gene Keys synthesis by
 * Richard Rudd (Activation / Venus / Pearl Sequences). Attribution lives
 * on the OracleProfile page footer.
 */
export const PROFILE_POSITIONS: readonly ProfilePositionMeta[] = [
  {
    key: 'lifesWork', sequence: 'activation', label: "Life's Work",
    planet: 'sun', side: 'persona', body: '',
    role: 'Your core vocation, the work you came here to express.',
    x: 0.5, y: 0.08,
  },
  {
    key: 'evolution', sequence: 'activation', label: 'Evolution',
    planet: 'earth', side: 'persona', body: '',
    role: 'The contrast that shapes you, what you learn by living against.',
    x: 0.88, y: 0.5,
  },
  {
    key: 'radiance', sequence: 'activation', label: 'Radiance',
    planet: 'sun', side: 'design', body: '',
    role: 'The light you carry into the world, felt before it is named.',
    x: 0.12, y: 0.5,
  },
  {
    key: 'purpose', sequence: 'activation', label: 'Purpose',
    planet: 'earth', side: 'design', body: '',
    role: 'The current beneath your work, the reason it bends toward meaning.',
    x: 0.5, y: 0.92,
  },

  {
    key: 'attraction', sequence: 'venus', label: 'Attraction',
    planet: 'moon', side: 'design', body: '',
    role: 'How others first feel you, the quality that draws them close.',
    x: 0.5, y: 0.7,
  },
  {
    key: 'iq', sequence: 'venus', label: 'IQ',
    planet: 'venus', side: 'persona', body: '',
    role: 'How your mind moves, the shape of your thinking.',
    x: 0.36, y: 0.6,
  },
  {
    key: 'eq', sequence: 'venus', label: 'EQ',
    planet: 'mars', side: 'persona', body: '',
    role: 'How you meet feeling, your way through what is felt and unsaid.',
    x: 0.64, y: 0.6,
  },
  {
    key: 'sq', sequence: 'venus', label: 'SQ',
    planet: 'venus', side: 'design', body: '',
    role: 'How spirit speaks through you, the quiet intelligence beneath.',
    x: 0.5, y: 0.5,
  },

  {
    key: 'core', sequence: 'pearl', label: 'Vocation',
    planet: 'mars', side: 'design', body: '',
    role: 'The work that carries you, where your gifts meet the world.',
    x: 0.36, y: 0.4,
  },
  {
    key: 'culture', sequence: 'pearl', label: 'Culture',
    planet: 'jupiter', side: 'design', body: '',
    role: 'The field you came from, the inheritance you are reweaving.',
    x: 0.64, y: 0.4,
  },
  {
    key: 'pearl', sequence: 'pearl', label: 'Pearl',
    planet: 'jupiter', side: 'persona', body: '',
    role: 'The synthesis, where vocation and gift meet your daily choices.',
    x: 0.5, y: 0.3,
  },
];

/**
 * The channels between spheres, mirrored from the official body-map:
 * the central spine, the Pearl triangle, the Venus diamond, and the two
 * Activation wings into the center. Used to draw connecting lines (which
 * light up on hover/focus of a connected sphere).
 */
export const PROFILE_CHANNELS: ReadonlyArray<readonly [ProfileKey, ProfileKey]> = [
  // Central spine, crown to base
  ['lifesWork', 'pearl'],
  ['pearl', 'sq'],
  ['sq', 'attraction'],
  ['attraction', 'purpose'],
  // Pearl triangle
  ['pearl', 'core'],
  ['pearl', 'culture'],
  ['core', 'sq'],
  ['culture', 'sq'],
  // Venus diamond
  ['sq', 'iq'],
  ['sq', 'eq'],
  ['iq', 'attraction'],
  ['eq', 'attraction'],
  // Activation wings into center
  ['radiance', 'sq'],
  ['evolution', 'sq'],
];

export const POSITIONS_BY_KEY: Record<ProfileKey, ProfilePositionMeta> =
  Object.fromEntries(PROFILE_POSITIONS.map((p) => [p.key, p])) as Record<
    ProfileKey,
    ProfilePositionMeta
  >;

export const SEQUENCE_LABEL: Record<ProfileSequence, string> = {
  activation: 'Activation Sequence',
  venus: 'Venus Sequence',
  pearl: 'The Pearl',
};

/** All position keys in display order. */
export const POSITION_KEYS: readonly ProfileKey[] = PROFILE_POSITIONS.map((p) => p.key);
