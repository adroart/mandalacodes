import React from 'react';
import { Link } from 'react-router-dom';
import DreamSignature from './DreamSignature';
import { ledgerStatusLine, type LedgerRow } from './ledgerRow';
import { LEDGER_PLACEHOLDER_STATUS } from '../../data/atlasPlaceholder';

/* ─── One ledger row, one grammar ─────────────────────────────────────────
 * The living ledger (Part II.6, ruling 2). Every row — a piece under one of
 * the sixty-four codes, or a mandala / signature piece / jewelry from the
 * catalog — reads the same way:
 *
 *   {title} · alive in {city}        (or · seeking ground / · at rest with the artist)
 *   {the public dream, when one rides, in a calm Cormorant reading block}
 *   on the globe →   its page →
 *
 * Rows align near the section's left edge (reduced indentation, law 2). A
 * placeholder row is a faint ghost carrying only its status line — no dream,
 * no links — trivially removed when a real entry lands.
 *
 * Simple DOM, no per-row observers: the ledger may render hundreds of these
 * and must stay at 60fps.
 */

interface Props {
  row: LedgerRow;
  /** Re-select this piece on the globe above (mirrors ?piece={key}). */
  onSelectOnGlobe: (pieceId: string, editionNumber?: number) => void;
}

const linkClass =
  'font-label text-[12px] tracking-[0.03em] lowercase text-bronze-700 hover:text-bronze-600 transition-colors';

const LedgerPieceRow: React.FC<Props> = ({ row, onSelectOnGlobe }) => {
  if (row.placeholder) {
    return (
      <li className="py-2.5 border-b border-wood-200/50">
        <p className="font-reading text-base leading-snug text-wood-400">
          {row.title}
        </p>
        <p className="mt-0.5 font-label text-[11px] uppercase tracking-[0.14em] text-wood-400/80">
          {LEDGER_PLACEHOLDER_STATUS}
        </p>
      </li>
    );
  }

  const piecePath = `/piece/${row.pieceId}${
    typeof row.editionNumber === 'number' ? `/${row.editionNumber}` : ''
  }`;

  return (
    <li className="py-3 border-b border-wood-200/60">
      <p className="font-reading text-base leading-snug text-wood-900">
        {/* Its code, when the row is read outside the code index and would
            otherwise lose which of the sixty-four it belongs to. */}
        {typeof row.cardNumber === 'number' && (
          <span className="mr-2 font-label text-[11px] tabular-nums tracking-[0.15em] text-wood-500">
            {String(row.cardNumber).padStart(2, '0')}
          </span>
        )}
        {row.title}
        <span aria-hidden className="mx-2 text-wood-400">
          ·
        </span>
        <span className="font-label text-[11px] uppercase tracking-[0.14em] text-wood-600">
          {ledgerStatusLine(row)}
        </span>
      </p>

      {row.dream && (
        <>
          <p className="mt-2 font-display text-[17px] leading-[1.65] text-wood-800 max-w-prose">
            {row.dream}
          </p>
          {row.signedBy && <DreamSignature signedBy={row.signedBy} className="mt-1" />}
        </>
      )}

      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {row.onGlobe && (
          <>
            <button
              type="button"
              onClick={() => onSelectOnGlobe(row.pieceId, row.editionNumber)}
              className={linkClass}
            >
              on the globe →
            </button>
            <span aria-hidden className="text-wood-300">
              ·
            </span>
          </>
        )}
        <Link to={piecePath} className={linkClass}>
          its page →
        </Link>
      </p>
    </li>
  );
};

export default LedgerPieceRow;
