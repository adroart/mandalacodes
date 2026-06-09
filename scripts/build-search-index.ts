/**
 * Build the website's client-side oracle search index.
 *
 * Runs the SAME corpus merge the MCP server uses (mcp/oracle-server/src/corpus.ts)
 * and emits a compact array of SearchDoc to data/oracle-search-index.json. The
 * website lazy-loads this and ranks it with the shared lib/oracle/ranker.ts, so
 * on-site search behaves exactly like the MCP's search_oracle.
 *
 * Regenerate whenever the oracle corpus or the artwork↔code map changes:
 *   npx tsx scripts/build-search-index.ts
 */
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCorpus } from '../mcp/oracle-server/src/corpus.ts';
import { toSearchDoc } from '../mcp/oracle-server/src/search.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const corpus = await loadCorpus();

// Trim the low-weight deep-prose fields for the client bundle. The fields that
// decide ranking (card_name, keywords, essence, glance) are kept whole; the
// long voice paragraphs (weight 1) only need their opening for term matching.
const CAP = 480;
const cap = (s?: string) => (s && s.length > CAP ? s.slice(0, CAP) : s);

const docs = corpus.map(toSearchDoc).map((d) => ({
  ...d,
  fields: {
    ...d.fields,
    iching: cap(d.fields.iching),
    gene_keys: cap(d.fields.gene_keys),
    human_design: cap(d.fields.human_design),
    tarot: cap(d.fields.tarot),
    body: cap(d.fields.body),
  },
}));

const out = resolve(root, 'data/oracle-search-index.json');
await writeFile(out, JSON.stringify(docs, null, 0) + '\n');
console.log(`[search-index] wrote ${docs.length} docs → data/oracle-search-index.json`);
