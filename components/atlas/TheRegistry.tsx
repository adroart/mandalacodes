import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import DreamSignature from './DreamSignature';
import {
  LedgerControlRow,
  LedgerSearchField,
  LedgerSelect,
  LedgerTally,
} from './LedgerControls';
import {
  atlasPieceToRow,
  ledgerKindLabel,
  ledgerStateLabel,
  ledgerStateOf,
  matchesSearch,
  matchesState,
  isLedgerState,
  LEDGER_NO_PLACE_LABEL,
  LEDGER_STATE_OPTIONS,
  type LedgerRow,
  type LedgerStateFilter,
} from './ledgerRow';
import {
  LEDGER_KIND_PLACEHOLDERS,
  LEDGER_PLACEHOLDER_STATUS,
} from '../../data/atlasPlaceholder';
import { sigilFor, useAtlasRecord } from '../../lib/atlas/record';

/* ─── The registry ────────────────────────────────────────────────────────
 * The ledger's companion (Part II.6, "The ledger's form, ruled"). The wall of
 * dreams is the record's face; this is the record's index — the fine catalog
 * table of every work the public data knows, one hairline row per work, on the
 * night stage with no globe above it.
 *
 *   {sigil}   {work}   {place}   {the dream it carries, one line}
 *
 * A row that carries a dream unfolds it inline beneath itself on a click or a
 * tap, with the keeper's signature line and the two ways onward. A row with no
 * dream says where it stands instead, in the low ink.
 *
 * It reads THE SAME record the atlas reads (lib/atlas/record.ts) through the
 * SAME filter grammar and the same URL params (lk / ls / lq), so a narrowing
 * made here still holds when you cross back to the globe.
 *
 * Simple DOM, no per-row observers, memoized rows: this is built to hold three
 * hundred lines and stay quiet while you scroll them.
 */

/** The kinds that stand in with ghost rows while they hold nothing real. */
const FIXED_PLACEHOLDER_KINDS = Object.keys(LEDGER_KIND_PLACEHOLDERS);

/** The ghost rows a fixed kind shows while it has no real entries. */
function placeholdersFor(kind: string): LedgerRow[] {
  const titles = (LEDGER_KIND_PLACEHOLDERS as Record<string, readonly string[]>)[kind];
  if (!titles) return [];
  return titles.map((title, i) => ({
    key: `placeholder-${kind}-${i}`,
    pieceId: '',
    title,
    norm: 'at-rest' as const,
    onGlobe: false,
    placeholder: true,
    kind,
  }));
}

/* ─── The founding-light order ────────────────────────────────────────────
   The registry's one order, so no second header control is needed: the lit
   pieces first by their founding ordinal, then the rest of what is placed,
   then what is sold and still waiting to be claimed, then what is seeking
   ground, then what rests with the artist. Ghost rows never mix in — they are
   appended after everything, at the end of the kinds they stand in for. */
function registryRank(r: LedgerRow): number {
  if (r.norm === 'placed') return typeof r.claimOrdinal === 'number' ? 0 : 1;
  // 'at-rest' WITH a globe seat is an unawakened piece: sold, not yet claimed.
  if (r.norm === 'at-rest' && r.onGlobe) return 2;
  if (r.norm === 'seeking') return 3;
  return 4;
}

function sortRegistry(rows: readonly LedgerRow[]): LedgerRow[] {
  return rows.slice().sort((a, b) => {
    const ra = registryRank(a);
    const rb = registryRank(b);
    if (ra !== rb) return ra - rb;
    if (ra === 0) return (a.claimOrdinal ?? 0) - (b.claimOrdinal ?? 0);
    return 0; // otherwise the record order the pool was built in holds
  });
}

/* ─── One line of the table ───────────────────────────────────────────────
   Four cells on the wide table; three stacked lines on a phone, which is why
   the pairs wrap in `md:contents` spans: on a phone they are the two flex
   lines, on the table they dissolve and their children become the columns. */

const COLUMNS =
  'md:grid md:grid-cols-[7rem_minmax(0,1fr)_9rem_minmax(0,1.7fr)] md:items-baseline md:gap-x-6';

const linkClass =
  'font-label text-[12px] tracking-[0.03em] lowercase text-bronze-700 hover:text-bronze-600 transition-colors';

