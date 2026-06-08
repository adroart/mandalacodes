/**
 * Assemble the data for a personalized "chart in art" lookbook.
 *
 * A person's chart is 11 spheres, each a {gate, line}. Gate N == oracle code N
 * == artwork piece N, so each sphere resolves directly to one art piece and its
 * energy. We pull the piece image + the code's energy (essence, the Gift, the
 * Shadow→Gift→Siddhi spectrum, and the specific line) from the same corpus the
 * MCP and the site use.
 */
import { loadCorpus } from '../../mcp/oracle-server/src/corpus.ts';
import { img } from '../../utils/cloudinary.ts';
import type { HologeneticProfile, ProfileKey, GateLine } from '../../lib/astrology/types.ts';

/** The spheres, in reading order, with the role each plays in a chart. */
export const SPHERES: { key: ProfileKey; label: string; role: string; sequence: string }[] = [
  { key: 'lifesWork',  label: "Life's Work", role: 'Your genius — how you are here to shine outwardly.',         sequence: 'Activation' },
  { key: 'evolution',  label: 'Evolution',   role: 'The core challenge that grows you; your central lesson.',     sequence: 'Activation' },
  { key: 'radiance',   label: 'Radiance',    role: 'Your vitality and health — how you light up when aligned.',   sequence: 'Activation' },
  { key: 'purpose',    label: 'Purpose',     role: 'The deeper purpose your life quietly serves.',                sequence: 'Activation' },
  { key: 'attraction', label: 'Attraction',  role: 'What magnetises relationship and love toward you.',           sequence: 'Venus' },
  { key: 'iq',         label: 'IQ',          role: 'Your mental intelligence — how you think and know.',          sequence: 'Venus' },
  { key: 'eq',         label: 'EQ',          role: 'Your emotional intelligence — how you feel and relate.',       sequence: 'Venus' },
  { key: 'sq',         label: 'SQ',          role: 'Your spiritual intelligence — how you sense the whole.',       sequence: 'Venus' },
  { key: 'core',       label: 'Core',        role: 'The core wound, and the gift hidden inside it.',              sequence: 'Venus' },
  { key: 'culture',    label: 'Culture',     role: 'How your gifts move out into community and the world.',        sequence: 'Pearl' },
  { key: 'pearl',      label: 'Pearl',       role: 'Your prosperity and right livelihood.',                       sequence: 'Pearl' },
];

export interface LookbookPiece {
  sphere: string;
  role: string;
  sequence: string;
  gate: number;
  line: number;
  cardName?: string;
  essence?: string;
  giftName?: string;
  gift?: string;
  shadowName?: string;
  siddhiName?: string;
  lineReading?: string;
  pieceId?: string;
  pieceTitle?: string;
  image?: string;        // full-size, for the spread
  thumb?: string;        // small, for the contact sheet
}

export interface LookbookData {
  clientName: string;
  subtitle: string;
  pieces: LookbookPiece[];
}

export async function buildLookbookData(
  profile: Partial<HologeneticProfile>,
  opts: { clientName?: string; spheres?: ProfileKey[] } = {},
): Promise<LookbookData> {
  const corpus = await loadCorpus();
  const byNum = new Map(corpus.map((c) => [c.number, c]));
  const want = opts.spheres ? new Set(opts.spheres) : null;

  const pieces: LookbookPiece[] = [];
  for (const s of SPHERES) {
    if (want && !want.has(s.key)) continue;
    const gl = profile[s.key] as GateLine | undefined;
    if (!gl) continue;
    const card = byNum.get(gl.gate);
    const cover = card?.artworks[0]?.coverImage;
    const line = card?.iching.lines.find((l) => l.line === gl.line);
    pieces.push({
      sphere: s.label,
      role: s.role,
      sequence: s.sequence,
      gate: gl.gate,
      line: gl.line,
      cardName: card?.card_name,
      essence: card?.essence,
      giftName: card?.gene_keys.gift_name,
      gift: card?.gene_keys.gift,
      shadowName: card?.gene_keys.shadow_name,
      siddhiName: card?.gene_keys.siddhi_name,
      lineReading: line?.reading,
      pieceId: card?.artworks[0]?.id,
      pieceTitle: card?.artworks[0]?.title,
      image: cover ? img(cover, { w: 1400, crop: 'fit', format: 'jpg' }) : undefined,
      thumb: cover ? img(cover, { w: 360, crop: 'fill', format: 'jpg' }) : undefined,
    });
  }

  return {
    clientName: opts.clientName ?? 'Your',
    subtitle: 'The art pieces of your chart, and the energy each one carries.',
    pieces,
  };
}
