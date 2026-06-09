/**
 * Build the hosted full-corpus artifact (data/oracle-corpus.json).
 *
 * Runs the same corpus merge the MCP server uses, then strips the heavy
 * `searchText` blob (the search index already carries the search fields). The
 * Cloudflare Functions import this for get_card / get_voice / find_artworks /
 * cast — they can't read the 64 source files at the edge.
 *
 *   npx tsx scripts/build-oracle-corpus.ts
 */
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCorpus } from '../mcp/oracle-server/src/corpus.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const corpus = await loadCorpus();
const cards = corpus.map(({ searchText, ...card }) => card); // drop the search blob
await writeFile(resolve(root, 'data/oracle-corpus.json'), JSON.stringify({ cards }, null, 0) + '\n');
console.log(`[oracle-corpus] wrote ${cards.length} cards → data/oracle-corpus.json`);
