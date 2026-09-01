import React, { useState } from 'react';
import { useCollections, type CollectionItem } from '../../lib/collections/context';
import { collectionsHolding } from '../../lib/collections/items';
import { useAccount } from '../../lib/account/useAccount';
import SignInTrigger from './SignInTrigger';

interface Props {
  /**
   * The thing being saved. Build it with a helper from lib/collections/items
   * (cardCollectionItem for a code) so the reference written here is the same
   * one the collections page reads back.
   */
  item: CollectionItem;
  /** Optional label override; defaults to "Save to collection". */
  label?: string;
  /**
   * "chip" is the small bronze pill used on the account surfaces. "panel" is
   * the bordered box the card page's Acquire and Share controls use, drawn
   * from the reading's own palette variables so it holds in Day Book and
   * Nightfall alike.
   */
  variant?: 'chip' | 'panel';
}

/**
 * A small button that lets the visitor save the current artwork / card /
 * product into one of their collections. Hidden when accounts are
 * unavailable. Signed-out visitors see a sign-in prompt before the chooser.
 *
 * Every row in the chooser says what the click will do: an unsaved collection
 * offers its name, one that already holds the item offers to remove it. There
 * is no state badge that cannot be acted on.
 */
const SaveToCollectionButton: React.FC<Props> = ({
  item,
  label = 'Save to collection',
  variant = 'chip',
}) => {
  const account = useAccount();
  const { collections, createCollection, addItem, removeItem } = useCollections();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');

  if (!account.available) return null;

  const rootClass = `stc${variant === 'panel' ? ' stc--panel' : ''}`;

  // Signed out: a single button that opens the sign-in modal. No wall goes up
  // on the page itself; the reading behind it stays open to everyone.
  if (!account.isSignedIn) {
    return (
      <div className={rootClass}>
        <SignInTrigger>
          <button type="button" className="stc__btn">
            <span className="stc__btn-label">{label}</span>
            {variant === 'panel' && (
              <span className="stc__btn-sub">Sign in to keep this code</span>
            )}
          </button>
        </SignInTrigger>
        <style>{stcStyles}</style>
      </div>
    );
  }

  const holding = collectionsHolding(collections, item);
  const sub = holding.length === 0
    ? 'Keep it in a collection'
    : holding.length === 1
      ? `In ${holding[0].name}`
      : `In ${holding.length} of your collections`;

  const handleToggle = async (collectionId: number, alreadyHolds: boolean) => {
    if (alreadyHolds) await removeItem(collectionId, item);
    else await addItem(collectionId, item);
    setOpen(false);
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    const created = await createCollection(name);
    if (created) await addItem(created.id, item);
    setNewName('');
    setOpen(false);
  };

  // Signed in: the collection chooser.
  return (
    <div className={rootClass}>
      <button
        type="button"
        className="stc__btn"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="stc__btn-label">{label}</span>
        {variant === 'panel' && <span className="stc__btn-sub">{sub}</span>}
      </button>
      {open && (
        <div className="stc__menu">
          {collections.length === 0 ? (
            <p className="stc__menu-empty">No collections yet. Create your first one below.</p>
          ) : (
            <ul className="stc__menu-list">
              {collections.map((c) => {
                const alreadyHolds = holding.some((h) => h.id === c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="stc__menu-item"
                      onClick={() => handleToggle(c.id, alreadyHolds)}
                    >
                      {alreadyHolds ? `Remove from ${c.name}` : c.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="stc__create">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
              placeholder="New collection name"
              className="stc__input"
            />
            <button
              type="button"
              className="stc__create-btn"
              onClick={handleCreate}
              disabled={!newName.trim()}
            >
              Save
            </button>
          </div>
        </div>
      )}
      <style>{stcStyles}</style>
    </div>
  );
};

const stcStyles = `
        .stc { position: relative; display: inline-block; }
        .stc__btn {
          font-family: var(--font-ui);
          font-size: 10px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--color-bronze-600);
          background: transparent;
          border: 1px solid color-mix(in oklab, var(--color-bronze-600) 35%, transparent);
          border-radius: 3px;
          padding: 8px 12px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .stc__btn:hover {
          background: color-mix(in oklab, var(--color-bronze-400) 8%, transparent);
        }
        .stc__menu {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          z-index: 15;
          width: 240px;
          background: var(--color-paper-50);
          border: 1px solid color-mix(in oklab, var(--color-wood-600) 22%, transparent);
          border-radius: 3px;
          padding: 8px;
          box-shadow: 0 8px 24px -10px rgba(0,0,0,0.18);
        }
        .stc__menu-empty {
          font-family: var(--font-ui);
          font-size: 13px;
          color: var(--color-wood-600);
          margin: 4px 6px 8px;
        }
        .stc__menu-list { list-style: none; padding: 0; margin: 0 0 8px; }
        .stc__menu-item {
          display: block;
          width: 100%;
          text-align: left;
          font-family: var(--font-ui);
          font-size: 15px;
          color: var(--color-wood-900);
          background: transparent;
          border: 0;
          padding: 6px 8px;
          cursor: pointer;
          border-radius: 2px;
        }
        .stc__menu-item:hover { background: color-mix(in oklab, var(--color-bronze-400) 10%, transparent); }
        .stc__create {
          display: flex;
          gap: 6px;
          padding-top: 8px;
          border-top: 1px solid color-mix(in oklab, var(--color-wood-600) 12%, transparent);
        }
        .stc__input {
          flex: 1;
          font-family: var(--font-ui);
          font-size: 14px;
          padding: 6px 8px;
          border: 1px solid color-mix(in oklab, var(--color-wood-600) 22%, transparent);
          border-radius: 2px;
          background: var(--color-paper-50);
        }
        .stc__create-btn {
          font-family: var(--font-ui);
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--color-paper-50);
          background: var(--color-bronze-600);
          border: 0;
          border-radius: 2px;
          padding: 6px 10px;
          cursor: pointer;
        }
        .stc__create-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── panel variant ──
           The card page's Acquire and Share controls: a full-width hairline box,
           display-face title over a small uppercase line, drawn entirely from
           the reading's palette variables so it follows Day Book and Nightfall
           without a second set of colors. */
        .stc--panel { display: block; }
        .stc--panel .stc__btn {
          display: block;
          width: 100%;
          text-align: left;
          /* The label and sub-line below each declare their own face, so this
             button sets none of its own; the chip variant's sizing and casing
             are cleared here so they cannot cascade into them. */
          font-size: inherit;
          letter-spacing: normal;
          text-transform: none;
          color: inherit;
          background: none;
          border: 1px solid var(--l-rule, rgba(180,150,110,0.22));
          border-radius: 0;
          padding: 14px 18px;
          transition: border-color .25s, background .25s;
        }
        .stc--panel .stc__btn:hover {
          background: none;
          border-color: color-mix(in oklab, var(--accent, #C99A5B) 55%, var(--l-rule, rgba(180,150,110,0.22)));
        }
        .stc--panel .stc__btn-label {
          display: block;
          font-family: var(--font-display);
          font-size: 18px;
          line-height: 1.1;
          color: var(--l-1);
        }
        .stc--panel .stc__btn-sub {
          display: block;
          font-family: var(--font-ui);
          font-size: 10px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--l-3);
          margin-top: 3px;
        }
        .stc--panel .stc__menu {
          left: 0;
          right: auto;
          width: min(280px, 100%);
          z-index: 90;
          background: var(--l-bg);
          border: 1px solid var(--l-rule, rgba(180,150,110,0.22));
          border-radius: 0;
          box-shadow: 0 10px 30px -12px rgba(0,0,0,0.45);
        }
        .stc--panel .stc__menu-empty {
          font-family: var(--font-reading);
          font-size: 14px;
          color: var(--l-2);
        }
        .stc--panel .stc__menu-item {
          font-family: var(--font-reading);
          font-size: 15px;
          color: var(--l-1);
          border-radius: 0;
        }
        .stc--panel .stc__menu-item:hover {
          background: color-mix(in oklab, var(--accent, #C99A5B) 12%, transparent);
        }
        .stc--panel .stc__create {
          border-top: 1px solid var(--l-rule, rgba(180,150,110,0.22));
        }
        .stc--panel .stc__input {
          font-family: var(--font-reading);
          color: var(--l-1);
          background: none;
          border: 1px solid var(--l-rule, rgba(180,150,110,0.22));
          border-radius: 0;
        }
        .stc--panel .stc__create-btn {
          color: var(--l-bg);
          background: var(--accent, #C99A5B);
          border-radius: 0;
        }
`;

export default SaveToCollectionButton;
