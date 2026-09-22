import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AccountLayout from './AccountLayout';
import { useAccount } from '../../lib/account/useAccount';

interface HeldPiece {
  id: string;
  pieceId: string;
  editionNumber: number | null;
  title: string;
  cardNumber: number | null;
  artworkImage: string | null;
  restsIn: string | null;
  intention: string | null;
  claimedAt: string | null;
}

const AccountPiecesInner: React.FC = () => {
  const { fetchAuthed, isSignedIn, userId } = useAccount();
  const [pieces, setPieces] = useState<HeldPiece[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const loadedUser = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    if (loadedUser.current !== userId) {
      loadedUser.current = userId;
      setPieces(null);
      setError(null);
    }
    if (!isSignedIn || !userId) return () => { active = false; };
    fetchAuthed('/api/account/pieces', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        if (!Array.isArray(data.pieces)) throw new Error('invalid response');
        if (active) {
          setPieces(data.pieces);
          setError(null);
        }
      })
      .catch(() => {
        if (active) setError('Your pieces could not be loaded right now.');
      });
    return () => {
      active = false;
    };
  }, [fetchAuthed, isSignedIn, retry, userId]);

  if (error && pieces === null) {
    return (
      <p className="font-reading text-wood-700">
        {error} <button type="button" className="text-bronze-600 underline" onClick={() => setRetry((n) => n + 1)}>Try again</button>
      </p>
    );
  }

  if (pieces === null) {
    return <p className="font-reading text-wood-700">Loading…</p>;
  }

  if (pieces.length === 0) {
    return (
      <p className="font-reading text-lg text-wood-700 leading-relaxed max-w-md">
        No pieces held under this account yet.{' '}
        <a
          href={
            isSignedIn
              ? `/api/auth/handoff?next=${encodeURIComponent(
                  '/creations/multidimensional-art/universal-language',
                )}`
              : 'https://adrianrasmussen.com/creations/multidimensional-art/universal-language'
          }
          className="text-bronze-600 hover:text-bronze-700"
        >
          See the work
        </a>
        .
      </p>
    );
  }

  return (
    <>
      {error && <p className="font-reading text-wood-700 mb-4" role="alert">{error} <button type="button" className="text-bronze-600 underline" onClick={() => setRetry((n) => n + 1)}>Try again</button></p>}
      <ul className="divide-y divide-wood-200/70 border-y border-wood-200/70">
      {pieces.map((piece) => (
        <li key={piece.id} className="py-8 first:pt-0 last:pb-0">
          <div className="flex flex-col sm:flex-row gap-6">
            {piece.artworkImage && (
              <img
                src={piece.artworkImage}
                alt={piece.title}
                className="w-full sm:w-40 h-40 object-cover rounded flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <h2 className="font-display text-2xl text-wood-900 leading-tight">
                {piece.title}
              </h2>
              <p className="font-reading text-sm text-wood-600 mt-1">
                {piece.editionNumber != null && piece.editionNumber > 0
                  ? `Edition ${piece.editionNumber}`
                  : 'Unique piece'}
                {piece.restsIn ? ` · rests in ${piece.restsIn}` : ''}
              </p>

              {piece.intention && (
                <p className="font-reading text-lg text-wood-900 leading-relaxed mt-4 max-w-md whitespace-pre-line">
                  {piece.intention}
                </p>
              )}

              {piece.cardNumber != null && (
                <Link
                  to={`/universal-language/${piece.cardNumber}`}
                  className="inline-block font-reading text-base text-bronze-600 hover:text-bronze-700 mt-4"
                >
                  Read Code {piece.cardNumber}
                </Link>
              )}
            </div>
          </div>
        </li>
      ))}
      </ul>
    </>
  );
};

const AccountPieces: React.FC = () => (
  <AccountLayout title="Your pieces">
    <AccountPiecesInner />
  </AccountLayout>
);

export default AccountPieces;
