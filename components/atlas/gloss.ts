/**
 * Once-per-visitor gloss system (interface law 5: words are lit once).
 *
 * Each invented term the Atlas uses is glossed in place with one quiet line
 * the first time a visitor meets it, then never again. The seen set persists
 * in localStorage under a single versioned key, so a returning visitor is
 * never re-taught. Bump the key version to re-teach everyone (e.g. after the
 * vocabulary itself changes).
 *
 * There are no hover tooltips: the gloss is an inline line that appears when
 * the term is first exercised and fades on its own after a few seconds, so it
 * works identically on touch and pointer.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'atlas-gloss-v1';

export type GlossTerm = 'dreams' | 'threads' | 'ember';

/** The ratified one-line gloss for each term. */
export const GLOSS_TEXT: Record<GlossTerm, string> = {
  dreams: 'one gesture carries you from dream to dream',
  threads: 'threads join pieces that share a code',
  ember: 'made, not yet claimed; it waits as an ember',
};

/** How long a gloss line lingers before fading, ms. */
export const GLOSS_LINGER_MS = 6000;

function readSeen(): Record<string, true> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, true>) : {};
  } catch {
    return {};
  }
}

/** Whether this visitor has already met a term. */
export function glossSeen(term: GlossTerm): boolean {
  return readSeen()[term] === true;
}

/** Record that this visitor has now met a term (idempotent, quiet on failure). */
export function markGlossSeen(term: GlossTerm): void {
  if (typeof window === 'undefined') return;
  try {
    const seen = readSeen();
    if (seen[term]) return;
    seen[term] = true;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
  } catch {
    /* private mode / storage disabled: the gloss simply shows again next time */
  }
}

/**
 * Controller for showing a gloss line at most once per visitor. `fire(term)`
 * shows the line only if the term is unseen, marks it seen, and clears it
 * after GLOSS_LINGER_MS. `active` is the term currently on screen (or null).
 */
export function useGloss(): {
  active: GlossTerm | null;
  fire: (term: GlossTerm) => void;
} {
  const [active, setActive] = useState<GlossTerm | null>(null);
  const timer = useRef<number | null>(null);

  const fire = useCallback((term: GlossTerm) => {
    if (glossSeen(term)) return;
    markGlossSeen(term);
    setActive(term);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setActive(null), GLOSS_LINGER_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  return { active, fire };
}
