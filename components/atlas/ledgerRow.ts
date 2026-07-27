/**
 * The living ledger — shared row grammar and filter logic (Part II.6, rulings
 * 2 and 3). Pure and I/O-free so the unit suite can pin the rules directly.
 *
 * Every ledger row, whether it comes from the public atlas state (the sixty-
 * four and any placed work) or the public catalog (mandalas, signature pieces,
 * jewelry), reduces to ONE grammar:
 *
 *   {title} · alive in {city}          (a piece at rest with a keeper)
 *   {title} · seeking ground           (created, waiting for someone)
 *   {title} · at rest with the artist  (not yet with a keeper)
 *
 * with the public dream, when one rides, written directly beneath. The filter
 * bar (kind / status / search) composes over the same rows the same way for
 * every subsection, so nothing here knows about the DOM.
 */

/** Where a piece stands, normalized across the atlas-state and catalog
 *  vocabularies into the three the ledger speaks. */
export type LedgerNorm = 'placed' | 'seeking' | 'at-rest';

export interface LedgerRow {
  /** `${pieceId}:${editionNumber ?? 0}` — stable and globe-selectable. */
  key: string;
  pieceId: string;
  editionNumber?: number;
  /** Cleaned display title (the trailing "- N" edition suffix removed). */
  title: string;
  norm: LedgerNorm;
  /** City name only ("Lisbon"), for the "alive in {city}" tail. */
  cityName?: string;
  /** Full place label ("Lisbon, Portugal"), for search only. */
  cityLabel?: string;
  /** The public dream, when the keeper lets one ride here. */
  dream?: string;
  /** The keeper's chosen signature, only ever alongside a public dream. */
  signedBy?: { name?: string; link?: string };
  /** Whether this row can be selected on the globe above (placed/unawakened,
   *  with a city to fly to). */
  onGlobe: boolean;
  /** A quietly-marked placeholder standing in until real works are entered:
   *  carries no links and no dream (data/atlasPlaceholder.ts). */
  placeholder?: boolean;
  /** The kind facet this row belongs to, so a flat pool can be regrouped. */
  kind?: string;
  /** The frozen sigil the piece is known by (`UL № 1`). Filled by the record
   *  assembly (lib/atlas/record.ts) for the surfaces that name a work by its
   *  code first; absent everywhere it is not needed. */
  sigil?: string;
  /** The Universal Language code (1 to 64) when the piece carries one. Lets a
   *  row name its code once it is read outside the code index. */
  cardNumber?: number;
  /** ISO date the piece landed at its city, when known. The "most recently
   *  anchored" sort key. */
  placedAt?: string;
  /** Founding Lights ordinal, when the piece has been claimed. Tiebreaks the
   *  recency sort for rows placed on the same day. */
  claimOrdinal?: number;
}

/* ─── Kinds ────────────────────────────────────────────────────────────────
   The atlas `kind` facet and the catalog kind agree by construction (both flow
   from utils/pieceCode's frozen parts): 'sixty-four', 'mandala', 'signature',
   'jewelry', or a category slug for anything else. */

/** The OTHER KINDS sections, in the order they read below the sixty-four. */
export const LEDGER_KIND_ORDER = ['mandala', 'signature', 'jewelry'] as const;

/** The exact, verbatim label for a kind (guardrail: these strings only). */
export function ledgerKindLabel(kind: string): string {
  switch (kind) {
    case 'sixty-four':
      return 'the sixty-four';
    case 'mandala':
      return 'mandalas';
    case 'signature':
      return 'signature pieces';
    case 'jewelry':
      return 'jewelry';
    default:
      return kind;
  }
}

/* ─── Status ───────────────────────────────────────────────────────────────
   Where a piece stands: the three answers (plus any), and the mapping from a
   row.

   The CONTROL is called "status" (Adrian, 2026-07-26), never "state". Next to
   a place control listing Lisbon and Berlin, "state" reads as a region and
   would be misread. The identifiers below stay `state` because they are
   load-bearing across the wall, the ledger, the `ls` URL param and the unit
   suite; only the words a person sees changed. */

export type LedgerStateFilter = 'all' | 'waiting-someone' | 'anchored' | 'waiting-dream';

/** Short labels for the control. The long reading ("created, waiting for
 *  someone") stays in the grammar and the section headings; a control needs a
 *  name, not a sentence. */
export const LEDGER_STATE_OPTIONS: ReadonlyArray<{
  value: LedgerStateFilter;
  label: string;
}> = [
  { value: 'all', label: 'any status' },
  { value: 'anchored', label: 'dreams anchored' },
  { value: 'waiting-someone', label: 'waiting for someone' },
  { value: 'waiting-dream', label: 'waiting for a dream' },
];

/** The heading a state reads under when the ledger is grouped by state. Here
 *  the full sentence is right, because it is a heading and not a control. */
