import type { PieceEditorial } from '../../types';

/* Client-side reader for the artist-written editorial layer (the piece's
 * "book": story, photo gallery, materials, provenance). Mirrors loadAtlasState
 * in state.ts — one fetch per session, shared across the piece page and any
 * other surface that wants a piece's written content. On any failure the
 * piece page simply falls back to the static archive description, so a missing
 * store never dead-ends a QR scan. */

let editorialPromise: Promise<Record<string, PieceEditorial>> | null = null;

export function loadEditorial(): Promise<Record<string, PieceEditorial>> {
  if (!editorialPromise) {
    editorialPromise = fetch('/api/atlas/editorial')
      .then(async (res) => {
        if (!res.ok) throw new Error(`editorial ${res.status}`);
        const body = await res.json();
        if (!body || body.ok !== true || typeof body.editorial !== 'object') {
          throw new Error('editorial malformed');
        }
        return body.editorial as Record<string, PieceEditorial>;
      })
      .catch(() => ({}) as Record<string, PieceEditorial>);
  }
  return editorialPromise;
}

/** One piece's editorial record, or null while loading / when none written. */
export function findEditorial(
  map: Record<string, PieceEditorial>,
  pieceId: string,
): PieceEditorial | null {
  return map[pieceId] ?? null;
}
