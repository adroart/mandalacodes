/**
 * Search over the canonical corpus — a thin adapter over the shared ranker and
 * the shared card→SearchDoc transform (lib/oracle/*). All scoring lives in the
 * shared ranker so Claude, the website, and the hosted Function rank identically.
 */
import type { CanonicalCard } from './corpus.ts';
import { rank, type RankHit } from '../../../lib/oracle/ranker.ts';
import { toSearchDoc } from '../../../lib/oracle/transform.ts';

export type { Voice } from '../../../lib/oracle/types.ts';
export { toSearchDoc };

export interface SearchHit extends RankHit {
  artwork_count: number;
}

export function searchCorpus(
  corpus: CanonicalCard[],
  query: string,
  opts: { limit?: number; systems?: string[]; expand?: boolean } = {},
): SearchHit[] {
  const docs = corpus.map(toSearchDoc);
  return rank(docs, query, opts).map((h) => ({ ...h, artwork_count: h.artwork.count }));
}
