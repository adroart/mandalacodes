import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAccount } from '../../lib/account/useAccount';
import SignInTrigger from '../account/SignInTrigger';
import AtlasMovedNotice from './AtlasMovedNotice';
import {
  atlasFailureMessage,
  readAtlasBoundary,
  type AtlasBoundary,
} from '../../lib/atlas/boundary';

/**
 * "Request stewardship" (M4): the self-serve path for whoever holds the
 * physical piece without a pre-issued record: secondary buyers, auction
 * winners, gift recipients, heirs. Signed-in visitors send a request (with
 * an optional evidence note) into the queue: the admin decides for
 * unclaimed pieces, the current holder for claimed ones; nothing binds
 * automatically. Anonymous visitors get a sign-in prompt into the
 * self-owned sign-in modal, staying on the page they arrived at.
 *
 * Shared between PiecePage (the piece's own page) and StewardClaim (the
 * no-record recovery path when /atlas/claim carries ?piece= context).
 *
 * `leadIn` tunes the collapsed-state sentence before the trigger:
 *   - undefined (default): the original "Hold this piece but arrived
 *     another way?" copy, unchanged behavior for existing callers.
 *   - a node: rendered in place of that sentence.
 *   - null: no sentence, just the trigger (for callers that render their
 *     own lead-in paragraph above the form).
 */
const RequestStewardship: React.FC<{
  pieceId: string;
  editionNumber?: number;
  leadIn?: React.ReactNode;
}> = ({ pieceId, editionNumber, leadIn }) => {
  const { isSignedIn, fetchAuthed } = useAccount();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [movedBoundary, setMovedBoundary] = useState<AtlasBoundary | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetchAuthed('/api/atlas/steward/request-claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pieceId,
          ...(editionNumber !== undefined ? { editionNumber } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      const boundary = await readAtlasBoundary(res);
      if (boundary) {
        setMovedBoundary(boundary);
        return;
      }
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(
          atlasFailureMessage(res.status, data, 'Something went wrong. Please try again.'),
        );
        return;
      }
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // The honest boundary: stewardship requests live on the artist site now.
  if (movedBoundary) {
    return <AtlasMovedNotice boundary={movedBoundary} align="left" className="mt-4" />;
  }

  if (sent) {
    return (
      <p className="font-reading text-base text-stone-700 tracking-[0.01em] mt-4 leading-[1.6]">
        Your request is in. The piece's current keeper, or Adrian, will
        review it, and the book opens to you once they approve.
      </p>
    );
  }

  return (
    <div className="mt-4">
      {!isSignedIn && (
        /* A secondary owner (auction, gift, inheritance) is NOT pre-bound by
           Adrian, so the email-based /atlas/claim flow 404s for them. Sign in
           in place with a modal and stay on this piece: once signed in the
           signed-in branch below shows the request-stewardship form, which is
           the right path for them. Never send them to /atlas/claim. */
        <p className="font-reading text-sm text-wood-600 leading-[1.6]">
          {leadIn === undefined ? (
            <>
              Hold this piece but arrived another way: an auction, a gift, an
              inheritance?{' '}
            </>
          ) : (
            leadIn && <>{leadIn}{' '}</>
          )}
          <SignInTrigger>
            <button
              type="button"
              className="font-label text-[11px] uppercase tracking-[0.18em] font-semibold text-bronze-700 hover:text-bronze-600 transition-colors"
            >
              Sign in to request stewardship →
            </button>
          </SignInTrigger>
        </p>
      )}
      {isSignedIn && (
        !open ? (
          <p className="font-reading text-sm text-wood-600 leading-[1.6]">
            {leadIn === undefined ? (
              <>Hold this piece but arrived another way?{' '}</>
            ) : (
              leadIn && <>{leadIn}{' '}</>
            )}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="font-label text-[11px] uppercase tracking-[0.18em] font-semibold text-bronze-700 hover:text-bronze-600 transition-colors"
            >
              Request stewardship →
            </button>
          </p>
        ) : (
          <div className="space-y-3">
            <label
              htmlFor="request-note"
              className="block font-label text-[11px] uppercase tracking-[0.18em] text-wood-600 font-semibold"
            >
              How did it come to you? (optional)
            </label>
            <textarea
              id="request-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Bought at the Vienna auction, lot 12…"
              className="w-full border border-wood-300 bg-wood-50 px-4 py-3 font-reading text-base text-wood-900 placeholder:text-wood-400 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 focus:border-bronze-400 resize-y"
            />
            {error && (
              <p className="font-reading font-medium text-sm text-stone-600">{error}</p>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="inline-block font-label text-xs uppercase tracking-[0.18em] font-semibold text-paper-50 bg-wood-900 hover:bg-wood-800 transition-colors px-6 py-3 disabled:opacity-40"
            >
              {busy ? 'Sending...' : 'Send request'}
            </button>
          </div>
        )
      )}

      {/* The Homecoming door: for whoever holds a piece the atlas has never
          heard of, where even a stewardship request has no piece to point at.
          The one quiet way out of the no-record dead-end. */}
      <p className="font-reading text-sm text-wood-500 leading-[1.6] mt-6">
        Holding a piece we do not know?{' '}
        <Link
          to="/atlas/homecoming"
          className="font-label text-[11px] uppercase tracking-[0.18em] font-semibold text-bronze-700 hover:text-bronze-600 transition-colors"
        >
          Bring it home →
        </Link>
      </p>
    </div>
  );
};

export default RequestStewardship;
