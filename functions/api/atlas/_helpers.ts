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

import type { LedgerEvent, StewardRecord, PublicAtlasState } from '../../../types';
import { projectAll, toPublicState } from '../../../utils/ledgerProjection';
import { CITIES } from '../../../data/cities';
import { FULL_ARCHIVE } from '../../../data/mockData';
import { mirrorPublicState } from './_mirror';
import type { MirrorEnv } from './_mirror';
import type { AuthEnv } from '../_lib/clerk';

// ---------- R2 keys ----------

export const KEY_LEDGER = 'atlas/ledger.json';
export const KEY_STEWARDS = 'atlas/stewards.json';
export const KEY_PUBLIC = 'atlas/public.json';

// ---------- Env typing ----------

export interface AtlasEnv extends MirrorEnv, AuthEnv {
  ATLAS_BUCKET: R2Bucket;
}

// Minimal shape we need from R2 — avoids depending on @cloudflare/workers-types.
interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(
    key: string,
    value: string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
}
interface R2Object {
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

async function readJsonArray<T>(env: AtlasEnv, key: string): Promise<T[]> {
  const obj = await env.ATLAS_BUCKET.get(key);
  if (!obj) return [];
  try {
    const text = await obj.text();
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
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

async function writeJson(env: AtlasEnv, key: string, value: unknown): Promise<void> {
  await env.ATLAS_BUCKET.put(key, JSON.stringify(value, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
}

export async function readLedger(env: AtlasEnv): Promise<LedgerEvent[]> {
  return readJsonArray<LedgerEvent>(env, KEY_LEDGER);
}

export async function writeLedger(
  env: AtlasEnv,
  events: LedgerEvent[],
): Promise<void> {
  await writeJson(env, KEY_LEDGER, events);
}

export async function readStewards(env: AtlasEnv): Promise<StewardRecord[]> {
  return readJsonArray<StewardRecord>(env, KEY_STEWARDS);
}

export async function writeStewards(
  env: AtlasEnv,
  stewards: StewardRecord[],
): Promise<void> {
  await writeJson(env, KEY_STEWARDS, stewards);
}

export async function readPublicState(
  env: AtlasEnv,
): Promise<PublicAtlasState | null> {
  return readJsonObject<PublicAtlasState>(env, KEY_PUBLIC);
}

export async function writePublicState(
  env: AtlasEnv,
  state: PublicAtlasState,
): Promise<void> {
  await writeJson(env, KEY_PUBLIC, state);
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
 * Re-derive PublicAtlasState from a full ledger and persist it to R2.
 * Called after every successful ledger write so the GET cache stays fresh.
 * The GitHub mirror is a side-effect that never blocks the response.
 */
export async function regeneratePublicState(
  env: AtlasEnv,
  events: LedgerEvent[],
): Promise<PublicAtlasState> {
  const records = projectAll(events);
  const meta = buildArtworkMeta();
  const state = toPublicState(records, meta, CITIES);
  const jsonBody = JSON.stringify(state, null, 2);
  await env.ATLAS_BUCKET.put(KEY_PUBLIC, jsonBody, {
    httpMetadata: { contentType: 'application/json' },
  });
  void mirrorPublicState(env, jsonBody).catch(() => undefined);
  return state;
}

// ---------- Steward lookup by Clerk identity ----------

/**
 * Find a steward record matching either the Clerk user id (preferred) or
 * the email (fallback for first-time bind). Returns the *first* matching
 * record — a Clerk user can only steward one piece via this lookup, but
 * the `editionNumber` field still distinguishes editions of the same
 * piece if relevant.
 */
export function findStewardForUser(
  stewards: readonly StewardRecord[],
  userId: string,
  email: string | null,
): StewardRecord | null {
  const byUserId = stewards.find((s) => s.clerkUserId === userId);
  if (byUserId) return byUserId;
  if (!email) return null;
  const normalized = email.toLowerCase();
  return stewards.find((s) => (s.email || '').toLowerCase() === normalized) ?? null;
}

/**
 * Same as findStewardForUser but returns every match — useful when one
 * collector stewards multiple pieces.
 */
export function findStewardsForUser(
  stewards: readonly StewardRecord[],
  userId: string,
  email: string | null,
): StewardRecord[] {
  const byUserId = stewards.filter((s) => s.clerkUserId === userId);
  if (byUserId.length) return byUserId;
  if (!email) return [];
  const normalized = email.toLowerCase();
  return stewards.filter((s) => (s.email || '').toLowerCase() === normalized);
}
