/**
 * Canonical Oracle corpus loader.
 *
 * Authored card prose comes exclusively from oracle/cards/01.md through 64.md.
 * Missing or malformed manuscripts fail closed; aggregate, synthesis, section,
 * archive, and generated JSON never refill prose. Artwork metadata is linked
 * from data/mockData.ts. Live invocations are a separate versioned D1/private
 * R2 publication layer and are deliberately not merged here.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { FULL_ARCHIVE } from '../../../data/mockData.ts';
import {
  mapBody,
  mapCode,
  mapDesign,
  mapIching,
  mapKeys,
  mapRelations,
  parseCardMarkdown,
  type ParsedCard,
  type YamlValue,
} from '../../../lib/oracle/card-markdown.ts';
import type { CanonicalCard, MovingLine, CardArtwork } from '../../../lib/oracle/types.ts';
import { ORACLE_DIR, pad2 } from './paths.ts';

export type { CanonicalCard, MovingLine, CardArtwork };

type ArtworkMap = ReadonlyMap<number, readonly CardArtwork[]>;
type YamlMap = Record<string, YamlValue>;

interface TrigramDefinition {
  symbol: string;
  name: string;
  nature: string;
  /** Lines bottom-to-top, matching the cast runtime's binary convention. */
  binary: string;
}

/** Structural I Ching facts, not authored card prose. */
const TRIGRAMS: Readonly<Record<string, TrigramDefinition>> = {
  Heaven: {
    symbol: '☰',
    name: "Heaven (Ch'ien)",
    nature: 'Unceasing forward movement, dynamic, enduring, untiring. Spirit power. Heaven, sovereign, father.',
    binary: '111',
  },
  Earth: {
    symbol: '☷',
    name: "Earth (K'un)",
    nature: 'Surface of the world, support of all existence. Essential Yin. Rest, receptivity.',
    binary: '000',
  },
  Thunder: {
    symbol: '☳',
    name: 'Thunder (Chen)',
    nature: 'Arousing power emerging from the depth of the earth. Excite, influence, move, affect. The eldest son.',
    binary: '100',
  },
  Water: {
    symbol: '☵',
    name: "Water (K'an)",
    nature: 'Precipice, dangerous place. Stream, flowing water, river. Venture and fall. The middle son.',
    binary: '010',
  },
  Mountain: {
    symbol: '☶',
    name: 'Mountain (Ken)',
    nature: 'Limit, frontier, stillness. Solid, steady, unshakable. The youngest son.',
    binary: '001',
  },
  Wind: {
    symbol: '☴',
    name: 'Wind (Sun)',
    nature: 'Subtly penetrating. Mild, nourishing. Wood and wind. The eldest daughter.',
    binary: '011',
  },
  Fire: {
    symbol: '☲',
    name: 'Fire (Li)',
    nature: 'Glowing light spreading in all directions. The power of consciousness. Magical fire-bird. The middle daughter.',
    binary: '101',
  },
  Lake: {
    symbol: '☱',
    name: 'Lake (Tui)',
    nature: 'Open surface, interaction, pleasure, the mouth, exchange. The youngest daughter.',
    binary: '110',
  },
};

function asMap(value: YamlValue | undefined): YamlMap | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as YamlMap
    : undefined;
}

