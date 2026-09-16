import {
  getParsedCard,
  mapBody,
  mapCode,
  mapDesign,
  mapIching,
  mapKeys,
  mapRelations,
  type MdIchingSection,
  type ParsedCard,
  type YamlValue,
} from './cardMarkdown';
import type { OracleRelations } from '../lib/oracle/types';

/* ─── Public browser shape ──────────────────────────────────────────────── */

export interface SynthesisReference {
  binary: string;
  hexagram_symbol: string;
  tarot_card: string;
  hebrew_letter: string;
  hebrew_meaning: string;
  path: string;
  path_connects: string;
  astrology: string;
  queen_scale_color: string;
  hd_gate: number;
  hd_keyword: string;
  hd_center: string;
  hd_circuit: string;
  hd_harmonic_gate: string;
  /** The authored "What completes it" label, with its leading "the" dropped. */
  hd_channel_label: string;
  body_physiology: string;
  body_amino_acid: string;
  programming_partner: number | null;
}

export interface SynthesisIching {
  trigram_combination: string;
  reading: string;
  judgement_lines: string[];
  image_lines: string[];
}

export interface SynthesisGeneKeys {
  shadow: string;
  repressive: string;
  reactive: string;
  /** The named faces of the shadow ("Depressive", "Frenetic"), from the KEYS subheadings. */
  repressive_name: string;
  reactive_name: string;
  gift: string;
  siddhi: string;
  programming_partner: string;
}

export interface SynthesisTarot {
  ring_role: string;
  tarot_resonance: string;
}

export interface SynthesisHumanDesign {
  /** Plate 1 — the Gate: the felt drive itself. */
  gate: string;
  /** Plate 2 — the Centre: where the drive lives in the body. */
  channel: string;
  /** Plate 3 — the Channel: what the drive reaches for. */
  circuit: string;
}

export interface SynthesisBody {
  physiology: string;
  amino_acid: string;
}

export interface CardSynthesis {
  number: number;
  card_name: string;
  ring_name: string;
  keywords?: string[];
  essence?: string;
  /** The card's essence: three short sentences from the sheet (meta.centre), shown under the keynotes. */
  summary?: string;
  reference?: SynthesisReference;
  synthesis: {
    iching: SynthesisIching;
    gene_keys: SynthesisGeneKeys;
    tarot: SynthesisTarot;
    human_design: SynthesisHumanDesign;
    body: SynthesisBody;
  };
  /** Complete moving-line shape retained for existing/future consumers. */
  iching_extended?: MdIchingSection;
  /** Markdown-native kinship web. */
  relations?: OracleRelations;
}

/* ─── Markdown-only builder ─────────────────────────────────────────────── */

type YamlMap = Record<string, YamlValue>;

const TRIGRAM_BINARY: Readonly<Record<string, string>> = {
  Heaven: '111',
  Earth: '000',
  Thunder: '100',
  Water: '010',
  Mountain: '001',
  Wind: '011',
  Fire: '101',
  Lake: '110',
};

const synthesisCache = new Map<number, CardSynthesis>();

function pad2(number: number): string {
  return number < 10 ? `0${number}` : String(number);
}

function asMap(value: YamlValue | undefined): YamlMap | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as YamlMap
    : undefined;
}

