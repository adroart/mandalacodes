import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useAccount } from '../account/useAccount';

export type CollectionItemKind = 'card' | 'artwork' | 'product';

export interface CollectionItem {
  kind: CollectionItemKind;
  ref: string;
}

export interface Collection {
  id: number;
  name: string;
  createdAt: string;
  items: CollectionItem[];
}

/** Keep a previous account's records out of the synchronous render that
 * follows an account switch, before React has had a chance to run effects. */
export function collectionsForActiveUser(
  collections: Collection[],
  ownerId: string | null,
  activeUserId: string | null,
): Collection[] {
  return ownerId === activeUserId ? collections : [];
}

interface CollectionsContextValue {
  collections: Collection[];
  isLoading: boolean;
  error: string | null;
  /** True only when accounts are configured. SaveToCollectionButton uses this
   * to short-circuit and trigger the sign-in flow. */
  available: boolean;
  reload: () => Promise<void>;
  createCollection: (name: string) => Promise<Collection | null>;
  renameCollection: (id: number, name: string) => Promise<void>;
  deleteCollection: (id: number) => Promise<void>;
  addItem: (collectionId: number, item: CollectionItem) => Promise<void>;
  removeItem: (collectionId: number, item: CollectionItem) => Promise<void>;
}

const stub: CollectionsContextValue = {
  collections: [],
  isLoading: false,
  error: null,
  available: false,
  reload: async () => undefined,
  createCollection: async () => null,
  renameCollection: async () => undefined,
  deleteCollection: async () => undefined,
  addItem: async () => undefined,
  removeItem: async () => undefined,
};

const CollectionsContext = createContext<CollectionsContextValue>(stub);

export const CollectionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const account = useAccount();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedFor = useRef<string | null>(null);
  const activeUserId = useRef<string | null>(null);
  const collectionsOwner = useRef<string | null>(null);
  activeUserId.current = account.isSignedIn ? account.userId : null;
  const visibleCollections = collectionsForActiveUser(
    collections,
    collectionsOwner.current,
    activeUserId.current,
  );

  const reload = useCallback(async () => {
    const userId = account.isSignedIn ? account.userId : null;
    if (!account.available || !userId) {
      collectionsOwner.current = null;
      setCollections([]);
      setError(null);
      return;
    }
    setLoading(true);
    try {
      const res = await account.fetchAuthed('/api/collections/list');
      if (!res.ok) throw new Error('Could not load your collections. Try again.');
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Could not load your collections. Try again.');
      if (activeUserId.current === userId) {
        collectionsOwner.current = userId;
        setCollections(data);
        setError(null);
      }
    } catch {
      if (activeUserId.current === userId) setError('Could not load your collections. Try again.');
    } finally {
      if (activeUserId.current === userId) setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    if (!account.isLoaded) return;
    const tag = account.isSignedIn ? account.userId : 'guest';
    if (loadedFor.current === tag) return;
    loadedFor.current = tag;
    collectionsOwner.current = null;
    setError(null);
    setCollections([]);
    reload();
  }, [account.isLoaded, account.isSignedIn, account.userId, reload]);

  const createCollection = useCallback(async (name: string) => {
    const userId = account.userId;
    if (!account.available || !account.isSignedIn || !userId) return null;
    const res = await account.fetchAuthed('/api/collections/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Could not create that collection. Try again.');
    const created = (await res.json()) as Collection;
    if (!created || !Number.isFinite(created.id) || typeof created.name !== 'string') {
      throw new Error('Could not create that collection. Try again.');
    }
    if (activeUserId.current !== userId) throw new Error('Your account changed. Try again.');
    setCollections((c) => [...c, created]);
    return created;
  }, [account]);

  const renameCollection = useCallback(async (id: number, name: string) => {
    const userId = account.userId;
    if (!account.available || !account.isSignedIn || !userId) return;
    const res = await account.fetchAuthed('/api/collections/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name }),
    });
    if (!res.ok) throw new Error('Could not rename that collection. Try again.');
    if (activeUserId.current !== userId) throw new Error('Your account changed. Try again.');
    setCollections((c) => c.map((col) => (col.id === id ? { ...col, name } : col)));
  }, [account]);

  const deleteCollection = useCallback(async (id: number) => {
    const userId = account.userId;
    if (!account.available || !account.isSignedIn || !userId) return;
    const res = await account.fetchAuthed('/api/collections/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) throw new Error('Could not delete that collection. Try again.');
    if (activeUserId.current !== userId) throw new Error('Your account changed. Try again.');
    setCollections((c) => c.filter((col) => col.id !== id));
  }, [account]);

  const addItem = useCallback(async (collectionId: number, item: CollectionItem) => {
    const userId = account.userId;
    if (!account.available || !account.isSignedIn || !userId) return;
    const res = await account.fetchAuthed('/api/collections/add-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectionId, ...item }),
    });
    if (!res.ok) throw new Error('Could not save this item. Try again.');
    if (activeUserId.current !== userId) throw new Error('Your account changed. Try again.');
    setCollections((c) =>
      c.map((col) =>
        col.id === collectionId
          ? {
              ...col,
              items: col.items.some((i) => i.kind === item.kind && i.ref === item.ref)
                ? col.items
                : [...col.items, item],
            }
          : col,
      ),
    );
  }, [account]);

  const removeItem = useCallback(async (collectionId: number, item: CollectionItem) => {
    const userId = account.userId;
    if (!account.available || !account.isSignedIn || !userId) return;
    const res = await account.fetchAuthed('/api/collections/remove-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collectionId, ...item }),
    });
    if (!res.ok) throw new Error('Could not remove this item. Try again.');
    if (activeUserId.current !== userId) throw new Error('Your account changed. Try again.');
    setCollections((c) =>
      c.map((col) =>
        col.id === collectionId
          ? { ...col, items: col.items.filter((i) => !(i.kind === item.kind && i.ref === item.ref)) }
          : col,
      ),
    );
  }, [account]);

  const value = useMemo<CollectionsContextValue>(
    () => ({
      collections: visibleCollections,
      isLoading,
      error,
      available: account.available,
      reload,
      createCollection,
      renameCollection,
      deleteCollection,
      addItem,
      removeItem,
    }),
    [
      visibleCollections,
      isLoading,
      error,
      account.available,
      reload,
      createCollection,
      renameCollection,
      deleteCollection,
      addItem,
      removeItem,
    ],
  );

  return <CollectionsContext.Provider value={value}>{children}</CollectionsContext.Provider>;
};

export function useCollections() {
  return useContext(CollectionsContext);
}
