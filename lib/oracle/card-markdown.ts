/* ─── Runtime-neutral Markdown card parser ──────────────────────────────────
 *
 * Parses raw Oracle card Markdown without depending on a browser, Vite, Node,
 * or the filesystem. It handles the YAML-subset frontmatter and the `##` /
 * `###` section/subheading body, and
 * maps the result onto the SAME section object shapes that `synthesisData.ts`
 * already merges (KeysSection / DesignSection / IchingSection / BodySection,
 * plus the relations frontmatter).
 *
 * NO new npm dependency. The frontmatter is a hand-written YAML subset:
 *   key: value                    scalar (quotes stripped)
 *   key:                          nested map (indented children)
 *     child: value
 *   key: { a: b, c: [1, 2] }      inline map
 *   key: [1, 2, 3]                inline array
 *   - { line: 1, becomes: {...} } list of inline maps
 *
 * The body splitter recognises:
 *   ## SECTION         → a top-level section (ICHING, KEYS, DESIGN, BODY, RELATIONS, CODE)
 *   ### Subheading     → a subheading inside a section
 *   - bullet           → a bullet line
 *   **Line N** · …     → a moving-line marker (ICHING)
 *   prose              → everything else
 *
 * Loading and caching belong to runtime-specific adapters.
 * ─────────────────────────────────────────────────────────────────────────── */

import type { OracleRelations } from './types';

/* ─── YAML-subset frontmatter parser ─────────────────────────────────────── */

export type YamlValue = string | number | boolean | YamlValue[] | { [k: string]: YamlValue };

/** Strip matching surrounding quotes from a scalar. */
function stripQuotes(s: string): string {
  const t = s.trim();
  if (
    (t.startsWith('"') && t.endsWith('"') && t.length >= 2) ||
    (t.startsWith("'") && t.endsWith("'") && t.length >= 2)
  ) {
    return t.slice(1, -1);
  }
  return t;
}

/** Coerce a bare scalar token into string | number | boolean. */
function coerceScalar(raw: string): YamlValue {
  const t = raw.trim();
  if (t === '') return '';
  // Quoted → always a string, no coercion.
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return stripQuotes(t);
  }
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null' || t === '~') return '';
  // Integer / float (but not things like "13 - Death")
  if (/^-?\d+$/.test(t)) return parseInt(t, 10);
  if (/^-?\d+\.\d+$/.test(t)) return parseFloat(t);
  return stripQuotes(t);
}

/** Split a comma-separated inline list, respecting nested {} and []. */
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  let inStr: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      cur += ch;
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      cur += ch;
      continue;
    }
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim() !== '') out.push(cur);
  return out.map(x => x.trim());
}

/** Parse an inline value: `{ a: b }`, `[1, 2]`, or a scalar. */
function parseInline(raw: string): YamlValue {
  const t = raw.trim();
  if (t.startsWith('{') && t.endsWith('}')) {
    const inner = t.slice(1, -1).trim();
    const obj: { [k: string]: YamlValue } = {};
    if (inner === '') return obj;
    for (const part of splitTopLevel(inner)) {
      const idx = part.indexOf(':');
      if (idx === -1) continue;
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      obj[stripQuotes(key)] = parseInline(val);
    }
    return obj;
  }
  if (t.startsWith('[') && t.endsWith(']')) {
    const inner = t.slice(1, -1).trim();
    if (inner === '') return [];
    return splitTopLevel(inner).map(parseInline);
  }
  return coerceScalar(t);
}

interface FrontmatterLine {
  indent: number;
  isListItem: boolean;
  key: string | null; // null for a bare list item like `- { ... }`
  value: string; // remaining text after `key:` or after `- `
  raw: string;
}

/** Remove a YAML comment introduced by whitespace, preserving quoted hashes. */
function stripInlineComment(value: string): string {
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (quote) {
      if (ch === quote && (quote === "'" || value[i - 1] !== '\\')) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '#' && (i === 0 || /\s/.test(value[i - 1]))) {
      return value.slice(0, i).trimEnd();
    }
  }
  return value;
}

