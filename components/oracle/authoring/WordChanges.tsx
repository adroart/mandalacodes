import React from 'react';
import './WordChanges.css';

export interface WordChange { kind: 'same' | 'added' | 'removed'; text: string }
const tokenize = (text: string) => text.match(/\s+|[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*|[^\s]/gu) ?? [];
// The comparison is exact text evidence, not a semantic interpretation. Bound the
// middle LCS so a whole-card paste cannot allocate an unbounded matrix.
const MAX_CELLS = 160_000;
export function diffWords(original: string, revised: string): WordChange[] {
  const before = tokenize(original), after = tokenize(revised);
  const result: WordChange[] = [];
  const add = (kind: WordChange['kind'], text: string) => {
    if (!text) return;
    const last = result[result.length - 1];
    if (last?.kind === kind) last.text += text;
    else result.push({ kind, text });
  };
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
  let beforeEnd = before.length, afterEnd = after.length;
  while (beforeEnd > prefix && afterEnd > prefix && before[beforeEnd - 1] === after[afterEnd - 1]) { beforeEnd--; afterEnd--; }
  add('same', before.slice(0, prefix).join(''));
  const left = before.slice(prefix, beforeEnd), right = after.slice(prefix, afterEnd);
  if (!left.length) add('added', right.join(''));
  else if (!right.length) add('removed', left.join(''));
  else if ((left.length + 1) * (right.length + 1) > MAX_CELLS) {
    // Large replacements remain truthful; no words are called unchanged merely
    // because the fine-grained comparison exceeded the memory budget.
    add('removed', left.join('')); add('added', right.join(''));
  } else {
    const width = right.length + 1;
    const lengths = new Uint16Array((left.length + 1) * width);
    for (let i = left.length - 1; i >= 0; i--) for (let j = right.length - 1; j >= 0; j--) {
      lengths[i * width + j] = left[i] === right[j]
        ? 1 + lengths[(i + 1) * width + j + 1]
        : Math.max(lengths[(i + 1) * width + j], lengths[i * width + j + 1]);
    }
    let i = 0, j = 0;
    while (i < left.length && j < right.length) {
      if (left[i] === right[j]) { add('same', left[i++]); j++; }
      else if (lengths[(i + 1) * width + j] >= lengths[i * width + j + 1]) add('removed', left[i++]);
      else add('added', right[j++]);
    }
    add('removed', left.slice(i).join('')); add('added', right.slice(j).join(''));
  }
  add('same', before.slice(beforeEnd).join(''));
  return result;
}

export default function WordChanges({ original, revised }: { original: string; revised: string }) {
  const changes = diffWords(original, revised);
  const changed = changes.some(part => part.kind !== 'same');
  return <div className="word-changes" role="region" aria-label="Changes to this passage">
    <p className="word-changes__legend">{changed ? <><span><del>Removed</del> words</span><span><ins>Added</ins> words</span></> : 'The wording is unchanged.'}</p>
    <div className="word-changes__text">{changes.map((part, index) => part.kind === 'removed'
      ? <del key={index} aria-label={`Removed: ${part.text}`} title="Removed words">{part.text}</del>
      : part.kind === 'added'
        ? <ins key={index} aria-label={`Added: ${part.text}`} title="Added words">{part.text}</ins>
        : <span key={index}>{part.text}</span>)}</div>
  </div>;
}
