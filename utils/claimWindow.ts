/**
 * Pure, I/O-free logic for the Living Legacy "claim-block window" (M4).
 *
 * The missing piece of claim-safety: a claim request against an ACTIVE
 * keeper's piece must NOT free the piece on inactivity. It opens a long
 * block window (30 days) during which the current keeper is warned four
 * times. Only true unanswered silence across the FULL window — every
 * warning fired, zero response — frees the piece to the requester (the
 * orphaned path: deceased keeper, thrift-store rescue). A single "no" from
 * the keeper, at any point, stops the claim cold. Mere inactivity never
 * frees anything: a claim must exist and run its full warning sequence
 * first.
 *
 * Like utils/claimRequests.ts, utils/ledger.ts, and utils/letters.ts,
 * everything here is deterministic — no fetch, no env, no R2, no Date.now()
 * (the caller threads `nowIso` in) — so the unit suite can pin every
 * boundary without mocking Cloudflare or the clock.
 *
 * This module decides STATE only. It never writes a chain event: when the
 * window resolves to a transfer, the caller drives the EXISTING `transferred`
 * event path (see functions/api/atlas/_transfer.ts / claim-requests/resolve).
 * It operates on opaque refs + ISO dates exclusively — no PII ever reaches
 * this logic, in keeping with the chain content invariant.
 */
import type { ClaimRequest, StewardRecord } from '../types';

// ---------- Constants (ratified policy) ----------

/** Length of the claim-block window for an ACTIVE keeper's piece, in days.
 *  Only after this many days with zero keeper response across every warning
 *  does the piece become claimable by the requester. */
export const CLAIM_WINDOW_DAYS = 30;

/**
 * The four warning offsets (whole days after the request's createdAt) at
 * which the current keeper is alerted: at open, one week in, three weeks in,
 * and at the window's close. The final warning coincides with the window
 * boundary — the keeper's last chance before the piece frees. Ascending,
 * with the last element equal to CLAIM_WINDOW_DAYS by construction.
 */
export const CLAIM_WARNING_DAYS: readonly number[] = [0, 7, 21, 30];

/** Milliseconds in one day — for whole-day elapsed math. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ---------- Elapsed-day math (pure) ----------

/**
 * Whole days elapsed from an ISO instant to another (createdAt → now),
 * floored. Returns 0 when `now` precedes `from` or when either timestamp is
 * unparseable — a malformed date can never advance the window. Pure date
 * math; the caller threads both instants in.
 */
export function daysElapsed(fromIso: string, nowIso: string): number {
  const from = new Date(fromIso);
  const now = new Date(nowIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(now.getTime())) return 0;
  const diff = now.getTime() - from.getTime();
  if (diff <= 0) return 0;
  return Math.floor(diff / MS_PER_DAY);
}

/**
 * Which warnings are DUE as of `nowIso` for a request opened at `createdAt`:
 * the ordinals (1-based, matching CLAIM_WARNING_DAYS order) of every warning
 * whose offset day has been reached. A caller diffs this against the
 * warnings it has already sent to find the ones still to fire — the function
 * itself is stateless, so it reports all that are due, idempotently.
 *
 * Example: at day 8 of a request, returns [1, 2] (day-0 and day-7 warnings
 * are due); the day-21 and day-30 ones are not.
 */
export function warningsDue(createdAtIso: string, nowIso: string): number[] {
  const elapsed = daysElapsed(createdAtIso, nowIso);
  const due: number[] = [];
  for (let i = 0; i < CLAIM_WARNING_DAYS.length; i++) {
    if (elapsed >= CLAIM_WARNING_DAYS[i]) due.push(i + 1);
  }
  return due;
}

// ---------- Window evaluation ----------

/**
 * The state of an ACTIVE keeper's claim-block window:
 *
 *   - 'declined'        — the keeper said no (request.status === 'declined').
 *                         Permanent: a decline stops the claim cold, forever,
 *                         regardless of elapsed time. Checked FIRST.
 *   - 'overridden'      — instant resolution, no wait: the keeper approved
 *                         (request.status === 'approved') OR a pre-named
 *                         successor is the requester (heir match). The piece
 *                         moves now through the normal transfer path.
 *   - 'blocked-active'  — within the window, awaiting. The piece is held;
 *                         warnings may still be due (see `warningsDue`).
 *   - 'warning-due'     — a warning should fire now and has not yet been
 *                         delivered. Carries the warning ordinal.
 *   - 'frees-to-requester' — day CLAIM_WINDOW_DAYS reached, every warning
 *                         fired, and STILL no keeper response. Only now does
 *                         the piece become claimable by the requester. This
 *                         is the ONLY non-declined, non-overridden terminal
 *                         state, and it requires the full unanswered
 *                         sequence — inactivity alone can never reach it.
 */
export type ClaimWindowStatus =
  | 'declined'
  | 'overridden'
  | 'blocked-active'
  | 'warning-due'
  | 'frees-to-requester';

