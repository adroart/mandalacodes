/**
 * Pure, I/O-free consent + claim logic for the Atlas steward flow (M2).
 *
 * Everything here is deterministic and isomorphic, like utils/ledger.ts —
 * no fetch, no env, no R2 — so the unit suite can pin the consent state
 * machine without mocking Cloudflare. The HTTP handlers in
 * functions/api/atlas/steward/* compose these inside the concurrency-safe
 * mutators (validation re-runs in the mutator closure on retry).
 *
 * Invariants enforced here:
 *   - Client consent input is validated with WHITELIST discipline: exactly
 *     one field (`ring2MapPresence`) is accepted; anything else — including
 *     attempts to smuggle server-stamped fields like `version`, `capturedAt`,
 *     `capturedBy`, `ring3ChartPresence`, `ring4` — is rejected.
 *   - `version`, `capturedAt`, `capturedBy` are stamped server-side only.
 *   - Rings 3–4 are never asked at claim; they're recorded as 'deferred'.
 *   - The `claimed` chain event is built server-side from a fixed field set
 *     (no client data ever reaches the hashed payload) and appended at most
 *     once per chain — the Founding Lights ordinal is first-claim-only.
 *   - Consent itself NEVER enters a ledger event. Ring 2 maps onto the
 *     existing `withdrawn`/`revealed` event semantics instead.
 */
import { CONSENT_VERSION } from '../types';
import type { ConsentState, LedgerEvent, StewardRecord } from '../types';
import { appendEvent } from './ledger';
import { projectPiece } from './ledgerProjection';

// ---------- Input validation (whitelist discipline) ----------

/** The ONLY consent field a client may send. Everything else is stamped or
 *  deferred server-side. */
export interface ConsentInput {
  ring2MapPresence: boolean;
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Strictly validate the `consent` object from a Phase B claim body.
 * Rejects non-objects, missing/non-boolean ring2MapPresence, and ANY
 * unknown field — the server, not the client, decides what a ConsentState
 * contains.
 */
export function parseConsentInput(value: unknown): ParseResult<ConsentInput> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'consent must be an object' };
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (key !== 'ring2MapPresence') {
      return { ok: false, error: `consent: unknown field "${key}"` };
    }
  }
  if (typeof obj.ring2MapPresence !== 'boolean') {
    return { ok: false, error: 'consent.ring2MapPresence must be a boolean' };
  }
  return { ok: true, value: { ring2MapPresence: obj.ring2MapPresence } };
}

/** Longest first inscription we'll hold. Generous — it's one prompt, not an essay. */
export const FIRST_INSCRIPTION_MAX_LENGTH = 2000;

/**
 * Validate the optional `firstInscription` from a Phase B claim body.
 * Returns the trimmed text, or undefined when absent/blank (both fine —
 * the prompt is optional), or an error for non-strings / oversized input.
 */
export function parseFirstInscription(
  value: unknown,
): ParseResult<string | undefined> {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  if (typeof value !== 'string') {
    return { ok: false, error: 'firstInscription must be a string' };
  }
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: undefined };
  if (trimmed.length > FIRST_INSCRIPTION_MAX_LENGTH) {
    return {
      ok: false,
      error: `firstInscription must be at most ${FIRST_INSCRIPTION_MAX_LENGTH} characters`,
    };
  }
  return { ok: true, value: trimmed };
}

// ---------- Consent stamping (server-side only) ----------

/**
 * Build the next ConsentState from a validated input. Fresh captures record
 * Rings 3–4 as 'deferred' (they're opened later from the piece's book);
 * updates to an existing consent preserve whatever Rings 3–4 already hold
 * and only move Ring 2 + the stamp.
 */
export function nextConsentState(
  input: ConsentInput,
  previous: ConsentState | undefined,
  capturedBy: string,
  capturedAt: string,
): ConsentState {
  return {
    version: CONSENT_VERSION,
    capturedAt,
    capturedBy,
    ring2MapPresence: input.ring2MapPresence,
    ring3ChartPresence: previous?.ring3ChartPresence ?? 'deferred',
    ring4: previous?.ring4 ?? 'deferred',
  };
}

// ---------- Steward record transitions ----------

/**
 * Phase A bind: attach the Clerk userId (first match only) and bump
 * activity. Deliberately does NOT touch outreachStatus — 'claimed' gates on
 * consent capture (Phase B), not on the bind.
 */
