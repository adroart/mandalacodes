import React, { useEffect, useState } from 'react';
import { useAccount } from '../lib/account/useAccount';
import AdminLayout from './AdminLayout';
import TypeaheadPicker from './shared/TypeaheadPicker';
import { CITIES, getCityById } from '../data/cities';
import { FULL_ARCHIVE } from '../data/mockData';
import { pieceCode } from '../utils/pieceCode';
import type { SaleQueueItem } from '../utils/saleBridge';
import type { HomecomingRequest } from '../lib/atlas/homecoming';
import type { MakeRequest } from '../lib/atlas/make';
import { atlasFailureMessage } from '../lib/atlas/boundary';
import {
    CATALOG_KINDS,
    CATALOG_KIND_LABELS,
    kindToCodeParts,
} from '../utils/catalog';
import type {
    CatalogEntry,
    CatalogKind,
    CatalogStatus,
    CityCentroid,
    ClaimRequest,
    LedgerEvent,
    LedgerEventType,
    StewardRecord,
} from '../types';

/**
 * Cookie-session fetch hook. Better Auth uses a same-origin session cookie,
 * not a bearer token. fetchAuthed sends `credentials: 'include'` so the
 * cookie rides along on every admin call; the server-side requireAdmin()
 * reads that session + the ADMIN_EMAILS allowlist. No Authorization header.
 */
function useAdminFetch(): (input: string, init?: RequestInit) => Promise<Response> {
  const { fetchAuthed } = useAccount();
  return fetchAuthed;
}

// ───────────────────────────────────────────────────────────────────────────
// Style tokens — mirrored from AdminPoetry.tsx so this page sits beside it
// without drift. Keep these strings identical to that file.
// ───────────────────────────────────────────────────────────────────────────
const fieldLabel =
    'font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold block mb-2';
const fieldInput =
    'w-full border border-wood-300 bg-wood-50 px-4 py-3 font-reading text-sm text-wood-900 placeholder:text-wood-400 focus:outline-none focus:border-bronze-400';
const sectionTitle =
    'font-title text-2xl text-wood-900 mb-2 tracking-[0.05em]';
const sectionLead =
    'font-reading text-sm text-wood-500 mb-6';

const EVENT_TYPES: LedgerEventType[] = [
    'created',
    'placed',
    'moved',
    'withdrawn',
    'revealed',
    'retired',
];

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

interface PieceOption {
    id: string;
    label: string;
}

// Order: drop SOLD pieces to the bottom but keep them selectable.
// Label format: "title (series · year)" (or "title (category · year)" when no series).
const pieceOptions: PieceOption[] = FULL_ARCHIVE
    .map((a) => ({
        id: a.id,
        label: `${a.title} (${a.series ?? a.category} · ${a.year})`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

const pieceById = new Map(FULL_ARCHIVE.map((a) => [a.id, a]));

const resolvePieceTitle = (pieceId: string, editionNumber?: number): string => {
    const a = pieceById.get(pieceId);
    const base = a ? a.title : pieceId;
    return editionNumber ? `${base} · #${editionNumber}` : base;
};

/** The piece's short sigil, e.g. "UL № 1" — the reference printed with the
 *  claim code on the back insert. */
const resolvePieceSigil = (pieceId: string): string => {
    const a = pieceById.get(pieceId);
    if (!a) return pieceId;
    return pieceCode({
        pieceId: a.id,
        series: a.series,
        category: a.category,
        cardNumber: a.cardNumber,
        isSignaturePiece: a.isSignaturePiece,
        sigilNumber: a.sigilNumber,
    });
};

/**
 * The minted claim code, shown ONCE. Styled as a print reference: the code,
 * the piece sigil, and the note that it lives on the back insert. We keep only
 * a hash server-side, so this is the single moment the plaintext exists.
 *
 * "print the insert" opens a print window carrying the working back-insert
 * artifact: the sigil, the grouped code, the private QR deep link
 * (/atlas/claim?piece=...&code=...) so a keeper scans instead of types, and
 * one line of instruction. The canonical host is printed (never the admin
 * origin), and the plaintext never touches disk. The final insert layout is a
 * design artifact Adrian ratifies before a first print run
 * (todo/plans/claim-code-integration.md III.3); this view is the working
 * version so shipping can begin.
 */
const CLAIM_HOST = 'https://mandalacodes.com';

const ClaimCodeReference: React.FC<{
    code: string;
    sigil: string;
    pieceId: string;
    editionNumber?: number;
    onDismiss: () => void;
    /** Fired once the print window for the insert is opened — the Catalog Room
     *  uses it to stamp the entry's printedAt. Optional; a no-op elsewhere. */
    onPrinted?: () => void;
}> = ({ code, sigil, pieceId, editionNumber, onDismiss, onPrinted }) => {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard blocked — the code is selectable below. */
        }
    };
    const printInsert = async () => {
        const pieceParam = editionNumber ? `${pieceId}:${editionNumber}` : pieceId;
        const claimUrl = `${CLAIM_HOST}/atlas/claim?piece=${encodeURIComponent(pieceParam)}&code=${encodeURIComponent(code)}`;
        let qrDataUri = '';
        try {
            const QRCode = (await import('qrcode')).default;
            qrDataUri = await QRCode.toDataURL(claimUrl, {
                width: 260,
                margin: 1,
                color: { dark: '#272219', light: '#f3efe7' },
            });
        } catch {
            /* QR generation failed: the insert still prints with the typed code. */
        }
        const win = window.open('', '_blank', 'width=460,height=700');
        if (!win) return;
        win.document.write(`<!doctype html><html><head><title>${sigil} insert</title>
<style>
  body { margin: 0; background: #fff; }
  .insert { width: 340px; margin: 24px auto; padding: 28px 26px; background: #f3efe7;
    border: 1px solid #c6bca6; text-align: center; color: #272219; }
  .sigil { font-size: 13px; letter-spacing: 0.24em; text-transform: uppercase; color: #956e2a; }
  .code { font-size: 17px; letter-spacing: 0.12em;
    margin: 18px 0 6px; word-break: break-all; }
  .qr { margin: 14px auto 6px; }
  .qr img { width: 168px; height: 168px; }
  .line { font-size: 14px; line-height: 1.5; margin: 14px 8px 0; }
  .host { font-size: 11px; letter-spacing: 0.08em; color: #6b6253; margin-top: 12px; }
  @media print { body { background: #f3efe7; } .insert { border: none; margin: 0 auto; } }
</style></head><body>
<div class="insert">
  <div class="sigil">${sigil}</div>
  <div class="code">${code}</div>
  ${qrDataUri ? `<div class="qr"><img src="${qrDataUri}" alt=""/></div>` : ''}
  <div class="line">Pull this card when the piece is yours. The code brings your dream into it.</div>
  <div class="host">mandalacodes.com/atlas/claim</div>
</div>
<script>window.onload = function () { window.print(); };</script>
</body></html>`);
        win.document.close();
        onPrinted?.();
    };
    return (
        <div className="mb-6 border border-bronze-400 bg-bronze-50 px-4 py-4">
            <p className="font-label text-[10px] uppercase tracking-[0.15em] text-bronze-700 font-semibold mb-2">
                claim code (shown once)
            </p>
            <div className="flex items-center gap-3 flex-wrap">
                <code className="font-technical text-lg tracking-[0.14em] text-wood-900 select-all">
                    {code}
                </code>
                <button
                    type="button"
                    onClick={copy}
                    className="font-label text-[11px] uppercase tracking-[0.15em] text-bronze-700 hover:text-bronze-600 font-semibold"
                >
                    {copied ? 'copied' : 'copy'}
                </button>
                <button
                    type="button"
                    onClick={printInsert}
                    className="font-label text-[11px] uppercase tracking-[0.15em] text-bronze-700 hover:text-bronze-600 font-semibold"
                >
                    print the insert
                </button>
            </div>
            <p className="font-reading text-sm text-wood-700 mt-2 not-italic">
                {sigil} · prints on the back insert
            </p>
            <p className="font-reading text-xs text-stone-600 mt-1 not-italic">
                This is the only time the code is shown. Print or store it now;
                only its hash is kept.
            </p>
            <button
                type="button"
                onClick={onDismiss}
                className="mt-3 font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 hover:text-wood-900 font-semibold"
            >
                Dismiss
            </button>
        </div>
    );
};

/**
 * Piece chooser with a free-text escape hatch. The dropdown stays
 * archive-driven (it grows as the catalog lands), but an uncatalogued piece —
 * one that passed through Adrian's hands before its Artwork row exists — can
 * still be worked on: switch to "enter its id" and type the raw pieceId.
 * Genesis, placement, issue, code mint, and sale confirm all work for a piece
 * before it is catalogued; it simply renders by sigil until the row arrives.
 */
const PieceSelect: React.FC<{
    value: string;
    onChange: (pieceId: string) => void;
}> = ({ value, onChange }) => {
    // Free-text mode is sticky once chosen, and auto-on when the current value
    // is an id the archive does not know.
    const [freeText, setFreeText] = useState(() => !!value && !pieceById.has(value));
    const trimmed = value.trim();
    const uncatalogued = !!trimmed && !pieceById.has(trimmed);

    if (freeText) {
        return (
            <div>
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value.trim())}
                    placeholder="Enter the piece id, e.g. MA-014"
                    className={fieldInput}
                />
                <div className="flex items-center justify-between gap-3 mt-1">
                    {uncatalogued ? (
                        <span className="font-reading text-xs text-stone-500 not-italic">
                            Uncatalogued id — renders by sigil only until its catalog row lands.
                        </span>
                    ) : (
                        <span />
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            setFreeText(false);
                            onChange('');
                        }}
                        className="shrink-0 font-label text-[10px] uppercase tracking-[0.15em] text-wood-500 hover:text-wood-900 font-semibold"
                    >
                        choose from list
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={fieldInput}
            >
                <option value="">Choose a piece...</option>
                {pieceOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                        {p.label}
                    </option>
                ))}
            </select>
            <button
                type="button"
                onClick={() => {
                    setFreeText(true);
                    onChange('');
                }}
                className="mt-1 font-label text-[10px] uppercase tracking-[0.15em] text-bronze-700 hover:text-bronze-600 font-semibold"
            >
                piece not listed? enter its id
            </button>
        </div>
    );
};