function tokenizeFrontmatter(lines: string[]): FrontmatterLine[] {
  const out: FrontmatterLine[] = [];
  for (const raw of lines) {
    const uncommented = stripInlineComment(raw);
    if (uncommented.trim() === '') continue;
    const indent = raw.length - raw.replace(/^\s+/, '').length;
    let rest = uncommented.trim();
    let isListItem = false;
    if (rest.startsWith('- ')) {
      isListItem = true;
      rest = rest.slice(2).trim();
    } else if (rest === '-') {
      isListItem = true;
      rest = '';
    }
    // Does the remainder start with `key:`? (only if not an inline {..}/[..])
    let key: string | null = null;
    let value = rest;
    if (!rest.startsWith('{') && !rest.startsWith('[')) {
      const m = rest.match(/^([A-Za-z0-9_]+):(.*)$/);
      if (m) {
        key = m[1];
        value = m[2].trim();
      }
    }
    out.push({ indent, isListItem, key, value, raw });
  }
  return out;
}

/**
 * Build a nested object from tokenized frontmatter lines, starting at `start`,
 * consuming everything indented deeper than `parentIndent`. Returns the parsed
 * structure plus the index of the next unconsumed line.
 */
function parseBlock(
  toks: FrontmatterLine[],
  start: number,
  parentIndent: number,
): { value: YamlValue; next: number } {
  // Decide list vs map by the first child.
  let i = start;
  const first = toks[i];
  if (!first) return { value: {}, next: i };

  if (first.isListItem) {
    const arr: YamlValue[] = [];
    const listIndent = first.indent;
    while (i < toks.length && toks[i].isListItem && toks[i].indent === listIndent) {
      const item = toks[i];
      if (item.key === null) {
        // bare list item, e.g. `- { line: 1, becomes: {...} }` or `- scalar`
        arr.push(parseInline(item.value));
        i++;
      } else {
        // list item that opens a map: `- key: value` then deeper children
        const obj: { [k: string]: YamlValue } = {};
        // The key on this same line:
        if (item.value === '') {
          const child = parseBlock(toks, i + 1, item.indent);
          obj[item.key] = child.value;
          i = child.next;
        } else {
          obj[item.key] = parseInline(item.value);
          i++;
        }
        // Continuation keys of the same map item (deeper indent, not list items)
        while (
          i < toks.length &&
          !toks[i].isListItem &&
          toks[i].indent > listIndent &&
          toks[i].key !== null
        ) {
          const cont = toks[i];
          if (cont.value === '') {
            const child = parseBlock(toks, i + 1, cont.indent);
            obj[cont.key as string] = child.value;
            i = child.next;
          } else {
            obj[cont.key as string] = parseInline(cont.value);
            i++;
          }
        }
        arr.push(obj);
      }
    }
    return { value: arr, next: i };
  }

  // Map block.
  const obj: { [k: string]: YamlValue } = {};
  const mapIndent = first.indent;
  while (i < toks.length && !toks[i].isListItem && toks[i].indent === mapIndent) {
    const t = toks[i];
    if (t.key === null) break; // not a key line; bail
    if (t.value === '') {
      // nested block (map or list) on following deeper lines
      const childStart = i + 1;
      if (
        childStart < toks.length &&
        toks[childStart].indent > mapIndent
      ) {
        const child = parseBlock(toks, childStart, mapIndent);
        obj[t.key] = child.value;
        i = child.next;
      } else {
        obj[t.key] = '';
        i++;
      }
    } else {
      obj[t.key] = parseInline(t.value);
      i++;
    }
  }
  return { value: obj, next: i };
}

function parseFrontmatter(block: string): Record<string, YamlValue> {
  const toks = tokenizeFrontmatter(block.split('\n'));
  const { value } = parseBlock(toks, 0, -1);
  return (value && typeof value === 'object' && !Array.isArray(value))
    ? (value as Record<string, YamlValue>)
    : {};
}

/* ─── Body (sections / subheadings) parser ───────────────────────────────── */

export interface MdSubheading {
  /** The full heading text after `### `, e.g. "Repressive nature — Anal". */
  heading: string;
  /** Prose paragraphs (joined with \n\n on demand). */
  paragraphs: string[];
  /** Bullet lines (lines that began with `- `). */
  bullets: string[];
  /** Raw lines, in order, for callers that need finer control (moving lines). */
  rawLines: string[];
}