export function bindStewardOnClaim(
  record: StewardRecord,
  userId: string,
  now: string,
): StewardRecord {
  return {
    ...record,
    clerkUserId: record.clerkUserId ?? userId,
    lastClaimAt: now,
  };
}

/**
 * Phase B: write the stamped consent, append it to the audit history, flip
 * outreachStatus to 'claimed', and (once) store the optional first
 * inscription. An existing pendingFirstInscription is never overwritten —
 * the ritual answer is the FIRST one.
 */
export function applyConsentToSteward(
  record: StewardRecord,
  consent: ConsentState,
  firstInscription?: string,
): StewardRecord {
  const next: StewardRecord = {
    ...record,
    clerkUserId: record.clerkUserId ?? consent.capturedBy,
    consent,
    consentHistory: [...(record.consentHistory ?? []), consent],
    outreachStatus: 'claimed',
    lastClaimAt: consent.capturedAt,
  };
  if (firstInscription && !record.pendingFirstInscription) {
    next.pendingFirstInscription = {
      text: firstInscription,
      createdAt: consent.capturedAt,
    };
  }
  return next;
}

// ---------- Chain event planning (Phase B) ----------

export function genEventId(): string {
  const rnd = crypto.getRandomValues(new Uint8Array(10));
  let hex = '';
  for (let i = 0; i < rnd.length; i++) hex += rnd[i].toString(16).padStart(2, '0');
  return `evt-${Date.now().toString(36)}-${hex}`;
}

export interface ClaimChainOptions {
  pieceId: string;
  editionNumber?: number;
  /** Opaque Clerk userId — stamped server-side, never an email or name. */
  actorRef: string;
  /** ISO now. appendEvent rejects anything before the chain tip. */
  now: string;
  /** The Ring 2 choice, applied via withdrawn/revealed semantics. */
  ring2MapPresence: boolean;
}

/**
 * Plan the chain events for a Phase B consent capture on one piece.
 * Returns the fully-hashed events to append (possibly empty):
 *
 *   - `claimed` — ONLY if the chain has no claimed event yet (the projector
 *     ignores repeats, but we keep the chain clean: first claim per chain
 *     sets the Founding Lights ordinal). Fixed field set: id, pieceId,
 *     editionNumber, type, date, actor 'steward', actorRef. No cityId, no
 *     note, no PII — nothing client-supplied enters the hashed payload.
 *   - `withdrawn` — when Ring 2 is declined and the piece is currently
 *     public (mirrors the steward/update diff rules).
 *   - `revealed` — when Ring 2 is granted and the piece is currently hidden.
 *
 * The chain MUST be sorted ascending (groupChains' output). May throw
 * BackdatedEventError when the chain tip is dated in the future — callers
 * surface that as a 409, same as steward/update.
 */
export async function planClaimChainEvents(
  chain: LedgerEvent[],
  opts: ClaimChainOptions,
): Promise<LedgerEvent[]> {
  if (chain.length === 0) return [];

  const current = projectPiece(chain);
  const appended: LedgerEvent[] = [];
  let runningChain = chain;

  const push = async (
    draft: Omit<LedgerEvent, 'hash' | 'prevHash'>,
  ): Promise<void> => {
    const full = await appendEvent(runningChain, draft);
    runningChain = [...runningChain, full];
    appended.push(full);
  };

  // editionNumber is spread in only when present so the claimed payload's
  // own keys are exactly the documented set (the canonicalizer would drop
  // an undefined anyway, but the in-memory event should match the chain).
  const base = {
    pieceId: opts.pieceId,
    ...(opts.editionNumber !== undefined
      ? { editionNumber: opts.editionNumber }
      : {}),
    date: opts.now,
    actor: 'steward' as const,
    actorRef: opts.actorRef,
  };

  const alreadyClaimed = chain.some((e) => e.type === 'claimed');
  if (!alreadyClaimed) {
    await push({ id: genEventId(), type: 'claimed', ...base });
  }

  if (!opts.ring2MapPresence && current.isPublic) {
    await push({
      id: genEventId(),
      type: 'withdrawn',
      cityId: current.currentCityId,
      ...base,
    });
  } else if (opts.ring2MapPresence && !current.isPublic) {
    await push({
      id: genEventId(),
      type: 'revealed',
      cityId: current.currentCityId,
      ...base,
    });
  }

  return appended;
}