function asString(value: YamlValue | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function artworkMapFromArchive(): Map<number, CardArtwork[]> {
  const artworks = new Map<number, CardArtwork[]>();

  for (const artwork of FULL_ARCHIVE) {
    if (artwork.series !== 'Universal Language') continue;

    let number = typeof artwork.cardNumber === 'number' ? artwork.cardNumber : Number.NaN;
    if (!Number.isFinite(number)) {
      const match = String(artwork.title ?? '').match(/-\s*(\d{1,2})\s*$/) ??
        String(artwork.description ?? '').match(/Number\s+(\d{1,2})/i);
      if (match) number = Number(match[1]);
    }
    if (!Number.isInteger(number) || number < 1 || number > 64) continue;

    const linked: CardArtwork = {
      id: artwork.id,
      title: artwork.title,
      coverImage: artwork.coverImage,
      year: artwork.year,
      availability: artwork.availability,
    };
    artworks.set(number, [...(artworks.get(number) ?? []), linked]);
  }

  return artworks;
}

function validateCard(parsed: ParsedCard, expected: number, file: string): string[] {
  const issues: string[] = [];
  const number = parsed.frontmatter.number;

  if (!Number.isInteger(number) || typeof number !== 'number') {
    issues.push(`${file}: frontmatter number must be an integer`);
  } else {
    if (number < 1 || number > 64) {
      issues.push(`${file}: frontmatter number ${number} is outside the allowed range 1-64`);
    }
    if (number !== expected) {
      issues.push(`${file}: frontmatter number ${number} does not match filename number ${expected}`);
    }
  }

  if (!asString(parsed.frontmatter.card_name)) {
    issues.push(`${file}: card_name is required`);
  }

  for (const lens of ['CODE', 'ICHING', 'KEYS', 'DESIGN', 'BODY', 'RELATIONS']) {
    if (!parsed.sections[lens]) issues.push(`${file}: required lens ${lens} is missing`);
  }

  return issues;
}

function trigram(parsed: ParsedCard, position: 'upper' | 'lower', file: string): TrigramDefinition {
  const name = asString(asMap(parsed.frontmatter.trigrams)?.[position]);
  const definition = TRIGRAMS[name];
  if (!definition) throw new Error(`${file}: unknown ${position} trigram ${JSON.stringify(name)}`);
  return definition;
}

function buildCanonicalCard(
  parsed: ParsedCard,
  file: string,
  artworks: readonly CardArtwork[],
): CanonicalCard {
  const code = mapCode(parsed);
  const iching = mapIching(parsed);
  const keys = mapKeys(parsed);
  const design = mapDesign(parsed);
  const body = mapBody(parsed);
  const relations = mapRelations(parsed);

  if (!code || !iching || !keys || !design || !body || !relations) {
    throw new Error(`${file}: one or more required Markdown lenses could not be mapped`);
  }

  const requiredText: Array<[string, string]> = [
    ['CODE reading', code.reading],
    ['ICHING name', iching.hexagram_name],
    ['ICHING combination', iching.combination],
    ['ICHING reading', iching.reading],
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
  ];
  const missingText = requiredText.filter(([, value]) => !value.trim()).map(([label]) => label);
  if (code.keywords.length === 0) missingText.push('CODE keywords');
  if (iching.judgement_lines.length === 0) missingText.push('ICHING judgement');
  if (iching.image_lines.length === 0) missingText.push('ICHING image');
  if (iching.lines.length !== 6 || iching.lines.some((line, index) => line.line !== index + 1)) {
    missingText.push('ICHING moving lines 1-6');
  }
  if (missingText.length > 0) {
    throw new Error(`${file}: required Markdown content is missing: ${missingText.join(', ')}`);
  }

  const upperTrigram = trigram(parsed, 'upper', file);
  const lowerTrigram = trigram(parsed, 'lower', file);

  const card: CanonicalCard = {
    number: code.number,
    card_name: asString(parsed.frontmatter.card_name),
    ring_name: relations.codon_ring.name,
    ring_tarot: relations.codon_ring.tarot,
    keywords: code.keywords,
    essence: code.reading.split('\n\n')[0] || undefined,

    glance: { reading: code.reading },

    iching: {
      hexagram_name: iching.hexagram_name,
      trigram_combination: iching.combination,
      reading: iching.reading,
      judgement_lines: iching.judgement_lines,
      image_lines: iching.image_lines,
      upper_trigram: {
        symbol: upperTrigram.symbol,
        name: upperTrigram.name,
        nature: upperTrigram.nature,
      },
      lower_trigram: {
        symbol: lowerTrigram.symbol,
        name: lowerTrigram.name,
        nature: lowerTrigram.nature,
      },
      lines: iching.lines,
    },

    gene_keys: {
      shadow_name: keys.shadow_name,
      gift_name: keys.gift_name,
      siddhi_name: keys.siddhi_name,
      shadow: keys.shadow,
      repressive: keys.repressive,
      reactive: keys.reactive,
      gift: keys.gift,
      siddhi: keys.siddhi,
      programming_partner: relations.programming_partner.teaching,
    },

    human_design: {
      gate_number: design.gate_number,
      gate_keyword: design.gate_keyword,
      gate: design.gate,
      centre: design.centre_field,
      channel: design.channel,
    },

    tarot: {
      arcana: relations.tarot?.card ?? relations.codon_ring.tarot,
      ring_role: relations.codon_ring.teaching,
      tarot_resonance: relations.tarot?.teaching,
    },

    body: {
      physiology: body.physiology,
      amino_acid: body.amino_acid,
    },

    relations,
    reference: {
      binary: `${lowerTrigram.binary}${upperTrigram.binary}`,
      hexagram_symbol: String.fromCodePoint(0x4dc0 + code.number - 1),
    },
    artworks: [...artworks],
    searchText: '',
  };

  card.searchText = buildSearchText(card);
  return card;
}

/**
 * Build from an explicit cards directory. Exported so fail-closed validation
 * can be tested against disposable fixtures without changing authored cards.
 */
export async function loadCorpusFromDirectory(
  cardsDir: string,
  artworkMap: ArtworkMap = new Map(),
): Promise<CanonicalCard[]> {
  const parsedCards: Array<{ expected: number; file: string; parsed: ParsedCard }> = [];
  const issues: string[] = [];

  for (let expected = 1; expected <= 64; expected += 1) {
    const file = resolve(cardsDir, `${pad2(expected)}.md`);
    let raw: string;
    try {
      raw = await readFile(file, 'utf8');
    } catch (error) {
      issues.push(`${file}: missing required Markdown file (${(error as Error).message})`);
      continue;
    }

    try {
      const parsed = parseCardMarkdown(raw, file);
      issues.push(...validateCard(parsed, expected, file));
      parsedCards.push({ expected, file, parsed });
    } catch (error) {
      issues.push((error as Error).message);
    }
  }

  const firstFileByNumber = new Map<number, string>();
  for (const { file, parsed } of parsedCards) {
    const number = parsed.frontmatter.number;
    if (typeof number !== 'number' || !Number.isInteger(number)) continue;
    const first = firstFileByNumber.get(number);
    if (first) issues.push(`${file}: duplicate frontmatter number ${number} (also in ${first})`);
    else firstFileByNumber.set(number, file);
  }

  if (issues.length > 0) {
    throw new Error(`Oracle Markdown corpus validation failed:\n- ${issues.join('\n- ')}`);
  }

  const cards = parsedCards.map(({ expected, file, parsed }) =>
    buildCanonicalCard(parsed, file, artworkMap.get(expected) ?? []));
  const firstFileByBinary = new Map<string, string>();
  const binaryIssues: string[] = [];

  cards.forEach((card, index) => {
    const file = parsedCards[index].file;
    const binary = card.reference?.binary;
    if (typeof binary !== 'string' || !/^[01]{6}$/.test(binary)) {
      binaryIssues.push(`${file}: reference.binary must be exactly 6 binary digits`);
      return;
    }

    const first = firstFileByBinary.get(binary);
    if (first) binaryIssues.push(`${file}: duplicate binary ${binary} (also in ${first})`);
    else firstFileByBinary.set(binary, file);
  });

  if (binaryIssues.length > 0) {
    throw new Error(`Oracle Markdown corpus binary validation failed:\n- ${binaryIssues.join('\n- ')}`);
  }

  return cards;
}

let cache: Promise<CanonicalCard[]> | undefined;

export function loadCorpus(): Promise<CanonicalCard[]> {
  cache ??= loadCorpusFromDirectory(resolve(ORACLE_DIR, 'cards'), artworkMapFromArchive());
  return cache;
}

function buildSearchText(card: CanonicalCard): string {
  const parts: Array<string | undefined> = [
    card.card_name,
    card.ring_name,
    ...card.keywords,
    card.essence,
    card.glance.reading,
    card.iching.hexagram_name,
    card.iching.trigram_combination,
    card.iching.reading,
    ...card.iching.judgement_lines ?? [],
    ...card.iching.image_lines ?? [],
    ...card.iching.lines.flatMap(line => [line.image, line.reading, line.becomes?.name]),
    card.gene_keys.shadow_name,
    card.gene_keys.gift_name,
    card.gene_keys.siddhi_name,
    card.gene_keys.shadow,
    card.gene_keys.repressive,
    card.gene_keys.reactive,
    card.gene_keys.gift,
    card.gene_keys.siddhi,
    card.human_design.gate_keyword,
    card.human_design.gate,
    card.human_design.centre,
    card.human_design.channel,
    card.tarot.ring_role,
    card.tarot.tarot_resonance,
    card.body.physiology,
    card.body.amino_acid,
    card.relations.unity_line,
    card.relations.pair.teaching,
    card.relations.inverse.teaching,
    card.relations.programming_partner.teaching,
    card.relations.codon_ring.teaching,
    card.relations.tarot?.teaching,
    card.relations.sky?.teaching,
    card.relations.immortals?.teaching,
    card.relations.hebrew_letter?.teaching,
    ...card.artworks.map(artwork => artwork.title),
  ];
  return parts.filter((part): part is string => Boolean(part)).join(' \n ').toLowerCase();
}
