// What the shared word library should prime Whisper with for the oracle: its own terms first (Gene Keys, hexagrams, the
// oracle's vocabulary), then people and places. Tea terms are left out; this is not the tea site.
import type { PromptProfile } from './words';

export const ORACLE_WORDS_PROFILE: PromptProfile = {
  intro: 'A private reflection about the Mandala Codes oracle, contemplation and invocation. Preserve these spellings and natural punctuation.',
  head: 'Terms: ',
  categories: ['other', 'gene-key', 'hexagram', 'person', 'place'],
  order: 'category-first',
  budget: 160,
};
