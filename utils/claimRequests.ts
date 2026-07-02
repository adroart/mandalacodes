/**
 * Pure, I/O-free logic for self-serve claim requests (M4).
 *
 * A signed-in visitor asks to become a piece's steward; the request lands
 * in a queue (mutable R2 list, atlas/claimRequests.json) and a HUMAN
 * resolves it — the admin for unclaimed pieces, the current holder for
 * bound ones (anti-takeover: a request can never bind a piece by itself).
 *
 * Like utils/ledger.ts and utils/consent.ts, everything here is
 * deterministic — no fetch, no env, no R2 — so the unit suite can pin the
 * routing, dedupe, and rate-limit rules without mocking Cloudflare.
 */
import type { ClaimRequest, StewardRecord } from '../types';
import type { ParseResult } from './consent';

// ---------- Constants ----------

/** Longest evidence note we accept. */
export const CLAIM_REQUEST_NOTE_MAX = 500;

/** Naive rate limit: a requester may have at most this many OPEN (pending)
 *  requests across all pieces. */
export const MAX_OPEN_REQUESTS_PER_REQUESTER = 3;

// ---------- Input validation (whitelist discipline) ----------

export interface ClaimRequestInput {
  pieceId: string;
  editionNumber?: number;
  note?: string;
}

/**
 * Strictly validate a POST /steward/request-claim body. Exactly pieceId,
 * editionNumber, note are accepted; anything else is rejected — the server,
 * not the client, decides what a ClaimRequest contains (requesterRef /
 * requesterEmail / status / routedTo are all stamped server-side).
 */
export function parseClaimRequestInput(
  value: unknown,
): ParseResult<ClaimRequestInput> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'Body must be a JSON object' };
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (key !== 'pieceId' && key !== 'editionNumber' && key !== 'note') {
      return { ok: false, error: `Unknown field "${key}"` };
    }
  }
  const pieceId = typeof obj.pieceId === 'string' ? obj.pieceId.trim() : '';
  if (!pieceId) return { ok: false, error: 'Missing pieceId' };
  if (obj.editionNumber !== undefined) {
    if (
      typeof obj.editionNumber !== 'number' ||
      !Number.isInteger(obj.editionNumber) ||
      obj.editionNumber < 0
    ) {
      return { ok: false, error: 'editionNumber must be a non-negative integer' };
    }
  }
  let note: string | undefined;
  if (obj.note !== undefined) {
    if (typeof obj.note !== 'string') {
      return { ok: false, error: 'note must be a string' };
    }
    note = obj.note.trim() || undefined;
    if (note && note.length > CLAIM_REQUEST_NOTE_MAX) {
      return {
        ok: false,
        error: `note must be at most ${CLAIM_REQUEST_NOTE_MAX} characters`,
      };
    }
  }
  return {
    ok: true,
    value: {
      pieceId,
      ...(obj.editionNumber !== undefined
        ? { editionNumber: obj.editionNumber as number }
        : {}),
      ...(note !== undefined ? { note } : {}),
    },
  };
}

// ---------- Request creation (routing + dedupe + rate limit) ----------

export function genRequestId(): string {
  const rnd = crypto.getRandomValues(new Uint8Array(10));
  let hex = '';
  for (let i = 0; i < rnd.length; i++) hex += rnd[i].toString(16).padStart(2, '0');
  return `req-${Date.now().toString(36)}-${hex}`;
}

export interface PlanClaimRequestOptions {
  input: ClaimRequestInput;
  /** Opaque auth userId of the requester (from the verified token). */
  requesterRef: string;
  /** Requester's email from the verified JWT. */
  requesterEmail: string;
  /** The steward record for the requested piece, if one exists. */
  steward: StewardRecord | undefined;
  now: string;
  requestId?: string;
  /** Where this request originates. Defaults to 'user' — the ordinary
   *  self-serve path (request-claim.ts), whose own verified session backs
   *  both requesterRef and requesterEmail. The machine-authenticated
   *  claim-bridge (claim-bridge.ts) passes 'bridge' explicitly: neither ref
   *  there is verified by this server, only by Adrian-Website's
   *  HMAC-authenticated call. */
  source?: 'user' | 'bridge';
  /** Was requesterEmail proven by a verified session at request time?
   *  Defaults to true — the ordinary user path always carries a verified
   *  Better Auth JWT email. The bridge passes false explicitly: the email
   *  is a SERVER-asserted claim relayed from Adrian-Website, never
   *  independently verified here. Per the plan, asserted identity must
   *  never be presented as verified. */
  requesterEmailVerified?: boolean;
}

