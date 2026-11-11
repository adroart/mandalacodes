/**
 * Where two transcriptions of the same recording disagree. Each doubt is an exact run of words from the first
 * (the one that is kept), with what the second heard instead: the likely mishearings to put in front of the speaker.
 * Nothing is changed; the speaker decides. Case and punctuation differences are not doubts.
 */
export interface TranscriptDoubt {
  /** The words as the kept transcript has them, exactly as they appear in its text. */
  heard: string;
  /** What the second transcription heard there ('' when it heard nothing). */
  alt: string;
  /** Character offset of `heard` in the kept text. */
  at: number;
}

const MAX_RUN = 6;
const MAX_DOUBTS = 60;
/**
 * The largest words-by-words table built at once (2 bytes a cell, so 4 MB). A comparison within it is aligned exactly
 * as it always was; a larger one is first split, in linear space, at a point an optimal alignment passes through
 * (Hirschberg), until every piece fits. Memory then follows the window, not the product of the two transcripts.
 */
export const WINDOW_CELLS = 2_000_000;
const norm = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, '').replace(/^'+|'+$/g, '');

type Token = { raw: string; key: string; start: number; end: number };
/** Words with their character positions; a token is any run of non-space characters. */
function tokens(text: string) {
  const out: Token[] = [];
  for (const match of text.matchAll(/\S+/g)) {
    const key = norm(match[0]);
    if (key) out.push({ raw: match[0], key, start: match.index!, end: match.index! + match[0].length });
  }
  return out;
}

export interface DoubtOptions {
  /**
   * Whether two differing runs mean the same once the caller's own corrections are applied (such as the shared word
   * library's known fixes, which can span several words). Each side is an exact slice of its text, widened by
   * `context` words on either side. Returning true drops the doubt.
   */
  same?: (kept: string, second: string) => boolean;
  /** Neighbouring words given to `same` on each side (default 2). */
  context?: number;
  /** Work budget in table cells (kept words times second words); over it compareTranscripts gives up. Default unbounded. */
  maxCells?: number;
  /** Table size per window (default WINDOW_CELLS); a test may lower it to exercise the split. */
  windowCells?: number;
}

/** Matched word pairs (kept index, second index), in order, along one optimal alignment of the two key lists. */
function align(a: Int32Array, b: Int32Array, windowCells: number) {
  const matchA: number[] = [], matchB: number[] = [];
  const forward = new Int32Array(b.length + 1), backward = new Int32Array(b.length + 1);
  /** The exact table walk this module always used: a diagonal on every equal pair, otherwise the larger neighbour, the kept side first on a tie. */
  const table = (i0: number, i1: number, j0: number, j1: number) => {
    const n = i1 - i0, m = j1 - j0, width = m + 1, cells = new Uint16Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i -= 1) for (let j = m - 1; j >= 0; j -= 1) {
      cells[i * width + j] = a[i0 + i] === b[j0 + j] ? cells[(i + 1) * width + j + 1] + 1 : Math.max(cells[(i + 1) * width + j], cells[i * width + j + 1]);
    }
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (a[i0 + i] === b[j0 + j]) { matchA.push(i0 + i); matchB.push(j0 + j); i += 1; j += 1; } else if (cells[(i + 1) * width + j] >= cells[i * width + j + 1]) i += 1; else j += 1;
    }
  };
  /** row[k] = LCS length of a[i0..i1) with b[j0..j0+k) (forward) or with b[j0+k..j1) (backward), in one row. */
  const lengths = (row: Int32Array, i0: number, i1: number, j0: number, j1: number, reverse: boolean) => {
    const m = j1 - j0;row.fill(0, 0, m + 1);
    for (let s = 0; s < i1 - i0; s += 1) {
      const key = a[reverse ? i1 - 1 - s : i0 + s];let diagonal = 0;
      for (let t = 1; t <= m; t += 1) {
        const k = reverse ? m - t : t, beside = reverse ? k + 1 : k - 1, above = row[k];
        row[k] = key === b[reverse ? j0 + k : j0 + k - 1] ? diagonal + 1 : Math.max(above, row[beside]);diagonal = above;
      }
    }
  };
  const split = (i0: number, i1: number, j0: number, j1: number): void => {
    if (i0 >= i1 || j0 >= j1) return;
    if ((i1 - i0 + 1) * (j1 - j0 + 1) <= windowCells) return table(i0, i1, j0, j1);
    if (i1 - i0 === 1) { for (let j = j0; j < j1; j += 1) if (a[i0] === b[j]) { matchA.push(i0); matchB.push(j); return; } return; }
    const mid = (i0 + i1) >> 1, m = j1 - j0;
    lengths(forward, i0, mid, j0, j1, false);lengths(backward, mid, i1, j0, j1, true);
    let best = 0, cut = 0;for (let k = 0; k <= m; k += 1) if (forward[k] + backward[k] > best) { best = forward[k] + backward[k]; cut = k; }
    split(i0, mid, j0, j0 + cut);split(mid, i1, j0 + cut, j1);
  };
  split(0, a.length, 0, b.length);
  return { matchA, matchB };
}

/** The doubts, or undefined when the comparison would exceed `maxCells`: the caller then says doubts are unavailable. */
export function compareTranscripts(kept: string, second: string, options: DoubtOptions = {}): TranscriptDoubt[] | undefined {
  const a = tokens(kept), b = tokens(second);
  if (!a.length || !b.length) return [];
  const n = a.length, m = b.length;
  if (n * m > (options.maxCells ?? Infinity)) return undefined;
  const ids = new Map<string, number>(), id = (token: Token) => { let value = ids.get(token.key); if (value === undefined) ids.set(token.key, value = ids.size); return value; };
  const { matchA, matchB } = align(Int32Array.from(a, id), Int32Array.from(b, id), Math.max(16, options.windowCells ?? WINDOW_CELLS));
  const doubts: TranscriptDoubt[] = [];
  let i = 0, j = 0, next = 0;
  while ((i < n || j < m) && doubts.length < MAX_DOUBTS) {
    if (next < matchA.length && matchA[next] === i && matchB[next] === j) { i += 1; j += 1; next += 1; continue; }
    const fromI = i, fromJ = j;
    i = next < matchA.length ? matchA[next] : n;j = next < matchB.length ? matchB[next] : m;
    const ours = a.slice(fromI, i), theirs = b.slice(fromJ, j);
    // Only a run of the kept words can be shown and confirmed; a word the first missed altogether has nothing to point at.
    if (!ours.length || ours.length > MAX_RUN || theirs.length > MAX_RUN) continue;
    if (options.same) {
      const context = options.context ?? 2;
      const around = (text: string, list: Token[], from: number, to: number) => { const lo = Math.max(0, from - context), hi = Math.min(list.length, to + context); return lo < hi ? text.slice(list[lo].start, list[hi - 1].end) : ''; };
      if (options.same(around(kept, a, fromI, i), around(second, b, fromJ, j))) continue;
    }
    const start = ours[0].start, end = ours[ours.length - 1].end;
    doubts.push({ heard: kept.slice(start, end).replace(/[.,;:!?…"”’)\]]+$/u, ''), alt: theirs.map((t) => t.raw).join(' ').replace(/[.,;:!?…"”’)\]]+$/u, ''), at: start });
  }
  return doubts.filter((d) => d.heard.trim());
}

export function transcriptDoubts(kept: string, second: string, options: DoubtOptions = {}): TranscriptDoubt[] {
  return compareTranscripts(kept, second, options) ?? [];
}
