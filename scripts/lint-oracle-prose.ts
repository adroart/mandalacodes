#!/usr/bin/env tsx
/**
 * Prose lint for the Oracle manuscripts.
 *
 * Enforces the house voice rules from `oracle/00_MASTER_WRITING_GUIDE.md` §7
 * and `oracle/INDEX.md` ("Two house rules that apply to every word") on
 * `oracle/cards/*.md` and `oracle/readings/*.md`. Scope is prose only: YAML
 * frontmatter and HTML comments (the sourcing-log / meta blocks) are excluded
 * before any rule runs.
 *
 * ERRORS fail the build (non-zero exit):
 *   1. Italics in prose — a single `*word*` or `_word_` span. Bold `**` is
 *      fine. The structural field labels `_Keywords:_` and `_image:_` are
 *      manuscript syntax the parser consumes into data (see
 *      lib/oracle/card-markdown.ts mapCode / parseMovingLines) — never shown
 *      to a reader as italics — so a lone underscore-wrapped label ending in
 *      a colon is not prose emphasis and is exempt.
 *   2. Sentence-internal em dash (—). Allowed only as a structural delimiter
 *      in a heading line (`### The drive — Gate 24`) or inside the leading
 *      bold label of a `- **Label — Value**` bullet (`- **Sky — Mercury:**
 *      …`). An em dash anywhere else on the line is an error.
 *   3. An editorial flag or sourcing-note leak left in shipped text:
 *      `[FLAG`, `(FLAG`, `TODO`, `_[`, `[[`, plus a phrase list of
 *      sourcing/audit-trail vocabulary that has repeatedly leaked out of
 *      frontmatter/comments into visible prose as a plain aside (see
 *      `EDITORIAL_LEAK_PHRASES` below — "vault index", "empty stub",
 *      "Golden Dawn attribution", etc.). Deliberately excludes generic
 *      connector phrases like "derived from" / "carried from" that also
 *      occur in legitimate prose — those are caught by manual review, not
 *      this gate.
 *
 * WARNINGS print but do not fail the build:
 *   4. Banned vocabulary from the voice-profile AGAINST list (generic
 *      wellness / spiritual-coaching language), counted per lens.
 *   5. Two cards in the same lens opening on the same first six words.
 *
 * Run: `npm run lint:prose` (also wired into `prebuild`, beside the corpus
 * build, so `npm run build` fails on an error).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* ─── Shared types ────────────────────────────────────────────────────── */

export interface LintIssue {
  file: string;
  line: number;
  rule: 'italics' | 'em-dash' | 'editorial-flag';
  message: string;
  excerpt: string;
}

export interface VocabHit {
  term: string;
  line: number;
  lens: string;
}

export interface OpeningStem {
  file: string;
  lens: string;
  stem: string;
  card: string;
}

export interface FileLintResult {
  errors: LintIssue[];
  vocabHits: VocabHit[];
  openingStems: OpeningStem[];
}

/* ─── Step 0: blank frontmatter + HTML comments, preserving line numbers ─ */

/**
 * Blank the YAML frontmatter block (between the opening and closing `---`)
 * to spaces, keeping every newline so line numbers in the rest of the file
 * are unaffected. Files without a recognisable frontmatter block are left
 * untouched (defensive — every card/reading has one, but a lint tool should
 * not throw on a malformed manuscript, the corpus builder already does that).
 */
