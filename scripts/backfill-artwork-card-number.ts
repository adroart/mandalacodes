/**
 * One-shot backfill: add an explicit `cardNumber` to every Universal Language
 * piece in data/mockData.ts, derived from the "- N" suffix of its title.
 *
 * The artwork↔code link used to be implicit (parse the title). This makes it a
 * real field so the website and the oracle MCP can join artwork to code without
 * string-parsing. Idempotent — skips lines that already carry `cardNumber`.
 *
 *   npx tsx scripts/backfill-artwork-card-number.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(root, 'data/mockData.ts');

const lines = readFileSync(file, 'utf8').split('\n');
let changed = 0;
const out = lines.map((line) => {
  if (!line.includes("series: 'Universal Language'")) return line;
  if (line.includes('cardNumber:')) return line; // idempotent
  const m = line.match(/title:\s*"[^"]*-\s*(\d{1,2})"/);
  if (!m) {
    console.warn('[backfill] no "- N" in title, skipped:', line.slice(0, 60));
    return line;
  }
  const n = Number(m[1]);
  changed++;
  // insert `cardNumber: N,` immediately after the series field
  return line.replace(
    "series: 'Universal Language',",
    `series: 'Universal Language', cardNumber: ${n},`,
  );
});

writeFileSync(file, out.join('\n'));
console.log(`[backfill] added cardNumber to ${changed} Universal Language pieces`);
