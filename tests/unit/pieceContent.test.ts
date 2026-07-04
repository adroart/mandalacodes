/**
 * Unit suite for utils/pieceContent.ts — the pure validation/normalization
 * and row (de)serialization layer behind the piece-page editorial content
 * decision (D1 `atlas_piece_content` + admin editor; see
 * todo/handoff/adrian-website/004_piece_content.sql and the decision record
 * in todo/handoff/GO-LIVE-RUNBOOK.md).
 *
 * The Functions handlers (functions/api/atlas/piece-content.ts,
 * functions/api/atlas/admin/piece-content.ts) are thin compositions over
 * this layer, so we pin the pure logic here rather than mocking D1.
 */
import { describe, expect, it } from 'vitest';
import {
  IMAGE_ID_MAX_LENGTH,
  MATERIALS_MAX_LENGTH,
  MAX_IMAGES,
  PROVENANCE_MAX_LENGTH,
  STORY_MAX_LENGTH,
  isValidImageId,
  parseImagesJson,
  rowToPieceContent,
  serializeImages,
  validatePieceContentInput,
} from '../../utils/pieceContent';
import type { PieceContentRow } from '../../utils/pieceContent';

// ---------- validatePieceContentInput ----------

describe('validatePieceContentInput', () => {
  it('rejects a non-object body', () => {
    expect(validatePieceContentInput(null).ok).toBe(false);
    expect(validatePieceContentInput('x').ok).toBe(false);
    expect(validatePieceContentInput(undefined).ok).toBe(false);
  });

  it('accepts an empty body — every field is optional', () => {
    const r = validatePieceContentInput({});
    expect(r).toEqual({
      ok: true,
      value: { story: undefined, materials: undefined, provenance: undefined, images: [] },
    });
  });

  it('trims text fields and treats whitespace-only as absent (clears the field)', () => {
    const r = validatePieceContentInput({
      story: '  a real story  ',
      materials: '   ',
      provenance: '',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.story).toBe('a real story');
    expect(r.value.materials).toBeUndefined();
    expect(r.value.provenance).toBeUndefined();
  });

  it('enforces the story/provenance/materials length caps', () => {
    expect(
      validatePieceContentInput({ story: 'x'.repeat(STORY_MAX_LENGTH) }).ok,
    ).toBe(true);
    expect(
      validatePieceContentInput({ story: 'x'.repeat(STORY_MAX_LENGTH + 1) }).ok,
    ).toBe(false);
    expect(
      validatePieceContentInput({ provenance: 'y'.repeat(PROVENANCE_MAX_LENGTH + 1) }).ok,
    ).toBe(false);
    expect(
      validatePieceContentInput({ materials: 'z'.repeat(MATERIALS_MAX_LENGTH + 1) }).ok,
    ).toBe(false);
  });

  it('rejects images that are not a list', () => {
    expect(validatePieceContentInput({ images: 'not-a-list' }).ok).toBe(false);
    expect(validatePieceContentInput({ images: { 0: 'a' } }).ok).toBe(false);
  });

  it('drops empty entries, trims ids, and enforces the 12-image cap', () => {
    const r = validatePieceContentInput({
      images: ['  adrian-website/one  ', '', '   ', 'adrian-website/two'],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.images).toEqual(['adrian-website/one', 'adrian-website/two']);

    const tooMany = Array.from({ length: MAX_IMAGES + 1 }, (_, i) => `img-${i}`);
    expect(validatePieceContentInput({ images: tooMany }).ok).toBe(false);
    const exactlyMax = Array.from({ length: MAX_IMAGES }, (_, i) => `img-${i}`);
    expect(validatePieceContentInput({ images: exactlyMax }).ok).toBe(true);
  });

  it('rejects an image id with a bad charset or over the length cap', () => {
    expect(validatePieceContentInput({ images: ['ok/id_1.2-3'] }).ok).toBe(true);
    expect(validatePieceContentInput({ images: ['bad id with spaces'] }).ok).toBe(false);
    expect(validatePieceContentInput({ images: ['bad<script>'] }).ok).toBe(false);
    expect(
      validatePieceContentInput({ images: ['x'.repeat(IMAGE_ID_MAX_LENGTH + 1)] }).ok,
    ).toBe(false);
  });
});

// ---------- isValidImageId ----------

describe('isValidImageId', () => {
  it('accepts folder-path-like Cloudinary public ids', () => {
    expect(isValidImageId('adrian-website/creations/mandala/seed-of-life')).toBe(true);
    expect(isValidImageId('32_x9qxas')).toBe(true);
  });

  it('rejects empty, non-string, oversized, or bad-charset ids', () => {
    expect(isValidImageId('')).toBe(false);
    expect(isValidImageId(42)).toBe(false);
    expect(isValidImageId(null)).toBe(false);
    expect(isValidImageId('a'.repeat(IMAGE_ID_MAX_LENGTH + 1))).toBe(false);
    expect(isValidImageId('has spaces')).toBe(false);
    expect(isValidImageId('semi;colon')).toBe(false);
  });
});

// ---------- images JSON round-trip ----------

describe('parseImagesJson / serializeImages', () => {
  it('round-trips an array of ids', () => {
    const images = ['a/b', 'c_d'];
    expect(parseImagesJson(serializeImages(images))).toEqual(images);
  });

  it('degrades to an empty array on missing/malformed/non-array JSON', () => {
    expect(parseImagesJson(null)).toEqual([]);
    expect(parseImagesJson(undefined)).toEqual([]);
    expect(parseImagesJson('')).toEqual([]);
    expect(parseImagesJson('not json')).toEqual([]);
    expect(parseImagesJson('{"not":"an array"}')).toEqual([]);
  });

  it('filters out non-string entries from malformed JSON', () => {
    expect(parseImagesJson('["a", 1, null, "b"]')).toEqual(['a', 'b']);
  });
});

// ---------- rowToPieceContent ----------

describe('rowToPieceContent', () => {
  it('maps a full row to the camelCase view', () => {
    const row: PieceContentRow = {
      piece_id: 'UL-100',
      story: 'A long story.',
      materials: 'Laser cut wood',
      images: '["a/b","c/d"]',
      provenance: 'From the studio in 2024.',
      updated_at: '2026-07-02T00:00:00.000Z',
    };
    expect(rowToPieceContent(row)).toEqual({
      pieceId: 'UL-100',
      story: 'A long story.',
      materials: 'Laser cut wood',
      images: ['a/b', 'c/d'],
      provenance: 'From the studio in 2024.',
      updatedAt: '2026-07-02T00:00:00.000Z',
    });
  });

  it('maps nulls to undefined and empty/missing images to []', () => {
    const row: PieceContentRow = {
      piece_id: 'UL-101',
      story: null,
      materials: null,
      images: null,
      provenance: null,
      updated_at: '2026-07-02T00:00:00.000Z',
    };
    const content = rowToPieceContent(row);
    expect(content.story).toBeUndefined();
    expect(content.materials).toBeUndefined();
    expect(content.provenance).toBeUndefined();
    expect(content.images).toEqual([]);
  });
});
