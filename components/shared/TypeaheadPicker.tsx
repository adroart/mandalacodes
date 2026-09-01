import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

/**
 * Shared blur-to-close typeahead combobox, extracted from three hand-rolled
 * copies (todo/plans/repair/phase-2-field-features.md, item H):
 *
 *   - AdminAtlas.tsx `CityAutocomplete` (admin theme, searches CITIES)
 *   - AdminPieceContent.tsx `PiecePicker` (admin theme, searches FULL_ARCHIVE)
 *   - atlas/StewardEdit.tsx "Where it rests" picker (book theme, searches
 *     ATLAS_PLACES; carried the best accessibility of the three: combobox
 *     ARIA and click-outside handling)
 *
 * This component levels every call site UP to the StewardEdit copy's
 * accessibility (combobox/listbox/option roles, click-outside close, Escape
 * closes, arrow keys move a highlight) while preserving each site's own
 * matching, rendering, and post-pick behavior exactly:
 *
 *   - AdminAtlas clears the caller's selection (`onQueryChange`) while
 *     typing, so a mid-edit query is not mistaken for a pick.
 *   - StewardEdit resets its query to '' immediately after a pick (the
 *     picker's *placeholder*, driven by the caller's now-updated `value`,
 *     is what shows the result) and its caller saves immediately on pick.
 *   - PiecePicker (and AdminAtlas) leave the picked item's label sitting in
 *     the box after a pick.
 *
 * City/piece specific matching and label formatting stay at the call sites
 * as `filter` / `renderItem` / `itemLabel`.
 */

export interface TypeaheadPickerProps<T> {
  /** The full, unfiltered candidate list. */
  items: T[];
  /** Predicate run against the current query (already trimmed, not lowercased). */
  filter: (item: T, query: string) => boolean;
  /** Inner content of one option row (the picker owns the row's element, ARIA, and click handling). */
  renderItem: (item: T, meta: { selected: boolean }) => React.ReactNode;
  /** Stable identity for an item; also compared against `value` for the "selected" row highlight. */
  itemKey: (item: T) => string;
  /** Text written into the input after a pick (ignored when `clearQueryOnPick`). Also seeds the initial query from `value`. */
  itemLabel: (item: T) => string;
  /** Called with the picked item. The picker closes and updates its own query on every pick regardless of what the caller does. */
  onPick: (item: T) => void;
  /** Fired on every keystroke with the raw input text. AdminAtlas/PiecePicker use this to clear their outer selection mid-edit. */
  onQueryChange?: (query: string) => void;
  /** The currently selected item's key, if any. Drives row highlighting, and (unless `seedQueryFromValue` is false) the initial query text. */
  value?: string | null;
  /** If true, the query resets to '' after a pick instead of showing the picked label (StewardEdit: the placeholder shows the result instead). Default false. */
  clearQueryOnPick?: boolean;
  /** If false, the query starts blank even when `value` is set (StewardEdit: the placeholder, not the query, carries the current value). Default true. */
  seedQueryFromValue?: boolean;
  placeholder?: string;
  /** Cap on rendered rows once the query is non-empty and `filter` has run. Default 12. */
  maxResults?: number;
  /** Cap on rendered rows while the query is empty (shows the first N items unfiltered). Defaults to `maxResults`. */
  maxResultsEmpty?: number;
  /** When set, rendered in place of the list on zero matches. When omitted, the list is simply hidden on zero matches (admin sites' original behavior). */
  emptyMessage?: string;
  /** Visual theme. 'admin' = light paper admin forms. 'book' = the steward book's larger touch targets. */
  variant?: 'admin' | 'book';
  /** Base id for the input/listbox pair, for an external <label htmlFor>. Auto-generated when omitted. */
  id?: string;
  /** Extra class names appended to the input, for call-site tweaks without forking the component. */
  className?: string;
  /** Override the list's max-height class (defaults per variant). Kept as an escape hatch so per-site list sizing predates this refactor and doesn't need to change. */
  listMaxHeightClassName?: string;
  disabled?: boolean;
}

const VARIANT_INPUT: Record<'admin' | 'book', string> = {
  admin:
    'w-full border border-wood-300 bg-wood-50 px-4 py-3 font-reading text-sm text-wood-900 placeholder:text-wood-400 focus:outline-none focus:border-bronze-400',
  book:
    'w-full min-h-[44px] border border-wood-300 bg-wood-50 px-4 py-3 font-reading text-base text-wood-900 placeholder:text-wood-400 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 focus:border-bronze-400',
};

