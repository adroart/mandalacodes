/**
 * Pure, I/O-free logic for the Living Legacy "claim-block window" (M4).
 *
 * The missing piece of claim-safety: a claim request against an ACTIVE
 * keeper's piece must NOT free the piece on inactivity. It defines a long
 * block window (30 days) during which the current keeper would be warned
 * four times, plus a grace period after the final warning. Only true
 * unanswered silence across the FULL window AND grace — every warning
 * DELIVERED, zero response — frees the piece to the requester (the orphaned
 * path: deceased keeper, thrift-store rescue). A single "no" from the
 * keeper, at any point, stops the claim cold. Mere inactivity never frees
 * anything: a claim must exist and run its full warning sequence first.
 *
 * ACTIVATION STATUS (2026-07-02 hardening amendment to
 * todo/plans/living-art-legacy.md — that amendment is the ratifying source
 * for the policy below; nothing here was ever ratified as LIVE, only as
 * policy): this module is DORMANT. No endpoint in this repo calls
 * evaluateClaimWindow — claim-bridge.ts and steward/request-claim.ts only
 * enqueue a pending ClaimRequest for a human to resolve by hand. Wiring
 * this escalation up for real requires, per the amendment: (1) an
 * out-of-band notification channel that can actually DELIVER a warning to
 * the keeper (none exists yet — email/push is unbuilt), (2) the
 * `warnings` / `holderRespondedAt` fields persisted on ClaimRequest
 * (types.ts carries them; nothing writes them yet), and (3) the
 * FINAL_WARNING_GRACE_DAYS grace period actually enforced by whatever
 * driver calls this module. Until all three exist, treat this file as
 * policy-in-waiting, not running code.
 *
 * Heirs (StewardRecord.heirs) are HINTS for the executor only — never an
 * auto-binding credential. A requester matching an active heir is exposed
 * on the result purely as information (`heirEmailMatch`) so a resolving
 * human can see it; it never overrides the window. Activation of a named
 * successor is always a mediated `transferred` event driven by the
 * artist/executor, per the plan's heir model — this module cannot bind
 * anything by itself.
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

/**
 * Grace period after the FINAL warning is DELIVERED, in days. The keeper's
 * last alert (due at day CLAIM_WINDOW_DAYS) must have been sitting with them
 * for at least this long — not merely have become due — before the piece can
 * free: a warning that landed five minutes ago was never a real chance to
 * respond. Added by the 2026-07-02 hardening amendment; closes the gap where
 * a late-delivered final warning and an immediate free could coincide.
 */
export const FINAL_WARNING_GRACE_DAYS = 7;

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
 * warning delivery records it already holds (ClaimRequest.warnings) to find
 * the ones still to fire — the function itself is stateless, so it reports
 * all that are due, idempotently, regardless of what has actually been sent.
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
 *                         (request.status === 'approved'). This is the ONLY
 *                         path to 'overridden' — a requester who matches an
 *                         ACTIVE heir is surfaced as `heirEmailMatch` on the
 *                         result, never as a status override. Heirs are
 *                         hints for the executor, never auto-binding
 *                         credentials; a named successor waits out the same
 *                         window as anyone else.
 *   - 'blocked-active'  — within the window, awaiting. The piece is held;
 *                         warnings may still be due (see `warningsDue`).
 *   - 'warning-due'     — a warning should fire now and has not yet been
 *                         delivered. Carries the warning ordinal.
 *   - 'frees-to-requester' — day CLAIM_WINDOW_DAYS reached, every warning
 *                         DELIVERED, the final warning's
 *                         FINAL_WARNING_GRACE_DAYS grace period has fully
 *                         elapsed, and STILL no keeper response. Only now
 *                         does the piece become claimable by the requester.
 *                         This is the ONLY non-declined, non-overridden
 *                         terminal state, and it requires the full
 *                         unanswered sequence plus grace — inactivity alone
 *                         can never reach it.
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
  /** Does the requester's email match an ACTIVE pre-named heir
   *  (StewardRecord.heirs)? Purely informational: a resolving human sees
   *  this to weigh the claim, but it is NEVER auto-binding and never
   *  changes `status`. Heirs are hints for the executor; activation of a
   *  named successor is always a mediated `transferred` event (plan's heir
   *  model). Computed regardless of `status`, so it rides along even on
   *  'declined'/'overridden' results. */
  heirEmailMatch: boolean;
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
   * The keeper's pre-named successors (StewardRecord.heirs), if any. Used
   * ONLY to compute the informational `heirEmailMatch` flag on the result —
   * see that field's doc. Heirs never override the window: even a requester
   * matching an ACTIVE heir waits out the same block like anyone else. A
   * 'pending'/'revoked' heir never matches.
   */
  heirs?: StewardRecord['heirs'];
  /**
   * Claim-block warnings actually DELIVERED so far, oldest first (mirrors
   * ClaimRequest.warnings). Ordinals are 1-based, matching
   * CLAIM_WARNING_DAYS order. Defaults to `[]` (nothing sent yet). Lets the
   * function report the next undelivered due warning as 'warning-due', and
   * anchors the grace-period check on the 4th warning's `sentAt`.
   */
  warnings?: Array<{ ordinal: number; sentAt: string }>;
}

