/**
 * Pure, I/O-free logic for the sale → ledger bridge (M4).
 *
 * Like utils/ledger.ts and utils/consent.ts, everything here is
 * deterministic and isomorphic — no fetch, no env, no R2, no D1 — so the
 * unit suite can pin the rules without mocking Cloudflare. The HTTP
 * handlers in functions/api/atlas/* compose these around the D1 binding
 * and the concurrency-safe R2 mutators.
 *
 * Invariants enforced here (the chain content invariant is law):
 *   - Sale payloads (buyerEmail, buyerName, priceCents) live ONLY in the
 *     mutable D1 atlas_sale_events table. The draft builders below produce
 *     chain events from FIXED field sets that can never carry a buyer's
 *     email, name, or price.
 *   - Webhook auth is HMAC-SHA256 over `timestamp + "." + rawBody` with a
 *     dedicated SALE_WEBHOOK_SECRET, a ±5-minute replay window, and a
 *     constant-time signature comparison. A forged webhook can at worst
 *     enqueue a pending row — confirmation is always an explicit admin
 *     action (ratified: no auto-fire; a forged webhook must never grant
 *     ownership).
 */
import type { LedgerEvent } from '../types';
import type { ParseResult } from './consent';

// ---------- Webhook signature (HMAC-SHA256, replay-windowed) ----------

/** Replay window: reject requests whose timestamp is more than ±5 minutes
 *  from the server clock. */
export const SALE_TIMESTAMP_WINDOW_MS = 5 * 60_000;

/**
 * hex(HMAC-SHA256(secret, `${timestamp}.${rawBody}`)) — the exact value
 * Adrian-Website must send in X-Sale-Signature (see
 * todo/handoff/adrian-website/sale-webhook-spec.md for the worked example).
 */
