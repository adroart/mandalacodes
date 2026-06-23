/**
 * Pure, I/O-free logic for the PATIENT claim-escalation window (Decision B of
 * the Living Legacy plan).
 *
 * When a collector scans a piece that already has a living keeper, the request
 * does NOT take the piece. It opens a contested claim that the current holder
 * can answer at any time. Only one outcome ever frees the piece to the
 * requester: genuine, fully-warned SILENCE across the entire window. The design
 * is deliberately patient, and three rules are load-bearing:
 *
 *   1. A holder's "no" stops the claim cold, forever — regardless of elapsed
 *      time. A decline is permanent; the window cannot outlive it.
 *   2. ANY holder engagement keeps the piece blocked. Engagement is not the
 *      same as approval; a holder who is present but undecided still holds.
 *   3. Mere inactivity NEVER frees a piece. The piece frees only when every
 *      scheduled warning was actually DELIVERED and the full window elapsed
 *      with no response. Un-delivered warnings (e.g. a bounced email, a paused
 *      escalation) mean the holder was never truly given their chance, so the
 *      piece stays blocked no matter how much wall-clock has passed.
 *
 * Like utils/claimRequests.ts, everything here is deterministic — no fetch, no
 * env, no R2 — so the unit suite can pin the outcomes without mocking
 * Cloudflare. The escalation job (mandalacodes side) composes this around the
 * claim-request store and the warning-delivery counter.
 */
import type { ClaimRequest } from '../types';

// ---------- Constants (Decision B, ratified in the plan) ----------

/**
 * How long a contested claim stays open before unanswered silence can free the
 * piece. Patient, not fast: a full month gives a present-but-busy holder every
 * reasonable chance to notice and respond.
 */
export const CLAIM_WINDOW_DAYS = 30;

/**
 * The warning schedule, in days from the request's creation. Four touches over
 * the window (open / one week / three weeks / final) so the holder is warned
 * early, reminded, and given a clear last call. The piece can free only after
 * ALL of these have been delivered — the length of this array IS the required
 * delivered-warning count.
 */
export const CLAIM_WARNING_DAYS = [0, 7, 21, 30] as const;

// ---------- Outcome ----------

export type ClaimWindowStatus =
  /** Holder said no. Permanent; the piece is never freed by this request. */
  | 'declined'
  /** Holder is engaged (responded) — the piece stays with them. */
  | 'blocked-active'
  /** Still inside the window, or warnings not all delivered yet: hold. */
  | 'blocked-pending'
  /** Full window elapsed, every warning delivered, no response: frees. */
  | 'frees-to-requester';

export interface ClaimWindowResult {
  status: ClaimWindowStatus;
  /** Days from the request's creation to `nowIso` (0 if not yet, clamped ≥ 0). */
  elapsedDays: number;
  /** True once `elapsedDays >= CLAIM_WINDOW_DAYS`. */
  windowElapsed: boolean;
  /** How many scheduled warnings have actually been delivered. */
  warningsDelivered: number;
  /** Human sentence for an admin view (no em dashes). */
  message: string;
}

export interface EvaluateClaimWindowOptions {
  /** The contested claim request being evaluated. */
  request: Pick<ClaimRequest, 'createdAt' | 'status'>;
  /**
   * Has the current holder responded in ANY way (approve, decline, or a
   * neutral acknowledgement)? A decline is also reflected in request.status;
   * this flag additionally captures engagement that is not yet a decision.
   */
  holderResponded: boolean;
  /** Now, as an ISO date/timestamp. */
  nowIso: string;
  /**
   * How many of the scheduled warnings have actually been DELIVERED to the
   * holder. Defaults to 0 (nothing delivered) — fail-closed, so a piece never
   * frees by accident when the delivery counter is absent.
   */
  warningsSent?: number;
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  const ms = to - from;
  if (ms <= 0) return 0;
  return ms / (24 * 60 * 60 * 1000);
}

/**
 * Decide what a contested claim's silence has earned so far. Pure projection
 * over (request status, holder engagement, elapsed time, delivered warnings).
 * The escalation job calls this on a schedule; only 'frees-to-requester' ever
 * triggers the actual hand-off, and it is the narrowest possible outcome.
 *
 * Precedence (most-binding first):
 *   declined            → a permanent "no" wins over everything.
 *   holderResponded     → engagement holds the piece, regardless of the clock.
 *   window + warnings    → only full-window, fully-warned silence frees.
 *   otherwise            → still pending.
 */
export function evaluateClaimWindow(
  opts: EvaluateClaimWindowOptions,
): ClaimWindowResult {
  const { request, holderResponded, nowIso } = opts;
  const warningsDelivered = Math.max(0, opts.warningsSent ?? 0);
  const elapsed = daysBetween(request.createdAt, nowIso);
  const elapsedDays = Math.floor(elapsed);
  const windowElapsed = elapsed >= CLAIM_WINDOW_DAYS;

  const base = { elapsedDays, windowElapsed, warningsDelivered };

  // 1. A holder's "no" is permanent and outranks elapsed time.
  if (request.status === 'declined') {
    return {
      ...base,
      status: 'declined',
      message: 'The keeper declined this claim. The piece stays with them.',
    };
  }

  // 2. Any holder engagement keeps the piece. Present is not the same as gone.
  if (holderResponded) {
    return {
      ...base,
      status: 'blocked-active',
      message: 'The keeper is present and responding. The piece stays with them.',
    };
  }

  // 3. Only fully-warned silence across the FULL window can free the piece.
  const allWarningsDelivered = warningsDelivered >= CLAIM_WARNING_DAYS.length;
  if (windowElapsed && allWarningsDelivered) {
    return {
      ...base,
      status: 'frees-to-requester',
      message:
        'The window passed in full silence after every warning was sent. The piece may pass to the requester.',
    };
  }

  // 4. Otherwise: still pending. Distinguish the two reasons in the message so
  //    an admin can see whether to keep waiting or to keep sending warnings.
  const reason = !windowElapsed
    ? `${Math.max(0, CLAIM_WINDOW_DAYS - elapsedDays)} day(s) remain in the window.`
    : `The window has passed but only ${warningsDelivered} of ${CLAIM_WARNING_DAYS.length} warnings were delivered.`;
  return {
    ...base,
    status: 'blocked-pending',
    message: `The claim is still open and the piece stays blocked. ${reason}`,
  };
}
