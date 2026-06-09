#!/usr/bin/env -S npx tsx
/**
 * Start a new authored reading for an artwork, on method.
 *
 *   npx tsx mcp/oracle-server/src/scaffold-reading.ts UL-123 [voice ...]
 *
 * Writes oracle/readings/<id>.md with the front-matter filled and the code's
 * assembled material quoted as commented guidance, for you (or Claude, on
 * method) to render into final prose. Won't overwrite an existing file.
 */
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadCorpus } from './corpus.ts';
import { composeReading } from './reading.ts';
import { ORACLE_DIR } from './paths.ts';
import type { Voice } from './search.ts';

const [artworkId, ...voiceArgs] = process.argv.slice(2);
if (!artworkId) {
  console.error('usage: scaffold-reading.ts <artworkId> [voice ...]');
  process.exit(1);
}

const corpus = await loadCorpus();
const card = corpus.find((c) => c.artworks.some((a) => a.id === artworkId));
if (!card) {
  console.error(`No code/artwork found for ${artworkId}`);
  process.exit(1);
}
const artwork = card.artworks.find((a) => a.id === artworkId)!;
const voices = (voiceArgs.length ? voiceArgs : ['gene_keys']) as Voice[];
const material = composeReading(card, { artworkId, voices, length: 'short' });

const path = resolve(ORACLE_DIR, 'readings', `${artworkId}.md`);
if (existsSync(path)) {
  console.error(`${path} already exists — not overwriting.`);
  process.exit(1);
}

const md = `---
artwork: ${artworkId}
code: ${card.number}
card_name: ${card.card_name}
voices: [${voices.join(', ')}]
length: short
status: scaffold
---

<!-- AUTHORING SCAFFOLD — replace everything below with final prose, then set
     status: final. Method: Glance first (no tradition named), then open only the
     listed voices, frame the piece, quote no source prose. Match UL-122.md.

Piece: ${artwork.title} (${artwork.year ?? 'n.d.'})
Keywords: ${card.keywords.join(', ')}

Material:
${JSON.stringify(material, null, 2)}
-->

`;

await writeFile(path, md);
console.log(`Wrote ${path}`);