export interface MdSection {
  name: string; // ICHING, KEYS, DESIGN, BODY, RELATIONS, CODE
  /** Prose that sits directly under `## SECTION` before the first `###`. */
  intro: string[];
  subheadings: MdSubheading[];
}

export interface ParsedCard {
  frontmatter: Record<string, YamlValue>;
  sections: Record<string, MdSection>;
}

function flushParagraph(buf: string[], paragraphs: string[]): void {
  const joined = buf.join(' ').trim();
  if (joined !== '') paragraphs.push(joined);
  buf.length = 0;
}

function parseBody(body: string, context: string): Record<string, MdSection> {
  const lines = body.split('\n');
  const sections: Record<string, MdSection> = {};
  let curSection: MdSection | null = null;
  let curSub: MdSubheading | null = null;
  // Paragraph accumulation buffer for the current target (intro or sub).
  let paraBuf: string[] = [];

  const targetParagraphs = (): string[] =>
    curSub ? curSub.paragraphs : curSection ? curSection.intro : [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    const trimmed = line.trim();

    // Skip HTML comments and the top `# ` title line.
    if (trimmed.startsWith('<!--') || trimmed.startsWith('# ')) {
      continue;
    }

    const h2 = trimmed.match(/^##\s+(.+)$/);
    const h3 = trimmed.match(/^###\s+(.+)$/);

    if (h2) {
      flushParagraph(paraBuf, targetParagraphs());
      const sectionName = h2[1].trim();
      if (Object.hasOwn(sections, sectionName)) {
        throw new Error(`${context}: duplicate top-level section ${sectionName}`);
      }
      curSection = { name: sectionName, intro: [], subheadings: [] };
      curSub = null;
      sections[curSection.name] = curSection;
      continue;
    }
    if (h3) {
      flushParagraph(paraBuf, targetParagraphs());
      if (!curSection) continue;
      curSub = { heading: h3[1].trim(), paragraphs: [], bullets: [], rawLines: [] };
      curSection.subheadings.push(curSub);
      continue;
    }

    // Track raw lines for the active subheading (used by moving-line parsing).
    if (curSub) curSub.rawLines.push(line);

    if (trimmed === '') {
      flushParagraph(paraBuf, targetParagraphs());
      continue;
    }

    // Bullet line.
    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph(paraBuf, targetParagraphs());
      const bulletText = trimmed.replace(/^[-*]\s+/, '').trim();
      if (curSub) curSub.bullets.push(bulletText);
      else if (curSection) {
        // intro-level bullet: keep it as a paragraph so nothing is lost
        targetParagraphs().push(bulletText);
      }
      continue;
    }

    // Plain prose line → accumulate into the current paragraph.
    paraBuf.push(trimmed);
  }
  flushParagraph(paraBuf, targetParagraphs());
  return sections;
}

/* ─── Public: parse a full card markdown string ──────────────────────────── */

export function parseCardMarkdown(raw: string, context = 'oracle card'): ParsedCard {
  const normalized = raw.replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
  const fmMatch = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fmMatch) throw new Error(`${context}: missing YAML frontmatter`);

  return {
    frontmatter: parseFrontmatter(fmMatch[1]),
    sections: parseBody(fmMatch[2], context),
  };
}

/* ─── Section-shape mappers (Markdown → existing overlay object shapes) ───── */

/* ── CODE (the opening face) ──
 * The `## CODE` section has no `###` subheadings: its content lands entirely in
 * `section.intro[]`. The first intro paragraph is the `_Keywords:_ a · b · c`
 * line; the remaining paragraphs are the three-movement opening reading. */
export interface MdCodeSection {
  number: number;
  keywords: string[];
  /** The opening reading, paragraphs rejoined with blank lines between. */
  reading: string;
}

export function mapCode(parsed: ParsedCard): MdCodeSection | undefined {
  const sec = parsed.sections['CODE'];
  if (!sec) return undefined;

  const intro = sec.intro;
  let keywords: string[] = [];
  const readingParas: string[] = [];

  for (const p of intro) {
    const kw = p.match(/^_?Keywords:_?\s*(.+)$/i);
    if (kw && keywords.length === 0) {
      keywords = kw[1]
        .split('·')
        .map(s => s.replace(/[_*]/g, '').trim())
        .filter(Boolean);
      continue;
    }
    readingParas.push(p);
  }

  return {
    number: num(parsed.frontmatter['number']),
    keywords,
    reading: readingParas.join('\n\n'),
  };
}

