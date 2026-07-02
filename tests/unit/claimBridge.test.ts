/**
 * Unit suite for the contested-claim bridge (functions/api/atlas/claim-bridge.ts)
 * and the bridge-facing hardening added to utils/claimRequests.ts.
 *
 * The endpoint itself needs a Workers runtime (HMAC verification, R2 reads/
 * writes) that this suite deliberately does not stand up — see
 * tests/unit/saleBridge.test.ts for the sibling M4 bridge's equivalent split.
 * What IS pure and unit-testable, and covered here:
 *
 *   - parseBridgeBody: the whitelist body validator claim-bridge.ts exports.
 *   - The provenance the bridge stamps on every request it plans: calling
 *     planClaimRequest with { source: 'bridge', requesterEmailVerified: false }
 *     — exactly what onRequestPost does inside its mutateClaimRequests
 *     closure — and confirming those fields land on the stored ClaimRequest
 *     and survive into the holder-facing view.
 *   - planClaimRequest's provenance DEFAULTS for the ordinary user path
 *     (source 'user', requesterEmailVerified true) when the caller doesn't
 *     override them, mirroring request-claim.ts.
 *   - The email-keyed open-request cap: the bridge asserts requesterRef
 *     itself (nothing here has verified it), so a hostile sender could mint
 *     a fresh ref per call to blow past the ref-keyed cap alone. The
 *     email-keyed cap must catch that even when every request uses a
 *     distinct requesterRef.
 */
import { describe, expect, it } from 'vitest';
import { parseBridgeBody } from '../../functions/api/atlas/claim-bridge';
import {
  CLAIM_REQUEST_NOTE_MAX,
  MAX_OPEN_REQUESTS_PER_REQUESTER,
  planClaimRequest,
  toHolderRequestView,
} from '../../utils/claimRequests';
import type { ClaimRequest } from '../../types';

const NOW = '2026-07-02T12:00:00.000Z';

// ---------- parseBridgeBody ----------

