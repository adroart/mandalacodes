/**
 * Piece code, the short sigil a piece is known by on the Atlas (e.g. `UL № 1`).
 *
 * Universal Language pieces read as `UL № <card number>` (1–64); any other
 * series derives a short prefix from its series (or category) name and a
 * stable short number from the piece id. The format is fixed: `<PREFIX> № <n>`.
 *
 * Used by the selection inscription (AtlasPage) and the PieceHUD header, so a
 * piece is named by its code first, its long title second.
 */

export interface PieceCodeInput {
  pieceId: string;
  series?: string;
  category?: string;
  /** Universal Language card number (1–64), when the piece carries one. */
  cardNumber?: number;
}

/** The numero sign the code format is built around. */
const NUMERO = '№'; // №

/** Prefix from a name: initials of its first two words, uppercased. A single
 *  word contributes its first two letters. */
function prefixFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'PC';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/** A small, stable number from a piece id: its trailing digits when present,
 *  otherwise a bounded hash, so non-UL pieces still get a steady number. */
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

/** The piece's code, e.g. `UL № 1`. */
export function pieceCode(input: PieceCodeInput): string {
  const { series, category, cardNumber, pieceId } = input;
  const prefix =
    series === 'Universal Language' ? 'UL' : prefixFromName(series ?? category ?? 'Piece');
  const number = cardNumber ?? stableNumberFromId(pieceId);
  return `${prefix} ${NUMERO} ${number}`;
}