const RegistryLine: React.FC<{
  row: LedgerRow;
  open: boolean;
  onToggle: (key: string) => void;
}> = React.memo(({ row, open, onToggle }) => {
  if (row.placeholder) {
    return (
      <li className="border-b border-wood-200/50">
        <div className={`py-2.5 ${COLUMNS}`}>
          <span aria-hidden className="hidden md:block" />
          <span className="font-reading text-[15px] leading-snug text-wood-400">
            {row.title}
          </span>
          <span aria-hidden className="hidden md:block" />
          <span className="block mt-0.5 md:mt-0 font-label text-[11px] uppercase tracking-[0.14em] text-wood-400/80">
            {LEDGER_PLACEHOLDER_STATUS}
          </span>
        </div>
      </li>
    );
  }

  const place = row.cityName ?? LEDGER_NO_PLACE_LABEL;
  const stateLine = ledgerStateLabel(ledgerStateOf(row));
  const piecePath = `/piece/${row.pieceId}${
    typeof row.editionNumber === 'number' ? `/${row.editionNumber}` : ''
  }`;
  const panelId = `registry-dream-${row.key.replace(/[^a-zA-Z0-9-]/g, '-')}`;

  const line = (
    <div className={`py-3 ${COLUMNS}`}>
      {/* phone line one — sigil, then the work */}
      <span className="flex items-baseline gap-3 md:contents">
        <span className="shrink-0 font-label text-[11px] uppercase tracking-[0.16em] text-wood-500 tabular-nums">
          {row.sigil}
        </span>
        <span className="min-w-0 font-reading text-[15px] leading-snug text-wood-900 md:truncate">
          {row.title}
        </span>
      </span>
      {/* phone line two — the place, then where it stands */}
      <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 md:mt-0 md:contents">
        <span
          className={`min-w-0 font-reading text-[14px] leading-snug md:truncate ${
            row.cityName ? 'text-wood-700' : 'text-wood-500'
          }`}
        >
          {place}
        </span>
        {/* On the wide table this cell IS the dream column, so it speaks only
            for a dreamless row. On a phone it always rides line two. */}
        <span
          className={`font-label text-[11px] uppercase tracking-[0.14em] text-wood-500 ${
            row.dream ? 'md:hidden' : ''
          }`}
        >
          {stateLine}
        </span>
      </span>
      {/* the dream's opening — the fourth column on the table, its own line
          beneath on a phone. One line, quiet ellipsis, the rest on a tap. */}
      {row.dream && (
        <span
          className={`block min-w-0 mt-1 md:mt-0 truncate font-display text-[16px] leading-snug transition-colors ${
            open ? 'text-wood-500' : 'text-wood-700'
          }`}
        >
          {row.dream}
        </span>
      )}
    </div>
  );

  if (!row.dream) {
    return <li className="border-b border-wood-200/50">{line}</li>;
  }

  return (
    <li className="border-b border-wood-200/50">
      <button
        type="button"
        onClick={() => onToggle(row.key)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`The dream carried by ${row.title}`}
        className="block w-full text-left hover:bg-wood-100/40 transition-colors"
      >
        {line}
      </button>
      {open && (
        <div id={panelId} className="pb-6 md:pl-[calc(7rem+1.5rem)]">
          <p className="font-display text-[19px] sm:text-[21px] leading-[1.75] text-wood-900 max-w-prose whitespace-pre-line">
            {row.dream}
          </p>
          <DreamSignature signedBy={row.signedBy} tone="stage" className="mt-3" />
          <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
            {row.onGlobe && (
              <Link
                to={`/atlas?piece=${encodeURIComponent(row.key)}`}
                className={linkClass}
              >
                on the globe →
              </Link>
            )}
            <Link to={piecePath} className={linkClass}>
              its page →
            </Link>
          </p>
        </div>
      )}
    </li>
  );
});
RegistryLine.displayName = 'RegistryLine';

/* ─── The page ─────────────────────────────────────────────────────────────── */

