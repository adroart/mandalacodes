/* ─── Reading journal — quiet local history of cards opened ──────────────────
 * Every card a visitor opens is recorded (most-recent-first, deduped, capped).
 * Local-only, no account required. Powers the rail "Recent draws" strip and the
 * Journal overlay in the deck redesign. */

import { useCallback, useEffect, useState } from 'react';

const KEY = 'ul.journal.v1';
const CAP = 40;

export interface JournalEntry {
  n: number; // card number
  name: string;
  t: number; // epoch ms opened
}

function read(): JournalEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(entries: JournalEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // quota / privacy mode — ignore
  }
}

/** Relative-time label for a journal timestamp. */
export function relTime(t: number, now = Date.now()): string {
  const s = Math.floor((now - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  try {
    return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function useJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);

  useEffect(() => {
    setEntries(read());
  }, []);

  const record = useCallback((n: number, name: string) => {
    setEntries((prev) => {
      const without = prev.filter((e) => e.n !== n);
      const next = [{ n, name, t: Date.now() }, ...without].slice(0, CAP);
      write(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    write([]);
    setEntries([]);
  }, []);

  return { entries, record, clear };
}
