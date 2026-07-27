import React, { useEffect, useState } from 'react';
import { useAccount } from '../lib/account/useAccount';
import AdminLayout from './AdminLayout';
import TypeaheadPicker from './shared/TypeaheadPicker';
import { FULL_ARCHIVE } from '../data/mockData';
import { img } from '../utils/cloudinary';
import {
    isValidImageId,
    MAX_IMAGES,
    MATERIALS_MAX_LENGTH,
    PROVENANCE_MAX_LENGTH,
    STORY_MAX_LENGTH,
    type PieceContent,
} from '../utils/pieceContent';

/**
 * Admin piece-content editor — the "unlock" from
 * todo/plans/piece-page-buildout.md: Adrian picks a piece and writes its
 * story, extra photos, materials, and provenance without touching code.
 * Saved to `atlas_piece_content` (D1) via /api/atlas/admin/piece-content;
 * PiecePage.tsx reads it back through the public /api/atlas/piece-content
 * endpoint and merges it over the static FULL_ARCHIVE fields.
 *
 * Mounted at /admin/piece-content, alongside /admin/atlas (see App.tsx and
 * AdminLayout.tsx). Styling mirrors AdminAtlas.tsx's tokens and form
 * patterns so the two admin screens sit together without drift.
 */

// ───────────────────────────────────────────────────────────────────────────
// Style tokens — mirrored from AdminAtlas.tsx. Keep identical to that file.
// ───────────────────────────────────────────────────────────────────────────
const fieldLabel =
    'font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold block mb-2';
const fieldInput =
    'w-full border border-wood-300 bg-wood-50 px-4 py-3 font-reading text-sm text-wood-900 placeholder:text-wood-400 focus:outline-none focus:border-bronze-400';
const fieldTextarea = `${fieldInput} resize-y`;
const sectionTitle = 'font-title text-2xl text-wood-900 mb-2 tracking-[0.05em]';
const sectionLead = 'font-reading text-sm text-wood-500 mb-6';

function useAdminFetch(): (input: string, init?: RequestInit) => Promise<Response> {
    const { fetchAuthed } = useAccount();
    return fetchAuthed;
}

interface PieceOption {
    id: string;
    label: string;
    staticDescription: string;
    staticMaterial?: string;
}

