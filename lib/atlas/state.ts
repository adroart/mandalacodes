import { useEffect, useState } from 'react';
import type { PublicAtlasState } from '../../types';
import { CITIES_BY_ID, formatPlaceLabel } from '../../data/cities';
import { FULL_ARCHIVE } from '../../data/mockData';
import { ulCardNumber } from '../../utils/universalLanguage';

/* Shared atlas-state loader. The Atlas page and the card page's "On the
 * Atlas" seat both read the same public state; fetching it once per session
 * keeps the two surfaces telling the same story.
 *
 * The record is the premise: a light means a life is attached to a real
 * piece. So a valid EMPTY canonical state passes straight through and the sky
 * stands empty, waiting for its first light. Nothing is ever stood in for it.
 * Failure rejects, so every surface can render an explicit unavailable state
 * instead of presenting invented or unsnapshotted data. */

let atlasStatePromise: Promise<PublicAtlasState> | null = null;

/** An empty record: the shape the canonical feed returns before the first
 *  piece is claimed. Used only by the development preview below. */
function emptyAtlasState(): PublicAtlasState {
  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: 2,
    pieces: [],
    cities: [],
  };
}

/**
 * Load the public atlas. Pass `force` to bypass the per-session cache and
 * refetch. Canonical failure rejects; there is no local production snapshot.
 */
export function loadAtlasState(force = false): Promise<PublicAtlasState> {
  // Development-only preview: `?emptysky` resolves an empty record, so the
  // honest empty state can be read locally where the dev server otherwise
  // seeds pieces. Gated on import.meta.env.DEV and on a window, so it cannot
  // reach a production build. It invents nothing; it only withholds.
  if (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('emptysky')
  ) {
    return Promise.resolve(emptyAtlasState());
  }

  if (force) atlasStatePromise = null;
  if (!atlasStatePromise) {
    atlasStatePromise = fetch('/api/atlas')
      .then(async (res) => {
        if (!res.ok) throw new Error(`atlas ${res.status}`);
        const body = (await res.json()) as { ok?: unknown; state?: unknown };
        if (!body || body.ok !== true || !body.state || typeof body.state !== 'object') {
          throw new Error('atlas malformed');
        }
        const state = body.state as PublicAtlasState;
        if (!Array.isArray(state.pieces) || !Array.isArray(state.cities)) {
          throw new Error('atlas malformed');
        }
        // A canonical SUCCESS with zero pieces is the truth, not a gap to
        // fill: the registry is real and nothing has been claimed yet. It
        // passes through untouched and every surface says so plainly.
        return state;
      });
  }
  return atlasStatePromise;
}

/* ─── Card to placement lookup ────────────────────────────────────────────
 * Where the physical piece behind a Universal Language card has come to
 * rest. The atlas keys pieces by archive pieceId; the bridge back to a card
 * number runs through the artwork's coverImage naming. */

export interface CardPlacement {
  pieceId: string;
  editionNumber?: number;
  status: 'seeking' | 'placed' | 'unawakened';
  /** "Lisbon, Portugal", present only when placed in a known city. */
  cityLabel?: string;
}

export function findPlacementForCard(
  state: PublicAtlasState,
  cardNumber: number,
): CardPlacement | null {
  for (const piece of state.pieces) {
    const art = FULL_ARCHIVE.find((a) => a.id === piece.pieceId);
    if (!art || art.series !== 'Universal Language') continue;
    if (ulCardNumber(art.coverImage) !== cardNumber) continue;
    const city = piece.cityId ? CITIES_BY_ID.get(piece.cityId) : undefined;
    return {
      pieceId: piece.pieceId,
      editionNumber: piece.editionNumber,
      status: piece.status,
      cityLabel: city ? formatPlaceLabel(city) : undefined,
    };
  }
  return null;
}

/* ─── Single-piece lookup (the public piece page) ─────────────────────────
 * The piece page resolves `/piece/:pieceId` (optionally `/piece/:pieceId/:ed`)
 * against the same public state every other surface reads. The piece-key
 * convention is `pieceId:editionNumber ?? 0`; a deep link without an edition
 * resolves via the `:0` fallback (first matching piece). */

export type PublicPiece = PublicAtlasState['pieces'][number];

/**
 * Find a single public piece by pieceId and (optional) edition number.
 * When `editionNumber` is omitted, matches the first piece for that pieceId
 * (the `:0`/no-edition fallback). Returns null when absent from public state,
 * i.e. seeking-but-private, withdrawn, retired, or simply not in the ledger.
 */
export function findPublicPiece(
  state: PublicAtlasState,
  pieceId: string,
  editionNumber?: number,
): PublicPiece | null {
  if (typeof editionNumber === 'number') {
    return (
      state.pieces.find(
        (p) => p.pieceId === pieceId && (p.editionNumber ?? 0) === editionNumber,
      ) ?? null
    );
  }
  return state.pieces.find((p) => p.pieceId === pieceId) ?? null;
}

/** Placement of a card's physical piece, or null while loading / when the
 *  piece isn't on the public atlas. */
export function useCardPlacement(cardNumber: number): CardPlacement | null {
  const [placement, setPlacement] = useState<CardPlacement | null>(null);

  useEffect(() => {
    let active = true;
    setPlacement(null);
    loadAtlasState()
      .then((state) => {
        if (active) setPlacement(findPlacementForCard(state, cardNumber));
      })
      .catch(() => {
        if (active) setPlacement(null);
      });
    return () => {
      active = false;
    };
  }, [cardNumber]);

  return placement;
}
