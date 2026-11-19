import React from 'react';
import { Link } from 'react-router-dom';
import LedgerPieceRow from './LedgerPieceRow';
import { atlasPieceToRow } from './ledgerRow';

/* ─── One code's pieces, in the ledger grammar ────────────────────────────
 * The expanded view under a row of the sixty-four (the living ledger, Part
 * II.6, ruling 2). Every physical piece the atlas knows for this code, flattened
 * to the ruled grammar with its public dream written directly beneath, two quiet
 * links per piece, and one door to the code itself. Nothing is invented here:
 * the rows are exactly what the public atlas carries.
 */

export interface CodePiece {
  key: string; // `${pieceId}:${editionNumber ?? 0}`
  pieceId: string;
  editionNumber?: number;
  title: string;
  status: 'seeking' | 'placed' | 'unawakened';
  /** "Bali, Indonesia" — present when placed or unawakened in a known city. */
  cityLabel?: string;
  /** "Bali" — city name only, for the "alive in {city}" tail. */
  cityName?: string;
  /** The public dream, when the keeper lets one ride here. */
  intention?: string;
  /** The keeper's chosen signature, only alongside a public dream. */
  signedBy?: { name?: string; link?: string };
  /** When it landed, and its Founding Lights ordinal. Carried so the ledger
   *  can order the record by recency. */
  placedAt?: string;
  claimOrdinal?: number;
}

interface Props {
  codeNumber: number;
  pieces: CodePiece[];
  /** Re-select this piece on the globe above (mirrors ?piece={key}). */
  onSelectOnGlobe: (pieceId: string, editionNumber?: number) => void;
}

const codeLinkClass =
  'font-label text-[12px] tracking-[0.03em] lowercase text-link hover:text-accent transition-colors';

const CodePiecesPanel: React.FC<Props> = ({
  codeNumber,
  pieces,
  onSelectOnGlobe,
}) => {
  return (
    <div className="pt-1 pb-1">
      {pieces.length > 0 && <ul className="flex flex-col">
        {pieces.map((p) => (
          <LedgerPieceRow
            key={p.key}
            row={atlasPieceToRow(p)}
            onSelectOnGlobe={onSelectOnGlobe}
          />
        ))}
      </ul>}
      <p className="mt-3">
        <Link to={`/universal-language/${codeNumber}`} className={codeLinkClass}>
          read the code →
        </Link>
      </p>
    </div>
  );
};

export default CodePiecesPanel;