const pieceOptions: PieceOption[] = FULL_ARCHIVE
    .map((a) => ({
        id: a.id,
        label: `${a.title} (${a.series ?? a.category} · ${a.year})`,
        staticDescription: a.longDescription || a.description,
        staticMaterial: a.material,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

// ───────────────────────────────────────────────────────────────────────────
// Piece picker: thin wrapper around the shared TypeaheadPicker
// (components/shared/TypeaheadPicker.tsx, mirrors CityAutocomplete's
// pattern in AdminAtlas.tsx: both are now call sites of the same combobox).
// ───────────────────────────────────────────────────────────────────────────

const pieceMatches = (p: PieceOption, query: string): boolean =>
    `${p.label} ${p.id}`.toLowerCase().includes(query.trim().toLowerCase());

const pieceLabel = (p: PieceOption): string => p.label;

const pieceById = new Map(pieceOptions.map((p) => [p.id, p]));

/**
 * Piece picker with a free-text escape hatch. The typeahead stays
 * archive-driven, but an uncatalogued piece — shipped before its Artwork row
 * lands — can still have its content written: switch to "enter its id" and
 * type the raw pieceId. It renders by sigil until the catalog row arrives.
 */
const PiecePicker: React.FC<{
    value: string;
    onChange: (pieceId: string) => void;
}> = ({ value, onChange }) => {
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
            <TypeaheadPicker<PieceOption>
                items={pieceOptions}
                filter={pieceMatches}
                itemKey={(p) => p.id}
                itemLabel={pieceLabel}
                value={value || null}
                onPick={(p) => onChange(p.id)}
                onQueryChange={() => onChange('')}
                placeholder="Search a piece by title, series, or id…"
                maxResultsEmpty={10}
                maxResults={20}
                variant="admin"
                listMaxHeightClassName="max-h-72"
                renderItem={(p) => (
                    <>
                        {p.label}
                        <span className="font-label text-[10px] uppercase tracking-[0.15em] text-wood-400 ml-2">
                            {p.id}
                        </span>
                    </>
                )}
            />
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

// ───────────────────────────────────────────────────────────────────────────
// Image gallery editor — add/remove Cloudinary public ids with a preview.
// ───────────────────────────────────────────────────────────────────────────

const ImagesEditor: React.FC<{
    images: string[];
    onChange: (images: string[]) => void;
}> = ({ images, onChange }) => {
    const [draft, setDraft] = useState('');
    const [error, setError] = useState<string | null>(null);

    const add = () => {
        const id = draft.trim();
        if (!id) return;
        if (!isValidImageId(id)) {
            setError('That doesn\'t look like a Cloudinary public id (letters, digits, · _ - . / only).');
            return;
        }
        if (images.includes(id)) {
            setError('Already in the gallery.');
            return;
        }
        if (images.length >= MAX_IMAGES) {
            setError(`No more than ${MAX_IMAGES} images.`);
            return;
        }
        setError(null);
        onChange([...images, id]);
        setDraft('');
    };

    const remove = (id: string) => {
        onChange(images.filter((x) => x !== id));
    };

    return (
        <div>
            <label className={fieldLabel}>Gallery images ({images.length}/{MAX_IMAGES})</label>
            {images.length > 0 && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-3">
                    {images.map((id) => (
                        <div key={id} className="relative group">
                            <div className="aspect-square bg-[#151311] overflow-hidden">
                                <img
                                    src={img(id, { w: 200, h: 200, crop: 'fill' })}
                                    alt={id}
                                    className="w-full h-full object-cover block"
                                    loading="lazy"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => remove(id)}
                                title="Remove"
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center bg-wood-900 text-paper-50 text-xs leading-none rounded-full hover:bg-bronze-700"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={draft}
                    onChange={(e) => {
                        setDraft(e.target.value);
                        setError(null);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            add();
                        }
                    }}
                    placeholder="adrian-website/creations/mandala/seed-of-life"
                    className={fieldInput}
                />
                <button
                    type="button"
                    onClick={add}
                    className="shrink-0 px-4 border border-wood-300 text-wood-700 font-label text-xs uppercase tracking-[0.15em] font-semibold hover:border-wood-500 hover:text-wood-900 transition-colors"
                >
                    Add
                </button>
            </div>
            {error && (
                <p className="font-reading italic text-sm text-stone-600 mt-2">{error}</p>
            )}
        </div>
    );
};

// ───────────────────────────────────────────────────────────────────────────
// Editor form — the piece's story · materials · provenance · gallery.
// ───────────────────────────────────────────────────────────────────────────

const EMPTY_FORM = { story: '', materials: '', provenance: '', images: [] as string[] };

const PieceContentEditor: React.FC = () => {
    const [pieceId, setPieceId] = useState('');
    const [form, setForm] = useState(EMPTY_FORM);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [savedAt, setSavedAt] = useState<string | null>(null);
    const adminFetch = useAdminFetch();

    const staticInfo = pieceOptions.find((p) => p.id === pieceId);

    useEffect(() => {
        if (!pieceId) {
            setForm(EMPTY_FORM);
            return;
        }
        let active = true;
        setLoading(true);
        setLoadError(null);
        setSavedAt(null);
        (async () => {
            try {
                const res = await adminFetch(
                    `/api/atlas/admin/piece-content?pieceId=${encodeURIComponent(pieceId)}`,
                );
                if (res.status === 401 || res.status === 403) {
                    window.location.href = '/admin/login';
                    return;
                }
                const data = await res.json();
                if (!active) return;
                if (data?.ok) {
                    const content = data.content as PieceContent | null;
                    setForm(
                        content
                            ? {
                                  story: content.story ?? '',
                                  materials: content.materials ?? '',
                                  provenance: content.provenance ?? '',
                                  images: content.images ?? [],
                              }
                            : EMPTY_FORM,
                    );
                } else {
                    setLoadError(data?.error || 'Could not load this piece\'s content.');
                }
            } catch {
                if (active) setLoadError('Network error. Check your connection.');
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [pieceId, adminFetch]);

    const save = async () => {
        if (!pieceId) {
            setSaveError('Pick a piece first.');
            return;
        }
        setSaving(true);
        setSaveError(null);
        setSavedAt(null);
        try {
            const res = await adminFetch('/api/atlas/admin/piece-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pieceId,
                    story: form.story,
                    materials: form.materials,
                    provenance: form.provenance,
                    images: form.images,
                }),
            });
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
                return;
            }
            const data = await res.json();
            if (data?.ok) {
                setSavedAt(new Date().toLocaleTimeString());
            } else {
                setSaveError(data?.error || 'Could not save.');
            }
        } catch {
            setSaveError('Network error. Check your connection.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-wood-50 border border-wood-200 p-8 mb-10">
            <h2 className={sectionTitle}>Piece</h2>
            <p className={sectionLead}>
                Pick a piece, then write its story, materials, provenance, and
                gallery. Saved content replaces the placeholder description on
                its public page — the title, dimensions, and edition stay with
                the archive.
            </p>

            <div className="mb-6">
                <label className={fieldLabel}>Piece</label>
                <PiecePicker value={pieceId} onChange={setPieceId} />
            </div>

            {!pieceId && (
                <p className="font-reading italic text-sm text-wood-500">
                    Choose a piece above to begin.
                </p>
            )}

            {pieceId && loading && (
                <p className="font-reading italic text-sm text-wood-500">Loading…</p>
            )}

            {pieceId && !loading && (
                <div className="space-y-6">
                    {loadError && (
                        <p className="font-reading italic text-sm text-stone-600">{loadError}</p>
                    )}

                    {staticInfo?.staticDescription && (
                        <p className="font-reading italic text-sm text-wood-500 border-l-2 border-wood-200 pl-3">
                            Current placeholder · {staticInfo.staticDescription}
                        </p>
                    )}

                    <div>
                        <label className={fieldLabel}>
                            Story ({form.story.length}/{STORY_MAX_LENGTH})
                        </label>
                        <textarea
                            value={form.story}
                            onChange={(e) => setForm({ ...form, story: e.target.value })}
                            maxLength={STORY_MAX_LENGTH}
                            rows={10}
                            placeholder="The piece's real story — what it carries, where it came from, why it exists…"
                            className={fieldTextarea}
                        />
                    </div>

                    <div>
                        <label className={fieldLabel}>
                            Materials ({form.materials.length}/{MATERIALS_MAX_LENGTH})
                        </label>
                        <textarea
                            value={form.materials}
                            onChange={(e) => setForm({ ...form, materials: e.target.value })}
                            maxLength={MATERIALS_MAX_LENGTH}
                            rows={2}
                            placeholder={staticInfo?.staticMaterial || 'Materials, in Adrian\'s own words…'}
                            className={fieldTextarea}
                        />
                    </div>

                    <div>
                        <label className={fieldLabel}>
                            Provenance ({form.provenance.length}/{PROVENANCE_MAX_LENGTH})
                        </label>
                        <textarea
                            value={form.provenance}
                            onChange={(e) => setForm({ ...form, provenance: e.target.value })}
                            maxLength={PROVENANCE_MAX_LENGTH}
                            rows={4}
                            placeholder="Where this piece has been · who has held it · notable history…"
                            className={fieldTextarea}
                        />
                    </div>

                    <ImagesEditor
                        images={form.images}
                        onChange={(images) => setForm({ ...form, images })}
                    />

                    {saveError && (
                        <p className="font-reading italic text-sm text-stone-600">{saveError}</p>
                    )}
                    {savedAt && (
                        <p className="font-label text-[11px] uppercase tracking-[0.15em] text-green-800 font-semibold">
                            Saved · {savedAt}
                        </p>
                    )}

                    <button
                        onClick={save}
                        disabled={saving}
                        className="w-full bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 hover:bg-bronze-700 transition-colors disabled:opacity-40"
                    >
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                </div>
            )}
        </div>
    );
};

// ───────────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────────

const AdminPieceContent: React.FC = () => {
    return (
        <AdminLayout>
            <section className="pt-12 pb-32 px-6">
                <div className="max-w-2xl mx-auto">
                    <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold mb-3">
                        Admin
                    </p>
                    <h1 className="font-title text-4xl text-wood-900 mb-2 tracking-[0.05em]">
                        Piece Content
                    </h1>
                    <p className="font-reading text-sm text-wood-500 mb-12">
                        Write each piece's story, materials, provenance, and
                        gallery — no code edits.
                    </p>

                    <PieceContentEditor />
                </div>
            </section>
        </AdminLayout>
    );
};

export default AdminPieceContent;
