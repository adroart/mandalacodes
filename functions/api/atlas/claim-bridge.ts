/**
 * POST /api/atlas/claim-bridge; the CONTESTED-claim handoff from
 * adrianrasmussen.com (M4 Living Legacy).
 *
 * Machine auth, no user session. adrianrasmussen.com is the front door a
 * collector scans; when their keeper bind hits a piece that already has a
 * living keeper, Adrian-Website validates the requester's session on its
 * side, then calls THIS endpoint so the contested claim lands in the ONE
 * claim-request store (R2 atlas/claimRequests.json) and the existing routing,
 * dedupe, rate-limit, and patient escalation (utils/claimWindow.ts + the
 * steward resolve endpoints) Just Work. No claim machinery is duplicated on
 * the Adrian side; this is the single source of truth.
 *
 * Why a machine endpoint and not the user-facing request-claim: the Better
 * Auth session cookie is per-domain and cannot be forwarded from
 * adrianrasmussen.com. So the requester's identity arrives as a SERVER claim
 * in the signed body (requesterRef + requesterEmail), trusted only because the
 * call is HMAC-authenticated as coming from Adrian-Website's server. Auth is
 * the proven M4 sale-webhook recipe, reused verbatim (computeSaleSignature /
 * timingSafeEqualHex / isTimestampFresh from utils/saleBridge):
 *   X-Claim-Timestamp: unix seconds
 *   X-Claim-Signature: hex(HMAC-SHA256(CLAIM_BRIDGE_SECRET, ts + "." + rawBody))
 * with a ±5-minute replay window and a constant-time comparison. Any auth
 * failure answers a detail-free 401; no oracle for an attacker probing the
 * secret.
 *
 * Anti-takeover, unchanged: planClaimRequest routes a bound piece to the
 * 'holder' (never the admin queue) and a request NEVER binds anything by
 * itself. The only outcome here is a pending row a human later resolves.
 *
 * Privacy invariant (law): nothing here enters a ledger hash. requesterEmail
 * and note live ONLY in the mutable request record. The bridge carries no
 * recovery code, no name, no birth data.
 *
 * Degrades with 503 until CLAIM_BRIDGE_SECRET is provisioned (a dedicated
 * secret, set on BOTH Pages projects, distinct from SALE_WEBHOOK_SECRET).
 */

import {
  CLAIM_REQUEST_NOTE_MAX,
  planClaimRequest,
} from '../../../utils/claimRequests';
import type { ClaimRequestInput } from '../../../utils/claimRequests';
import type { ClaimRequest } from '../../../types';
import {
  computeSaleSignature,
  isTimestampFresh,
  timingSafeEqualHex,
} from '../../../utils/saleBridge';
import type { AtlasEnv, PagesContext } from './_helpers';
import { json, mutateClaimRequests, readStewards } from './_helpers';

interface BridgeEnv {
  /** Dedicated shared secret for the contested-claim bridge. 32+ random
   *  bytes, set on BOTH Pages projects. Distinct from SALE_WEBHOOK_SECRET. */
  CLAIM_BRIDGE_SECRET?: string;
}

interface BridgeInput {
  input: ClaimRequestInput;
  requesterRef: string;
  requesterEmail: string;
}

/** What the mutator hands back: the outcome word, plus the created request on
 *  a fresh open. 'duplicate' / 'rate_limited' / 'self' are honest non-binding
 *  no-ops, reported with 200 so the bridge never reads as a failure. */