export function ledgerStateLabel(state: Exclude<LedgerStateFilter, 'all'>): string {
  switch (state) {
    case 'anchored':
      return 'dreams anchored';
    case 'waiting-someone':
      return 'created, waiting for someone';
    case 'waiting-dream':
      return 'waiting for a dream';
  }
}

/** Section order when grouping by state: the living first. */
export const LEDGER_STATE_ORDER = [
  'anchored',
  'waiting-someone',
  'waiting-dream',
] as const satisfies ReadonlyArray<Exclude<LedgerStateFilter, 'all'>>;

/** Which of the three states a row sits in: created-and-waiting (available or
 *  seeking), dreams-anchored (placed with a public dream), or waiting-for-a-
 *  dream (unawakened, or placed with no public dream). */
export function ledgerStateOf(row: LedgerRow): Exclude<LedgerStateFilter, 'all'> {
  if (row.norm === 'seeking') return 'waiting-someone';
  if (row.norm === 'placed' && !!row.dream && row.dream.trim().length > 0) {
    return 'anchored';
  }
  return 'waiting-dream';
}

export function matchesState(row: LedgerRow, filter: LedgerStateFilter): boolean {
  if (filter === 'all') return true;
  return ledgerStateOf(row) === filter;
}

export function isLedgerState(v: string | null | undefined): v is LedgerStateFilter {
  return (
    v === 'all' ||
    v === 'waiting-someone' ||
    v === 'anchored' ||
    v === 'waiting-dream'
  );
}

/* ─── Search ──────────────────────────────────────────────────────────────── */

/** Case-insensitive substring across title, city label, and public dream. */
export function matchesSearch(row: LedgerRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [row.title, row.cityLabel, row.cityName, row.dream]
    .filter((s): s is string => !!s)
    .join('  ')
    .toLowerCase();
  return hay.includes(q);
}

/* ─── Arrange: how the record is grouped, and in what order ────────────────
   Two instruments, kept apart. GROUP decides what the section headings are;
   SORT decides the order of rows inside every section. They compose: any sort
   is legal under any grouping. */

export type LedgerGroup = 'kind' | 'state' | 'place' | 'none';

export const LEDGER_GROUP_OPTIONS: ReadonlyArray<{
  value: LedgerGroup;
  label: string;
}> = [
  { value: 'kind', label: 'by kind' },
  { value: 'state', label: 'by status' },
  { value: 'place', label: 'by place' },
  { value: 'none', label: 'one list' },
];

export function isLedgerGroup(v: string | null | undefined): v is LedgerGroup {
  return v === 'kind' || v === 'state' || v === 'place' || v === 'none';
}

export type LedgerSort = 'record' | 'recent' | 'title' | 'place';

export const LEDGER_SORT_OPTIONS: ReadonlyArray<{
  value: LedgerSort;
  label: string;
}> = [
  { value: 'record', label: 'record order' },
  // "placed", not "anchored": placedAt is set the moment a piece lands at a
  // city, including a sold-but-unclaimed one that carries no dream yet. Only
  // a piece WITH a dream is anchored, so naming this "anchored" would lie.
  { value: 'recent', label: 'most recently placed' },
  { value: 'title', label: 'title, a to z' },
  { value: 'place', label: 'place, a to z' },
];

export function isLedgerSort(v: string | null | undefined): v is LedgerSort {
  return v === 'record' || v === 'recent' || v === 'title' || v === 'place';
}

/** The label a place-grouped section reads under when a piece has no city. */
export const LEDGER_NO_PLACE_LABEL = 'not yet placed';

/** Order rows inside one section. Never mutates the input. `record` is the
 *  order the caller built the pool in (code 1 to 64, then kind by kind), so it
 *  is the identity sort and stays stable. */
export function sortLedgerRows(
  rows: readonly LedgerRow[],
  sort: LedgerSort,
): LedgerRow[] {
  const out = rows.slice();
  if (sort === 'record') return out;

  const byTitle = (a: LedgerRow, b: LedgerRow) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });

  if (sort === 'title') return out.sort(byTitle);

  if (sort === 'place') {
    return out.sort((a, b) => {
      // A piece with no city has no place in a place ordering: it reads last.
      if (!a.cityName && !b.cityName) return byTitle(a, b);
      if (!a.cityName) return 1;
      if (!b.cityName) return -1;
      const c = a.cityName.localeCompare(b.cityName, undefined, {
        sensitivity: 'base',
      });
      return c !== 0 ? c : byTitle(a, b);
    });
  }

  // recent: newest anchoring first, then the newest claim, then the title.
  // Rows that never landed anywhere carry no date and read last.
  return out.sort((a, b) => {
    if (a.placedAt !== b.placedAt) {
      if (!a.placedAt) return 1;
      if (!b.placedAt) return -1;
      return b.placedAt.localeCompare(a.placedAt);
    }
    const oa = a.claimOrdinal ?? -1;
    const ob = b.claimOrdinal ?? -1;
    if (oa !== ob) return ob - oa;
    return byTitle(a, b);
  });
}

