/**
 * A better transcript for a phone recording, made on Adrian's Mac and brought back here.
 *
 * Rules this file enforces, in one place so the endpoints stay thin:
 *  - The first draft (what the phone's quick speech model heard) is never overwritten. When the Mac's text takes its
 *    place, the draft moves into the segment's metadata under `draft` and stays there.
 *  - Text Adrian already edited is never replaced silently. The Mac's version waits as a reconciliation, using the
 *    same accept / keep / defer changes as the card writing review, and nothing changes until he decides.
 *  - Sending the same result twice changes nothing.
 */
import { composeReconciliation, reconcileHunks, validateReconciliation, type Reconciliation, type ReconciliationDecision } from '../lib/oracle/authoring/reconciliation';

export const MAX_BETTER_TEXT_BYTES = 100_000;
const MAX_EARLIER_VERSIONS = 5;

export interface DraftRecord { provider: string; text: string; rawTranscript?: string; wordFixes?: unknown }
export interface EarlierVersion { resultHash: string; receivedAt: string; wordCount: number }
export type BetterState = 'applied' | 'reconcile' | 'resolved';
export interface BetterVersion {
  state: BetterState;
  engine: string;
  engineVersion?: string;
  receivedAt: string;
  resultHash: string;
  text: string;
  wordCount: number;
  speakerCount?: number;
  resultKey?: string;
  jobId?: string;
  sourceId?: string;
  reconciliation?: Reconciliation;
  resolvedAt?: string;
}
export interface SegmentMeta {
  provider?: string;
  wordCount?: number;
  duration?: number | null;
  rawTranscript?: string;
  wordFixes?: unknown;
  draft?: DraftRecord;
  arCreate?: BetterVersion;
  arCreateEarlier?: EarlierVersion[];
  pickupSkipped?: { reason: string; at: string };
  [key: string]: unknown;
}
export interface BetterInput {
  engine: string;
  engineVersion?: string;
  text: string;
  resultHash: string;
  resultKey?: string;
  speakerCount?: number;
  jobId?: string;
  sourceId?: string;
}
export interface SegmentLike { transcript: string; metadata: SegmentMeta }

export function parseMeta(value: unknown): SegmentMeta {
  if (typeof value !== 'string' || !value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as SegmentMeta : {};
  } catch { return {}; }
}

export const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** True when this segment still has no Mac version and was not set aside. */
export const awaitingBetter = (meta: SegmentMeta) => !meta.arCreate && !meta.pickupSkipped;

/** True when Adrian has put his own words on this segment. */
export const editedByHand = (meta: SegmentMeta) => meta.provider === 'manual';

/**
 * Sentence-per-line form for comparing. Reconciliation works on lines, and a spoken reflection is usually one long
 * paragraph, so each sentence becomes its own change. The mapping is reversible: a real line break is held as U+2028
 * while comparing and a sentence break is a single space turned into a newline.
 */
export const toSentenceLines = (text: string) => text.replace(/\r\n?/g, '\n').replace(/\n/g, '\u2028').replace(/([.!?…。！？])( )(?=\S)/g, '$1\n');
export const fromSentenceLines = (text: string) => text.replace(/\n/g, ' ').replace(/\u2028/g, '\n');

/** What the phone's own model said, kept before anything replaces it. */
function draftOf(transcript: string, meta: SegmentMeta): DraftRecord | undefined {
  if (meta.draft) return meta.draft;
  if (!transcript.trim() || editedByHand(meta)) return undefined;
  return {
    provider: meta.provider ?? 'unknown',
    text: transcript,
    ...(meta.rawTranscript === undefined ? {} : { rawTranscript: meta.rawTranscript }),
    ...(meta.wordFixes === undefined ? {} : { wordFixes: meta.wordFixes }),
  };
}

/** Metadata for a manual edit: Adrian's words become the working text; the first draft and the Mac's version stay. */
export function metaAfterManualEdit(transcript: string, previous: SegmentMeta, newText: string): SegmentMeta {
  const draft = draftOf(transcript, previous);
  const next: SegmentMeta = { provider: 'manual', wordCount: countWords(newText) };
  if (draft) next.draft = draft;
  if (previous.arCreate) {
    const keep = previous.arCreate;
    // An edit made while a comparison is open ends it: his words stand, and the Mac's version stays on record.
    next.arCreate = keep.state === 'reconcile' ? { ...stripReconciliation(keep), state: 'resolved' } : keep;
  }
  if (previous.arCreateEarlier?.length) next.arCreateEarlier = previous.arCreateEarlier;
  if (previous.pickupSkipped) next.pickupSkipped = previous.pickupSkipped;
  return next;
}

function stripReconciliation(version: BetterVersion): BetterVersion {
  const { reconciliation: _reconciliation, ...rest } = version;
  return rest;
}

export type ApplyOutcome =
  | { outcome: 'unchanged'; transcript: string; meta: SegmentMeta }
  | { outcome: 'applied' | 'reconcile'; transcript: string; meta: SegmentMeta };