/** Find a subheading whose heading starts with `prefix` (case-insensitive). */
function findSub(section: MdSection | undefined, prefix: string): MdSubheading | undefined {
  if (!section) return undefined;
  const p = prefix.toLowerCase();
  return section.subheadings.find(s => s.heading.toLowerCase().startsWith(p));
}

const para = (s: MdSubheading | undefined): string =>
  s ? s.paragraphs.join('\n\n') : '';

/** The name after an em-dash / hyphen in a heading, e.g.
 *  "Repressive nature — Anal" → "Anal"; "The drive — Gate 3, Ordering" → "Gate 3, Ordering". */
function headingTail(heading: string): string {
  const m = heading.split(/\s+[—–-]\s+/);
  return m.length > 1 ? m.slice(1).join(' — ').trim() : '';
}

function str(v: YamlValue | undefined, fallback = ''): string {
  if (v === undefined || v === null) return fallback;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return fallback;
}

function num(v: YamlValue | undefined, fallback = 0): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) return parseInt(v, 10);
  return fallback;
}

/* ── KEYS ── */
export interface MdKeysSection {
  number: number;
  shadow_name: string;
  gift_name: string;
  siddhi_name: string;
  shadow: string;
  repressive: string;
  reactive: string;
  gift: string;
  siddhi: string;
  /** New, MD-only: the named repressive/reactive faces (e.g. "Anal"). */
  repressive_name: string;
  reactive_name: string;
}

export function mapKeys(parsed: ParsedCard): MdKeysSection | undefined {
  const sec = parsed.sections['KEYS'];
  if (!sec) return undefined;
  const gk = parsed.frontmatter['gene_keys'] as { [k: string]: YamlValue } | undefined;

  const shadowSub = findSub(sec, 'Shadow');
  const repSub = findSub(sec, 'Repressive');
  const reaSub = findSub(sec, 'Reactive');
  const giftSub = findSub(sec, 'Gift');
  const siddhiSub = findSub(sec, 'Siddhi');

  return {
    number: num(parsed.frontmatter['number']),
    shadow_name: str(gk?.['shadow']) || headingTail(shadowSub?.heading ?? ''),
    gift_name: str(gk?.['gift']) || headingTail(giftSub?.heading ?? ''),
    siddhi_name: str(gk?.['siddhi']) || headingTail(siddhiSub?.heading ?? ''),
    shadow: para(shadowSub),
    repressive: para(repSub),
    reactive: para(reaSub),
    gift: para(giftSub),
    siddhi: para(siddhiSub),
    repressive_name: headingTail(repSub?.heading ?? ''),
    reactive_name: headingTail(reaSub?.heading ?? ''),
  };
}

/* ── DESIGN ── */
export interface MdDesignSection {
  number: number;
  gate_number: number;
  gate_keyword: string;
  centre: string;
  channel_keywords: string[];
  gate: string;
  centre_field: string;
  channel: string;
  /** New, MD-only: the full "Gate N, Keyword" tail of the drive heading. */
  drive_label: string;
}

export function mapDesign(parsed: ParsedCard): MdDesignSection | undefined {
  const sec = parsed.sections['DESIGN'];
  if (!sec) return undefined;
  const hd = parsed.frontmatter['human_design'] as { [k: string]: YamlValue } | undefined;

  const driveSub = findSub(sec, 'The drive');
  const livesSub = findSub(sec, 'Where it lives');
  const completesSub = findSub(sec, 'What completes it');

  const channelRaw = hd?.['channel'];
  const channelKeywords =
    typeof channelRaw === 'string' && channelRaw.trim() !== ''
      ? [channelRaw.trim()]
      : Array.isArray(channelRaw)
        ? channelRaw.map(x => str(x))
        : [];

  return {
    number: num(parsed.frontmatter['number']),
    gate_number: num(hd?.['gate_number']),
    gate_keyword: str(hd?.['gate_keyword']),
    centre: str(hd?.['centre']),
    channel_keywords: channelKeywords,
    gate: para(driveSub),
    centre_field: para(livesSub),
    channel: para(completesSub),
    drive_label: headingTail(driveSub?.heading ?? ''),
  };
}