/**
 * Evaluate an ACTIVE keeper's claim-block window — the pure decision at the
 * heart of the Living Legacy escalation. Deterministic in its inputs; the
 * caller decides what to DO with the state (send a warning, hold, or drive
 * the existing transfer path).
 *
 * Precedence, strictly ordered so the safety invariants hold:
 *   1. A decline stops the claim cold — checked first, time-independent.
 *   2. An explicit keeper approval overrides instantly — no wait. This is
 *      the ONLY instant override; a pre-named successor (active heir)
 *      claiming is surfaced as `heirEmailMatch` but does NOT override — an
 *      heir is a hint, never an auto-binding credential (plan's heir
 *      model). A named successor waits out the same window as any other
 *      requester.
 *   3. If the keeper has responded to a warning at all, the piece stays
 *      blocked: a response is engagement, and engagement never frees. (A
 *      responding keeper who then declines lands in (1); one who approves
 *      lands in (2). A response that is neither keeps the piece held.)
 *   4. Only at/after day CLAIM_WINDOW_DAYS, with every warning DELIVERED
 *      (not merely due) and the final warning unanswered for at least
 *      FINAL_WARNING_GRACE_DAYS, does the piece free to the requester.
 *   5. Otherwise within the window (or past it but still inside the grace
 *      period, or with the final delivery unrecorded): if a due warning is
 *      still undelivered, 'warning-due'; else 'blocked-active'.
 */
export function evaluateClaimWindow(
  opts: EvaluateClaimWindowOptions,
): ClaimWindowResult {
  const { request, holderResponded, nowIso, heirs, warnings = [] } = opts;

  const elapsed = daysElapsed(request.createdAt, nowIso);
  const due = warningsDue(request.createdAt, nowIso);

  // Informational only — never overrides. Computed unconditionally so it
  // rides along on every returned status, including 'declined'/'overridden':
  // a resolving human should be able to see it regardless of how the window
  // resolved.
  const requesterEmail = request.requesterEmail.trim().toLowerCase();
  const heirEmailMatch = Boolean(
    heirs?.some(
      (h) => h.status === 'active' && h.email.trim().toLowerCase() === requesterEmail,
    ),
  );

  const base = { daysElapsed: elapsed, warningsDue: due, heirEmailMatch };

  // 1. A decline stops the claim permanently — independent of elapsed time.
  if (request.status === 'declined') {
    return { status: 'declined', ...base };
  }

  // 2. Explicit keeper approval — instant override, no wait. See the
  //    ClaimWindowStatus doc: this is the ONLY path to 'overridden'.
  if (request.status === 'approved') {
    return { status: 'overridden', ...base };
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
  const warningsSentCount = warnings.length;
  if (due.length > warningsSentCount) {
    return {
      status: 'warning-due',
      ...base,
      warningOrdinal: due[warningsSentCount],
    };
  }

  // 5. The orphaned path: the full window has elapsed, every warning has
  //    been DELIVERED, the final warning has sat unanswered for at least
  //    FINAL_WARNING_GRACE_DAYS, and still no keeper response. ONLY here
  //    does the piece free. This requires the complete unanswered sequence
  //    PLUS grace — inactivity without a claim, a claim that has not run its
  //    full warning run, or a final warning still within its grace period,
  //    can never reach this branch.
  const allWarningsDelivered = warningsSentCount >= CLAIM_WARNING_DAYS.length;
  const finalWarning = warnings.find(
    (w) => w.ordinal === CLAIM_WARNING_DAYS.length,
  );
  const graceElapsed =
    finalWarning !== undefined &&
    daysElapsed(finalWarning.sentAt, nowIso) >= FINAL_WARNING_GRACE_DAYS;
  if (elapsed >= CLAIM_WINDOW_DAYS && allWarningsDelivered && graceElapsed) {
    return { status: 'frees-to-requester', ...base };
  }

  // 6. Within the window, past it but still inside the grace period, or the
  //    final warning's delivery was never recorded: hold.
  return { status: 'blocked-active', ...base };
}
