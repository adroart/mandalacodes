import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CodesIndex, { type CodeIndexEntry } from './CodesIndex';
import LedgerPieceRow from './LedgerPieceRow';
import {
  LedgerControlRow,
  LedgerJumpRail,
  LedgerSearchField,
  LedgerSelect,
  LedgerTally,
} from './LedgerControls';
import {
  ledgerKindLabel,
  matchesSearch,
  matchesState,
  atlasPieceToRow,
  groupLedgerRows,
  isLedgerGroup,
  isLedgerSort,
  isLedgerState,
  sortLedgerRows,
  LEDGER_GROUP_OPTIONS,
  LEDGER_SORT_OPTIONS,
  LEDGER_STATE_OPTIONS,
  type LedgerGroup,
  type LedgerRow,
  type LedgerSection,
  type LedgerSort,
  type LedgerStateFilter,
} from './ledgerRow';
import {
  LEDGER_KIND_PLACEHOLDERS,
} from '../../data/atlasPlaceholder';

/* ─── The living ledger ───────────────────────────────────────────────────
 * The massive record below the globe (Part II.6, rulings 2 and 3). The whole
 * record in one pool: the sixty-four (the code index, kept) plus mandalas,
 * signature pieces, and jewelry from the public catalog and public state.
 * Every row reads the ledger grammar; every public dream is shown inline. It
 * is the interconnection surface.
 *
 * Its controls sit on ONE line under the heading, and they are three separate
 * acts on purpose (LedgerControls.tsx has the reasoning):
 *
 *   FIND     search across titles, cities, and dreams          -> lq
 *   NARROW   status (where a piece stands)                      -> ls
 *   ARRANGE  group by kind / status / place / one list         -> lg
 *            sort by record / recency / title / place          -> lo
 *
 * Kind is deliberately NOT a filter here. Under the default grouping it IS the
 * section headings, so filtering by it only deleted the rest of the record to
 * do what scrolling already did. The jump rail below the controls carries it
 * instead: every section of the current grouping, with its count, one click to
 * reach it, nothing hidden. (The wall keeps a kind filter, because a card
 * field has no sections to jump to. An `lk` arriving from the wall is honored
 * once, as a scroll target.)
 *
 * Simple DOM, no per-row observers: the ledger may render hundreds of rows and
 * must keep 60fps scrolling.
 */

export interface LedgerKindSection {
  /** The kind facet: 'mandala' | 'signature' | 'jewelry' | a category slug. */
  kind: string;
  /** The exact section label ("mandalas", "signature pieces", "jewelry", ...). */
  label: string;
  /** Real rows of this kind (may be empty, placeholders stand in then). */
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
    kind,
  }));
}

/** The DOM id a section anchors on, so the jump rail can reach it. */
const anchorId = (id: string) => `ledger-${id}`;

/* The sticky controls need the stage behind them. The atlas is always the dark
   stage (AtlasPage's root is `dark ... bg-atlas-night`), so there is one
   colour to match, not two. */
const STICKY_SURFACE =
  'bg-atlas-night/95 supports-[backdrop-filter]:backdrop-blur-sm';

