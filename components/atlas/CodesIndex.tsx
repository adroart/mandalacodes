import React, { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CARD_BY_NUMBER } from '../../data/oracleData';
import HexagramGlyph from '../oracle/HexagramGlyph';
import CodePiecesPanel, { type CodePiece } from './CodePiecesPanel';
import {
  atlasPieceToRow,
  matchesSearch,
  matchesState,
  type LedgerStateFilter,
} from './ledgerRow';

/* ─── The sixty-four ──────────────────────────────────────────────────────
 * The beloved code-grouped index, now the first subsection of the living
 * ledger (Part II.6, ruling 2). Every Universal Language code, 1 through 64,
 * in a scannable list; each row carries the code's glyph, number, name and an
 * honest one-line tally. Opening a row flattens its pieces to the ledger
 * grammar (CodePiecesPanel): "{title} · alive in {city}", the public dream
 * beneath, two quiet links.
 *
 * The ledger's controls (status / search) reach in here too: when a
 * state or search filter is active, only codes with matching pieces show, each
 * already open on its matches; otherwise the full honest index of all 64 codes
 * reads, collapsed, with click-to-open. Shareable: `?code=N` opens a code.
 *
 * Simple DOM, no per-row observers: the index may render hundreds of rows and
 * must stay at 60fps.
 */

/** A single atlas piece belonging to some code, with display fields resolved. */
export interface CodeIndexEntry extends CodePiece {
  cardNumber: number;
}

interface Props {
  entries: CodeIndexEntry[];
  /** Re-select a piece on the globe above (mirrors ?piece={key}). */
  onSelectOnGlobe: (pieceId: string, editionNumber?: number) => void;
  /** The ledger's state filter (default 'all'). */
  stateFilter?: LedgerStateFilter;
  /** The ledger's search query (default ''). */
  search?: string;
}

interface CodeRow {
  number: number;
  name: string;
  pieces: CodePiece[];
  placed: number;
  seeking: number;
  unawakened: number;
  lit: boolean;
}

/** Honest one-line tally. Only nonzero states appear; no count is invented. */
function tally(row: CodeRow): string {
  if (row.pieces.length === 0) return 'not yet embodied';
  const parts: string[] = [];
  if (row.placed > 0) parts.push(`${row.placed} kept`);
  if (row.seeking > 0) parts.push(`${row.seeking} seeking`);
  if (row.unawakened > 0)
    parts.push(row.unawakened === 1 ? '1 ember' : `${row.unawakened} embers`);
  return parts.join(', ');
}

