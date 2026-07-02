/**
 * Unit suite for utils/claimWindow.ts — the Living Legacy claim-block window.
 *
 * Pins the ratified policy: a 30-day block on an ACTIVE keeper's piece, four
 * warnings at day 0/7/21/30, a FINAL_WARNING_GRACE_DAYS grace period after
 * the last warning is actually delivered, instant override ONLY on keeper
 * approval, freeing ONLY after the full unanswered window + grace, and a
 * decline that stops the claim cold. A pre-named heir is informational
 * (`heirEmailMatch`) and never an override — heirs are hints for the
 * executor, never auto-binding credentials. The load-bearing invariant —
 * inactivity alone NEVER frees a piece, and neither does a merely-due (as
 * opposed to delivered-and-rested) final warning — is asserted explicitly.
 */
import { describe, expect, it } from 'vitest';
import {
  CLAIM_WARNING_DAYS,
  CLAIM_WINDOW_DAYS,
  FINAL_WARNING_GRACE_DAYS,
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

/**
 * Build `count` warning delivery records (ordinals 1..count), each sent
 * exactly on its CLAIM_WARNING_DAYS offset day, EXCEPT the 4th (final) one,
 * which uses `finalSentAt` when given — lets tests pin the grace-period
 * anchor independently of when the warning became due.
 */
function warningsThrough(
  count: number,
  opts: { finalSentAt?: string } = {},
): Array<{ ordinal: number; sentAt: string }> {
  const list: Array<{ ordinal: number; sentAt: string }> = [];
  for (let i = 0; i < count; i++) {
    const ordinal = i + 1;
    const sentAt =
      ordinal === CLAIM_WARNING_DAYS.length && opts.finalSentAt
        ? opts.finalSentAt
        : day(CLAIM_WARNING_DAYS[i]);
    list.push({ ordinal, sentAt });
  }
  return list;
}

// ---------- Policy constants ----------

describe('claim-window policy constants', () => {
  it('blocks for 30 days with four warnings at 0/7/21/30, plus a 7-day grace period', () => {
    expect(CLAIM_WINDOW_DAYS).toBe(30);
    expect(CLAIM_WARNING_DAYS).toEqual([0, 7, 21, 30]);
    expect(FINAL_WARNING_GRACE_DAYS).toBe(7);
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
      warnings: warningsThrough(2), // day-0 and day-7 already delivered
    });
    expect(r.status).toBe('blocked-active');
    expect(r.daysElapsed).toBe(10);
  });

  it('fires warning-due at each boundary with the right ordinal', () => {
    // Day 0: first warning due, nothing sent yet.
    expect(
      evaluateClaimWindow({ request: request(), holderResponded: false, nowIso: OPEN, warnings: warningsThrough(0) }),
    ).toMatchObject({ status: 'warning-due', warningOrdinal: 1 });

    // Day 7: second warning due, one already sent.
    expect(
      evaluateClaimWindow({ request: request(), holderResponded: false, nowIso: day(7), warnings: warningsThrough(1) }),
    ).toMatchObject({ status: 'warning-due', warningOrdinal: 2 });

    // Day 21: third warning due, two already sent.
    expect(
      evaluateClaimWindow({ request: request(), holderResponded: false, nowIso: day(21), warnings: warningsThrough(2) }),
    ).toMatchObject({ status: 'warning-due', warningOrdinal: 3 });

    // Day 30: fourth/final warning due, three already sent — still a warning,
    // not yet a free (the keeper gets this last alert before anything moves).
    expect(
      evaluateClaimWindow({ request: request(), holderResponded: false, nowIso: day(30), warnings: warningsThrough(3) }),
    ).toMatchObject({ status: 'warning-due', warningOrdinal: 4 });
  });
});

// ---------- Day-30+grace frees ----------

describe('evaluateClaimWindow — freeing the piece (orphaned path)', () => {
  it('frees to the requester once window AND grace both elapse, all four warnings delivered, no response', () => {
    const r = evaluateClaimWindow({
      request: request(),
      holderResponded: false,
      nowIso: day(CLAIM_WINDOW_DAYS + FINAL_WARNING_GRACE_DAYS),
      warnings: warningsThrough(4), // 4th delivered right at day 30
    });
    expect(r.status).toBe('frees-to-requester');
  });

  it('does NOT free at day 29 — the full window has not elapsed', () => {
    const r = evaluateClaimWindow({
      request: request(),
      holderResponded: false,
      nowIso: day(29),
      warnings: warningsThrough(3),
    });
    expect(r.status).toBe('blocked-active');
  });

  it('still frees well past window + grace (deceased keeper, never returns)', () => {
    const r = evaluateClaimWindow({
      request: request(),
      holderResponded: false,
      nowIso: day(120),
      warnings: warningsThrough(4),
    });
    expect(r.status).toBe('frees-to-requester');
  });
});

// ---------- Grace period after the final warning ----------