const TheRegistry: React.FC = () => {
  const { status, codeEntries, kindSections, generatedAt } = useAtlasRecord();
  const [searchParams, setSearchParams] = useSearchParams();

  /* The same three instruments the wall carries, on the same URL params, so a
     narrowing survives the crossing between the two surfaces. */
  const [kind, setKindState] = useState<string>(() => searchParams.get('lk') ?? 'all');
  const [state, setStateState] = useState<LedgerStateFilter>(() => {
    const s = searchParams.get('ls');
    return isLedgerState(s) ? s : 'all';
  });
  const [search, setSearchState] = useState<string>(() => searchParams.get('lq') ?? '');
  /** What the field holds; `search` follows a beat later so three hundred rows
   *  are not refiltered on every keystroke. */
  const [typed, setTyped] = useState<string>(() => searchParams.get('lq') ?? '');

  const mirror = useCallback(
    (key: string, value: string, clearVal: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === clearVal) next.delete(key);
          else next.set(key, value);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  const setKind = (v: string) => {
    setKindState(v);
    mirror('lk', v, 'all');
  };
  const setState = (v: LedgerStateFilter) => {
    setStateState(v);
    mirror('ls', v, 'all');
  };
  const setSearch = useCallback(
    (v: string) => {
      setSearchState(v);
      mirror('lq', v, '');
    },
    [mirror],
  );
  useEffect(() => {
    if (typed === search) return;
    const t = setTimeout(() => setSearch(typed), 180);
    return () => clearTimeout(t);
  }, [typed, search, setSearch]);

  /* ─── The pool ──────────────────────────────────────────────────────────
     Every work the public data knows, once, in record order: code 1 to 64 by
     edition, then each kind in its ruled order. The default arrangement sorts
     over this, and record order is what breaks its ties. */
  const pool: LedgerRow[] = useMemo(() => {
    const out: LedgerRow[] = [];
    const seen = new Set<string>();
    const byCode = codeEntries.slice().sort((a, b) => {
      if (a.cardNumber !== b.cardNumber) return a.cardNumber - b.cardNumber;
      return (a.editionNumber ?? 0) - (b.editionNumber ?? 0);
    });
    for (const e of byCode) {
      if (seen.has(e.key)) continue;
      seen.add(e.key);
      out.push({
        ...atlasPieceToRow(e),
        kind: 'sixty-four',
        sigil: sigilFor(e.pieceId, { cardNumber: e.cardNumber }),
      });
    }
    for (const s of kindSections) {
      for (const row of s.rows) {
        if (seen.has(row.key)) continue;
        seen.add(row.key);
        out.push({ ...row, kind: s.kind, sigil: row.sigil ?? sigilFor(row.pieceId) });
      }
    }
    return out;
  }, [codeEntries, kindSections]);

  const kindOptions = useMemo(() => {
    const present = Array.from(new Set(pool.map((r) => r.kind ?? '')));
    const ordered = [
      'sixty-four',
      ...present.filter((k) => k && k !== 'sixty-four').sort(),
    ].filter((k) => present.includes(k));
    return ['all', ...ordered];
  }, [pool]);

  const kindSelectOptions = useMemo(
    () =>
      kindOptions.map((k) => ({
        value: k,
        label: k === 'all' ? 'every kind' : ledgerKindLabel(k),
        count: k === 'all' ? pool.length : pool.filter((r) => r.kind === k).length,
      })),
    [kindOptions, pool],
  );
  const stateSelectOptions = useMemo(
    () =>
      LEDGER_STATE_OPTIONS.map((o) => ({
        ...o,
        count: pool.filter(
          (r) => (kind === 'all' || r.kind === kind) && matchesState(r, o.value),
        ).length,
      })),
    [pool, kind],
  );

  const filterActive = kind !== 'all' || state !== 'all' || search.trim() !== '';
  const clearAll = () => {
    setKind('all');
    setState('all');
    setTyped('');
    setSearch('');
  };

  const rows = useMemo(
    () =>
      sortRegistry(
        pool.filter(
          (r) =>
            (kind === 'all' || r.kind === kind) &&
            matchesState(r, state) &&
            matchesSearch(r, search),
        ),
      ),
    [pool, kind, state, search],
  );
  const dreamsRiding = useMemo(() => rows.filter((r) => !!r.dream).length, [rows]);

  /* The ghosts stand in only for a kind that holds nothing real, and only
     while nothing is narrowed: under a filter, empty means empty. They are not
     pieces, so no tally ever counts them. */
  const ghosts = useMemo(() => {
    if (filterActive) return [];
    const out: LedgerRow[] = [];
    for (const s of kindSections) {
      if (!FIXED_PLACEHOLDER_KINDS.includes(s.kind)) continue;
      if (s.rows.length > 0) continue;
      out.push(...placeholdersFor(s.kind));
    }
    return out;
  }, [kindSections, filterActive]);

  /* One dream open at a time: the table stays a table. */
  const [openKey, setOpenKey] = useState<string | null>(null);
  const toggle = useCallback(
    (key: string) => setOpenKey((prev) => (prev === key ? null : key)),
    [],
  );

  const anything = rows.length > 0 || ghosts.length > 0;

  return (
    /* The registry keeps the atlas's night register even when the site is in
       Daybook: it is the same room as the globe, without the globe. */
    <div className="dark min-h-screen bg-atlas-night text-wood-900">
      <div className="px-6 pb-32 max-w-7xl mx-auto pt-[calc(var(--nav-height)+2.5rem)]">
        <header className="max-w-prose">
          <h1 className="font-display text-4xl sm:text-5xl text-wood-900 font-medium leading-tight">
            The registry
          </h1>
          <p className="mt-3 font-reading text-base text-wood-700 leading-[1.7]">
            The whole record, one line per work.
          </p>
          <Link to="/atlas" className={`${linkClass} mt-5 inline-block`}>
            the atlas →
          </Link>
        </header>

        {status === 'loading' && (
          <p
            className="font-display text-lg text-wood-700 py-24 text-center"
            aria-live="polite"
          >
            loading the registry
          </p>
        )}

        {status === 'error' && (
          <p
            className="font-display text-lg text-wood-700 py-24 text-center"
            aria-live="polite"
          >
            the atlas is briefly out of reach.
          </p>
        )}

        {status === 'ready' && (
          <>
            <div className="mt-10 mb-8 flex flex-col gap-4">
              <LedgerControlRow>
                <LedgerSearchField
                  value={typed}
                  onChange={setTyped}
                  ariaLabel="Search the registry by title, city, or dream"
                />
                <LedgerSelect
                  label="kind"
                  value={kind}
                  options={kindSelectOptions}
                  onChange={setKind}
                  emphasis={kind !== 'all'}
                />
                <LedgerSelect
                  label="status"
                  value={state}
                  options={stateSelectOptions}
                  onChange={setState}
                  emphasis={state !== 'all'}
                />
              </LedgerControlRow>

              <LedgerTally onClear={filterActive ? clearAll : undefined}>
                {filterActive
                  ? `${rows.length} of ${pool.length} pieces`
                  : `${pool.length} pieces`}
                {dreamsRiding > 0 && ` · ${dreamsRiding} dreams riding`}
              </LedgerTally>
            </div>

            {!anything ? (
              pool.length === 0 ? (
                /* An empty atlas, not an over-narrowed one: no filter reduced
                   this to nothing, so there is nothing to loosen. */
                <p className="font-display italic text-lg text-wood-700 py-8">
                  the sky is waiting for its first light.
                </p>
              ) : (
                <p className="font-reading text-base text-wood-600 leading-[1.7] py-8">
                  Nothing matches. Loosen a filter.
                </p>
              )
            ) : (
              <>
                {/* The column heads belong to the wide table only; a phone
                    reads stacked lines that name themselves. */}
                <div
                  aria-hidden
                  className={`hidden border-b border-wood-300/60 pb-2 font-label text-[11px] lowercase tracking-[0.1em] text-wood-500 ${COLUMNS}`}
                >
                  <span>sigil</span>
                  <span>work</span>
                  <span>place</span>
                  <span>the dream it carries</span>
                </div>
                <ul className="flex flex-col">
                  {rows.map((row) => (
                    <RegistryLine
                      key={row.key}
                      row={row}
                      open={openKey === row.key}
                      onToggle={toggle}
                    />
                  ))}
                  {ghosts.map((row) => (
                    <RegistryLine
                      key={row.key}
                      row={row}
                      open={false}
                      onToggle={toggle}
                    />
                  ))}
                </ul>
              </>
            )}

            {generatedAt && (
              <p className="mt-16 font-label text-[11px] uppercase tracking-[0.18em] text-wood-600">
                Last gathered{' '}
                {new Date(generatedAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TheRegistry;