const CodesIndex: React.FC<Props> = ({
  entries,
  onSelectOnGlobe,
  stateFilter = 'all',
  search = '',
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionRef = useRef<HTMLElement | null>(null);
  const didScrollToCode = useRef(false);

  const filterActive = stateFilter !== 'all' || search.trim() !== '';

  const codeParam = searchParams.get('code');
  const expandedCode = useMemo(() => {
    if (!codeParam) return null;
    const n = parseInt(codeParam, 10);
    return Number.isInteger(n) && n >= 1 && n <= 64 ? n : null;
  }, [codeParam]);

  const rows: CodeRow[] = useMemo(() => {
    const byCode = new Map<number, CodePiece[]>();
    for (const e of entries) {
      const list = byCode.get(e.cardNumber);
      if (list) list.push(e);
      else byCode.set(e.cardNumber, [e]);
    }
    const out: CodeRow[] = [];
    for (let n = 1; n <= 64; n += 1) {
      const card = CARD_BY_NUMBER.get(n);
      const pieces = (byCode.get(n) ?? []).slice().sort((a, b) => {
        const ea = a.editionNumber ?? 0;
        const eb = b.editionNumber ?? 0;
        return ea - eb;
      });
      out.push({
        number: n,
        name: card?.card_name ?? `Code ${n}`,
        pieces,
        placed: pieces.filter((p) => p.status === 'placed').length,
        seeking: pieces.filter((p) => p.status === 'seeking').length,
        unawakened: pieces.filter((p) => p.status === 'unawakened').length,
        lit: pieces.some((p) => p.status === 'placed'),
      });
    }
    return out;
  }, [entries]);

  const litCount = useMemo(() => rows.filter((r) => r.lit).length, [rows]);

  /** The pieces of a code that match the active state + search filter. */
  const matchedOf = React.useCallback(
    (pieces: CodePiece[]): CodePiece[] =>
      pieces.filter((p) => {
        const r = atlasPieceToRow(p);
        return matchesState(r, stateFilter) && matchesSearch(r, search);
      }),
    [stateFilter, search],
  );

  /* Which codes to render, and with which pieces. When filtering, only codes
     with matches show, each open on its matched pieces; otherwise all 64. */
  const shown = useMemo(() => {
    if (!filterActive) {
      return rows.map((row) => ({ row, pieces: row.pieces, open: expandedCode === row.number }));
    }
    return rows
      .map((row) => ({ row, pieces: matchedOf(row.pieces), open: true }))
      .filter((r) => r.pieces.length > 0);
  }, [rows, filterActive, matchedOf, expandedCode]);

  const toggle = (n: number) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (expandedCode === n) next.delete('code');
        else next.set('code', String(n));
        return next;
      },
      { replace: true },
    );
  };

  /* When arriving with ?code=N, scroll the index into view once so a shared
     link lands on the opened code rather than the top of the atlas. */
  useEffect(() => {
    if (expandedCode && !didScrollToCode.current && sectionRef.current) {
      didScrollToCode.current = true;
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [expandedCode]);

  return (
    <section
      ref={sectionRef}
      id="codes"
      aria-labelledby="atlas-codes-heading"
      /* Clear the ledger's sticky controls when a ?code=N link scrolls here.
         --ledger-bar is measured and set by TheLedger. */
      style={{
        scrollMarginTop:
          'calc(var(--nav-height, 64px) + var(--ledger-bar, 100px) + 1.5rem)',
      }}
    >
      <h3
        id="atlas-codes-heading"
        className="font-display text-xl text-wood-900 font-medium mb-2"
      >
        The sixty-four
      </h3>
      <p className="font-reading text-sm text-wood-700 leading-[1.7] max-w-prose mb-6">
        The whole Universal Language, code by code. {litCount} of 64 carry a piece
        that has found ground.
        {!filterActive && ' Open one to see where its pieces have come to rest.'}
      </p>

      {shown.length === 0 ? (
        <p className="font-reading text-base text-wood-600 leading-[1.7]">
          No code matches those filters.
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
          {shown.map(({ row, pieces, open }) => {
            const panelId = `code-panel-${row.number}`;
            return (
              <li key={row.number} className="border-b border-wood-200">
                <button
                  type="button"
                  onClick={() => toggle(row.number)}
                  aria-expanded={open}
                  aria-controls={panelId}
                  className="w-full text-left flex items-center gap-3 py-3 group focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2"
                >
                  <span
                    className={`shrink-0 transition-colors ${
                      row.lit ? 'text-bronze-600' : 'text-wood-400'
                    }`}
                    aria-hidden
                  >
                    <HexagramGlyph gate={row.number} width={22} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-baseline gap-2">
                      <span className="font-label text-[11px] tabular-nums text-wood-500 tracking-[0.15em]">
                        {String(row.number).padStart(2, '0')}
                      </span>
                      <span
                        className={`font-reading text-base leading-snug truncate transition-colors ${
                          row.lit
                            ? 'text-wood-900 group-hover:text-bronze-700'
                            : 'text-wood-600 group-hover:text-bronze-700'
                        }`}
                      >
                        {row.name}
                      </span>
                    </span>
                    <span
                      className={`block font-label text-[11px] uppercase tracking-[0.15em] mt-0.5 ${
                        row.pieces.length === 0 ? 'text-wood-400' : 'text-wood-600'
                      }`}
                    >
                      {tally(row)}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={`shrink-0 text-bronze-600 text-sm transition-transform duration-200 ${
                      open ? 'rotate-90' : ''
                    }`}
                  >
                    ›
                  </span>
                </button>
                {open && (
                  <div id={panelId} className="pb-4 pl-1 pr-2">
                    <CodePiecesPanel
                      codeNumber={row.number}
                      codeName={row.name}
                      pieces={pieces}
                      onSelectOnGlobe={onSelectOnGlobe}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default CodesIndex;
