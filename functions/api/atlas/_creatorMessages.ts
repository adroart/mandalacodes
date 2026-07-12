/**
 * The creator's message, the line that travels with a piece and is revealed
 * in the final beat of the claim ceremony, after the light has ignited.
 *
 * No HTTP handler (leading underscore keeps Pages from routing this); the
 * steward claim route imports the resolver and folds the chosen message into
 * the Phase B response. The client never reveals it before ignition.
 *
 * Two sources, override wins:
 *   - DEFAULT_MESSAGES, six placeholder lines. Adrian writes the real six.
 *   - PIECE_OVERRIDES , highly-custom, per-piece messages keyed by pieceId.
 *
 * Selection is deterministic: the same piece always draws the same default
 * (a stable hash of its pieceId modulo the pool), so a retry never re-rolls
 * the line and the message reads as belonging to the piece, not to chance.
 */

/**
 * PLACEHOLDER, Adrian writes the real six. Each of these is a stand-in for one
 * of the six messages that will travel with pieces across the whole body of
 * work. Keep the count at six so the deterministic modulo stays stable.
 */
export const DEFAULT_MESSAGES: readonly string[] = [
  'PLACEHOLDER, Adrian writes the real six. (1) A first message from the maker, to be replaced.',
  'PLACEHOLDER, Adrian writes the real six. (2) A second message from the maker, to be replaced.',
  'PLACEHOLDER, Adrian writes the real six. (3) A third message from the maker, to be replaced.',
  'PLACEHOLDER, Adrian writes the real six. (4) A fourth message from the maker, to be replaced.',
  'PLACEHOLDER, Adrian writes the real six. (5) A fifth message from the maker, to be replaced.',
  'PLACEHOLDER, Adrian writes the real six. (6) A sixth message from the maker, to be replaced.',
];

/**
 * Highly-custom, per-piece creator messages. Keyed by pieceId (NOT the
 * edition-qualified key): a message travels with the artwork, not a single
 * edition. An entry here wins over the deterministic default for that piece.
 * Empty until Adrian writes bespoke lines for specific pieces.
 */
export const PIECE_OVERRIDES: Record<string, string> = {};

/** Stable FNV-1a hash of a string, matching the register used elsewhere in
 *  the atlas (utils/letters.ts seedIndex) so behaviour is predictable. */
function hashIndex(seed: string, count: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return count > 0 ? h % count : 0;
}

/**
 * The creator's message for a piece. An override wins; otherwise the piece's
 * id hashes deterministically into the default pool. Returns null only if the
 * default pool is somehow empty (it never is).
 */
export function creatorMessageFor(pieceId: string): string | null {
  const override = PIECE_OVERRIDES[pieceId];
  if (typeof override === 'string' && override.trim()) return override;
  if (DEFAULT_MESSAGES.length === 0) return null;
  return DEFAULT_MESSAGES[hashIndex(pieceId, DEFAULT_MESSAGES.length)];
}
