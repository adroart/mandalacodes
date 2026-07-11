import React, { useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CARD_BY_NUMBER } from '../../data/oracleData';
import HexagramGlyph from '../oracle/HexagramGlyph';
import CodePiecesPanel, { type CodePiece } from './CodePiecesPanel';

/* ─── The flat all-64 index ───────────────────────────────────────────────
 * Below the globe: every Universal Language code, 1 through 64, in a
 * scannable list. Each row carries the code's glyph, number, name and an
 * honest one-line tally of its pieces derived strictly from the atlas state
 * ("2 kept", "1 seeking, 1 ember", "not yet embodied"). Tapping a row opens
 * that code's pieces in place, each linking back to the globe and out to its
 * own page.
 *
 * Lit vs unlit mirrors the ring's bright/dim split: a code with at least one
 * kept (placed) piece reads bright; the rest recede in muted wood tones.
 *
 * Shareable: `?code=N` opens a specific code; the section anchors at #codes.
 */

/** A single atlas piece belonging to some code, with display fields resolved. */
export interface CodeIndexEntry extends CodePiece {
  cardNumber: number;
}

interface Props {
  entries: CodeIndexEntry[];
  /** Re-select a piece on the globe above (mirrors ?piece={key}). */
  onSelectOnGlobe: (pieceId: string, editionNumber?: number) => void;
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

const CodesIndex: React.FC<Props> = ({ entries, onSelectOnGlobe }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionRef = useRef<HTMLElement | null>(null);
  const didScrollToCode = useRef(false);

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
      className="scroll-mt-8 border-t border-wood-200 pt-10"
    >
      <h2
        id="atlas-codes-heading"
        className="font-serif text-2xl text-wood-900 font-medium mb-3"
      >
        All 64 codes
      </h2>
      <p className="font-sans text-sm text-wood-700 leading-[1.7] max-w-prose mb-6">
        The whole Universal Language, code by code. {litCount} of 64 carry a piece
        that has found ground. Open one to see where its pieces have come to rest.
      </p>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
        {rows.map((row) => {
          const isOpen = expandedCode === row.number;
          const panelId = `code-panel-${row.number}`;
          return (
            <li key={row.number} className="border-b border-wood-200">
              <button
                type="button"
                onClick={() => toggle(row.number)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="w-full text-left flex items-center gap-4 py-3 group focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2"
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
                      className={`font-serif text-base leading-snug truncate transition-colors ${
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
                    isOpen ? 'rotate-90' : ''
                  }`}
                >
                  ›
                </span>
              </button>
              {isOpen && (
                <div id={panelId} className="pb-4 pl-[38px] pr-2">
                  <CodePiecesPanel
                    codeNumber={row.number}
                    codeName={row.name}
                    pieces={row.pieces}
                    onSelectOnGlobe={onSelectOnGlobe}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default CodesIndex;
