/**
 * CLI data loader for the chart lookbook. The assembly logic now lives in the
 * shared, fs-free lib/oracle/recommendation.ts (so the hosted endpoint reuses
 * it); this file just supplies the corpus from disk via loadCorpus and
 * re-exports the shared types the template/generator use.
 */
import { loadCorpus } from '../../mcp/oracle-server/src/corpus.ts';
import { assembleLookbook, type ChartInput } from '../../lib/oracle/recommendation.ts';
import type { ProfileKey } from '../../lib/astrology/types.ts';

export * from '../../lib/oracle/recommendation.ts';

export async function buildLookbookData(
  profile: ChartInput,
  opts: { clientName?: string; spheres?: ProfileKey[] } = {},
) {
  const cards = await loadCorpus();
  return assembleLookbook(cards, profile, opts);
}
