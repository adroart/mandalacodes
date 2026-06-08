/**
 * Browser-side oracle search. Lazy-loads the prebuilt index
 * (data/oracle-search-index.json) and ranks it with the shared
 * lib/oracle/ranker.ts — the same ranker the MCP server uses, so on-site search
 * behaves identically to Claude's `search_oracle`.
 *
 * The index is code-split: it is only fetched the first time search runs, so it
 * never weighs down the initial page load. Regenerate it with
 * `npx tsx scripts/build-search-index.ts` when the corpus changes.
 */
import { rank, type RankHit, type SearchDoc } from './ranker';

let cache: Promise<SearchDoc[]> | undefined;

export function loadOracleIndex(): Promise<SearchDoc[]> {
  if (!cache) {
    cache = import('../../data/oracle-search-index.json').then(
      (m) => ((m as { default?: SearchDoc[] }).default ?? (m as unknown)) as SearchDoc[],
    );
  }
  return cache;
}

export { rank };
export type { RankHit, SearchDoc };
