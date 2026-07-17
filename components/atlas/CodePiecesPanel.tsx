import React from 'react';
import { Link } from 'react-router-dom';

/* ─── One code's pieces, laid out honestly ────────────────────────────────
 * The expanded view under a row of the all-64 index. Every physical piece
 * the atlas knows for this code, with its true state and city, links back to
 * the globe selection and forward to the piece's own page. Nothing is
 * invented here: the rows are exactly what the public atlas carries.
 *
 * State vocabulary (kept consistent with the globe HUD and the ring):
 *   placed      → "kept" (at rest with its keeper, in a city)
 *   seeking     → "seeking ground" (made, not yet placed)
 *   unawakened  → "ember" (sold, at rest in a city, not yet claimed)
 */

export interface CodePiece {
  key: string; // `${pieceId}:${editionNumber ?? 0}`
  pieceId: string;
  editionNumber?: number;
  title: string;
  status: 'seeking' | 'placed' | 'unawakened';
  /** "Bali, Indonesia" — present when placed or unawakened in a known city. */
  cityLabel?: string;
}

interface Props {
  codeNumber: number;
  codeName: string;
  pieces: CodePiece[];
  /** Re-select this piece on the globe above (mirrors ?piece={key}). */
  onSelectOnGlobe: (pieceId: string, editionNumber?: number) => void;
}

function pieceLine(p: CodePiece): string {
  if (p.status === 'placed') {
    return p.cityLabel ? `kept in ${p.cityLabel}` : 'kept';
  }
  if (p.status === 'unawakened') {
    return p.cityLabel ? `ember, at rest in ${p.cityLabel}` : 'ember, awaiting its keeper';
  }
  return 'seeking ground';
}

const linkClass =
  'font-label text-[11px] uppercase tracking-[0.18em] font-semibold text-bronze-700 hover:text-bronze-600 transition-colors';

const CodePiecesPanel: React.FC<Props> = ({ codeNumber, codeName, pieces, onSelectOnGlobe }) => {
  if (pieces.length === 0) {
    return (
      <div className="pt-3 pb-1">
        <p className="font-reading text-base text-wood-700 leading-[1.7]">
          Not yet embodied. No piece for {codeName} has been made.
        </p>
        <p className="mt-2">
          <Link to={`/universal-language/${codeNumber}`} className={linkClass}>
            Read the code →
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="pt-3 pb-1">
      <ul className="flex flex-col gap-y-3">
        {pieces.map((p) => {
          const onGlobe = p.status === 'placed' || p.status === 'unawakened';
          const editionLabel =
            typeof p.editionNumber === 'number' ? `Edition ${p.editionNumber}` : null;
          const cleanTitle = p.title.replace(/\s*-\s*\d+\s*$/, '');
          const piecePath = `/piece/${p.pieceId}${
            typeof p.editionNumber === 'number' ? `/${p.editionNumber}` : ''
          }`;

          return (
            <li key={p.key} className="border-l-2 border-wood-200 pl-4">
              <p className="font-reading text-base text-wood-900 leading-snug">
                {cleanTitle}
                {editionLabel && (
                  <span className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-600 ml-2">
                    {editionLabel}
                  </span>
                )}
              </p>
              <p className="font-reading text-sm text-wood-700 mt-0.5">{pieceLine(p)}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                {onGlobe && (
                  <>
                    <button type="button" onClick={() => onSelectOnGlobe(p.pieceId, p.editionNumber)} className={linkClass}>
                      On the globe
                    </button>
                    <span aria-hidden className="text-wood-400">·</span>
                  </>
                )}
                <Link to={piecePath} className={linkClass}>
                  {p.status === 'seeking' ? 'Hold it' : 'Its page'}
                </Link>
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-4">
        <Link to={`/universal-language/${codeNumber}`} className={linkClass}>
          Read the code →
        </Link>
      </p>
    </div>
  );
};

export default CodePiecesPanel;
