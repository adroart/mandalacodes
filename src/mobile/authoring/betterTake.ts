/**
 * The Mac's better transcript for a card recording ("take"), read back on the phone.
 *
 * fetchBetterTranscripts asks the account (operation `better-get` of /api/oracle/authoring/private) for the results
 * the Mac left beside this account's audio. mergeBetterTranscript decides, without side effects, what a take becomes:
 *  - the phone's own draft is never overwritten;
 *  - words the owner has not edited are replaced by the Mac's, and its doubtful words become the words to check;
 *  - words he has edited stay exactly as they are, and a comparison (accept, keep, decide later) is returned instead;
 *  - the same result twice changes nothing.
 * The rules are the ones the website reflections use (utils/oracleBetterTranscript.ts); this file only maps a take onto them.
 * Nothing here polls or runs on a timer: call fetchBetterTranscripts when the workspace opens.
 */
import { Capacitor } from '../../../mobile/node_modules/@capacitor/core';
import { createNativeAccountFetch } from '../account/nativeAccountTransport';
import { applyBetter, betterView, resolveBetter, type BetterVersion, type SegmentMeta } from '../../../utils/oracleBetterTranscript';
import type { AlignedWord } from '../../../lib/oracle/authoring/types';
import type { ReconciliationDecision } from '../../../lib/oracle/authoring/reconciliation';

/** Words below this probability are flagged for checking, the same line the review uses. */
export const UNCERTAIN_BELOW = 0.6;
const MAX_HASHES_PER_CALL = 50;
const HASH = /^[a-f0-9]{64}$/;

export interface BetterTranscript {
  /** SHA-256 of the take's audio, as the private copy keys it. */
  hash: string;
  resultHash: string;
  engine: string;
  engineVersion?: string | null;
  receivedAt: string;
  text: string;
  segments: { startMs: number; endMs: number; text: string; speaker?: string }[];
  words: AlignedWord[];
}

type Transport = (path: string, init?: RequestInit) => Promise<Response>;
const defaultTransport = (): Transport => (Capacitor.isNativePlatform() ? createNativeAccountFetch() : fetch);

function readBetter(value: unknown): BetterTranscript | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (typeof item.hash !== 'string' || !HASH.test(item.hash) || typeof item.text !== 'string' || !item.text.trim()) return null;
  if (typeof item.resultHash !== 'string' || typeof item.engine !== 'string' || typeof item.receivedAt !== 'string') return null;
  const words = Array.isArray(item.words) ? item.words.filter((word): word is AlignedWord => !!word && typeof word.text === 'string' && Number.isFinite(word.startMs) && Number.isFinite(word.endMs)) : [];
  const segments = Array.isArray(item.segments) ? item.segments.filter((segment) => !!segment && typeof segment.text === 'string' && Number.isFinite(segment.startMs) && Number.isFinite(segment.endMs)) : [];
  return { hash: item.hash, resultHash: item.resultHash, engine: item.engine, engineVersion: typeof item.engineVersion === 'string' ? item.engineVersion : null, receivedAt: item.receivedAt, text: item.text, segments, words };
}

/**
 * The better transcripts that exist for these audio hashes, from the signed-in account's own recordings only.
 * Hashes with no result are simply absent from the map. Throws a plain sentence when the account cannot be reached.
 */
export async function fetchBetterTranscripts(hashes: string[], transport: Transport = defaultTransport()): Promise<Map<string, BetterTranscript>> {
  const found = new Map<string, BetterTranscript>();
  let queue = [...new Set(hashes.filter((hash) => HASH.test(hash)))];
  // A large reply is split by the server; `more` names what to ask for again. Bounded so a bad reply cannot loop.
  for (let rounds = 0; queue.length && rounds < 1000; rounds += 1) {
    const batch = queue.slice(0, MAX_HASHES_PER_CALL);
    queue = queue.slice(MAX_HASHES_PER_CALL);
    const response = await transport('/api/oracle/authoring/private', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation: 'better-get', hashes: batch }), signal: AbortSignal.timeout(60000) });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw Error(response.status === 401 ? 'Sign in to see the better transcripts from your Mac.' : result?.error ?? 'Your account could not be reached for the better transcripts.');
    for (const item of Array.isArray(result?.results) ? result.results : []) {
      const better = readBetter(item);
      if (better && batch.includes(better.hash)) found.set(better.hash, better);
    }
    const more = Array.isArray(result?.more) ? result.more.filter((hash: unknown): hash is string => typeof hash === 'string' && batch.includes(hash) && !found.has(hash)) : [];
    // Progress is required: a reply that returned nothing yet deferred everything is not asked again.
    if (more.length && more.length < batch.length) queue = [...more, ...queue];
  }
  return found;
}