/* ── ICHING ── */
export interface MdIchingLine {
  line: number;
  image: string;
  reading: string;
  becomes: { hexagram: number; name: string };
}
export interface MdIchingSection {
  number: number;
  hexagram_name: string;
  combination: string;
  upper_nature: string;
  lower_nature: string;
  reading: string;
  judgement_lines: string[];
  image_lines: string[];
  lines: MdIchingLine[];
}

/**
 * Moving lines look like:
 *   **Line 1** · _image:_ a soapnut tree… → becomes Hexagram 8, Holding Together.
 *   prose…
 * The marker line carries line number, image, and becomes; the following prose
 * lines are the reading. We use the section's frontmatter `iching_lines` for the
 * authoritative becomes{hexagram,name} and fall back to the inline text.
 */
function parseMovingLines(
  sub: MdSubheading | undefined,
  fmLines: YamlValue | undefined,
): MdIchingLine[] {
  if (!sub) return [];
  const fmMap = new Map<number, { hexagram: number; name: string }>();
  if (Array.isArray(fmLines)) {
    for (const entry of fmLines) {
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        const e = entry as { [k: string]: YamlValue };
        const ln = num(e['line']);
        const becomes = e['becomes'] as { [k: string]: YamlValue } | undefined;
        if (becomes) {
          fmMap.set(ln, {
            hexagram: num(becomes['hexagram']),
            name: str(becomes['name']),
          });
        }
      }
    }
  }

  const out: MdIchingLine[] = [];
  let cur: MdIchingLine | null = null;
  const proseBuf: string[] = [];

  const flush = () => {
    if (cur) {
      cur.reading = proseBuf.join(' ').replace(/\s+/g, ' ').trim();
      out.push(cur);
    }
    proseBuf.length = 0;
  };

  for (const raw of sub.rawLines) {
    const line = raw.trim();
    if (line === '') continue;
    const marker = line.match(/^\*\*Line\s+(\d+)\*\*\s*·?\s*(.*)$/);
    if (marker) {
      flush();
      const lineNum = parseInt(marker[1], 10);
      let remainder = marker[2];
      // Pull out the image: between `_image:_` and `→`.
      let image = '';
      const imgMatch = remainder.match(/_image:_\s*(.*?)\s*(?:→|->)/);
      if (imgMatch) image = imgMatch[1].trim();
      // becomes text after the arrow, e.g. "becomes Hexagram 8, Holding Together."
      const becomesMatch = remainder.match(/(?:→|->)\s*becomes\s+Hexagram\s+(\d+),\s*(.+?)\.?\s*$/i);
      const fmEntry = fmMap.get(lineNum);
      const becomes = fmEntry ?? {
        hexagram: becomesMatch ? parseInt(becomesMatch[1], 10) : 0,
        name: becomesMatch ? becomesMatch[2].trim() : '',
      };
      cur = { line: lineNum, image, reading: '', becomes };
      continue;
    }
    if (cur) proseBuf.push(line);
  }
  flush();
  return out;
}

export function mapIching(parsed: ParsedCard): MdIchingSection | undefined {
  const sec = parsed.sections['ICHING'];
  if (!sec) return undefined;

  const comboSub = findSub(sec, 'Combination');
  const upperSub = findSub(sec, 'Upper trigram');
  const lowerSub = findSub(sec, 'Lower trigram');
  const readingSub = findSub(sec, 'Reading');
  const judgementSub = findSub(sec, 'Judgement');
  const imageSub = findSub(sec, 'Image');
  const movingSub = findSub(sec, 'Moving lines');

  return {
    number: num(parsed.frontmatter['number']),
    hexagram_name: str(parsed.frontmatter['hexagram_name']),
    combination: para(comboSub),
    upper_nature: para(upperSub),
    lower_nature: para(lowerSub),
    reading: para(readingSub),
    judgement_lines: judgementSub?.bullets ?? [],
    image_lines: imageSub?.bullets ?? [],
    lines: parseMovingLines(movingSub, parsed.frontmatter['iching_lines']),
  };
}