/** Take in the Mac's transcript for a segment. Pure: returns what the row should become. */
export function applyBetter(segment: SegmentLike, input: BetterInput, now: string): ApplyOutcome {
  const { transcript, metadata } = segment;
  const previous = metadata.arCreate;
  if (previous && previous.resultHash === input.resultHash) return { outcome: 'unchanged', transcript, meta: metadata };

  const earlier = [...(metadata.arCreateEarlier ?? [])];
  if (previous) {
    earlier.unshift({ resultHash: previous.resultHash, receivedAt: previous.receivedAt, wordCount: previous.wordCount });
  }
  const base: SegmentMeta = { ...metadata };
  delete base.pickupSkipped;
  if (earlier.length) base.arCreateEarlier = earlier.slice(0, MAX_EARLIER_VERSIONS);

  const text = input.text.trim();
  const version: BetterVersion = {
    state: 'applied',
    engine: input.engine,
    ...(input.engineVersion ? { engineVersion: input.engineVersion } : {}),
    receivedAt: now,
    resultHash: input.resultHash,
    text,
    wordCount: countWords(text),
    ...(input.speakerCount === undefined ? {} : { speakerCount: input.speakerCount }),
    ...(input.resultKey ? { resultKey: input.resultKey } : {}),
    ...(input.jobId ? { jobId: input.jobId } : {}),
    ...(input.sourceId ? { sourceId: input.sourceId } : {}),
  };

  // Adrian's own words, or a Mac version he already settled: compare, never replace.
  const settledBefore = previous?.state === 'resolved' || previous?.state === 'reconcile';
  if (editedByHand(metadata) || settledBefore) {
    if (text === transcript.trim()) {
      return { outcome: 'unchanged', transcript, meta: { ...base, arCreate: { ...version, state: 'resolved', resolvedAt: now } } };
    }
    const reconciliation: Reconciliation = {
      base: toSentenceLines(transcript),
      suggested: toSentenceLines(text),
      evidenceKey: input.resultHash,
      decisions: {},
      concerns: {},
      history: [],
    };
    return { outcome: 'reconcile', transcript, meta: { ...base, arCreate: { ...version, state: 'reconcile', reconciliation } } };
  }

  const draft = draftOf(transcript, metadata);
  const next: SegmentMeta = { ...base, provider: 'ar-create', wordCount: version.wordCount, arCreate: version };
  delete next.rawTranscript;
  delete next.wordFixes;
  if (draft) next.draft = draft;
  return { outcome: 'applied', transcript: text, meta: next };
}

/** The changed parts of an open comparison, in order. */
export const openChanges = (reconciliation: Reconciliation) => reconcileHunks(reconciliation.base, reconciliation.suggested).filter((hunk) => hunk.changed);

export type ResolveResult =
  | { ok: true; done: boolean; transcript: string; meta: SegmentMeta }
  | { ok: false; error: string };

/**
 * Record Adrian's choices on an open comparison. Every change needs accept or keep before the words change; any
 * change left on defer (or unanswered) keeps the comparison open and the current words as they are.
 */
export function resolveBetter(segment: SegmentLike, choices: Record<string, unknown>, now: string): ResolveResult {
  const { transcript, metadata } = segment;
  const version = metadata.arCreate;
  if (!version || version.state !== 'reconcile' || !version.reconciliation) return { ok: false, error: 'There is no better transcript waiting to be compared.' };
  const changes = openChanges(version.reconciliation);
  const known = new Set(changes.map((change) => change.id));
  const decisions: Record<string, ReconciliationDecision> = { ...version.reconciliation.decisions };
  for (const [id, value] of Object.entries(choices)) {
    if (!known.has(id)) return { ok: false, error: 'That change is no longer in this comparison. Refresh and compare again.' };
    if (value !== 'accept' && value !== 'keep' && value !== 'defer') return { ok: false, error: 'Choose to use the Mac version, keep yours, or decide later.' };
    decisions[id] = value;
  }
  const reconciliation: Reconciliation = { ...version.reconciliation, decisions };
  try { validateReconciliation(reconciliation); } catch (error) { return { ok: false, error: (error as Error).message }; }
  const undecided = changes.some((change) => decisions[change.id] !== 'accept' && decisions[change.id] !== 'keep');
  if (undecided) {
    return { ok: true, done: false, transcript, meta: { ...metadata, arCreate: { ...version, reconciliation } } };
  }
  const composed = fromSentenceLines(composeReconciliation(reconciliation)).trim();
  if (!composed) return { ok: false, error: 'The result would be empty. Keep some words.' };
  const next = metaAfterManualEdit(transcript, metadata, composed);
  next.arCreate = { ...stripReconciliation(version), state: 'resolved', resolvedAt: now };
  return { ok: true, done: true, transcript: composed, meta: next };
}

export interface BetterView {
  state: BetterState;
  engine: string;
  receivedAt: string;
  wordCount: number;
  draft?: { provider: string; text: string };
  /** Present only while a comparison is open. `base` and `suggested` are in sentence-per-line form. */
  comparison?: { base: string; suggested: string; decisions: Record<string, ReconciliationDecision>; changes: { id: string; before: string; after: string }[] };
}

/** What the signed-in page is shown about a segment's Mac version and its kept first draft. */
export function betterView(meta: SegmentMeta): BetterView | null {
  const version = meta.arCreate;
  if (!version) return null;
  const view: BetterView = { state: version.state, engine: version.engine, receivedAt: version.receivedAt, wordCount: version.wordCount };
  if (meta.draft) view.draft = { provider: meta.draft.provider, text: meta.draft.text };
  if (version.state === 'reconcile' && version.reconciliation) {
    const { reconciliation } = version;
    view.comparison = {
      base: reconciliation.base,
      suggested: reconciliation.suggested,
      decisions: reconciliation.decisions,
      changes: openChanges(reconciliation).map(({ id, before, after }) => ({ id, before, after })),
    };
  }
  return view;
}
