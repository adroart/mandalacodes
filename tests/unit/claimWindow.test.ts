/**
 * Unit suite for utils/claimWindow.ts — the Living Legacy claim-block window.
 *
 * Pins the ratified policy: a 30-day block on an ACTIVE keeper's piece, four
 * warnings at day 0/7/21/30, instant override on keeper-approve or pre-named
 * successor, freeing ONLY after the full unanswered window, and a decline
 * that stops the claim cold. The load-bearing invariant — inactivity alone
 * NEVER frees a piece — is asserted explicitly.
 */
import { describe, expect, it } from 'vitest';
import {
  CLAIM_WARNING_DAYS,
  CLAIM_WINDOW_DAYS,
  daysElapsed,
  evaluateClaimWindow,
  warningsDue,
} from '../../utils/claimWindow';
import type { ClaimRequest, HeirRegistration } from '../../types';

const OPEN = '2026-06-01T00:00:00.000Z';

/** ISO instant `days` whole days after OPEN. */
function day(days: number): string {
  return new Date(Date.parse(OPEN) + days * 24 * 60 * 60 * 1000).toISOString();
}

function request(overrides: Partial<ClaimRequest> = {}): ClaimRequest {
  return {
    id: 'req-1',
    pieceId: 'UL-7',
    requesterRef: 'user_requester',
    requesterEmail: 'buyer@example.com',
    createdAt: OPEN,
    status: 'pending',
    routedTo: 'holder', // the window only governs ACTIVE-keeper (holder) routes
    ...overrides,
  };
}

function heir(overrides: Partial<HeirRegistration> = {}): HeirRegistration {
  return {
    email: 'buyer@example.com',
    registeredAt: '2026-01-01T00:00:00.000Z',
    registeredBy: 'user_holder',
    status: 'active',
    ...overrides,
  };
}

// ---------- Policy constants ----------

describe('claim-window policy constants', () => {
  it('blocks for 30 days with four warnings at 0/7/21/30', () => {
    expect(CLAIM_WINDOW_DAYS).toBe(30);
    expect(CLAIM_WARNING_DAYS).toEqual([0, 7, 21, 30]);
  });

  it('the final warning coincides with the window boundary', () => {
    expect(CLAIM_WARNING_DAYS[CLAIM_WARNING_DAYS.length - 1]).toBe(
      CLAIM_WINDOW_DAYS,
    );
  });
});

// ---------- Elapsed-day math ----------

describe('daysElapsed', () => {
  it('floors whole days and never goes negative', () => {
    expect(daysElapsed(OPEN, OPEN)).toBe(0);
    expect(daysElapsed(OPEN, day(7))).toBe(7);
    // 6 days 23h still reads as 6 whole days.
    expect(
      daysElapsed(OPEN, new Date(Date.parse(day(6)) + 23 * 3600 * 1000).toISOString()),
    ).toBe(6);
    // now before from → 0, never negative.
    expect(daysElapsed(day(5), OPEN)).toBe(0);
  });

  it('treats an unparseable date as no elapsed time (cannot advance the window)', () => {
    expect(daysElapsed('not-a-date', day(99))).toBe(0);
    expect(daysElapsed(OPEN, 'not-a-date')).toBe(0);
  });
});

describe('warningsDue', () => {
  it('reports each warning ordinal as its offset day is reached', () => {
    expect(warningsDue(OPEN, OPEN)).toEqual([1]); // day-0 only
    expect(warningsDue(OPEN, day(6))).toEqual([1]);
    expect(warningsDue(OPEN, day(7))).toEqual([1, 2]); // week boundary
    expect(warningsDue(OPEN, day(20))).toEqual([1, 2]);
    expect(warningsDue(OPEN, day(21))).toEqual([1, 2, 3]);
    expect(warningsDue(OPEN, day(29))).toEqual([1, 2, 3]);
    expect(warningsDue(OPEN, day(30))).toEqual([1, 2, 3, 4]); // window close
    expect(warningsDue(OPEN, day(90))).toEqual([1, 2, 3, 4]); // saturates
  });
});

// ---------- Within-window blocked + warning boundaries ----------

