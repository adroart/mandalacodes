/**
 * The printed workbook for Adrian's hand pass over the 64 cards.
 * Phase 2 of todo/plans/personal-pass.md, section 1, as Adrian settled it
 * on 2026-09-16: just the words, the way they read on the website, set
 * like a text document. One column, small margins, small type, the cards
 * running on one after another with no page breaks, nothing on the page
 * that is not the card: no artwork, no numbers, no marks, no strip.
 * The one thing that is not card text is a page number at the foot.
 *
 *   npm run workbook -- --booklet 1          cards 1 to 4
 *   npm run workbook -- --cards 3,14,47,52   any cards, in that order
 *   npm run workbook -- --all                all sixteen booklets
 *   npm run workbook -- --booklet 1 --html   also keep the HTML beside the PDF
 *
 * Output: workbook/booklet-NN.pdf (gitignored). The script reads
 * oracle/cards/NN.md through the same parser the card page uses and
 * writes nothing back. Chromium (Playwright) renders the PDF.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright';
import { parseCardMarkdown, type MdSubheading, type ParsedCard } from '../lib/oracle/card-markdown';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'workbook');
const CARDS_PER_BOOKLET = 4;
const BOOKLETS = 16;

// The lenses in the order Adrian reads them on the live page. RELATIONS is
// paused and left out.
const LENSES: { key: string; title: string }[] = [
  { key: 'CODE', title: 'Universal' },
  { key: 'ICHING', title: 'I Ching' },
  { key: 'KEYS', title: 'Gene Keys' },
  { key: 'DESIGN', title: 'Human Design' },
  { key: 'BODY', title: 'Body' },
];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Strip the markdown emphasis and the arrow from a line, keeping the words. */
const plain = (s: string) => s.replace(/\*\*/g, '').replace(/_/g, '').replace(/\s*→\s*/g, ' ').replace(/\s+/g, ' ').trim();

/** "Repressive nature — Anal" prints as "Repressive nature, Anal". */
const heading = (h: string) => esc(h.replace(/\s+—\s+/g, ', '));

function renderSubheading(sub: MdSubheading): string {
  let html = `<h3>${heading(sub.heading)}</h3>`;
  const buf: string[] = [];
  const flush = () => {
    const joined = buf.join(' ').trim();
    if (joined) html += `<p>${esc(joined)}</p>`;
    buf.length = 0;
  };
  for (const line of sub.rawLines) {
    const t = line.trim();
    if (!t) {
      flush();
      continue;
    }
    if (/^\*\*Line \d+\*\*/.test(t)) {
      flush();
      // "**Line 1** · _image:_ a dragon under the water. → becomes Hexagram 44, Coming to Meet."
      const m = t.match(/^\*\*Line (\d+)\*\*\s*·\s*_image:_\s*(.*?)\s*→\s*becomes\s*(.*)$/);
      html += m ? `<p class="line"><b>Line ${m[1]}.</b> ${esc(m[2])} Becomes ${esc(m[3])}</p>` : `<p class="line">${esc(plain(t))}</p>`;
      continue;
    }
    if (/^- /.test(t)) {
      flush();
      html += `<p>${esc(t.slice(2))}</p>`;
      continue;
    }
    if (/^_.*_$/.test(t)) {
      flush();
      html += `<p>${esc(plain(t))}</p>`;
      continue;
    }
    buf.push(t);
  }
  flush();
  return html;
}

