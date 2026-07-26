/**
 * Standalone smoke test — verifies the corpus merge, search ranking, and cast
 * against the real on-disk oracle data. Run with `npm run smoke`. No MCP SDK
 * required; this exercises the pure logic the server tools sit on top of.
 */
import { loadCorpus } from './corpus.ts';
import { searchCorpus } from './search.ts';
import { castHexagram } from './cast.ts';
import hostedIndex from '../../../data/oracle-search-index.json' with { type: 'json' };
import { rank, type SearchDoc } from '../../../lib/oracle/ranker.ts';

const corpus = await loadCorpus();
console.log('CORPUS: cards loaded =', corpus.length);
const c1 = corpus.find((c) => c.number === 1)!;
console.log(
  'Card1:', c1.card_name,
  '| keywords:', c1.keywords.slice(0, 4).join(', '),
  '| artworks:', c1.artworks.map((a) => a.id).join(','),
  '| lines:', c1.iching.lines.length,
);
console.log('cards with artwork:', corpus.filter((c) => c.artworks.length).length);
console.log('cards with moving lines:', corpus.filter((c) => c.iching.lines.length).length);

const parityQuery = 'cows field';
const localParity = searchCorpus(corpus, parityQuery, { limit: 8, expand: false })
  .map(({ artwork_count: _artworkCount, ...hit }) => hit);
const hostedParity = rank(hostedIndex as SearchDoc[], parityQuery, { limit: 8, expand: false });
if (JSON.stringify(hostedParity) !== JSON.stringify(localParity)) {
  throw new Error('hosted search index does not match local Markdown corpus search');
}
if (!hostedParity.some(hit => hit.number === 3 && hit.matched.includes('cows'))) {
  throw new Error('hosted search index is missing complete Markdown prose for Card 3');
}
console.log('hosted/local search parity: ok');

for (const q of ['art about creation and new beginnings', 'letting go and surrender', 'conflict and tension']) {
  console.log(`\nSEARCH "${q}":`);
  for (const h of searchCorpus(corpus, q, { limit: 4 })) {
    console.log(`  #${h.number} ${h.card_name} (score ${h.score}) — ${h.why} [${h.artwork_count} art]`);
  }
}

console.log('\nCAST:');
const cast = castHexagram(corpus);
console.log(
  `  primary #${cast.primary.number} (${cast.primary.binary})`,
  'moving:', cast.moving_positions,
  cast.resulting ? `→ #${cast.resulting.number}` : '(stable)',
);