/** A take's transcript as the merge sees it. The later interface maps its own take record onto this. */
export interface TakeTranscript {
  /** What the phone's own speech model heard. Never replaced. */
  draft: { text: string; provider: string };
  /** The words the review currently proposes for this take. */
  proposedWords: string;
  /** True once the owner has changed the proposed words by hand. */
  editedByHand: boolean;
  /** Words to check against the recording. */
  uncertainWords: string[];
  /** Timed words of the proposed words, when known. */
  words?: AlignedWord[];
  /** The Mac's version, once one has been taken in (state applied, resolved or reconcile). */
  better?: BetterVersion;
}

export interface TakeComparison {
  /** Both sides in sentence-per-line form, as the review's comparison uses. */
  base: string;
  suggested: string;
  changes: { id: string; before: string; after: string }[];
  choices: readonly ['accept', 'keep', 'defer'];
}

export type MergeResult =
  | { outcome: 'unchanged'; take: TakeTranscript }
  | { outcome: 'applied'; take: TakeTranscript }
  | { outcome: 'compare'; take: TakeTranscript; comparison: TakeComparison };

const CHOICES = ['accept', 'keep', 'defer'] as const;

/** The low-probability words of a result, once each, in order. */
export const uncertainWordsOf = (words: AlignedWord[]) => [...new Set(words.filter((word) => typeof word.probability === 'number' && word.probability < UNCERTAIN_BELOW).map((word) => word.text.trim()).filter(Boolean))];

const segmentOf = (take: TakeTranscript) => ({
  transcript: take.proposedWords,
  metadata: { provider: take.editedByHand ? 'manual' : take.draft.provider, draft: take.draft, ...(take.better ? { arCreate: take.better } : {}) } as SegmentMeta,
});
const inputOf = (better: BetterTranscript) => ({ engine: better.engine, ...(better.engineVersion ? { engineVersion: better.engineVersion } : {}), text: better.text, resultHash: better.resultHash });

/** Pure. What `current` becomes with the Mac's `better` transcript. A comparison changes nothing on the take. */
export function mergeBetterTranscript(current: TakeTranscript, better: BetterTranscript): MergeResult {
  const outcome = applyBetter(segmentOf(current), inputOf(better), better.receivedAt);
  if (outcome.outcome === 'applied') {
    return { outcome: 'applied', take: { ...current, proposedWords: outcome.transcript, words: better.words, uncertainWords: uncertainWordsOf(better.words), better: outcome.meta.arCreate } };
  }
  if (outcome.outcome === 'reconcile') {
    const comparison = betterView(outcome.meta)?.comparison;
    if (comparison) return { outcome: 'compare', take: current, comparison: { base: comparison.base, suggested: comparison.suggested, changes: comparison.changes, choices: CHOICES } };
  }
  // Already taken in, or the Mac heard exactly the owner's own words: record that it arrived, keep the words.
  if (current.better?.resultHash === better.resultHash) return { outcome: 'unchanged', take: current };
  return { outcome: 'unchanged', take: { ...current, better: outcome.meta.arCreate } };
}

export type ResolveTakeResult = { ok: true; done: boolean; take: TakeTranscript } | { ok: false; error: string };

/**
 * Pure. The owner's choices on a comparison from mergeBetterTranscript, by change id. Every change needs accept or keep
 * before the words change; while any is left on defer the take is returned as it was.
 */
export function resolveBetterTake(current: TakeTranscript, better: BetterTranscript, choices: Record<string, ReconciliationDecision>, now: string): ResolveTakeResult {
  const opened = applyBetter(segmentOf(current), inputOf(better), better.receivedAt);
  if (opened.outcome !== 'reconcile') return { ok: false, error: 'There is no better transcript waiting to be compared.' };
  const resolved = resolveBetter({ transcript: current.proposedWords, metadata: opened.meta }, choices, now);
  if ('error' in resolved) return { ok: false, error: resolved.error };
  if (!resolved.done) return { ok: true, done: false, take: current };
  const changed = resolved.transcript !== current.proposedWords;
  return { ok: true, done: true, take: { ...current, proposedWords: resolved.transcript, editedByHand: true, ...(changed ? { words: undefined } : {}), better: resolved.meta.arCreate } };
}
