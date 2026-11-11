/**
 * Voice bundle: the portable record of one card's applied spoken words.
 *
 * The Oracle app keeps the owner's applied words in private browser storage
 * (WorkingCardStore for the six lenses, SectionDraftStore for the entrance and
 * the review receipts). Nothing there reaches oracle/cards/NN.md. This module
 * turns that state into one JSON bundle per card, and validates a bundle a
 * person hands to scripts/voice-apply.ts.
 *
 * Pure and browser-safe: no Node APIs and no DOM. Hashing uses Web Crypto
 * through the existing sha256 helper, which Node 20+ also provides.
 *
 * What a bundle includes (version 1): every named section whose applied text
 * differs from the manuscript text the app was built with, whether it is fully
 * in the owner's words or only partly. Each section says which with
 * `authorship` and `fullyHuman`, so the apply step and the reviewer can tell
 * them apart. Sections the app cannot place with certainty are listed under
 * `omitted` with a reason, never guessed. Section title edits travel under
 * `titleEdits` as data; version 1 of the apply script does not write them,
 * because card headings carry a structural delimiter the parser splits on.
 */
import {cardSections, type CardSection} from './cardSections';
import type {WorkingSection} from './humanDrafts';
import {sectionTitleEdits, type SectionDraftSession} from './sectionDrafts';
import {cardSectionAuthorship, namedSectionOriginSpans, type SectionAuthorship} from './sectionAuthorship';
import type {SourceSnapshot} from './types';
import {sha256} from './workflow';

export const VOICE_BUNDLE_FORMAT = 'mandala-codes/oracle-voice-bundle';
export const VOICE_BUNDLE_VERSION = 1;

/** Limits for a file a person hands the apply script. Card 2 has 33 sections. */
export const VOICE_BUNDLE_LIMITS = {
  maxJsonChars: 2_000_000,
  maxSections: 200,
  maxTextChars: 50_000,
  maxBlocks: 500,
  maxPathParts: 8,
  maxPathPartChars: 240,
  maxRevisionChars: 200,
  maxReasonChars: 500,
} as const;

const LENS_IDS = ['INTRO', 'CODE', 'ICHING', 'KEYS', 'DESIGN', 'BODY', 'RELATIONS'] as const;
export type VoiceLensId = (typeof LENS_IDS)[number];

export interface VoiceText {
  text: string;
  /** Hex SHA-256 of `text` (UTF-8). */
  sha256: string;
  /** `text.length` in UTF-16 code units, as JavaScript counts it. */
  length: number;
}

export interface VoiceBlock {
  /** `unknown` marks joins between blocks and prose whose origin cannot be proved. */
  origin: 'human' | 'ai' | 'unknown';
  text: string;
}

export interface VoiceBundleSection {
  /** Stable section id from cardSections, for example `2/DESIGN/the-drive` or `2/INTRO`. */
  id: string;
  kind: 'manuscript' | 'intro';
  lensId: VoiceLensId;
  /** Human-readable path, for example ["Human Design", "The drive ... Gate 2"]. */
  path: string[];
  /** The section's flattened text exactly as the app read it from the manuscript. */
  original: VoiceText;
  /** The section's text now in the working card. Never equal to `original`. */
  applied: VoiceText;
  /** When the latest review receipt applied it, or when the lens was last saved. */
  appliedAt: string | null;
  authorship: SectionAuthorship;
  /** True only when every word of `applied` is proven to be the owner's. */
  fullyHuman: boolean;
  /** Ordered pieces of `applied`; their texts joined equal `applied.text`. */
  blocks: VoiceBlock[];
}

export interface VoiceTitleEdit {
  sectionId: string;
  path: string[];
  original: string;
  edited: string;
}

export interface VoiceOmission {
  sectionId: string;
  path: string[];
  reason: string;
}

export interface VoiceBundle {
  format: typeof VOICE_BUNDLE_FORMAT;
  version: typeof VOICE_BUNDLE_VERSION;
  cardNumber: number;
  exportedAt: string;
  /** The manuscript the app was built with. The apply script compares section by section, not only by this hash. */
  manuscript: {path: string; revision: string; sha256: string};
  sections: VoiceBundleSection[];
  titleEdits: VoiceTitleEdit[];
  omitted: VoiceOmission[];
}