export async function computeSaleSignature(
  secret: string,
  timestamp: string,
  rawBody: string,
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${rawBody}`));
  const bytes = new Uint8Array(sig);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

/**
 * Constant-time string comparison: every character is XOR-folded so the
 * comparison time never depends on WHERE two signatures diverge. A length
 * mismatch returns early — the expected signature's length (64 hex chars)
 * is public knowledge, not a secret.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Is the X-Sale-Timestamp (unix SECONDS, digits only) within the replay
 *  window of `nowMs`? Malformed values are simply stale. */
export function isTimestampFresh(timestamp: string, nowMs: number): boolean {
  if (!/^\d{1,12}$/.test(timestamp)) return false;
  const tsMs = Number(timestamp) * 1000;
  return Math.abs(nowMs - tsMs) <= SALE_TIMESTAMP_WINDOW_MS;
}

/**
 * Full webhook verification: timestamp freshness + signature match.
 * Returns a bare boolean — the handler answers 401 with NO detail about
 * which check failed (no oracle for an attacker probing the secret).
 */
export async function verifySaleWebhook(
  secret: string,
  timestamp: string | null,
  signature: string | null,
  rawBody: string,
  nowMs: number,
): Promise<boolean> {
  if (!timestamp || !signature) return false;
  if (!isTimestampFresh(timestamp, nowMs)) return false;
  const expected = await computeSaleSignature(secret, timestamp, rawBody);
  return timingSafeEqualHex(expected, signature.toLowerCase());
}

// ---------- Payload validation (whitelist discipline) ----------

export interface SalePayload {
  saleId: string;
  sku?: string;
  pieceId?: string;
  editionNumber?: number;
  buyerEmail: string;
  buyerName?: string;
  saleDate: string;
  priceCents?: number;
  currency?: string;
}

const SALE_STRING_MAX = 300;

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/.test(value)) {
    return false;
  }
  return !Number.isNaN(Date.parse(value));
}

function optionalString(
  obj: Record<string, unknown>,
  key: string,
): ParseResult<string | undefined> {
  const v = obj[key];
  if (v === undefined) return { ok: true, value: undefined };
  if (typeof v !== 'string') return { ok: false, error: `${key} must be a string` };
  const trimmed = v.trim();
  if (trimmed.length > SALE_STRING_MAX) {
    return { ok: false, error: `${key} must be at most ${SALE_STRING_MAX} characters` };
  }
  return { ok: true, value: trimmed || undefined };
}

/**
 * Strictly validate a verified webhook payload. Exactly the documented
 * fields are accepted; anything else is rejected — the server, not the
 * sender, decides what reaches D1. Signature verification runs BEFORE this,
 * so validation errors may carry detail.
 */
export function parseSalePayload(value: unknown): ParseResult<SalePayload> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'payload must be a JSON object' };
  }
  const obj = value as Record<string, unknown>;
  const KNOWN = [
    'saleId', 'sku', 'pieceId', 'editionNumber',
    'buyerEmail', 'buyerName', 'saleDate', 'priceCents', 'currency',
  ];
  for (const key of Object.keys(obj)) {
    if (!KNOWN.includes(key)) {
      return { ok: false, error: `unknown field "${key}"` };
    }
  }

  const saleId = typeof obj.saleId === 'string' ? obj.saleId.trim() : '';
  if (!saleId) return { ok: false, error: 'saleId is required' };
  if (saleId.length > SALE_STRING_MAX) {
    return { ok: false, error: `saleId must be at most ${SALE_STRING_MAX} characters` };
  }

  const buyerEmail =
    typeof obj.buyerEmail === 'string' ? obj.buyerEmail.trim() : '';
  if (!buyerEmail || !isValidEmail(buyerEmail)) {
    return { ok: false, error: 'buyerEmail is required and must be an email' };
  }

  if (typeof obj.saleDate !== 'string' || !isIsoDate(obj.saleDate)) {
    return { ok: false, error: 'saleDate is required and must be an ISO date' };
  }

  if (obj.editionNumber !== undefined) {
    if (
      typeof obj.editionNumber !== 'number' ||
      !Number.isInteger(obj.editionNumber) ||
      obj.editionNumber < 0
    ) {
      return { ok: false, error: 'editionNumber must be a non-negative integer' };
    }
  }

  if (obj.priceCents !== undefined) {
    if (
      typeof obj.priceCents !== 'number' ||
      !Number.isSafeInteger(obj.priceCents) ||
      obj.priceCents < 0
    ) {
      return { ok: false, error: 'priceCents must be a non-negative integer' };
    }
  }

  if (obj.currency !== undefined) {
    if (typeof obj.currency !== 'string' || !/^[A-Za-z]{3}$/.test(obj.currency)) {
      return { ok: false, error: 'currency must be a 3-letter code' };
    }
  }

  // `=== false` (not `!x.ok`): the repo compiles without strictNullChecks,
  // where truthiness checks don't narrow discriminated unions.
  const sku = optionalString(obj, 'sku');
  if (sku.ok === false) return sku;
  const pieceId = optionalString(obj, 'pieceId');
  if (pieceId.ok === false) return pieceId;
  const buyerName = optionalString(obj, 'buyerName');
  if (buyerName.ok === false) return buyerName;

  return {
    ok: true,
    value: {
      saleId,
      ...(sku.value !== undefined ? { sku: sku.value } : {}),
      ...(pieceId.value !== undefined ? { pieceId: pieceId.value } : {}),
      ...(obj.editionNumber !== undefined
        ? { editionNumber: obj.editionNumber as number }
        : {}),
      buyerEmail,
      ...(buyerName.value !== undefined ? { buyerName: buyerName.value } : {}),
      saleDate: obj.saleDate,
      ...(obj.priceCents !== undefined ? { priceCents: obj.priceCents as number } : {}),
      ...(obj.currency !== undefined
        ? { currency: (obj.currency as string).toUpperCase() }
        : {}),
    },
  };
}

// ---------- Chain event drafting (fixed field sets) ----------

function genEventIdLocal(): string {
  const rnd = crypto.getRandomValues(new Uint8Array(10));
  let hex = '';
  for (let i = 0; i < rnd.length; i++) hex += rnd[i].toString(16).padStart(2, '0');
  return `evt-${Date.now().toString(36)}-${hex}`;
}

export interface TransferredDraftOptions {
  pieceId: string;
  editionNumber?: number;
  /** 'admin' for sale-queue confirmations / admin adjudications; 'steward'
   *  when the current holder approves a claim request themselves. */
  actor: 'admin' | 'steward';
  /** Opaque Clerk userId of whoever performs the transfer. */
  actorRef: string;
  /** Opaque ref of the OUTGOING steward (their bound Clerk userId). */
  fromRef: string;
  /**
   * Opaque ref of the INCOMING steward. When the buyer already has a Clerk
   * account (claim-request approval) this is their userId. For a confirmed
   * sale whose buyer hasn't signed in yet, callers pass
   * `pendingTransferRef(saleId)` — see that function's doc for why the
   * chain never carries an empty or personal ref.
   */
  toRef: string;
  transferKind: 'sale' | 'gift' | 'inheritance' | 'artist-rebind';
  /** ISO now. */
  now: string;
  eventId?: string;
}

/**
 * Build the `transferred` event draft. NOTHING else may ride along — the
 * field set is exactly: id, pieceId, editionNumber?, type, date, actor,
 * actorRef, fromRef, toRef, transferKind. The buyer's email/name and the
 * sale price live exclusively in mutable storage (steward record + D1
 * atlas_sale_events) and never enter the hashed payload.
 */
export function buildTransferredDraft(
  opts: TransferredDraftOptions,
): Omit<LedgerEvent, 'hash' | 'prevHash'> {
  return {
    id: opts.eventId ?? genEventIdLocal(),
    pieceId: opts.pieceId,
    ...(opts.editionNumber !== undefined
      ? { editionNumber: opts.editionNumber }
      : {}),
    type: 'transferred',
    date: opts.now,
    actor: opts.actor,
    actorRef: opts.actorRef,
    fromRef: opts.fromRef,
    toRef: opts.toRef,
    transferKind: opts.transferKind,
  };
}

/**
 * The chain's opaque ref for a buyer who hasn't claimed yet.
 *
 * What fromRef/toRef mean pre-claim: the chain is immutable, but per
 * settled decision #2 the chain only ever carries OPAQUE refs — a mutable
 * registry (the steward record) maps refs to live identities. When a sale
 * is confirmed before the buyer's first sign-in there is no Clerk userId to
 * point at, so the transfer's toRef is this deterministic, non-personal
 * sale reference instead. It permanently records WHICH sale moved the
 * piece (dispute evidence lives in atlas_sale_events under the same id)
 * without naming anyone; when the buyer later claims, the steward record —
 * not the chain — binds their identity. An empty toRef would break the
 * `transferred` field contract; an email would break the chain content
 * invariant. saleIds are machine identifiers (e.g. checkout session ids),
 * never personal data.
 */
export function pendingTransferRef(saleId: string): string {
  return `sale:${saleId}`;
}

export interface GenesisDraftOptions {
  pieceId: string;
  editionNumber?: number;
  /** Opaque Clerk userId of the confirming admin. */
  actorRef: string;
  pieceType?: 'mandala' | 'other';
  /** ISO now — the genesis records when the LEDGER learned of the piece,
   *  not the sale date (saleDate stays in D1; backdating would also trip
   *  the chain-order guard for any later events). */
  now: string;
  eventId?: string;
}

/**
 * Build the genesis `created` draft for a first sale of a piece with no
 * chain yet. Fixed field set: id, pieceId, editionNumber?, type, date,
 * actor 'admin', actorRef, pieceType?. Nothing from the sale payload —
 * buyer and price never touch the chain.
 */
export function buildSaleGenesisDraft(
  opts: GenesisDraftOptions,
): Omit<LedgerEvent, 'hash' | 'prevHash'> {
  return {
    id: opts.eventId ?? genEventIdLocal(),
    pieceId: opts.pieceId,
    ...(opts.editionNumber !== undefined
      ? { editionNumber: opts.editionNumber }
      : {}),
    type: 'created',
    date: opts.now,
    actor: 'admin',
    actorRef: opts.actorRef,
    ...(opts.pieceType ? { pieceType: opts.pieceType } : {}),
  };
}

// ---------- D1 row shape ----------

/** atlas_sale_events row as D1 returns it (snake_case). */
export interface SaleEventRow {
  sale_id: string;
  sku: string | null;
  piece_id: string | null;
  edition_number: number | null;
  buyer_email: string;
  buyer_name: string | null;
  sale_date: string;
  price_cents: number | null;
  currency: string | null;
  status: 'pending' | 'confirmed' | 'dismissed';
  received_at: number;
  confirmed_at: number | null;
  dismissed_reason: string | null;
  raw_json: string | null;
}

/** Admin-queue view of a sale row (camelCase; raw_json withheld — it's
 *  dispute evidence, not dashboard data). Admin-only surface. */
export interface SaleQueueItem {
  saleId: string;
  sku?: string;
  pieceId?: string;
  editionNumber?: number;
  buyerEmail: string;
  buyerName?: string;
  saleDate: string;
  priceCents?: number;
  currency?: string;
  status: 'pending' | 'confirmed' | 'dismissed';
  receivedAt: number;
  confirmedAt?: number;
  dismissedReason?: string;
}

export function toSaleQueueItem(row: SaleEventRow): SaleQueueItem {
  return {
    saleId: row.sale_id,
    ...(row.sku !== null ? { sku: row.sku } : {}),
    ...(row.piece_id !== null ? { pieceId: row.piece_id } : {}),
    ...(row.edition_number !== null ? { editionNumber: row.edition_number } : {}),
    buyerEmail: row.buyer_email,
    ...(row.buyer_name !== null ? { buyerName: row.buyer_name } : {}),
    saleDate: row.sale_date,
    ...(row.price_cents !== null ? { priceCents: row.price_cents } : {}),
    ...(row.currency !== null ? { currency: row.currency } : {}),
    status: row.status,
    receivedAt: row.received_at,
    ...(row.confirmed_at !== null ? { confirmedAt: row.confirmed_at } : {}),
    ...(row.dismissed_reason !== null && row.dismissed_reason !== undefined
      ? { dismissedReason: row.dismissed_reason }
      : {}),
  };
}
