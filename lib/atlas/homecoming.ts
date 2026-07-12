/**
 * The Homecoming (Phase 2.5), shared types and pure request-shaping logic
 * for the path a past collector takes when the atlas has NO record of their
 * piece at all: no chain, no steward record, nothing to match.
 *
 * A homecoming request is NOT a claim request. A claim request
 * (utils/claimRequests.ts) needs a pieceId that already exists in the ledger;
 * the collector is asking to be bound to a KNOWN piece. A homecoming request
 * carries no pieceId, the piece is unknown to the system. Adrian recognizes
 * his own work from the photos and story, then mints the piece into being and
 * binds the collector in one admin step (see functions/api/atlas/homecoming/).
 *
 * Records live in mutable R2 (atlas/homecomingRequests.json) ONLY. Photos and
 * story are private admin context, they never enter a hashed ledger payload,
 * the public projection, or the GitHub mirror. Everything is stamped
 * server-side.
 *
 * This module holds only the pure, storage-free shaping logic so it can be
 * unit-tested without R2; the Function endpoints wrap it with auth, city
 * validation, and the concurrency-safe writer.
 */

export const HOMECOMING_MAX_PHOTOS = 3;
export const HOMECOMING_MAX_PROVENANCE = 1000;
export const HOMECOMING_MAX_NOTE = 500;
/** A human-scale ceiling: nobody legitimately holds a dozen unknown pieces at
 *  once, and this bounds a runaway client without a heavier rate limiter. */
export const HOMECOMING_MAX_OPEN_PER_REQUESTER = 5;

export type HomecomingStatus = 'pending' | 'bound' | 'declined';

export interface HomecomingRequest {
  id: string;
  /** Opaque auth userId of the collector who brought the piece home. */
  requesterRef: string;
  /** Collector's email from their verified session, the address the bound
   *  steward record is seeded with on recognition. Mutable storage only. */
  requesterEmail: string;
  /** 1..3 links to photos of the piece. The repo has no binary upload path,
   *  so these are URLs the collector pastes (see the return notes for the
   *  build); admin-only, never public. */
  photoUrls: string[];
  /** Roughly when and where the piece came to them, free text, admin-only. */
  provenance: string;
  /** The city where the piece rests now (a cities.ts id). */
  cityId: string;
  /** Anything else the collector wants Adrian to see. Optional, admin-only. */
  note?: string;
  /** Server-stamped ISO timestamp. */
  createdAt: string;
  status: HomecomingStatus;
  /** Stamped on resolution. resolvedBy is an opaque admin auth userId. */
  resolvedAt?: string;
  resolvedBy?: string;
  /** Set when Adrian recognizes and binds: the piece id he minted for it. */
  boundPieceId?: string;
  boundEditionNumber?: number;
  /** The title Adrian gave the recognized piece, for the admin record. */
  boundTitle?: string;
}

export interface HomecomingInput {
  photoUrls: string[];
  provenance: string;
  cityId: string;
  note?: string;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\/\S+$/i.test(value.trim());
}

/**
 * Validate and normalize the client body of a homecoming submission. Pure:
 * city EXISTENCE is validated by the endpoint (it needs the cities table);
 * here we only enforce shape, presence, and length so the logic is testable
 * without any data import.
 */
export function parseHomecomingInput(body: unknown): Parsed<HomecomingInput> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Invalid submission' };
  }
  const obj = body as Record<string, unknown>;

  const rawPhotos = obj.photoUrls;
  if (!Array.isArray(rawPhotos)) {
    return { ok: false, error: 'Add at least one photo link of the piece' };
  }
  const photoUrls = rawPhotos
    .filter((u) => typeof u === 'string' && u.trim().length > 0)
    .map((u) => (u as string).trim());
  if (photoUrls.length === 0) {
    return { ok: false, error: 'Add at least one photo link of the piece' };
  }
  if (photoUrls.length > HOMECOMING_MAX_PHOTOS) {
    return { ok: false, error: `Up to ${HOMECOMING_MAX_PHOTOS} photo links` };
  }
  if (!photoUrls.every(isHttpUrl)) {
    return { ok: false, error: 'Each photo must be a link beginning with http' };
  }

  const provenance =
    typeof obj.provenance === 'string' ? obj.provenance.trim() : '';
  if (!provenance) {
    return { ok: false, error: 'Tell me roughly when and where it came to you' };
  }
  if (provenance.length > HOMECOMING_MAX_PROVENANCE) {
    return { ok: false, error: 'That is longer than this field can hold' };
  }

  const cityId = typeof obj.cityId === 'string' ? obj.cityId.trim() : '';
  if (!cityId) {
    return { ok: false, error: 'Choose the city where it rests now' };
  }

  let note: string | undefined;
  if (obj.note !== undefined) {
    if (typeof obj.note !== 'string') {
      return { ok: false, error: 'Invalid note' };
    }
    const trimmed = obj.note.trim();
    if (trimmed.length > HOMECOMING_MAX_NOTE) {
      return { ok: false, error: 'That note is longer than this field can hold' };
    }
    if (trimmed) note = trimmed;
  }

  return {
    ok: true,
    value: { photoUrls, provenance, cityId, ...(note ? { note } : {}) },
  };
}

export interface PlanHomecomingArgs {
  input: HomecomingInput;
  requesterRef: string;
  requesterEmail: string;
  id: string;
  now: string;
}

/**
 * Build the pending request record, re-validating the per-requester open-count
 * ceiling against the freshest list (call this INSIDE the concurrency-safe
 * mutator so a retry re-applies the guard). Returns the new record to append,
 * or an error if the requester already has too many open.
 */
export function planHomecomingRequest(
  existing: readonly HomecomingRequest[],
  args: PlanHomecomingArgs,
): Parsed<HomecomingRequest> {
  const openForRequester = existing.filter(
    (r) => r.requesterRef === args.requesterRef && r.status === 'pending',
  ).length;
  if (openForRequester >= HOMECOMING_MAX_OPEN_PER_REQUESTER) {
    return {
      ok: false,
      error: `You can have at most ${HOMECOMING_MAX_OPEN_PER_REQUESTER} pieces waiting to be recognized at once`,
    };
  }

  const record: HomecomingRequest = {
    id: args.id,
    requesterRef: args.requesterRef,
    requesterEmail: args.requesterEmail,
    photoUrls: args.input.photoUrls,
    provenance: args.input.provenance,
    cityId: args.input.cityId,
    ...(args.input.note ? { note: args.input.note } : {}),
    createdAt: args.now,
    status: 'pending',
  };
  return { ok: true, value: record };
}
