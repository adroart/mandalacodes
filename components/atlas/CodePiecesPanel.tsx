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
}

interface Props {
  codeNumber: number;
  codeName: string;
  pieces: CodePiece[];
  /** Re-select this piece on the globe above (mirrors ?piece={key}). */
  onSelectOnGlobe: (pieceId: string, editionNumber?: number) => void;
}

const codeLinkClass =
  'font-label text-[12px] tracking-[0.03em] lowercase text-bronze-700 hover:text-bronze-600 transition-colors';

const CodePiecesPanel: React.FC<Props> = ({
  codeNumber,
  codeName,
  pieces,
  onSelectOnGlobe,
}) => {
  if (pieces.length === 0) {
    return (
      <div className="pt-2 pb-1">
        <p className="font-reading text-base text-wood-600 leading-[1.7]">
          Not yet embodied. No piece for {codeName} has been made.
        </p>
        <p className="mt-2">
          <Link to={`/universal-language/${codeNumber}`} className={codeLinkClass}>
            read the code →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="pt-1 pb-1">
      <ul className="flex flex-col">
        {pieces.map((p) => (
          <LedgerPieceRow
            key={p.key}
            row={atlasPieceToRow(p)}
            onSelectOnGlobe={onSelectOnGlobe}
          />
        ))}
      </ul>
      <p className="mt-3">
        <Link to={`/universal-language/${codeNumber}`} className={codeLinkClass}>
          read the code →
        </Link>
      </p>
    </div>
  );
};

export default CodePiecesPanel;
