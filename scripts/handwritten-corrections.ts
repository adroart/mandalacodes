#!/usr/bin/env tsx
/** Deterministic, one-card transcription import. See docs/oracle/handwritten-corrections.md. */
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve, join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseCardMarkdown} from '../lib/oracle/card-markdown.ts';

const defaultCardsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../oracle/cards');
const lenses = ['CODE', 'ICHING', 'KEYS', 'DESIGN', 'BODY', 'RELATIONS'] as const;
type Action = 'replace' | 'delete' | 'insert-before' | 'insert-after';
export type Correction = {section: typeof lenses[number]; subsection?: string; quote: string; action: Action; text?: string};
export type Batch = {format: 'mandala-codes/handwritten-corrections'; version: 1; cardNumber: number; edits: Correction[]};
type Resolved = {start: number; end: number; before: string; after: string; paragraphBefore: string; paragraphAfter: string; section: string; subsection?: string; action: Action};
export type Prepared = {format: 'mandala-codes/handwritten-corrections-prepared'; version: 1; batch: Batch; sourceSha256: string; candidateSha256: string; review: Resolved[]; approvalDigest: string};
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const cardFile = (cardsDir: string, n: number) => join(cardsDir, `${String(n).padStart(2, '0')}.md`);
function requireShape(ok: unknown, message: string): asserts ok {if (!ok) throw new Error(message);}
function validateBatch(value: unknown): Batch {
  requireShape(value && typeof value === 'object' && !Array.isArray(value), 'Batch must be an object');
  const batch = value as Batch;
  requireShape(batch.format === 'mandala-codes/handwritten-corrections' && batch.version === 1, 'Unknown batch format/version');
  requireShape(Number.isInteger(batch.cardNumber) && batch.cardNumber >= 1 && batch.cardNumber <= 64, 'cardNumber must be 1–64');
  requireShape(Array.isArray(batch.edits) && batch.edits.length > 0 && batch.edits.length <= 50, 'Batch needs 1–50 edits');
  for (const [i, edit] of batch.edits.entries()) {
    requireShape(edit && typeof edit === 'object' && lenses.includes(edit.section), `Edit ${i + 1}: invalid section`);
    requireShape(edit.subsection === undefined || (typeof edit.subsection === 'string' && edit.subsection.trim() === edit.subsection && !!edit.subsection), `Edit ${i + 1}: invalid subsection`);
    requireShape(typeof edit.quote === 'string' && !!edit.quote.trim() && edit.quote === edit.quote.trim(), `Edit ${i + 1}: quote must be exact nonempty text without outer whitespace`);
    requireShape(['replace', 'delete', 'insert-before', 'insert-after'].includes(edit.action), `Edit ${i + 1}: invalid action`);
    requireShape(edit.action === 'delete' ? edit.text === undefined : typeof edit.text === 'string' && !!edit.text && !edit.text.includes('\r'), `Edit ${i + 1}: supply explicit text, except for delete`);
    requireShape(!edit.quote.includes('\r') && !edit.quote.includes('\n') && !edit.text?.includes('\n'), `Edit ${i + 1}: use a single-line exact quote and text`);
    requireShape(!/\[{1,2}(?:unclear|illegible|unsure)\b/i.test(edit.text ?? ''), `Edit ${i + 1}: resolve unclear transcription before preparation`);
    requireShape(!/^(?:#{1,6}\s|---\s*$)/.test(edit.text ?? ''), `Edit ${i + 1}: headings/frontmatter delimiters cannot be inserted`);
  }
  return batch;
}

type Span = {start: number; end: number; name?: string};
function scopes(markdown: string): Map<string, Span> {
  const result = new Map<string, Span>();
  const headings = [...markdown.matchAll(/^(#{1,6}) (.+)\r?$/gm)].map(m => ({level: m[1].length, name: m[2], start: m.index!, bodyStart: m.index! + m[0].length}));
  const frontEnd = markdown.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/)?.[0].length ?? -1;
  requireShape(frontEnd >= 0, 'Missing frontmatter');
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    if (h.start < frontEnd || (h.level !== 2 && h.level !== 3)) continue;
    const lens = h.level === 2 ? h.name : headings.slice(0, i).reverse().find(x => x.level === 2)?.name;
    if (!lens || !lenses.includes(lens as Correction['section'])) continue;
    const end = headings.slice(i + 1).find(x => x.level <= h.level)?.start ?? markdown.length;
    const key = h.level === 2 ? lens : `${lens}\0${h.name}`;
    requireShape(!result.has(key), `Duplicate heading ${key.replace('\0', ' / ')}`);
    result.set(key, {start: h.bodyStart, end, name: h.name});
  }
  return result;
}

function structuralMarkers(markdown: string): string[] {
  return markdown.split(/\r?\n/).flatMap(line => {
    const heading = line.match(/^#{1,6} .+$/);
    if (heading) return [heading[0]];
    const label = line.match(/^\s*(?:_Keywords:_|_Shadow:_|_Gift:_|_Siddhi:_|\*\*Line \d+\*\*|[-*] )/);
    return label ? [label[0]] : [];
  });
}

function resolveBatch(markdown: string, batch: Batch): {candidate: string; review: Resolved[]} {
  const parsed = parseCardMarkdown(markdown);
  requireShape(parsed.frontmatter.number === batch.cardNumber, `Wrong card: file frontmatter is ${parsed.frontmatter.number}, batch is ${batch.cardNumber}`);
  const range = scopes(markdown);
  const review: Resolved[] = [];
  const paragraphRanges: {start: number; end: number}[] = [];
  for (const [i, edit] of batch.edits.entries()) {
    const key = edit.subsection ? `${edit.section}\0${edit.subsection}` : edit.section;
    const scope = range.get(key);
    requireShape(scope, `Edit ${i + 1}: section/subsection not found`);
    const raw = markdown.slice(scope.start, scope.end);
    const offsets: number[] = [];
    for (let at = raw.indexOf(edit.quote); at >= 0; at = raw.indexOf(edit.quote, at + 1)) {
      const absolute = scope.start + at;
      // A lens scope may contain subsection headings. An exact quote may not touch one.
      const lineStart = markdown.lastIndexOf('\n', absolute - 1) + 1;
      const lineEnd = markdown.indexOf('\n', absolute + edit.quote.length);
      const line = markdown.slice(lineStart, lineEnd < 0 ? markdown.length : lineEnd);
      if (!/^#{1,6} /.test(line)) offsets.push(absolute);
    }
    requireShape(offsets.length === 1, `Edit ${i + 1}: quote ${offsets.length ? 'ambiguous' : 'missing'} in ${edit.section}${edit.subsection ? ` / ${edit.subsection}` : ''}`);
    const at = offsets[0];
    const start = edit.action === 'insert-after' ? at + edit.quote.length : at;
    const end = edit.action === 'replace' || edit.action === 'delete' ? at + edit.quote.length : start;
    const after = edit.action === 'delete' ? '' : edit.text!;
    const paragraphStart = Math.max(scope.start, markdown.lastIndexOf('\n\n', start - 1) + 2);
    const nextBlank = markdown.indexOf('\n\n', end);
    const paragraphEnd = nextBlank < 0 ? scope.end : Math.min(scope.end, nextBlank);
    const paragraphBefore = markdown.slice(paragraphStart, paragraphEnd).trim();
    paragraphRanges.push({start: paragraphStart, end: paragraphEnd});
    review.push({start, end, before: markdown.slice(start, end), after, paragraphBefore, paragraphAfter: '', section: edit.section, ...(edit.subsection ? {subsection: edit.subsection} : {}), action: edit.action});
  }
  const sorted = [...review].sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 1; i < sorted.length; i++) requireShape(sorted[i].start > sorted[i - 1].end, 'Overlapping or touching edits; split into separate reviewed batches');
  let candidate = markdown;
  for (const edit of [...review].sort((a, b) => b.start - a.start)) candidate = candidate.slice(0, edit.start) + edit.after + candidate.slice(edit.end);
  for (const [i, paragraph] of paragraphRanges.entries()) {
    let final = markdown.slice(paragraph.start, paragraph.end);
    for (const edit of [...review].filter(x => x.start >= paragraph.start && x.end <= paragraph.end).sort((a, b) => b.start - a.start)) {
      final = final.slice(0, edit.start - paragraph.start) + edit.after + final.slice(edit.end - paragraph.start);
    }
    review[i].paragraphAfter = final.trim();
  }
  const after = parseCardMarkdown(candidate);
  requireShape(JSON.stringify(after.frontmatter) === JSON.stringify(parsed.frontmatter), 'Correction would change frontmatter');
  requireShape(JSON.stringify([...scopes(candidate).keys()]) === JSON.stringify([...range.keys()]), 'Correction would change headings/sections');
  requireShape(JSON.stringify(structuralMarkers(candidate)) === JSON.stringify(structuralMarkers(markdown)), 'Correction would change Markdown headings or structural markers');
  return {candidate, review};
}

export async function prepare(batchValue: unknown, cardsDir = defaultCardsDir): Promise<Prepared> {
  const batch = validateBatch(batchValue);
  const original = await readFile(cardFile(resolve(cardsDir), batch.cardNumber), 'utf8');
  const {candidate, review} = resolveBatch(original, batch);
  requireShape(candidate !== original, 'Batch makes no change');
  const payload = {format: 'mandala-codes/handwritten-corrections-prepared' as const, version: 1 as const, batch, sourceSha256: hash(original), candidateSha256: hash(candidate), review};
  return {...payload, approvalDigest: hash(JSON.stringify(payload))};
}

export async function apply(preparedValue: unknown, approvalDigest: string, cardsDir = defaultCardsDir, loadCards?: (dir: string) => Promise<unknown>): Promise<void> {
  requireShape(preparedValue && typeof preparedValue === 'object', 'Prepared review is invalid');
  const prepared = preparedValue as Prepared;
  requireShape(prepared.format === 'mandala-codes/handwritten-corrections-prepared' && prepared.version === 1, 'Unknown prepared format');
  requireShape(typeof prepared.approvalDigest === 'string' && /^[a-f0-9]{64}$/.test(prepared.approvalDigest), 'Invalid prepared digest');
  const {approvalDigest: embedded, ...payload} = prepared;
  requireShape(hash(JSON.stringify(payload)) === embedded && approvalDigest === embedded, 'Approval digest mismatch or prepared review tampered');
  const batch = validateBatch(prepared.batch);
  cardsDir = resolve(cardsDir);
  const path = cardFile(cardsDir, batch.cardNumber);
  const original = await readFile(path, 'utf8');
  requireShape(hash(original) === prepared.sourceSha256, 'Manuscript drifted since preparation');
  const {candidate, review} = resolveBatch(original, batch);
  requireShape(hash(candidate) === prepared.candidateSha256 && JSON.stringify(review) === JSON.stringify(prepared.review), 'Prepared review no longer matches exact edits');
  const validate = loadCards ?? (async (dir: string) => (await import('../mcp/oracle-server/src/corpus.ts')).loadCorpusFromDirectory(dir));
  // Validate the entire prospective corpus without touching the real card.
  const {mkdtemp, symlink, rm, open, rename} = await import('node:fs/promises');
  const {tmpdir} = await import('node:os');
  const temp = await mkdtemp(join(tmpdir(), 'oracle-handwritten-'));
  try {
    for (let n = 1; n <= 64; n++) {
      const dest = cardFile(temp, n);
      if (n === batch.cardNumber) await writeFile(dest, candidate, 'utf8');
      else await symlink(cardFile(cardsDir, n), dest);
    }
    await validate(temp);
  } finally {await rm(temp, {recursive: true, force: true});}
  const lockPath = `${path}.handwritten.lock`;
  const lock = await open(lockPath, 'wx').catch(() => {throw new Error('Card is locked by another correction import')});
  const staged = `${path}.handwritten-${process.pid}-${Date.now()}.tmp`;
  try {
    requireShape(hash(await readFile(path, 'utf8')) === prepared.sourceSha256, 'Manuscript drifted during validation');
    await writeFile(staged, candidate, 'utf8');
    requireShape(hash(await readFile(path, 'utf8')) === prepared.sourceSha256, 'Manuscript drifted before replacement');
    await rename(staged, path);
  } finally {
    await rm(staged, {force: true});
    await lock.close();
    await rm(lockPath, {force: true});
  }
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0];
  const allowed = mode === 'prepare' ? ['--file', '--out', '--cards-dir'] : mode === 'apply' ? ['--file', '--approve', '--cards-dir'] : [];
  requireShape(allowed.length > 0, 'Expected prepare or apply command');
  const flags = new Map<string, string>();
  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i], value = args[i + 1];
    requireShape(allowed.includes(flag), `Unknown flag ${flag}`);
    requireShape(!flags.has(flag), `Duplicate flag ${flag}`);
    requireShape(typeof value === 'string' && !!value && !value.startsWith('--'), `Missing value for ${flag}`);
    flags.set(flag, value);
  }
  const get = (flag: string) => flags.get(flag);
  const cardsDir = resolve(get('--cards-dir') ?? defaultCardsDir);
  if (mode === 'prepare' && get('--file') && get('--out')) {
    const result = await prepare(JSON.parse(await readFile(resolve(get('--file')!), 'utf8')), cardsDir);
    await writeFile(resolve(get('--out')!), JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
    console.log(`Card ${result.batch.cardNumber}: ${cardFile(cardsDir, result.batch.cardNumber)}`);
    for (const [i, edit] of result.review.entries()) console.log(`Edit ${i + 1} ${edit.section}${edit.subsection ? ` / ${edit.subsection}` : ''} ${edit.action}\nExact span: ${JSON.stringify(edit.before)} → ${JSON.stringify(edit.after)}\nBEFORE PARAGRAPH: ${edit.paragraphBefore}\nAFTER PARAGRAPH:  ${edit.paragraphAfter}`);
    console.log(`Approval digest: ${result.approvalDigest}\nReview file: ${resolve(get('--out')!)}`);
  } else if (mode === 'apply' && get('--file') && get('--approve')) {
    await apply(JSON.parse(await readFile(resolve(get('--file')!), 'utf8')), get('--approve')!, cardsDir);
    console.log('Applied and validated one card. Regenerate hosted artifacts before publication.');
  } else throw new Error('Usage: handwritten:corrections prepare --file batch.json --out prepared.json [--cards-dir DIR] | apply --file prepared.json --approve SHA256 [--cards-dir DIR]');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => {console.error((error as Error).message); process.exitCode = 1});