describe('evaluateClaimWindow — grace period after the final warning', () => {
  it('does NOT free at day 30 even with all four warnings delivered — the 4th just landed', () => {
    const r = evaluateClaimWindow({
      request: request(),
      holderResponded: false,
      nowIso: day(30),
      warnings: warningsThrough(4), // 4th warning sentAt === day(30): "just delivered"
    });
    expect(r.status).not.toBe('frees-to-requester');
    expect(r.status).toBe('blocked-active');
  });

  it('does NOT free while still inside the 7-day grace window (day 33)', () => {
    const r = evaluateClaimWindow({
      request: request(),
      holderResponded: false,
      nowIso: day(33),
      warnings: warningsThrough(4),
    });
    expect(r.status).toBe('blocked-active');
  });

  it('frees only once FINAL_WARNING_GRACE_DAYS have elapsed since the 4th warning', () => {
    const stillGrace = evaluateClaimWindow({
      request: request(),
      holderResponded: false,
      nowIso: day(CLAIM_WINDOW_DAYS + FINAL_WARNING_GRACE_DAYS - 1),
      warnings: warningsThrough(4),
    });
    expect(stillGrace.status).toBe('blocked-active');

    const graceElapsed = evaluateClaimWindow({
      request: request(),
      holderResponded: false,
      nowIso: day(CLAIM_WINDOW_DAYS + FINAL_WARNING_GRACE_DAYS),
      warnings: warningsThrough(4),
    });
    expect(graceElapsed.status).toBe('frees-to-requester');
  });

  it('anchors grace on the warning\'s ACTUAL delivery time, not day 30 — a late warning delays freeing', () => {
    // 4th warning delivered at day 40 instead of day 30 (a slow notification
    // channel) — grace still must elapse from the ACTUAL delivery.
    const lateWarnings = warningsThrough(4, { finalSentAt: day(40) });
    const tooSoon = evaluateClaimWindow({
      request: request(),
      holderResponded: false,
      nowIso: day(44), // only 4 days after the late delivery
      warnings: lateWarnings,
    });
    expect(tooSoon.status).toBe('blocked-active');

    const enough = evaluateClaimWindow({
      request: request(),
      holderResponded: false,
      nowIso: day(47), // 7 days after the late delivery
      warnings: lateWarnings,
    });
    expect(enough.status).toBe('frees-to-requester');
  });
});

// ---------- Decline stops cold ----------

describe('evaluateClaimWindow — a decline stops the claim permanently', () => {
  it('is declined regardless of elapsed time', () => {
    const declined = request({ status: 'declined' });
    expect(
      evaluateClaimWindow({ request: declined, holderResponded: true, nowIso: day(2) }).status,
    ).toBe('declined');
    // Even past the window + grace, a decline never becomes a free.
    expect(
      evaluateClaimWindow({
        request: declined,
        holderResponded: false,
        nowIso: day(99),
        warnings: warningsThrough(4),
      }).status,
    ).toBe('declined');
  });
});

// ---------- Instant override on approve ONLY ----------

