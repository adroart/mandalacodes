/**
 * sizeBands.ts
 *
 * Classifies artwork into small / medium / large size bands based on
 * the piece's `dimensions` string and/or `sizeVariants`.
 *
 * ─── Threshold rationale ───────────────────────────────────────────────────
 * Observed distribution across the 64 pieces in data/mockData.ts
 * (all Universal Language, all square):
 *
 *   23 in (58 cm) square   → 62 pieces   → small  (< 24 in)
 *   35.5 in (90 cm) square →  1 piece    → medium (24 in to < 36 in)
 *   39 in (99 cm) square   →  1 piece    → large  (≥ 36 in)
 *
 * The current data is heavily weighted to the 23 in standard edition.
 * Thresholds are chosen to be meaningful for the full expected catalogue
 * (which will introduce smaller works and larger commission pieces over time)
 * rather than to force equal splits on the current 64 entries.
 *
 *   small  — longest dimension < 24 in
 *   medium — 24 in ≤ longest dimension < 36 in
 *   large  — longest dimension ≥ 36 in
 * ───────────────────────────────────────────────────────────────────────────
 */

import type { Artwork } from '../types';

/** The three size bands used for filtering on the Atlas page. */
export type SizeBand = 'small' | 'medium' | 'large';

/**
 * Human-readable chip labels for each size band.
 * Format follows atlas-style-notes.md: middle dot separator, sentence case,
 * no em dashes (use `to` for ranges or `and above` for the open upper end).
 */
export const SIZE_BAND_LABELS: Record<SizeBand, string> = {
  small: 'Small · under 24 in',
  medium: 'Medium · 24 to 35 in',
  large: 'Large · 36 in and above',
};

/** Ordered list of all size bands, smallest to largest. */
export const SIZE_BANDS: readonly SizeBand[] = ['small', 'medium', 'large'];

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Centimetres to inches conversion factor. */
const CM_TO_IN = 0.393701;

/**
 * Parses a single measurement token and returns inches, or null if unparseable.
 *
 * Handles:
 *   - `23`           (bare number, assumed inches when context says "in")
 *   - `35.5`         (decimal)
 *   - `23 in`        (explicit inch suffix)
 *   - `58 cm`        (centimetre — converted)
 *   - `24 x 36`      (dimensions string — caller should extract tokens first)
 */
function parseInches(raw: string): number | null {
  const trimmed = raw.trim();

  // Match a number optionally followed by a unit
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(in|"|cm)?$/i);
  if (!match) return null;

  const value = parseFloat(match[1]);
  const unit = (match[2] ?? '').toLowerCase();

  if (unit === 'cm') return value * CM_TO_IN;
  // Treat bare numbers or inch markers as inches
  return value;
}

/**
 * Extracts all numeric measurements from a `dimensions` string and returns
 * the **largest value in inches**.
 *
 * Handles formats found in the catalogue:
 *   - `"23 in (58 cm) square"` → 23 in (the cm duplicate is ignored once an
 *      inch value is found; we take the max to handle `24 x 36 in`)
 *   - `"35.5 in (90 cm) square"` → 35.5 in
 *   - `"24 x 36 in"` → 36
 *   - `"90 cm"` (cm-only) → ~35.4 in
 *
 * Returns null when no parseable measurement is found.
 */
function largestInchesFromDimensions(dimensions: string): number | null {
  // Tokenise on common separators: whitespace, 'x', '×', comma, 'by', parens
  // We extract all (number, optional-unit) pairs and pick the largest
  // inch-resolved value that appears in an inch context OR any cm value when
  // no inch values are present.

  // First pass: find explicit inch measurements
  const inchPattern = /(\d+(?:\.\d+)?)\s*(?:in|")/gi;
  const inchValues: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = inchPattern.exec(dimensions)) !== null) {
    const v = parseFloat(m[1]);
    if (!isNaN(v)) inchValues.push(v);
  }

  if (inchValues.length > 0) {
    return Math.max(...inchValues);
  }

  // Second pass: cm-only strings — convert and return largest
  const cmPattern = /(\d+(?:\.\d+)?)\s*cm/gi;
  const cmValues: number[] = [];
  while ((m = cmPattern.exec(dimensions)) !== null) {
    const v = parseFloat(m[1]);
    if (!isNaN(v)) cmValues.push(v * CM_TO_IN);
  }

  if (cmValues.length > 0) {
    return Math.max(...cmValues);
  }

  // Third pass: bare numbers separated by 'x' or '×' with no unit — assume inches
  const barePattern = /(\d+(?:\.\d+)?)\s*(?:x|×)/gi;
  const bareValues: number[] = [];
  while ((m = barePattern.exec(dimensions)) !== null) {
    const v = parseFloat(m[1]);
    if (!isNaN(v)) bareValues.push(v);
  }
  // Also grab the last number after the final separator
  const lastBare = dimensions.match(/(?:x|×)\s*(\d+(?:\.\d+)?)/i);
  if (lastBare) bareValues.push(parseFloat(lastBare[1]));

  if (bareValues.length > 0) {
    return Math.max(...bareValues);
  }

  return null;
}

/**
 * Parses a size variant label (e.g. `'16"'`, `'24"'`, `'36"'`, `'90 cm'`)
 * and returns the value in inches, or null when unparseable.
 */
function variantLabelToInches(size: string): number | null {
  return parseInches(size.trim());
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Returns the {@link SizeBand} for an artwork, or `null` when no parseable
 * measurement can be found on the piece.
 *
 * Resolution order:
 * 1. If the artwork has `sizeVariants`, use the **largest** variant's size
 *    label (so a configurable piece is classified by its biggest available
 *    format, giving collectors the correct upper-bound bucket).
 * 2. Otherwise fall back to the `dimensions` string.
 *
 * @param art - The artwork to classify.
 * @returns The size band, or `null` if the measurement is unparseable.
 *
 * @example
 * sizeBandFor({ dimensions: '23 in (58 cm) square', ...rest }) // → 'small'
 * sizeBandFor({ dimensions: '35.5 in (90 cm) square', ...rest }) // → 'medium'
 * sizeBandFor({ dimensions: '39 in (99 cm) square', ...rest }) // → 'large'
 * sizeBandFor({ sizeVariants: [{ size: '16"', ... }, { size: '36"', ... }], ...rest }) // → 'large'
 */
export function sizeBandFor(art: Artwork): SizeBand | null {
  let largestIn: number | null = null;

  // Prefer sizeVariants (use largest variant)
  const variants = art.sizeVariants ?? art.madeToOrderSizes;
  if (variants && variants.length > 0) {
    const variantInches = variants
      .map((v) => variantLabelToInches(v.size))
      .filter((v): v is number => v !== null);

    if (variantInches.length > 0) {
      largestIn = Math.max(...variantInches);
    }
  }

  // Fall back to dimensions string
  if (largestIn === null && art.dimensions) {
    largestIn = largestInchesFromDimensions(art.dimensions);
  }

  if (largestIn === null) return null;

  // Apply thresholds
  if (largestIn < 24) return 'small';
  if (largestIn < 36) return 'medium';
  return 'large';
}
