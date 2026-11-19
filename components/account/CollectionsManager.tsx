import React, { useEffect, useState } from 'react';
import AccountLayout from './AccountLayout';
import { useCollections, type CollectionItem } from '../../lib/collections/context';
import { cardNumberFromItem } from '../../lib/collections/items';
import { CARD_BY_NUMBER } from '../../data/oracleData';
import { Link } from 'react-router-dom';
import { loadAtlasState, findPlacementForCard, type CardPlacement } from '../../lib/atlas/state';
import type { PublicAtlasState } from '../../types';

/* Cards saved from the card page arrive through cardCollectionItem, so the
 * same helper resolves them back here. An item that does not resolve to a real
 * code still gets a readable row rather than a blank one. */
const itemLabel = (item: CollectionItem): string => {
  const cardNumber = cardNumberFromItem(item);
  if (cardNumber !== null) {
    const card = CARD_BY_NUMBER.get(cardNumber);
    return card ? `${card.card_name} · Card ${card.number}` : `Card ${cardNumber}`;
  }
  if (item.kind === 'card') return `Card ${item.ref}`;
  if (item.kind === 'artwork') return `Artwork · ${item.ref}`;
  return `Product · ${item.ref}`;
};

const itemLink = (item: CollectionItem): string => {
  if (item.kind === 'card') return `/universal-language/${item.ref}`;
  // Other kinds reserved for future decks; v1 only writes 'card'.
  return `/universal-language/${item.ref}`;
};

/* Where a saved card's physical piece rests, in the same quiet phrasing as
 * the card page's "On the Atlas" seat and the piece HUD's "Where it rests"
 * line. Only card items resolve to a placement; other kinds and cards with
 * no matching piece return null and render no join line at all. */
const placementLine = (placement: CardPlacement | null): string | null => {
  if (!placement) return null;
  const line = (() => {
    if (placement.status === 'seeking') return 'seeking ground';
    if (placement.status === 'unawakened') {
      return placement.cityLabel
        ? `at rest in ${placement.cityLabel}, awaiting its keeper`
        : 'awaiting its keeper';
    }
    return placement.cityLabel ? `rests in ${placement.cityLabel}` : null;
  })();
  return line;
};

/* The atlas link only makes sense once a piece is actually mapped to a city
 * (placed or unawakened-but-placed), mirroring the card page's
 * `placementOnGlobe` gate exactly, so a link from either surface always
 * lands on a selected piece rather than an empty globe. */
const atlasHrefFor = (placement: CardPlacement | null): string | null => {
  if (!placement || !placement.cityLabel) return null;
  if (placement.status !== 'placed' && placement.status !== 'unawakened') return null;
  return `/atlas?piece=${encodeURIComponent(
    `${placement.pieceId}${
      typeof placement.editionNumber === 'number' && placement.editionNumber !== 0
        ? `:${placement.editionNumber}`
        : ''
    }`,
  )}`;
};

