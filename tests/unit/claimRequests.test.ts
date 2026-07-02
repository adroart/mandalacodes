/**
 * Unit suite for utils/claimRequests.ts (M4 self-serve claim requests).
 *
 * Pins the routing (holder vs admin), the anti-takeover guarantee (a
 * request against a bound piece routes to the holder and NEVER produces
 * anything but a pending row), dedupe, the naive rate limit, and the
 * privacy of the holder-facing view.
 */
import { describe, expect, it } from 'vitest';
import {
  CLAIM_REQUEST_NOTE_MAX,
  MAX_OPEN_REQUESTS_PER_REQUESTER,
  parseClaimRequestInput,
  planClaimRequest,
  resolveRequest,
  toHolderRequestView,
} from '../../utils/claimRequests';
import type { ClaimRequest, StewardRecord } from '../../types';

const NOW = '2026-06-10T12:00:00.000Z';

function steward(overrides: Partial<StewardRecord> = {}): StewardRecord {
  return {
    pieceId: 'UL-7',
    email: 'holder@example.com',
    issuedAt: '2026-01-01T00:00:00.000Z',
    outreachStatus: 'claimed',
    ...overrides,
  };
}

let counter = 0;
function req(overrides: Partial<ClaimRequest> = {}): ClaimRequest {
  counter += 1;
  return {
    id: `req-${counter}`,
    pieceId: `UL-${counter}`,
    requesterRef: 'user_requester',
    requesterEmail: 'buyer@example.com',
    createdAt: NOW,
    status: 'pending',
    routedTo: 'admin',
    ...overrides,
  };
}

function plan(
  requests: ClaimRequest[],
  stewardRecord: StewardRecord | undefined,
  inputOverrides: Record<string, unknown> = {},
) {
  const input = parseClaimRequestInput({ pieceId: 'UL-7', ...inputOverrides });
  if (input.ok === false) throw new Error(input.error);
  return planClaimRequest(requests, {
    input: input.value,
    requesterRef: 'user_requester',
    requesterEmail: 'buyer@example.com',
    steward: stewardRecord,
    now: NOW,
  });
}

// ---------- Input validation ----------

describe('parseClaimRequestInput', () => {
  it('accepts pieceId + optional editionNumber + note', () => {
    const r = parseClaimRequestInput({
      pieceId: 'UL-7',
      editionNumber: 2,
      note: 'Bought at the Vienna auction, lot 12',
    });
    expect(r.ok).toBe(true);
  });

  it('rejects unknown fields, missing pieceId, oversized notes', () => {
    expect(parseClaimRequestInput({ pieceId: 'UL-7', status: 'approved' }).ok).toBe(false);
    expect(parseClaimRequestInput({ note: 'hi' }).ok).toBe(false);
    expect(
      parseClaimRequestInput({
        pieceId: 'UL-7',
        note: 'x'.repeat(CLAIM_REQUEST_NOTE_MAX + 1),
      }).ok,
    ).toBe(false);
    expect(parseClaimRequestInput({ pieceId: 'UL-7', editionNumber: -1 }).ok).toBe(false);
    expect(parseClaimRequestInput(null).ok).toBe(false);
  });

  it('drops a blank note', () => {
    const r = parseClaimRequestInput({ pieceId: 'UL-7', note: '   ' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.note).toBeUndefined();
  });
});

// ---------- Routing ----------

describe('planClaimRequest routing', () => {
  it('routes to admin when the piece has no steward record', () => {
    const r = plan([], undefined);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.routedTo).toBe('admin');
  });

  it('routes to admin when the record exists but is UNBOUND', () => {
    const r = plan([], steward()); // no clerkUserId
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.routedTo).toBe('admin');
  });

  it('routes to the holder when the record is bound (anti-takeover)', () => {
    const r = plan([], steward({ clerkUserId: 'user_holder' }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.routedTo).toBe('holder');
  });

  it('never produces anything but a pending row — a request on a bound piece cannot bind by itself', () => {
    const r = plan([], steward({ clerkUserId: 'user_holder' }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.status).toBe('pending');
      // The plan's output is ONLY a queue row: no steward fields, no
      // binding data beyond the requester's own identity plus the
      // server-stamped provenance fields (source, requesterEmailVerified).
      expect(Object.keys(r.value).sort()).toEqual([
        'createdAt', 'id', 'pieceId', 'requesterEmail', 'requesterEmailVerified',
        'requesterRef', 'routedTo', 'source', 'status',
      ]);
    }
  });

  it('defaults provenance to source "user" and requesterEmailVerified true when the caller does not specify them', () => {
    const r = plan([], undefined);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.source).toBe('user');
      expect(r.value.requesterEmailVerified).toBe(true);
    }
  });

  it('refuses a request from the bound steward themselves', () => {
    const r = plan([], steward({ clerkUserId: 'user_requester' }));
    expect(r.ok).toBe(false);
  });
});

