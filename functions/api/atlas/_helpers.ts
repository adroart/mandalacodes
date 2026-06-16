/**
 * Shared helpers for /api/atlas/* Cloudflare Pages Functions.
 *
 * Centralizes:
 *   - R2 read/write for the three Atlas keys (ledger, stewards, public).
 *   - JSON response helper.
 *   - Public state regeneration after any ledger write.
 *   - Steward lookup by Clerk identity (userId or email).
 *
 * Admin and steward auth both run through `functions/api/_lib/clerk.ts` —
 * Clerk verifies the bearer JWT, ADMIN_EMAILS gates admin routes, and the
 * steward record's `clerkUserId` / `email` binds a piece to its collector.
 *
 * No HTTP handlers live here — only utilities the route files import.
 */

import type {
  AtlasLetter,
  ClaimRequest,
  LedgerEvent,
  StewardRecord,
  PublicAtlasState,
} from '../../../types';
import { projectAll, toPublicState } from '../../../utils/ledgerProjection';
import { ATLAS_PLACES } from '../../../data/cities';
import { FULL_ARCHIVE } from '../../../data/mockData';
import { mirrorPublicState } from './_mirror';
import type { MirrorEnv } from './_mirror';
import type { AuthEnv } from '../_lib/clerk';

// ---------- R2 keys ----------

export const KEY_LEDGER = 'atlas/ledger.json';
export const KEY_STEWARDS = 'atlas/stewards.json';
export const KEY_PUBLIC = 'atlas/public.json';
export const KEY_CLAIM_REQUESTS = 'atlas/claimRequests.json';
export const KEY_LETTERS = 'atlas/letters.json';

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

// ---------- Steward issuance (shared by issue.ts + the sale queue) ----------

export interface IssueStewardInput {
  pieceId: string;
  editionNumber?: number;
  email: string;
  name?: string;
  notes?: string;
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
      email: input.email,
      name: input.name,
      notes: input.notes,
      issuedAt: new Date().toISOString(),
      outreachStatus: 'invited',
    };

    return { next: [...stewards, record], result: record };
  });
}

// ---------- Public state regeneration ----------

function buildArtworkMeta(): Map<string, { series?: string; category?: string }> {
  const map = new Map<string, { series?: string; category?: string }>();
  for (const a of FULL_ARCHIVE) {
    map.set(a.id, { series: a.series, category: a.category });
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
 */
export async function regeneratePublicState(
  env: AtlasEnv,
  events: LedgerEvent[],
): Promise<PublicAtlasState> {
  const records = projectAll(events);
  const meta = buildArtworkMeta();
  const stewards = await readStewards(env);
  const ring3ByKey = buildRing3ByKey(stewards);
  // ATLAS_PLACES = cities + country-level centroids, so "country only"
  // placements resolve to a glowing dot like any city.
  const state = toPublicState(records, meta, ATLAS_PLACES, ring3ByKey);
  const jsonBody = JSON.stringify(state, null, 2);
  await env.ATLAS_BUCKET.put(KEY_PUBLIC, jsonBody, {
    httpMetadata: { contentType: 'application/json' },
  });
  void mirrorPublicState(env, jsonBody).catch(() => undefined);
  return state;
}

// ---------- Steward lookup by Clerk identity ----------

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