/* ── BODY ── */
export interface MdBodySection {
  number: number;
  physiology: string;
  amino_acid: string;
  meta?: { organ?: string; amino_acid_name?: string; codon_ring?: string };
}

export function mapBody(parsed: ParsedCard): MdBodySection | undefined {
  const sec = parsed.sections['BODY'];
  if (!sec) return undefined;
  const body = parsed.frontmatter['body'] as { [k: string]: YamlValue } | undefined;

  const physioSub = findSub(sec, 'Physiology');
  const aminoSub = findSub(sec, 'Amino acid');

  return {
    number: num(parsed.frontmatter['number']),
    physiology: para(physioSub),
    amino_acid: para(aminoSub),
    meta: body
      ? {
          organ: str(body['organ']) || undefined,
          amino_acid_name: str(body['amino_acid']) || undefined,
          codon_ring: str(body['codon_ring']) || undefined,
        }
      : undefined,
  };
}

/* ── RELATIONS ── */
type YamlMap = { [k: string]: YamlValue };

function map(v: YamlValue | undefined): YamlMap | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as YamlMap : undefined;
}

function numberArray(v: YamlValue | undefined): number[] {
  return Array.isArray(v)
    ? v.map(value => num(value, Number.NaN)).filter(Number.isFinite)
    : [];
}

function withoutOuterEmphasis(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^([_*]{1,2})([\s\S]*?)\1$/);
  return match ? match[2].trim() : trimmed;
}

function cleanRelationsProse(value: string): string {
  return withoutOuterEmphasis(value)
    .replace(/\s*_?\[FLAG:[\s\S]*?\]_?/gi, '')
    .replace(/\s*\(Derived[\s\S]*?see note\.\)\s*$/gi, '')
    .trim();
}

function relationTeaching(sub: MdSubheading | undefined): string {
  return cleanRelationsProse(para(sub));
}

function referencedUl(heading: string): number | undefined {
  const match = heading.match(/\bUL\s+(\d+)\b/i);
  return match ? parseInt(match[1], 10) : undefined;
}

function referencedName(
  heading: string,
): { card_name?: string; hexagram_name?: string } {
  const match = heading.match(/\bUL\s+\d+\s*,\s*(.+)$/i);
  if (!match) return {};

  let name = match[1].trim();
  let hexagramName: string | undefined;
  const parenthetical = name.match(/\s+\(([^()]*)\)\s*$/);
  if (parenthetical && !/self[- ]inverse|one of the eight/i.test(parenthetical[1])) {
    hexagramName = parenthetical[1].trim();
    name = name.slice(0, parenthetical.index).trim();
  } else if (parenthetical) {
    name = name.slice(0, parenthetical.index).trim();
  }

  return {
    card_name: name || undefined,
    hexagram_name: hexagramName,
  };
}

function findReferencedRelationship(
  section: MdSection,
  number: number,
): MdSubheading | undefined {
  return section.subheadings.find(sub =>
    referencedUl(sub.heading) === number &&
    !/^Programming partner\b/i.test(sub.heading),
  );
}

function findPairRelationship(
  section: MdSection,
  pairNumber: number,
): MdSubheading | undefined {
  const labelled = section.subheadings.find(sub =>
    /^Pair\b/i.test(sub.heading) && referencedUl(sub.heading) === pairNumber,
  );
  return labelled ?? findReferencedRelationship(section, pairNumber);
}

function findInverseRelationship(
  section: MdSection,
  inverseNumber: number,
  isSelfInverse: boolean,
): MdSubheading | undefined {
  const labelled = section.subheadings.find(sub =>
    /\bInverse\b/i.test(sub.heading) &&
    (referencedUl(sub.heading) === undefined || referencedUl(sub.heading) === inverseNumber),
  );
  if (labelled) return labelled;

  if (isSelfInverse) {
    const reflection = section.subheadings.find(sub =>
      /\b(?:itself|self-inverse|own reflection)\b/i.test(sub.heading) &&
      (referencedUl(sub.heading) === undefined || referencedUl(sub.heading) === inverseNumber),
    );
    if (reflection) return reflection;
  }

  return findReferencedRelationship(section, inverseNumber);
}

