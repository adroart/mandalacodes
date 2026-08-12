/**
 * The pure Oracle manuscript compiler.
 *
 * One function, `compileParsedCard`, turns a runtime-neutral `ParsedCard`
 * (frontmatter + `##`/`###` sections, see card-markdown.ts) into the public
 * `CanonicalCard` contract. Every consumer — the Node MCP corpus loader, the
 * browser reader, the deterministic build scripts — is meant to end up
 * calling this one implementation, so there is exactly one place that knows
 * how a card is assembled and exactly one place that decides what counts as
 * "required content is missing".
 *
 * `compileOracleCard` is the bundle-level entry point: it accepts either a
 * legacy `oracle/cards/NN.md` bundle or a target `oracle/manuscripts/NN/`
 * bundle, reduces either one to a `ParsedCard`, and calls `compileParsedCard`.
 * This is the "exactly one active source layout, one compiler" contract from
 * the editorial lifecycle design — legacy and V2 never diverge in how a card
 * is built, only in how their source text is read.
 */
import {
  mapBody,
  mapCode,
  mapDesign,
  mapIching,
  mapKeys,
  mapRelations,
  parseBody,
  parseCardMarkdown,
  type ParsedCard,
  type YamlValue,
} from './card-markdown';
import { OracleAuthoringError } from './authoring-error';
import { parseYamlRecord } from './manuscript-bundle';
import {
  ORACLE_LENSES,
  parseEditorialStatus,
  parseLegacyStatusMap,
  type EditorialStatus,
  type OracleLens,
  type OracleManuscriptBundle,
} from './manuscript-schema';
import type { CanonicalCard, CardArtwork } from './types';

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

function trigram(parsed: ParsedCard, position: 'upper' | 'lower', file: string): TrigramDefinition {
  const name = asString(asMap(parsed.frontmatter.trigrams)?.[position]);
  const definition = TRIGRAMS[name];
  if (!definition) throw new Error(`${file}: unknown ${position} trigram ${JSON.stringify(name)}`);
  return definition;
}

/**
 * The one card-construction implementation. Both the legacy adapter and the
 * V2 (per-lens manuscript) adapter reduce their source to a `ParsedCard` and
 * call this function — it is the single place that maps Markdown sections
 * onto the public `CanonicalCard` shape and decides what "required content is
 * missing" means.
 */