export interface VoiceBundleInput {
  /** The current manuscript, as AuthoringServices.loadSource returns it. */
  source: SourceSnapshot;
  /** The card's entrance (frontmatter meta.centre), as the workspace passes it to cardSections. */
  introText?: string;
  /** WorkingCardStore.list(cardNumber). */
  working: WorkingSection[];
  /** SectionDraftStore.list(cardNumber). */
  sessions: SectionDraftSession[];
  /** Defaults to now. */
  exportedAt?: string;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
export const voiceCardPath = (cardNumber: number) => `oracle/cards/${pad2(cardNumber)}.md`;

async function voiceText(text: string): Promise<VoiceText> {
  return {text, sha256: await sha256(text), length: text.length};
}

function latestAppliedAt(node: CardSection, sessions: SectionDraftSession[], lens?: WorkingSection): string | null {
  const receipts = sessions
    .flatMap(session => session.results)
    .filter(result => result.sectionId === node.id && result.appliedAt && result.appliedText !== undefined)
    .map(result => result.appliedAt!)
    .sort();
  if (receipts.length) return receipts[receipts.length - 1];
  return lens?.savedAt ? lens.savedAt : null;
}

function latestLens(working: WorkingSection[], cardNumber: number, lensId: string): WorkingSection | undefined {
  const candidates = working.filter(section => section.cardNumber === cardNumber && section.sectionId === lensId);
  return candidates.length ? candidates.reduce((a, b) => (a.revision >= b.revision ? a : b)) : undefined;
}

/** Whether a working lens differs from the reading of the manuscript it was made from. */
function lensChanged(lens: WorkingSection): boolean {
  try {
    const own = cardSections(lens.source).find(node => node.lensId === lens.sectionId);
    return own?.sectionText !== lens.text;
  } catch {
    return true;
  }
}

/**
 * Build the bundle for one card from the app's private state. This is what the
 * workspace action "Send finished sections to the card" calls.
 */
export async function buildVoiceBundle(input: VoiceBundleInput): Promise<VoiceBundle> {
  const {source} = input;
  const cardNumber = source.cardNumber;
  const sessions = input.sessions.filter(session => session.cardNumber === cardNumber && session.sourceHash === source.hash);
  const nodes = cardSections(source, input.introText);
  const authorship = cardSectionAuthorship(source, nodes, input.working, sessions);
  const sections: VoiceBundleSection[] = [];
  const omitted: VoiceOmission[] = [];
  const staleLenses = new Set<string>();

  for (const node of nodes) {
    const lens = node.kind === 'manuscript' ? latestLens(input.working, cardNumber, node.lensId) : undefined;
    if (lens && lens.sourceHash !== source.hash) {
      // One notice per lens, and only when that stale copy holds changes of its own.
      if (!staleLenses.has(node.lensId)) {
        staleLenses.add(node.lensId);
        if (lensChanged(lens)) omitted.push({sectionId: node.id, path: [node.path[0]], reason: 'The working copy of this lens was made from an earlier version of the card. Reopen it in the workspace and compare it again.'});
      }
      continue;
    }
    const spans = namedSectionOriginSpans(source, node, input.working, sessions);
    if (!spans) {
      omitted.push({sectionId: node.id, path: node.path, reason: 'The app cannot prove where this section starts and ends in the working copy.'});
      continue;
    }
    const appliedText = spans.map(span => span.text).join('');
    if (appliedText === node.text) continue;
    if (!appliedText.trim()) {
      omitted.push({sectionId: node.id, path: node.path, reason: 'The working copy of this section is empty. Deleting a section is not supported.'});
      continue;
    }
    const origin = authorship.sections[node.id] ?? 'unknown';
    sections.push({
      id: node.id,
      kind: node.kind,
      lensId: node.lensId as VoiceLensId,
      path: [...node.path],
      original: await voiceText(node.text),
      applied: await voiceText(appliedText),
      appliedAt: latestAppliedAt(node, sessions, lens),
      authorship: origin,
      fullyHuman: origin === 'human',
      blocks: spans.filter(span => span.text.length > 0).map(span => ({origin: span.origin, text: span.text})),
    });
  }

  const titles = sectionTitleEdits(sessions, source.hash);
  const titleEdits: VoiceTitleEdit[] = nodes
    .filter(node => titles[node.id] !== undefined && titles[node.id] !== node.title)
    .map(node => ({sectionId: node.id, path: [...node.path], original: node.title, edited: titles[node.id]}));

  return {
    format: VOICE_BUNDLE_FORMAT,
    version: VOICE_BUNDLE_VERSION,
    cardNumber,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    manuscript: {path: voiceCardPath(cardNumber), revision: source.revision, sha256: source.hash},
    sections,
    titleEdits,
    omitted,
  };
}

/* ---------- Validation ---------- */

export class VoiceBundleError extends Error {
  constructor(readonly problems: string[]) {
    super(`This voice bundle cannot be used:\n- ${problems.join('\n- ')}`);
    this.name = 'VoiceBundleError';
  }
}

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value);
const HEX64 = /^[0-9a-f]{64}$/;
// Tab, line feed and carriage return are the only control characters prose may hold.
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const SECTION_ID = /^(\d{1,2})\/(INTRO|CODE|ICHING|KEYS|DESIGN|BODY|RELATIONS)((?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)$/;

function exactKeys(value: Json, keys: string[], where: string, problems: string[]) {
  for (const key of Object.keys(value)) if (!keys.includes(key)) problems.push(`${where}: unexpected field "${key}"`);
  for (const key of keys) if (!(key in value)) problems.push(`${where}: missing field "${key}"`);
}

function checkString(value: unknown, where: string, problems: string[], max: number, options: {allowEmpty?: boolean; singleLine?: boolean} = {}): value is string {
  if (typeof value !== 'string') { problems.push(`${where}: must be text`); return false; }
  if (value.length > max) { problems.push(`${where}: longer than ${max} characters`); return false; }
  if (!options.allowEmpty && !value.trim()) { problems.push(`${where}: is empty`); return false; }
  if (CONTROL.test(value)) { problems.push(`${where}: contains control characters`); return false; }
  if (options.singleLine && /[\r\n]/.test(value)) { problems.push(`${where}: must be one line`); return false; }
  return true;
}

function checkIso(value: unknown, where: string, problems: string[]) {
  if (typeof value !== 'string' || !ISO.test(value) || !Number.isFinite(Date.parse(value))) problems.push(`${where}: must be a UTC time like 2026-11-11T09:30:00.000Z`);
}

function checkPath(value: unknown, where: string, problems: string[]) {
  if (!Array.isArray(value) || value.length < 1 || value.length > VOICE_BUNDLE_LIMITS.maxPathParts) { problems.push(`${where}: must list 1 to ${VOICE_BUNDLE_LIMITS.maxPathParts} names`); return; }
  value.forEach((part, index) => checkString(part, `${where}[${index}]`, problems, VOICE_BUNDLE_LIMITS.maxPathPartChars, {singleLine: true}));
}

function checkVoiceText(value: unknown, where: string, problems: string[]): value is VoiceText {
  if (!isObject(value)) { problems.push(`${where}: must be an object`); return false; }
  const before = problems.length;
  exactKeys(value, ['text', 'sha256', 'length'], where, problems);
  checkString(value.text, `${where}.text`, problems, VOICE_BUNDLE_LIMITS.maxTextChars);
  if (typeof value.sha256 !== 'string' || !HEX64.test(value.sha256)) problems.push(`${where}.sha256: must be 64 lowercase hex characters`);
  if (typeof value.text === 'string' && value.length !== value.text.length) problems.push(`${where}.length: does not match the text`);
  return problems.length === before;
}

function checkSection(value: unknown, index: number, cardNumber: number, problems: string[]) {
  const where = `sections[${index}]`;
  if (!isObject(value)) { problems.push(`${where}: must be an object`); return; }
  exactKeys(value, ['id', 'kind', 'lensId', 'path', 'original', 'applied', 'appliedAt', 'authorship', 'fullyHuman', 'blocks'], where, problems);
  const id = typeof value.id === 'string' ? value.id.match(SECTION_ID) : null;
  if (!id) problems.push(`${where}.id: is not a card section id`);
  else {
    if (Number(id[1]) !== cardNumber) problems.push(`${where}.id: belongs to card ${id[1]}, not card ${cardNumber}`);
    if (id[2] !== value.lensId) problems.push(`${where}.lensId: does not match the id`);
    if ((id[2] === 'INTRO') !== (value.kind === 'intro')) problems.push(`${where}.kind: does not match the id`);
    if (id[2] === 'INTRO' && id[3]) problems.push(`${where}.id: the entrance has no subsections`);
  }
  if (value.kind !== 'manuscript' && value.kind !== 'intro') problems.push(`${where}.kind: must be "manuscript" or "intro"`);
  if (!LENS_IDS.includes(value.lensId as VoiceLensId)) problems.push(`${where}.lensId: unknown lens`);
  checkPath(value.path, `${where}.path`, problems);
  const originalOk = checkVoiceText(value.original, `${where}.original`, problems);
  const appliedOk = checkVoiceText(value.applied, `${where}.applied`, problems);
  if (originalOk && appliedOk && (value.original as VoiceText).text === (value.applied as VoiceText).text) problems.push(`${where}: applied text is the same as the original`);
  if (value.appliedAt !== null) checkIso(value.appliedAt, `${where}.appliedAt`, problems);
  if (!['human', 'mixed', 'ai', 'unknown'].includes(value.authorship as string)) problems.push(`${where}.authorship: must be human, mixed, ai or unknown`);
  if (typeof value.fullyHuman !== 'boolean') problems.push(`${where}.fullyHuman: must be true or false`);
  else if (value.fullyHuman !== (value.authorship === 'human')) problems.push(`${where}.fullyHuman: disagrees with authorship`);
  if (!Array.isArray(value.blocks) || value.blocks.length < 1 || value.blocks.length > VOICE_BUNDLE_LIMITS.maxBlocks) { problems.push(`${where}.blocks: must list 1 to ${VOICE_BUNDLE_LIMITS.maxBlocks} blocks`); return; }
  let joined = '';
  value.blocks.forEach((block, blockIndex) => {
    const at = `${where}.blocks[${blockIndex}]`;
    if (!isObject(block)) { problems.push(`${at}: must be an object`); return; }
    exactKeys(block, ['origin', 'text'], at, problems);
    if (!['human', 'ai', 'unknown'].includes(block.origin as string)) problems.push(`${at}.origin: must be human, ai or unknown`);
    if (checkString(block.text, `${at}.text`, problems, VOICE_BUNDLE_LIMITS.maxTextChars, {allowEmpty: true})) joined += block.text;
  });
  if (appliedOk && joined !== (value.applied as VoiceText).text) problems.push(`${where}.blocks: do not add up to the applied text`);
  if (value.fullyHuman === true && value.blocks.some(block => isObject(block) && block.origin === 'ai')) problems.push(`${where}.blocks: an AI block in a section marked fully human`);
}

/**
 * Strict check of an untrusted bundle, including every text hash. Returns the
 * bundle typed, or throws VoiceBundleError listing every problem found.
 */
export async function validateVoiceBundle(value: unknown): Promise<VoiceBundle> {
  const problems: string[] = [];
  if (!isObject(value)) throw new VoiceBundleError(['the bundle must be a JSON object']);
  exactKeys(value, ['format', 'version', 'cardNumber', 'exportedAt', 'manuscript', 'sections', 'titleEdits', 'omitted'], 'bundle', problems);
  if (value.format !== VOICE_BUNDLE_FORMAT) problems.push(`format: must be "${VOICE_BUNDLE_FORMAT}"`);
  if (value.version !== VOICE_BUNDLE_VERSION) problems.push(`version: this tool reads version ${VOICE_BUNDLE_VERSION} only`);
  const cardNumber = value.cardNumber;
  const cardOk = typeof cardNumber === 'number' && Number.isInteger(cardNumber) && cardNumber >= 1 && cardNumber <= 64;
  if (!cardOk) problems.push('cardNumber: must be a whole number from 1 to 64');
  checkIso(value.exportedAt, 'exportedAt', problems);

  if (!isObject(value.manuscript)) problems.push('manuscript: must be an object');
  else {
    exactKeys(value.manuscript, ['path', 'revision', 'sha256'], 'manuscript', problems);
    if (cardOk && value.manuscript.path !== voiceCardPath(cardNumber as number)) problems.push(`manuscript.path: must be ${voiceCardPath(cardNumber as number)}`);
    checkString(value.manuscript.revision, 'manuscript.revision', problems, VOICE_BUNDLE_LIMITS.maxRevisionChars, {singleLine: true});
    if (typeof value.manuscript.sha256 !== 'string' || !HEX64.test(value.manuscript.sha256)) problems.push('manuscript.sha256: must be 64 lowercase hex characters');
  }

  if (!Array.isArray(value.sections) || value.sections.length > VOICE_BUNDLE_LIMITS.maxSections) problems.push(`sections: must be a list of at most ${VOICE_BUNDLE_LIMITS.maxSections}`);
  else {
    if (cardOk) value.sections.forEach((section, index) => checkSection(section, index, cardNumber as number, problems));
    const ids = value.sections.map(section => (isObject(section) ? section.id : undefined));
    if (new Set(ids).size !== ids.length) problems.push('sections: the same section appears twice');
  }

  for (const [field, keys] of [['titleEdits', ['sectionId', 'path', 'original', 'edited']], ['omitted', ['sectionId', 'path', 'reason']]] as const) {
    const list = value[field];
    if (!Array.isArray(list) || list.length > VOICE_BUNDLE_LIMITS.maxSections) { problems.push(`${field}: must be a list of at most ${VOICE_BUNDLE_LIMITS.maxSections}`); continue; }
    list.forEach((item, index) => {
      const where = `${field}[${index}]`;
      if (!isObject(item)) { problems.push(`${where}: must be an object`); return; }
      exactKeys(item, [...keys], where, problems);
      const id = typeof item.sectionId === 'string' ? item.sectionId.match(SECTION_ID) : null;
      if (!id || (cardOk && Number(id[1]) !== cardNumber)) problems.push(`${where}.sectionId: is not a section of this card`);
      checkPath(item.path, `${where}.path`, problems);
      for (const key of keys.slice(2)) checkString(item[key], `${where}.${key}`, problems, VOICE_BUNDLE_LIMITS.maxReasonChars, {singleLine: key !== 'reason'});
    });
  }

  if (problems.length) throw new VoiceBundleError(problems);

  const bundle = value as unknown as VoiceBundle;
  for (const [index, section] of bundle.sections.entries()) {
    for (const side of ['original', 'applied'] as const) {
      if (await sha256(section[side].text) !== section[side].sha256) problems.push(`sections[${index}].${side}.sha256: does not match its text`);
    }
  }
  if (problems.length) throw new VoiceBundleError(problems);
  return bundle;
}

/** Parse and validate bundle JSON text, refusing oversized input before parsing it. */
export async function parseVoiceBundle(json: string): Promise<VoiceBundle> {
  if (typeof json !== 'string') throw new VoiceBundleError(['the bundle must be JSON text']);
  if (json.length > VOICE_BUNDLE_LIMITS.maxJsonChars) throw new VoiceBundleError([`the file is larger than ${VOICE_BUNDLE_LIMITS.maxJsonChars} characters`]);
  let value: unknown;
  try { value = JSON.parse(json); } catch (error) { throw new VoiceBundleError([`the file is not valid JSON (${(error as Error).message})`]); }
  return validateVoiceBundle(value);
}

/** Pretty JSON for saving a bundle to a file. */
export const serializeVoiceBundle = (bundle: VoiceBundle) => JSON.stringify(bundle, null, 2) + '\n';
