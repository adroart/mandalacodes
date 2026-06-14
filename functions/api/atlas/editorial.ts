/**
 * /api/atlas/editorial — the artist-written book of each piece.
 *
 *   GET  /api/atlas/editorial            → public. The whole editorial map
 *                                          (pieceId → PieceEditorial). The
 *                                          piece page reads this to render the
 *                                          story, photo gallery, materials and
 *                                          provenance the artist has written.
 *   POST /api/atlas/editorial            → admin-only. Save one piece's record.
 *                                          Body: { pieceId, story?, gallery?,
 *                                          materials?, provenance? }.
 *
 * Stored apart from the ledger: this is mutable prose + Cloudinary photo ids,
 * never part of the hashed chain. The static archive (data/mockData.ts) still
 * owns title / dimensions / cover image; this layer owns the narrative.
 */

import type { PieceEditorial } from '../../../types';
import type { PagesContext } from './_helpers';
import { json, readEditorial, writeEditorial } from './_helpers';
import { requireAdmin, isAuthResponse } from '../_lib/clerk';

// Generous caps so a long story or a deep gallery never gets cut, while still
// bounding what a single record can hold.
const MAX_STORY = 12_000;
const MAX_MATERIALS = 4_000;
const MAX_PROVENANCE = 8_000;
const MAX_GALLERY = 24;
const MAX_PUBLIC_ID = 300;

/** Public read — the whole map, cached briefly like the atlas state itself. */
export async function onRequestGet(context: PagesContext): Promise<Response> {
  const { env } = context;
  const editorial = await readEditorial(env);
  return new Response(JSON.stringify({ ok: true, editorial }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60',
    },
  });
}

/**
 * Validate + clean the POST body into a PieceEditorial. Unknown keys dropped;
 * empty strings normalized to undefined so the record stays lean. Returns the
 * clean record, or null when pieceId is missing/invalid.
 */
function cleanInput(body: unknown): PieceEditorial | null {
  if (!body || typeof body !== 'object') return null;
  const obj = body as Record<string, unknown>;
  if (typeof obj.pieceId !== 'string' || !obj.pieceId.trim()) return null;

  const str = (v: unknown, max: number): string | undefined => {
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    if (!t) return undefined;
    return t.slice(0, max);
  };

  const gallery = Array.isArray(obj.gallery)
    ? obj.gallery
        .filter((g): g is string => typeof g === 'string')
        .map((g) => g.trim())
        .filter(Boolean)
        .map((g) => g.slice(0, MAX_PUBLIC_ID))
        .slice(0, MAX_GALLERY)
    : undefined;

  return {
    pieceId: obj.pieceId.trim(),
    story: str(obj.story, MAX_STORY),
    materials: str(obj.materials, MAX_MATERIALS),
    provenance: str(obj.provenance, MAX_PROVENANCE),
    gallery: gallery && gallery.length > 0 ? gallery : undefined,
  };
}

/** Admin write — save one piece's editorial record. */
export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  const auth = await requireAdmin(request, env);
  if (isAuthResponse(auth)) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  const clean = cleanInput(body);
  if (!clean) {
    return json({ ok: false, error: 'A valid pieceId is required.' }, 400);
  }

  const record: PieceEditorial = {
    ...clean,
    updatedAt: new Date().toISOString(),
  };

  const saved = await writeEditorial(env, record.pieceId, record);
  if (saved instanceof Response) return saved;

  return json({ ok: true, editorial: saved });
}