interface BridgeResult {
  status: 'opened' | 'duplicate' | 'rate_limited' | 'self';
  request?: ClaimRequest;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Strictly validate the verified bridge body. Exactly these fields are
 * accepted; anything else is rejected; the receiver, not the sender, decides
 * what a ClaimRequest contains. Signature verification runs BEFORE this, so
 * validation errors may carry detail.
 */
function parseBridgeBody(value: unknown): { ok: true; value: BridgeInput } | { ok: false; error: string } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'Body must be a JSON object' };
  }
  const obj = value as Record<string, unknown>;
  const KNOWN = ['pieceId', 'editionNumber', 'requesterRef', 'requesterEmail', 'note'];
  for (const key of Object.keys(obj)) {
    if (!KNOWN.includes(key)) return { ok: false, error: `Unknown field "${key}"` };
  }

  const pieceId = typeof obj.pieceId === 'string' ? obj.pieceId.trim() : '';
  if (!pieceId) return { ok: false, error: 'Missing pieceId' };

  let editionNumber: number | undefined;
  if (obj.editionNumber !== undefined) {
    if (
      typeof obj.editionNumber !== 'number' ||
      !Number.isInteger(obj.editionNumber) ||
      obj.editionNumber < 0
    ) {
      return { ok: false, error: 'editionNumber must be a non-negative integer' };
    }
    editionNumber = obj.editionNumber;
  }

  const requesterRef = typeof obj.requesterRef === 'string' ? obj.requesterRef.trim() : '';
  if (!requesterRef) return { ok: false, error: 'Missing requesterRef' };

  const requesterEmail = typeof obj.requesterEmail === 'string' ? obj.requesterEmail.trim() : '';
  if (!requesterEmail || !EMAIL_RE.test(requesterEmail)) {
    return { ok: false, error: 'requesterEmail is required and must be an email' };
  }

  let note: string | undefined;
  if (obj.note !== undefined) {
    if (typeof obj.note !== 'string') return { ok: false, error: 'note must be a string' };
    note = obj.note.trim() || undefined;
    if (note && note.length > CLAIM_REQUEST_NOTE_MAX) {
      return { ok: false, error: `note must be at most ${CLAIM_REQUEST_NOTE_MAX} characters` };
    }
  }

  return {
    ok: true,
    value: {
      input: {
        pieceId,
        ...(editionNumber !== undefined ? { editionNumber } : {}),
        ...(note !== undefined ? { note } : {}),
      },
      requesterRef,
      requesterEmail,
    },
  };
}

export async function onRequestPost(
  context: PagesContext<AtlasEnv & BridgeEnv>,
): Promise<Response> {
  const { request, env } = context;

  const secret = env.CLAIM_BRIDGE_SECRET;
  if (!secret) {
    return json(
      { ok: false, error: 'Claim bridge not configured (CLAIM_BRIDGE_SECRET missing)' },
      503,
    );
  }

  // The signature covers the RAW body; read it before any parsing.
  const rawBody = await request.text();
  const timestamp = request.headers.get('X-Claim-Timestamp');
  const signature = request.headers.get('X-Claim-Signature');
  if (!timestamp || !signature || !isTimestampFresh(timestamp, Date.now())) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }
  const expected = await computeSaleSignature(secret, timestamp, rawBody);
  if (!timingSafeEqualHex(expected, signature.toLowerCase())) {
    // Deliberately detail-free: stale timestamp, bad signature, and wrong
    // secret are indistinguishable to the caller.
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, error: 'Invalid JSON' }, 400);
  }
  // `=== false` (not `!parsed.ok`): the repo compiles without strictNullChecks,
  // where a truthiness check does not narrow a discriminated union (same reason
  // utils/saleBridge.ts spells its checks this way).
  const parsed = parseBridgeBody(parsedBody);
  if (parsed.ok === false) return json({ ok: false, error: parsed.error }, 400);
  const { input, requesterRef, requesterEmail } = parsed.value;

  // Routing looks at the piece's CURRENT steward record; a bound piece routes
  // to its holder (anti-takeover); unbound or unknown routes to admin.
  const stewards = await readStewards(env);
  const steward = stewards.find(
    (s) =>
      s.pieceId === input.pieceId &&
      (s.editionNumber ?? undefined) === (input.editionNumber ?? undefined),
  );

  const now = new Date().toISOString();
  const outcome = await mutateClaimRequests<BridgeResult>(env, (requests) => {
    const plan = planClaimRequest(requests, {
      input,
      requesterRef,
      requesterEmail,
      steward,
      now,
    });
    if (plan.ok === false) {
      // Dedupe and rate-limit are not failures of the bridge: the requester is
      // already in the queue (or has too many open requests). Answer 200 with a
      // friendly status so Adrian-Website never tells the requester they were
      // refused when their claim is, in fact, pending.
      const status: BridgeResult['status'] = plan.error.includes('at most')
        ? 'rate_limited'
        : plan.error.includes('already steward')
          ? 'self'
          : 'duplicate';
      return { next: [...requests], result: { status } };
    }
    return { next: [...requests, plan.value], result: { status: 'opened', request: plan.value } };
  });
  if (outcome instanceof Response) return outcome;

  return json({ ok: true, ...outcome.result });
}
