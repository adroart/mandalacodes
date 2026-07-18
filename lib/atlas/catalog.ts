import { useEffect, useState } from 'react';
import type { PublicCatalogEntry } from '../../utils/catalog';

/**
 * Shared public-catalog loader. The Catalog Room in the admin authors the
 * entries; every public surface (PiecePage today, filters and pickers next)
 * reads the same PUBLIC projection at /api/atlas/catalog. Fetched once per
 * session, like lib/atlas/state.ts — the two surfaces stay in step.
 *
 * The public projection carries no keeperEmail and no notes (utils/catalog
 * toPublicCatalogEntry); price + acquireUrl ride only on an 'available' piece.
 * Any failure (dev server without the Functions runtime, cold bucket, network
 * blip) resolves to an EMPTY list — a catalog miss falls through to the
 * archive / public-state / sigil fallbacks, never a broken page.
 */

let catalogPromise: Promise<PublicCatalogEntry[]> | null = null;

export function loadPublicCatalog(force = false): Promise<PublicCatalogEntry[]> {
  if (force) catalogPromise = null;
  if (!catalogPromise) {
    catalogPromise = fetch('/api/atlas/catalog')
      .then(async (res) => {
        if (!res.ok) throw new Error(`catalog ${res.status}`);
        const body = await res.json();
        if (!body || body.ok !== true || !Array.isArray(body.entries)) {
          throw new Error('catalog malformed');
        }
        return body.entries as PublicCatalogEntry[];
      })
      .catch(() => [] as PublicCatalogEntry[]);
  }
  return catalogPromise;
}

/** Find a single public catalog entry by id, or null. */
export function findCatalogEntry(
  entries: readonly PublicCatalogEntry[],
  id: string,
): PublicCatalogEntry | null {
  return entries.find((e) => e.id === id) ?? null;
}

/** The catalog entry for one piece id, or null while loading / when absent. */
export function useCatalogEntry(pieceId: string | undefined): PublicCatalogEntry | null {
  const [entry, setEntry] = useState<PublicCatalogEntry | null>(null);
  useEffect(() => {
    let active = true;
    setEntry(null);
    if (!pieceId) return;
    loadPublicCatalog().then((entries) => {
      if (active) setEntry(findCatalogEntry(entries, pieceId));
    });
    return () => {
      active = false;
    };
  }, [pieceId]);
  return entry;
}