/**
 * Plan a new claim request against the CURRENT request list. Pure decision
 * logic — the handler runs this inside the concurrency-safe mutator so a
 * retry re-validates against fresh state. Enforces:
 *
 *   - Self-guard: the bound steward of a piece can't request it.
 *   - Routing (anti-takeover): a piece with a BOUND steward routes to
 *     'holder' — the current holder decides; the admin queue never silently
 *     re-homes a claimed piece. Unbound or missing records route to
 *     'admin'. A request NEVER binds anything by itself: the only outcomes
 *     are a pending row a human later resolves.
 *   - Dedupe: one open request per (requester, piece, edition).
 *   - Rate limit: at most MAX_OPEN_REQUESTS_PER_REQUESTER pending requests
 *     per requester REF, and the same cap again per requester EMAIL
 *     (lowercased). The email-keyed cap matters because the claim-bridge
 *     asserts requesterRef itself — nothing here has verified it — so a
 *     hostile sender could otherwise mint a fresh ref per call and blow
 *     past the ref-keyed cap while reusing one mailbox to spam holders.
 *   - Provenance: every planned request records `source` and
 *     `requesterEmailVerified` (see PlanClaimRequestOptions) so a holder
 *     resolving a bridge-asserted claim can see the email was never
 *     independently verified.
 */
export function planClaimRequest(
  requests: readonly ClaimRequest[],
  opts: PlanClaimRequestOptions,
): ParseResult<ClaimRequest> {
  const {
    input,
    requesterRef,
    requesterEmail,
    steward,
    now,
    source = 'user',
    requesterEmailVerified = true,
  } = opts;

  if (steward?.clerkUserId === requesterRef) {
    return { ok: false, error: 'You already steward this piece.' };
  }

  const openByRef = requests.filter(
    (r) => r.status === 'pending' && r.requesterRef === requesterRef,
  );
  const duplicate = openByRef.find(
    (r) =>
      r.pieceId === input.pieceId &&
      (r.editionNumber ?? undefined) === (input.editionNumber ?? undefined),
  );
  if (duplicate) {
    return {
      ok: false,
      error: 'You already have an open request for this piece.',
    };
  }
  if (openByRef.length >= MAX_OPEN_REQUESTS_PER_REQUESTER) {
    return {
      ok: false,
      error: `You can have at most ${MAX_OPEN_REQUESTS_PER_REQUESTER} open requests.`,
    };
  }

  // Bridge abuse cap (see doc comment above): cap by EMAIL too, the one
  // identity constant across a spray of forged requesterRefs.
  const normalizedEmail = requesterEmail.trim().toLowerCase();
  const openByEmail = requests.filter(
    (r) =>
      r.status === 'pending' &&
      r.requesterEmail.trim().toLowerCase() === normalizedEmail,
  );
  if (openByEmail.length >= MAX_OPEN_REQUESTS_PER_REQUESTER) {
    return {
      ok: false,
      error: `You can have at most ${MAX_OPEN_REQUESTS_PER_REQUESTER} open requests.`,
    };
  }

  const routedTo: ClaimRequest['routedTo'] = steward?.clerkUserId
    ? 'holder'
    : 'admin';

  return {
    ok: true,
    value: {
      id: opts.requestId ?? genRequestId(),
      pieceId: input.pieceId,
      ...(input.editionNumber !== undefined
        ? { editionNumber: input.editionNumber }
        : {}),
      requesterRef,
      requesterEmail,
      requesterEmailVerified,
      source,
      ...(input.note !== undefined ? { note: input.note } : {}),
      createdAt: now,
      status: 'pending',
      routedTo,
    },
  };
}

// ---------- Resolution ----------

/** Stamp a pending request resolved. Pure — callers persist the result. */
export function resolveRequest(
  request: ClaimRequest,
  approve: boolean,
  resolvedBy: string,
  now: string,
): ClaimRequest {
  return {
    ...request,
    status: approve ? 'approved' : 'declined',
    resolvedAt: now,
    resolvedBy,
  };
}

/**
 * What a HOLDER may see of a request routed to them: the evidence note and
 * the requester's email (they must be able to recognize "yes, that's the
 * person I sold it to") — but never the opaque requesterRef or another
 * requester's records. The admin queue sees full records instead.
 *
 * `requesterEmailVerified` and `source` ride along so the holder UI can
 * label a machine-asserted email distinctly from an ordinary self-serve
 * request — per the plan, asserted identity must never be presented as
 * verified.
 */
export interface HolderRequestView {
  id: string;
  pieceId: string;
  editionNumber?: number;
  requesterEmail: string;
  /** False when the email came from the machine-authenticated claim-bridge
   *  (never independently verified by this server). Absent on legacy rows
   *  reads as true. */
  requesterEmailVerified?: boolean;
  /** 'bridge' = claim-bridge.ts (machine auth); absent reads as 'user'. */
  source?: 'user' | 'bridge';
  note?: string;
  createdAt: string;
}

export function toHolderRequestView(request: ClaimRequest): HolderRequestView {
  return {
    id: request.id,
    pieceId: request.pieceId,
    ...(request.editionNumber !== undefined
      ? { editionNumber: request.editionNumber }
      : {}),
    requesterEmail: request.requesterEmail,
    ...(request.requesterEmailVerified !== undefined
      ? { requesterEmailVerified: request.requesterEmailVerified }
      : {}),
    ...(request.source !== undefined ? { source: request.source } : {}),
    ...(request.note !== undefined ? { note: request.note } : {}),
    createdAt: request.createdAt,
  };
}