export interface ClaimWindowResult {
  status: ClaimWindowStatus;
  /** Whole days elapsed since the request opened, floored. */
  daysElapsed: number;
  /** Warning ordinals (1-based) that are due as of now, oldest first. */
  warningsDue: number[];
  /** On 'warning-due', the single ordinal that should fire now (the newest
   *  due warning the caller has not yet delivered). Absent otherwise. */
  warningOrdinal?: number;
}

export interface EvaluateClaimWindowOptions {
  /** The claim request under evaluation. Its createdAt anchors the window;
   *  its status carries an explicit keeper decision (approved/declined). */
  request: ClaimRequest;
  /**
   * Has the current keeper responded to ANY warning? A response is an
   * explicit keeper action — NOT mere account activity. This flag exists to
   * make the invariant load-bearing: only `false` here, sustained across the
   * full window, can ever free the piece. Inactivity is the absence of this,
   * and the absence never frees.
   */
  holderResponded: boolean;
  /** ISO instant to evaluate against. Threaded in — never read from a clock
   *  inside this pure function. */
  nowIso: string;
  /**
   * The keeper's pre-named successors (StewardRecord.heirs), if any. When the
   * requester matches an ACTIVE heir, the window is overridden instantly: a
   * named successor claiming needs no wait. A 'pending'/'revoked' heir does
   * NOT override — only an activated successor.
   */
  heirs?: StewardRecord['heirs'];
  /** Count of warnings the caller has ALREADY delivered. Lets the function
   *  report the next undelivered due warning as 'warning-due'. Defaults to 0
   *  (nothing sent yet). */
  warningsSent?: number;
}

/**
 * Evaluate an ACTIVE keeper's claim-block window — the pure decision at the
 * heart of the Living Legacy escalation. Deterministic in its inputs; the
 * caller decides what to DO with the state (send a warning, hold, or drive
 * the existing transfer path).
 *
 * Precedence, strictly ordered so the safety invariants hold:
 *   1. A decline stops the claim cold — checked first, time-independent.
 *   2. An explicit keeper approval, or a pre-named successor (active heir)
 *      claiming, overrides instantly — no wait.
 *   3. If the keeper has responded to a warning at all, the piece stays
 *      blocked: a response is engagement, and engagement never frees. (A
 *      responding keeper who then declines lands in (1); one who approves
 *      lands in (2). A response that is neither keeps the piece held.)
 *   4. Only at/after day CLAIM_WINDOW_DAYS, with every warning fired and no
 *      keeper response, does the piece free to the requester.
 *   5. Otherwise within the window: if a due warning is still undelivered,
 *      'warning-due'; else 'blocked-active'.
 */
export function evaluateClaimWindow(
  opts: EvaluateClaimWindowOptions,
): ClaimWindowResult {
  const { request, holderResponded, nowIso, heirs, warningsSent = 0 } = opts;

  const elapsed = daysElapsed(request.createdAt, nowIso);
  const due = warningsDue(request.createdAt, nowIso);
  const base = { daysElapsed: elapsed, warningsDue: due };

  // 1. A decline stops the claim permanently — independent of elapsed time.
  if (request.status === 'declined') {
    return { status: 'declined', ...base };
  }

  // 2a. Explicit keeper approval — instant override, no wait.
  if (request.status === 'approved') {
    return { status: 'overridden', ...base };
  }

  // 2b. A pre-named successor (active heir) is the requester — instant
  //     override. Match on the requester's email from the request; a
  //     'pending' or 'revoked' heir does not qualify.
  if (heirs && heirs.length > 0) {
    const requesterEmail = request.requesterEmail.trim().toLowerCase();
    const namedSuccessor = heirs.some(
      (h) =>
        h.status === 'active' &&
        h.email.trim().toLowerCase() === requesterEmail,
    );
    if (namedSuccessor) {
      return { status: 'overridden', ...base };
    }
  }

  // 3. Any keeper response keeps the piece blocked: engagement never frees.
  //    (A response that is itself a decline/approval was already handled in
  //    1/2, so a responding-yet-undecided keeper simply holds their piece.)
  if (holderResponded) {
    return { status: 'blocked-active', ...base };
  }

  // 4. A still-undelivered due warning fires before anything else can happen.
  //    Crucially this gates the free below: the final (day-30) warning must
  //    actually be DELIVERED, not merely become due, before the piece can
  //    move — the keeper gets their last alert in hand first.
  if (due.length > warningsSent) {
    return {
      status: 'warning-due',
      ...base,
      warningOrdinal: due[warningsSent],
    };
  }

  // 5. The orphaned path: the full window has elapsed, every warning has been
  //    DELIVERED, and still no keeper response. ONLY here does the piece free.
  //    This requires the complete unanswered sequence — inactivity without a
  //    claim, or a claim that has not run its full warning run, can never
  //    reach this branch.
  const allWarningsDelivered = warningsSent >= CLAIM_WARNING_DAYS.length;
  if (elapsed >= CLAIM_WINDOW_DAYS && allWarningsDelivered) {
    return { status: 'frees-to-requester', ...base };
  }

  // 6. Within the window, no response, nothing more to warn about yet: hold.
  return { status: 'blocked-active', ...base };
}
