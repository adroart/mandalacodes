/**
 * Recommendation assembly — the engine behind the chart→art lookbook and the
 * hosted /api/oracle/recommendation endpoint.
 *
 * Pure and corpus-injected (fs-free): the caller passes the cards, so this runs
 * in the CLI (cards from loadCorpus) and in a Cloudflare Function (cards from
 * the bundled corpus JSON) unchanged. Given a person's chart — the 11 spheres,
 * each {gate, line} — it resolves each sphere to its art piece and the energy
 * the code carries, and resolves the curator's recommended picks.
 *
 * Gate N == oracle code N == artwork piece N, so the alignment is by number.
 */
import { img } from '../../utils/cloudinary';
import type { CanonicalCard } from './types';
import type { HologeneticProfile, ProfileKey, GateLine } from '../astrology/types';
import { PROFILE_KEYS } from '../../data/profileKeys.js';

/**
 * Label, role prose, and displayed sequence name for each sphere, local to
 * this surface (the recommendation engine and lookbook). Deliberately not
 * shared with data/profilePositions.ts: the label differs on purpose for
 * `core` ("Core" here vs "Vocation" there), and the displayed `sequence`
 * word for `core` here is "Venus" while data/profilePositions.ts's
 * structural sequence membership for `core` is "pearl" (its channel lines
 * connect core/culture/pearl as the Pearl Sequence). That is a pre-existing
 * discrepancy between the two surfaces, preserved here as-is per the
 * phase-2g refactor's render-unchanged requirement; this refactor shares
 * only the ordered key list (PROFILE_KEYS), not this table's values. Flag
 * for Adrian: worth a follow-up decision on which is correct.
 */
const SPHERE_COPY: Record<ProfileKey, { label: string; role: string; sequence: string }> = {
  lifesWork:  { label: "Life's Work", role: 'Your genius — how you are here to shine outwardly.',         sequence: 'Activation' },
  evolution:  { label: 'Evolution',   role: 'The core challenge that grows you; your central lesson.',     sequence: 'Activation' },
  radiance:   { label: 'Radiance',    role: 'Your vitality and health — how you light up when aligned.',   sequence: 'Activation' },
  purpose:    { label: 'Purpose',     role: 'The deeper purpose your life quietly serves.',                sequence: 'Activation' },
  attraction: { label: 'Attraction',  role: 'What magnetises relationship and love toward you.',           sequence: 'Venus' },
  iq:         { label: 'IQ',          role: 'Your mental intelligence — how you think and know.',          sequence: 'Venus' },
  eq:         { label: 'EQ',          role: 'Your emotional intelligence — how you feel and relate.',       sequence: 'Venus' },
  sq:         { label: 'SQ',          role: 'Your spiritual intelligence — how you sense the whole.',       sequence: 'Venus' },
  core:       { label: 'Core',        role: 'The core wound, and the gift hidden inside it.',              sequence: 'Venus' },
  culture:    { label: 'Culture',     role: 'How your gifts move out into community and the world.',        sequence: 'Pearl' },
  pearl:      { label: 'Pearl',       role: 'Your prosperity and right livelihood.',                       sequence: 'Pearl' },
};

/** The spheres, in reading order, with the role each plays in a chart. */
export const SPHERES: { key: ProfileKey; label: string; role: string; sequence: string }[] = PROFILE_KEYS.map(
  (key) => ({ key, ...SPHERE_COPY[key] }),
);

export interface LookbookPiece {
  sphere: string;
  role: string;
  sequence: string;
  gate: number;
  line: number;
  cardName?: string;
  keywords?: string[];
  essence?: string;
  giftName?: string;
  gift?: string;
  shadowName?: string;
  siddhiName?: string;
  lineReading?: string;
  pieceId?: string;
  pieceTitle?: string;
  image?: string;
  thumb?: string;
  recommended?: boolean;
}

/** A pick in the input: reference a sphere OR a gate, plus the reason. */
export interface RecInput { sphere?: ProfileKey; gate?: number; reason?: string }

export interface RecPick {
  sphere: string;
  cardName?: string;
  gate: number;
  line: number;
  thumb?: string;
  pieceTitle?: string;
  reason?: string;
}

export interface Recommendation {
  intention?: string;
  closing?: string;
  picks: RecPick[];
}

/** The input chart: the 11 spheres + an optional recommendation block. */
export interface ChartInput extends Partial<HologeneticProfile> {
  recommendation?: { intention?: string; closing?: string; picks?: RecInput[] };
}

export interface LookbookData {
  clientName: string;
  subtitle: string;
  pieces: LookbookPiece[];
  recommendation?: Recommendation;
}

export function assembleLookbook(
  cards: CanonicalCard[],
  profile: ChartInput,
  opts: { clientName?: string; spheres?: ProfileKey[] } = {},
): LookbookData {
  const byNum = new Map(cards.map((c) => [c.number, c]));
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
      keywords: card?.keywords,
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

  const labelByKey = new Map(SPHERES.map((s) => [s.key, s.label]));
  let recommendation: Recommendation | undefined;
  if (profile.recommendation) {
    const picks: RecPick[] = [];
    for (const pick of profile.recommendation.picks ?? []) {
      const piece = pick.sphere
        ? pieces.find((p) => p.sphere === labelByKey.get(pick.sphere!))
        : pieces.find((p) => p.gate === pick.gate);
      if (!piece) continue;
      piece.recommended = true;
      picks.push({
        sphere: piece.sphere,
        cardName: piece.cardName,
        gate: piece.gate,
        line: piece.line,
        thumb: piece.thumb,
        pieceTitle: piece.pieceTitle,
        reason: pick.reason,
      });
    }
    recommendation = {
      intention: profile.recommendation.intention,
      closing: profile.recommendation.closing,
      picks,
    };
  }

  return {
    clientName: opts.clientName ?? 'Your',
    subtitle: 'The art pieces of your chart, and the energy each one carries.',
    pieces,
    recommendation,
  };
}
