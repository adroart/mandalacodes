import { sourceSnapshot } from './workflow';
import type { SourceSection } from './types';
/** Exact character ranges, including CRLF support. Headings and surrounding whitespace stay intact. */
export function manuscriptSource(cardNumber: number, revision: string, markdown: string) {
  const headings = [...markdown.matchAll(/^## (CODE|ICHING|KEYS|DESIGN|BODY|RELATIONS)\s*\r?$/gm)];
  if (headings.length !== 6 || new Set(headings.map(m => m[1])).size !== 6) throw new Error('Expected the six canonical Oracle lenses');
  const sections: SourceSection[] = headings.map((m, index) => {
    const afterHeading = m.index! + m[0].length;
    const limit = headings[index + 1]?.index ?? markdown.length;
    const body = markdown.slice(afterHeading, limit);
    const leading = body.match(/^\s*/)?.[0].length ?? 0;
    const trailing = body.match(/\s*$/)?.[0].length ?? 0;
    return { id: m[1], title: ({ CODE: 'Code', ICHING: 'I Ching', KEYS: 'Gene Keys', DESIGN: 'Human Design', BODY: 'Body', RELATIONS: 'Relations' })[m[1]]!, start: afterHeading + leading, end: limit - trailing };
  });
  return sourceSnapshot(cardNumber, revision, markdown, sections);
}
