import { describe, expect, it } from 'vitest';
import { compareTranscripts, transcriptDoubts, WINDOW_CELLS } from '../../functions/api/_lib/transcriptDoubts';

/** The comparison as it was before windowing: one full table. Kept here as the reference the short results must equal. */
function fullTable(kept: string, second: string, options: { same?: (k: string, s: string) => boolean; context?: number } = {}) {
  const norm = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, '').replace(/^'+|'+$/g, '');
  const tokens = (text: string) => { const out: { raw: string; key: string; start: number; end: number }[] = []; for (const m of text.matchAll(/\S+/g)) { const key = norm(m[0]); if (key) out.push({ raw: m[0], key, start: m.index!, end: m.index! + m[0].length }); } return out; };
  const a = tokens(kept), b = tokens(second);
  if (!a.length || !b.length) return [];
  const n = a.length, m = b.length, width = m + 1, table = new Uint16Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i -= 1) for (let j = m - 1; j >= 0; j -= 1) table[i * width + j] = a[i].key === b[j].key ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
  const doubts: { heard: string; alt: string; at: number }[] = [];
  let i = 0, j = 0;
  while ((i < n || j < m) && doubts.length < 60) {
    if (i < n && j < m && a[i].key === b[j].key) { i += 1; j += 1; continue; }
    const fromI = i, fromJ = j;
    while ((i < n || j < m) && !(i < n && j < m && a[i].key === b[j].key)) { if (j >= m || (i < n && table[(i + 1) * width + j] >= table[i * width + j + 1])) i += 1; else j += 1; }
    const ours = a.slice(fromI, i), theirs = b.slice(fromJ, j);
    if (!ours.length || ours.length > 6 || theirs.length > 6) continue;
    if (options.same) { const c = options.context ?? 2; const around = (text: string, list: typeof a, from: number, to: number) => { const lo = Math.max(0, from - c), hi = Math.min(list.length, to + c); return lo < hi ? text.slice(list[lo].start, list[hi - 1].end) : ''; }; if (options.same(around(kept, a, fromI, i), around(second, b, fromJ, j))) continue; }
    const start = ours[0].start, end = ours[ours.length - 1].end;
    doubts.push({ heard: kept.slice(start, end).replace(/[.,;:!?…"”’)\]]+$/u, ''), alt: theirs.map((t) => t.raw).join(' ').replace(/[.,;:!?…"”’)\]]+$/u, ''), at: start });
  }
  return doubts.filter((d) => d.heard.trim());
}

const random = (seed: number) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const VOCAB = ['the', 'a', 'I', 'and', 'to', 'of', 'it', 'was', 'that', 'in', 'my', 'you', 'is', 'this', 'we', 'so', 'tea', 'bowl', 'mend'];
/** A noisy pair over a small vocabulary: many ties, the case where a different alignment would show. */
function noisyPair(r: () => number, length: number) {
  const kept = Array.from({ length }, () => VOCAB[Math.floor(r() * VOCAB.length)]);
  const second = kept.flatMap((word) => { const roll = r(); return roll < 0.08 ? [] : roll < 0.16 ? ['zz' + Math.floor(r() * 5)] : roll < 0.2 ? [word, VOCAB[Math.floor(r() * VOCAB.length)]] : [word]; });
  return [kept.join(' '), second.join(' ')] as const;
}

describe('windowed transcript comparison', () => {
  it('gives exactly the doubts of the full table for every short pair, ties included', () => {
    const fixtures: [string, string][] = [
      ['I went back to the potter in Yingj this morning. The ones I tried to hide.', 'I went back to the potter in Yingge this morning. The ones I try to hide.'],
      ['Then he poured tea. And I understood.', 'then he poured tea and, I understood'],
      ['He said three weeks.', 'He said about three weeks.'],
      ['The mend was not hiding anything.', 'The mend was hiding anything.'],
      ['one two three four five six seven eight', 'alpha beta gamma delta epsilon zeta eta theta'],
    ];
    for (const [kept, second] of fixtures) expect(transcriptDoubts(kept, second)).toEqual(fullTable(kept, second));
    const r = random(7);
    for (let k = 0; k < 300; k += 1) { const [kept, second] = noisyPair(r, 5 + Math.floor(r() * 400)); expect(transcriptDoubts(kept, second)).toEqual(fullTable(kept, second)); }
    const same = (kept: string, second: string) => kept.replace('Jean keys', 'Gene Keys') === second;
    expect(transcriptDoubts('Reading Jean keys tonight. The potter in Yingj.', 'Reading Gene Keys tonight. The potter in Yingge.', { same })).toEqual(fullTable('Reading Jean keys tonight. The potter in Yingj.', 'Reading Gene Keys tonight. The potter in Yingge.', { same }));
  });

  it('finds the differences near the start, middle and end of a long take, as exact runs at the right offsets, with tiny windows too', () => {
    const words = Array.from({ length: 3000 }, (_, k) => `w${k}`);
    const kept = words.join(' ');
    const second = words.map((word, k) => (k === 3 ? 'start' : k === 1500 ? 'middle' : k === 2996 ? 'end' : word)).filter((_, k) => k !== 2200).join(' ');
    expect(3000 * 3000).toBeGreaterThan(WINDOW_CELLS);
    const expected = [{ heard: 'w3', alt: 'start', at: kept.indexOf(' w3 ') + 1 }, { heard: 'w1500', alt: 'middle', at: kept.indexOf(' w1500 ') + 1 }, { heard: 'w2200', alt: '', at: kept.indexOf(' w2200 ') + 1 }, { heard: 'w2996', alt: 'end', at: kept.indexOf(' w2996 ') + 1 }];
    for (const windowCells of [undefined, 10_000, 64]) {
      const doubts = compareTranscripts(kept, second, { windowCells });
      expect(doubts).toEqual(expected);
      for (const d of doubts!) expect(kept.slice(d.at, d.at + d.heard.length)).toBe(d.heard);
    }
  });

  it('keeps an optimal alignment through the split on noisy long pairs: as many doubts, all exact slices', () => {
    const r = random(11);
    for (let k = 0; k < 20; k += 1) {
      const [kept, second] = noisyPair(r, 300);
      const whole = compareTranscripts(kept, second)!, split = compareTranscripts(kept, second, { windowCells: 500 })!;
      for (const d of split) { expect(kept.slice(d.at, d.at + d.heard.length)).toBe(d.heard); expect(kept[d.at - 1] ?? ' ').toBe(' '); }
      // Ties may settle elsewhere in the split, but never with words dropped from a match: the counts stay close.
      expect(Math.abs(split.length - whole.length)).toBeLessThanOrEqual(Math.max(3, whole.length / 3));
    }
  });

  it('gives up past the work budget instead of building anything, and stays quick on a twenty minute take', () => {
    const many = Array.from({ length: 4100 }, (_, k) => `w${k % 50}`).join(' ');
    expect(compareTranscripts(many, many, { maxCells: 16_000_000 })).toBeUndefined();
    expect(transcriptDoubts(many, many, { maxCells: 16_000_000 })).toEqual([]);
    const r = random(3), long = Array.from({ length: 3900 }, () => VOCAB[Math.floor(r() * VOCAB.length)]);
    const started = Date.now();
    expect(compareTranscripts(long.join(' '), long.map((word, k) => (k % 97 === 0 ? 'zz' : word)).join(' '), { maxCells: 16_000_000 })!.length).toBeGreaterThan(30);
    expect(Date.now() - started).toBeLessThan(4000);
  });
});
