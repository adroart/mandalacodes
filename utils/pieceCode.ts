/**
 * Piece code, the short sigil a piece is known by on the Atlas (e.g. `UL № 1`).
 *
 * Universal Language pieces read as `UL № <card number>` (1–64); every other
 * series or category resolves its prefix from the FROZEN TABLE below and a
 * stable short number from the piece id. The format is fixed: `<PREFIX> № <n>`.
 *
 * Used by the selection inscription (AtlasPage), the PieceHUD header, the
 * public piece certificate, and the printed plaque/insert generators, so a
 * piece is named by its code first, its long title second.
 *
 * ─── FOREVER CONTRACT (Adrian, 2026-07-18) ─────────────────────────────────
 * A sigil is printed onto and shipped with a physical piece. Once printed it
 * can never change (todo/plans/claim-code-integration.md, "The forever
 * contract"). Therefore the prefix table and the numbering rules below are a
 * permanent contract: ADDITIONS ONLY, NEVER EDITS. A new series adds a new
 * row; an existing row's prefix is never touched once any piece bearing it
 * has been printed. The initials-derivation fallback exists ONLY for a series
 * that has no row yet AND no piece printed — the moment such a series ships,
 * pin it here with an explicit row (and, if its ids carry no number, an
 * explicit `sigilNumber` per piece) so its sigils are frozen too.
 * ──────────────────────────────────────────────────────────────────────────
 */

export interface PieceCodeInput {
  pieceId: string;
  series?: string;
  category?: string;
  /** Universal Language card number (1–64), when the piece carries one. */
  cardNumber?: number;
  /** Multidimensional Art pieces outside any named series (Artwork.isSignaturePiece).
   *  Sigils as `SG № n`. */
  isSignaturePiece?: boolean;
  /** Curated sigil number lock (Artwork.sigilNumber). When present it WINS over
   *  cardNumber, the id's trailing digits, and the stable hash — the way to pin
   *  a permanent number onto a piece whose id carries none. Part of the forever
   *  contract once printed. */
  sigilNumber?: number;
}

/** The numero sign the code format is built around. */
const NUMERO = '№'; // №

/**
 * FROZEN PREFIX TABLE — series name → sigil prefix. Additions only, never
 * edits (see the forever-contract note at the top of this file). Each row is
 * a permanent promise about how that series' pieces are named in print.
 */
const SERIES_PREFIX: Readonly<Record<string, string>> = {
  'Universal Language': 'UL',
  Mandala: 'MA',
  'Light Codes': 'LC',
};

/**
 * FROZEN CATEGORY FALLBACK TABLE — used only when a piece has no named series
 * (or its series has no row yet). Additions only, never edits.
 */
const CATEGORY_PREFIX: Readonly<Record<string, string>> = {
  Jewelry: 'JW',
};

/** Signature pieces (isSignaturePiece) — frozen prefix. */
const SIGNATURE_PREFIX = 'SG';

/**
 * Pre-freeze LAST RESORT ONLY. A prefix for a series/category that has no row
 * in the frozen tables above and no piece printed yet: initials of its first
 * two words, uppercased (a single word contributes its first two letters).
 * The instant a piece under such a name ships, add an explicit row above so
 * its sigil is frozen — this derivation must never be the source of a printed
 * sigil once the tables can cover it.
 */
function prefixFromNamePreFreeze(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'PC';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/** Resolve the frozen prefix for a piece. */
function prefixFor(input: PieceCodeInput): string {
  const { series, category, isSignaturePiece } = input;
  if (series && SERIES_PREFIX[series]) return SERIES_PREFIX[series];
  if (isSignaturePiece) return SIGNATURE_PREFIX;
  if (category && CATEGORY_PREFIX[category]) return CATEGORY_PREFIX[category];
  // Pre-freeze last resort (documented default for an unknown series):
  return prefixFromNamePreFreeze(series ?? category ?? 'Piece');
}

/** A small, stable number from a piece id: its trailing digits when present,
 *  otherwise a bounded hash, so non-UL pieces still get a steady number. The
 *  hash is deterministic and frozen: its output for a given id must never
 *  change (a printed sigil depends on it). */
function stableNumberFromId(id: string): number {
  const trailing = id.match(/(\d+)\s*$/);
  if (trailing) {
    const n = parseInt(trailing[1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 999) + 1;
}

/**
 * The piece's code, e.g. `UL № 1`.
 *
 * Number precedence (forever contract): the curated `sigilNumber` lock wins
 * over everything; else the UL `cardNumber`; else the id's trailing digits;
 * else the stable hash. Prefix comes from the frozen tables above.
 */
export function pieceCode(input: PieceCodeInput): string {
  const { cardNumber, sigilNumber, pieceId } = input;
  const prefix = prefixFor(input);
  const number = sigilNumber ?? cardNumber ?? stableNumberFromId(pieceId);
  return `${prefix} ${NUMERO} ${number}`;
}
