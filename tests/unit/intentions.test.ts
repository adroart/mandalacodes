/**
 * Shared intentions — the map of dreams (M6, Lens 2).
 *
 * Pins the pure logic in utils/intentions.ts plus its composition into the
 * public projection (utils/ledgerProjection.ts toPublicState):
 *   - share eligibility: wrong kind, sealed, erased, not-author all reject;
 *     an eligible 'intention' from its own author passes,
 *   - 1200-char display cut,
 *   - one live entry per piece (sharing a second inscription supersedes the
 *     first; re-sharing the same inscription revives it in place),
 *   - withdraw is a quiet no-op when nothing is live,
 *   - tending actions (keep / rehome / withdraw) and their status/tended
 *     transitions,
 *   - public-state composition: intention appears ONLY on live entries for
 *     pieces that already qualify for the public pieces array — sharing a
 *     dream never grants a private piece a public surface.
 */
import { describe, expect, it } from 'vitest';
import type { CityCentroid, LedgerEvent, SharedIntention } from '../../types';
import {
  checkShareEligibility,
  intentionChainKey,
  liveIntentionsByKey,
  planShareIntention,
  planTendIntention,
  planWithdrawIntention,
  SHARED_INTENTION_DISPLAY_MAX,
  toDisplayText,
} from '../../utils/intentions';
import type { ShareEligibilityFailure } from '../../utils/intentions';
import type { InscriptionRow } from '../../utils/inscriptions';
import { projectAll, toPublicState } from '../../utils/ledgerProjection';

const NOW = '2026-07-04T12:00:00.000Z';
const AUTHOR = 'user_steward_a';
const OTHER = 'user_steward_b';

function row(overrides: Partial<InscriptionRow> = {}): InscriptionRow {
  return {
    id: 'ins-1',
    piece_id: 'UL-1',
    edition_number: 0,
    author_clerk_id: AUTHOR,
    kind: 'intention',
    body: 'May this piece hold our family together.',
    body_hash: 'a'.repeat(64),
    content_salt: 'b'.repeat(32),
    sealed_until: null,
    created_at: '2026-02-01T00:00:00.000Z',
    erased_at: null,
    ...overrides,
  };
}

function entry(overrides: Partial<SharedIntention> = {}): SharedIntention {
  return {
    id: 'sin-1',
    pieceId: 'UL-1',
    editionNumber: undefined,
    inscriptionId: 'ins-1',
    text: 'May this piece hold our family together.',
    sharedAt: NOW,
    status: 'live',
    ...overrides,
  };
}

// ---------- checkShareEligibility ----------

describe('checkShareEligibility', () => {
  it('accepts an intention authored by the requester, unsealed, not erased', () => {
    const result = checkShareEligibility(row(), AUTHOR, [], NOW);
    expect(result.ok).toBe(true);
  });

  it('rejects when the row is missing', () => {
    const result = checkShareEligibility(null, AUTHOR, [], NOW);
    expect(result.ok).toBe(false);
    expect((result as ShareEligibilityFailure).error).toBe('not-found');
  });

  it('rejects a non-intention kind — words about a business/place/name are not sortable here', () => {
    const result = checkShareEligibility(row({ kind: 'story' }), AUTHOR, [], NOW);
    expect(result.ok).toBe(false);
    expect((result as ShareEligibilityFailure).error).toBe('wrong-kind');
  });

  it('rejects when the requester did not author the entry', () => {
    const result = checkShareEligibility(row(), OTHER, [], NOW);
    expect(result.ok).toBe(false);
    expect((result as ShareEligibilityFailure).error).toBe('not-author');
  });

  it('rejects an erased entry', () => {
    const result = checkShareEligibility(
      row({ erased_at: '2026-03-01T00:00:00.000Z', body: null }),
      AUTHOR,
      [],
      NOW,
    );
    expect(result.ok).toBe(false);
    expect((result as ShareEligibilityFailure).error).toBe('erased');
  });

  it('rejects a date-sealed entry still closed', () => {
    const result = checkShareEligibility(
      row({ sealed_until: '2030-01-01T00:00:00.000Z' }),
      AUTHOR,
      [],
      NOW,
    );
    expect(result.ok).toBe(false);
    expect((result as ShareEligibilityFailure).error).toBe('sealed');
  });

  it('accepts a date-sealed entry once the seal date has passed', () => {
    const result = checkShareEligibility(
      row({ sealed_until: '2020-01-01T00:00:00.000Z' }),
      AUTHOR,
      [],
      NOW,
    );
    expect(result.ok).toBe(true);
  });

  it('rejects a transfer-sealed entry with no transfer on the chain yet', () => {
    const sealedRow = row({ sealed_until: 'transfer' });
    const result = checkShareEligibility(sealedRow, AUTHOR, [], NOW);
    expect(result.ok).toBe(false);
    expect((result as ShareEligibilityFailure).error).toBe('sealed');
  });
});

