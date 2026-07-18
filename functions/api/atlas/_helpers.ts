/**
 * Shared helpers for /api/atlas/* Cloudflare Pages Functions.
 *
 * Centralizes:
 *   - R2 read/write for the three Atlas keys (ledger, stewards, public).
 *   - JSON response helper.
 *   - Public state regeneration after any ledger write.
 *   - Steward lookup by auth identity (userId or verified email).
 *
 * Admin and steward auth both run through `functions/api/_lib/auth.ts` —
 * Better Auth verifies the session cookie, ADMIN_EMAILS gates admin routes,
 * and the steward record's `clerkUserId` / `email` binds a piece to its
 * collector.
 *
 * No HTTP handlers live here — only utilities the route files import.
 */

import type {
  AtlasLetter,
  ClaimRequest,
  LedgerEvent,
  SharedIntention,
  StewardRecord,
  PublicAtlasState,
} from '../../../types';
import { projectAll, toPublicState } from '../../../utils/ledgerProjection';
import { liveIntentionsByKey } from '../../../utils/intentions';
import { ATLAS_PLACES } from '../../../data/cities';
import { FULL_ARCHIVE } from '../../../data/mockData';
import { mirrorPublicState } from './_mirror';
import type { MirrorEnv } from './_mirror';
import type { AuthEnv } from '../_lib/auth';

// ---------- R2 keys ----------

export const KEY_LEDGER = 'atlas/ledger.json';
export const KEY_STEWARDS = 'atlas/stewards.json';
export const KEY_PUBLIC = 'atlas/public.json';
export const KEY_CLAIM_REQUESTS = 'atlas/claimRequests.json';
export const KEY_LETTERS = 'atlas/letters.json';
export const KEY_SHARED_INTENTIONS = 'atlas/sharedIntentions.json';

// ---------- Env typing ----------

export interface AtlasEnv extends MirrorEnv, AuthEnv {
  ATLAS_BUCKET: R2Bucket;
  /** Shared `adrian-website` D1 database (see wrangler.toml). The atlas
   *  side uses it ONLY for the mutable legacy tables shipped in the
   *  003_atlas_legacy migration (todo/handoff/adrian-website/). Optional:
   *  handlers degrade with a clear 503 until that migration is applied. */
  DB?: AtlasD1Database;
  /** Dedicated secret for the adrianrasmussen.com sale webhook (M4) —
   *  HMAC-SHA256 over `timestamp.rawBody`. 32+ random bytes, set on BOTH
   *  Pages projects (see todo/handoff/adrian-website/sale-webhook-spec.md).
   *  Optional: /api/atlas/sale answers 503 until it is provisioned. */
  SALE_WEBHOOK_SECRET?: string;
}

// Minimal D1 shapes — same philosophy as the R2 types above: just what we
// call, so we don't depend on @cloudflare/workers-types here.
export interface AtlasD1PreparedStatement {
  bind(...values: unknown[]): AtlasD1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<{ success: boolean; meta?: { changes?: number } }>;
  all<T = unknown>(): Promise<{ results: T[] }>;
}
export interface AtlasD1Database {
  prepare(query: string): AtlasD1PreparedStatement;
}

/** True when a D1 error means the 003_atlas_legacy tables don't exist yet
 *  (migration not applied on the shared database). */
export function isMissingTableError(err: unknown): boolean {
  return err instanceof Error && /no such table/i.test(err.message);
}

/** The graceful-degradation response for every legacy endpoint until the
 *  D1 migration lands (it ships via todo/handoff/adrian-website/). */
export function migrationNotApplied(): Response {
  return json(
    {
      ok: false,
      error:
        'The legacy archive is not available yet — D1 migration 003_atlas_legacy has not been applied to the shared database.',
    },
    503,
  );
}

// Minimal shape we need from R2 — avoids depending on @cloudflare/workers-types.
// `put` with `onlyIf` mirrors the real binding: it resolves to null when the
// precondition fails (etag mismatch / unexpected existing object) instead of
// throwing, which is what the retry loop in mutateJsonArray keys off.
interface R2Conditional {
  etagMatches?: string;
  etagDoesNotMatch?: string;
}
interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(
    key: string,
    value: string,
    options?: { httpMetadata?: { contentType?: string }; onlyIf?: R2Conditional },
  ): Promise<unknown | null>;
}
interface R2Object {
  /** R2's etag for the stored object — the token for conditional writes. */
  etag: string;
  text(): Promise<string>;
}

export interface PagesContext<E = AtlasEnv> {
  request: Request;
  env: E;
}

// ---------- JSON responses ----------

