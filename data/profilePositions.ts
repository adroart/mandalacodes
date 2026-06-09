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
  /**
   * Which side of the sphere the label + Gene Keys triad sit on, so text
   * lives outside the orb (only the gate.line sits inside). Chosen to push
   * outward from the mandala's center and avoid collisions.
   */
  labelSide: 'left' | 'right' | 'top' | 'bottom';
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
    x: 0.5, y: 0.11, labelSide: 'top',
  },
  {
    key: 'evolution', sequence: 'activation', label: 'Evolution',
    planet: 'earth', side: 'persona', body: '',
    role: 'The contrast that shapes you, what you learn by living against.',
    x: 0.84, y: 0.5, labelSide: 'right',
  },
  {
    key: 'radiance', sequence: 'activation', label: 'Radiance',
    planet: 'sun', side: 'design', body: '',
    role: 'The light you carry into the world, felt before it is named.',
    x: 0.16, y: 0.5, labelSide: 'left',
  },
  {
    key: 'purpose', sequence: 'activation', label: 'Purpose',
    planet: 'earth', side: 'design', body: '',
    role: 'The current beneath your work, the reason it bends toward meaning.',
    x: 0.5, y: 0.89, labelSide: 'bottom',
  },

  {
    key: 'attraction', sequence: 'venus', label: 'Attraction',
    planet: 'moon', side: 'design', body: '',
    role: 'How others first feel you, the quality that draws them close.',
    x: 0.5, y: 0.7, labelSide: 'bottom',
  },
  {
    key: 'iq', sequence: 'venus', label: 'IQ',
    planet: 'venus', side: 'persona', body: '',
    role: 'How your mind moves, the shape of your thinking.',
    x: 0.36, y: 0.6, labelSide: 'left',
  },
  {
    key: 'eq', sequence: 'venus', label: 'EQ',
    planet: 'mars', side: 'persona', body: '',
    role: 'How you meet feeling, your way through what is felt and unsaid.',
    x: 0.64, y: 0.6, labelSide: 'right',
  },
  {
    key: 'sq', sequence: 'venus', label: 'SQ',
    planet: 'venus', side: 'design', body: '',
    role: 'How spirit speaks through you, the quiet intelligence beneath.',
    x: 0.5, y: 0.5, labelSide: 'left',
  },

  {
    key: 'core', sequence: 'pearl', label: 'Vocation',
    planet: 'mars', side: 'design', body: '',
    role: 'The work that carries you, where your gifts meet the world.',
    x: 0.36, y: 0.4, labelSide: 'left',
  },
  {
    key: 'culture', sequence: 'pearl', label: 'Culture',
    planet: 'jupiter', side: 'design', body: '',
    role: 'The field you came from, the inheritance you are reweaving.',
    x: 0.64, y: 0.4, labelSide: 'right',
  },
  {
    key: 'pearl', sequence: 'pearl', label: 'Pearl',
    planet: 'jupiter', side: 'persona', body: '',
    role: 'The synthesis, where vocation and gift meet your daily choices.',
    x: 0.5, y: 0.3, labelSide: 'top',
  },
];

export interface ProfileChannel {
  from: ProfileKey;
  to: ProfileKey;
  /** Which sequence this line belongs to, so it is drawn in that colour. */
  sequence: ProfileSequence;
}

/**
 * The channels between spheres, mirrored from the official Gene Keys
 * body-map. Each sequence is its OWN connected path, drawn in its own
 * colour, so the four Venus codes read as one journey, the Pearl three as
 * another, and the Activation four as the cross — rather than every line
 * funnelling through the centre.
 *
 *   Activation (green): the cross — Life's Work down the spine to Purpose,
 *     and the Radiance/Evolution horizontal, meeting at the centre (SQ).
 *   Venus (red): Attraction up through IQ and EQ to SQ — the diamond.
 *   Pearl (blue): SQ up through Vocation and Culture to the Pearl, which
 *     crowns to Life's Work.
 */
export const PROFILE_CHANNELS: readonly ProfileChannel[] = [
  // ── Activation: the cross through the centre ──
  { from: 'lifesWork', to: 'sq', sequence: 'activation' },
  { from: 'sq', to: 'purpose', sequence: 'activation' },
  { from: 'radiance', to: 'sq', sequence: 'activation' },
  { from: 'evolution', to: 'sq', sequence: 'activation' },

  // ── Venus: the diamond, Attraction up to SQ ──
  { from: 'attraction', to: 'iq', sequence: 'venus' },
  { from: 'attraction', to: 'eq', sequence: 'venus' },
  { from: 'iq', to: 'sq', sequence: 'venus' },
  { from: 'eq', to: 'sq', sequence: 'venus' },

  // ── Pearl: the triangle, SQ up to the Pearl, Pearl crowns to Life's Work ──
  { from: 'sq', to: 'core', sequence: 'pearl' },
  { from: 'sq', to: 'culture', sequence: 'pearl' },
  { from: 'core', to: 'pearl', sequence: 'pearl' },
  { from: 'culture', to: 'pearl', sequence: 'pearl' },
  { from: 'pearl', to: 'lifesWork', sequence: 'pearl' },
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