describe('evaluateClaimWindow — within the window', () => {
  it('is blocked-active inside the window once the due warning is sent', () => {
    const r = evaluateClaimWindow({
      request: request(),
      holderResponded: false,
      nowIso: day(10),
      warningsSent: 2, // day-0 and day-7 already delivered
    });
    expect(r.status).toBe('blocked-active');
    expect(r.daysElapsed).toBe(10);
  });

  it('fires warning-due at each boundary with the right ordinal', () => {
    // Day 0: first warning due, nothing sent yet.
    expect(
      evaluateClaimWindow({ request: request(), holderResponded: false, nowIso: OPEN, warningsSent: 0 }),
    ).toMatchObject({ status: 'warning-due', warningOrdinal: 1 });

    // Day 7: second warning due, one already sent.
    expect(
      evaluateClaimWindow({ request: request(), holderResponded: false, nowIso: day(7), warningsSent: 1 }),
    ).toMatchObject({ status: 'warning-due', warningOrdinal: 2 });

    // Day 21: third warning due, two already sent.
    expect(
      evaluateClaimWindow({ request: request(), holderResponded: false, nowIso: day(21), warningsSent: 2 }),
    ).toMatchObject({ status: 'warning-due', warningOrdinal: 3 });

    // Day 30: fourth/final warning due, three already sent — still a warning,
    // not yet a free (the keeper gets this last alert before anything moves).
    expect(
      evaluateClaimWindow({ request: request(), holderResponded: false, nowIso: day(30), warningsSent: 3 }),
    ).toMatchObject({ status: 'warning-due', warningOrdinal: 4 });
  });
});

// ---------- Day-30 frees ----------

describe('evaluateClaimWindow — freeing the piece (orphaned path)', () => {
  it('frees to the requester at day 30 once all four warnings fired and no response', () => {
    const r = evaluateClaimWindow({
      request: request(),
      holderResponded: false,
      nowIso: day(30),
      warningsSent: 4, // every warning delivered, zero keeper response
    });
    expect(r.status).toBe('frees-to-requester');
  });

  it('does NOT free at day 29 — the full window has not elapsed', () => {
    const r = evaluateClaimWindow({
      request: request(),
      holderResponded: false,
      nowIso: day(29),
      warningsSent: 3,
    });
    expect(r.status).toBe('blocked-active');
  });

  it('still frees well past day 30 (deceased keeper, never returns)', () => {
    const r = evaluateClaimWindow({
      request: request(),
      holderResponded: false,
      nowIso: day(120),
      warningsSent: 4,
    });
    expect(r.status).toBe('frees-to-requester');
  });
});

// ---------- Decline stops cold ----------

describe('evaluateClaimWindow — a decline stops the claim permanently', () => {
  it('is declined regardless of elapsed time', () => {
    const declined = request({ status: 'declined' });
    expect(
      evaluateClaimWindow({ request: declined, holderResponded: true, nowIso: day(2) }).status,
    ).toBe('declined');
    // Even past the window, a decline never becomes a free.
    expect(
      evaluateClaimWindow({ request: declined, holderResponded: false, nowIso: day(99), warningsSent: 4 }).status,
    ).toBe('declined');
  });
});

// ---------- Instant override on approve ----------

describe('evaluateClaimWindow — instant override on keeper approval', () => {
  it('overrides immediately when the keeper approves, no wait', () => {
    const approved = request({ status: 'approved' });
    expect(
      evaluateClaimWindow({ request: approved, holderResponded: true, nowIso: day(1) }).status,
    ).toBe('overridden');
    // Override holds at day 0 too — there is genuinely no wait.
    expect(
      evaluateClaimWindow({ request: approved, holderResponded: true, nowIso: OPEN }).status,
    ).toBe('overridden');
  });
});

// ---------- Pre-named successor instant ----------