// ---------- toDisplayText ----------

describe('toDisplayText', () => {
  it('passes short text through unchanged (trimmed)', () => {
    expect(toDisplayText('  A short dream.  ')).toBe('A short dream.');
  });

  it('cuts at exactly 1200 characters', () => {
    const long = 'x'.repeat(1500);
    const cut = toDisplayText(long);
    expect(cut.length).toBe(SHARED_INTENTION_DISPLAY_MAX);
    expect(cut).toBe('x'.repeat(1200));
  });

  it('passes a long paragraph-scale dream through when under the cap', () => {
    const long = 'word '.repeat(200); // 1000 chars, under the 1200 cap
    const cut = toDisplayText(long);
    expect(cut).toBe(long.trim());
    expect(cut.length).toBeLessThanOrEqual(SHARED_INTENTION_DISPLAY_MAX);
  });

  it('never returns more than the private inscription body — a fragment, never the whole entry', () => {
    const long = 'word '.repeat(400); // 2000 chars, over the cap
    const cut = toDisplayText(long);
    expect(cut.length).toBeLessThanOrEqual(SHARED_INTENTION_DISPLAY_MAX);
    expect(long.startsWith(cut)).toBe(true);
  });
});

// ---------- planShareIntention — one live entry per piece ----------

describe('planShareIntention', () => {
  it('creates a new live entry when none exists yet', () => {
    const next = planShareIntention(
      [],
      { pieceId: 'UL-1', inscriptionId: 'ins-1', text: 'A dream.' },
      NOW,
    );
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      pieceId: 'UL-1',
      inscriptionId: 'ins-1',
      text: 'A dream.',
      status: 'live',
    });
  });

  it('revives the SAME inscription in place when shared again', () => {
    const current = [
      entry({ status: 'withdrawn', text: 'Old text.', tended: true, tendedAt: NOW }),
    ];
    const next = planShareIntention(
      current,
      { pieceId: 'UL-1', inscriptionId: 'ins-1', text: 'New text.' },
      NOW,
    );
    expect(next).toHaveLength(1);
    expect(next[0].status).toBe('live');
    expect(next[0].text).toBe('New text.');
    expect(next[0].tended).toBe(false);
    expect(next[0].tendedAt).toBeUndefined();
    // Revives the existing id rather than minting a new one.
    expect(next[0].id).toBe('sin-1');
  });

  it('supersedes a different live entry on the SAME piece — never two dreams for one piece', () => {
    const current = [entry({ id: 'sin-old', inscriptionId: 'ins-old', status: 'live' })];
    const next = planShareIntention(
      current,
      { pieceId: 'UL-1', inscriptionId: 'ins-new', text: 'A different dream.' },
      NOW,
    );
    expect(next).toHaveLength(2);
    const old = next.find((e) => e.id === 'sin-old');
    const fresh = next.find((e) => e.inscriptionId === 'ins-new');
    expect(old?.status).toBe('withdrawn');
    expect(fresh?.status).toBe('live');
  });

  it('does not disturb a live entry on a DIFFERENT piece', () => {
    const current = [entry({ id: 'sin-other', pieceId: 'UL-2', inscriptionId: 'ins-other' })];
    const next = planShareIntention(
      current,
      { pieceId: 'UL-1', inscriptionId: 'ins-1', text: 'A dream.' },
      NOW,
    );
    const other = next.find((e) => e.id === 'sin-other');
    expect(other?.status).toBe('live');
  });

  it('keys by (pieceId, editionNumber) — sibling editions do not supersede each other', () => {
    const current = [
      entry({ id: 'sin-ed1', pieceId: 'UL-1', editionNumber: 1, inscriptionId: 'ins-ed1' }),
    ];
    const next = planShareIntention(
      current,
      { pieceId: 'UL-1', editionNumber: 2, inscriptionId: 'ins-ed2', text: 'A dream.' },
      NOW,
    );
    expect(next.find((e) => e.id === 'sin-ed1')?.status).toBe('live');
    expect(next.find((e) => e.inscriptionId === 'ins-ed2')?.status).toBe('live');
  });
});

