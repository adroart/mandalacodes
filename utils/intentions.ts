/**
 * Pure, I/O-free logic for the shared-intentions map of dreams (M6, Lens 2).
 *
 * Like utils/inscriptions.ts and utils/consent.ts: no fetch, no env, no R2,
 * no D1 — deterministic and isomorphic, so the unit suite can pin the rules
 * without mocking Cloudflare. functions/api/atlas/steward/share-intention.ts
 * and functions/api/atlas/intentions/* compose these around the D1 read
 * and the concurrency-safe R2 mutator.
 *
 * Invariants enforced here:
 *   - Only an inscription of kind 'intention' may be shared. Sorting, not
 *     approval (Adrian, 2026-07-04): words about a business, a place, or a
 *     name belong to their own fields and are never smuggled into the
 *     anonymous dream layer via this door — the kind check is the sort.
 *   - The shared inscription must be authored by the sharing steward, not
 *     sealed (a time capsule stays private until it opens), and not erased.
 *   - Display text is a hard cut at 1200 characters — the map shows a
 *     fragment of the dream, never the whole private entry. Dreams are long
 *     (Adrian, 2026-07-18: assume paragraphs), so the fragment is generous;
 *     the private book still holds every word.
 *   - One live entry per piece: sharing again while one is live revives/
 *     replaces it rather than stacking duplicates on the map.
 *   - Withdrawing never rewrites history — it flips status, same discipline
 *     as the ledger's own event-append model.
 */
import type { InscriptionRow } from './inscriptions';
import { isSealClosed } from './inscriptions';
import type { LedgerEvent, SharedIntention } from '../types';
import type { ParseResult } from './consent';

// ---------- Constants ----------

/** The map shows a fragment of the dream, never the whole private entry.
 *  Raised from 280 to 1200 (Adrian, 2026-07-18): dreams are paragraphs, not
 *  sentences, so a shared fragment carries a real opening. */
export const SHARED_INTENTION_DISPLAY_MAX = 1200;

// ---------- Ids ----------

export function genSharedIntentionId(): string {
  const rnd = crypto.getRandomValues(new Uint8Array(10));
  let hex = '';
  for (let i = 0; i < rnd.length; i++) hex += rnd[i].toString(16).padStart(2, '0');
  return `sin-${Date.now().toString(36)}-${hex}`;
}

// ---------- Display text ----------

/** First 1200 characters of the inscription body, captured at share time. A
 *  hard cut — the map is a fragment, never the whole private entry. */
export function toDisplayText(body: string): string {
  const trimmed = body.trim();
  if (trimmed.length <= SHARED_INTENTION_DISPLAY_MAX) return trimmed;
  return trimmed.slice(0, SHARED_INTENTION_DISPLAY_MAX).trimEnd();
}

// ---------- Share eligibility (the sort, not a gate) ----------

export type ShareEligibilityError =
  | 'not-found'
  | 'wrong-kind'
  | 'not-author'
  | 'sealed'
  | 'erased';

export interface ShareEligibilityResult {
  ok: true;
}
export interface ShareEligibilityFailure {
  ok: false;
  error: ShareEligibilityError;
  message: string;
}

const ELIGIBILITY_MESSAGES: Record<ShareEligibilityError, string> = {
  'not-found': 'No such entry in the book.',
  'wrong-kind':
    'Only an intention may ride the map. Words about a business, a place, or a name have their own homes.',
  'not-author': 'Only the entry’s author may share it.',
  sealed: 'A sealed entry stays private until it opens.',
  erased: 'This entry has been removed and cannot be shared.',
};

/**
 * Whether an inscription row may be shared onto the map by `userId`, right
 * now. Pure decision — the caller supplies the row and its chain (for the
 * seal check) and the current time.
 */
export function checkShareEligibility(
  row: Pick<
    InscriptionRow,
    'kind' | 'author_user_id' | 'body' | 'erased_at' | 'sealed_until' | 'created_at'
  > | null,
  userId: string,
  chain: readonly LedgerEvent[],
  nowIso: string,
): ShareEligibilityResult | ShareEligibilityFailure {
  if (!row) {
    return { ok: false, error: 'not-found', message: ELIGIBILITY_MESSAGES['not-found'] };
  }
  if (row.kind !== 'intention') {
    return { ok: false, error: 'wrong-kind', message: ELIGIBILITY_MESSAGES['wrong-kind'] };
  }
  if (row.author_user_id !== userId) {
    return { ok: false, error: 'not-author', message: ELIGIBILITY_MESSAGES['not-author'] };
  }
  if (row.erased_at || row.body === null) {
    return { ok: false, error: 'erased', message: ELIGIBILITY_MESSAGES['erased'] };
  }
  if (isSealClosed(row, chain, nowIso)) {
    return { ok: false, error: 'sealed', message: ELIGIBILITY_MESSAGES['sealed'] };
  }
  return { ok: true };
}

// ---------- Chain key (shared convention) ----------

export function intentionChainKey(pieceId: string, editionNumber: number | undefined): string {
  return `${pieceId}:${editionNumber ?? 0}`;
}

// ---------- Input validation (whitelist discipline) ----------

