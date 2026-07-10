import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AtlasLetter,
  HeirRegistration,
  LedgerEvent,
  PieceRecord,
  StewardRecord,
} from '../../types';
import type { InscriptionView, InscriptionKind } from '../../utils/inscriptions';
import { getCityById, formatPlaceLabel } from '../../data/cities';
import { FULL_ARCHIVE } from '../../data/mockData';

/**
 * LegacyBook — the Ring 1 living record inside the steward edit page (M3).
 *
 * Three parts, all private to the bound steward:
 *   - the Legacy timeline: the piece's whole book in chronological order —
 *     creation, claim, placements, transfers, and every inscription the
 *     current holder may read (erased entries render as tombstones, sealed
 *     time capsules show their seal line instead of the body, and past
 *     authors appear as "first steward" / "second steward" — never names).
 *   - the add-entry form: kind selector (intention / story / dedication),
 *     the entry itself, and an optional time-capsule seal (a date, or
 *     "until the piece is passed on").
 *   - "Pass it on": heir registrations — a hint for whoever settles the
 *     steward's estate; the transfer itself always happens through the
 *     artist.
 *
 * Plus the export pair: download the book as self-verifying JSON, or print
 * it (a print-only rendering of the same book; everything else on the page
 * is print-hidden).
 */

type StewardView = Omit<StewardRecord, 'notes'>;

interface LegacyBookProps {
  steward: StewardView;
  piece: PieceRecord;
  fetchAuthed: (input: string, init?: RequestInit) => Promise<Response>;
  /** Called with the updated record after a heir add/revoke. */
  onStewardUpdate: (steward: StewardView) => void;
}

type TimelineItem =
  | { type: 'event'; date: string; label: string }
  | { type: 'inscription'; date: string; view: InscriptionView };

const KIND_LABELS: Record<InscriptionKind, string> = {
  intention: 'Intention',
  story: 'Story',
  dedication: 'Dedication',
};