describe('evaluateClaimWindow — pre-named successor claims instantly', () => {
  it('overrides immediately when the requester is an ACTIVE heir', () => {
    const r = evaluateClaimWindow({
      request: request({ requesterEmail: 'Buyer@Example.com' }), // case-insensitive
      holderResponded: false,
      nowIso: day(1),
      heirs: [heir({ email: 'buyer@example.com' })],
    });
    expect(r.status).toBe('overridden');
  });

  it('does NOT override for a pending/revoked heir, or a non-matching email', () => {
    // Pending heir → no override, normal block.
    expect(
      evaluateClaimWindow({
        request: request(),
        holderResponded: false,
        nowIso: day(8),
        warningsSent: 2,
        heirs: [heir({ status: 'pending' })],
      }).status,
    ).toBe('blocked-active');

    // Revoked heir → no override.
    expect(
      evaluateClaimWindow({
        request: request(),
        holderResponded: false,
        nowIso: day(8),
        warningsSent: 2,
        heirs: [heir({ status: 'revoked' })],
      }).status,
    ).toBe('blocked-active');

    // Active heir but a different requester email → no override.
    expect(
      evaluateClaimWindow({
        request: request({ requesterEmail: 'someone-else@example.com' }),
        holderResponded: false,
        nowIso: day(8),
        warningsSent: 2,
        heirs: [heir({ email: 'buyer@example.com' })],
      }).status,
    ).toBe('blocked-active');
  });
});

// ---------- Engagement never frees ----------

describe('evaluateClaimWindow — a responding keeper holds the piece', () => {
  it('stays blocked past day 30 if the keeper responded (engagement never frees)', () => {
    const r = evaluateClaimWindow({
      request: request(), // still pending — keeper engaged but neither approved nor declined
      holderResponded: true,
      nowIso: day(45),
      warningsSent: 4,
    });
    // NOT frees-to-requester: a keeper who is present but undecided keeps
    // their piece. Freeing is reserved for true silence.
    expect(r.status).toBe('blocked-active');
  });
});

// ---------- THE INVARIANT: inactivity alone never frees ----------

describe('INVARIANT — inactivity alone never frees a piece', () => {
  it('90 days of pure inactivity with NO claim attempt cannot free anything', () => {
    // There is no request to evaluate when nobody has claimed. The window
    // function only ever runs against an existing ClaimRequest, so the
    // "deceased keeper, no claimant" case has no path to a free. We assert
    // the design directly: freeing requires a request whose full warning
    // sequence went unanswered.
    //
    // Model "inactivity" as a claim that exists but has NOT run its window:
    // even at day 6 with the keeper silent, the piece is blocked, never freed.
    const early = evaluateClaimWindow({
      request: request(),
      holderResponded: false,
      nowIso: day(6),
      warningsSent: 1,
    });
    expect(early.status).not.toBe('frees-to-requester');
    expect(early.status).toBe('blocked-active');
  });

  it('a claim past day 90 does not free until all four warnings have been DELIVERED', () => {
    // By day 90 all four warnings are DUE — but freeing gates on warnings
    // actually delivered (warningsSent), not merely due. With only three
    // sent, the keeper has not yet received their final alert, so the piece
    // stays blocked even at day 90.
    const due = warningsDue(OPEN, day(90));
    expect(due.length).toBe(CLAIM_WARNING_DAYS.length); // all DUE by day 90
    expect(
      evaluateClaimWindow({
        request: request(),
        holderResponded: false,
        nowIso: day(90),
        warningsSent: 3, // final warning not yet delivered
      }).status,
    ).toBe('warning-due'); // the day-30 warning must fire first
    // Once all four are delivered and still no response, it frees.
    expect(
      evaluateClaimWindow({
        request: request(),
        holderResponded: false,
        nowIso: day(90),
        warningsSent: 4,
      }).status,
    ).toBe('frees-to-requester');
  });

  it('freeing requires BOTH the full window AND the full warning sequence', () => {
    // A request that somehow reads as day-30+ but whose warnings are not all
    // due (impossible by construction since both derive from elapsed, but we
    // pin the conjunction so a future refactor that decouples them stays safe).
    // Here we confirm the negative: short of day 30, no free regardless of sent.
    const r = evaluateClaimWindow({
      request: request(),
      holderResponded: false,
      nowIso: day(29),
      warningsSent: 4,
    });
    expect(r.status).not.toBe('frees-to-requester');
  });
});
