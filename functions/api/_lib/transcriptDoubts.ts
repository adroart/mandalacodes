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
const norm = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, '').replace(/^'+|'+$/g, '');

/** Words with their character positions; a token is any run of non-space characters. */
function tokens(text: string) {
  const out: { raw: string; key: string; start: number; end: number }[] = [];
  for (const match of text.matchAll(/\S+/g)) {
    const key = norm(match[0]);
    if (key) out.push({ raw: match[0], key, start: match.index!, end: match.index! + match[0].length });
  }
  return out;
}

export function transcriptDoubts(kept: string, second: string): TranscriptDoubt[] {
  const a = tokens(kept), b = tokens(second);
  if (!a.length || !b.length) return [];
  // Longest common subsequence over normalised words (two rows at a time would lose the path; a 3,000-word memo is
  // ~9M cells, fine on the VPS where this runs).
  const n = a.length, m = b.length, width = m + 1;
  const table = new Uint16Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i -= 1) for (let j = m - 1; j >= 0; j -= 1) {
    table[i * width + j] = a[i].key === b[j].key ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
  }
  const doubts: TranscriptDoubt[] = [];
  let i = 0, j = 0;
  while ((i < n || j < m) && doubts.length < MAX_DOUBTS) {
    if (i < n && j < m && a[i].key === b[j].key) { i += 1; j += 1; continue; }
    const fromI = i, fromJ = j;
    while ((i < n || j < m) && !(i < n && j < m && a[i].key === b[j].key)) {
      if (j >= m || (i < n && table[(i + 1) * width + j] >= table[i * width + j + 1])) i += 1; else j += 1;
    }
    const ours = a.slice(fromI, i), theirs = b.slice(fromJ, j);
    // Only a run of the kept words can be shown and confirmed; a word the first missed altogether has nothing to point at.
    if (!ours.length || ours.length > MAX_RUN || theirs.length > MAX_RUN) continue;
    const start = ours[0].start, end = ours[ours.length - 1].end;
    doubts.push({ heard: kept.slice(start, end).replace(/[.,;:!?…"”’)\]]+$/u, ''), alt: theirs.map((t) => t.raw).join(' ').replace(/[.,;:!?…"”’)\]]+$/u, ''), at: start });
  }
  return doubts.filter((d) => d.heard.trim());
}
