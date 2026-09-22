/**
 * Piece-page editorial content — pure validation/normalization + row
 * (de)serialization for `atlas_piece_content` (see
 * todo/handoff/adrian-website/004_piece_content.sql and the "Piece-page
 * content" decision record in todo/handoff/GO-LIVE-RUNBOOK.md).
 *
 * This table is Adrian's writing desk for the piece page: story, extra
 * photos, materials, provenance. It is deliberately NOT part of the hash
 * chain or ledger (plan decision 6) — editorial content lives ONLY here, a
 * plain mutable D1 row, so it can be freely re-saved. `data/mockData.ts`
 * (FULL_ARCHIVE) stays the source of truth for static fields (title,
 * dimensions, edition).
 *
 * Kept dependency-free (no Workers types) so it is testable in plain Vitest
 * — the Functions handlers (functions/api/atlas/piece-content.ts,
 * functions/api/atlas/admin/piece-content.ts) are thin compositions over
 * this layer, same philosophy as utils/inscriptions.ts.
 */

export const STORY_MAX_LENGTH = 8000;
export const PROVENANCE_MAX_LENGTH = 8000;
export const MATERIALS_MAX_LENGTH = 500;
export const MAX_IMAGES = 12;
export const IMAGE_ID_MAX_LENGTH = 200;

// Media object IDs are folder-path-like: letters, digits, underscore,
// hyphen, dot, forward slash (e.g. "adrian-website/creations/mandala/seed-of-life").
// No spaces or other punctuation — keeps them safe to drop straight into a
// delivery URL (see utils/media.ts) without further escaping.
const IMAGE_ID_PATTERN = /^[A-Za-z0-9_\-./]+$/;

/** The raw admin-editor input shape (whitelisted fields only). */
export interface PieceContentInput {
  story?: unknown;
  materials?: unknown;
  provenance?: unknown;
  images?: unknown;
}

/** The normalized, validated fields ready to persist. */
export interface NormalizedPieceContent {
  story?: string;
  materials?: string;
  provenance?: string;
  images: string[];
}

export type ValidationResult =
  | { ok: true; value: NormalizedPieceContent }
  | { ok: false; error: string };

/** The shape the piece page (and the admin editor) work with — a parsed,
 *  camelCase view of the D1 row. */
export interface PieceContent {
  pieceId: string;
  story?: string;
  materials?: string;
  images: string[];
  provenance?: string;
  updatedAt: string;
}

/** The raw D1 row shape (column names, nullable text columns). */
export interface PieceContentRow {
  piece_id: string;
  story: string | null;
  materials: string | null;
  images: string | null;
  provenance: string | null;
  updated_at: string;
}

function normalizeText(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  return trimmed ? trimmed : undefined;
}

/** True for a well-formed media object id: non-empty, within length,
 *  and drawn from the safe charset above. */
export function isValidImageId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    id.length <= IMAGE_ID_MAX_LENGTH &&
    IMAGE_ID_PATTERN.test(id)
  );
}

/** Parse the `images` TEXT column (a JSON array of strings) defensively —
 *  malformed or missing JSON degrades to an empty gallery rather than
 *  throwing, so a page render never breaks on a bad row. */
export function parseImagesJson(text: string | null | undefined): string[] {
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

/** Serialize an images array for the `images` TEXT column. */
export function serializeImages(images: readonly string[]): string {
  return JSON.stringify(images);
}

/**
 * Validate + normalize admin editor input before writing to D1. Trims text
 * fields (empty strings become `undefined`, i.e. "clear this field"),
 * enforces the length/count limits from the decision record, and validates
 * every image id's charset. Returns a typed error message on the first
 * violation — the admin endpoint returns it verbatim as a 400.
 */
export function validatePieceContentInput(input: unknown): ValidationResult {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'Invalid request body' };
  }
  const body = input as PieceContentInput;

  const story = normalizeText(body.story);
  if (story !== undefined && story.length > STORY_MAX_LENGTH) {
    return { ok: false, error: `story must be ${STORY_MAX_LENGTH} characters or fewer` };
  }

  const provenance = normalizeText(body.provenance);
  if (provenance !== undefined && provenance.length > PROVENANCE_MAX_LENGTH) {
    return {
      ok: false,
      error: `provenance must be ${PROVENANCE_MAX_LENGTH} characters or fewer`,
    };
  }

  const materials = normalizeText(body.materials);
  if (materials !== undefined && materials.length > MATERIALS_MAX_LENGTH) {
    return {
      ok: false,
      error: `materials must be ${MATERIALS_MAX_LENGTH} characters or fewer`,
    };
  }

  const rawImages = body.images;
  if (rawImages !== undefined && !Array.isArray(rawImages)) {
    return { ok: false, error: 'images must be a list' };
  }
  const images = (Array.isArray(rawImages) ? rawImages : [])
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter((x) => x.length > 0);

  if (images.length > MAX_IMAGES) {
    return { ok: false, error: `no more than ${MAX_IMAGES} images` };
  }
  for (const id of images) {
    if (!isValidImageId(id)) {
      return { ok: false, error: `invalid image id: ${id}` };
    }
  }

  return { ok: true, value: { story, materials, provenance, images } };
}

/** Parse a raw D1 row into the camelCase view the page + editor consume. */
export function rowToPieceContent(row: PieceContentRow): PieceContent {
  return {
    pieceId: row.piece_id,
    story: row.story ?? undefined,
    materials: row.materials ?? undefined,
    images: parseImagesJson(row.images),
    provenance: row.provenance ?? undefined,
    updatedAt: row.updated_at,
  };
}
