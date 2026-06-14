import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import AdminLayout from './AdminLayout';
import { FULL_ARCHIVE } from '../data/mockData';
import { img } from '../utils/cloudinary';
import type { PieceEditorial } from '../types';

/**
 * Admin · Pieces — where Adrian writes each piece's page.
 *
 * Pick a piece, write its story, materials and provenance, and assemble a
 * photo gallery from Cloudinary public ids. Saved to the live editorial store
 * (R2) and read by the public piece page at /piece/:id — no code edits, every
 * one of the 64 (and every future piece) editable here.
 *
 * The static archive (data/mockData.ts) still owns title, dimensions and the
 * cover image; this screen owns the narrative + extra photos. The cover always
 * leads the gallery, so what you add here are the *extra* views.
 *
 * Photo input is "paste the Cloudinary public id" — the same identifier every
 * archive image already uses. (A real upload widget for collectors to add
 * their own photos is a planned follow-up.)
 */

// Style tokens — mirrored from AdminAtlas.tsx so the two admin screens match.
const fieldLabel =
  'font-label text-[11px] uppercase tracking-[0.15em] text-wood-500 font-semibold block mb-2';
const fieldInput =
  'w-full border border-wood-300 bg-white px-4 py-3 font-sans text-sm text-wood-900 placeholder:text-wood-400 focus:outline-none focus:border-bronze-400';
const sectionTitle = 'font-title text-2xl text-wood-900 mb-2 tracking-[0.05em]';
const sectionLead = 'font-sans text-sm text-wood-500 mb-6';

interface PieceOption {
  id: string;
  label: string;
  coverImage: string;
}

// Same ordering as AdminAtlas: alphabetical by label so the picker is scannable.
const pieceOptions: PieceOption[] = FULL_ARCHIVE.map((a) => ({
  id: a.id,
  label: `${a.title} (${a.series ?? a.category} · ${a.year})`,
  coverImage: a.coverImage,
}))
  .slice()
  .sort((a, b) => a.label.localeCompare(b.label));

const archiveById = new Map(FULL_ARCHIVE.map((a) => [a.id, a]));