const TheLedger: React.FC<Props> = ({ codeEntries, kindSections, onSelectOnGlobe }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  /* ─── Control state ─────────────────────────────────────────────────────
     Mirrored to the URL in BOTH directions. `written` remembers the last URL
     we produced ourselves, so the read-back never fights the write and never
     clobbers half-typed search text when some other param (?code=N) moves. */
  const written = useRef<string | null>(null);
  const paramKey = (
    s: LedgerStateFilter,
    g: LedgerGroup,
    o: LedgerSort,
    q: string,
  ) => `${s}|${g}|${o}|${q}`;

  const [state, setState] = useState<LedgerStateFilter>(() => {
    const s = searchParams.get('ls');
    return isLedgerState(s) ? s : 'all';
  });
  const [group, setGroup] = useState<LedgerGroup>(() => {
    const g = searchParams.get('lg');
    return isLedgerGroup(g) ? g : 'kind';
  });
  const [sort, setSort] = useState<LedgerSort>(() => {
    const o = searchParams.get('lo');
    return isLedgerSort(o) ? o : 'record';
  });
  /** What the field holds. */
  const [typed, setTyped] = useState<string>(() => searchParams.get('lq') ?? '');
  /** What actually filters, a beat behind the typing. */
  const [search, setSearch] = useState<string>(() => searchParams.get('lq') ?? '');

  useEffect(() => {
    if (typed === search) return;
    const t = setTimeout(() => setSearch(typed), 180);
    return () => clearTimeout(t);
  }, [typed, search]);

  /* State -> URL. */
  useEffect(() => {
    written.current = paramKey(state, group, sort, search);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const put = (k: string, v: string, dflt: string) => {
          if (v === dflt) next.delete(k);
          else next.set(k, v);
        };
        put('ls', state, 'all');
        put('lg', group, 'kind');
        put('lo', sort, 'record');
        put('lq', search, '');
        return next;
      },
      { replace: true },
    );
  }, [state, group, sort, search, setSearchParams]);

  /* URL -> state. The writes above are all `replace` (typing must not stack up
     twenty history entries), so this is not about the Back button; it is about
     anyone ELSE moving the params out from under the controls: a pasted link,
     the wall handing over, the code index setting ?code=N. Before this, the
     params were read once in the initializers and the controls could silently
     disagree with the URL they claim to describe. */
  useEffect(() => {
    const s = searchParams.get('ls');
    const g = searchParams.get('lg');
    const o = searchParams.get('lo');
    const nextState = isLedgerState(s) ? s : 'all';
    const nextGroup = isLedgerGroup(g) ? g : 'kind';
    const nextSort = isLedgerSort(o) ? o : 'record';
    const nextQuery = searchParams.get('lq') ?? '';
    const key = paramKey(nextState, nextGroup, nextSort, nextQuery);
    if (key === written.current) return; // our own write coming back around
    written.current = key;
    setState(nextState);
    setGroup(nextGroup);
    setSort(nextSort);
    setSearch(nextQuery);
    setTyped(nextQuery);
  }, [searchParams]);

  const filterActive = state !== 'all' || search.trim() !== '';
  const arrangeActive = group !== 'kind' || sort !== 'record';

  /** One way back to the whole record, however it was left. */
  const clearAll = () => {
    setState('all');
    setGroup('kind');
    setSort('record');
    setTyped('');
    setSearch('');
  };

  /* ─── The pool ──────────────────────────────────────────────────────────
     Every row the ledger knows, once, in RECORD ORDER: code 1 to 64 by
     edition, then each kind section in its ruled order. That order is what
     the `record` sort means, so it is built here and never re-derived. */
  const pool: LedgerRow[] = useMemo(() => {
    const out: LedgerRow[] = [];
    const seen = new Set<string>();
    const byCode = codeEntries.slice().sort((a, b) => {
      if (a.cardNumber !== b.cardNumber) return a.cardNumber - b.cardNumber;
      return (a.editionNumber ?? 0) - (b.editionNumber ?? 0);
    });
    for (const e of byCode) {
      const row = { ...atlasPieceToRow(e), kind: 'sixty-four' };
      if (seen.has(row.key)) continue;
      seen.add(row.key);
      out.push(row);
    }
    for (const s of kindSections) {
      for (const row of s.rows) {
        if (seen.has(row.key)) continue;
        seen.add(row.key);
        out.push({ ...row, kind: s.kind });
      }
    }
    return out;
  }, [codeEntries, kindSections]);

  const matched = useMemo(
    () => pool.filter((r) => matchesState(r, state) && matchesSearch(r, search)),
    [pool, state, search],
  );
  const dreamsRiding = useMemo(
    () => matched.filter((r) => !!r.dream).length,
    [matched],
  );

  /* Counts on every state, so a dead end is visible before it is chosen. They
     answer the search that is already on, not the state that is. */
  const searched = useMemo(
    () => pool.filter((r) => matchesSearch(r, search)),
    [pool, search],
  );
  const stateSelectOptions = useMemo(
    () =>
      LEDGER_STATE_OPTIONS.map((o) => ({
        ...o,
        count: searched.filter((r) => matchesState(r, o.value)).length,
      })),
    [searched],
  );

  /* ─── Sections ──────────────────────────────────────────────────────────
     Grouped by kind, the sixty-four keep their code index: the glyphs, the
     honest tallies, all 64 whether embodied or not. Any other ORDER makes an
     index of codes meaningless, so asking for one flattens them to a sorted
     list of pieces instead. Every other grouping is a plain list throughout. */
  const showCodeIndex = group === 'kind' && sort === 'record';

  const sixtyFourMatches = useMemo(
    () => matched.filter((r) => r.kind === 'sixty-four'),
    [matched],
  );

  const flatSections: LedgerSection[] = useMemo(() => {
    if (group === 'kind') {
      const out: LedgerSection[] = [];
      if (!showCodeIndex && sixtyFourMatches.length > 0) {
        out.push({
          id: 'codes',
          label: ledgerKindLabel('sixty-four'),
          rows: sortLedgerRows(sixtyFourMatches, sort),
        });
      }
      for (const s of kindSections) {
        const real = matched.filter((r) => r.kind === s.kind);
        // A fixed kind with nothing in it yet reads as ghosts, but only while
        // nothing is narrowed: under a filter, empty means empty.
        if (real.length > 0) {
          out.push({
            id: `kind-${s.kind}`,
            label: s.label,
            rows: sortLedgerRows(real, sort),
          });
        } else if (!filterActive && FIXED_PLACEHOLDER_KINDS.has(s.kind)) {
          const ghosts = placeholdersFor(s.kind);
          if (ghosts.length > 0) {
            out.push({ id: `kind-${s.kind}`, label: s.label, rows: ghosts, ghost: true });
          }
        }
      }
      return out;
    }
    return groupLedgerRows(matched, group, sort);
  }, [
    group,
    sort,
    showCodeIndex,
    sixtyFourMatches,
    kindSections,
    matched,
    filterActive,
  ]);

  const codeIndexShows = showCodeIndex && (!filterActive || sixtyFourMatches.length > 0);
  const anyContent = codeIndexShows || flatSections.length > 0;

  /* ─── The jump rail ─────────────────────────────────────────────────────── */
  const railSections = useMemo(() => {
    const out: Array<{ id: string; label: string; count: number }> = [];
    if (codeIndexShows) {
      out.push({
        id: 'codes',
        label: ledgerKindLabel('sixty-four'),
        count: sixtyFourMatches.length,
      });
    }
    for (const s of flatSections) {
      // A ghost section is reachable but has nothing to count yet.
      out.push({ id: s.id, label: s.label, count: s.ghost ? undefined : s.rows.length });
    }
    return out;
  }, [codeIndexShows, sixtyFourMatches.length, flatSections]);

  /* The bar's own height is not a constant: the jump rail wraps to a second
     line under place-grouping, and to three on a phone. A fixed scroll-margin
     therefore buries the heading it just jumped to. Measure the bar and let
     every section's scroll-margin follow it. */
  const barRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const bar = barRef.current;
    const root = rootRef.current;
    if (!bar || !root || typeof ResizeObserver === 'undefined') return;
    const apply = () =>
      root.style.setProperty('--ledger-bar', `${Math.round(bar.offsetHeight)}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

  const jumpTo = useCallback((id: string) => {
    if (typeof document === 'undefined') return;
    document.getElementById(anchorId(id))?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, []);

  /** Clears the sticky bar, whatever height it is right now, plus a breath. */
  const SECTION_ANCHOR = {
    scrollMarginTop: 'calc(var(--nav-height, 64px) + var(--ledger-bar, 100px) + 1.5rem)',
  } as const;

  /* An `lk` handed over from the wall is a place you were looking at, not a
     filter this view keeps. Honor it once, by going there. */
  const handedOff = useRef(false);
  useEffect(() => {
    if (handedOff.current) return;
    const lk = searchParams.get('lk');
    if (!lk || !anyContent) return;
    handedOff.current = true;
    const id = lk === 'sixty-four' ? 'codes' : `kind-${lk}`;
    if (railSections.some((s) => s.id === id)) {
      // After first paint, so the section it is aiming at exists.
      requestAnimationFrame(() => jumpTo(id));
    }
  }, [searchParams, anyContent, railSections, jumpTo]);

  return (
    // The top rule lives on the wall/ledger switcher in AtlasPage now.
    <section ref={rootRef} aria-labelledby="atlas-ledger-heading">
      <h2
        id="atlas-ledger-heading"
        className="font-display text-3xl text-wood-900 font-medium mb-2"
      >
        The ledger
      </h2>
      <p className="font-reading text-base text-wood-700 leading-[1.7] max-w-prose">
        Every piece, every dream, one record.
      </p>

      {/* ── The controls: one line, one rule, no box ─────────────────────── */}
      <div
        ref={barRef}
        className={`sticky top-[var(--nav-height,64px)] z-20 -mx-6 px-6 pt-4 mt-4 mb-10 `}
      >
        <LedgerControlRow>
          <LedgerSearchField
            value={typed}
            onChange={setTyped}
            ariaLabel="Search the ledger by title, city, or dream"
          />
          <LedgerSelect
            label="status"
            value={state}
            options={stateSelectOptions}
            onChange={(v) => setState(v)}
            emphasis={state !== 'all'}
          />
          <LedgerSelect
            label="group"
            value={group}
            options={LEDGER_GROUP_OPTIONS}
            onChange={(v) => setGroup(v)}
            emphasis={group !== 'kind'}
          />
          <LedgerSelect
            label="sort"
            value={sort}
            options={LEDGER_SORT_OPTIONS}
            onChange={(v) => setSort(v)}
            emphasis={sort !== 'record'}
          />
        </LedgerControlRow>

        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 py-2">
          <LedgerTally onClear={filterActive || arrangeActive ? clearAll : undefined}>
            {filterActive
              ? `${matched.length} of ${pool.length} pieces`
              : `${pool.length} pieces`}
            {dreamsRiding > 0 && ` · ${dreamsRiding} dreams riding`}
          </LedgerTally>
          <LedgerJumpRail sections={railSections} onJump={jumpTo} />
        </div>
      </div>

      {!anyContent ? (
        <p className="font-reading text-base text-wood-600 leading-[1.7] py-8">
          Nothing matches. Loosen a filter.
        </p>
      ) : (
        <div className="flex flex-col gap-14">
          {codeIndexShows && (
            <div id={anchorId("codes")} style={SECTION_ANCHOR}>
              <CodesIndex
                entries={codeEntries}
                onSelectOnGlobe={onSelectOnGlobe}
                stateFilter={state}
                search={search}
              />
            </div>
          )}
          {flatSections.map((s) => (
            <section
              key={s.id}
              id={anchorId(s.id)}
              aria-label={s.label}
              style={SECTION_ANCHOR}
            >
              <h3
                className={`font-display text-xl text-wood-900 font-medium ${
                  s.ghost || s.rows.length < 2 ? 'mb-4' : 'mb-1'
                }`}
              >
                {s.label}
              </h3>
              {/* The count only where it says something: never for ghosts, and
                  not for a section whose single row is already the answer. */}
              {!s.ghost && s.rows.length > 1 && (
                <p className="font-label text-[11px] uppercase tracking-[0.16em] text-wood-500 mb-4">
                  {s.rows.length} pieces
                </p>
              )}
              <ul className="flex flex-col">
                {s.rows.map((row) => (
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