export function compileParsedCard(
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

export function buildSearchText(card: CanonicalCard): string {
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

/* ─── Bundle-level compiler: one active source layout, one output shape ──── */

export interface CompiledOracleCard {
  card: CanonicalCard;
  editorial: {
    statuses: Record<Lowercase<OracleLens>, EditorialStatus>;
  };
  diagnostics: never[];
}

/** V2 `_card.md` frontmatter fields the compiler understands. Unknown or
 *  duplicate structural fields are authoring errors, not silently ignored. */
const CARD_KEYS = new Set([
  'schema', 'number', 'card_name', 'hexagram_name', 'trigrams',
  'gene_keys', 'human_design', 'body', 'relations', 'iching_lines',
]);
const LENS_KEYS = new Set(['schema', 'status']);

function splitFrontmatterAndBody(raw: string, file: string): { frontmatterRaw: string; body: string } {
  const normalized = raw.replace(/\r\n?/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    throw new OracleAuthoringError([{
      code: 'ORACLE_FRONTMATTER_MISSING',
      file,
      message: 'Missing YAML frontmatter.',
      hint: 'Add a --- frontmatter block at the top of the file.',
    }]);
  }
  return { frontmatterRaw: match[1], body: match[2] };
}

function assertKnownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  file: string,
  code: string,
): void {
  const unknown = Object.keys(value).filter(key => !allowed.has(key));
  if (unknown.length > 0) {
    throw new OracleAuthoringError([{
      code,
      file,
      message: `Unknown frontmatter field(s): ${unknown.join(', ')}.`,
      hint: `Allowed fields are: ${[...allowed].join(', ')}.`,
    }]);
  }
}

/** Build a `ParsedCard` from a legacy `oracle/cards/NN.md` document using the
 *  existing hand-rolled section parser — the compatibility path. */
function parseLegacyBundle(bundle: OracleManuscriptBundle): {
  parsed: ParsedCard;
  statuses: Record<Lowercase<OracleLens>, EditorialStatus>;
} {
  const parsed = parseCardMarkdown(bundle.card.raw, bundle.card.path);
  const statuses = parseLegacyStatusMap(parsed.frontmatter.status, bundle.card.path);
  return { parsed, statuses };
}

/** Build a `ParsedCard` from a V2 `oracle/manuscripts/NN/` bundle: strict
 *  YAML frontmatter for `_card.md` and each lens file, and the same
 *  `##`/`###` section body parser reused across all six lens files. */
function parseV2Bundle(bundle: OracleManuscriptBundle): {
  parsed: ParsedCard;
  statuses: Record<Lowercase<OracleLens>, EditorialStatus>;
} {
  const { frontmatterRaw: cardFrontmatterRaw } = splitFrontmatterAndBody(bundle.card.raw, bundle.card.path);
  const cardFrontmatter = parseYamlRecord(cardFrontmatterRaw, bundle.card.path);

  if (cardFrontmatter.schema !== 'oracle-card/v2') {
    throw new OracleAuthoringError([{
      code: 'ORACLE_CARD_SCHEMA_INVALID',
      file: bundle.card.path,
      message: `_card.md schema must be "oracle-card/v2"; received ${JSON.stringify(cardFrontmatter.schema)}.`,
      hint: 'Set schema: oracle-card/v2 in the _card.md frontmatter.',
    }]);
  }
  assertKnownKeys(cardFrontmatter, CARD_KEYS, bundle.card.path, 'ORACLE_CARD_FIELD_UNKNOWN');

  const sections: Record<string, ParsedCard['sections'][string]> = {};
  const statuses = {} as Record<Lowercase<OracleLens>, EditorialStatus>;

  for (const lens of ORACLE_LENSES) {
    const key = lens.toLowerCase() as Lowercase<OracleLens>;
    const file = bundle.lenses[key];
    if (!file) {
      throw new OracleAuthoringError([{
        code: 'ORACLE_LENS_FILE_MISSING',
        card: bundle.cardNumber,
        lens,
        file: `${bundle.card.path.replace(/_card\.md$/, '')}${key}.md`,
        message: `Required lens file is missing.`,
        hint: `Add oracle/manuscripts/${String(bundle.cardNumber).padStart(2, '0')}/${key}.md.`,
      }]);
    }

    const { frontmatterRaw, body } = splitFrontmatterAndBody(file.raw, file.path);
    const lensFrontmatter = parseYamlRecord(frontmatterRaw, file.path);

    if (lensFrontmatter.schema !== 'oracle-lens/v1') {
      throw new OracleAuthoringError([{
        code: 'ORACLE_LENS_SCHEMA_INVALID',
        card: bundle.cardNumber,
        lens,
        file: file.path,
        message: `Lens schema must be "oracle-lens/v1"; received ${JSON.stringify(lensFrontmatter.schema)}.`,
        hint: 'Set schema: oracle-lens/v1 in the lens frontmatter.',
      }]);
    }
    assertKnownKeys(lensFrontmatter, LENS_KEYS, file.path, 'ORACLE_LENS_FIELD_UNKNOWN');
    statuses[key] = parseEditorialStatus(lensFrontmatter.status, `${file.path}: status`);

    const lensSections = parseBody(body, file.path);
    if (!lensSections[lens]) {
      throw new OracleAuthoringError([{
        code: 'ORACLE_LENS_HEADING_MISSING',
        card: bundle.cardNumber,
        lens,
        file: file.path,
        message: `Expected exactly one "## ${lens}" heading.`,
        hint: `Add a ## ${lens} heading at the top of the lens body.`,
      }]);
    }
    const extraHeadings = Object.keys(lensSections).filter(name => name !== lens);
    if (extraHeadings.length > 0) {
      throw new OracleAuthoringError([{
        code: 'ORACLE_LENS_HEADING_EXTRA',
        card: bundle.cardNumber,
        lens,
        file: file.path,
        message: `Lens file must contain only "## ${lens}"; found extra section(s): ${extraHeadings.join(', ')}.`,
        hint: 'Move unrelated sections to their own lens file.',
      }]);
    }
    sections[lens] = lensSections[lens];
  }

  const parsed: ParsedCard = {
    frontmatter: {
      number: cardFrontmatter.number as YamlValue,
      card_name: cardFrontmatter.card_name as YamlValue,
      hexagram_name: cardFrontmatter.hexagram_name as YamlValue,
      trigrams: cardFrontmatter.trigrams as YamlValue,
      gene_keys: cardFrontmatter.gene_keys as YamlValue,
      human_design: cardFrontmatter.human_design as YamlValue,
      body: cardFrontmatter.body as YamlValue,
      relations_data: cardFrontmatter.relations as YamlValue,
      iching_lines: cardFrontmatter.iching_lines as YamlValue,
    },
    sections,
  };

  return { parsed, statuses };
}

/**
 * The one bundle-level compiler entry point. Accepts either a legacy or V2
 * bundle and always returns the same public `CanonicalCard` shape plus
 * non-public editorial diagnostics (lens statuses). Legacy and V2 both
 * funnel into `compileParsedCard` — there is no separate browser builder and
 * Node builder.
 */
export function compileOracleCard(
  bundle: OracleManuscriptBundle,
  options: { artworks: readonly CardArtwork[] },
): CompiledOracleCard {
  const { parsed, statuses } = bundle.layout === 'legacy'
    ? parseLegacyBundle(bundle)
    : parseV2Bundle(bundle);

  const card = compileParsedCard(parsed, bundle.card.path, options.artworks);

  return { card, editorial: { statuses }, diagnostics: [] };
}