function parseCorrelation(
  section: MdSection,
  label: string,
): { value: string; teaching: string } | undefined {
  const deeper = findSub(section, 'Deeper correlation');
  const pattern = new RegExp(`^\\*\\*${label}\\s+[—–-]\\s+(.+?):\\*\\*\\s*(.*)$`, 'i');
  for (const bullet of deeper?.bullets ?? []) {
    const match = bullet.match(pattern);
    if (match) {
      return {
        value: match[1].trim(),
        teaching: cleanRelationsProse(match[2]),
      };
    }
  }
  return undefined;
}

export function mapRelations(parsed: ParsedCard): OracleRelations | undefined {
  const section = parsed.sections['RELATIONS'];
  if (!section) return undefined;

  const relationsData = map(parsed.frontmatter['relations_data']);
  const trigrams = map(parsed.frontmatter['trigrams']);
  const pairNumber = num(relationsData?.['pair']);
  const inverseNumber = num(relationsData?.['inverse']);
  const isSelfInverse = relationsData?.['is_self_inverse'] === true ||
    (inverseNumber > 0 && inverseNumber === num(parsed.frontmatter['number']));
  const programmingPartnerNumber = num(relationsData?.['programming_partner']);

  const pairSub = findPairRelationship(section, pairNumber);
  const inverseSub = findInverseRelationship(section, inverseNumber, isSelfInverse);
  const programmingPartnerSub = section.subheadings.find(sub =>
    /^Programming partner\b/i.test(sub.heading) &&
    (referencedUl(sub.heading) === undefined || referencedUl(sub.heading) === programmingPartnerNumber),
  );
  const codonRingSub = findSub(section, 'Codon ring');
  const tarotSub = findSub(section, 'Tarot');
  const immortalsSub = findSub(section, 'Immortals');
  const pairName = referencedName(pairSub?.heading ?? '');
  const programmingPartnerName = referencedName(programmingPartnerSub?.heading ?? '');

  const tarotCard = str(relationsData?.['tarot_ring_arcana']) || undefined;
  const tarotTeaching = relationTeaching(tarotSub);
  const immortalData = map(relationsData?.['immortals']);
  const upperImmortal = str(immortalData?.['upper']);
  const lowerImmortal = str(immortalData?.['lower']);
  const upperTrigram = str(trigrams?.['upper']) || undefined;
  const lowerTrigram = str(trigrams?.['lower']) || undefined;
  const immortalsTeaching = relationTeaching(immortalsSub);
  const sky = parseCorrelation(section, 'Sky');
  const hebrew = parseCorrelation(section, 'Hebrew letter');

  return {
    number: num(parsed.frontmatter['number']),
    card_name: str(parsed.frontmatter['card_name']),
    unity_line: cleanRelationsProse(section.intro.join('\n\n')),
    pair: {
      number: pairNumber,
      card_name: pairName.card_name,
      hexagram_name: pairName.hexagram_name,
      teaching: relationTeaching(pairSub),
    },
    inverse: {
      number: inverseNumber,
      is_self_inverse: isSelfInverse,
      teaching: relationTeaching(inverseSub),
    },
    programming_partner: {
      number: programmingPartnerNumber,
      card_name: programmingPartnerName.card_name,
      teaching: relationTeaching(programmingPartnerSub),
    },
    codon_ring: {
      name: str(relationsData?.['codon_ring']),
      tarot: str(relationsData?.['tarot_ring_arcana']) || undefined,
      siblings: numberArray(relationsData?.['ring_siblings']),
      teaching: relationTeaching(codonRingSub),
    },
    tarot: tarotCard || tarotTeaching
      ? { card: tarotCard, teaching: tarotTeaching }
      : undefined,
    sky: sky
      ? { value: sky.value, teaching: sky.teaching }
      : undefined,
    immortals: upperImmortal && lowerImmortal
      ? {
          upper: { trigram: upperTrigram, name: upperImmortal },
          lower: { trigram: lowerTrigram, name: lowerImmortal },
          same_trigram: immortalData?.['same_trigram'] === true ||
            (upperTrigram !== undefined && upperTrigram === lowerTrigram),
          teaching: immortalsTeaching,
        }
      : undefined,
    hebrew_letter: hebrew
      ? {
          letter: hebrew.value.split(',')[0].trim(),
          teaching: hebrew.teaching,
        }
      : undefined,
  };
}
