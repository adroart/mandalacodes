/**
 * Prerender static SEO pages for the 64 Universal Language card routes
 * (Track C2, todo/plans/overarching-plan.md). The cards are pure client
 * routes (/universal-language/:number) with nothing behind them until React
 * hydrates, so no crawler that doesn't execute JS ever sees a card's title,
 * description, or artwork.
 *
 * This writes dist/universal-language/{N}/index.html for N = 1..64 by
 * templating the already-built dist/index.html: same script/link tags
 * (so the SPA boots and hydrates identically), only the <head> metadata
 * differs — title, description, canonical, Open Graph / Twitter tags, and a
 * JSON-LD CreativeWork block. No headless browser involved.
 *
 * The per-card image reuses the same square media crop
 * (functions/universal-language/[number].js's OG_CROP) that the edge
 * function has served as the card's share preview since it existed —
 * functions/universal-language/[number].js now serves these prerendered
 * files directly instead of rewriting tags at request time, so this script
 * is the single place that generates them.
 *
 * Must run AFTER `vite build` (needs dist/index.html to exist) and BEFORE
 * the postbuild CSP step (scripts/build-csp-headers.mjs), which rewrites
 * dist/_headers from every .html file actually in dist/ — see package.json,
 * where "build" chains vite build -> this script, and "postbuild" (the CSP
 * step) runs after the whole "build" script via npm's lifecycle hook, so it
 * always sees these files.
 *
 *   tsx scripts/prerender-cards.ts
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = 'https://mandalacodes.com';

interface CorpusCard {
  number: number;
  card_name: string;
  keywords: string[];
  essence: string;
  artworks: Array<{ coverImage?: string }>;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function firstSentence(essence: string, keywords: string[]): string {
  const sentence = essence.split(/(?<=[.!?])\s+/)[0]?.trim();
  const base = sentence || keywords.join(', ') || essence.trim();
  if (base.length <= 160) return base;
  const cut = base.slice(0, 157);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : 157)}…`;
}

async function main() {
  const distDir = resolve(root, 'dist');
  const template = await readFile(resolve(distDir, 'index.html'), 'utf8');

  const headMatch = template.match(/<head>([\s\S]*?)<\/head>/);
  if (!headMatch) throw new Error('[prerender] dist/index.html has no <head>...</head> to template');

  const moduleScriptAnchor = /(<script type="module" crossorigin src="\/assets\/)/;
  if (!moduleScriptAnchor.test(headMatch[1])) {
    throw new Error('[prerender] dist/index.html head is missing the expected module script tag — template shape changed, update this script');
  }

  const raw = await readFile(resolve(root, 'data/oracle-corpus.json'), 'utf8');
  const { cards } = JSON.parse(raw) as { cards: CorpusCard[] };
  if (cards.length !== 64) {
    throw new Error(`[prerender] expected 64 cards in data/oracle-corpus.json, found ${cards.length}`);
  }

  let written = 0;
  for (const card of cards) {
    const number = card.number;
    const canonical = `${SITE_URL}/universal-language/${number}`;
    const title = `${card.card_name} · Code ${number} · Universal Language · Mandala Codes`;
    const description = firstSentence(card.essence, card.keywords);
    const imageId = card.artworks[0]?.coverImage;
    if (!imageId) throw new Error(`[prerender] card ${number} has no artwork coverImage to build an og:image from`);
    const image = `${SITE_URL}/media/image/${imageId.split('/').map(encodeURIComponent).join('/')}?w=400&h=400&gravity=center`;

    const titleEsc = escapeHtml(title);
    const descEsc = escapeHtml(description);

    let head = headMatch[1]
      .replace(/<title>[^<]*<\/title>/, `<title>${titleEsc}</title>`)
      .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${descEsc}$2`)
      .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, `$1${titleEsc}$2`)
      .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/, `$1${descEsc}$2`)
      .replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/, `$1${image}$2`)
      .replace(/(<meta\s+property="og:image:width"\s+content=")[^"]*(")/, `$1300$2`)
      .replace(/(<meta\s+property="og:image:height"\s+content=")[^"]*(")/, `$1300$2`)
      .replace(/(<meta\s+name="twitter:card"\s+content=")[^"]*(")/, `$1summary$2`)
      .replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/, `$1${titleEsc}$2`)
      .replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/, `$1${descEsc}$2`)
      .replace(/(<meta\s+name="twitter:image"\s+content=")[^"]*(")/, `$1${image}$2`);

    const creativeWork = {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      '@id': `${canonical}#creativework`,
      name: title,
      url: canonical,
      description,
      image,
      isPartOf: { '@id': `${SITE_URL}/#website` },
      creator: { '@type': 'Person', name: 'Adrian Rasmussen' },
      keywords: card.keywords,
    };

    const extraTags = [
      `<link rel="canonical" href="${canonical}" />`,
      `<meta property="og:url" content="${canonical}" />`,
      '<script type="application/ld+json">',
      JSON.stringify(creativeWork),
      '</script>',
    ].join('\n    ');

    head = head.replace(moduleScriptAnchor, `${extraTags}\n    $1`);

    const html = template.replace(headMatch[0], `<head>${head}</head>`);

    const outDir = resolve(distDir, 'universal-language', String(number));
    await mkdir(outDir, { recursive: true });
    await writeFile(resolve(outDir, 'index.html'), html);
    written++;
  }

  console.log(`[prerender] wrote ${written} card pages → dist/universal-language/{1..64}/index.html`);
}

await main();