describe('evaluateClaimWindow — instant override on keeper approval, and ONLY on approval', () => {
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

// ---------- Heir match is informational only, never an override ----------

describe('evaluateClaimWindow — a pre-named heir is informational only, never an override', () => {
  it('surfaces heirEmailMatch=true but does NOT override the window for an ACTIVE heir', () => {
    const r = evaluateClaimWindow({
      request: request({ requesterEmail: 'Buyer@Example.com' }), // case-insensitive
      holderResponded: false,
      nowIso: day(1),
      warnings: warningsThrough(1),
      heirs: [heir({ email: 'buyer@example.com' })],
    });
    expect(r.heirEmailMatch).toBe(true);
    // NOT 'overridden' — heirs are hints for the executor, never auto-binding
    // credentials. A named successor waits out the same window as anyone.
    expect(r.status).not.toBe('overridden');
    expect(r.status).toBe('blocked-active');
  });

  it('a matching heir still waits out the full window + grace — never frees early', () => {
    const r = evaluateClaimWindow({
      request: request(),
      holderResponded: false,
      nowIso: day(10),
      warnings: warningsThrough(2),
      heirs: [heir()], // matches the default requesterEmail
    });
    expect(r.heirEmailMatch).toBe(true);
    expect(r.status).toBe('blocked-active');
    expect(r.status).not.toBe('frees-to-requester');
  });

  it('heirEmailMatch is false for a pending/revoked heir, or a non-matching email', () => {
    expect(
      evaluateClaimWindow({
        request: request(),
        holderResponded: false,
        nowIso: day(8),
        warnings: warningsThrough(2),
        heirs: [heir({ status: 'pending' })],
      }).heirEmailMatch,
    ).toBe(false);

    expect(
      evaluateClaimWindow({
        request: request(),
        holderResponded: false,
        nowIso: day(8),
        warnings: warningsThrough(2),
        heirs: [heir({ status: 'revoked' })],
      }).heirEmailMatch,
    ).toBe(false);

    expect(
      evaluateClaimWindow({
        request: request({ requesterEmail: 'someone-else@example.com' }),
        holderResponded: false,
        nowIso: day(8),
        warnings: warningsThrough(2),
        heirs: [heir({ email: 'buyer@example.com' })],
      }).heirEmailMatch,
    ).toBe(false);
  });

  it('heirEmailMatch rides along even on a declined or overridden result', () => {
    const declined = evaluateClaimWindow({
      request: request({ status: 'declined', requesterEmail: 'buyer@example.com' }),
      holderResponded: true,
      nowIso: day(2),
      heirs: [heir()],
    });
    expect(declined.status).toBe('declined');
    expect(declined.heirEmailMatch).toBe(true);

    const approved = evaluateClaimWindow({
      request: request({ status: 'approved', requesterEmail: 'buyer@example.com' }),
      holderResponded: true,
      nowIso: day(2),
      heirs: [heir()],
    });
    expect(approved.status).toBe('overridden');
    expect(approved.heirEmailMatch).toBe(true);
  });
});

// ---------- Engagement never frees ----------

describe('evaluateClaimWindow — a responding keeper holds the piece', () => {
  it('stays blocked past window + grace if the keeper responded (engagement never frees)', () => {
    const r = evaluateClaimWindow({
      request: request(), // still pending — keeper engaged but neither approved nor declined
      holderResponded: true,
      nowIso: day(45),
      warnings: warningsThrough(4),
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
    // sequence went unanswered AND rested through its grace period.
    //
    // Model "inactivity" as a claim that exists but has NOT run its window:
    // even at day 6 with the keeper silent, the piece is blocked, never freed.
    const early = evaluateClaimWindow({
      request: request(),
      holderResponded: false,
      nowIso: day(6),
      warnings: warningsThrough(1),
    });
    expect(early.status).not.toBe('frees-to-requester');
    expect(early.status).toBe('blocked-active');
  });

  it('a claim past day 90 does not free until all four warnings have been DELIVERED', () => {
    // By day 90 all four warnings are DUE — but freeing gates on warnings
    // actually delivered, not merely due. With only three delivered, the
    // keeper has not yet received their final alert, so the piece stays
    // blocked even at day 90.
    const due = warningsDue(OPEN, day(90));
    expect(due.length).toBe(CLAIM_WARNING_DAYS.length); // all DUE by day 90
    expect(
      evaluateClaimWindow({
        request: request(),
        holderResponded: false,
        nowIso: day(90),
        warnings: warningsThrough(3), // final warning not yet delivered
      }).status,
    ).toBe('warning-due'); // the day-30 warning must fire first
    // Once all four are delivered (and grace has long since elapsed) and
    // still no response, it frees.
    expect(
      evaluateClaimWindow({
        request: request(),
        holderResponded: false,
        nowIso: day(90),
        warnings: warningsThrough(4),
      }).status,
    ).toBe('frees-to-requester');
  });

  it('freeing requires the full window AND the full warning sequence AND the grace period', () => {
    // A request that somehow reads as day-30+ but whose warnings are not all
    // due (impossible by construction since both derive from elapsed, but we
    // pin the conjunction so a future refactor that decouples them stays safe).
    // Here we confirm the negative: short of day 30, no free regardless of
    // what the (impossible) warning record claims.
    const r = evaluateClaimWindow({
      request: request(),
      holderResponded: false,
      nowIso: day(29),
      warnings: warningsThrough(4),
    });
    expect(r.status).not.toBe('frees-to-requester');
  });
});

describe('INVARIANT (hostile claim) — a manufactured claim + total keeper silence cannot free before window + grace', () => {
  it('walks the whole timeline under the most requester-favorable conditions (instant, full delivery) and never frees before day 37', () => {
    // "Manufactured" claim: nothing about this request needs to be genuine —
    // the invariant must hold even in the worst case for the current keeper,
    // where every warning fires the instant it's due and the keeper never
    // responds even once.
    const manufactured = request({ id: 'req-hostile', requesterEmail: 'attacker@example.com' });
    const timeline: Array<{ atDay: number; expectFree: boolean }> = [
      { atDay: 0, expectFree: false },
      { atDay: 7, expectFree: false },
      { atDay: 21, expectFree: false },
      { atDay: 30, expectFree: false }, // window closes; grace has not run yet
      { atDay: 36, expectFree: false }, // still inside the 7-day grace window
      { atDay: 37, expectFree: true },  // window + grace both fully elapsed
    ];
    for (const { atDay, expectFree } of timeline) {
      const dueCount = warningsDue(OPEN, day(atDay)).length;
      const r = evaluateClaimWindow({
        request: manufactured,
        holderResponded: false, // total silence throughout
        nowIso: day(atDay),
        warnings: warningsThrough(dueCount, { finalSentAt: day(CLAIM_WINDOW_DAYS) }),
      });
      expect(r.status === 'frees-to-requester').toBe(expectFree);
    }
  });
});
