/**
 * Build public/sitemap.xml — the missing half of "search engines cannot find
 * any of the 64 card pages" (Track C2, todo/plans/overarching-plan.md).
 *
 * The 64 card routes (/universal-language/1 .. /64) are client-rendered only
 * and were never listed anywhere a crawler looks. public/robots.txt already
 * points at https://mandalacodes.com/sitemap.xml (alongside the Astro
 * /learn/sitemap-index.xml) — this script is what makes that URL real.
 *
 * Source of truth is data/oracle-corpus.json (built by build-oracle-corpus.ts,
 * which must run before this in the pipeline). Deliberately does not touch
 * the learn sitemap — that one is Astro's own output, copied in by
 * `npm run build:content`.
 *
 *   npx tsx scripts/build-sitemap.ts
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = 'https://mandalacodes.com';

interface CorpusCard {
  number: number;
}

const raw = await readFile(resolve(root, 'data/oracle-corpus.json'), 'utf8');
const { cards } = JSON.parse(raw) as { cards: CorpusCard[] };

if (cards.length !== 64) {
  throw new Error(`[sitemap] expected 64 cards in data/oracle-corpus.json, found ${cards.length}`);
}

const staticPaths = ['/universal-language', '/the-systems', '/atlas', '/gateway'];
const cardPaths = cards
  .map((card) => card.number)
  .sort((a, b) => a - b)
  .map((number) => `/universal-language/${number}`);

const urls = [...staticPaths, ...cardPaths];

const lastmod = new Date().toISOString().slice(0, 10);
const body = urls
  .map((path) => `  <url>\n    <loc>${SITE_URL}${path}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`)
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

await writeFile(resolve(root, 'public/sitemap.xml'), xml);
console.log(`[sitemap] wrote ${urls.length} URLs → public/sitemap.xml`);