export function json(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

// ---------- R2 read/write ----------

function parseJsonArray<T>(text: string): T[] {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function readJsonArray<T>(env: AtlasEnv, key: string): Promise<T[]> {
  const obj = await env.ATLAS_BUCKET.get(key);
  if (!obj) return [];
  return parseJsonArray<T>(await obj.text());
}

async function readJsonObject<T>(env: AtlasEnv, key: string): Promise<T | null> {
  const obj = await env.ATLAS_BUCKET.get(key);
  if (!obj) return null;
  try {
    const text = await obj.text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function readLedger(env: AtlasEnv): Promise<LedgerEvent[]> {
  return readJsonArray<LedgerEvent>(env, KEY_LEDGER);
}

export async function readStewards(env: AtlasEnv): Promise<StewardRecord[]> {
  return readJsonArray<StewardRecord>(env, KEY_STEWARDS);
}

export async function readClaimRequests(env: AtlasEnv): Promise<ClaimRequest[]> {
  return readJsonArray<ClaimRequest>(env, KEY_CLAIM_REQUESTS);
}

export async function readLetters(env: AtlasEnv): Promise<AtlasLetter[]> {
  return readJsonArray<AtlasLetter>(env, KEY_LETTERS);
}

export async function readSharedIntentions(env: AtlasEnv): Promise<SharedIntention[]> {
  return readJsonArray<SharedIntention>(env, KEY_SHARED_INTENTIONS);
}

// NOTE: there are deliberately no bare writeLedger/writeStewards helpers.
// Every mutation of those two objects must go through mutateLedger /
// mutateStewards below so concurrent writes can never silently drop data.

export async function readPublicState(
  env: AtlasEnv,
): Promise<PublicAtlasState | null> {
  return readJsonObject<PublicAtlasState>(env, KEY_PUBLIC);
}

// ---------- Concurrency-safe R2 mutation ----------

/**
 * Read-modify-write retries before giving up. Three attempts is plenty at
 * this write rate — a conflict means another request landed between our
 * read and put, and the immediate re-read almost always succeeds.
 */
const MAX_MUTATE_ATTEMPTS = 3;

/** What a mutator returns: the new array to persist plus a caller-defined
 *  result (e.g. the appended event) handed back on success. */
export interface Mutation<T, R> {
  next: T[];
  result: R;
}

export interface MutateSuccess<T, R> {
  ok: true;
  /** The mutator's result from the attempt that won the conditional put. */
  result: R;
  /** The array as persisted — callers use it to regenerate derived state. */
  next: T[];
}

/**
 * Concurrency-safe read-modify-write for an R2 JSON array.
 *
 * Reads the object (capturing its etag), applies `mutate` to the parsed
 * array, then writes back with a conditional put: `etagMatches` when the
 * object existed, `etagDoesNotMatch: '*'` (if-none-match) when it didn't.
 * If another writer landed in between, the put resolves null and we re-read
 * and re-apply — so concurrent ledger/steward writes can never silently
 * drop each other's data (last-write-wins is fatal for an append-only log).
 *
 * The mutator may return a Response instead of a Mutation to abort — e.g.
 * a validation conflict detected against the freshly-read data. That
 * Response is returned to the caller untouched, and nothing is written.
 *
 * All mutations of atlas/ledger.json and atlas/stewards.json must go
 * through this (via mutateLedger / mutateStewards below) — never through
 * a bare read + write pair.
 */
type Mutator<T, R> = (
  current: T[],
) => Promise<Mutation<T, R> | Response> | Mutation<T, R> | Response;

export async function mutateJsonArray<T, R>(
  env: AtlasEnv,
  key: string,
  mutate: Mutator<T, R>,
): Promise<MutateSuccess<T, R> | Response> {
  for (let attempt = 0; attempt < MAX_MUTATE_ATTEMPTS; attempt++) {
    const obj = await env.ATLAS_BUCKET.get(key);
    const current = obj ? parseJsonArray<T>(await obj.text()) : [];

    const outcome = await mutate(current);
    if (outcome instanceof Response) return outcome;

    const onlyIf: R2Conditional = obj
      ? { etagMatches: obj.etag }
      : { etagDoesNotMatch: '*' };
    const put = await env.ATLAS_BUCKET.put(
      key,
      JSON.stringify(outcome.next, null, 2),
      { httpMetadata: { contentType: 'application/json' }, onlyIf },
    );
    if (put !== null) {
      return { ok: true, result: outcome.result, next: outcome.next };
    }
    // Precondition failed — another writer got in first. Loop: re-read,
    // re-apply the mutation against the fresh state, re-put.
  }
  return json(
    { ok: false, error: 'Concurrent write conflict — please retry' },
    503,
  );
}

/** Concurrency-safe mutation of atlas/ledger.json. */
export function mutateLedger<R>(
  env: AtlasEnv,
  mutate: Mutator<LedgerEvent, R>,
): Promise<MutateSuccess<LedgerEvent, R> | Response> {
  return mutateJsonArray<LedgerEvent, R>(env, KEY_LEDGER, mutate);
}

/** Concurrency-safe mutation of atlas/stewards.json. */
export function mutateStewards<R>(
  env: AtlasEnv,
  mutate: Mutator<StewardRecord, R>,
): Promise<MutateSuccess<StewardRecord, R> | Response> {
  return mutateJsonArray<StewardRecord, R>(env, KEY_STEWARDS, mutate);
}

/** Concurrency-safe mutation of atlas/claimRequests.json (M4). */
export function mutateClaimRequests<R>(
  env: AtlasEnv,
  mutate: Mutator<ClaimRequest, R>,
): Promise<MutateSuccess<ClaimRequest, R> | Response> {
  return mutateJsonArray<ClaimRequest, R>(env, KEY_CLAIM_REQUESTS, mutate);
}

/** Concurrency-safe mutation of atlas/letters.json (M5). The piece's letters
 *  are mutable R2 — never chain events — so generation, mark-read, and the
 *  anniversary-on-read derivation all serialize through this. */
export function mutateLetters<R>(
  env: AtlasEnv,
  mutate: Mutator<AtlasLetter, R>,
): Promise<MutateSuccess<AtlasLetter, R> | Response> {
  return mutateJsonArray<AtlasLetter, R>(env, KEY_LETTERS, mutate);
}

/** Concurrency-safe mutation of atlas/sharedIntentions.json (M6, Lens 2).
 *  The map-of-dreams entries are mutable R2 — never chain events, and never
 *  a mirror of the D1 inscription body beyond the 280-char display cut. */
export function mutateSharedIntentions<R>(
  env: AtlasEnv,
  mutate: Mutator<SharedIntention, R>,
): Promise<MutateSuccess<SharedIntention, R> | Response> {
  return mutateJsonArray<SharedIntention, R>(env, KEY_SHARED_INTENTIONS, mutate);
}

// ---------- Steward issuance (shared by issue.ts + the sale queue) ----------

export interface IssueStewardInput {
  pieceId: string;
  editionNumber?: number;
  /** Optional since the claim-code path: a code-carrying record can exist with
   *  no email. The sale-queue and legacy admin paths still always pass one. */
  email?: string;
  name?: string;
  notes?: string;
  /** SHA-256 hash of the freshly-minted claim code (utils/claimCode.ts). The
   *  plaintext is generated and returned by the caller once; only this hash is
   *  ever stored. When present, `claimCodeIssuedAt` / `claimCodeVersion` are
   *  set too. Absent for ordinary email-only issuance. */
  claimCodeHash?: string;
  claimCodeIssuedAt?: string;
  claimCodeVersion?: number;
}

/**
 * Create a steward record for a piece, with the dup-check running INSIDE
 * the mutator so it re-applies against fresh data on a conflict retry —
 * two racing issuances for the same piece can never both land. One steward
 * per (pieceId, editionNumber) tuple. Shared by the admin issue endpoint
 * and the sale-queue confirm path (which must never duplicate this logic).
 */
export async function issueStewardRecord(
  env: AtlasEnv,
  input: IssueStewardInput,
): Promise<MutateSuccess<StewardRecord, StewardRecord> | Response> {
  return mutateStewards(env, (stewards) => {
    const exists = stewards.find(
      (s) =>
        s.pieceId === input.pieceId &&
        (s.editionNumber ?? undefined) === (input.editionNumber ?? undefined),
    );
    if (exists) {
      return json(
        { ok: false, error: 'A steward already exists for this piece' },
        400,
      );
    }

    const record: StewardRecord = {
      pieceId: input.pieceId,
      editionNumber: input.editionNumber,
      ...(input.email ? { email: input.email } : {}),
      name: input.name,
      notes: input.notes,
      issuedAt: new Date().toISOString(),
      outreachStatus: 'invited',
      ...(input.claimCodeHash
        ? {
            claimCodeHash: input.claimCodeHash,
            claimCodeIssuedAt: input.claimCodeIssuedAt ?? new Date().toISOString(),
            claimCodeVersion: input.claimCodeVersion ?? 1,
          }
        : {}),
    };

    return { next: [...stewards, record], result: record };
  });
}

/**
 * Unbind every steward record bound to `userId`: drop the binding and rewind
 * outreachStatus to 'invited', so the piece reverts to the artist's root of
 * trust (it can be re-issued or transferred later). RATIFIED: the history
 * lives with the piece — inscriptions and the chain are NOT touched by an
 * account removal; only the binding goes. No-ops when the steward bucket is
 * unconfigured. Used by the Better Auth account-deletion hook (it replaced the
 * retired Clerk `user.deleted` webhook).
 */
export async function unbindStewardsForUser(
  env: AtlasEnv,
  userId: string,
): Promise<void> {
  if (!env.ATLAS_BUCKET || !userId) return;
  await mutateStewards(env, (stewards) => ({
    next: stewards.map((s) => {
      if (s.clerkUserId !== userId) return s;
      const { clerkUserId: _gone, ...rest } = s;
      return { ...rest, outreachStatus: 'invited' };
    }),
    result: undefined,
  }));
}

// ---------- Public state regeneration ----------

/**
 * Piece → { series, category, isSignaturePiece } used by toPublicState to
 * derive series/category, the marker type, and the kind facet.
 *
 * The archive is the source of truth; but a piece can live entirely OUTSIDE
 * FULL_ARCHIVE (a catalogued work whose genesis was minted by id alone, before
 * the catalog row lands). For those, fall back to the series/category the
 * genesis `created` event carried on the chain (gap 4). Archive always wins
 * over genesis-carried meta.
 */
function buildArtworkMeta(
  events: readonly LedgerEvent[],
): Map<string, { series?: string; category?: string; isSignaturePiece?: boolean }> {
  const map = new Map<
    string,
    { series?: string; category?: string; isSignaturePiece?: boolean }
  >();
  for (const a of FULL_ARCHIVE) {
    map.set(a.id, {
      series: a.series,
      category: a.category,
      isSignaturePiece: a.isSignaturePiece,
    });
  }
  // Genesis-carried fallback for pieces the archive does not (yet) hold.
  for (const e of events) {
    if (e.type !== 'created') continue;
    if (map.has(e.pieceId)) continue; // archive wins
    if (e.series || e.category) {
      map.set(e.pieceId, { series: e.series, category: e.category });
    }
  }
  return map;
}

/**
 * Build the map of chain key → the steward's ring3ChartPresence value, used
 * by toPublicState to derive the kinshipEligible boolean (M5). Only the
 * single boolean-or-'deferred' is lifted off each record — the consent
 * OBJECT never travels into the projection or the public state.
 */
function buildRing3ByKey(
  stewards: readonly StewardRecord[],
): Map<string, boolean | 'deferred'> {
  const map = new Map<string, boolean | 'deferred'>();
  for (const s of stewards) {
    const ring3 = s.consent?.ring3ChartPresence;
    if (ring3 === undefined) continue;
    map.set(`${s.pieceId}:${s.editionNumber ?? 0}`, ring3);
  }
  return map;
}

/**
 * Re-derive PublicAtlasState from a full ledger and persist it to R2.
 * Called after every successful ledger write so the GET cache stays fresh.
 * The GitHub mirror is a side-effect that never blocks the response.
 *
 * Reads the steward records too — but ONLY to lift each piece's Ring 3
 * boolean for the kinshipEligible flag (M5). No consent object, email, name,
 * or any other steward field ever reaches the public projection.
 *
 * Also reads the shared-intentions store to attach each qualifying piece's
 * live dream text (M6, Lens 2) — display text only, already cut to 280
 * characters at share time; never the private inscription body.
 */
export async function regeneratePublicState(
  env: AtlasEnv,
  events: LedgerEvent[],
): Promise<PublicAtlasState> {
  const records = projectAll(events);
  const meta = buildArtworkMeta(events);
  const stewards = await readStewards(env);
  const ring3ByKey = buildRing3ByKey(stewards);
  const intentions = await readSharedIntentions(env);
  const intentionsByKey = liveIntentionsByKey(intentions);
  // ATLAS_PLACES = cities + country-level centroids, so "country only"
  // placements resolve to a glowing dot like any city.
  const state = toPublicState(records, meta, ATLAS_PLACES, ring3ByKey, intentionsByKey);
  const jsonBody = JSON.stringify(state, null, 2);
  // Deliberately a plain (unconditional) put, not a conditional one. Every
  // caller here (event.ts, claim.ts, steward/update.ts, sales/confirm.ts,
  // _transfer.ts…) already derives `events`/`state` from the freshest ledger
  // it JUST wrote via mutateLedger's own conditional put — the ledger itself
  // can never silently drop a write. What's left is a much narrower race:
  // two regenerations landing back-to-back can commit their PUTs to
  // public.json out of order, so a slightly-behind write can briefly
  // clobber a fresher one. That state is self-healing — the very next ledger
  // write (by anyone) recomputes public.json from scratch off the full,
  // intact ledger, so the staleness never survives more than one write. A
  // conditional put here would need a prior GET of public.json to have
  // anything to condition on, and the etag it captured would only tell us
  // "did someone else write since my GET," not "is their write newer than
  // mine" — so it can't actually guarantee ordering, only add a GET to every
  // regeneration for a race that already self-corrects. Given that, and that
  // the plan explicitly defers building a re-read retry loop here, this is
  // left as a plain put with the race consciously accepted.
  await env.ATLAS_BUCKET.put(KEY_PUBLIC, jsonBody, {
    httpMetadata: { contentType: 'application/json' },
  });
  void mirrorPublicState(env, jsonBody).catch(() => undefined);
  return state;
}

// ---------- Steward lookup by auth identity ----------

/**
 * Find a steward record matching either the auth user id (preferred) or
 * the email (fallback for first-time bind). Returns the *first* matching
 * record — a user can only steward one piece via this lookup, but
 * the `editionNumber` field still distinguishes editions of the same
 * piece if relevant.
 *
 * The email fallback only runs when `emailVerified` is true: binding a piece
 * by email is an identity claim, so the session must have proven control of
 * that email (email-code / Google sign-in, or a verified password account).
 * Otherwise an unverified password signup could bind a piece issued to
 * someone else's address. Records already bound to a userId still match by
 * userId regardless.
 */
export function findStewardForUser(
  stewards: readonly StewardRecord[],
  userId: string,
  email: string | null,
  emailVerified: boolean = false,
): StewardRecord | null {
  const byUserId = stewards.find((s) => s.clerkUserId === userId);
  if (byUserId) return byUserId;
  if (!email || !emailVerified) return null;
  const normalized = email.toLowerCase();
  return stewards.find((s) => !s.clerkUserId && (s.email || '').toLowerCase() === normalized) ?? null;
}

/**
 * Same as findStewardForUser but returns every match — useful when one
 * collector stewards multiple pieces.
 *
 * userId matches are MERGED with email matches that have no clerkUserId
 * yet, rather than short-circuiting on the first userId hit. Otherwise a
 * collector who already bound one piece could never bind a second one
 * issued to the same email. Records already bound to a DIFFERENT userId
 * never match by email — re-binding is reserved for an audited transfer.
 *
 * The email fallback only runs when `emailVerified` is true — see
 * findStewardForUser. userId matches are always returned.
 */
export function findStewardsForUser(
  stewards: readonly StewardRecord[],
  userId: string,
  email: string | null,
  emailVerified: boolean = false,
): StewardRecord[] {
  const matches = stewards.filter((s) => s.clerkUserId === userId);
  if (!email || !emailVerified) return matches;
  const normalized = email.toLowerCase();
  for (const s of stewards) {
    if (s.clerkUserId) continue; // bound records only ever match by userId
    if ((s.email || '').toLowerCase() === normalized) matches.push(s);
  }
  return matches;
}

// ---------- Steward-facing sanitization ----------

/**
 * Strip admin-only context from a steward record before returning it to a
 * non-admin caller. `notes` are the admin's private annotations and must
 * never reach the collector; everything else on the record is the
 * collector's own data.
 *
 * `pendingFirstInscription` (the claim-ritual answer) belongs to the
 * AUTHORING steward only: it is returned solely when `viewerUserId` matches
 * the record's bound clerkUserId, and never to anyone else — admin roster
 * included (see stewards/index.ts).
 */
export function toStewardView(
  record: StewardRecord,
  viewerUserId?: string,
): Omit<StewardRecord, 'notes'> {
  const { notes: _notes, ...rest } = record;
  if (
    rest.pendingFirstInscription &&
    (!viewerUserId || record.clerkUserId !== viewerUserId)
  ) {
    const { pendingFirstInscription: _pfi, ...withoutInscription } = rest;
    return withoutInscription;
  }
  return rest;
}

/**
 * Strip admin-authored `note` fields from ledger events before returning
 * them to a non-admin caller. The note is operational context written by
 * the admin (and from M0 on, non-personal by policy) — but it was never
 * meant for the collector's eyes. The returned copies are display objects
 * only; the stored chain (and its hashes) is untouched.
 */
export function sanitizeEventsForSteward(events: readonly LedgerEvent[]): LedgerEvent[] {
  return events.map((e) => {
    if (e.actor !== 'admin' || e.note === undefined) return e;
    const { note: _note, ...rest } = e;
    return rest as LedgerEvent;
  });
}
