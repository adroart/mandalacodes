import type { ProfileKey } from '../lib/astrology/types';

/**
 * The short "what this placement means" copy shown in the in-your-chart
 * popup, one entry per profile position.
 *
 * This file is the single place to author placement copy. Edit a `body`
 * here and the popup updates everywhere; nothing else needs to change.
 * Each body is two or three sentences, sized to read on a phone in a few
 * seconds. No em dashes (comma / period / colon instead).
 *
 * These drafts are generated from what we know about each position (its
 * role, sequence, and planet). Adrian can rewrite any of them later, in
 * his own voice, without touching the wiring.
 */
export interface PlacementDescription {
  /** Two or three short sentences. The body of the popup. */
  body: string;
}

export const PLACEMENT_DESCRIPTIONS: Record<ProfileKey, PlacementDescription> = {
  lifesWork: {
    body:
      'Your Life’s Work sits at the top of your Activation Sequence, the through-line others feel in everything you make before they can name it. Carried here, this code is the core of what you came to express.',
  },
  evolution: {
    body:
      'Your Evolution is the contrast that shapes you, what you learn by living against the grain. This code marks the friction you grow through, the resistance that turns out to be the lesson.',
  },
  radiance: {
    body:
      'Your Radiance is the light you carry into a room, felt before it is named. Held here, this code colours the quality others sense in you when you are most at ease.',
  },
  purpose: {
    body:
      'Your Purpose is the current beneath your work, the reason it keeps bending toward meaning. This code names the deeper pull that steadies you when the surface gets noisy.',
  },
  attraction: {
    body:
      'Your Attraction is how others first feel you, the quality that draws them close. The first position of your Venus Sequence, this code shapes the way connection begins for you.',
  },
  iq: {
    body:
      'Your IQ is how your mind moves, the shape of your thinking. This code marks the way you reason and make sense of things, the native grain of your intelligence.',
  },
  eq: {
    body:
      'Your EQ is how you meet feeling, your way through what is felt and left unsaid. This code lives where emotion is metabolised, in you and between you and others.',
  },
  sq: {
    body:
      'Your SQ is how spirit speaks through you, the quiet intelligence beneath thought and feeling. This code marks where the deeper knowing arrives, often before you can explain it.',
  },
  core: {
    body:
      'Your Vocation is the work that carries you, where your gifts meet the world. The heart of the Pearl Sequence, this code points to the contribution that also sustains you.',
  },
  culture: {
    body:
      'Your Culture is the field you came from, the inheritance you are reweaving. This code marks the lineage and conditioning you transform rather than simply carry forward.',
  },
  pearl: {
    body:
      'Your Pearl is the synthesis, where vocation and gift meet your daily choices. Carried here, this code is where everything you are gathers into the practical, the way you actually live it.',
  },
};