// ---------- planWithdrawIntention ----------

describe('planWithdrawIntention', () => {
  it('withdraws the live entry for a given inscription', () => {
    const current = [entry({ status: 'live' })];
    const next = planWithdrawIntention(current, 'ins-1');
    expect(next[0].status).toBe('withdrawn');
  });

  it('is a quiet no-op when nothing is live for that inscription', () => {
    const current = [entry({ status: 'withdrawn' })];
    const next = planWithdrawIntention(current, 'ins-1');
    expect(next).toEqual(current);
  });

  it('is a quiet no-op when the inscription has never been shared', () => {
    expect(planWithdrawIntention([], 'ins-never')).toEqual([]);
  });
});

// ---------- planTendIntention ----------

describe('planTendIntention', () => {
  it('keep: marks tended, leaves status alone', () => {
    const current = [entry({ status: 'live' })];
    const { next, entry: found } = planTendIntention(current, 'sin-1', 'keep', NOW);
    expect(next[0].status).toBe('live');
    expect(next[0].tended).toBe(true);
    expect(next[0].tendedAt).toBe(NOW);
    expect(found?.status).toBe('live'); // pre-tend snapshot
  });

  it('rehome: sets status rehomed + tended', () => {
    const current = [entry({ status: 'live' })];
    const { next } = planTendIntention(current, 'sin-1', 'rehome', NOW);
    expect(next[0].status).toBe('rehomed');
    expect(next[0].tended).toBe(true);
  });

  it('withdraw: sets status withdrawn + tended', () => {
    const current = [entry({ status: 'live' })];
    const { next } = planTendIntention(current, 'sin-1', 'withdraw', NOW);
    expect(next[0].status).toBe('withdrawn');
    expect(next[0].tended).toBe(true);
  });

  it('returns entry: null and an unchanged array for an unknown id', () => {
    const current = [entry()];
    const { next, entry: found } = planTendIntention(current, 'sin-missing', 'keep', NOW);
    expect(found).toBeNull();
    expect(next).toEqual(current);
  });

  it('the pre-tend snapshot lets the caller decide whether a rehome letter is owed', () => {
    // Already withdrawn — a rehome here still marks it tended, but the
    // caller (functions/api/atlas/intentions/tend.ts) checks entry.status
    // BEFORE the transition to decide whether a letter was actually owed.
    const current = [entry({ status: 'withdrawn' })];
    const { entry: found } = planTendIntention(current, 'sin-1', 'rehome', NOW);
    expect(found?.status).toBe('withdrawn');
  });
});

// ---------- liveIntentionsByKey ----------

describe('liveIntentionsByKey', () => {
  it('maps only live entries, keyed by pieceId:editionNumber', () => {
    const map = liveIntentionsByKey([
      entry({ pieceId: 'UL-1', editionNumber: undefined, text: 'Live one.' }),
      entry({ id: 'sin-2', pieceId: 'UL-2', status: 'withdrawn', text: 'Gone.' }),
      entry({ id: 'sin-3', pieceId: 'UL-3', status: 'rehomed', text: 'Moved.' }),
    ]);
    expect(map.get(intentionChainKey('UL-1', undefined))).toBe('Live one.');
    expect(map.has(intentionChainKey('UL-2', undefined))).toBe(false);
    expect(map.has(intentionChainKey('UL-3', undefined))).toBe(false);
  });
});