const CollectionsManagerInner: React.FC = () => {
  const { collections, isLoading, error, reload, createCollection, deleteCollection, removeItem, renameCollection } =
    useCollections();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [mutationError, setMutationError] = useState<string | null>(null);
  /* Loaded once per mount and reused across every collection/item below:
   * 64 cards max, so a synchronous map over items is simpler than a hook
   * per item. If it fails, atlasState stays null and every join line is
   * simply absent; the rest of the page renders exactly as today. */
  const [atlasState, setAtlasState] = useState<PublicAtlasState | null>(null);

  useEffect(() => {
    let active = true;
    loadAtlasState()
      .then((state) => {
        if (active) setAtlasState(state);
      })
      .catch(() => {
        /* Leave atlasState null; join lines stay absent. */
      });
    return () => {
      active = false;
    };
  }, []);

  const placementForItem = (item: CollectionItem): CardPlacement | null => {
    if (!atlasState || item.kind !== 'card') return null;
    const cardNumber = cardNumberFromItem(item);
    if (cardNumber === null) return null;
    return findPlacementForCard(atlasState, cardNumber);
  };

  if (isLoading) {
    return <p className="font-reading text-ink-soft">Loading…</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex gap-3">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === 'Enter' && newName.trim()) {
              try { await createCollection(newName.trim()); setNewName(''); setMutationError(null); }
              catch (err) { setMutationError(err instanceof Error ? err.message : 'Could not create that collection. Try again.'); }
            }
          }}
          placeholder="New collection name"
          className="field flex-1"
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={async () => {
            if (newName.trim()) {
              try { await createCollection(newName.trim()); setNewName(''); setMutationError(null); }
              catch (err) { setMutationError(err instanceof Error ? err.message : 'Could not create that collection. Try again.'); }
            }
          }}
          disabled={!newName.trim()}
        >
          Create
        </button>
      </div>
      {(error || mutationError) && <p className="font-reading text-danger" role="alert">{mutationError || error} <button type="button" className="btn btn-quiet btn-sm" onClick={() => void reload()}>Retry</button></p>}

      {collections.length === 0 ? (
        <p className="font-reading text-ink-soft">
          You don't have any collections yet. Create one above, then save cards into it from any reading.
        </p>
      ) : (
        <ul className="space-y-6">
          {collections.map((c) => (
            <li key={c.id} className="border border-line rounded p-5">
              <header className="flex items-baseline justify-between mb-4">
                {editingId === c.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && editingName.trim()) {
                        try { await renameCollection(c.id, editingName.trim()); setMutationError(null); setEditingId(null); }
                        catch (err) { setMutationError(err instanceof Error ? err.message : 'Could not rename that collection. Try again.'); }
                      }
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={async () => {
                      if (editingName.trim() && editingName !== c.name) {
                        try { await renameCollection(c.id, editingName.trim()); setMutationError(null); }
                        catch (err) { setMutationError(err instanceof Error ? err.message : 'Could not rename that collection. Try again.'); }
                      }
                      setEditingId(null);
                    }}
                    autoFocus
                    className="font-display text-card-title text-ink bg-transparent border-b border-line-strong outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(c.id);
                      setEditingName(c.name);
                    }}
                    className="font-display text-card-title text-ink text-left hover:text-accent"
                  >
                    {c.name}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-quiet btn-sm"
                  onClick={async () => {
                    if (window.confirm(`Delete the collection "${c.name}"?`)) {
                      try { await deleteCollection(c.id); setMutationError(null); }
                      catch (err) { setMutationError(err instanceof Error ? err.message : 'Could not delete that collection. Try again.'); }
                    }
                  }}
                >
                  Delete
                </button>
              </header>
              {c.items.length === 0 ? (
                <p className="font-reading text-caption text-ink-muted">No items yet.</p>
              ) : (
                <>
                  {(() => {
                    const liveCount = c.items.filter((item) => atlasHrefFor(placementForItem(item))).length;
                    if (liveCount === 0) return null;
                    return (
                      <p className="font-label text-label uppercase tracking-[0.18em] text-ink-faint mb-3">
                        {liveCount} of {c.items.length} of these live on the map
                      </p>
                    );
                  })()}
                  <ul className="grid sm:grid-cols-2 gap-2">
                    {c.items.map((item) => {
                      const placement = placementForItem(item);
                      const line = placementLine(placement);
                      const atlasHref = atlasHrefFor(placement);
                      return (
                        <li
                          key={`${item.kind}_${item.ref}`}
                          className="flex items-start justify-between gap-3 text-caption"
                        >
                          <div className="min-w-0">
                            <Link
                              to={itemLink(item)}
                              className="font-reading text-wood-800 hover:text-accent truncate block"
                            >
                              {itemLabel(item)}
                            </Link>
                            {line && (
                              <p className="font-reading text-label text-ink-faint truncate">
                                {line}
                                {atlasHref && (
                                  <>
                                    {' · '}
                                    <Link
                                      to={atlasHref}
                                      className="font-label text-label uppercase tracking-[0.14em] text-accent hover:text-link"
                                    >
                                      On the Atlas
                                    </Link>
                                  </>
                                )}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            className="font-label text-label uppercase tracking-[0.16em] text-ink-faint hover:text-ink flex-shrink-0"
                            onClick={async () => { try { await removeItem(c.id, item); setMutationError(null); } catch (err) { setMutationError(err instanceof Error ? err.message : 'Could not remove this item. Try again.'); } }}
                          >
                            Remove
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const CollectionsManager: React.FC = () => (
  <AccountLayout title="Your collections">
    <CollectionsManagerInner />
  </AccountLayout>
);

export default CollectionsManager;