export function blankFrontmatter(raw: string): string {
  const normalized = raw.replace(/\r\n?/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return normalized;
  const blanked = match[0].replace(/[^\n]/g, ' ');
  return blanked + normalized.slice(match[0].length);
}

/**
 * Blank HTML comments (`<!-- … -->`) to spaces, preserving newlines. An
 * unclosed comment blanks to end of file rather than leaking into whatever
 * follows it (the fault fixed on card 64, see oracle/cards/64.md RELATIONS).
 */
export function blankHtmlComments(text: string): string {
  let out = '';
  let inComment = false;
  let i = 0;
  while (i < text.length) {
    if (!inComment && text.startsWith('<!--', i)) {
      inComment = true;
      out += '    ';
      i += 4;
      continue;
    }
    if (inComment && text.startsWith('-->', i)) {
      inComment = false;
      out += '   ';
      i += 3;
      continue;
    }
    const ch = text[i];
    out += inComment ? (ch === '\n' ? '\n' : ' ') : ch;
    i += 1;
  }
  return out;
}

/** Prose body with frontmatter and comments blanked, line numbers intact. */
export function stripToProse(raw: string): string {
  return blankHtmlComments(blankFrontmatter(raw));
}

/* ─── Rule 1: italics ─────────────────────────────────────────────────── */

const STRUCTURAL_LABEL = /^[A-Za-z][A-Za-z ]*:$/;

/** Mask `` `code spans` `` to same-length spaces first: a filename or field
 *  name inside backticks (`` `_hexagram-64.md` ``, `` `_per_card_reference.json` ``)
 *  is not prose and its underscores are not emphasis markers. */
function maskCodeSpans(line: string): string {
  return line.replace(/`[^`\n]*`/g, m => ' '.repeat(m.length));
}

/** Mask `**bold**` / `__bold__` spans to same-length spaces so they cannot
 *  be mistaken for a single-marker italics span by the checks below. */
function maskBoldSpans(line: string): string {
  return line
    .replace(/\*\*[^*\n]*\*\*/g, m => ' '.repeat(m.length))
    .replace(/__[^_\n]*__/g, m => ' '.repeat(m.length));
}

/**
 * Mask `snake_case_identifier` runs (`per_card_reference`,
 * `metaphysical_correspondence`, `golden_dawn_attribution` — sourcing-log
 * field and file names quoted straight into a bullet without backticks) to
 * same-length spaces. These are not emphasis: an inner underscore with a
 * word character on both sides can never open or close it. This is the
 * general case; `findUnderscoreItalics` below additionally handles the
 * specific case where a genuine emphasis span still starts or ends right
 * next to one of these identifiers, e.g. `_(carried from per_card_reference…)_`.
 */
function maskSnakeCaseIdentifiers(line: string): string {
  return line.replace(/_?[A-Za-z0-9]+(?:_[A-Za-z0-9]+)+/g, m => ' '.repeat(m.length));
}

function isWordChar(ch: string | undefined): boolean {
  return !!ch && /[A-Za-z0-9]/.test(ch);
}

/**
 * Underscore emphasis, CommonMark-style: an underscore with a word
 * character on BOTH sides is intraword (`per_card_reference`) and can never
 * open or close emphasis — otherwise every snake_case identifier the source
 * material references (`metaphysical_correspondence`, `golden_dawn_attribution`)
 * would misread as an italics span. A real opener/closer only needs word
 * chars on at most one side; the scan pairs the first eligible opener with
 * the next eligible closer, skipping over any intraword underscores in
 * between as ordinary text (so `_(carried from _per_card_reference; …)_`
 * still resolves to one span, not three).
 */
function findUnderscoreItalics(line: string): Array<{ index: number; text: string }> {
  const hits: Array<{ index: number; text: string }> = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '_' && !(isWordChar(line[i - 1]) && isWordChar(line[i + 1]))) {
      let j = i + 1;
      let closeIdx = -1;
      while (j < line.length) {
        if (line[j] === '_' && !(isWordChar(line[j - 1]) && isWordChar(line[j + 1]))) {
          closeIdx = j;
          break;
        }
        j += 1;
      }
      if (closeIdx > i + 1) {
        hits.push({ index: i, text: line.slice(i, closeIdx + 1) });
        i = closeIdx + 1;
        continue;
      }
    }
    i += 1;
  }
  return hits;
}

export function checkItalics(line: string): Array<{ index: number; text: string }> {
  const masked = maskSnakeCaseIdentifiers(maskBoldSpans(maskCodeSpans(line)));
  const hits: Array<{ index: number; text: string }> = [];

  const starRe = /\*([^*\n]+)\*/g;
  let m: RegExpExecArray | null;
  while ((m = starRe.exec(masked))) {
    hits.push({ index: m.index, text: m[0] });
  }

  for (const hit of findUnderscoreItalics(masked)) {
    const inner = hit.text.slice(1, -1).trim();
    if (STRUCTURAL_LABEL.test(inner)) continue; // `_Keywords:_`, `_image:_`
    hits.push(hit);
  }

  return hits.sort((a, b) => a.index - b.index);
}

/* ─── Rule 2: sentence-internal em dash ──────────────────────────────── */

const EM_DASH = '\u2014';

export function isHeadingLine(line: string): boolean {
  return /^#{1,6}\s+/.test(line.trim());
}

/** The leading `- **Label — Value**` bullet form: the em dash inside that
 *  first bold span is the allowed structural delimiter. */
function bulletLabelSpanLength(line: string): number {
  const m = line.match(/^-\s+\*\*([^*\n]*)\*\*/);
  if (m && m[1].includes(EM_DASH)) return m[0].length;
  return 0;
}

export function checkEmDash(line: string): number[] {
  if (isHeadingLine(line)) return [];
  const allowedUpTo = bulletLabelSpanLength(line);
  const hits: number[] = [];
  let idx = line.indexOf(EM_DASH);
  while (idx !== -1) {
    if (idx >= allowedUpTo) hits.push(idx);
    idx = line.indexOf(EM_DASH, idx + 1);
  }
  return hits;
}

/* ─── Rule 3: editorial flags left in shipped text ───────────────────── */

const FLAG_PATTERNS: Array<{ needle: string; label: string }> = [
  { needle: '[FLAG', label: '[FLAG' },
  { needle: '(FLAG', label: '(FLAG' },
  { needle: 'TODO', label: 'TODO' },
  { needle: '_[', label: '_[' },
  { needle: '[[', label: '[[' },
];

/**
 * Editorial-leak phrases: sourcing/audit-trail vocabulary from the
 * manuscript's `meta:sourcing` blocks and `_hexagram-NN.md`-style vault
 * cross-references that has, in practice, leaked out of frontmatter/comments
 * and into shipped prose as a plain aside (cards 09, 11, 15, 16, 17, 20, 24,
 * 25, 28, 30, 31, 32, 36, 40, 44, 45, 55, 56, 57, 60, 61 — see the 2026-09-08
 * revision of PR #171). None of these terms occur in the deck's own reading
 * voice, so a hit is always a leak, never a false positive on real prose.
 * Deliberately narrower than it could be: "derived from" / "carried from"
 * are NOT included here even though they appear in several of those same
 * leaks, because both phrases also occur in legitimate manuscript sentences
 * (a shape "derived from" a trigram, a virtue "carried from" a myth) and
 * banning them outright would fail prose that was never an editorial note.
 * Catch those only by manual review, not by this automated gate.
 */
const EDITORIAL_LEAK_PHRASES: string[] = [
  'source file',
  'empty stub',
  'frontmatter-only',
  'vault index',
  'vault-confirmed',
  'reference file',
  'per_card_reference',
  'needs verification',
  'not re-derivable',
  'sourcing_log',
  'golden dawn attribution',
];

export function checkEditorialFlags(line: string): Array<{ index: number; label: string }> {
  const hits: Array<{ index: number; label: string }> = [];
  for (const { needle, label } of FLAG_PATTERNS) {
    let idx = line.indexOf(needle);
    while (idx !== -1) {
      hits.push({ index: idx, label });
      idx = line.indexOf(needle, idx + 1);
    }
  }
  const lower = line.toLowerCase();
  for (const phrase of EDITORIAL_LEAK_PHRASES) {
    let idx = lower.indexOf(phrase);
    while (idx !== -1) {
      hits.push({ index: idx, label: phrase });
      idx = lower.indexOf(phrase, idx + 1);
    }
  }
  return hits.sort((a, b) => a.index - b.index);
}

/* ─── Rule 4: banned vocabulary (warning) ────────────────────────────── */

/**
 * From `i64os/substrate/directions/voice-profile.md` — the "AGAINST" stance
 * (wellness/"journey" language, mysticism stacking) plus the exact terms the
 * 2026-09-08 survey found leaking into the Design lens (five "alignment",
 * one "vibration", two "sacred", two "invited"). "Step into" and "you are
 * being" are the same generic-coaching register, added for the same reason.
 * This list is deliberately narrower than the oracle guide's own
 * "plain vocabulary by default" list (profound/journey/embrace/navigate/
 * essence/transformative in WRITING_METHOD.md §1.5) — that one governs
 * Adrian's own drafting; this one is the wellness-cliché subset the voice
 * profile calls out by name. See the script header note in the PR: exact
 * membership of this list is the one rule this lint cannot make fully
 * precise, because voice-profile.md's AGAINST section names categories
 * ("wellness/journey language") rather than an itemised word list.
 */
export const BANNED_VOCAB: string[] = [
  'alignment',
  'vibration',
  'sacred',
  'invited',
  'embrace',
  'journey',
  'step into',
  'you are being',
];

function vocabRegex(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  return new RegExp(`\\b${escaped}\\w*\\b`, 'gi');
}

export function checkVocab(line: string): Array<{ term: string; index: number }> {
  const hits: Array<{ term: string; index: number }> = [];
  for (const term of BANNED_VOCAB) {
    const re = vocabRegex(term);
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) {
      hits.push({ term, index: m.index });
    }
  }
  return hits;
}

/* ─── Section walking (shared by rules 1, 2, 3, 4 and 5) ─────────────── */

type UnitKind = 'heading' | 'bullet' | 'paragraph';

interface ProseUnit {
  lens: string;
  kind: UnitKind;
  /** True for a 'paragraph' unit directly under `## RELATIONS`, or under one
   *  of its `###` subheadings — see `RELATIONS_EXEMPT_LENS` below. */
  inRelationsField: boolean;
  lineNumber: number; // 1-indexed line of the first physical line of the unit
  text: string; // joined across any soft-wrapped physical lines, no embedded '\n'
}

/**
 * Walk a prose body (frontmatter/comments already blanked) into units —
 * headings, bullets, and paragraphs — each tagged with the enclosing
 * `## LENS` heading, with soft-wrapped physical lines joined into one
 * logical line per unit (matching how `lib/oracle/card-markdown.ts`
 * `parseBody` reconstructs a paragraph, and needed so a span like
 * `*without being certain*` that wraps across two source lines in
 * `oracle/readings/UL-122.md` is still seen as one string). A file with no
 * `##` headings (the `oracle/readings/*.md` shape) is one paragraph run
 * under the pseudo-lens `READING`.
 */
function walkUnits(prose: string): ProseUnit[] {
  const lines = prose.split('\n');
  const units: ProseUnit[] = [];
  let lens = 'READING';
  let inRelations = false;
  let buf: string[] = [];
  let bufStartLine = -1;

  const flush = () => {
    const text = buf.join(' ').trim();
    if (text !== '') {
      units.push({ lens, kind: 'paragraph', inRelationsField: inRelations, lineNumber: bufStartLine, text });
    }
    buf = [];
    bufStartLine = -1;
  };

  lines.forEach((raw, i) => {
    const lineNumber = i + 1;
    const trimmed = raw.trim();

    if (trimmed.startsWith('# ')) return; // title line

    const h2 = trimmed.match(/^##\s+(.+)$/);
    if (h2) {
      flush();
      lens = h2[1].trim();
      inRelations = lens === 'RELATIONS';
      units.push({ lens, kind: 'heading', inRelationsField: false, lineNumber, text: trimmed });
      return;
    }
    if (/^###\s+/.test(trimmed)) {
      flush();
      units.push({ lens, kind: 'heading', inRelationsField: false, lineNumber, text: trimmed });
      return;
    }

    if (trimmed === '') {
      flush();
      return;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      // Bullets are always authored as a single physical line in this
      // corpus (the production parser doesn't soft-wrap them either — see
      // lib/oracle/card-markdown.ts parseBody) and are never part of the
      // RELATIONS outer-emphasis-stripped convention (see below).
      flush();
      units.push({ lens, kind: 'bullet', inRelationsField: false, lineNumber, text: trimmed });
      return;
    }

    if (buf.length === 0) bufStartLine = lineNumber;
    buf.push(trimmed);
  });
  flush();

  return units;
}

/** A paragraph that is purely a structural field label (`_Keywords:_ …`,
 *  `**Line 1** · _image:_ … → becomes …`) is not prose and never seeds an
 *  opening stem. */
function isStructuralLabelParagraph(text: string): boolean {
  return /^_[A-Za-z][A-Za-z ]*:_/.test(text) || /^\*\*Line\s+\d+\*\*/.test(text);
}

function firstSixWords(text: string): string {
  const words = text
    .replace(/[*_]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map(w => w.replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, '').toLowerCase());
  return words.join(' ');
}

/**
 * The RELATIONS section's field paragraphs (the section intro / "unity
 * line", and each `###` subheading's prose: Pair, Inverse, Programming
 * partner, Codon ring, Tarot, Immortals) are manuscript-wrapped in a single
 * outer `_..._` or `*...*` span by convention, and `lib/oracle/card-markdown.ts`
 * (`cleanRelationsProse` → `withoutOuterEmphasis`) strips exactly that outer
 * wrap before the text ships — the same structural-syntax exemption as
 * `_Keywords:_`, just at paragraph scope instead of word scope. A paragraph
 * only qualifies when it is wrapped start-to-end with nothing outside the
 * markers; bullets are never part of this convention (the compiler only
 * unwraps the six named field paragraphs, never a bare list item), so a
 * bullet that happens to be fully italicised — e.g. the sourcing aside on
 * `oracle/cards/55.md`'s Tarot list — is not exempt and is a real hit.
 */
function isExemptRelationsWrap(unit: ProseUnit): boolean {
  return unit.kind === 'paragraph' && unit.inRelationsField && /^([_*])[\s\S]+\1$/.test(unit.text);
}

/* ─── Per-file lint ───────────────────────────────────────────────────── */

export function lintContent(raw: string, file: string): FileLintResult {
  const prose = stripToProse(raw);
  const units = walkUnits(prose);
  const errors: LintIssue[] = [];
  const vocabHits: VocabHit[] = [];

  for (const unit of units) {
    if (unit.kind !== 'heading' && !isExemptRelationsWrap(unit)) {
      for (const hit of checkItalics(unit.text)) {
        errors.push({
          file,
          line: unit.lineNumber,
          rule: 'italics',
          message: `italics in prose: ${hit.text}`,
          excerpt: unit.text,
        });
      }
    }

    for (const _index of checkEmDash(unit.text)) {
      errors.push({
        file,
        line: unit.lineNumber,
        rule: 'em-dash',
        message: 'sentence-internal em dash',
        excerpt: unit.text,
      });
    }

    for (const flag of checkEditorialFlags(unit.text)) {
      errors.push({
        file,
        line: unit.lineNumber,
        rule: 'editorial-flag',
        message: `editorial flag left in shipped text: ${flag.label}`,
        excerpt: unit.text,
      });
    }

    for (const hit of checkVocab(unit.text)) {
      vocabHits.push({ term: hit.term, line: unit.lineNumber, lens: unit.lens });
    }
  }

  const seenLens = new Set<string>();
  const openingStems: OpeningStem[] = [];
  for (const unit of units) {
    if (unit.kind === 'heading') continue; // subheading text is not prose to open on
    if (seenLens.has(unit.lens)) continue;
    if (isStructuralLabelParagraph(unit.text)) continue;
    seenLens.add(unit.lens);
    const stem = firstSixWords(unit.text);
    if (stem.split(' ').length === 6) {
      openingStems.push({ file, lens: unit.lens, stem, card: basename(file) });
    }
  }

  return { errors, vocabHits, openingStems };
}

/* ─── Corpus discovery ────────────────────────────────────────────────── */

function listCorpusFiles(): string[] {
  const cardsDir = resolve(root, 'oracle/cards');
  const readingsDir = resolve(root, 'oracle/readings');

  const cards = readdirSync(cardsDir)
    .filter(f => /^\d{2}\.md$/.test(f))
    .sort()
    .map(f => resolve(cardsDir, f));

  const readings = readdirSync(readingsDir)
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .map(f => resolve(readingsDir, f));

  return [...cards, ...readings];
}

/* ─── CLI ─────────────────────────────────────────────────────────────── */

function main(): void {
  const files = listCorpusFiles();
  const allErrors: LintIssue[] = [];
  const allVocabHits: VocabHit[] = [];
  const allOpeningStems: OpeningStem[] = [];

  for (const file of files) {
    const raw = readFileSync(file, 'utf8');
    const relFile = file.slice(root.length + 1);
    const result = lintContent(raw, relFile);
    allErrors.push(...result.errors);
    allVocabHits.push(...result.vocabHits);
    allOpeningStems.push(...result.openingStems);
  }

  // --- Errors ---
  if (allErrors.length > 0) {
    console.error(`\n[lint:prose] ${allErrors.length} error(s):\n`);
    for (const e of allErrors) {
      console.error(`  ${e.file}:${e.line}  [${e.rule}]  ${e.message}`);
      console.error(`    ${e.excerpt}`);
    }
  }

  // --- Warning 4: banned vocabulary, counted per lens ---
  const vocabByLens = new Map<string, Map<string, number>>();
  for (const hit of allVocabHits) {
    if (!vocabByLens.has(hit.lens)) vocabByLens.set(hit.lens, new Map());
    const perTerm = vocabByLens.get(hit.lens)!;
    perTerm.set(hit.term, (perTerm.get(hit.term) ?? 0) + 1);
  }
  if (vocabByLens.size > 0) {
    console.warn(`\n[lint:prose] banned-vocabulary warnings (${allVocabHits.length} total hits), by lens:\n`);
    for (const [lens, perTerm] of [...vocabByLens.entries()].sort()) {
      const parts = [...perTerm.entries()].sort().map(([term, n]) => `${term}×${n}`);
      console.warn(`  ${lens}: ${parts.join(', ')}`);
    }
  } else {
    console.log('\n[lint:prose] no banned-vocabulary hits.');
  }

  // --- Warning 5: repeated opening stems per lens ---
  const byLens = new Map<string, OpeningStem[]>();
  for (const s of allOpeningStems) {
    if (!byLens.has(s.lens)) byLens.set(s.lens, []);
    byLens.get(s.lens)!.push(s);
  }
  const pairs: Array<[OpeningStem, OpeningStem]> = [];
  for (const stems of byLens.values()) {
    const byStem = new Map<string, OpeningStem[]>();
    for (const s of stems) {
      if (!byStem.has(s.stem)) byStem.set(s.stem, []);
      byStem.get(s.stem)!.push(s);
    }
    for (const group of byStem.values()) {
      if (group.length < 2) continue;
      for (let a = 0; a < group.length; a += 1) {
        for (let b = a + 1; b < group.length; b += 1) {
          pairs.push([group[a], group[b]]);
        }
      }
    }
  }
  if (pairs.length > 0) {
    console.warn(`\n[lint:prose] repeated-opening-stem warnings (${pairs.length} pair(s)):\n`);
    for (const [a, b] of pairs) {
      console.warn(`  ${a.lens}: ${a.card} ↔ ${b.card}  "${a.stem}"`);
    }
  } else {
    console.log('[lint:prose] no repeated opening stems.');
  }

  console.log(`\n[lint:prose] checked ${files.length} files.`);

  if (allErrors.length > 0) {
    process.exitCode = 1;
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) main();
