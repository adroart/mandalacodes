/**
 * Unit tests for components/atlas/ledgerRow.ts — the living ledger's shared row
 * grammar and filter logic (Part II.6, rulings 2 and 3). Pins the ruled status
 * lines, the state mapping, the search, and the kind labels so the filter bar
 * and every subsection compose the same way.
 */
import { describe, expect, it } from 'vitest';
import {
  atlasPieceToRow,
  cleanLedgerTitle,
  groupLedgerRows,
  ledgerKindLabel,
  ledgerStateLabel,
  ledgerStateOf,
  ledgerStatusLine,
  matchesSearch,
  matchesState,
  normFromCatalogStatus,
  sortLedgerRows,
  LEDGER_NO_PLACE_LABEL,
  type LedgerRow,
} from '../../components/atlas/ledgerRow';

function row(over: Partial<LedgerRow> = {}): LedgerRow {
  return {
    key: 'UL-1:0',
    pieceId: 'UL-1',
    title: 'A Piece',
    norm: 'placed',
    cityName: 'Lisbon',
    cityLabel: 'Lisbon, Portugal',
    onGlobe: true,
    ...over,
  };
}

describe('ledgerStatusLine — the ruled grammar', () => {
  it('placed reads "alive in {city}"', () => {
    expect(ledgerStatusLine(row({ norm: 'placed', cityName: 'Lisbon' }))).toBe(
      'alive in Lisbon',
    );
  });
  it('seeking reads "seeking ground"', () => {
    expect(ledgerStatusLine(row({ norm: 'seeking' }))).toBe('seeking ground');
  });
  it('at-rest reads "at rest with the artist"', () => {
    expect(ledgerStatusLine(row({ norm: 'at-rest' }))).toBe(
      'at rest with the artist',
    );
  });
  it('placed with no city falls back to "alive"', () => {
    expect(ledgerStatusLine(row({ norm: 'placed', cityName: undefined }))).toBe(
      'alive',
    );
  });
});

describe('ledgerStateOf — the three states', () => {
  it('seeking → created, waiting for someone', () => {
    expect(ledgerStateOf(row({ norm: 'seeking' }))).toBe('waiting-someone');
  });
  it('placed with a dream → dreams anchored', () => {
    expect(ledgerStateOf(row({ norm: 'placed', dream: 'to begin again' }))).toBe(
      'anchored',
    );
  });
  it('placed with no dream → waiting for a dream', () => {
    expect(ledgerStateOf(row({ norm: 'placed', dream: undefined }))).toBe(
      'waiting-dream',
    );
  });
  it('at-rest → waiting for a dream', () => {
    expect(ledgerStateOf(row({ norm: 'at-rest' }))).toBe('waiting-dream');
  });
});

describe('matchesState', () => {
  it('all matches everything', () => {
    expect(matchesState(row({ norm: 'seeking' }), 'all')).toBe(true);
  });
  it('narrows to the named state', () => {
    const anchored = row({ norm: 'placed', dream: 'a dream' });
    expect(matchesState(anchored, 'anchored')).toBe(true);
    expect(matchesState(anchored, 'waiting-dream')).toBe(false);
  });
});

describe('matchesSearch — title, city, dream, case-insensitive', () => {
  const r = row({
    title: 'Earth Breath',
    cityLabel: 'Lisbon, Portugal',
    dream: 'that whoever stands before it remembers to begin again',
  });
  it('empty query matches', () => {
    expect(matchesSearch(r, '   ')).toBe(true);
  });
  it('matches on title', () => {
    expect(matchesSearch(r, 'earth')).toBe(true);
  });
  it('matches on city', () => {
    expect(matchesSearch(r, 'lisbon')).toBe(true);
  });
  it('matches on dream text', () => {
    expect(matchesSearch(r, 'begin again')).toBe(true);
  });
  it('misses when nothing contains it', () => {
    expect(matchesSearch(r, 'jupiter')).toBe(false);
  });
});

describe('ledgerKindLabel — exact labels', () => {
  it('maps the fixed kinds verbatim', () => {
    expect(ledgerKindLabel('sixty-four')).toBe('the sixty-four');
    expect(ledgerKindLabel('mandala')).toBe('mandalas');
    expect(ledgerKindLabel('signature')).toBe('signature pieces');
    expect(ledgerKindLabel('jewelry')).toBe('jewelry');
  });
  it('passes an extra kind through', () => {
    expect(ledgerKindLabel('sculpture')).toBe('sculpture');
  });
});

describe('cleanLedgerTitle', () => {
  it('strips the trailing edition suffix', () => {
    expect(cleanLedgerTitle("Earth's Breath - 1")).toBe("Earth's Breath");
    expect(cleanLedgerTitle('Sol Star - 11')).toBe('Sol Star');
  });
  it('leaves a plain title alone', () => {
    expect(cleanLedgerTitle('Ancestors Bloom')).toBe('Ancestors Bloom');
  });
});

