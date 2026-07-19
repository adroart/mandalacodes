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
 * bar (kind / state / search) composes over the same rows the same way for
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
  /** Whether this row can be selected on the globe above (placed/unawakened,
   *  with a city to fly to). */
  onGlobe: boolean;
  /** A quietly-marked placeholder standing in until real works are entered —
   *  carries no links and no dream (data/atlasPlaceholder.ts). */
  placeholder?: boolean;
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

/* ─── State ────────────────────────────────────────────────────────────────
   The filter's three states (plus all), and the mapping from a row. */

export type LedgerStateFilter = 'all' | 'waiting-someone' | 'anchored' | 'waiting-dream';

export const LEDGER_STATE_OPTIONS: ReadonlyArray<{
  value: LedgerStateFilter;
  label: string;
}> = [
  { value: 'all', label: 'all' },
  { value: 'waiting-someone', label: 'created, waiting for someone' },
  { value: 'anchored', label: 'dreams anchored' },
  { value: 'waiting-dream', label: 'waiting for a dream' },
];

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
    onGlobe: p.status === 'placed' || p.status === 'unawakened',
  };
}