function renderCard(n: number): { html: string; name: string } {
  const raw = fs.readFileSync(path.join(ROOT, 'oracle/cards', `${String(n).padStart(2, '0')}.md`), 'utf8');
  const card: ParsedCard = parseCardMarkdown(raw, `card ${n}`);
  const fm = card.frontmatter as Record<string, any>;
  const meta = (fm.meta || {}) as Record<string, any>;
  const name = String(fm.card_name || '');
  let html = `<h1>${n}. ${esc(name)}</h1>`;
  html += `<p class="meta">${esc(String(fm.hexagram_name || ''))}</p>`;
  if (meta.centre) html += `<p>${esc(String(meta.centre))}</p>`;
  for (const lens of LENSES) {
    const sec = card.sections[lens.key];
    if (!sec) continue;
    html += `<h2>${lens.title}</h2>`;
    // The intro holds the keywords line and, in KEYS, the heights line
    // (grey, the way the site shows them), and in CODE the reading itself.
    const buf: string[] = [];
    const flush = () => {
      if (buf.length) html += `<p>${esc(buf.join(' '))}</p>`;
      buf.length = 0;
    };
    for (const l of sec.intro) {
      const t = l.trim();
      if (!t) flush();
      else if (/^_/.test(t)) {
        flush();
        html += `<p class="meta">${esc(plain(t).replace(/\s*·\s*/g, ', '))}</p>`;
      } else buf.push(t);
    }
    flush();
    for (const sub of sec.subheadings) {
      if (lens.key === 'CODE' && /keywords/i.test(sub.heading)) continue;
      html += renderSubheading(sub);
    }
  }
  return { html: `<section class="card">${html}</section>`, name };
}

// One face, Charter, made for small sizes on paper. Nothing else on the page.
const CSS = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: Charter, "Iowan Old Style", Georgia, serif; font-size: 8.5pt; line-height: 1.35; color: #111; }
p { margin: 0 0 1.8mm; hyphens: none; orphans: 2; widows: 2; }
p.meta { color: #555; }
h1 { font-size: 14pt; font-weight: bold; margin: 6mm 0 1.5mm; break-after: avoid; }
.card:first-child h1 { margin-top: 0; }
h2 { font-size: 10.5pt; font-weight: bold; margin: 4mm 0 1.5mm; break-after: avoid; }
h3 { font-size: 8.5pt; font-weight: bold; margin: 2.8mm 0 0.8mm; break-after: avoid; }
p.line { margin-top: 2.2mm; break-after: avoid; }
`;

function document(body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Universal Language workbook</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

const footer = `<div style="width:100%; margin:0 12mm 6mm; text-align:right; font-family:Charter, Georgia, serif; font-size:7pt; color:#8a8a8a;"><span class="pageNumber"></span></div>`;

async function buildBooklet(browser: Browser, booklet: number, cards: number[], keepHtml: boolean): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  const tag = String(booklet).padStart(2, '0');
  const rendered = cards.map((n) => ({ n, ...renderCard(n) }));
  const html = document(rendered.map((r) => r.html).join(''));
  if (keepHtml) fs.writeFileSync(path.join(OUT, `booklet-${tag}.html`), html);

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  const bytes = await page.pdf({
    format: 'A4',
    printBackground: false,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: footer,
    margin: { top: '12mm', bottom: '14mm', left: '14mm', right: '12mm' },
  });
  await page.close();

  const file = path.join(OUT, `booklet-${tag}.pdf`);
  fs.writeFileSync(file, bytes);
  const pages = (bytes.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`[workbook] booklet ${booklet}: cards ${rendered.map((r) => `${r.n} ${r.name}`).join(', ')} → ${path.relative(ROOT, file)} (${pages} pages, ${Math.ceil(pages / 2)} sheets)`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const keepHtml = args.includes('--html');
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const cardsArg = get('--cards');
  const bookletArg = get('--booklet');
  const browser = await chromium.launch();
  try {
    if (cardsArg) {
      const cards = cardsArg.split(',').map((s) => Number(s.trim())).filter((n) => n >= 1 && n <= 64);
      await buildBooklet(browser, Number(bookletArg || 0), cards, keepHtml);
      return;
    }
    const booklets = args.includes('--all') ? Array.from({ length: BOOKLETS }, (_, i) => i + 1) : [Number(bookletArg || 1)];
    for (const b of booklets) {
      const start = (b - 1) * CARDS_PER_BOOKLET + 1;
      const cards = Array.from({ length: CARDS_PER_BOOKLET }, (_, i) => start + i).filter((n) => n <= 64);
      await buildBooklet(browser, b, cards, keepHtml);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[workbook] failed:', err);
  process.exit(1);
});