export interface LedgerSection {
  /** Stable id, used as the section's DOM anchor for the jump rail. */
  id: string;
  label: string;
  rows: LedgerRow[];
  /** True when the rows are ghost placeholders standing in for works not yet
   *  entered. They are not pieces, so nothing may count them as pieces. */
  ghost?: boolean;
}

/** Cut a flat pool of rows into the sections a grouping asks for, each already
 *  sorted. Handles the groupings that read as plain lists; `kind` and `code`
 *  are rendered by the ledger's own code index and kind sections, which carry
 *  presentation (glyphs, tallies, placeholders) this cannot know about. */
export function groupLedgerRows(
  rows: readonly LedgerRow[],
  group: Extract<LedgerGroup, 'state' | 'place' | 'none'>,
  sort: LedgerSort,
): LedgerSection[] {
  if (group === 'none') {
    const all = sortLedgerRows(rows, sort);
    return all.length === 0 ? [] : [{ id: 'all', label: 'every piece', rows: all }];
  }

  if (group === 'state') {
    return LEDGER_STATE_ORDER.map((s) => ({
      id: `state-${s}`,
      label: ledgerStateLabel(s),
      rows: sortLedgerRows(
        rows.filter((r) => ledgerStateOf(r) === s),
        sort,
      ),
    })).filter((s) => s.rows.length > 0);
  }

  // place: every city that holds something, alphabetically, then the unplaced.
  const byCity = new Map<string, LedgerRow[]>();
  const unplaced: LedgerRow[] = [];
  for (const r of rows) {
    if (!r.cityName) {
      unplaced.push(r);
      continue;
    }
    const arr = byCity.get(r.cityName);
    if (arr) arr.push(r);
    else byCity.set(r.cityName, [r]);
  }
  const sections: LedgerSection[] = Array.from(byCity.keys())
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map((city) => ({
      id: `place-${city.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      label: city,
      rows: sortLedgerRows(byCity.get(city) ?? [], sort),
    }));
  if (unplaced.length > 0) {
    sections.push({
      id: 'place-none',
      label: LEDGER_NO_PLACE_LABEL,
      rows: sortLedgerRows(unplaced, sort),
    });
  }
  return sections;
}

/* ─── Display ─────────────────────────────────────────────────────────────── */

/** The status tail, per row status. Placeholders are rendered by the view with
 *  their own placeholder line (see data/atlasPlaceholder.ts); this speaks only
 *  for real rows. */
export function ledgerStatusLine(row: LedgerRow): string {
  switch (row.norm) {
    case 'placed':
      return row.cityName ? `alive in ${row.cityName}` : 'alive';
    case 'seeking':
      return 'seeking ground';
    case 'at-rest':
      return 'at rest with the artist';
  }
}

/** Strip the trailing "- N" edition suffix a title may carry. */
export function cleanLedgerTitle(title: string): string {
  return title.replace(/\s*-\s*\d+\s*$/, '');
}

/* ─── Normalization ──────────────────────────────────────────────────────── */

export function normFromAtlasStatus(
  status: 'seeking' | 'placed' | 'unawakened',
): LedgerNorm {
  if (status === 'placed') return 'placed';
  if (status === 'seeking') return 'seeking';
  return 'at-rest';
}

export function normFromCatalogStatus(
  status: 'with-keeper' | 'available' | 'with-artist',
): LedgerNorm {
  if (status === 'with-keeper') return 'placed';
  if (status === 'available') return 'seeking';
  return 'at-rest';
}

/** A minimal atlas-piece shape a ledger row can be built from — the fields the
 *  code index and the kind sections already resolve. */
export interface LedgerPieceLike {
  key: string;
  pieceId: string;
  editionNumber?: number;
  title: string;
  status: 'seeking' | 'placed' | 'unawakened';
  cityName?: string;
  cityLabel?: string;
  intention?: string;
  signedBy?: { name?: string; link?: string };
  /** Carried through so the row can be sorted and regrouped outside the code
   *  index. Absent on a piece read from inside one code's panel, where the
   *  code is already the heading. */
  cardNumber?: number;
  placedAt?: string;
  claimOrdinal?: number;
}

export function atlasPieceToRow(p: LedgerPieceLike): LedgerRow {
  return {
    key: p.key,
    pieceId: p.pieceId,
    editionNumber: p.editionNumber,
    title: cleanLedgerTitle(p.title),
    norm: normFromAtlasStatus(p.status),
    cityName: p.cityName,
    cityLabel: p.cityLabel,
    dream: p.intention && p.intention.trim() ? p.intention.trim() : undefined,
    signedBy: p.intention && p.intention.trim() ? p.signedBy : undefined,
    onGlobe: p.status === 'placed' || p.status === 'unawakened',
    cardNumber: p.cardNumber,
    placedAt: p.placedAt,
    claimOrdinal: p.claimOrdinal,
  };
}