function useAdminFetch(): (input: string, init?: RequestInit) => Promise<Response> {
  const { getToken } = useAuth();
  return async (input, init = {}) => {
    const token = await getToken();
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Gallery editor — a list of Cloudinary public ids with live thumbnails.
// ───────────────────────────────────────────────────────────────────────────

const GalleryEditor: React.FC<{
  value: string[];
  onChange: (next: string[]) => void;
}> = ({ value, onChange }) => {
  const [draft, setDraft] = useState('');

  const add = () => {
    const id = draft.trim();
    if (!id || value.includes(id)) {
      setDraft('');
      return;
    }
    onChange([...value, id]);
    setDraft('');
  };

  const removeAt = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = value.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div>
      <label className={fieldLabel}>Extra photos (Cloudinary public ids)</label>
      <p className="font-sans text-xs text-wood-400 mb-3 leading-relaxed">
        The cover image already leads the gallery. Add the public id of each
        extra photo (upload it to Cloudinary first), e.g. <code className="font-mono">32_x9qxas</code>.
      </p>

      {value.length > 0 && (
        <ul className="space-y-2 mb-4">
          {value.map((id, i) => (
            <li
              key={`${id}-${i}`}
              className="flex items-center gap-3 border border-wood-200 bg-paper-50 p-2"
            >
              <img
                src={img(id, { w: 96, h: 96, crop: 'fill' })}
                alt=""
                className="w-12 h-12 object-cover bg-[#151311] shrink-0"
                loading="lazy"
              />
              <code className="font-mono text-xs text-wood-700 break-all flex-1">
                {id}
              </code>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="font-label text-[11px] uppercase tracking-[0.12em] text-wood-500 hover:text-bronze-700 disabled:opacity-30 px-2 py-1"
                  aria-label="Move up"
                >
                  up
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === value.length - 1}
                  className="font-label text-[11px] uppercase tracking-[0.12em] text-wood-500 hover:text-bronze-700 disabled:opacity-30 px-2 py-1"
                  aria-label="Move down"
                >
                  down
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  className="font-label text-[11px] uppercase tracking-[0.12em] text-stone-500 hover:text-stone-700 px-2 py-1"
                  aria-label="Remove"
                >
                  remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-3">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Cloudinary public id"
          className={fieldInput}
        />
        <button
          type="button"
          onClick={add}
          className="shrink-0 px-5 border border-wood-300 text-wood-700 font-label text-xs uppercase tracking-[0.15em] font-semibold hover:border-bronze-400 hover:text-bronze-700 transition-colors"
        >
          Add photo
        </button>
      </div>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────
// Editor form for the selected piece.
// ───────────────────────────────────────────────────────────────────────────

interface EditorForm {
  story: string;
  materials: string;
  provenance: string;
  gallery: string[];
}

const EMPTY_FORM: EditorForm = {
  story: '',
  materials: '',
  provenance: '',
  gallery: [],
};

const AdminPieces: React.FC = () => {
  const [pieceId, setPieceId] = useState('');
  const [form, setForm] = useState<EditorForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const adminFetch = useAdminFetch();

  const archive = pieceId ? archiveById.get(pieceId) : undefined;

  // Load the current editorial record whenever the selected piece changes.
  // The GET is public, so a plain fetch is fine; admin auth is only needed to
  // save. Reading per-piece keeps the form honest about what's already written.
  useEffect(() => {
    if (!pieceId) {
      setForm(EMPTY_FORM);
      setSavedAt(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    setSavedAt(null);
    fetch('/api/atlas/editorial')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ok?: boolean; editorial?: Record<string, PieceEditorial> } | null) => {
        if (!active) return;
        const rec = data?.editorial?.[pieceId];
        setForm({
          story: rec?.story ?? '',
          materials: rec?.materials ?? '',
          provenance: rec?.provenance ?? '',
          gallery: rec?.gallery ?? [],
        });
        setSavedAt(rec?.updatedAt ?? null);
      })
      .catch(() => {
        if (active) setError('Could not load this piece. You can still write and save.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pieceId]);

  const dirty = useMemo(() => {
    // Cheap "is there anything to save" guard for the button label.
    return (
      form.story.trim() !== '' ||
      form.materials.trim() !== '' ||
      form.provenance.trim() !== '' ||
      form.gallery.length > 0
    );
  }, [form]);

  const save = async () => {
    if (!pieceId) {
      setError('Pick a piece first.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await adminFetch('/api/atlas/editorial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pieceId,
          story: form.story,
          materials: form.materials,
          provenance: form.provenance,
          gallery: form.gallery,
        }),
      });
      if (res.status === 401 || res.status === 403) {
        window.location.href = '/admin/login';
        return;
      }
      const data = await res.json();
      if (data?.ok && data.editorial) {
        setSavedAt((data.editorial as PieceEditorial).updatedAt ?? new Date().toISOString());
      } else {
        setError(data?.error || 'Could not save. Please try again.');
      }
    } catch {
      setError('Network error. Check your connection.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <section className="pt-12 pb-32 px-6">
        <div className="max-w-2xl mx-auto">
          <p className="font-label text-[11px] uppercase tracking-[0.2em] text-bronze-600 font-semibold mb-3">
            Admin
          </p>
          <h1 className="font-title text-4xl text-wood-900 mb-2 tracking-[0.05em]">
            Pieces
          </h1>
          <p className="font-sans text-sm text-wood-500 mb-12">
            Write each piece's page: its story, materials, provenance and extra
            photos. Saved live and read by the piece's public page.
          </p>

          <div className="bg-white border border-wood-200 p-8">
            <h2 className={sectionTitle}>Write a piece</h2>
            <p className={sectionLead}>
              Pick a piece, write its book, and save. The title, dimensions and
              cover image come from the archive; everything here is yours to
              write.
            </p>

            {error && (
              <p className="font-serif italic text-sm text-stone-600 mb-4">
                {error}
              </p>
            )}

            <div className="space-y-6">
              <div>
                <label className={fieldLabel}>Piece</label>
                <select
                  value={pieceId}
                  onChange={(e) => setPieceId(e.target.value)}
                  className={fieldInput}
                >
                  <option value="">Choose a piece...</option>
                  {pieceOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {pieceId && archive && (
                <>
                  {/* Cover preview + a link to the live page. */}
                  <div className="flex items-center gap-4 border border-wood-200 bg-paper-50 p-3">
                    <img
                      src={img(archive.coverImage, { w: 120, h: 120, crop: 'fill' })}
                      alt=""
                      className="w-16 h-16 object-cover bg-[#151311] shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-serif text-base text-wood-900 leading-tight">
                        {archive.title}
                      </p>
                      <p className="font-sans text-xs text-wood-500 mt-0.5">
                        {[archive.dimensions, archive.material]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      <Link
                        to={`/piece/${pieceId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-label text-[10px] uppercase tracking-[0.18em] font-semibold text-bronze-700 hover:text-bronze-600 transition-colors mt-1 inline-block"
                      >
                        View the live page →
                      </Link>
                    </div>
                  </div>

                  {loading ? (
                    <p className="font-sans text-sm text-wood-400">Loading…</p>
                  ) : (
                    <>
                      <div>
                        <label className={fieldLabel}>Story</label>
                        <textarea
                          value={form.story}
                          onChange={(e) => setForm({ ...form, story: e.target.value })}
                          rows={10}
                          placeholder="The long story of this piece, in your voice. Blank lines become paragraph breaks."
                          className={`${fieldInput} font-serif text-base leading-[1.7] resize-y`}
                        />
                      </div>

                      <div>
                        <label className={fieldLabel}>Materials &amp; making</label>
                        <textarea
                          value={form.materials}
                          onChange={(e) => setForm({ ...form, materials: e.target.value })}
                          rows={3}
                          placeholder="How it was made, the woods and finishes, anything beyond the line in the archive."
                          className={`${fieldInput} font-serif text-base leading-[1.7] resize-y`}
                        />
                      </div>

                      <div>
                        <label className={fieldLabel}>Provenance</label>
                        <textarea
                          value={form.provenance}
                          onChange={(e) => setForm({ ...form, provenance: e.target.value })}
                          rows={4}
                          placeholder="The piece's making and history as you wish to tell it. (Where it has lived is drawn from the atlas separately.)"
                          className={`${fieldInput} font-serif text-base leading-[1.7] resize-y`}
                        />
                      </div>

                      <GalleryEditor
                        value={form.gallery}
                        onChange={(gallery) => setForm({ ...form, gallery })}
                      />

                      <div className="flex items-center gap-4 pt-2">
                        <button
                          type="button"
                          onClick={save}
                          disabled={saving}
                          className="bg-wood-900 text-paper-50 font-label text-xs uppercase tracking-[0.2em] font-semibold py-3 px-8 hover:bg-bronze-700 transition-colors disabled:opacity-40"
                        >
                          {saving ? 'Saving…' : dirty ? 'Save this page' : 'Save (empty)'}
                        </button>
                        {savedAt && !saving && (
                          <span className="font-sans text-xs text-wood-400">
                            Saved{' '}
                            {new Date(savedAt).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </AdminLayout>
  );
};

export default AdminPieces;
