import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CodesIndex, { type CodeIndexEntry } from './CodesIndex';
import LedgerPieceRow from './LedgerPieceRow';
import {
  ledgerKindLabel,
  matchesSearch,
  matchesState,
  atlasPieceToRow,
  isLedgerState,
  LEDGER_KIND_ORDER,
  LEDGER_STATE_OPTIONS,
  type LedgerRow,
  type LedgerStateFilter,
} from './ledgerRow';
import {
  LEDGER_KIND_PLACEHOLDERS,
} from '../../data/atlasPlaceholder';

/* ─── The living ledger ───────────────────────────────────────────────────
 * The massive record below the globe (Part II.6, rulings 2 and 3). One section:
 * the sixty-four (the code index, kept), then mandalas, signature pieces, and
 * jewelry drawn from the public catalog + public state, with quietly-marked
 * placeholder rows until the first real works of a kind land. Every row reads
 * the ledger grammar; every public dream is shown inline. It is the
 * interconnection surface.
 *
 * Its own serious filter bar sits under the heading: kind, state, and a search
 * across titles, cities, and dream text, all mirrored to distinct URL params
 * (lk / ls / lq) and composed over every subsection consistently.
 *
 * Simple DOM, no per-row observers: the ledger may render hundreds of rows and
 * must keep 60fps scrolling.
 */

export interface LedgerKindSection {
  /** The kind facet: 'mandala' | 'signature' | 'jewelry' | a category slug. */
  kind: string;
  /** The exact section label ("mandalas", "signature pieces", "jewelry", ...). */
  label: string;
  /** Real rows of this kind (may be empty — placeholders stand in then). */
  rows: LedgerRow[];
}

interface Props {
  codeEntries: CodeIndexEntry[];
  kindSections: LedgerKindSection[];
  onSelectOnGlobe: (pieceId: string, editionNumber?: number) => void;
}

const FIXED_PLACEHOLDER_KINDS = new Set(Object.keys(LEDGER_KIND_PLACEHOLDERS));

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
  }));
}

/* ─── The filter bar ──────────────────────────────────────────────────────── */

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`whitespace-nowrap font-label text-[12px] lowercase tracking-[0.04em] pb-0.5 border-b transition-colors ${
        active
          ? 'text-bronze-700 border-bronze-600'
          : 'text-wood-500 border-transparent hover:text-bronze-700'
      }`}
    >
      {children}
    </button>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="w-14 shrink-0 font-label text-[10px] uppercase tracking-[0.2em] text-wood-500">
        {label}
      </span>
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">{children}</div>
    </div>
  );
}

const TheLedger: React.FC<Props> = ({ codeEntries, kindSections, onSelectOnGlobe }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const kindOptions = useMemo(
    () => ['all', 'sixty-four', ...kindSections.map((s) => s.kind)],
    [kindSections],
  );

  const [kind, setKindState] = useState<string>(() => {
    const k = searchParams.get('lk');
    return k && ['sixty-four', ...kindSections.map((s) => s.kind)].includes(k)
      ? k
      : 'all';
  });
  const [state, setStateState] = useState<LedgerStateFilter>(() => {
    const s = searchParams.get('ls');
    return isLedgerState(s) ? s : 'all';
  });
  const [search, setSearchState] = useState<string>(() => searchParams.get('lq') ?? '');

  const mirror = (key: string, value: string, clearVal: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === clearVal) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  };
  const setKind = (v: string) => {
    setKindState(v);
    mirror('lk', v, 'all');
  };
  const setState = (v: LedgerStateFilter) => {
    setStateState(v);
    mirror('ls', v, 'all');
  };
  const setSearch = (v: string) => {
    setSearchState(v);
    mirror('lq', v, '');
  };

  const filterActive = state !== 'all' || search.trim() !== '';

  const sixtyFourVisible = kind === 'all' || kind === 'sixty-four';
  const sixtyFourHasContent = useMemo(() => {
    if (!sixtyFourVisible) return false;
    if (!filterActive) return true; // the full honest index of all 64
    return codeEntries.some((e) => {
      const r = atlasPieceToRow(e);
      return matchesState(r, state) && matchesSearch(r, search);
    });
  }, [sixtyFourVisible, filterActive, codeEntries, state, search]);

  /* Resolve each kind section to the rows it will actually render. */
  const resolvedSections = useMemo(() => {
    return kindSections
      .filter((s) => kind === 'all' || kind === s.kind)
      .map((s) => {
        let rows: LedgerRow[];
        if (filterActive) {
          rows = s.rows.filter(
            (r) => matchesState(r, state) && matchesSearch(r, search),
          );
        } else if (s.rows.length > 0) {
          rows = s.rows;
        } else if (FIXED_PLACEHOLDER_KINDS.has(s.kind)) {
          rows = placeholdersFor(s.kind);
        } else {
          rows = [];
        }
        return { ...s, displayRows: rows };
      })
      .filter((s) => s.displayRows.length > 0);
  }, [kindSections, kind, filterActive, state, search]);

  const anyContent =
    (sixtyFourVisible && sixtyFourHasContent) || resolvedSections.length > 0;

  return (
    // The top rule lives on the wall/ledger switcher in AtlasPage now.
    <section aria-labelledby="atlas-ledger-heading">
      <h2
        id="atlas-ledger-heading"
        className="font-display text-3xl text-wood-900 font-medium mb-2"
      >
        The ledger
      </h2>
      <p className="font-reading text-base text-wood-700 leading-[1.7] max-w-prose">
        Every piece, every dream, one record.
      </p>

      {/* ── Filter bar (paper-variant; not the globe's filter sheet) ───────── */}
      <div className="mt-6 mb-12 border border-bronze-400/20 bg-bronze-400/[0.04] p-4 sm:p-5 flex flex-col gap-4">
        <FilterRow label="kind">
          {kindOptions.map((k) => (
            <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
              {k === 'all' ? 'all' : ledgerKindLabel(k)}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="state">
          {LEDGER_STATE_OPTIONS.map((opt) => (
            <Chip
              key={opt.value}
              active={state === opt.value}
              onClick={() => setState(opt.value)}
            >
              {opt.label}
            </Chip>
          ))}
        </FilterRow>
        <FilterRow label="search">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search titles, cities, dreams"
            aria-label="Search the ledger by title, city, or dream"
            className="w-full max-w-md bg-transparent border-b border-wood-300 pb-1 font-reading text-[15px] text-wood-900 placeholder:text-wood-500 focus:outline-none focus:border-bronze-600 transition-colors"
          />
        </FilterRow>
      </div>

      {!anyContent ? (
        <p className="font-reading text-base text-wood-600 leading-[1.7] py-8">
          Nothing matches. Loosen a filter.
        </p>
      ) : (
        <div className="flex flex-col gap-14">
          {sixtyFourVisible && sixtyFourHasContent && (
            <CodesIndex
              entries={codeEntries}
              onSelectOnGlobe={onSelectOnGlobe}
              stateFilter={state}
              search={search}
            />
          )}

          {resolvedSections.map((s) => (
            <section key={s.kind} aria-label={s.label}>
              <h3 className="font-display text-xl text-wood-900 font-medium mb-4">
                {s.label}
              </h3>
              <ul className="flex flex-col">
                {s.displayRows.map((row) => (
                  <LedgerPieceRow
                    key={row.key}
                    row={row}
                    onSelectOnGlobe={onSelectOnGlobe}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
};

export default TheLedger;