// ---------- Dedupe + rate limit ----------

describe('planClaimRequest guards', () => {
  it('dedupes per (requester, piece, edition)', () => {
    const existing = [req({ pieceId: 'UL-7' })];
    expect(plan(existing, undefined).ok).toBe(false);
    // A different edition of the same piece is a different request.
    expect(plan(existing, undefined, { editionNumber: 2 }).ok).toBe(true);
    // Someone ELSE's open request doesn't block this requester.
    const others = [req({ pieceId: 'UL-7', requesterRef: 'user_other' })];
    expect(plan(others, undefined).ok).toBe(true);
  });

  it('caps open requests per requester', () => {
    const open = Array.from({ length: MAX_OPEN_REQUESTS_PER_REQUESTER }, () => req());
    const r = plan(open, undefined);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error).toContain('at most');
  });

  it('resolved requests do not count against the limit or dedupe', () => {
    const closed = [
      req({ pieceId: 'UL-7', status: 'declined' }),
      req({ status: 'approved' }),
      req({ status: 'declined' }),
    ];
    expect(plan(closed, undefined).ok).toBe(true);
  });
});

// ---------- Resolution + holder view ----------

describe('resolveRequest', () => {
  it('stamps status, resolvedAt, resolvedBy', () => {
    const pending = req();
    const approved = resolveRequest(pending, true, 'user_admin', NOW);
    expect(approved.status).toBe('approved');
    expect(approved.resolvedAt).toBe(NOW);
    expect(approved.resolvedBy).toBe('user_admin');
    const declined = resolveRequest(pending, false, 'user_holder', NOW);
    expect(declined.status).toBe('declined');
  });
});

describe('toHolderRequestView', () => {
  it('exposes email + note but never the opaque requesterRef', () => {
    const view = toHolderRequestView(
      req({ pieceId: 'UL-7', note: 'we met at the studio' }),
    );
    expect(view.requesterEmail).toBe('buyer@example.com');
    expect(view.note).toBe('we met at the studio');
    expect(JSON.stringify(view)).not.toContain('user_requester');
    expect('requesterRef' in view).toBe(false);
    expect('status' in view).toBe(false);
  });

  it('exposes requesterEmailVerified and source so the holder UI can label a machine-asserted email', () => {
    const bridged = toHolderRequestView(
      req({ pieceId: 'UL-7', source: 'bridge', requesterEmailVerified: false }),
    );
    expect(bridged.source).toBe('bridge');
    expect(bridged.requesterEmailVerified).toBe(false);

    const ordinary = toHolderRequestView(
      req({ pieceId: 'UL-7', source: 'user', requesterEmailVerified: true }),
    );
    expect(ordinary.source).toBe('user');
    expect(ordinary.requesterEmailVerified).toBe(true);
  });

  it('omits requesterEmailVerified/source entirely for a legacy row that never had them', () => {
    const legacy = req({ pieceId: 'UL-7' });
    delete (legacy as Partial<ClaimRequest>).source;
    delete (legacy as Partial<ClaimRequest>).requesterEmailVerified;
    const view = toHolderRequestView(legacy);
    expect('source' in view).toBe(false);
    expect('requesterEmailVerified' in view).toBe(false);
  });
});