const VARIANT_LIST_MAX_HEIGHT: Record<'admin' | 'book', string> = {
  admin: 'max-h-64',
  book: 'max-h-72',
};

// The admin copies never highlighted the currently-picked row in the list
// (only StewardEdit did); keep that visual difference so admin surfaces
// don't pick up a new look as a side effect of this refactor. A keyboard
// highlight (arrow keys, a new addition for every site) uses a lighter
// touch than the bronze "selected" background.
function rowClassName(variant: 'admin' | 'book', selected: boolean, highlighted: boolean): string {
  const base = 'px-4 py-2 cursor-pointer font-reading text-sm transition-colors';
  if (variant === 'book' && selected) return `${base} bg-bronze-100 text-wood-900`;
  if (highlighted) {
    return variant === 'admin'
      ? `${base} bg-paper-100 text-bronze-700`
      : `${base} bg-paper-100`;
  }
  return variant === 'admin'
    ? `${base} text-wood-700 hover:bg-paper-100 hover:text-bronze-700`
    : `${base} text-wood-700 hover:bg-paper-100`;
}

function TypeaheadPickerInner<T>({
  items,
  filter,
  renderItem,
  itemKey,
  itemLabel,
  onPick,
  onQueryChange,
  value,
  clearQueryOnPick = false,
  seedQueryFromValue = true,
  placeholder,
  maxResults = 12,
  maxResultsEmpty,
  emptyMessage,
  variant = 'admin',
  id,
  className,
  listMaxHeightClassName,
  disabled,
}: TypeaheadPickerProps<T>) {
  const generatedId = useId();
  const baseId = id ?? generatedId;
  const inputId = `${baseId}-input`;
  const listId = `${baseId}-list`;

  const [query, setQuery] = useState<string>(() => {
    if (!value || !seedQueryFromValue) return '';
    const found = items.find((item) => itemKey(item) === value);
    return found ? itemLabel(found) : '';
  });
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const q = query.trim();
    if (!q) return items.slice(0, maxResultsEmpty ?? maxResults);
    return items.filter((item) => filter(item, q)).slice(0, maxResults);
  }, [items, filter, query, maxResults, maxResultsEmpty]);

  // Click-outside close (the StewardEdit mechanism, now shared by every
  // site instead of the admin copies' 150ms blur timeout).
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [query, open]);

  const pick = (item: T) => {
    onPick(item);
    setQuery(clearQueryOnPick ? '' : itemLabel(item));
    setOpen(false);
    setHighlightedIndex(-1);
  };

  return (
    <div className="relative" ref={containerRef}>
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          onQueryChange?.(next);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            setHighlightedIndex(-1);
            return;
          }
          if (!open) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex((i) => (i + 1 >= matches.length ? 0 : i + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex((i) => (i - 1 < 0 ? matches.length - 1 : i - 1));
          } else if (e.key === 'Enter' && highlightedIndex >= 0 && matches[highlightedIndex]) {
            e.preventDefault();
            pick(matches[highlightedIndex]);
          }
        }}
        placeholder={placeholder}
        className={`${VARIANT_INPUT[variant]}${className ? ` ${className}` : ''}`}
      />
      {open && matches.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className={`absolute z-10 left-0 right-0 mt-1 ${listMaxHeightClassName ?? VARIANT_LIST_MAX_HEIGHT[variant]} overflow-y-auto bg-wood-50 border border-wood-300 shadow-sm`}
        >
          {matches.map((item, i) => {
            const key = itemKey(item);
            const selected = value != null && value === key;
            const highlighted = i === highlightedIndex;
            return (
              <li
                key={key}
                role="option"
                aria-selected={selected}
                onMouseDown={(e) => {
                  // Prevent the input from blurring before the pick registers.
                  e.preventDefault();
                  pick(item);
                }}
                onMouseEnter={() => setHighlightedIndex(i)}
                className={rowClassName(variant, selected, highlighted)}
              >
                {renderItem(item, { selected })}
              </li>
            );
          })}
        </ul>
      )}
      {open && matches.length === 0 && emptyMessage && (
        <ul
          role="listbox"
          className="absolute z-10 left-0 right-0 mt-1 bg-wood-50 border border-wood-300 shadow-sm"
        >
          <li className="px-4 py-2 font-reading tracking-[0.015em] text-sm text-stone-600">{emptyMessage}</li>
        </ul>
      )}
    </div>
  );
}

// Cast through unknown so callers keep full generic inference; React.FC
// can't express a generic component signature directly.
const TypeaheadPicker = TypeaheadPickerInner as <T>(
  props: TypeaheadPickerProps<T>,
) => React.ReactElement;

export default TypeaheadPicker;