export interface ShareIntentionInput {
  pieceId: string;
  editionNumber?: number;
  inscriptionId: string;
  share: boolean;
}

export function parseShareIntentionInput(
  value: unknown,
): ParseResult<ShareIntentionInput> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'body must be an object' };
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (
      key !== 'pieceId' &&
      key !== 'editionNumber' &&
      key !== 'inscriptionId' &&
      key !== 'share'
    ) {
      return { ok: false, error: `unknown field "${key}"` };
    }
  }
  const pieceId = typeof obj.pieceId === 'string' ? obj.pieceId : '';
  if (!pieceId) return { ok: false, error: 'Missing pieceId' };
  if (obj.editionNumber !== undefined && typeof obj.editionNumber !== 'number') {
    return { ok: false, error: 'editionNumber must be a number' };
  }
  const inscriptionId = typeof obj.inscriptionId === 'string' ? obj.inscriptionId : '';
  if (!inscriptionId) return { ok: false, error: 'Missing inscriptionId' };
  if (typeof obj.share !== 'boolean') {
    return { ok: false, error: 'share must be a boolean' };
  }
  return {
    ok: true,
    value: {
      pieceId,
      ...(typeof obj.editionNumber === 'number' ? { editionNumber: obj.editionNumber } : {}),
      inscriptionId,
      share: obj.share,
    },
  };
}

// ---------- Mutation planning (pure) ----------

/**
 * Plan the next sharedIntentions array for a share:true / share:false
 * request. Pure — the caller supplies the current array, the eligible row's
 * display text, and now. One live entry max per (pieceId, editionNumber):
 * an existing live/rehomed/withdrawn entry for the same inscription is
 * revived in place; a still-live entry for a DIFFERENT inscription on the
 * same piece is superseded (its status becomes 'withdrawn') so the map never
 * shows two dreams for one piece at once.
 */
export function planShareIntention(
  current: readonly SharedIntention[],
  input: { pieceId: string; editionNumber?: number; inscriptionId: string; text: string },
  nowIso: string,
): SharedIntention[] {
  const key = intentionChainKey(input.pieceId, input.editionNumber);
  const sameInscription = current.find((e) => e.inscriptionId === input.inscriptionId);

  const next = current.map((e) => {
    if (e.inscriptionId === input.inscriptionId) {
      return {
        ...e,
        text: input.text,
        sharedAt: nowIso,
        status: 'live' as const,
        tended: false,
        tendedAt: undefined,
      };
    }
    // Supersede any other still-live entry for the same piece.
    if (
      e.status === 'live' &&
      intentionChainKey(e.pieceId, e.editionNumber) === key
    ) {
      return { ...e, status: 'withdrawn' as const };
    }
    return e;
  });

  if (!sameInscription) {
    next.push({
      id: genSharedIntentionId(),
      pieceId: input.pieceId,
      editionNumber: input.editionNumber,
      inscriptionId: input.inscriptionId,
      text: input.text,
      sharedAt: nowIso,
      status: 'live',
    });
  }

  return next;
}

/** Withdraw the live entry for a given inscription. No-op (returns the same
 *  array, by value) if none is live — withdrawing an unshared piece succeeds
 *  quietly rather than erroring. */
export function planWithdrawIntention(
  current: readonly SharedIntention[],
  inscriptionId: string,
): SharedIntention[] {
  return current.map((e) =>
    e.inscriptionId === inscriptionId && e.status === 'live'
      ? { ...e, status: 'withdrawn' as const }
      : e,
  );
}

// ---------- Tending (admin) ----------

export type TendAction = 'keep' | 'rehome' | 'withdraw';

export interface TendResult {
  next: SharedIntention[];
  /** The entry as it stood before tending — used by the caller to decide
   *  whether a rehome letter is owed (only 'rehome' on a piece that was
   *  actually live warrants one). */
  entry: SharedIntention | null;
}

/**
 * Apply a tending action to one entry by id. Pure — the caller writes the
 * rehome letter (needs piece-voice prose, which lives in utils/letters.ts)
 * and regenerates public state afterward.
 */
export function planTendIntention(
  current: readonly SharedIntention[],
  id: string,
  action: TendAction,
  nowIso: string,
): TendResult {
  let found: SharedIntention | null = null;
  const next = current.map((e) => {
    if (e.id !== id) return e;
    found = e;
    switch (action) {
      case 'keep':
        return { ...e, tended: true, tendedAt: nowIso };
      case 'rehome':
        return { ...e, status: 'rehomed' as const, tended: true, tendedAt: nowIso };
      case 'withdraw':
        return { ...e, status: 'withdrawn' as const, tended: true, tendedAt: nowIso };
      default:
        return e;
    }
  });
  return { next, entry: found };
}

// ---------- Public-state composition ----------

/** Whether a piece's live shared intention may appear in the public
 *  projection: the entry must be status 'live', and the piece itself must
 *  already be present in the visible-pieces set (same ring2/isPublic
 *  discipline toPublicState applies everywhere else — a private piece never
 *  gains a public surface through this door). */
export function liveIntentionsByKey(
  entries: readonly SharedIntention[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of entries) {
    if (e.status !== 'live') continue;
    map.set(intentionChainKey(e.pieceId, e.editionNumber), e.text);
  }
  return map;
}