const formatNow = (): string => {
    // datetime-local wants 'YYYY-MM-DDTHH:mm' in local time.
    const d = new Date();
    const tz = d.getTimezoneOffset() * 60_000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 16);
};

const formatRelative = (iso: string | null | undefined): string => {
    if (!iso) return '-';
    const ts = new Date(iso).getTime();
    if (Number.isNaN(ts)) return '-';
    const diff = Date.now() - ts;
    const s = Math.round(diff / 1000);
    if (s < 60) return 'just now';
    const m = Math.round(s / 60);
    if (m < 60) return `${m} min ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} hr ago`;
    const days = Math.round(h / 24);
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
    const months = Math.round(days / 30);
    if (months < 12) return `${months} mo ago`;
    const years = Math.round(months / 12);
    return `${years} yr ago`;
};

// ───────────────────────────────────────────────────────────────────────────
// City autocomplete: thin wrapper around the shared TypeaheadPicker
// (components/shared/TypeaheadPicker.tsx). City matching and label
// formatting stay here; the combobox mechanics live in the shared component.
// ───────────────────────────────────────────────────────────────────────────

const cityMatches = (c: CityCentroid, query: string): boolean => {
    const q = query.trim().toLowerCase();
    const hay = `${c.city} ${c.country} ${c.region ?? ''} ${c.id}`.toLowerCase();
    return hay.includes(q);
};

const cityLabel = (c: CityCentroid): string => `${c.city}, ${c.country}`;

const CityAutocomplete: React.FC<{
    value: string;
    onChange: (cityId: string) => void;
    placeholder?: string;
}> = ({ value, onChange, placeholder }) => {
    return (
        <div>
            <TypeaheadPicker<CityCentroid>
                items={CITIES}
                filter={cityMatches}
                itemKey={(c) => c.id}
                itemLabel={cityLabel}
                value={value || null}
                onPick={(c) => onChange(c.id)}
                onQueryChange={() => onChange('')}
                placeholder={placeholder ?? 'Lisbon, Portugal'}
                maxResultsEmpty={8}
                maxResults={12}
                variant="admin"
                renderItem={(c) => (
                    <>
                        {c.city}, {c.country}
                        <span className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-400 ml-2">
                            {c.id}
                        </span>
                    </>
                )}
            />
            {value && (
                <p className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-400 mt-1">
                    Selected: {value}
                </p>
            )}
        </div>
    );
};

// ───────────────────────────────────────────────────────────────────────────
// Seed Event form
// ───────────────────────────────────────────────────────────────────────────

interface EventForm {
    pieceId: string;
    editionNumber: string;
    type: LedgerEventType;
    date: string;
    cityId: string;
    note: string;
}

const EMPTY_EVENT: EventForm = {
    pieceId: '',
    editionNumber: '',
    type: 'created',
    date: formatNow(),
    cityId: '',
    note: '',
};

const SeedEventSection: React.FC = () => {
    const [form, setForm] = useState<EventForm>(EMPTY_EVENT);
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState<LedgerEvent | null>(null);
    const [error, setError] = useState<string | null>(null);
    const adminFetch = useAdminFetch();

    const submit = async () => {
        if (!form.pieceId) {
            setError('Pick a piece.');
            return;
        }
        if (!form.type) {
            setError('Pick an event type.');
            return;
        }
        setSaving(true);
        setError(null);
        setResult(null);
        try {
            const event = {
                id: crypto.randomUUID(),
                pieceId: form.pieceId,
                editionNumber: form.editionNumber
                    ? Number(form.editionNumber)
                    : undefined,
                type: form.type,
                date: form.date
                    ? new Date(form.date).toISOString()
                    : new Date().toISOString(),
                cityId: form.cityId || null,
                note: form.note.trim() || undefined,
                actor: 'admin' as const,
            };
            const res = await adminFetch('/api/atlas/event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event }),
            });
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }
            const data = await res.json();
            if (data?.ok && data.event) {
                setResult(data.event as LedgerEvent);
                setForm({ ...EMPTY_EVENT, date: formatNow() });
            } else {
                setError(atlasFailureMessage(res.status, data, 'Could not append event.'));
            }
        } catch {
            setError('Network error. Check your connection.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-wood-50 border border-wood-200 p-8 mb-10">
            <h2 className={sectionTitle}>Seed Event</h2>
            <p className={sectionLead}>
                Append a new event to the per-piece ledger. The hash chain is
                computed server-side.
            </p>

            {error && (
                <p className="font-reading text-sm text-stone-600 mb-4">
                    {error}
                </p>
            )}

            {result && (
                <div className="mb-6 border border-bronze-300 bg-bronze-50 px-4 py-3">
                    <p className="font-reading text-sm text-bronze-800 mb-2">
                        Event appended.
                    </p>
                    <p className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-500 mb-1">
                        Hash
                    </p>
                    <code className="block font-technical text-xs text-wood-900 break-all">
                        {result.hash}
                    </code>
                </div>
            )}

            <div className="space-y-5">
                <div>
                    <label className={fieldLabel}>Piece</label>
                    <PieceSelect
                        value={form.pieceId}
                        onChange={(id) => setForm({ ...form, pieceId: id })}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={fieldLabel}>Edition number (optional)</label>
                        <input
                            type="number"
                            min={1}
                            value={form.editionNumber}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    editionNumber: e.target.value,
                                })
                            }
                            placeholder="1"
                            className={fieldInput}
                        />
                    </div>
                    <div>
                        <label className={fieldLabel}>Event type</label>
                        <select
                            value={form.type}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    type: e.target.value as LedgerEventType,
                                })
                            }
                            className={fieldInput}
                        >
                            {EVENT_TYPES.map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={fieldLabel}>Date</label>
                        <input
                            type="datetime-local"
                            value={form.date}
                            onChange={(e) =>
                                setForm({ ...form, date: e.target.value })
                            }
                            className={fieldInput}
                        />
                    </div>
                    <div>
                        <label className={fieldLabel}>City</label>
                        <CityAutocomplete
                            value={form.cityId}
                            onChange={(cityId) => setForm({ ...form, cityId })}
                        />
                    </div>
                </div>

                <div>
                    <label className={fieldLabel}>Note (admin-private)</label>
                    <textarea
                        value={form.note}
                        onChange={(e) =>
                            setForm({ ...form, note: e.target.value })
                        }
                        rows={3}
                        placeholder="From Adrian's notebook, p.42"
                        className={`${fieldInput} font-reading text-base leading-[1.7] resize-y`}
                    />
                </div>

                <button
                    onClick={submit}
                    disabled={saving}
                    className="w-full bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 hover:bg-bronze-700 transition-colors disabled:opacity-40"
                >
                    {saving ? 'Appending...' : 'Append event'}
                </button>
            </div>
        </div>
    );
};

// ───────────────────────────────────────────────────────────────────────────
// Issue Steward Key
// ───────────────────────────────────────────────────────────────────────────

interface StewardForm {
    pieceId: string;
    editionNumber: string;
    name: string;
    email: string;
    mintClaimCode: boolean;
}

const EMPTY_STEWARD: StewardForm = {
    pieceId: '',
    editionNumber: '',
    name: '',
    email: '',
    mintClaimCode: false,
};

