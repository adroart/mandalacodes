/**
 * compose_reading — assemble the *material* for a reading, not invent prose.
 *
 * Per CONCEPT §4, a reading is the Glance (the woven, system-agnostic heart)
 * plus, optionally, one voice opened and one moving line drawn — wrapped with
 * the artwork's identity when a piece is in play. This tool gathers exactly
 * that material and hands it back as a structured scaffold. The calling model
 * writes the final reading in the deck's voice, on method (guides 00–06). It
 * deliberately does NOT fabricate a parallel voice.
 */
import type { CanonicalCard } from './corpus.ts';
import type { Voice } from './search.ts';

export interface ComposeOptions {
  voices?: Voice[]; // which voices to open beneath the Glance
  artworkId?: string; // frame the reading around a specific piece
  line?: number; // include a drawn moving line (1–6)
  length?: 'glance' | 'short' | 'full';
}

function voiceMaterial(card: CanonicalCard, voice: Voice): Record<string, unknown> {
  switch (voice) {
    case 'iching':
      return {
        hexagram_name: card.iching.hexagram_name,
        essence: card.essence,
        trigrams: { upper: card.iching.upper_trigram, lower: card.iching.lower_trigram },
        reading: card.iching.reading,
        judgement: card.iching.judgement_lines,
        image: card.iching.image_lines,
      };
    case 'gene_keys':
      return {
        names: { shadow: card.gene_keys.shadow_name, gift: card.gene_keys.gift_name, siddhi: card.gene_keys.siddhi_name },
        shadow: card.gene_keys.shadow,
        repressive: card.gene_keys.repressive,
        reactive: card.gene_keys.reactive,
        gift: card.gene_keys.gift,
        siddhi: card.gene_keys.siddhi,
      };
    case 'human_design':
      return {
        gate: card.human_design.gate_number,
        keyword: card.human_design.gate_keyword,
        gate_teaching: card.human_design.gate,
        centre: card.human_design.centre,
        channel: card.human_design.channel,
      };
    case 'tarot':
      return { arcana: card.tarot.arcana, ring_role: card.tarot.ring_role, resonance: card.tarot.tarot_resonance };
    case 'body':
      return { physiology: card.body.physiology, amino_acid: card.body.amino_acid };
    case 'glance':
    default:
      return { reading: card.glance.reading, essence: card.essence };
  }
}

export function composeReading(card: CanonicalCard, opts: ComposeOptions = {}) {
  const length = opts.length ?? 'short';
  const artwork = opts.artworkId
    ? card.artworks.find((a) => a.id === opts.artworkId)
    : card.artworks[0];

  const voices = length === 'glance' ? [] : (opts.voices ?? ['gene_keys']);
  const openedVoices: Record<string, unknown> = {};
  for (const v of voices) openedVoices[v] = voiceMaterial(card, v);

  let drawnLine: unknown;
  if (opts.line) {
    drawnLine = card.iching.lines.find((l) => l.line === opts.line) ?? {
      line: opts.line,
      note: 'This moving-line text is not yet authored (only some cards have their 6 lines written).',
    };
  }

  return {
    code: card.number,
    card_name: card.card_name,
    keywords: card.keywords,
    artwork: artwork
      ? { id: artwork.id, title: artwork.title, image: artwork.coverImage, year: artwork.year }
      : undefined,
    glance: {
      anchor: card.essence,
      reading: card.glance.reading,
      invocation: card.glance.invocation,
    },
    voices_opened: openedVoices,
    moving_line: drawnLine,
    guidance_for_writer:
      'Write the reading in the deck\'s own voice (guides 00–06). Start from the Glance (system-agnostic, no tradition named); open only the requested voices beneath it; if an artwork is present, frame the reading around the piece. Quote no source prose; honor lineages only in teaching layers.',
  };
}