describe('atlasPieceToRow + normFromCatalogStatus', () => {
  it('builds a placed row with an inline dream', () => {
    const r = atlasPieceToRow({
      key: 'UL-114:0',
      pieceId: 'UL-114',
      title: 'Sol Star - 11',
      status: 'placed',
      cityName: 'Lisbon',
      cityLabel: 'Lisbon, Portugal',
      intention: '  a quiet dream  ',
    });
    expect(r.title).toBe('Sol Star');
    expect(r.norm).toBe('placed');
    expect(r.dream).toBe('a quiet dream');
    expect(r.onGlobe).toBe(true);
  });
  it('maps catalog statuses to the normalized vocabulary', () => {
    expect(normFromCatalogStatus('with-keeper')).toBe('placed');
    expect(normFromCatalogStatus('available')).toBe('seeking');
    expect(normFromCatalogStatus('with-artist')).toBe('at-rest');
  });
  it('carries the sort keys through', () => {
    const r = atlasPieceToRow({
      key: 'UL-1:0',
      pieceId: 'UL-1',
      title: 'A Piece',
      status: 'placed',
      cardNumber: 7,
      placedAt: '2025-03-08',
      claimOrdinal: 9,
    });
    expect(r.cardNumber).toBe(7);
    expect(r.placedAt).toBe('2025-03-08');
    expect(r.claimOrdinal).toBe(9);
  });
});

/* ─── Arrange: sorting and grouping the record ───────────────────────────── */

describe('sortLedgerRows', () => {
  const a = row({ key: 'a', title: 'Zephyr', cityName: 'Amsterdam', placedAt: '2024-01-01' });
  const b = row({ key: 'b', title: 'Anchor', cityName: 'Zurich', placedAt: '2025-06-01' });
  const c = row({ key: 'c', title: 'Middle', cityName: undefined, placedAt: undefined });

  it('record order is the identity, and never mutates the input', () => {
    const input = [a, b, c];
    const out = sortLedgerRows(input, 'record');
    expect(out.map((r) => r.key)).toEqual(['a', 'b', 'c']);
    expect(out).not.toBe(input);
  });
  it('title sorts a to z', () => {
    expect(sortLedgerRows([a, b, c], 'title').map((r) => r.key)).toEqual([
      'b',
      'c',
      'a',
    ]);
  });
  it('place sorts by city, and a piece with no city reads last', () => {
    expect(sortLedgerRows([b, c, a], 'place').map((r) => r.key)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
  it('recent puts the newest anchoring first and the undated last', () => {
    expect(sortLedgerRows([a, c, b], 'recent').map((r) => r.key)).toEqual([
      'b',
      'a',
      'c',
    ]);
  });
  it('recent tiebreaks on the claim ordinal, newest claim first', () => {
    const first = row({ key: 'first', placedAt: '2025-01-01', claimOrdinal: 1 });
    const ninth = row({ key: 'ninth', placedAt: '2025-01-01', claimOrdinal: 9 });
    expect(sortLedgerRows([first, ninth], 'recent').map((r) => r.key)).toEqual([
      'ninth',
      'first',
    ]);
  });
});

describe('groupLedgerRows', () => {
  const anchored = row({ key: 'anchored', norm: 'placed', dream: 'a dream', cityName: 'Lisbon' });
  const seeking = row({ key: 'seeking', norm: 'seeking', cityName: undefined });
  const quiet = row({ key: 'quiet', norm: 'placed', dream: undefined, cityName: 'Berlin' });

  it('one list keeps everything under a single section', () => {
    const [only] = groupLedgerRows([anchored, seeking, quiet], 'none', 'record');
    expect(only.rows).toHaveLength(3);
  });
  it('one list of nothing is no section at all', () => {
    expect(groupLedgerRows([], 'none', 'record')).toEqual([]);
  });
  it('by state reads the living first and drops empty states', () => {
    const out = groupLedgerRows([quiet, seeking, anchored], 'state', 'record');
    expect(out.map((s) => s.label)).toEqual([
      ledgerStateLabel('anchored'),
      ledgerStateLabel('waiting-someone'),
      ledgerStateLabel('waiting-dream'),
    ]);
    expect(groupLedgerRows([anchored], 'state', 'record')).toHaveLength(1);
  });
  it('by place is alphabetical with the unplaced last', () => {
    const out = groupLedgerRows([anchored, seeking, quiet], 'place', 'record');
    expect(out.map((s) => s.label)).toEqual([
      'Berlin',
      'Lisbon',
      LEDGER_NO_PLACE_LABEL,
    ]);
  });
  it('gives every section a stable, unique anchor id', () => {
    const out = groupLedgerRows([anchored, seeking, quiet], 'place', 'record');
    const ids = out.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('place-berlin');
  });
  it('sorts inside each section', () => {
    const early = row({ key: 'early', cityName: 'Lisbon', title: 'Zed' });
    const late = row({ key: 'late', cityName: 'Lisbon', title: 'Alpha' });
    const [lisbon] = groupLedgerRows([early, late], 'place', 'title');
    expect(lisbon.rows.map((r) => r.key)).toEqual(['late', 'early']);
  });
});
