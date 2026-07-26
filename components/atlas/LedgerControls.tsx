import React from 'react';

/* ─── The record's controls, one line ─────────────────────────────────────
 * The shared instruments the wall and the ledger both reach for. They were
 * copy-pasted between the two views and drifted; they live here once now.
 *
 * The rule that shapes them: three different acts get three different shapes,
 * so the interface says what it does before you touch it.
 *
 *   FIND    one open field, always leftmost, always the widest thing
 *   NARROW  a labelled menu per axis, showing its current value as its face
 *   ARRANGE the same menu shape, held to the right, away from the narrowing
 *
 * and beneath them one quiet line: how many rows this is, where the sections
 * are, and the way back out.
 *
 * No panel, no box, no fill. A single hairline under the row is enough to say
 * "these belong together" without making the chrome louder than the record.
 */

/* ─── Find ────────────────────────────────────────────────────────────────── */

export function LedgerSearchField({
  value,
  onChange,
  ariaLabel,
  placeholder = 'search titles, cities, dreams',
}: {
  value: string;
  onChange: (v: string) => void;
  ariaLabel: string;
  placeholder?: string;
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      // Its own full-width line on a phone (basis-full), then the leading
      // control on the one desktop line. Sharing a row at 390px squeezed it
      // to a stub.
      className="min-w-0 basis-full sm:basis-auto sm:flex-1 sm:max-w-xs h-11 bg-transparent border-b border-wood-300 font-reading text-base text-wood-900 placeholder:text-wood-500 focus:outline-none focus:border-bronze-600 transition-colors"
    />
  );
}

/* ─── Narrow and arrange ──────────────────────────────────────────────────
   A native select: one tap on a phone, keyboard and screen-reader correct for
   free, and it wears its current value on its face, which a row of chips never
   does. The visible label sits inline so the control reads as a sentence
   ("state: dreams anchored") rather than as a form field. */

export function LedgerSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  emphasis = false,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; count?: number }>;
  onChange: (v: T) => void;
  /** True when this control is holding a non-default value, so it reads as
   *  active at a glance without needing a separate badge. */
  emphasis?: boolean;
}) {
  const id = `ledger-select-${label.replace(/\s+/g, '-')}`;
  return (
    <span className="inline-flex items-center gap-2 h-11 shrink-0">
      <label
        htmlFor={id}
        className="font-label text-[11px] uppercase tracking-[0.16em] text-wood-500"
      >
        {label}
      </label>
      <span className="relative inline-flex items-center">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
          /* h-11 on the SELECT, not on a wrapper: the wrapper is not what you
             tap. Same height as the search field, so the two underlines line
             up and every control clears the 44px minimum. */
          className={`appearance-none h-11 bg-transparent border-b pr-5 font-reading text-[15px] cursor-pointer focus:outline-none focus:border-bronze-600 transition-colors ${
            emphasis
              ? 'text-bronze-700 border-bronze-600'
              : 'text-wood-700 border-wood-300 hover:text-bronze-700'
          }`}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="text-wood-900">
              {typeof o.count === 'number' ? `${o.label} (${o.count})` : o.label}
            </option>
          ))}
        </select>
        <span
          aria-hidden
          className={`pointer-events-none absolute right-0 text-[10px] ${
            emphasis ? 'text-bronze-600' : 'text-wood-400'
          }`}
        >
          ▾
        </span>
      </span>
    </span>
  );
}

/* ─── The line beneath ────────────────────────────────────────────────────── */

/** The row the controls sit on: one hairline, wrapping, nothing else. */
export function LedgerControlRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-7 gap-y-1 border-b border-wood-300/70 pb-1">
      {children}
    </div>
  );
}

/** How many rows this is, plus the way out. Announced, because the count is
 *  the answer to most of what anyone asks a ledger. */
export function LedgerTally({
  children,
  onClear,
}: {
  children: React.ReactNode;
  /** Present only while something is actually narrowed. */
  onClear?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-4">
      <span
        aria-live="polite"
        className="font-label text-[11px] uppercase tracking-[0.16em] text-wood-600"
      >
        {children}
      </span>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="font-label text-[11px] uppercase tracking-[0.16em] text-bronze-700 hover:text-bronze-600 underline underline-offset-4 decoration-bronze-600/40 transition-colors"
        >
          clear
        </button>
      )}
    </span>
  );
}

/** The jump rail: every section the current grouping produced, with its count,
 *  as an anchor. This is what kind-as-a-filter used to be, doing the thing a
 *  filter could not: it moves you without hiding the rest of the record. */
export function LedgerJumpRail({
  sections,
  onJump,
}: {
  sections: ReadonlyArray<{ id: string; label: string; count?: number }>;
  onJump: (id: string) => void;
}) {
  if (sections.length < 2) return null;
  return (
    <nav
      aria-label="Jump to a section of the ledger"
      className="flex flex-wrap items-center gap-x-5 gap-y-1"
    >
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onJump(s.id)}
          className="font-label text-[11px] lowercase tracking-[0.06em] text-wood-600 hover:text-bronze-700 transition-colors"
        >
          {s.label}
          {typeof s.count === 'number' && (
            <span className="ml-1.5 tabular-nums text-wood-400">{s.count}</span>
          )}
        </button>
      ))}
    </nav>
  );
}
