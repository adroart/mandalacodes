import React, { useEffect, useState } from 'react';
import type { StewardRecord } from '../../types';

/**
 * Holder-facing claim requests (M4) — rendered inside StewardEdit for the
 * currently selected piece.
 *
 * Lists pending stewardship requests routed to THIS holder (anti-takeover:
 * the current holder, not the admin, decides whether their piece moves).
 * Approving asks for the transfer kind — was it sold or given? — because
 * the holder is the one who knows; the server records the audited
 * `transferred` event and re-binds the record to the requester, so an
 * approval hands over the piece's book in the same click. Declines just
 * close the request.
 */

interface HolderRequest {
  id: string;
  pieceId: string;
  editionNumber?: number;
  requesterEmail: string;
  note?: string;
  createdAt: string;
}

interface StewardRequestsProps {
  steward: StewardRecord;
  getToken: () => Promise<string | null>;
  /** Called after an approval — the piece no longer belongs to this user. */
  onTransferred: () => void;
}

const StewardRequests: React.FC<StewardRequestsProps> = ({
  steward,
  getToken,
  onTransferred,
}) => {
  const [requests, setRequests] = useState<HolderRequest[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [transferKind, setTransferKind] = useState<'sale' | 'gift'>('sale');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch('/api/atlas/steward/claim-requests', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (cancelled || !data?.ok) return;
        setRequests(data.requests ?? []);
      } catch {
        // Quiet failure — the panel simply doesn't render.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const forThisPiece = requests.filter(
    (r) =>
      r.pieceId === steward.pieceId &&
      (r.editionNumber ?? undefined) === (steward.editionNumber ?? undefined),
  );
  if (forThisPiece.length === 0) return null;

  const resolve = async (requestId: string, approve: boolean) => {
    setBusyId(requestId);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/atlas/steward/resolve-claim-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          requestId,
          approve,
          ...(approve ? { transferKind } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setRequests(prev => prev.filter(r => r.id !== requestId));
      setConfirmingId(null);
      if (approve) onTransferred();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mb-10 print:hidden">
      <span className="block font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 font-semibold mb-3">
        Requests
      </span>
      <p className="font-serif text-base text-stone-700 leading-[1.6] mb-4">
        Someone has asked to become this piece's steward. Only you can pass
        it on — approving hands them the book.
      </p>

      {error && (
        <p className="font-serif italic text-sm text-stone-600 mb-3">{error}</p>
      )}

      <ul className="space-y-4">
        {forThisPiece.map((r) => (
          <li key={r.id} className="border border-wood-200 bg-white p-5">
            <p className="font-sans text-sm text-wood-900 mb-1">
              {r.requesterEmail}
            </p>
            <p className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-400 mb-3">
              {new Date(r.createdAt).toLocaleDateString()}
            </p>
            {r.note && (
              <p className="font-serif italic text-sm text-wood-700 mb-4">
                “{r.note}”
              </p>
            )}

            {confirmingId === r.id ? (
              <div className="space-y-3">
                <div>
                  <span className="block font-label text-[11px] uppercase tracking-[0.15em] text-wood-600 font-semibold mb-2">
                    How did it pass to them?
                  </span>
                  <div className="flex gap-2">
                    {(['sale', 'gift'] as const).map((kind) => (
                      <button
                        key={kind}
                        type="button"
                        aria-pressed={transferKind === kind}
                        onClick={() => setTransferKind(kind)}
                        className={`min-h-[44px] px-4 py-2 border font-sans text-sm transition-colors focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 ${
                          transferKind === kind
                            ? 'bg-bronze-100 border-bronze-500 text-wood-900'
                            : 'bg-white border-wood-300 text-wood-700 hover:bg-paper-100'
                        }`}
                      >
                        {kind === 'sale' ? 'I sold it' : 'I gave it'}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="font-serif italic text-sm text-stone-600">
                  This passes the piece — and its book — to them. The record
                  of your time with it stays in the piece's history.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => resolve(r.id, true)}
                    disabled={busyId === r.id}
                    className="flex-1 min-h-[44px] bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 hover:bg-bronze-700 transition-colors disabled:opacity-40"
                  >
                    {busyId === r.id ? 'Passing it on...' : 'Yes, pass it on'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    disabled={busyId === r.id}
                    className="flex-1 min-h-[44px] border border-wood-300 text-wood-700 font-label text-xs uppercase tracking-[0.15em] font-semibold py-3 hover:border-wood-500 hover:text-wood-900 transition-colors disabled:opacity-40"
                  >
                    Not yet
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmingId(r.id)}
                  disabled={busyId === r.id}
                  className="flex-1 min-h-[44px] bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 hover:bg-bronze-700 transition-colors disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => resolve(r.id, false)}
                  disabled={busyId === r.id}
                  className="flex-1 min-h-[44px] border border-wood-300 text-wood-700 font-label text-xs uppercase tracking-[0.15em] font-semibold py-3 hover:border-wood-500 hover:text-wood-900 transition-colors disabled:opacity-40"
                >
                  Decline
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default StewardRequests;