const IssueStewardKeySection: React.FC<{ onIssued: () => void }> = ({
    onIssued,
}) => {
    const [form, setForm] = useState<StewardForm>(EMPTY_STEWARD);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState<{ email?: string; name?: string } | null>(null);
    // The plaintext claim code, held only until dismissed (shown once).
    const [codeRef, setCodeRef] = useState<{ code: string; sigil: string; pieceId: string; editionNumber?: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const adminFetch = useAdminFetch();

    const submit = async () => {
        if (!form.pieceId) {
            setError('Pick a piece.');
            return;
        }
        // With a claim code, email is optional: the printed code is the
        // credential and the collector's account anchors the bind at claim.
        if (!form.mintClaimCode && !form.email.trim()) {
            setError('Email is required — the collector signs in with it. (Or mint a claim code.)');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const body = {
                pieceId: form.pieceId,
                editionNumber: form.editionNumber
                    ? Number(form.editionNumber)
                    : undefined,
                name: form.name.trim() || undefined,
                email: form.email.trim() || undefined,
                mintClaimCode: form.mintClaimCode || undefined,
            };
            const res = await adminFetch('/api/atlas/stewards/issue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }
            const data = await res.json();
            if (data?.ok && data.record) {
                setSuccess({
                    email: data.record.email,
                    name: data.record.name,
                });
                if (data.claimCode) {
                    setCodeRef({
                        code: data.claimCode,
                        sigil: resolvePieceSigil(form.pieceId),
                        pieceId: form.pieceId,
                        editionNumber: form.editionNumber ? Number(form.editionNumber) : undefined,
                    });
                }
                setForm(EMPTY_STEWARD);
                onIssued();
            } else {
                setError(atlasFailureMessage(res.status, data, 'Could not add steward.'));
            }
        } catch {
            setError('Network error. Check your connection.');
        } finally {
            setSaving(false);
        }
    };

    const dismiss = () => {
        setSuccess(null);
    };

    return (
        <div className="bg-wood-50 border border-wood-200 p-8 mb-10">
            <h2 className={sectionTitle}>Add Steward</h2>
            <p className={sectionLead}>
                Bind a piece to a collector's email. They sign in to
                mandalacodes with that email and the record claims itself on
                first visit to /atlas/claim.
            </p>

            {error && (
                <p className="font-reading text-sm text-stone-600 mb-4">
                    {error}
                </p>
            )}

            {codeRef && (
                <ClaimCodeReference
                    code={codeRef.code}
                    sigil={codeRef.sigil}
                    pieceId={codeRef.pieceId}
                    editionNumber={codeRef.editionNumber}
                    onDismiss={() => setCodeRef(null)}
                />
            )}

            {success && (
                <div className="mb-6 border border-bronze-400 bg-bronze-50 px-4 py-4">
                    <p className="font-label text-[10px] uppercase tracking-[0.15em] text-bronze-700 font-semibold mb-2">
                        Steward added
                    </p>
                    <p className="font-reading text-sm text-wood-900 mb-2 not-italic">
                        {success.email
                            ? success.name
                                ? `${success.name} (${success.email})`
                                : success.email
                            : success.name
                              ? `${success.name} (code only, no email)`
                              : 'code only, no email'}
                    </p>
                    <p className="font-reading text-sm text-stone-700 mb-3 not-italic">
                        {success.email
                            ? 'Send them this link: '
                            : 'They claim with the code on the back insert at: '}
                        <code className="font-technical not-italic">/atlas/claim</code>
                        {success.email
                            ? '. They sign in with the email above and the record binds to their account.'
                            : '. The code authorizes the bind; their account anchors it.'}
                    </p>
                    <button
                        type="button"
                        onClick={dismiss}
                        className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 hover:text-wood-900 font-semibold"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            <div className="space-y-5">
                <div>
                    <label className={fieldLabel}>Piece</label>
                    <PieceSelect
                        value={form.pieceId}
                        onChange={(id) => setForm({ ...form, pieceId: id })}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={fieldLabel}>Edition number (optional)</label>
                        <input
                            type="number"
                            min={1}
                            value={form.editionNumber}
                            onChange={(e) =>
                                setForm({
                                    ...form,
                                    editionNumber: e.target.value,
                                })
                            }
                            placeholder="1"
                            className={fieldInput}
                        />
                    </div>
                    <div>
                        <label className={fieldLabel}>Name (optional)</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(e) =>
                                setForm({ ...form, name: e.target.value })
                            }
                            placeholder="Maya"
                            className={fieldInput}
                        />
                    </div>
                </div>

                <div>
                    <label className={fieldLabel}>
                        {form.mintClaimCode ? 'Email (optional)' : 'Email (required)'}
                    </label>
                    <input
                        type="email"
                        value={form.email}
                        onChange={(e) =>
                            setForm({ ...form, email: e.target.value })
                        }
                        placeholder="collector@example.com"
                        className={fieldInput}
                    />
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={form.mintClaimCode}
                        onChange={(e) =>
                            setForm({ ...form, mintClaimCode: e.target.checked })
                        }
                        className="mt-1"
                    />
                    <span className="font-reading text-sm text-wood-700 not-italic">
                        mint claim code
                        <span className="block font-reading text-xs text-stone-500 not-italic">
                            Prints on the piece's back insert. Shown once on
                            success; only its hash is stored. Email is optional
                            when a code is minted.
                        </span>
                    </span>
                </label>

                <button
                    onClick={submit}
                    disabled={saving}
                    className="w-full bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 hover:bg-bronze-700 transition-colors disabled:opacity-40"
                >
                    {saving ? 'Adding...' : 'Add steward'}
                </button>
            </div>
        </div>
    );
};

// ───────────────────────────────────────────────────────────────────────────
// Pending Sales (M4 — the sale → ledger bridge queue)
// ───────────────────────────────────────────────────────────────────────────

const formatPrice = (priceCents?: number, currency?: string): string => {
    if (priceCents === undefined) return '-';
    const amount = (priceCents / 100).toFixed(2);
    return currency ? `${amount} ${currency}` : amount;
};

/** Prefill the confirm form's piece from the payload: an explicit pieceId
 *  that matches the archive wins; otherwise a SKU that IS an archive id. */
const prefillPieceId = (sale: SaleQueueItem): string => {
    if (sale.pieceId && pieceById.has(sale.pieceId)) return sale.pieceId;
    if (sale.sku && pieceById.has(sale.sku)) return sale.sku;
    return '';
};

const PendingSaleRow: React.FC<{
    sale: SaleQueueItem;
    onResolved: () => void;
}> = ({ sale, onResolved }) => {
    const [pieceId, setPieceId] = useState(() => prefillPieceId(sale));
    const [editionNumber, setEditionNumber] = useState(
        sale.editionNumber !== undefined ? String(sale.editionNumber) : '',
    );
    const [pieceType, setPieceType] = useState<'' | 'mandala' | 'other'>('');
    const [dismissReason, setDismissReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const adminFetch = useAdminFetch();

    const post = async (path: string, body: Record<string, unknown>) => {
        setBusy(true);
        setError(null);
        try {
            const res = await adminFetch(path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }
            const data = await res.json();
            if (data?.ok) {
                onResolved();
            } else {
                setError(atlasFailureMessage(res.status, data, 'Request failed.'));
            }
        } catch {
            setError('Network error. Check your connection.');
        } finally {
            setBusy(false);
        }
    };

    const confirm = () => {
        if (!pieceId) {
            setError('Pick the piece this sale is for.');
            return;
        }
        post('/api/atlas/sales/confirm', {
            saleId: sale.saleId,
            pieceId,
            editionNumber: editionNumber ? Number(editionNumber) : undefined,
            pieceType: pieceType || undefined,
        });
    };

    const dismiss = () => {
        post('/api/atlas/sales/dismiss', {
            saleId: sale.saleId,
            reason: dismissReason.trim() || undefined,
        });
    };

    return (
        <div className="border border-wood-200 p-5 mb-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
                <span className="font-reading text-base text-wood-900">
                    {sale.buyerName ? `${sale.buyerName} (${sale.buyerEmail})` : sale.buyerEmail}
                </span>
                <span className="font-reading text-sm text-wood-500">
                    {formatPrice(sale.priceCents, sale.currency)}
                </span>
                <span className="font-reading text-sm text-wood-500">
                    {sale.saleDate.slice(0, 10)}
                </span>
            </div>
            <p className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-400 mb-4 break-all">
                {sale.saleId}
                {sale.sku ? ` · sku ${sale.sku}` : ''}
            </p>

            {error && (
                <p className="font-reading text-sm text-stone-600 mb-3">{error}</p>
            )}

            <div className="space-y-3">
                <div>
                    <label className={fieldLabel}>Piece</label>
                    <PieceSelect value={pieceId} onChange={setPieceId} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={fieldLabel}>Edition number (optional)</label>
                        <input
                            type="number"
                            min={1}
                            value={editionNumber}
                            onChange={(e) => setEditionNumber(e.target.value)}
                            placeholder="1"
                            className={fieldInput}
                        />
                    </div>
                    <div>
                        <label className={fieldLabel}>Piece type (genesis only)</label>
                        <select
                            value={pieceType}
                            onChange={(e) =>
                                setPieceType(e.target.value as '' | 'mandala' | 'other')
                            }
                            className={fieldInput}
                        >
                            <option value="">derive from series</option>
                            <option value="mandala">mandala</option>
                            <option value="other">other</option>
                        </select>
                    </div>
                </div>
                <button
                    onClick={confirm}
                    disabled={busy}
                    className="w-full bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 hover:bg-bronze-700 transition-colors disabled:opacity-40"
                >
                    {busy ? 'Working...' : 'Confirm sale'}
                </button>
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={dismissReason}
                        onChange={(e) => setDismissReason(e.target.value)}
                        placeholder="Dismiss reason (optional)"
                        className={fieldInput}
                    />
                    <button
                        onClick={dismiss}
                        disabled={busy}
                        className="shrink-0 px-4 border border-wood-300 text-wood-700 font-label text-xs uppercase tracking-[0.15em] font-semibold hover:border-wood-500 hover:text-wood-900 transition-colors disabled:opacity-40"
                    >
                        Dismiss
                    </button>
                </div>
            </div>
        </div>
    );
};

const PendingSalesSection: React.FC = () => {
    const [pending, setPending] = useState<SaleQueueItem[]>([]);
    const [resolved, setResolved] = useState<SaleQueueItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const adminFetch = useAdminFetch();

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminFetch('/api/atlas/sales');
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }
            const data = await res.json();
            if (data?.ok) {
                setPending(data.pending || []);
                setResolved(data.resolved || []);
            } else {
                setError(atlasFailureMessage(res.status, data, 'Could not load the sale queue.'));
            }
        } catch {
            setError('Could not load the sale queue.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="bg-wood-50 border border-wood-200 p-8 mb-10">
            <h2 className={sectionTitle}>Pending Sales</h2>
            <p className={sectionLead}>
                Checkouts reported by adrianrasmussen.com, waiting for your
                confirmation. Confirming issues the steward record (and the
                genesis event for a new piece, or a transfer for a claimed
                one) — nothing fires automatically.
            </p>

            {error && (
                <p className="font-reading text-sm text-stone-600 mb-4">{error}</p>
            )}
            {loading && <p className="font-reading text-sm text-wood-400">Loading...</p>}
            {!loading && !error && pending.length === 0 && (
                <p className="font-reading text-sm text-wood-400">No pending sales.</p>
            )}

            {!loading &&
                pending.map((sale) => (
                    <PendingSaleRow key={sale.saleId} sale={sale} onResolved={load} />
                ))}

            {!loading && resolved.length > 0 && (
                <div className="mt-6 border-t border-wood-100 pt-4">
                    <p className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold mb-2">
                        Recently resolved
                    </p>
                    <ul className="space-y-1">
                        {resolved.map((s) => (
                            <li
                                key={s.saleId}
                                className="font-reading text-sm text-wood-500"
                            >
                                {s.status} · {s.buyerEmail} ·{' '}
                                {formatPrice(s.priceCents, s.currency)}
                                {s.pieceId
                                    ? ` · ${resolvePieceTitle(s.pieceId, s.editionNumber || undefined)}`
                                    : ''}
                                {s.dismissedReason ? ` — ${s.dismissedReason}` : ''}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

// ───────────────────────────────────────────────────────────────────────────
// Tending (M6, Lens 2: the map of dreams queue)
// ───────────────────────────────────────────────────────────────────────────

interface AdminIntention {
    id: string;
    pieceId: string;
    editionNumber?: number;
    inscriptionId: string;
    text: string;
    sharedAt: string;
    status: 'live' | 'rehomed' | 'withdrawn';
    tended?: boolean;
}

type TendAction = 'keep' | 'rehome' | 'withdraw';

const TendingSection: React.FC = () => {
    const [intentions, setIntentions] = useState<AdminIntention[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const adminFetch = useAdminFetch();

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminFetch('/api/atlas/intentions');
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }
            const data = await res.json();
            if (data?.ok) {
                setIntentions(data.intentions || []);
            } else {
                setError(atlasFailureMessage(res.status, data, 'Could not load the map of dreams.'));
            }
        } catch {
            setError('Could not load the map of dreams.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const tend = async (id: string, action: TendAction) => {
        setBusyId(id);
        setError(null);
        try {
            const res = await adminFetch('/api/atlas/intentions/tend', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, action }),
            });
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }
            const data = await res.json();
            if (data?.ok) {
                await load();
            } else {
                setError(atlasFailureMessage(res.status, data, 'Could not tend the entry.'));
            }
        } catch {
            setError('Network error. Check your connection.');
        } finally {
            setBusyId(null);
        }
    };

    const live = intentions.filter((i) => i.status === 'live');
    const untended = live.filter((i) => !i.tended);
    const tended = live.filter((i) => i.tended);
    const settled = intentions.filter((i) => i.status !== 'live').slice(0, 8);

    const renderLiveRow = (i: AdminIntention, untendedRow: boolean) => (
        <div
            key={i.id}
            className={`border p-5 mb-4 ${
                untendedRow
                    ? 'border-bronze-400 bg-bronze-50'
                    : 'border-wood-200'
            }`}
        >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
                <span className="font-reading text-base text-wood-900">
                    {resolvePieceTitle(i.pieceId, i.editionNumber)}
                </span>
                <span className="font-reading text-sm text-wood-500">
                    {formatRelative(i.sharedAt)}
                </span>
                {untendedRow && (
                    <span className="font-label text-[10px] uppercase tracking-[0.15em] text-bronze-700 font-semibold">
                        untended
                    </span>
                )}
            </div>
            <p className="font-reading text-base text-wood-700 mb-4">
                “{i.text}”
            </p>
            <div className="flex gap-3">
                <button
                    onClick={() => tend(i.id, 'keep')}
                    disabled={busyId === i.id}
                    className="font-label text-xs uppercase tracking-[0.15em] text-wood-700 font-semibold hover:text-bronze-700 transition-colors disabled:opacity-40"
                >
                    Keep
                </button>
                <button
                    onClick={() => tend(i.id, 'rehome')}
                    disabled={busyId === i.id}
                    className="font-label text-xs uppercase tracking-[0.15em] text-wood-700 font-semibold hover:text-bronze-700 transition-colors disabled:opacity-40"
                >
                    Re-home
                </button>
                <button
                    onClick={() => tend(i.id, 'withdraw')}
                    disabled={busyId === i.id}
                    className="font-label text-xs uppercase tracking-[0.15em] text-wood-700 font-semibold hover:text-bronze-700 transition-colors disabled:opacity-40"
                >
                    Withdraw
                </button>
            </div>
        </div>
    );

    return (
        <div className="bg-wood-50 border border-wood-200 p-8 mb-10">
            <h2 className={sectionTitle}>Tending</h2>
            <p className={sectionLead}>
                Entries a steward has let ride the map of dreams. Sorting, not
                approval: a live entry is already public, and tending is
                quality assurance afterward, not a gate.
            </p>

            {error && (
                <p className="font-reading text-sm text-stone-600 mb-4">{error}</p>
            )}
            {loading && <p className="font-reading text-sm text-wood-400">Loading...</p>}
            {!loading && !error && live.length === 0 && (
                <p className="font-reading text-sm text-wood-400">Nothing live on the map right now.</p>
            )}

            {!loading && untended.map((i) => renderLiveRow(i, true))}
            {!loading && tended.map((i) => renderLiveRow(i, false))}

            {!loading && settled.length > 0 && (
                <div className="mt-6 border-t border-wood-100 pt-4">
                    <p className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold mb-2">
                        Recently settled
                    </p>
                    <ul className="space-y-1">
                        {settled.map((i) => (
                            <li key={i.id} className="font-reading text-sm text-wood-500">
                                {i.status} · {resolvePieceTitle(i.pieceId, i.editionNumber)}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

// ───────────────────────────────────────────────────────────────────────────
// Claim Requests (M4 — self-serve stewardship requests)
// ───────────────────────────────────────────────────────────────────────────

const ClaimRequestsSection: React.FC = () => {
    const [requests, setRequests] = useState<ClaimRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const adminFetch = useAdminFetch();

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminFetch('/api/atlas/claim-requests');
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }
            const data = await res.json();
            if (data?.ok) {
                setRequests(data.requests || []);
            } else {
                setError(atlasFailureMessage(res.status, data, 'Could not load claim requests.'));
            }
        } catch {
            setError('Could not load claim requests.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const resolve = async (requestId: string, approve: boolean) => {
        setBusyId(requestId);
        setError(null);
        try {
            const res = await adminFetch('/api/atlas/claim-requests/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId, approve }),
            });
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }
            const data = await res.json();
            if (data?.ok) {
                await load();
            } else {
                setError(atlasFailureMessage(res.status, data, 'Could not resolve the request.'));
            }
        } catch {
            setError('Network error. Check your connection.');
        } finally {
            setBusyId(null);
        }
    };

    const pending = requests.filter((r) => r.status === 'pending');
    const recent = requests.filter((r) => r.status !== 'pending').slice(0, 8);

    return (
        <div className="bg-wood-50 border border-wood-200 p-8 mb-10">
            <h2 className={sectionTitle}>Claim Requests</h2>
            <p className={sectionLead}>
                Self-serve stewardship requests. Approving an unclaimed piece
                binds it to the requester (consent still happens on their next
                visit). Requests on claimed pieces route to the current holder
                — resolving one here is an adjudication, recorded as a
                transfer.
            </p>

            {error && (
                <p className="font-reading text-sm text-stone-600 mb-4">{error}</p>
            )}
            {loading && <p className="font-reading text-sm text-wood-400">Loading...</p>}
            {!loading && !error && pending.length === 0 && (
                <p className="font-reading text-sm text-wood-400">No pending requests.</p>
            )}

            {!loading &&
                pending.map((r) => (
                    <div key={r.id} className="border border-wood-200 p-5 mb-4">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
                            <span className="font-reading text-base text-wood-900">
                                {resolvePieceTitle(r.pieceId, r.editionNumber)}
                            </span>
                            <span className="font-reading text-sm text-wood-700">
                                {r.requesterEmail}
                            </span>
                            <span
                                className={`font-label text-[10px] uppercase tracking-[0.15em] font-semibold ${
                                    r.routedTo === 'holder'
                                        ? 'text-stone-500'
                                        : 'text-bronze-700'
                                }`}
                            >
                                {r.routedTo === 'holder'
                                    ? 'routed to holder'
                                    : 'yours to decide'}
                            </span>
                        </div>
                        <p className="font-reading text-sm text-wood-500 mb-3">
                            {formatRelative(r.createdAt)}
                        </p>
                        {r.note && (
                            <p className="font-reading text-sm text-wood-700 mb-4">
                                “{r.note}”
                            </p>
                        )}
                        <div className="flex gap-3">
                            <button
                                onClick={() => resolve(r.id, true)}
                                disabled={busyId === r.id}
                                className="flex-1 bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 hover:bg-bronze-700 transition-colors disabled:opacity-40"
                            >
                                {busyId === r.id ? 'Working...' : 'Approve'}
                            </button>
                            <button
                                onClick={() => resolve(r.id, false)}
                                disabled={busyId === r.id}
                                className="flex-1 border border-wood-300 text-wood-700 font-label text-xs uppercase tracking-[0.15em] font-semibold py-3 hover:border-wood-500 hover:text-wood-900 transition-colors disabled:opacity-40"
                            >
                                Decline
                            </button>
                        </div>
                    </div>
                ))}

            {!loading && recent.length > 0 && (
                <div className="mt-6 border-t border-wood-100 pt-4">
                    <p className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold mb-2">
                        Recently resolved
                    </p>
                    <ul className="space-y-1">
                        {recent.map((r) => (
                            <li key={r.id} className="font-reading text-sm text-wood-500">
                                {r.status} · {resolvePieceTitle(r.pieceId, r.editionNumber)} ·{' '}
                                {r.requesterEmail}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

// ───────────────────────────────────────────────────────────────────────────
// Homecoming (Phase 2.5, pieces the ledger has never heard of)
// ───────────────────────────────────────────────────────────────────────────

const cityLabelById = (cityId: string): string => {
    const c = getCityById(cityId);
    return c ? `${c.city}, ${c.country}` : cityId;
};

const HomecomingRow: React.FC<{
    req: HomecomingRequest;
    onResolved: () => void;
}> = ({ req, onResolved }) => {
    // Prefill the piece id sensibly from the request; the admin adjusts it and
    // the title to whatever the recognized work should carry.
    const [pieceId, setPieceId] = useState(`hc-${req.id.slice(0, 8)}`);
    const [title, setTitle] = useState('');
    const [editionNumber, setEditionNumber] = useState('');
    const [pieceType, setPieceType] = useState<'' | 'mandala' | 'other'>('');
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [boundPath, setBoundPath] = useState<string | null>(null);
    const adminFetch = useAdminFetch();

    const resolve = async (body: Record<string, unknown>) => {
        setBusy(true);
        setError(null);
        try {
            const res = await adminFetch('/api/atlas/homecoming/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId: req.id, ...body }),
            });
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }
            const data = await res.json();
            if (data?.ok) {
                if (typeof data.claimPath === 'string') {
                    setBoundPath(data.claimPath);
                } else {
                    onResolved();
                }
            } else {
                setError(atlasFailureMessage(res.status, data, 'Could not resolve the request.'));
            }
        } catch {
            setError('Network error. Check your connection.');
        } finally {
            setBusy(false);
        }
    };

    const bind = () => {
        if (!pieceId.trim()) {
            setError('Give the piece an id.');
            return;
        }
        resolve({
            action: 'bind',
            pieceId: pieceId.trim(),
            title: title.trim() || undefined,
            editionNumber: editionNumber ? Number(editionNumber) : undefined,
            pieceType: pieceType || undefined,
        });
    };

    if (boundPath) {
        return (
            <div className="border border-bronze-300 bg-bronze-50 p-5 mb-4">
                <p className="font-reading text-sm text-bronze-800 mb-2">
                    Recognized and bound. Send {req.requesterEmail} to the
                    ceremony:
                </p>
                <code className="block font-technical text-xs text-wood-900 break-all mb-3">
                    {boundPath}
                </code>
                <button
                    type="button"
                    onClick={onResolved}
                    className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 hover:text-wood-900 font-semibold"
                >
                    Done
                </button>
            </div>
        );
    }

    return (
        <div className="border border-wood-200 p-5 mb-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
                <span className="font-reading text-base text-wood-900">
                    {req.requesterEmail}
                </span>
                <span className="font-reading text-sm text-wood-500">
                    rests in {cityLabelById(req.cityId)}
                </span>
                <span className="font-reading text-sm text-wood-500">
                    {formatRelative(req.createdAt)}
                </span>
            </div>

            {/* Photographs, admin-only; never public. */}
            {req.photoUrls.length > 0 && (
                <div className="flex flex-wrap gap-3 my-4">
                    {req.photoUrls.map((url, i) => (
                        <a
                            key={i}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="block"
                        >
                            <img
                                src={url}
                                alt={`Piece photo ${i + 1}`}
                                className="h-28 w-28 object-cover border border-wood-200 bg-paper-100"
                                loading="lazy"
                            />
                        </a>
                    ))}
                </div>
            )}

            <p className="font-reading text-base text-wood-700 leading-[1.7] mb-2">
                {req.provenance}
            </p>
            {req.note && (
                <p className="font-reading text-sm text-wood-500 leading-[1.6] mb-2">
                    {req.note}
                </p>
            )}

            {error && (
                <p className="font-reading text-sm text-stone-600 my-3">{error}</p>
            )}

            {confirming ? (
                <div className="space-y-3 mt-4 border-t border-wood-100 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={fieldLabel}>Piece id</label>
                            <input
                                type="text"
                                value={pieceId}
                                onChange={(e) => setPieceId(e.target.value)}
                                className={fieldInput}
                            />
                        </div>
                        <div>
                            <label className={fieldLabel}>Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="What this piece is called"
                                className={fieldInput}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={fieldLabel}>Edition number (optional)</label>
                            <input
                                type="number"
                                min={1}
                                value={editionNumber}
                                onChange={(e) => setEditionNumber(e.target.value)}
                                placeholder="1"
                                className={fieldInput}
                            />
                        </div>
                        <div>
                            <label className={fieldLabel}>Piece type</label>
                            <select
                                value={pieceType}
                                onChange={(e) =>
                                    setPieceType(e.target.value as '' | 'mandala' | 'other')
                                }
                                className={fieldInput}
                            >
                                <option value="">derive from series</option>
                                <option value="mandala">mandala</option>
                                <option value="other">other</option>
                            </select>
                        </div>
                    </div>
                    <p className="font-reading text-sm text-wood-500 leading-[1.6]">
                        This mints the piece, places it in{' '}
                        {cityLabelById(req.cityId)}, and binds it to{' '}
                        {req.requesterEmail}. They walk the ceremony on their next
                        visit.
                    </p>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={bind}
                            disabled={busy}
                            className="flex-1 bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 hover:bg-bronze-700 transition-colors disabled:opacity-40"
                        >
                            {busy ? 'Binding...' : 'Recognize and bind'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setConfirming(false)}
                            disabled={busy}
                            className="flex-1 border border-wood-300 text-wood-700 font-label text-xs uppercase tracking-[0.15em] font-semibold py-3 hover:border-wood-500 hover:text-wood-900 transition-colors disabled:opacity-40"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex gap-3 mt-4">
                    <button
                        type="button"
                        onClick={() => setConfirming(true)}
                        disabled={busy}
                        className="flex-1 bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 hover:bg-bronze-700 transition-colors disabled:opacity-40"
                    >
                        Recognize and bind
                    </button>
                    <button
                        type="button"
                        onClick={() => resolve({ action: 'decline' })}
                        disabled={busy}
                        className="flex-1 border border-wood-300 text-wood-700 font-label text-xs uppercase tracking-[0.15em] font-semibold py-3 hover:border-wood-500 hover:text-wood-900 transition-colors disabled:opacity-40"
                    >
                        Not now
                    </button>
                </div>
            )}
        </div>
    );
};

const HomecomingSection: React.FC = () => {
    const [requests, setRequests] = useState<HomecomingRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const adminFetch = useAdminFetch();

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminFetch('/api/atlas/homecoming');
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }
            const data = await res.json();
            if (data?.ok) {
                setRequests(data.requests || []);
            } else {
                setError(atlasFailureMessage(res.status, data, 'Could not load homecomings.'));
            }
        } catch {
            setError('Could not load homecomings.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const pending = requests.filter((r) => r.status === 'pending');
    const recent = requests.filter((r) => r.status !== 'pending').slice(0, 8);

    return (
        <div className="bg-wood-50 border border-wood-200 p-8 mb-10">
            <h2 className={sectionTitle}>Homecoming</h2>
            <p className={sectionLead}>
                People who hold a piece the atlas has never heard of. Recognize
                the work from the photographs and story, then bind it: this mints
                the piece, places it where it rests, and sends the keeper into
                the ceremony. Nothing binds on its own.
            </p>

            {error && (
                <p className="font-reading text-sm text-stone-600 mb-4">{error}</p>
            )}
            {loading && <p className="font-reading text-sm text-wood-400">Loading...</p>}
            {!loading && !error && pending.length === 0 && (
                <p className="font-reading text-sm text-wood-400">No pieces waiting to come home.</p>
            )}

            {!loading &&
                pending.map((r) => (
                    <HomecomingRow key={r.id} req={r} onResolved={load} />
                ))}

            {!loading && recent.length > 0 && (
                <div className="mt-6 border-t border-wood-100 pt-4">
                    <p className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold mb-2">
                        Recently resolved
                    </p>
                    <ul className="space-y-1">
                        {recent.map((r) => (
                            <li key={r.id} className="font-reading text-sm text-wood-500">
                                {r.status} · {r.requesterEmail} ·{' '}
                                {cityLabelById(r.cityId)}
                                {r.boundTitle ? ` · ${r.boundTitle}` : ''}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

// ───────────────────────────────────────────────────────────────────────────
// Steward Roster
// ───────────────────────────────────────────────────────────────────────────

/** Every outreachStatus an admin may pick from the roster. `claimed` is
 *  deliberately absent: it is machine-owned, set only by the claim flow,
 *  and the server rejects a manual write of it with a 400. If a record's
 *  CURRENT status is `claimed`, it renders as a disabled, non-editable
 *  option below so the select can still display it. `contacted` and
 *  `paused` are placeholder labels pending Adrian's naming pass. */
const MANUAL_OUTREACH_STATUSES: StewardRecord['outreachStatus'][] = [
    'no-contact',
    'invited',
    'contacted',
    'paused',
    'declined',
];

function stewardKey(s: { pieceId: string; editionNumber?: number }): string {
    return `${s.pieceId}-${s.editionNumber ?? 0}`;
}

const StewardRoster: React.FC<{
    stewards: StewardRecord[];
    loading: boolean;
    error: string | null;
    setStewards: React.Dispatch<React.SetStateAction<StewardRecord[]>>;
    onReload: () => Promise<void>;
}> = ({ stewards, loading, error, setStewards, onReload }) => {
    const adminFetch = useAdminFetch();
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [rowError, setRowError] = useState<string | null>(null);
    const [reissueBusyKey, setReissueBusyKey] = useState<string | null>(null);
    // The freshly-reissued plaintext code, held only until dismissed.
    const [reissued, setReissued] = useState<{ code: string; sigil: string; pieceId: string; editionNumber?: number } | null>(null);

    const handleReissue = async (s: StewardRecord) => {
        const key = stewardKey(s);
        // Confirm before invalidating: a reissue kills the previously printed
        // code the moment a new one is minted.
        const ok = window.confirm(
            `Reissue the claim code for ${resolvePieceTitle(s.pieceId, s.editionNumber)}? ` +
                'The previous code stops working immediately.',
        );
        if (!ok) return;
        setRowError(null);
        setReissueBusyKey(key);
        try {
            const res = await adminFetch('/api/atlas/stewards/reissue-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pieceId: s.pieceId,
                    editionNumber: s.editionNumber,
                }),
            });
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }
            const data = await res.json();
            if (data?.ok && data.claimCode) {
                setReissued({ code: data.claimCode, sigil: resolvePieceSigil(s.pieceId), pieceId: s.pieceId, editionNumber: s.editionNumber });
                await onReload();
            } else {
                setRowError(atlasFailureMessage(res.status, data, 'Could not reissue the code.'));
            }
        } catch {
            setRowError('Network error. Check your connection.');
        } finally {
            setReissueBusyKey(null);
        }
    };

    const handleStatusChange = async (
        s: StewardRecord,
        next: StewardRecord['outreachStatus'],
    ) => {
        const key = stewardKey(s);
        setRowError(null);
        setBusyKey(key);
        // Optimistic update: reload from the server on any failure below.
        setStewards((prev) =>
            prev.map((r) =>
                stewardKey(r) === key ? { ...r, outreachStatus: next } : r,
            ),
        );
        try {
            const res = await adminFetch('/api/atlas/stewards/outreach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pieceId: s.pieceId,
                    editionNumber: s.editionNumber,
                    outreachStatus: next,
                }),
            });
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }
            const data = await res.json();
            if (!data?.ok) {
                setRowError(atlasFailureMessage(res.status, data, 'Could not update status.'));
                await onReload();
            }
        } catch {
            setRowError('Network error. Check your connection.');
            await onReload();
        } finally {
            setBusyKey(null);
        }
    };

    return (
        <div className="bg-wood-50 border border-wood-200 p-8">
            <h2 className={sectionTitle}>Steward Roster</h2>
            <p className={sectionLead}>
                Bound and pending collectors. Status flips from "invited" to
                "claimed" on their first signed-in visit to /atlas/claim;
                that step is machine-only. Every other status can be set by
                hand below.
            </p>

            {error && (
                <p className="font-reading text-sm text-stone-600">
                    {error}
                </p>
            )}

            {rowError && (
                <p className="font-reading text-sm text-stone-600 mb-4">
                    {rowError}
                </p>
            )}

            {reissued && (
                <ClaimCodeReference
                    code={reissued.code}
                    sigil={reissued.sigil}
                    pieceId={reissued.pieceId}
                    editionNumber={reissued.editionNumber}
                    onDismiss={() => setReissued(null)}
                />
            )}

            {loading && (
                <p className="font-reading text-sm text-wood-400">Loading...</p>
            )}

            {!loading && !error && stewards.length === 0 && (
                <p className="font-reading text-sm text-wood-400">
                    No stewards issued yet.
                </p>
            )}

            {!loading && stewards.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-wood-200">
                                <th className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold py-2 pr-4">
                                    Piece
                                </th>
                                <th className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold py-2 pr-4">
                                    Name
                                </th>
                                <th className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold py-2 pr-4">
                                    Email
                                </th>
                                <th className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold py-2 pr-4">
                                    Status
                                </th>
                                <th className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold py-2 pr-4">
                                    Issued
                                </th>
                                <th className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold py-2 pr-4">
                                    Last claim
                                </th>
                                <th className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold py-2">
                                    Code
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {stewards.map((s, i) => (
                                <tr
                                    key={`${s.pieceId}-${s.editionNumber ?? 0}-${i}`}
                                    className="border-b border-wood-100"
                                >
                                    <td className="font-reading text-base text-wood-900 py-3 pr-4">
                                        {resolvePieceTitle(
                                            s.pieceId,
                                            s.editionNumber,
                                        )}
                                    </td>
                                    <td className="font-reading text-sm text-wood-700 py-3 pr-4">
                                        {s.name ?? '-'}
                                    </td>
                                    <td className="font-reading text-sm text-wood-700 py-3 pr-4">
                                        {s.email ?? '-'}
                                    </td>
                                    <td className="py-3 pr-4">
                                        <select
                                            value={s.outreachStatus}
                                            disabled={
                                                busyKey === stewardKey(s)
                                            }
                                            onChange={(e) =>
                                                handleStatusChange(
                                                    s,
                                                    e.target
                                                        .value as StewardRecord['outreachStatus'],
                                                )
                                            }
                                            className="font-reading text-sm text-wood-700 border border-wood-300 bg-wood-50 px-2 py-1.5 focus:outline-none focus:border-bronze-400 disabled:opacity-40"
                                        >
                                            {s.outreachStatus === 'claimed' && (
                                                <option value="claimed" disabled>
                                                    claimed (machine-set)
                                                </option>
                                            )}
                                            {MANUAL_OUTREACH_STATUSES.map(
                                                (status) => (
                                                    <option
                                                        key={status}
                                                        value={status}
                                                    >
                                                        {status}
                                                    </option>
                                                ),
                                            )}
                                        </select>
                                    </td>
                                    <td className="font-reading text-sm text-wood-500 py-3 pr-4">
                                        {formatRelative(s.issuedAt)}
                                    </td>
                                    <td className="font-reading text-sm text-wood-500 py-3 pr-4">
                                        {s.lastClaimAt
                                            ? formatRelative(s.lastClaimAt)
                                            : '-'}
                                    </td>
                                    <td className="py-3">
                                        {s.outreachStatus === 'claimed' ? (
                                            <span className="font-reading text-xs text-wood-400 not-italic">
                                                claimed
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => handleReissue(s)}
                                                disabled={reissueBusyKey === stewardKey(s)}
                                                className="font-label text-[11px] uppercase tracking-[0.15em] text-bronze-700 hover:text-bronze-600 font-semibold disabled:opacity-40"
                                            >
                                                {reissueBusyKey === stewardKey(s)
                                                    ? 'reissuing...'
                                                    : s.claimCodeHash
                                                      ? 'reissue code'
                                                      : 'mint code'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ───────────────────────────────────────────────────────────────────────────
// Catalog (the Catalog Room — every work Adrian has ever made, one form)
// ───────────────────────────────────────────────────────────────────────────
// Make Requests — "Begin your piece" notes from /make
// ───────────────────────────────────────────────────────────────────────────

const MakeRequestsSection: React.FC = () => {
    const [requests, setRequests] = useState<MakeRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const adminFetch = useAdminFetch();

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminFetch('/api/atlas/make');
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }
            const data = await res.json();
            if (data?.ok) {
                setRequests(data.requests || []);
            } else {
                setError(atlasFailureMessage(res.status, data, 'Could not load make requests.'));
            }
        } catch {
            setError('Could not load make requests.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const resolve = async (requestId: string, action: 'answered' | 'dismissed') => {
        setBusyId(requestId);
        setError(null);
        try {
            const res = await adminFetch('/api/atlas/make/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId, action }),
            });
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }
            const data = await res.json();
            if (data?.ok) {
                await load();
            } else {
                setError(atlasFailureMessage(res.status, data, 'Could not resolve the request.'));
            }
        } catch {
            setError('Network error. Check your connection.');
        } finally {
            setBusyId(null);
        }
    };

    const pending = requests.filter((r) => r.status === 'pending');
    const recent = requests.filter((r) => r.status !== 'pending').slice(0, 8);

    return (
        <div className="bg-wood-50 border border-wood-200 p-8 mb-10">
            <h2 className={sectionTitle}>Make Requests</h2>
            <p className={sectionLead}>
                Notes from the /make door: someone wants a piece made (code,
                size, palette). Reply by email, then mark the note answered.
                Nothing here touches the ledger.
            </p>

            {error && (
                <p className="font-reading text-sm text-stone-600 mb-4">{error}</p>
            )}
            {loading && <p className="font-reading text-sm text-wood-400">Loading...</p>}
            {!loading && !error && pending.length === 0 && (
                <p className="font-reading text-sm text-wood-400">No pending notes.</p>
            )}

            {!loading &&
                pending.map((r) => (
                    <div key={r.id} className="border border-wood-200 p-5 mb-4">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
                            <span className="font-reading text-base text-wood-900">
                                {r.requesterEmail}
                            </span>
                            {typeof r.code === 'number' && (
                                <span className="font-label text-[10px] uppercase tracking-[0.15em] font-semibold text-bronze-700">
                                    Code {r.code}
                                </span>
                            )}
                            {r.pieceId && (
                                <span className="font-reading text-sm text-wood-700">
                                    from {resolvePieceTitle(r.pieceId, undefined)}
                                </span>
                            )}
                        </div>
                        <p className="font-reading text-sm text-wood-500 mb-2">
                            {formatRelative(r.createdAt)}
                        </p>
                        <p className="font-reading text-sm text-wood-800 mb-1">
                            Size: {r.size}
                        </p>
                        {r.palette && (
                            <p className="font-reading text-sm text-wood-800 mb-1">
                                Palette: {r.palette}
                            </p>
                        )}
                        {r.note && (
                            <p className="font-reading text-sm text-wood-700 mt-2 mb-3">
                                “{r.note}”
                            </p>
                        )}
                        <div className="flex gap-3 mt-4">
                            <a
                                href={`mailto:${r.requesterEmail}?subject=${encodeURIComponent('Your piece, from the studio')}`}
                                className="flex-1 text-center bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 hover:bg-bronze-700 transition-colors"
                            >
                                Reply by email
                            </a>
                            <button
                                onClick={() => resolve(r.id, 'answered')}
                                disabled={busyId === r.id}
                                className="flex-1 border border-wood-300 text-wood-800 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 hover:border-bronze-500 transition-colors disabled:opacity-40"
                            >
                                {busyId === r.id ? 'Working...' : 'Mark answered'}
                            </button>
                            <button
                                onClick={() => resolve(r.id, 'dismissed')}
                                disabled={busyId === r.id}
                                className="flex-1 border border-wood-300 text-stone-600 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 hover:border-stone-400 transition-colors disabled:opacity-40"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                ))}

            {recent.length > 0 && (
                <div className="mt-6 pt-4 border-t border-wood-200">
                    <p className="font-label text-[10px] uppercase tracking-[0.18em] text-wood-500 mb-2">
                        Recently resolved
                    </p>
                    {recent.map((r) => (
                        <p key={r.id} className="font-reading text-sm text-wood-600">
                            {r.requesterEmail} · {r.size}
                            {typeof r.code === 'number' ? ` · Code ${r.code}` : ''} ·{' '}
                            {r.status}
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
};

// ───────────────────────────────────────────────────────────────────────────

/** The admin entry carries its rendered sigil from the server. */
interface CatalogAdminEntry extends CatalogEntry {
    sigil: string;
}

/** The public host every printed artifact points at — never the admin origin. */
const PLAQUE_HOST = 'https://mandalacodes.com';

/** "where it is", in Adrian's language. */
const STATUS_LABELS: Record<CatalogStatus, string> = {
    'with-keeper': 'with a keeper',
    available: 'available',
    'with-artist': 'resting with the artist',
};

interface CatalogFormState {
    title: string;
    kind: CatalogKind;
    series: string;
    year: string;
    dimensions: string;
    material: string;
    coverImage: string;
    images: string;
    status: CatalogStatus;
    cityId: string;
    keeperEmail: string;
    price: string;
    acquireUrl: string;
    notes: string;
}

const EMPTY_CATALOG_FORM: CatalogFormState = {
    title: '',
    kind: 'mandala',
    series: '',
    year: '',
    dimensions: '',
    material: '',
    coverImage: '',
    images: '',
    status: 'with-artist',
    cityId: '',
    keeperEmail: '',
    price: '',
    acquireUrl: '',
    notes: '',
};

const CatalogForm: React.FC<{
    onCreated: (entry: CatalogAdminEntry, sigil: string) => void;
}> = ({ onCreated }) => {
    const [form, setForm] = useState<CatalogFormState>(EMPTY_CATALOG_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mintedSigil, setMintedSigil] = useState<string | null>(null);
    const adminFetch = useAdminFetch();

    const set = <K extends keyof CatalogFormState>(k: K, v: CatalogFormState[K]) =>
        setForm((f) => ({ ...f, [k]: v }));

    const submit = async () => {
        if (!form.title.trim()) {
            setError('Give the piece a title.');
            return;
        }
        if (form.kind === 'other' && !form.series.trim()) {
            setError('A series name is needed for an "other" piece.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const images = form.images
                .split(/[\n,]+/)
                .map((s) => s.trim())
                .filter(Boolean);
            const body: Record<string, unknown> = {
                title: form.title.trim(),
                kind: form.kind,
                series: form.kind === 'other' ? form.series.trim() : undefined,
                year: form.year.trim() || undefined,
                dimensions: form.dimensions.trim() || undefined,
                material: form.material.trim() || undefined,
                coverImage: form.coverImage.trim() || undefined,
                images: images.length ? images : undefined,
                status: form.status,
                cityId:
                    form.status === 'with-keeper' ? form.cityId || undefined : undefined,
                keeperEmail:
                    form.status === 'with-keeper'
                        ? form.keeperEmail.trim() || undefined
                        : undefined,
                price:
                    form.status === 'available' && form.price.trim()
                        ? Math.round(Number(form.price) * 100)
                        : undefined,
                acquireUrl:
                    form.status === 'available'
                        ? form.acquireUrl.trim() || undefined
                        : undefined,
                notes: form.notes.trim() || undefined,
            };
            const res = await adminFetch('/api/atlas/catalog/admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }
            const data = await res.json();
            if (data?.ok && data.entry) {
                setMintedSigil(data.sigil);
                onCreated({ ...data.entry, sigil: data.sigil }, data.sigil);
                setForm(EMPTY_CATALOG_FORM);
            } else {
                setError(atlasFailureMessage(res.status, data, 'Could not add the piece.'));
            }
        } catch {
            setError('Network error. Check your connection.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="border border-wood-200 p-6 mb-6">
            <h3 className="font-title text-lg text-wood-900 mb-4 tracking-[0.05em]">
                add a piece
            </h3>

            {error && (
                <p className="font-reading text-sm text-stone-600 mb-4">
                    {error}
                </p>
            )}

            {mintedSigil && (
                <div className="mb-6 border border-bronze-400 bg-bronze-50 px-4 py-4">
                    <p className="font-label text-[10px] uppercase tracking-[0.15em] text-bronze-700 font-semibold mb-2">
                        its permanent sigil
                    </p>
                    <p className="font-title text-2xl text-wood-900 tracking-[0.06em]">
                        {mintedSigil} · permanent
                    </p>
                    <button
                        type="button"
                        onClick={() => setMintedSigil(null)}
                        className="mt-3 font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 hover:text-wood-900 font-semibold"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            <div className="space-y-5">
                <div>
                    <label className={fieldLabel}>Title</label>
                    <input
                        type="text"
                        value={form.title}
                        onChange={(e) => set('title', e.target.value)}
                        placeholder="What this work is called"
                        className={fieldInput}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className={fieldLabel}>Kind</label>
                        <select
                            value={form.kind}
                            onChange={(e) => set('kind', e.target.value as CatalogKind)}
                            className={fieldInput}
                        >
                            {CATALOG_KINDS.map((k) => (
                                <option key={k} value={k}>
                                    {CATALOG_KIND_LABELS[k]}
                                </option>
                            ))}
                        </select>
                    </div>
                    {form.kind === 'other' && (
                        <div>
                            <label className={fieldLabel}>Series name</label>
                            <input
                                type="text"
                                value={form.series}
                                onChange={(e) => set('series', e.target.value)}
                                placeholder="e.g. Light Codes"
                                className={fieldInput}
                            />
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className={fieldLabel}>Year</label>
                        <input
                            type="text"
                            value={form.year}
                            onChange={(e) => set('year', e.target.value)}
                            placeholder="2024"
                            className={fieldInput}
                        />
                    </div>
                    <div>
                        <label className={fieldLabel}>Dimensions</label>
                        <input
                            type="text"
                            value={form.dimensions}
                            onChange={(e) => set('dimensions', e.target.value)}
                            placeholder="23 in square"
                            className={fieldInput}
                        />
                    </div>
                    <div>
                        <label className={fieldLabel}>Materials</label>
                        <input
                            type="text"
                            value={form.material}
                            onChange={(e) => set('material', e.target.value)}
                            placeholder="Laser cut wood, acrylic"
                            className={fieldInput}
                        />
                    </div>
                </div>

                <div>
                    <label className={fieldLabel}>Cover photo (Cloudinary id)</label>
                    <input
                        type="text"
                        value={form.coverImage}
                        onChange={(e) => set('coverImage', e.target.value)}
                        placeholder="32_x9qxas"
                        className={fieldInput}
                    />
                </div>
                <div>
                    <label className={fieldLabel}>More photos (one id per line)</label>
                    <textarea
                        value={form.images}
                        onChange={(e) => set('images', e.target.value)}
                        rows={2}
                        placeholder={'detail_ab12cd\nverso_ef34gh'}
                        className={`${fieldInput} resize-y`}
                    />
                </div>

                <div>
                    <label className={fieldLabel}>Where it is</label>
                    <select
                        value={form.status}
                        onChange={(e) => set('status', e.target.value as CatalogStatus)}
                        className={fieldInput}
                    >
                        <option value="with-keeper">with a keeper at a city</option>
                        <option value="available">available</option>
                        <option value="with-artist">resting with the artist</option>
                    </select>
                </div>

                {form.status === 'with-keeper' && (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={fieldLabel}>City</label>
                            <CityAutocomplete
                                value={form.cityId}
                                onChange={(cityId) => set('cityId', cityId)}
                            />
                        </div>
                        <div>
                            <label className={fieldLabel}>Keeper email (private)</label>
                            <input
                                type="email"
                                value={form.keeperEmail}
                                onChange={(e) => set('keeperEmail', e.target.value)}
                                placeholder="collector@example.com"
                                className={fieldInput}
                            />
                        </div>
                    </div>
                )}

                {form.status === 'available' && (
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={fieldLabel}>Price</label>
                            <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={form.price}
                                onChange={(e) => set('price', e.target.value)}
                                placeholder="1800"
                                className={fieldInput}
                            />
                        </div>
                        <div>
                            <label className={fieldLabel}>Acquire link</label>
                            <input
                                type="text"
                                value={form.acquireUrl}
                                onChange={(e) => set('acquireUrl', e.target.value)}
                                placeholder="https://adrianrasmussen.com/..."
                                className={fieldInput}
                            />
                        </div>
                    </div>
                )}

                <div>
                    <label className={fieldLabel}>Notes (admin-private)</label>
                    <textarea
                        value={form.notes}
                        onChange={(e) => set('notes', e.target.value)}
                        rows={2}
                        placeholder="Anything only you should see"
                        className={`${fieldInput} font-reading resize-y`}
                    />
                </div>

                <button
                    onClick={submit}
                    disabled={saving}
                    className="w-full bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 hover:bg-bronze-700 transition-colors disabled:opacity-40"
                >
                    {saving ? 'Saving...' : 'Save the piece'}
                </button>
            </div>
        </div>
    );
};

const CatalogRow: React.FC<{
    entry: CatalogAdminEntry;
    inWorld: boolean;
    onChanged: () => void;
}> = ({ entry, inWorld, onChanged }) => {
    const adminFetch = useAdminFetch();
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [note, setNote] = useState<string | null>(null);
    const [codeRef, setCodeRef] = useState<string | null>(null);

    const stampPrinted = async () => {
        try {
            await adminFetch('/api/atlas/catalog/admin', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: entry.id, markPrinted: true }),
            });
            onChanged();
        } catch {
            /* the print already opened; the badge just lags until reload */
        }
    };

    const enterWorld = async () => {
        setBusy('world');
        setError(null);
        setNote(null);
        try {
            const parts = kindToCodeParts(entry.kind, entry.series);
            const now = new Date().toISOString();
            const created = {
                id: crypto.randomUUID(),
                pieceId: entry.id,
                type: 'created' as const,
                date: now,
                actor: 'admin' as const,
                ...(parts.series ? { series: parts.series } : {}),
                ...(parts.category ? { category: parts.category } : {}),
                pieceType: entry.kind === 'mandala' ? ('mandala' as const) : ('other' as const),
            };
            const res = await adminFetch('/api/atlas/event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: created }),
            });
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }
            const data = await res.json();
            // A 409 "genesis already exists" is fine — the piece is in the world.
            if (!data?.ok && res.status !== 409) {
                setError(atlasFailureMessage(res.status, data, 'Could not enter the world.'));
                return;
            }
            // A placed event anchors it when it rests with a keeper at a city.
            if (entry.status === 'with-keeper' && entry.cityId) {
                const placed = {
                    id: crypto.randomUUID(),
                    pieceId: entry.id,
                    type: 'placed' as const,
                    date: now,
                    cityId: entry.cityId,
                    actor: 'admin' as const,
                };
                await adminFetch('/api/atlas/event', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ event: placed }),
                });
            }
            setNote('entered the world');
            onChanged();
        } catch {
            setError('Network error. Check your connection.');
        } finally {
            setBusy(null);
        }
    };

    const invite = async () => {
        if (
            !window.confirm(
                `Send the claim invitation for ${entry.sigil} to ${entry.keeperEmail}?`,
            )
        ) {
            return;
        }
        setBusy('invite');
        setError(null);
        setNote(null);
        try {
            const res = await adminFetch('/api/atlas/catalog/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: entry.id }),
            });
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }
            const data = await res.json();
            if (data?.ok) {
                setNote('invitation sent');
                onChanged();
            } else {
                setError(atlasFailureMessage(res.status, data, 'Could not send the invitation.'));
            }
        } catch {
            setError('Network error. Check your connection.');
        } finally {
            setBusy(null);
        }
    };

    const mintCode = async () => {
        setBusy('code');
        setError(null);
        setNote(null);
        try {
            const res = await adminFetch('/api/atlas/stewards/issue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pieceId: entry.id,
                    mintClaimCode: true,
                    email: entry.keeperEmail || undefined,
                }),
            });
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }
            const data = await res.json();
            if (data?.ok && data.claimCode) {
                setCodeRef(data.claimCode);
            } else {
                setError(atlasFailureMessage(res.status, data, 'Could not mint the code.'));
            }
        } catch {
            setError('Network error. Check your connection.');
        } finally {
            setBusy(null);
        }
    };

    const printPlaque = async () => {
        const qrUrl = `${PLAQUE_HOST}/qr/piece/${entry.id}`;
        const title = entry.title.replace(/\s*-\s*\d+$/, '');
        const whisper = entry.series || CATALOG_KIND_LABELS[entry.kind];
        let qrDataUri = '';
        try {
            const QRCode = (await import('qrcode')).default;
            qrDataUri = await QRCode.toDataURL(qrUrl, {
                width: 320,
                margin: 1,
                color: { dark: '#2c2c2c', light: '#f5f0e8' },
            });
        } catch {
            /* the plaque still prints, minus the QR */
        }
        const win = window.open('', '_blank', 'width=460,height=760');
        if (!win) return;
        win.document.write(`<!doctype html><html><head><title>${entry.sigil} plaque</title>
<style>
  body { margin: 0; background: #fff; }
  .plaque { width: 340px; margin: 24px auto; padding: 34px 26px; background: #f5f0e8;
    border: 1px solid #c6bca6; text-align: center; color: #2c2c2c; }
  .sigil { font-size: 13px; letter-spacing: 0.26em; text-transform: uppercase; color: #8b6914; }
  .title { font-size: 26px; margin: 20px 10px 8px; }
  .whisper { font-size: 12px; letter-spacing: 0.1em; color: #5a4a35; }
  .qr { margin: 22px auto 6px; }
  .qr img { width: 190px; height: 190px; }
  .host { font-size: 11px; letter-spacing: 0.12em; color: #a09070; margin-top: 14px; }
  @media print { body { background: #f5f0e8; } .plaque { border: none; margin: 0 auto; } }
</style></head><body>
<div class="plaque">
  <div class="sigil">${entry.sigil}</div>
  <div class="title">${title}</div>
  <div class="whisper">${whisper}</div>
  ${qrDataUri ? `<div class="qr"><img src="${qrDataUri}" alt=""/></div>` : ''}
  <div class="host">mandalacodes.com</div>
</div>
<script>window.onload = function () { window.print(); };</script>
</body></html>`);
        win.document.close();
        void stampPrinted();
    };

    const invited = !!entry.claimIssuedAt;
    const printed = !!entry.printedAt;

    return (
        <div className="border border-wood-200 p-5 mb-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2">
                <span className="font-title text-base text-wood-900 tracking-[0.05em]">
                    {entry.sigil}
                </span>
                <span className="font-reading text-base text-wood-900">
                    {entry.title}
                </span>
                <span className="font-reading text-sm text-wood-500">
                    {CATALOG_KIND_LABELS[entry.kind]} · {STATUS_LABELS[entry.status]}
                    {entry.cityId ? ` · ${cityLabelById(entry.cityId)}` : ''}
                </span>
                {printed && (
                    <span className="font-label text-[10px] uppercase tracking-[0.15em] text-bronze-700 font-semibold">
                        printed
                    </span>
                )}
                {invited && (
                    <span className="font-label text-[10px] uppercase tracking-[0.15em] text-bronze-700 font-semibold">
                        invited
                    </span>
                )}
            </div>

            {error && (
                <p className="font-reading text-sm text-stone-600 mb-2">
                    {error}
                </p>
            )}
            {note && (
                <p className="font-reading text-sm text-bronze-700 mb-2 not-italic">
                    {note}
                </p>
            )}

            {codeRef && (
                <ClaimCodeReference
                    code={codeRef}
                    sigil={entry.sigil}
                    pieceId={entry.id}
                    onDismiss={() => setCodeRef(null)}
                    onPrinted={stampPrinted}
                />
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-2">
                {inWorld ? (
                    <span className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-400 font-semibold">
                        already in the world
                    </span>
                ) : (
                    <button
                        type="button"
                        onClick={enterWorld}
                        disabled={busy === 'world'}
                        className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-700 hover:text-bronze-700 font-semibold disabled:opacity-40"
                    >
                        {busy === 'world' ? 'entering...' : 'enter the world'}
                    </button>
                )}

                {entry.keeperEmail && !invited && (
                    <button
                        type="button"
                        onClick={invite}
                        disabled={busy === 'invite'}
                        className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-700 hover:text-bronze-700 font-semibold disabled:opacity-40"
                    >
                        {busy === 'invite' ? 'sending...' : 'invite its keeper'}
                    </button>
                )}

                <button
                    type="button"
                    onClick={mintCode}
                    disabled={busy === 'code'}
                    className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-700 hover:text-bronze-700 font-semibold disabled:opacity-40"
                >
                    {busy === 'code' ? 'minting...' : 'mint claim code'}
                </button>

                <button
                    type="button"
                    onClick={printPlaque}
                    className="font-label text-[11px] uppercase tracking-[0.15em] text-wood-700 hover:text-bronze-700 font-semibold"
                >
                    print the plaque
                </button>

                <a
                    href={`/piece/${entry.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-label text-[11px] uppercase tracking-[0.15em] text-bronze-700 hover:text-bronze-600 font-semibold"
                >
                    view its certificate
                </a>
            </div>
        </div>
    );
};

const CatalogSection: React.FC = () => {
    const [entries, setEntries] = useState<CatalogAdminEntry[]>([]);
    const [inWorld, setInWorld] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const adminFetch = useAdminFetch();

    const loadWorld = async () => {
        try {
            const res = await fetch('/api/atlas');
            const data = await res.json();
            if (data?.ok && data.state?.pieces) {
                setInWorld(
                    new Set(
                        (data.state.pieces as Array<{ pieceId: string }>).map(
                            (p) => p.pieceId,
                        ),
                    ),
                );
            }
        } catch {
            /* the "already in the world" chip just won't show until reload */
        }
    };

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await adminFetch('/api/atlas/catalog/admin');
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }
            const data = await res.json();
            if (data?.ok) {
                setEntries(data.entries || []);
            } else {
                setError(atlasFailureMessage(res.status, data, 'Could not load the catalog.'));
            }
        } catch {
            setError('Could not load the catalog.');
        } finally {
            setLoading(false);
        }
        await loadWorld();
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="bg-wood-50 border border-wood-200 p-8 mb-10">
            <h2 className={sectionTitle}>Catalog</h2>
            <p className={sectionLead}>
                Every work you have made, entered once. Each piece receives a
                permanent sigil the moment you save it, and every door flows from
                the row below: enter the world, invite its keeper, mint a claim
                code, print.
            </p>

            <CatalogForm
                onCreated={() => {
                    load();
                }}
            />

            {error && (
                <p className="font-reading text-sm text-stone-600 mb-4">
                    {error}
                </p>
            )}
            {loading && (
                <p className="font-reading text-sm text-wood-400">Loading...</p>
            )}
            {!loading && !error && entries.length === 0 && (
                <p className="font-reading text-sm text-wood-400">
                    No pieces catalogued yet.
                </p>
            )}

            {!loading &&
                entries.map((entry) => (
                    <CatalogRow
                        key={entry.id}
                        entry={entry}
                        inWorld={inWorld.has(entry.id)}
                        onChanged={load}
                    />
                ))}
        </div>
    );
};

// ───────────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────────

const AdminAtlas: React.FC = () => {
    const [stewards, setStewards] = useState<StewardRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [rosterError, setRosterError] = useState<string | null>(null);
    const adminFetch = useAdminFetch();

    const loadStewards = async () => {
        setLoading(true);
        setRosterError(null);
        try {
            const res = await adminFetch('/api/atlas/stewards');
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }
            const data = await res.json();
            if (data?.ok) {
                setStewards(data.stewards || []);
            } else {
                setRosterError(atlasFailureMessage(res.status, data, 'Could not load roster.'));
            }
        } catch {
            setRosterError('Could not load roster.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStewards();
    }, []);

    return (
        <AdminLayout>
            <section className="pt-12 pb-32 px-6">
                <div className="max-w-2xl mx-auto">
                    <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold mb-3">
                        Admin
                    </p>
                    <h1 className="font-title text-4xl text-wood-900 mb-2 tracking-[0.05em]">
                        Atlas
                    </h1>
                    <p className="font-reading text-sm text-wood-500 mb-12">
                        Seed ledger events and add stewards for the world map.
                    </p>

                    <CatalogSection />
                    <SeedEventSection />
                    <PendingSalesSection />
                    <TendingSection />
                    <ClaimRequestsSection />
                    <HomecomingSection />
                    <MakeRequestsSection />
                    <IssueStewardKeySection onIssued={loadStewards} />
                    <StewardRoster
                        stewards={stewards}
                        loading={loading}
                        error={rosterError}
                        setStewards={setStewards}
                        onReload={loadStewards}
                    />
                </div>
            </section>
        </AdminLayout>
    );
};

export default AdminAtlas;
