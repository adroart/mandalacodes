#!/usr/bin/env tsx
/**
 * Carry the owner's applied spoken words from a voice bundle into one card.
 *
 *   tsx scripts/voice-apply.ts --file <bundle.json> [--card N] [--dry-run] [--cards-dir <dir>]
 *
 * A person runs this on a machine with the repository. It reads a bundle made
 * by lib/oracle/authoring/voiceExport.ts and, for each section, finds that
 * section in the CURRENT oracle/cards/NN.md with the same parser the app uses
 * (manuscriptSource and cardSections):
 *
 *   - current text equals the bundle's original: replace it with the applied text
 *   - current text already equals the applied text: report "already applied"
 *   - anything else: leave it, report a conflict, carry on with the others
 *
 * Everything outside the replaced spans stays byte for byte. After writing it
 * loads every card with the build's fail-closed corpus loader and restores the
 * file if loading fails. It never commits, pushes or opens a pull request, it
 * never changes any status in the frontmatter, and it touches only the one
 * card the bundle names. Exit code 1 when anything conflicted or failed.
 *
 * Docs: docs/oracle/voice-apply.md
 */
import {readFile, writeFile, stat} from 'node:fs/promises';
import {resolve, join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

import {cardSections, type CardSection} from '../lib/oracle/authoring/cardSections';
import {manuscriptSource} from '../lib/oracle/authoring/source';
import {parseCardMarkdown} from '../lib/oracle/card-markdown';
import {parseVoiceBundle, VOICE_BUNDLE_LIMITS, type VoiceBundle, type VoiceBundleSection} from '../lib/oracle/authoring/voiceExport';
import {sha256} from '../lib/oracle/authoring/workflow';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CARDS_DIR = join(ROOT, 'oracle', 'cards');

/** The em dash, which house rules forbid in prose. Built from its code point so this file carries none. */
const EM_DASH = '\u2014';

export interface VoiceApplyOptions {
  file: string;
  card?: number;
  dryRun?: boolean;
  cardsDir?: string;
  /** Loader used to prove the cards still build. Defaults to the corpus loader the build uses. */
  loadCards?: (cardsDir: string) => Promise<unknown>;
}

interface SectionRef { id: string; path: string[] }
export interface VoiceConflict extends SectionRef { current: string; original: string; applied: string }
export interface VoiceSkip extends SectionRef { reason: string }
export interface VoiceNotice extends SectionRef { kind: 'em dash' | 'italics' | 'underscore emphasis'; excerpt: string }

export interface VoiceApplyReport {
  cardNumber: number;
  cardFile: string;
  dryRun: boolean;
  manuscriptUnchanged: boolean;
  applied: SectionRef[];
  alreadyApplied: SectionRef[];
  conflicts: VoiceConflict[];
  skipped: VoiceSkip[];
  failed: VoiceSkip[];
  titleEdits: VoiceBundle['titleEdits'];
  omitted: VoiceBundle['omitted'];
  notices: VoiceNotice[];
  wrote: boolean;
  diff: string;
  exitCode: number;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const lf = (text: string) => text.replace(/\r\n?/g, '\n');
const same = (a: string, b: string) => lf(a).trim() === lf(b).trim();
const headingLines = (markdown: string) => lf(markdown).split('\n').filter(line => /^#{1,6}\s/.test(line));

async function defaultLoadCards(cardsDir: string) {
  const {loadCorpusFromDirectory} = await import('../mcp/oracle-server/src/corpus.ts');
  return loadCorpusFromDirectory(cardsDir);
}

/* ---------- Locating and replacing one lens section ---------- */

type Outcome =
  | {status: 'applied'; markdown: string}
  | {status: 'already'}
  | {status: 'conflict'; current: string}
  | {status: 'skipped' | 'failed'; reason: string};

/**
 * Version 1 rewrites only plain prose. Lists, bold, links, field labels such as
 * the manuscript's underscore labels, and quotes carry structure the parser reads,
 * so a section holding any of them is left for a hand edit.
 */
function markdownStructure(text: string): string | undefined {
  if (/[*_`[\]|<>]/.test(text)) return 'it holds Markdown formatting (bold, labels, links or emphasis)';
  if (/^\s*(?:[-+]\s|\d+\.\s|>|#)/m.test(text)) return 'it holds a list, quote or heading';
  return undefined;
}

async function parseSections(cardNumber: number, markdown: string): Promise<CardSection[]> {
  return cardSections(await manuscriptSource(cardNumber, 'working-tree', markdown));
}

async function applyManuscriptSection(cardNumber: number, markdown: string, section: VoiceBundleSection): Promise<Outcome> {
  let nodes: CardSection[];
  let source;
  try {
    source = await manuscriptSource(cardNumber, 'working-tree', markdown);
    nodes = cardSections(source);
  } catch (error) {
    return {status: 'failed', reason: `the card no longer parses into sections (${(error as Error).message})`};
  }
  const node = nodes.find(candidate => candidate.id === section.id);
  if (!node) return {status: 'conflict', current: '(this section is no longer in the card)'};
  if (same(node.text, section.applied.text)) return {status: 'already'};
  if (!same(node.text, section.original.text)) return {status: 'conflict', current: node.text};

  const structure = markdownStructure(node.text);
  if (structure) return {status: 'skipped', reason: `version 1 does not rewrite this section because ${structure}; make the change by hand`};

  // The flattened text of a plain-prose section appears literally in its lens.
  const lens = source.sections.find(candidate => candidate.id === node.lensId)!;
  const lensRaw = markdown.slice(lens.start, lens.end);
  const at = lensRaw.indexOf(node.text);
  if (at < 0) return {status: 'skipped', reason: 'its words are stored with formatting the app does not show; make the change by hand'};
  if (lensRaw.indexOf(node.text, at + 1) >= 0) return {status: 'skipped', reason: 'its words appear more than once in this lens, so the place to change is not certain'};
  const start = lens.start + at;
  const end = start + node.text.length;
  if ((start > 0 && markdown[start - 1] !== '\n') || (end < markdown.length && !/[\r\n]/.test(markdown[end]))) {
    return {status: 'skipped', reason: 'its words do not start and end on whole lines in the card'};
  }

  const eol = markdown.includes('\r\n') ? '\r\n' : '\n';
  const replacement = lf(section.applied.text).trim().replace(/\n/g, eol);
  if (/^\s*#/m.test(replacement)) return {status: 'failed', reason: 'the applied words contain a heading line, which would change the card\'s structure'};
  if (/^\s*---\s*$/m.test(replacement)) return {status: 'failed', reason: 'the applied words contain a "---" line, which the card reserves for its frontmatter'};
  const next = markdown.slice(0, start) + replacement + markdown.slice(end);

  // Prove the change landed where intended and nowhere else.
  let after: CardSection[];
  try { after = await parseSections(cardNumber, next); } catch (error) {
    return {status: 'failed', reason: `the card would no longer parse into sections (${(error as Error).message})`};
  }
  if (after.map(n => n.id).join('\n') !== nodes.map(n => n.id).join('\n')) return {status: 'failed', reason: 'the applied words would change the card\'s section structure'};
  for (const [index, before] of nodes.entries()) {
    const now = after[index];
    if (before.id === section.id) {
      if (!same(now.text, section.applied.text)) return {status: 'failed', reason: 'the applied words would read differently once parsed (they likely hold Markdown such as bold or links)'};
    } else if (now.text !== before.text) {
      return {status: 'failed', reason: `the change would also alter ${before.id}`};
    }
  }
  if (headingLines(next).join('\n') !== headingLines(markdown).join('\n')) return {status: 'failed', reason: 'the change would alter a heading'};
  return {status: 'applied', markdown: next};
}

/* ---------- The entrance (frontmatter meta.centre) ---------- */

function frontmatterBounds(markdown: string): {start: number; end: number} | undefined {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return match ? {start: match[0].indexOf('\n') + 1, end: match[0].indexOf('\n') + 1 + match[1].length} : undefined;
}

function metaCentre(markdown: string): string | undefined {
  const meta = parseCardMarkdown(markdown).frontmatter.meta;
  const centre = meta && typeof meta === 'object' && !Array.isArray(meta) ? (meta as Record<string, unknown>).centre : undefined;
  return typeof centre === 'string' ? centre.trim() : undefined;
}

/**
 * The entrance lives in the frontmatter as `meta.centre`, one double-quoted
 * line. The card parser reads quotes literally and does not unescape, so only
 * a single line with no double quote or backslash can be written safely.
 */
function applyIntroSection(markdown: string, section: VoiceBundleSection): Outcome {
  let current: string | undefined;
  try { current = metaCentre(markdown); } catch (error) {
    return {status: 'failed', reason: `the frontmatter does not parse (${(error as Error).message})`};
  }
  if (current === undefined) return {status: 'conflict', current: '(this card has no entrance in meta.centre)'};
  if (same(current, section.applied.text)) return {status: 'already'};
  if (!same(current, section.original.text)) return {status: 'conflict', current};

  const words = lf(section.applied.text).trim();
  if (/[\n"\\]/.test(words)) return {status: 'skipped', reason: 'the new entrance has a line break, double quote or backslash, which the frontmatter cannot hold as written; make the change by hand'};

  const bounds = frontmatterBounds(markdown);
  if (!bounds) return {status: 'failed', reason: 'the card has no frontmatter'};
  const front = markdown.slice(bounds.start, bounds.end);
  const lines = front.split('\n');
  const metaIndex = lines.findIndex(line => /^meta:\s*\r?$/.test(line));
  if (metaIndex < 0) return {status: 'skipped', reason: 'the frontmatter has no meta block written in the usual way'};
  const candidates: number[] = [];
  let childIndent: string | undefined;
  for (let i = metaIndex + 1; i < lines.length; i++) {
    const indent = lines[i].match(/^(\s+)\S/)?.[1];
    if (!indent && lines[i].trim()) break; // the next top-level key ends meta
    if (!indent) continue;
    childIndent ??= indent;
    if (indent === childIndent && /^\s+centre:\s/.test(lines[i])) candidates.push(i);
  }
  if (candidates.length !== 1) return {status: 'skipped', reason: 'the entrance is not a single meta.centre line'};
  const line = lines[candidates[0]];
  const quoted = line.match(/^(\s+centre:\s)"([^"\\]*)"(\r?)$/);
  if (!quoted || quoted[2].trim() !== current) return {status: 'skipped', reason: 'the entrance is not written as one plain double-quoted line'};
  lines[candidates[0]] = `${quoted[1]}"${words}"${quoted[3]}`;
  const next = markdown.slice(0, bounds.start) + lines.join('\n') + markdown.slice(bounds.end);

  try {
    if (metaCentre(next) !== words) return {status: 'failed', reason: 'the entrance would read differently once parsed'};
    const before = parseCardMarkdown(markdown).frontmatter, after = parseCardMarkdown(next).frontmatter;
    if (JSON.stringify(before.status) !== JSON.stringify(after.status)) return {status: 'failed', reason: 'the change would alter the editorial status'};
  } catch (error) {
    return {status: 'failed', reason: `the frontmatter would no longer parse (${(error as Error).message})`};
  }
  return {status: 'applied', markdown: next};
}

/* ---------- Reporting helpers ---------- */

function houseRuleNotices(section: VoiceBundleSection): VoiceNotice[] {
  const text = section.applied.text, notices: VoiceNotice[] = [];
  const excerpt = (index: number) => text.slice(Math.max(0, index - 30), index + 30).replace(/\s+/g, ' ');
  const ref = {id: section.id, path: section.path};
  for (let i = text.indexOf(EM_DASH); i >= 0; i = text.indexOf(EM_DASH, i + 1)) notices.push({...ref, kind: 'em dash', excerpt: excerpt(i)});
  for (const match of text.matchAll(/(?<![*\w])\*(?!\*)[^*\n]+?\*(?![*\w])/g)) notices.push({...ref, kind: 'italics', excerpt: excerpt(match.index!)});
  for (const match of text.matchAll(/(?<![\w_])_(?!_)[^_\n]+?_(?![\w_])/g)) notices.push({...ref, kind: 'underscore emphasis', excerpt: excerpt(match.index!)});
  return notices;
}

/** Plain line diff (longest common subsequence), printed in unified style with three lines of context. */
export function unifiedDiff(before: string, after: string, label: string): string {
  if (before === after) return '';
  const a = before.split('\n'), b = after.split('\n');
  // Trim the shared head and tail so the table stays small.
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const midA = a.slice(head, a.length - tail), midB = b.slice(head, b.length - tail);
  const table = Array.from({length: midA.length + 1}, () => new Uint32Array(midB.length + 1));
  for (let i = midA.length - 1; i >= 0; i--) for (let j = midB.length - 1; j >= 0; j--) table[i][j] = midA[i] === midB[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  const ops: {op: ' ' | '-' | '+'; line: string}[] = a.slice(0, head).map(line => ({op: ' ' as const, line}));
  let i = 0, j = 0;
  while (i < midA.length || j < midB.length) {
    if (i < midA.length && j < midB.length && midA[i] === midB[j]) { ops.push({op: ' ', line: midA[i]}); i++; j++; }
    else if (i < midA.length && (j === midB.length || table[i + 1][j] >= table[i][j + 1])) { ops.push({op: '-', line: midA[i]}); i++; }
    else { ops.push({op: '+', line: midB[j]}); j++; }
  }
  ops.push(...a.slice(a.length - tail).map(line => ({op: ' ' as const, line})));

  const out = [`--- a/${label}`, `+++ b/${label}`];
  const changed = ops.map((o, k) => (o.op !== ' ' ? k : -1)).filter(k => k >= 0);
  let k = 0;
  while (k < changed.length) {
    let from = Math.max(0, changed[k] - 3), to = Math.min(ops.length, changed[k] + 4);
    while (k + 1 < changed.length && changed[k + 1] - 3 <= to) { k++; to = Math.min(ops.length, changed[k] + 4); }
    k++;
    const lineA = ops.slice(0, from).filter(o => o.op !== '+').length + 1;
    const lineB = ops.slice(0, from).filter(o => o.op !== '-').length + 1;
    const hunk = ops.slice(from, to);
    out.push(`@@ -${lineA},${hunk.filter(o => o.op !== '+').length} +${lineB},${hunk.filter(o => o.op !== '-').length} @@`);
    for (const o of hunk) out.push(o.op + o.line);
    from = to;
  }
  return out.join('\n') + '\n';
}

/* ---------- The command ---------- */

export async function runVoiceApply(options: VoiceApplyOptions): Promise<VoiceApplyReport> {
  const cardsDir = resolve(options.cardsDir ?? DEFAULT_CARDS_DIR);
  const info = await stat(options.file);
  if (!info.isFile()) throw new Error(`${options.file} is not a file`);
  if (info.size > VOICE_BUNDLE_LIMITS.maxJsonChars * 4) throw new Error(`${options.file} is too large to be a voice bundle`);
  const bundle = await parseVoiceBundle(await readFile(options.file, 'utf8'));
  if (options.card !== undefined && options.card !== bundle.cardNumber) {
    throw new Error(`--card ${options.card} was given, but the bundle is for card ${bundle.cardNumber}. Nothing was changed.`);
  }

  const cardFile = join(cardsDir, `${pad2(bundle.cardNumber)}.md`);
  const bytes = await readFile(cardFile);
  const original = bytes.toString('utf8');
  if (!Buffer.from(original, 'utf8').equals(bytes)) throw new Error(`${cardFile} is not valid UTF-8. Nothing was changed.`);

  const report: VoiceApplyReport = {
    cardNumber: bundle.cardNumber, cardFile, dryRun: !!options.dryRun,
    manuscriptUnchanged: (await sha256(original)) === bundle.manuscript.sha256,
    applied: [], alreadyApplied: [], conflicts: [], skipped: [], failed: [],
    titleEdits: bundle.titleEdits, omitted: bundle.omitted, notices: [], wrote: false, diff: '', exitCode: 0,
  };

  let markdown = original;
  // The entrance first: it sits in the frontmatter, ahead of every lens.
  const ordered = [...bundle.sections.filter(s => s.kind === 'intro'), ...bundle.sections.filter(s => s.kind !== 'intro')];
  for (const section of ordered) {
    const ref = {id: section.id, path: section.path};
    const outcome = section.kind === 'intro' ? applyIntroSection(markdown, section) : await applyManuscriptSection(bundle.cardNumber, markdown, section);
    switch (outcome.status) {
      case 'applied': markdown = outcome.markdown; report.applied.push(ref); report.notices.push(...houseRuleNotices(section)); break;
      case 'already': report.alreadyApplied.push(ref); report.notices.push(...houseRuleNotices(section)); break;
      case 'conflict': report.conflicts.push({...ref, current: outcome.current, original: section.original.text, applied: section.applied.text}); break;
      default: report[outcome.status === 'skipped' ? 'skipped' : 'failed'].push({...ref, reason: outcome.reason});
    }
  }

  const loadCards = options.loadCards ?? defaultLoadCards;
  if (markdown !== original) {
    if (options.dryRun) report.diff = unifiedDiff(original, markdown, `oracle/cards/${pad2(bundle.cardNumber)}.md`);
    else {
      try { await loadCards(cardsDir); } catch (error) {
        throw new Error(`The cards fail to load before any change, so nothing was written:\n${(error as Error).message}`);
      }
      await writeFile(cardFile, markdown, 'utf8');
      try {
        await loadCards(cardsDir);
        report.wrote = true;
      } catch (error) {
        await writeFile(cardFile, bytes);
        report.failed.push(...report.applied.map(ref => ({...ref, reason: `the card failed the corpus loader after the change, so the file was restored (${(error as Error).message.split('\n').slice(0, 3).join(' ')})`})));
        report.applied = [];
      }
    }
  }
  report.exitCode = report.conflicts.length || report.failed.length ? 1 : 0;
  return report;
}

const indent = (text: string, by = '      ') => text.split('\n').map(line => by + line).join('\n');
const name = (ref: SectionRef) => `${ref.id}  (${ref.path.join(' > ')})`;

export function formatVoiceApplyReport(report: VoiceApplyReport): string {
  const nn = pad2(report.cardNumber), out: string[] = [];
  out.push(`Voice apply, card ${report.cardNumber}${report.dryRun ? ' (dry run: nothing written)' : ''}`);
  out.push(`File: ${report.cardFile}`);
  out.push(report.manuscriptUnchanged
    ? 'The card is exactly the version the app was built with.'
    : 'The card has changed since the app read it. Each section was compared on its own.');
  const list = (title: string, refs: SectionRef[], extra?: (ref: any) => string) => {
    out.push('', `${title}: ${refs.length}`);
    for (const ref of refs) { out.push(`  - ${name(ref)}`); if (extra) out.push(extra(ref)); }
  };
  list(report.dryRun ? 'Would apply' : 'Applied', report.applied);
  list('Already applied', report.alreadyApplied);
  list('Conflicted (left untouched)', report.conflicts, (c: VoiceConflict) =>
    ['    In the card now:', indent(c.current), '    The app expected:', indent(c.original), '    Your words:', indent(c.applied)].join('\n'));
  list('Skipped (needs a hand edit)', report.skipped, (s: VoiceSkip) => `    ${s.reason}`);
  list('Failed', report.failed, (s: VoiceSkip) => `    ${s.reason}`);
  if (report.omitted.length) {
    const omitted: VoiceSkip[] = report.omitted.map(o => ({id: o.sectionId, path: o.path, reason: o.reason}));
    list('Not in the bundle (the app could not place them)', omitted, (o: VoiceSkip) => `    ${o.reason}`);
  }
  if (report.titleEdits.length) {
    out.push('', `Title edits carried but not applied by version 1: ${report.titleEdits.length}`);
    for (const t of report.titleEdits) out.push(`  - ${t.sectionId}: "${t.original}" to "${t.edited}"`);
  }
  out.push('', `For the owner's eye (house rules; the words were not changed): ${report.notices.length}`);
  for (const n of report.notices) out.push(`  - ${n.id}: ${n.kind} in "...${n.excerpt}..."`);
  if (report.diff) out.push('', 'Diff:', report.diff);
  if (report.applied.length && !report.dryRun) {
    out.push('', 'Next, in order. The lint and the gate report on your words; read what they say, but your words are not rewritten to pass them.',
      '(The build runs the lint too, so an em dash or italics left in will stop `npm run build` until you decide.)',
      '  npm run lint:prose',
      `  npm run card:gate -- ${nn}`,
      '  npm run build:oracle-corpus',
      '  npm run build:search-index',
      `  git switch -c voice/card-${nn}`,
      `  git add oracle/cards/${nn}.md data/oracle-corpus.json data/oracle-search-index.json`,
      `  git commit -m "Card ${report.cardNumber}: Adrian's spoken words"`,
      '  Then open one pull request for this card and read it on the preview before merging.');
  } else if (report.applied.length && report.dryRun) {
    out.push('', 'Run again without --dry-run to write these changes.');
  }
  out.push('', report.exitCode ? 'Result: something conflicted or failed (exit code 1).' : 'Result: done (exit code 0).');
  return out.join('\n');
}

function parseArgs(argv: string[]): VoiceApplyOptions {
  const usage = 'usage: tsx scripts/voice-apply.ts --file <bundle.json> [--card N] [--dry-run] [--cards-dir <dir>]';
  const options: Partial<VoiceApplyOptions> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i], value = () => { const v = argv[++i]; if (v === undefined || v.startsWith('--')) throw new Error(`${arg} needs a value\n${usage}`); return v; };
    if (arg === '--file') options.file = value();
    else if (arg === '--card') { const n = Number(value()); if (!Number.isInteger(n) || n < 1 || n > 64) throw new Error(`--card must be 1 to 64\n${usage}`); options.card = n; }
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--cards-dir') options.cardsDir = value();
    else throw new Error(`unknown argument ${arg}\n${usage}`);
  }
  if (!options.file) throw new Error(usage);
  return options as VoiceApplyOptions;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  try {
    const report = await runVoiceApply(parseArgs(process.argv.slice(2)));
    console.log(formatVoiceApplyReport(report));
    process.exitCode = report.exitCode;
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 2;
  }
}