// ---------- Public-state composition ----------

const lisbon: CityCentroid = {
  id: 'lisbon-pt',
  city: 'Lisbon',
  country: 'Portugal',
  countryCode: 'PT',
  lat: 38.7,
  lng: -9.1,
};

let counter = 0;
function evt(overrides: Partial<LedgerEvent> = {}): LedgerEvent {
  counter += 1;
  return {
    id: `evt-${counter}`,
    pieceId: 'UL-1',
    type: 'created',
    date: `2026-01-${String(counter).padStart(2, '0')}T00:00:00.000Z`,
    cityId: null,
    actor: 'admin',
    prevHash: null,
    hash: `hash-${counter}`,
    ...overrides,
  };
}

function meta() {
  return new Map([
    ['UL-1', { series: 'Universal Language', category: 'Multidimensional Art' }],
  ]);
}

describe('toPublicState — intention composition (M6, Lens 2)', () => {
  it('attaches the live intention text to a publicly mapped piece', () => {
    const records = projectAll([
      evt({ pieceId: 'UL-1', type: 'created' }),
      evt({ pieceId: 'UL-1', type: 'placed', cityId: 'lisbon-pt' }),
      evt({ pieceId: 'UL-1', type: 'claimed' }),
    ]);
    const intentions = liveIntentionsByKey([
      entry({ pieceId: 'UL-1', text: 'A shared dream.' }),
    ]);
    const state = toPublicState(records, meta(), [lisbon], undefined, intentions);
    const p = state.pieces.find((x) => x.pieceId === 'UL-1');
    expect(p?.intention).toBe('A shared dream.');
  });

  it('omits intention entirely for a piece with no live entry (default: absent, not empty string)', () => {
    const records = projectAll([
      evt({ pieceId: 'UL-1', type: 'created' }),
      evt({ pieceId: 'UL-1', type: 'placed', cityId: 'lisbon-pt' }),
      evt({ pieceId: 'UL-1', type: 'claimed' }),
    ]);
    const state = toPublicState(records, meta(), [lisbon], undefined, undefined);
    const p = state.pieces.find((x) => x.pieceId === 'UL-1');
    expect(p?.intention).toBeUndefined();
    expect(p && 'intention' in p).toBe(false);
  });

  it('never surfaces an intention for a piece the public projection has already stripped (private/withdrawn)', () => {
    // Withdrawn → isPublic false. toPublicState only lists ring2-public
    // placed pieces in `pieces`, so a withdrawn piece is simply absent —
    // sharing a dream can never grant it a public surface through this door.
    const records = projectAll([
      evt({ pieceId: 'UL-1', type: 'created' }),
      evt({ pieceId: 'UL-1', type: 'placed', cityId: 'lisbon-pt' }),
      evt({ pieceId: 'UL-1', type: 'claimed' }),
      evt({ pieceId: 'UL-1', type: 'withdrawn' }),
    ]);
    const intentions = liveIntentionsByKey([
      entry({ pieceId: 'UL-1', text: 'A private dream that must never surface.' }),
    ]);
    const state = toPublicState(records, meta(), [lisbon], undefined, intentions);
    const p = state.pieces.find((x) => x.pieceId === 'UL-1');
    expect(p).toBeUndefined();
  });

  it('a rehomed/withdrawn shared-intention entry does not appear even though the piece is public', () => {
    const records = projectAll([
      evt({ pieceId: 'UL-1', type: 'created' }),
      evt({ pieceId: 'UL-1', type: 'placed', cityId: 'lisbon-pt' }),
      evt({ pieceId: 'UL-1', type: 'claimed' }),
    ]);
    const intentions = liveIntentionsByKey([
      entry({ pieceId: 'UL-1', status: 'rehomed', text: 'Tended away.' }),
    ]);
    const state = toPublicState(records, meta(), [lisbon], undefined, intentions);
    const p = state.pieces.find((x) => x.pieceId === 'UL-1');
    expect(p?.intention).toBeUndefined();
  });
});