describe('parseBridgeBody', () => {
  it('accepts a valid bridge payload', () => {
    const r = parseBridgeBody({
      pieceId: 'UL-7',
      editionNumber: 2,
      requesterRef: 'ext-buyer-1',
      requesterEmail: 'buyer@example.com',
      note: 'Sold via adrianrasmussen.com checkout',
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({
        input: {
          pieceId: 'UL-7',
          editionNumber: 2,
          note: 'Sold via adrianrasmussen.com checkout',
        },
        requesterRef: 'ext-buyer-1',
        requesterEmail: 'buyer@example.com',
      });
    }
  });

  it('rejects unknown fields — the receiver decides what a ClaimRequest contains', () => {
    expect(
      parseBridgeBody({
        pieceId: 'UL-7',
        requesterRef: 'ext-buyer-1',
        requesterEmail: 'buyer@example.com',
        status: 'approved', // not accepted from the sender, ever
      }).ok,
    ).toBe(false);
  });

  it('rejects a missing pieceId, requesterRef, or a malformed requesterEmail', () => {
    expect(
      parseBridgeBody({ requesterRef: 'x', requesterEmail: 'a@b.com' }).ok,
    ).toBe(false);
    expect(
      parseBridgeBody({ pieceId: 'UL-7', requesterEmail: 'a@b.com' }).ok,
    ).toBe(false);
    expect(
      parseBridgeBody({ pieceId: 'UL-7', requesterRef: 'x', requesterEmail: 'not-an-email' }).ok,
    ).toBe(false);
  });

  it('rejects an oversized note and a non-integer editionNumber', () => {
    expect(
      parseBridgeBody({
        pieceId: 'UL-7',
        requesterRef: 'x',
        requesterEmail: 'a@b.com',
        note: 'x'.repeat(CLAIM_REQUEST_NOTE_MAX + 1),
      }).ok,
    ).toBe(false);
    expect(
      parseBridgeBody({
        pieceId: 'UL-7',
        requesterRef: 'x',
        requesterEmail: 'a@b.com',
        editionNumber: -1,
      }).ok,
    ).toBe(false);
  });

  it('drops a blank note and rejects a non-object body', () => {
    const r = parseBridgeBody({
      pieceId: 'UL-7',
      requesterRef: 'x',
      requesterEmail: 'a@b.com',
      note: '   ',
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.input.note).toBeUndefined();
    expect(parseBridgeBody(null).ok).toBe(false);
    expect(parseBridgeBody('nope').ok).toBe(false);
  });
});

// ---------- Bridge provenance on planClaimRequest ----------

describe('planClaimRequest — bridge provenance', () => {
  it('stamps source "bridge" and requesterEmailVerified false, exactly as claim-bridge.ts calls it', () => {
    const r = planClaimRequest([], {
      input: { pieceId: 'UL-7' },
      requesterRef: 'ext-buyer-1',
      requesterEmail: 'buyer@example.com',
      steward: undefined,
      now: NOW,
      source: 'bridge',
      requesterEmailVerified: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.source).toBe('bridge');
      expect(r.value.requesterEmailVerified).toBe(false);
    }
  });

  it('a bridge-asserted email surfaces unverified in the holder-facing view — asserted identity is never presented as verified', () => {
    const r = planClaimRequest([], {
      input: { pieceId: 'UL-7' },
      requesterRef: 'ext-buyer-1',
      requesterEmail: 'buyer@example.com',
      steward: undefined,
      now: NOW,
      source: 'bridge',
      requesterEmailVerified: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const view = toHolderRequestView(r.value);
      expect(view.source).toBe('bridge');
      expect(view.requesterEmailVerified).toBe(false);
    }
  });

  it('defaults to source "user" and requesterEmailVerified true for the ordinary self-serve path (request-claim.ts)', () => {
    const r = planClaimRequest([], {
      input: { pieceId: 'UL-7' },
      requesterRef: 'user_requester',
      requesterEmail: 'buyer@example.com',
      steward: undefined,
      now: NOW,
      source: 'user',
      requesterEmailVerified: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.source).toBe('user');
      expect(r.value.requesterEmailVerified).toBe(true);
    }
  });
});

// ---------- Bridge abuse: email-keyed cap ----------

function bridgeRequest(overrides: Partial<ClaimRequest> = {}): ClaimRequest {
  return {
    id: `req-${Math.random().toString(36).slice(2)}`,
    pieceId: `UL-${Math.random().toString(36).slice(2)}`, // distinct piece per row so dedupe never triggers
    requesterRef: `ext-${Math.random().toString(36).slice(2)}`,
    requesterEmail: 'spammer@example.com',
    createdAt: NOW,
    status: 'pending',
    routedTo: 'admin',
    source: 'bridge',
    requesterEmailVerified: false,
    ...overrides,
  };
}

describe('planClaimRequest — email-keyed abuse cap (bridge hardening)', () => {
  it('caps open requests by requesterEmail even when every request uses a DISTINCT requesterRef', () => {
    // A hostile sender mints a fresh requesterRef per call (nothing here has
    // verified it), but keeps reusing one mailbox. The ref-keyed cap alone
    // would never trip; the email-keyed cap must.
    const open = Array.from({ length: MAX_OPEN_REQUESTS_PER_REQUESTER }, () =>
      bridgeRequest(),
    );
    const uniqueRefs = new Set(open.map((r) => r.requesterRef));
    expect(uniqueRefs.size).toBe(MAX_OPEN_REQUESTS_PER_REQUESTER); // confirm refs really differ

    const r = planClaimRequest(open, {
      input: { pieceId: 'UL-fresh-piece' },
      requesterRef: `ext-${Math.random().toString(36).slice(2)}`, // yet another fresh ref
      requesterEmail: 'spammer@example.com', // same mailbox as every open row
      steward: undefined,
      now: NOW,
      source: 'bridge',
      requesterEmailVerified: false,
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error).toContain('at most');
  });

  it('email matching is case-insensitive', () => {
    const open = Array.from({ length: MAX_OPEN_REQUESTS_PER_REQUESTER }, () =>
      bridgeRequest({ requesterEmail: 'Spammer@Example.com' }),
    );
    const r = planClaimRequest(open, {
      input: { pieceId: 'UL-fresh-piece' },
      requesterRef: 'ext-yet-another',
      requesterEmail: 'spammer@example.com',
      steward: undefined,
      now: NOW,
      source: 'bridge',
      requesterEmailVerified: false,
    });
    expect(r.ok).toBe(false);
  });

  it('does not cap a different requester email, even at the same volume', () => {
    const open = Array.from({ length: MAX_OPEN_REQUESTS_PER_REQUESTER }, () =>
      bridgeRequest({ requesterEmail: 'someone-else@example.com' }),
    );
    const r = planClaimRequest(open, {
      input: { pieceId: 'UL-fresh-piece' },
      requesterRef: 'ext-yet-another',
      requesterEmail: 'spammer@example.com',
      steward: undefined,
      now: NOW,
      source: 'bridge',
      requesterEmailVerified: false,
    });
    expect(r.ok).toBe(true);
  });

  it('resolved (non-pending) requests never count against the email cap', () => {
    const closed = Array.from({ length: MAX_OPEN_REQUESTS_PER_REQUESTER + 2 }, () =>
      bridgeRequest({ status: 'declined' }),
    );
    const r = planClaimRequest(closed, {
      input: { pieceId: 'UL-fresh-piece' },
      requesterRef: 'ext-yet-another',
      requesterEmail: 'spammer@example.com',
      steward: undefined,
      now: NOW,
      source: 'bridge',
      requesterEmailVerified: false,
    });
    expect(r.ok).toBe(true);
  });

  it('the ref-keyed cap still applies independently for a sender that reuses one ref', () => {
    const open = Array.from({ length: MAX_OPEN_REQUESTS_PER_REQUESTER }, (_, i) =>
      bridgeRequest({ requesterRef: 'ext-same-ref', requesterEmail: `u${i}@example.com` }),
    );
    const r = planClaimRequest(open, {
      input: { pieceId: 'UL-fresh-piece' },
      requesterRef: 'ext-same-ref',
      requesterEmail: 'u-final@example.com',
      steward: undefined,
      now: NOW,
      source: 'bridge',
      requesterEmailVerified: false,
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error).toContain('at most');
  });
});
