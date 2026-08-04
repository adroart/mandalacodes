/**
 * Build the website's client-side oracle search index.
 *
 * Runs the same fail-closed Markdown corpus loader as the local MCP and emits
 * every complete SearchDoc to data/oracle-search-index.json. The website and
 * hosted APIs load this deterministic deployment artifact and rank it with the
 * shared lib/oracle/ranker.ts, so their search matches the local MCP.
 *
 * This file is generated, never edited as authored Oracle content. Artwork
 * metadata is linked separately; versioned live invocations are not indexed.
 *
 * Regenerate whenever a card manuscript or the artwork↔code map changes:
 *   npx tsx scripts/build-search-index.ts
 */
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCorpus } from '../mcp/oracle-server/src/corpus.ts';
import { toSearchDoc } from '../mcp/oracle-server/src/search.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const corpus = await loadCorpus();

// Keep every searchable Markdown-derived field whole. The hosted REST and MCP
// transports consume this artifact, so truncating it would make their search
// results diverge from the local MCP's `searchCorpus()` results.
const docs = corpus.map(toSearchDoc);

const out = resolve(root, 'data/oracle-search-index.json');
await writeFile(out, JSON.stringify(docs, null, 0) + '\n');
console.log(`[search-index] wrote ${docs.length} docs → data/oracle-search-index.json`);