function asString(value: YamlValue | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function required(value: string, label: string, context: string): string {
  if (!value.trim()) throw new Error(`${context}: required Markdown content is missing: ${label}`);
  return value;
}

function harmonicGate(parsed: ParsedCard, gateNumber: number): string {
  const heading = parsed.sections.DESIGN?.subheadings
    .find(section => section.heading.toLowerCase().startsWith('what completes it'))
    ?.heading ?? '';
  const match = heading.match(/\((\d+)\s*[–—-]\s*(\d+)\)/);
  if (!match) return '';
  const first = Number(match[1]);
  const second = Number(match[2]);
  return String(first === gateNumber ? second : first);
}

function referenceFor(
  parsed: ParsedCard,
  number: number,
  design: ReturnType<typeof mapDesign> & {},
  body: ReturnType<typeof mapBody> & {},
  relations: OracleRelations,
  context: string,
): SynthesisReference {
  const trigrams = asMap(parsed.frontmatter.trigrams);
  const upperName = asString(trigrams?.upper);
  const lowerName = asString(trigrams?.lower);
  const upper = TRIGRAM_BINARY[upperName];
  const lower = TRIGRAM_BINARY[lowerName];
  if (!upper || !lower) {
    throw new Error(`${context}: unknown trigram structure ${JSON.stringify({ upper: upperName, lower: lowerName })}`);
  }

  return {
    binary: `${lower}${upper}`,
    hexagram_symbol: String.fromCodePoint(0x4dc0 + number - 1),
    tarot_card: relations.tarot?.card ?? relations.codon_ring.tarot ?? '',
    hebrew_letter: relations.hebrew_letter?.letter ?? '',
    hebrew_meaning: relations.hebrew_letter?.teaching ?? '',
    path: '',
    path_connects: '',
    astrology: relations.sky?.value ?? '',
    queen_scale_color: '',
    hd_gate: design.gate_number,
    hd_keyword: design.gate_keyword,
    hd_center: design.centre,
    hd_circuit: design.channel_keywords.join(' · '),
    hd_harmonic_gate: harmonicGate(parsed, design.gate_number),
    hd_channel_label: design.channel_label.replace(/^the\s+/i, ''),
    body_physiology: body.meta?.organ ?? '',
    body_amino_acid: body.meta?.amino_acid_name ?? '',
    programming_partner: relations.programming_partner.number || null,
  };
}

function buildSynthesis(parsed: ParsedCard, cardNumber: number, context: string): CardSynthesis {
  const frontmatterNumber = parsed.frontmatter.number;
  if (frontmatterNumber !== cardNumber) {
    throw new Error(`${context}: frontmatter number ${String(frontmatterNumber)} does not match requested card ${cardNumber}`);
  }

  const cardName = required(asString(parsed.frontmatter.card_name), 'card_name', context);
  const code = mapCode(parsed);
  const iching = mapIching(parsed);
  const keys = mapKeys(parsed);
  const design = mapDesign(parsed);
  const body = mapBody(parsed);
  const relations = mapRelations(parsed);
  if (!code || !iching || !keys || !design || !body || !relations) {
    throw new Error(`${context}: one or more required Markdown lenses could not be mapped`);
  }

  if (code.keywords.length === 0) {
    throw new Error(`${context}: required Markdown content is missing: CODE keywords`);
  }
  required(code.reading, 'CODE reading', context);
  required(iching.combination, 'ICHING combination', context);
  required(iching.reading, 'ICHING reading', context);
  if (iching.judgement_lines.length === 0 || iching.image_lines.length === 0) {
    throw new Error(`${context}: required Markdown content is missing: ICHING judgement/image`);
  }
  if (iching.lines.length !== 6 || iching.lines.some((line, index) => line.line !== index + 1 || !line.reading.trim())) {
    throw new Error(`${context}: required Markdown content is missing: ICHING moving lines 1-6`);
  }
  for (const [label, value] of [
    ['KEYS shadow', keys.shadow],
    ['KEYS repressive nature', keys.repressive],
    ['KEYS reactive nature', keys.reactive],
    ['KEYS gift', keys.gift],
    ['KEYS siddhi', keys.siddhi],
    ['DESIGN drive', design.gate],
    ['DESIGN centre', design.centre_field],
    ['DESIGN channel', design.channel],
    ['BODY physiology', body.physiology],
    ['BODY amino acid', body.amino_acid],
    ['RELATIONS unity line', relations.unity_line],
    ['RELATIONS pair', relations.pair.teaching],
    ['RELATIONS inverse', relations.inverse.teaching],
    ['RELATIONS programming partner', relations.programming_partner.teaching],
    ['RELATIONS codon ring', relations.codon_ring.teaching],
  ] as const) {
    required(value, label, context);
  }

  return {
    number: cardNumber,
    card_name: cardName,
    ring_name: relations.codon_ring.name,
    keywords: code.keywords,
    essence: code.reading,
    summary: asString(asMap(parsed.frontmatter.meta)?.centre) || undefined,
    reference: referenceFor(parsed, cardNumber, design, body, relations, context),
    synthesis: {
      iching: {
        trigram_combination: iching.combination,
        reading: iching.reading,
        judgement_lines: iching.judgement_lines,
        image_lines: iching.image_lines,
      },
      gene_keys: {
        shadow: keys.shadow,
        repressive: keys.repressive,
        reactive: keys.reactive,
        repressive_name: keys.repressive_name,
        reactive_name: keys.reactive_name,
        gift: keys.gift,
        siddhi: keys.siddhi,
        programming_partner: relations.programming_partner.teaching,
      },
      tarot: {
        ring_role: relations.codon_ring.teaching,
        tarot_resonance: relations.tarot?.teaching ?? '',
      },
      human_design: {
        gate: design.gate,
        channel: design.centre_field,
        circuit: design.channel,
      },
      body: {
        physiology: body.physiology,
        amino_acid: body.amino_acid,
      },
    },
    iching_extended: iching,
    relations,
  };
}

/**
 * Build the browser's public CardSynthesis shape from its required manuscript.
 * Artwork remains linked independently by the existing card/artwork utilities;
 * versioned live invocations are loaded through the invocation API.
 */
export async function getSynthesis(cardNumber: number): Promise<CardSynthesis | undefined> {
  const cached = synthesisCache.get(cardNumber);
  if (cached) return cached;

  const context = `oracle/cards/${pad2(cardNumber)}.md`;
  const parsed = await getParsedCard(cardNumber);
  if (!parsed) throw new Error(`${context}: missing Markdown source`);

  const synthesis = buildSynthesis(parsed, cardNumber, context);
  synthesisCache.set(cardNumber, synthesis);
  return synthesis;
}
