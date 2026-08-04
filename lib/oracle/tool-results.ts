import type { CanonicalCard } from './types';

/** Runtime-neutral result builder shared by hosted HTTP and local stdio MCP. */
export function getLineResult(card: CanonicalCard, requestedLine: number) {
  const line = card.iching.lines.find(candidate => candidate.line === requestedLine);
  return line
    ? { code: card.number, card_name: card.card_name, ...line }
    : { code: card.number, line: requestedLine, note: 'This line is not yet authored for this code.' };
}
