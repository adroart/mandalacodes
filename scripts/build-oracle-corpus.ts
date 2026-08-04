/**
 * Build the hosted full-corpus artifact (data/oracle-corpus.json).
 *
 * Runs the same fail-closed Markdown corpus loader as the local MCP, then
 * strips the derived `searchText` blob (the search artifact carries those
 * fields). Cloudflare Functions import this for card tools because the edge
 * runtime cannot read oracle/cards/01.md through 64.md from a filesystem.
 *
 * This JSON is a deterministic deployment artifact, never an authoring source.
 * Artwork metadata is linked from data/mockData.ts by the loader. Versioned
 * live invocations remain separate and are not included.
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
