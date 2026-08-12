/**
 * The claim ceremony's one-request first-dream publication (design ruling,
 * 2026-07-12).
 *
 * In the ceremony a single choice governs both the light and the dream:
 * "Show on the atlas" lights the marker publicly AND publishes the written
 * dream to the piece's public card, in the same motion. The server side of
 * that motion (functions/api/atlas/_firstDream.ts publishFirstDreamsOnClaim)
 * is a thin composition over two already-tested pure layers:
 *
 *   consent.applyConsentToSteward       stores the dream as a pending first
 *                                       inscription during Phase B,
 *   inscriptions.planPendingConversion  converts it to a real 'intention'
 *                                       row plus an `inscribed` commitment,
 *   intentions.checkShareEligibility /
 *   planShareIntention                  mark the intention shared,
 *   ledgerProjection.toPublicState      carries the dream on the public card.
 *
 * D1/R2 I/O (the endpoint's mutators plus regen) is tested elsewhere; this
 * pins the guarantee that binds the whole path: a PUBLIC map choice carrying
 * a dream surfaces that dream on the piece's public card in one request, and
 * a PRIVATE choice leaves the dream pending and the card bare.
 */
import { describe, expect, it } from 'vitest';
import type { CityCentroid, LedgerEvent, StewardRecord } from '../../types';
import { applyConsentToSteward, nextConsentState } from '../../utils/consent';
import {
  pendingInscriptionId,
  planPendingConversion,
} from '../../utils/inscriptions';
import type { InscriptionRow } from '../../utils/inscriptions';
import {
  checkShareEligibility,
  liveIntentionsByKey,
  planShareIntention,
  toDisplayText,
} from '../../utils/intentions';
import { projectAll, toPublicState } from '../../utils/ledgerProjection';

const NOW = '2026-07-12T12:00:00.000Z';
const USER = 'user_collector';

function stewardRecord(overrides: Partial<StewardRecord> = {}): StewardRecord {
  return {
    pieceId: 'UL-1',
    email: 'collector@example.com',
    clerkUserId: USER,
    issuedAt: '2026-01-01T00:00:00.000Z',
    outreachStatus: 'invited',
    ...overrides,
  };
}

/** The row convertPendingFirstInscription inserts for a pending dream:
 *  kind 'intention', authored by the steward, unsealed, unerased. */
function convertedRow(record: StewardRecord): InscriptionRow {
  const pending = record.pendingFirstInscription!;
  return {
    id: pendingInscriptionId(record.pieceId, record.editionNumber, record.clerkUserId!),
    piece_id: record.pieceId,
    edition_number: record.editionNumber ?? 0,
    author_user_id: record.clerkUserId!,
    kind: 'intention',
    body: pending.text,
    body_hash: 'c'.repeat(64),
    content_salt: 'd'.repeat(32),
    sealed_until: null,
    created_at: pending.createdAt,
    erased_at: null,
  };
}

const lisbon: CityCentroid = {
  id: 'lisbon-pt',
  city: 'Lisbon',
  country: 'Portugal',
  countryCode: 'PT',
  lat: 38.7,
  lng: -9.1,
};

function meta() {
  return new Map([
    ['UL-1', { series: 'Universal Language', category: 'Multidimensional Art' }],
  ]);
}

let counter = 0;
function evt(overrides: Partial<LedgerEvent> = {}): LedgerEvent {
  counter += 1;
  return {
    id: `evt-${counter}`,
    pieceId: 'UL-1',
    type: 'created',
    date: `2026-02-${String(counter).padStart(2, '0')}T00:00:00.000Z`,
    cityId: null,
    actor: 'admin',
    prevHash: null,
    hash: `hash-${counter}`,
    ...overrides,
  };
}

/** A publicly-mapped, claimed piece: the state after a Phase B claim with a
 *  public Ring 2 choice. */
function publicClaimedChain(): LedgerEvent[] {
  return [
    evt({ pieceId: 'UL-1', type: 'created' }),
    evt({ pieceId: 'UL-1', type: 'placed', cityId: 'lisbon-pt' }),
    evt({ pieceId: 'UL-1', type: 'claimed' }),
  ];
}

describe('one-request first-dream publication', () => {
  it('a public map choice carrying a dream surfaces it on the public card in one request', () => {
    // Phase B stores the dream as a pending first inscription.
    const consent = nextConsentState({ ring2MapPresence: true }, undefined, USER, NOW);
    const record = applyConsentToSteward(stewardRecord(), consent, 'May it hold my family close.');
    expect(record.pendingFirstInscription?.text).toBe('May it hold my family close.');

    // The same request converts it (the claim already appended a `claimed`
    // event, so the chain is ready and a real inscription plus commitment
    // lands).
    const chain = publicClaimedChain();
    const plan = planPendingConversion(record, false, chain);
    expect(plan).not.toBeNull();
    expect(plan!.insertRow).toBe(true);
    expect(plan!.appendEvent).toBe(true);
    expect(plan!.clearField).toBe(true);
    expect(plan!.inscriptionId).toBe(
      pendingInscriptionId(record.pieceId, record.editionNumber, USER),
    );

    // Then it marks the intention shared: eligible, one live entry per piece.
    const row = convertedRow(record);
    const eligibility = checkShareEligibility(row, USER, chain, NOW);
    expect(eligibility.ok).toBe(true);

    const shared = planShareIntention(
      [],
      {
        pieceId: record.pieceId,
        editionNumber: record.editionNumber,
        inscriptionId: plan!.inscriptionId,
        text: toDisplayText(row.body!),
      },
      NOW,
    );
    expect(shared).toHaveLength(1);
    expect(shared[0].status).toBe('live');

    // The regenerated public state carries the dream immediately.
    const records = projectAll(chain);
    const intentions = liveIntentionsByKey(shared);
    const state = toPublicState(records, meta(), [lisbon], undefined, intentions);
    const piece = state.pieces.find((p) => p.pieceId === 'UL-1');
    expect(piece?.intention).toBe('May it hold my family close.');
  });

  it('a private map choice leaves the dream pending and the card bare', () => {
    // Phase B still stores the dream, but the private choice means the claim
    // never runs the publication: no conversion, no shared entry.
    const consent = nextConsentState({ ring2MapPresence: false }, undefined, USER, NOW);
    const record = applyConsentToSteward(stewardRecord(), consent, 'A dream held close.');
    expect(record.pendingFirstInscription?.text).toBe('A dream held close.');

    // A private piece is absent from the public projection entirely, so it
    // has no card to carry a dream; the withdrawn/private discipline holds.
    const chain = [
      evt({ pieceId: 'UL-1', type: 'created' }),
      evt({ pieceId: 'UL-1', type: 'placed', cityId: 'lisbon-pt' }),
      evt({ pieceId: 'UL-1', type: 'claimed' }),
      evt({ pieceId: 'UL-1', type: 'withdrawn' }),
    ];
    const records = projectAll(chain);
    const state = toPublicState(records, meta(), [lisbon], undefined, undefined);
    expect(state.pieces.find((p) => p.pieceId === 'UL-1')).toBeUndefined();
  });
});