const LETTER_KIND_LABELS: Record<AtlasLetter['kind'], string> = {
  'kin-claim': 'A kin came to light',
  anniversary: 'An anniversary',
  transfer: 'A change of hands',
  tending: 'A word about its words',
  'words-anniversary': 'Its words, a year on',
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const placeLabel = (cityId: string | null | undefined): string | null => {
  if (!cityId) return null;
  const place = getCityById(cityId);
  return place ? formatPlaceLabel(place) : null;
};

const eventLabel = (e: LedgerEvent): string | null => {
  switch (e.type) {
    case 'created':
      return 'Created';
    case 'claimed':
      return 'Claimed — the piece found its steward';
    case 'placed': {
      const p = placeLabel(e.cityId);
      return p ? `Placed in ${p}` : 'Placed';
    }
    case 'moved': {
      const p = placeLabel(e.cityId);
      return p ? `Moved to ${p}` : 'Moved';
    }
    case 'transferred':
      return 'Passed on to a new steward';
    case 'retired':
      return 'Retired';
    default:
      // withdrawn / revealed are map-visibility mechanics, and inscribed
      // events surface through the inscriptions list (with their content).
      return null;
  }
};

const LegacyBook: React.FC<LegacyBookProps> = ({
  steward,
  piece,
  fetchAuthed,
  onStewardUpdate,
}) => {
  const [inscriptions, setInscriptions] = useState<InscriptionView[] | null>(null);
  const [loadNote, setLoadNote] = useState<string | null>(null);

  // Share on the map (M6, Lens 2): inscriptionId → shared. Seeded lazily
  // (nothing fetched for this on load); the toggle trusts the endpoint's
  // own response for the next state. No indication yet whether an entry
  // already rides the map until the steward acts on it here.
  const [shared, setShared] = useState<Record<string, boolean>>({});
  const [shareBusy, setShareBusy] = useState<string | null>(null);
  const [shareError, setShareError] = useState<Record<string, string>>({});
  const [everShared, setEverShared] = useState(false);

  // Words-anniversary letters (Phase 2 item D): local, per-letter
  // acknowledgment for "keep carrying them". Reading the letter is already
  // the consent (readAt, no new endpoint), so this is a quiet UI dismissal,
  // never a network call. "return them to the book" reuses the same
  // share-intention withdraw path as the timeline's own toggle below.
  const [wordsLetterAck, setWordsLetterAck] = useState<Record<string, boolean>>({});

  // Add-entry form
  const [kind, setKind] = useState<InscriptionKind>('intention');
  const [body, setBody] = useState('');
  const [sealMode, setSealMode] = useState<'none' | 'date' | 'transfer'>('none');
  const [sealDate, setSealDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Heir form
  const [heirEmail, setHeirEmail] = useState('');
  const [heirName, setHeirName] = useState('');
  const [heirBusy, setHeirBusy] = useState(false);
  const [heirError, setHeirError] = useState<string | null>(null);

  const [exportError, setExportError] = useState<string | null>(null);

  // Letters — the piece writes back (M5). Generated on the server lazily on
  // read (anniversary / transfer) and on kin claims elsewhere; here we load,
  // show the unread badge, and mark read when the steward opens the section.
  const [letters, setLetters] = useState<AtlasLetter[] | null>(null);
  const [lettersOpen, setLettersOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const query = useMemo(() => {
    const params = new URLSearchParams({ pieceId: steward.pieceId });
    if (steward.editionNumber != null) {
      params.set('editionNumber', String(steward.editionNumber));
    }
    return params.toString();
  }, [steward.pieceId, steward.editionNumber]);

  const authedFetch = useCallback(
    async (input: string, init?: RequestInit) => {
      return fetchAuthed(input, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers ?? {}),
        },
      });
    },
    [fetchAuthed],
  );

  const loadInscriptions = useCallback(async () => {
    setLoadNote(null);
    try {
      const res = await authedFetch(`/api/atlas/steward/inscriptions?${query}`);
      if (res.status === 503) {
        setInscriptions([]);
        setLoadNote('The written record opens once the archive is ready.');
        return;
      }
      if (!res.ok) {
        setInscriptions([]);
        setLoadNote('Could not load the written record right now.');
        return;
      }
      const data = (await res.json()) as { inscriptions?: InscriptionView[] };
      setInscriptions(data.inscriptions ?? []);
    } catch {
      setInscriptions([]);
      setLoadNote('Could not load the written record right now.');
    }
  }, [authedFetch, query]);

  useEffect(() => {
    setInscriptions(null);
    loadInscriptions();
  }, [loadInscriptions]);

  // === Letters ===

  const loadLetters = useCallback(async () => {
    try {
      const res = await authedFetch(`/api/atlas/steward/letters?${query}`);
      if (!res.ok) {
        setLetters([]);
        setUnread(0);
        return;
      }
      const data = (await res.json()) as { letters?: AtlasLetter[]; unread?: number };
      setLetters(data.letters ?? []);
      setUnread(data.unread ?? 0);
    } catch {
      setLetters([]);
      setUnread(0);
    }
  }, [authedFetch, query]);

  useEffect(() => {
    setLetters(null);
    setLettersOpen(false);
    setUnread(0);
    loadLetters();
  }, [loadLetters]);

  /* Unread letters open themselves on arrival: a new steward should meet
     "the piece writes back" without having to discover a collapsed button.
     Opening marks them read, same as a click would. */
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current || lettersOpen) return;
    if (letters !== null && unread > 0) {
      autoOpened.current = true;
      handleOpenLetters();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letters, unread, lettersOpen]);

  const handleOpenLetters = useCallback(async () => {
    setLettersOpen(true);
    if (unread === 0) return;
    // Mark read on open. Optimistic locally; reconcile from the response.
    setUnread(0);
    try {
      const res = await authedFetch('/api/atlas/steward/letters', {
        method: 'POST',
        body: JSON.stringify({
          pieceId: steward.pieceId,
          ...(steward.editionNumber != null
            ? { editionNumber: steward.editionNumber }
            : {}),
          markRead: true,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { letters?: AtlasLetter[] };
        if (data.letters) setLetters(data.letters);
      }
    } catch {
      // Non-fatal — the badge already cleared locally.
    }
  }, [authedFetch, unread, steward.pieceId, steward.editionNumber]);

  // === Timeline (book pages, oldest first) ===

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];
    for (const e of piece.history) {
      const label = eventLabel(e);
      if (label) items.push({ type: 'event', date: e.date, label });
    }
    for (const view of inscriptions ?? []) {
      items.push({ type: 'inscription', date: view.createdAt, view });
    }
    items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return items;
  }, [piece.history, inscriptions]);

  // === Add entry ===

  const handleInscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const trimmed = body.trim();
    if (!trimmed) {
      setFormError('Write something first.');
      return;
    }
    if (sealMode === 'date' && !sealDate) {
      setFormError('Pick the date the seal should open.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await authedFetch('/api/atlas/steward/inscribe', {
        method: 'POST',
        body: JSON.stringify({
          pieceId: steward.pieceId,
          ...(steward.editionNumber != null
            ? { editionNumber: steward.editionNumber }
            : {}),
          kind,
          body: trimmed,
          ...(sealMode === 'date' ? { sealedUntil: sealDate } : {}),
          ...(sealMode === 'transfer' ? { sealUntilTransfer: true } : {}),
        }),
      });
      if (res.status === 503) {
        setFormError('The archive is not ready yet — your entry was not saved.');
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setFormError(data?.error ?? 'Something went wrong, please try again.');
        return;
      }
      setBody('');
      setSealMode('none');
      setSealDate('');
      await loadInscriptions();
    } catch {
      setFormError('Something went wrong, please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // === Share on the map ===

  const handleToggleShare = async (view: InscriptionView, nextShare: boolean) => {
    if (shareBusy) return;
    setShareBusy(view.id);
    setShareError((prev) => {
      const { [view.id]: _drop, ...rest } = prev;
      return rest;
    });
    try {
      const res = await authedFetch('/api/atlas/steward/share-intention', {
        method: 'POST',
        body: JSON.stringify({
          pieceId: steward.pieceId,
          ...(steward.editionNumber != null
            ? { editionNumber: steward.editionNumber }
            : {}),
          inscriptionId: view.id,
          share: nextShare,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; shared?: boolean; error?: string }
        | null;
      if (!res.ok || !data?.ok) {
        setShareError((prev) => ({
          ...prev,
          [view.id]: data?.error ?? 'Something went wrong, please try again.',
        }));
        return;
      }
      setShared((prev) => ({ ...prev, [view.id]: data.shared ?? nextShare }));
      if (data.shared ?? nextShare) setEverShared(true);
    } catch {
      setShareError((prev) => ({
        ...prev,
        [view.id]: 'Something went wrong, please try again.',
      }));
    } finally {
      setShareBusy(null);
    }
  };

  // The one live shared-intention entry currently riding the map for this
  // piece, if any. This is what a words-anniversary letter's "return them
  // to the book" action withdraws. Mirrors the same shared-state-wins rule
  // `renderEntry` uses per row, just resolved once across the whole
  // inscriptions list (only one entry can be live per piece).
  const liveSharedView = useMemo(
    () =>
      inscriptions?.find(
        (v) =>
          v.kind === 'intention' &&
          (shared[v.id] ?? (v as { shared?: boolean }).shared ?? false),
      ) ?? null,
    [inscriptions, shared],
  );

  // "Keep carrying them" is a quiet local acknowledgment, never a network
  // call: reading the letter (readAt, already set on open) is itself the
  // consent to keep carrying the words for another year. No new endpoint.
  const handleKeepWords = (letterId: string) => {
    setWordsLetterAck((prev) => ({ ...prev, [letterId]: true }));
  };

  // === Heirs ===

  const activeHeirs = (steward.heirs ?? []).filter((h) => h.status !== 'revoked');

  const postHeirChange = async (payload: Record<string, unknown>) => {
    setHeirBusy(true);
    setHeirError(null);
    try {
      const res = await authedFetch('/api/atlas/steward/update', {
        method: 'POST',
        body: JSON.stringify({
          pieceId: steward.pieceId,
          ...(steward.editionNumber != null
            ? { editionNumber: steward.editionNumber }
            : {}),
          ...payload,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; steward?: StewardView; error?: string }
        | null;
      if (!res.ok || !data?.ok || !data.steward) {
        setHeirError(data?.error ?? 'Something went wrong, please try again.');
        return;
      }
      onStewardUpdate(data.steward);
      setHeirEmail('');
      setHeirName('');
    } catch {
      setHeirError('Something went wrong, please try again.');
    } finally {
      setHeirBusy(false);
    }
  };

  const handleAddHeir = (e: React.FormEvent) => {
    e.preventDefault();
    if (heirBusy) return;
    const email = heirEmail.trim();
    if (!email) {
      setHeirError('An email is needed.');
      return;
    }
    postHeirChange({
      addHeir: { email, ...(heirName.trim() ? { name: heirName.trim() } : {}) },
    });
  };

  const handleRevokeHeir = (heir: HeirRegistration) => {
    if (heirBusy) return;
    postHeirChange({ revokeHeir: { email: heir.email } });
  };

  // === Export ===

  const handleDownload = async () => {
    setExportError(null);
    try {
      const res = await authedFetch(`/api/atlas/steward/export?${query}`);
      if (!res.ok) {
        setExportError('Could not export the book right now.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `piece-book-${steward.pieceId}${
        steward.editionNumber != null ? `-ed${steward.editionNumber}` : ''
      }.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('Could not export the book right now.');
    }
  };

  const artwork = useMemo(
    () => FULL_ARCHIVE.find((a) => a.id === steward.pieceId),
    [steward.pieceId],
  );
  const bookTitle = artwork?.title ?? steward.pieceId;

  // === Shared timeline rendering (screen + print) ===

  const renderEntry = (item: TimelineItem, idx: number, print: boolean) => {
    const dateCls = print
      ? 'text-[10px] uppercase tracking-[0.2em] text-stone-500'
      : 'font-label text-[10px] uppercase tracking-[0.2em] text-stone-500';
    if (item.type === 'event') {
      return (
        <li key={`e-${idx}`} className="py-3">
          <span className={dateCls}>{formatDate(item.date)}</span>
          <p className="font-serif text-[1.0625rem] leading-relaxed text-stone-700">
            {item.label}
          </p>
        </li>
      );
    }
    const { view } = item;
    const canShare =
      !print &&
      view.state === 'readable' &&
      view.kind === 'intention' &&
      view.authoredByYou;
    // Session toggles win; otherwise the server's word on whether these
    // words already ride the map (the `shared` flag on the listing).
    const isShared =
      shared[view.id] ?? (view as { shared?: boolean }).shared ?? false;
    return (
      <li key={view.id} className="py-3">
        <span className={dateCls}>
          {formatDate(item.date)} · {KIND_LABELS[view.kind]} ·{' '}
          {view.authoredByYou ? 'you' : view.attribution}
        </span>
        {view.state === 'erased' ? (
          <p className="font-serif italic text-base text-stone-500">[entry removed]</p>
        ) : view.body !== undefined ? (
          <>
            <p className="font-serif text-[1.0625rem] leading-relaxed text-wood-900 whitespace-pre-line">
              {view.body}
            </p>
            {view.state === 'sealed' && (
              <p className="font-serif italic text-sm text-stone-500 mt-1">
                {view.sealedLabel} — only you can read it until then.
              </p>
            )}
          </>
        ) : (
          <p className="font-serif italic text-base text-stone-500">
            {view.sealedLabel ?? 'sealed'}
          </p>
        )}
        {canShare && (
          <div className="mt-2">
            {!isShared && !everShared && (
              <p className="font-serif italic text-sm text-stone-500 mb-1">
                The map carries dreams. Words about a business, a place, or a
                name have their own homes and will not live in this space.
              </p>
            )}
            {isShared ? (
              <p className="font-sans text-sm text-wood-700">
                The piece carries these words on the map.{' '}
                <button
                  type="button"
                  onClick={() => handleToggleShare(view, false)}
                  disabled={shareBusy === view.id}
                  className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-500 hover:text-wood-900 hover:underline focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 disabled:opacity-60"
                >
                  take them back
                </button>
              </p>
            ) : (
              <button
                type="button"
                onClick={() => handleToggleShare(view, true)}
                disabled={shareBusy === view.id}
                className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-500 hover:text-wood-900 hover:underline focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 disabled:opacity-60"
              >
                Let the piece carry these words on the map
              </button>
            )}
            {shareError[view.id] && (
              <p className="font-serif italic text-sm text-stone-500 mt-1">
                {shareError[view.id]}
              </p>
            )}
          </div>
        )}
      </li>
    );
  };

  return (
    <>
      {/* ─── Interactive (screen only) ─── */}
      <div className="print:hidden">
        {/* Letters — the piece writes back */}
        {letters !== null && letters.length > 0 && (
          <div className="mb-10 pt-10 border-t border-wood-200">
            <button
              type="button"
              onClick={handleOpenLetters}
              aria-expanded={lettersOpen}
              className="flex items-center gap-3 font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 font-semibold focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2"
            >
              <span>Letters from the piece</span>
              {unread > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-bronze-600 text-paper-50 font-sans text-[11px] font-semibold tracking-normal">
                  {unread}
                </span>
              )}
              <span aria-hidden className="text-wood-400">
                {lettersOpen ? '–' : '+'}
              </span>
            </button>
            {lettersOpen && (
              <ul className="mt-5 space-y-6">
                {letters.map((letter) => (
                  <li
                    key={letter.id}
                    className={`border-l-2 pl-5 py-1 ${
                      letter.readAt ? 'border-wood-200' : 'border-bronze-400'
                    }`}
                  >
                    <span className="font-label text-[10px] uppercase tracking-[0.2em] text-stone-500">
                      {formatDate(letter.createdAt)} · {LETTER_KIND_LABELS[letter.kind]}
                    </span>
                    <p className="font-serif text-[1.0625rem] leading-[1.7] text-wood-900 italic mt-1 whitespace-pre-line">
                      {letter.body}
                    </p>
                    {letter.kind === 'words-anniversary' && (
                      <div className="mt-2">
                        {wordsLetterAck[letter.id] ? (
                          <p className="font-serif italic text-sm text-stone-500">
                            The words stay. Thank you for reading.
                          </p>
                        ) : liveSharedView ? (
                          <div className="flex flex-wrap gap-4">
                            <button
                              type="button"
                              onClick={() => handleKeepWords(letter.id)}
                              className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-500 hover:text-wood-900 hover:underline focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2"
                            >
                              keep carrying them
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleShare(liveSharedView, false)}
                              disabled={shareBusy === liveSharedView.id}
                              className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-500 hover:text-wood-900 hover:underline focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 disabled:opacity-60"
                            >
                              return them to the book
                            </button>
                          </div>
                        ) : (
                          <p className="font-serif italic text-sm text-stone-500">
                            These words already rest back in the book.
                          </p>
                        )}
                        {liveSharedView && shareError[liveSharedView.id] && (
                          <p className="font-serif italic text-sm text-stone-500 mt-1">
                            {shareError[liveSharedView.id]}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Legacy timeline */}
        <div className="mb-10 pt-10 border-t border-wood-200">
          <span className="block font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 font-semibold mb-3">
            Legacy — the piece&apos;s book
          </span>
          {inscriptions === null ? (
            <p className="font-serif italic text-base text-stone-600">
              opening the book
            </p>
          ) : (
            <>
              {loadNote && (
                <p className="font-serif italic text-sm text-stone-500 mb-2">{loadNote}</p>
              )}
              <ul className="divide-y divide-wood-100">
                {timeline.map((item, i) => renderEntry(item, i, false))}
              </ul>
            </>
          )}
        </div>

        {/* Add an entry */}
        <form onSubmit={handleInscribe} className="mb-10">
          <span className="block font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 font-semibold mb-3">
            Write into the record
          </span>
          <div className="flex flex-wrap gap-2 mb-3" role="radiogroup" aria-label="Entry kind">
            {(Object.keys(KIND_LABELS) as InscriptionKind[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={`min-h-[44px] px-4 py-2 border font-sans text-sm transition-colors focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 ${
                  kind === k
                    ? 'bg-bronze-100 border-bronze-500 text-wood-900'
                    : 'bg-white border-wood-300 text-wood-700 hover:bg-paper-100'
                }`}
              >
                {KIND_LABELS[k]}
              </button>
            ))}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={2000}
            aria-label="Your entry"
            placeholder="What should this piece carry forward?"
            className="w-full border border-wood-300 bg-white px-4 py-3 font-serif text-base text-wood-900 placeholder:text-wood-400 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 focus:border-bronze-400 mb-3"
          />
          <div className="mb-3">
            <label
              htmlFor="seal-mode"
              className="block font-label text-[10px] uppercase tracking-[0.2em] text-stone-500 mb-1"
            >
              Time capsule (optional)
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <select
                id="seal-mode"
                value={sealMode}
                onChange={(e) => setSealMode(e.target.value as typeof sealMode)}
                className="min-h-[44px] border border-wood-300 bg-white px-3 py-2 font-sans text-sm text-wood-800 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2"
              >
                <option value="none">Open — readable now</option>
                <option value="date">Sealed until a date</option>
                <option value="transfer">Sealed until the piece is passed on</option>
              </select>
              {sealMode === 'date' && (
                <input
                  type="date"
                  value={sealDate}
                  onChange={(e) => setSealDate(e.target.value)}
                  aria-label="Seal opens on"
                  className="min-h-[44px] border border-wood-300 bg-white px-3 py-2 font-sans text-sm text-wood-800 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2"
                />
              )}
            </div>
            {sealMode === 'transfer' && (
              <p className="font-serif italic text-sm text-stone-500 mt-1">
                A letter to whoever inherits the piece — it opens for them, not before.
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="min-h-[44px] px-6 py-2 bg-wood-900 text-paper-50 font-label text-[11px] uppercase tracking-[0.2em] font-semibold hover:bg-wood-800 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 disabled:opacity-60"
          >
            {submitting ? 'Inscribing…' : 'Inscribe'}
          </button>
          {formError && (
            <p className="font-serif italic text-base text-stone-600 mt-2">{formError}</p>
          )}
        </form>

        {/* Pass it on — heirs */}
        <div className="mb-10">
          <span className="block font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 font-semibold mb-2">
            Pass it on
          </span>
          <p className="font-serif italic text-sm text-stone-600 mb-4">
            A hint for whoever settles your estate — the transfer itself always
            happens through the artist.
          </p>
          {activeHeirs.length > 0 && (
            <ul className="mb-4 divide-y divide-wood-100">
              {activeHeirs.map((h) => (
                <li key={`${h.email}-${h.registeredAt}`} className="py-2 flex items-center justify-between gap-3">
                  <span className="font-sans text-sm text-wood-800">
                    {h.name ? `${h.name} · ${h.email}` : h.email}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRevokeHeir(h)}
                    disabled={heirBusy}
                    className="font-label text-[10px] uppercase tracking-[0.15em] text-stone-500 hover:text-wood-900 hover:underline focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 disabled:opacity-60"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={handleAddHeir} className="flex flex-wrap gap-2">
            <input
              type="email"
              value={heirEmail}
              onChange={(e) => setHeirEmail(e.target.value)}
              placeholder="heir@example.com"
              aria-label="Heir email"
              className="flex-1 min-w-[200px] min-h-[44px] border border-wood-300 bg-white px-4 py-2 font-sans text-sm text-wood-900 placeholder:text-wood-400 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2"
            />
            <input
              type="text"
              value={heirName}
              onChange={(e) => setHeirName(e.target.value)}
              placeholder="Name (optional)"
              aria-label="Heir name"
              className="flex-1 min-w-[140px] min-h-[44px] border border-wood-300 bg-white px-4 py-2 font-sans text-sm text-wood-900 placeholder:text-wood-400 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2"
            />
            <button
              type="submit"
              disabled={heirBusy}
              className="min-h-[44px] px-5 py-2 border border-wood-300 bg-white font-label text-[11px] uppercase tracking-[0.2em] text-wood-700 font-semibold hover:bg-paper-100 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 disabled:opacity-60"
            >
              Register
            </button>
          </form>
          {heirError && (
            <p className="font-serif italic text-base text-stone-600 mt-2">{heirError}</p>
          )}
        </div>

        {/* Export */}
        <div className="mb-10">
          <span className="block font-label text-[11px] uppercase tracking-[0.2em] text-wood-600 font-semibold mb-2">
            Your book, in your hands
          </span>
          <p className="font-serif italic text-sm text-stone-600 mb-4">
            The record travels with the piece — and you can always hold a copy
            yourself, independent of any server.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleDownload}
              className="min-h-[44px] px-5 py-2 border border-wood-300 bg-white font-label text-[11px] uppercase tracking-[0.2em] text-wood-700 font-semibold hover:bg-paper-100 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2"
            >
              Download the book (JSON)
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[44px] px-5 py-2 border border-wood-300 bg-white font-label text-[11px] uppercase tracking-[0.2em] text-wood-700 font-semibold hover:bg-paper-100 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2"
            >
              Print / save as PDF
            </button>
          </div>
          {exportError && (
            <p className="font-serif italic text-base text-stone-600 mt-2">{exportError}</p>
          )}
        </div>
      </div>

      {/* ─── Printable book (print only) ─── */}
      <div className="hidden print:block text-black bg-white">
        <h1
          className="text-3xl font-medium text-center mb-1"
          style={{ fontFamily: 'Cinzel, serif', letterSpacing: '0.08em' }}
        >
          {bookTitle}
        </h1>
        <p className="font-serif text-center text-sm mb-1">
          {[
            artwork?.series,
            steward.editionNumber != null ? `Edition ${steward.editionNumber}` : null,
            artwork?.year,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p className="font-serif italic text-center text-sm mb-8">
          The living record of this piece — printed {formatDate(new Date().toISOString())}
        </p>
        <ul>{timeline.map((item, i) => renderEntry(item, i, true))}</ul>
        <p className="font-serif italic text-xs mt-10 pt-4 border-t border-stone-300">
          This book is an export of an append-only, hash-chained record. The
          full machine-verifiable copy (every event with its SHA-256 chain
          hashes) is available as a JSON download from the piece&apos;s page —
          the chain&apos;s own hashes are its proof of integrity.
        </p>
      </div>
    </>
  );
};

export default LegacyBook;
