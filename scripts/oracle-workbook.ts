/**
 * The printed workbook for Adrian's hand pass over the 64 cards.
 * Phase 2 of todo/plans/personal-pass.md, section 1, as Adrian settled it
 * on 2026-09-16: just the words, the way they read on the website, set
 * like a text document. One column, small margins, small type, nothing on
 * the page that is not the card: no artwork, no numbers, no marks, no
 * strip, no moving lines (those are a separate book). Each card starts on a fresh page, and whatever is left of the
 * last page of a card is ruled for the pen. The one other thing on the
 * page is a page number at the foot.
 *
 *   npm run workbook -- --booklet 1          cards 1 to 4
 *   npm run workbook -- --cards 3,14,47,52   any cards, in that order
 *   npm run workbook -- --all                all sixteen booklets
 *   npm run workbook -- --book               all sixty-four cards in one book
 *   npm run workbook -- --booklet 1 --html   also keep the HTML beside the PDF
 *
 * Output: workbook/booklet-NN.pdf (gitignored). The script reads
 * oracle/cards/NN.md through the same parser the card page uses and
 * writes nothing back. Chromium (Playwright) renders each card as its own
 * PDF; the ruling is found by trying rule counts until one more would add
 * a page; pdf-lib joins the cards into the booklet.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { parseCardMarkdown, type MdSubheading, type ParsedCard } from '../lib/oracle/card-markdown';
import { bitsForCard } from '../utils/ichingCasting';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'workbook');
const CARDS_PER_BOOKLET = 4;
const BOOKLETS = 16;

// The lenses in the order Adrian reads them on the live page. RELATIONS is
// paused and left out.
const LENSES: { key: string; title: string }[] = [
  { key: 'CODE', title: 'Universal Language' },
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
      html += `<p class="quote">${esc(t.slice(2))}</p>`;
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

/**
 * The six lines of the card's hexagram, top to bottom, as inline SVG with
 * the same geometry the site's Hexagram element draws (a filled shape
 * prints everywhere; CSS backgrounds do not).
 */
function hexagramGlyph(n: number): string {
  const bits = bitsForCard(n);
  if (!bits) return '';
  const LH = 9.6;
  const GAP = 6.2;
  const y0 = (100 - (6 * LH + 5 * GAP)) / 2;
  const rects = [...bits]
    .reverse()
    .map((yang, i) => {
      const y = (y0 + i * (LH + GAP)).toFixed(1);
      return yang
        ? `<rect x="8" y="${y}" width="84" height="${LH}" fill="#111"/>`
        : `<rect x="8" y="${y}" width="34" height="${LH}" fill="#111"/><rect x="58" y="${y}" width="34" height="${LH}" fill="#111"/>`;
    })
    .join('');
  return `<svg class="hex" viewBox="0 0 100 100" aria-hidden="true">${rects}</svg>`;
}

function renderCard(n: number): { html: string; name: string } {
  const raw = fs.readFileSync(path.join(ROOT, 'oracle/cards', `${String(n).padStart(2, '0')}.md`), 'utf8');
  const card: ParsedCard = parseCardMarkdown(raw, `card ${n}`);
  const fm = card.frontmatter as Record<string, any>;
  const meta = (fm.meta || {}) as Record<string, any>;
  const name = String(fm.card_name || '');
  // The keywords line lives at the top of the CODE section in the file; on
  // the page it belongs with the name, above the essence.
  const keywords = (card.sections.CODE?.intro || []).find((l) => /^_?Keywords:_?/i.test(l.trim()));
  // The three Gene Keys states sit at the top too, under the hexagram name.
  const heights = (card.sections.KEYS?.intro || []).find((l) => /^_Shadow:_/i.test(l.trim()));
  // The hexagram on the left; the name, the hexagram name and the three
  // states stacked beside it, the name level with the top of the hexagram.
  const kw = keywords ? plain(keywords).replace(/^Keywords:\s*/i, '').split(/\s*·\s*/).filter(Boolean) : [];
  // the number at the left, the name centred, the hexagram at the right, all one height
  let html = `<div class="head"><div class="lead-cell"><div class="title-row"><h1 class="num">${n}</h1><h1 class="name">${esc(name)}</h1>${hexagramGlyph(n)}</div>`;
  if (meta.centre) html += `<p class="sentence">${esc(String(meta.centre))}</p>`;
  html += `</div><div class="kw-cell">${kw.map((k) => `<div>${esc(k)}</div>`).join('')}</div></div>`;
  for (const lens of LENSES) {
    const sec = card.sections[lens.key];
    if (!sec) continue;
    html += `<h2>${lens.title}</h2>`;
    // The parser hands the intro as paragraphs: in CODE the reading itself,
    // in KEYS the heights line (grey, the way the site shows it).
    for (const l of sec.intro) {
      const t = l.trim();
      if (!t || t === keywords?.trim() || t === heights?.trim()) continue;
      if (/^_/.test(t)) html += `<p class="meta">${esc(plain(t).replace(/\s*·\s*/g, ', '))}</p>`;
      else html += `<p>${esc(t.replace(/\s+/g, ' '))}</p>`;
    }
    for (const sub of sec.subheadings) {
      if (lens.key === 'CODE' && /keywords/i.test(sub.heading)) continue;
      if (lens.key === 'ICHING' && /^Moving lines/i.test(sub.heading)) continue; // a separate book
      html += renderSubheading(sub);
    }
    // The lens's first paragraph opens with its first three words in small
    // caps, the old way of marking a start without a gap.
    const at = html.indexOf('<p>', html.lastIndexOf(`<h2>${lens.title}</h2>`));
    if (at >= 0) {
      const end = html.indexOf('</p>', at);
      const body = html.slice(at + 3, end);
      html = html.slice(0, at + 3) + body.replace(/^((?:\S+\s+){2}\S+)/, '<span class="lead">$1</span>') + html.slice(end);
    }
  }
  return { html: `<section class="card">${html}</section>`, name };
}

// One face, Charter, made for small sizes on paper. Nothing else on the page.
// Everything sits on a 12 pt baseline grid: the leading is 12 pt, every
// margin and every ruled line is a multiple of it, so the two columns'
// lines meet across the page and across the sheet.
const U = 11.5; // pt
// The bottom of every page is a ruled box for the pen (Adrian, 2026-09-17). Its height is set
// per card: the tallest box that still keeps the card on the pages it needs, so the writing is
// spread evenly and every page has room for the pen, not only the last (Adrian, 2026-09-26:
// "there's a lot of white space on the last one and not as much room on the first and second").
const PEN_BAND = 66; // mm, the smallest box; a card's box grows from here
const PEN_BAND_MAX = 200; // mm
const KW_BOX = true; // the keywords on a light grey panel (Adrian, 2026-09-17); false puts them behind a rule
let BODY_FONT = '"Iowan Old Style", Charter, Georgia, serif';
const CSS = (band = PEN_BAND) => `
@page { size: A4; margin: 15mm 12mm ${band + 12}mm 18mm; }
@page :left { margin-left: 12mm; margin-right: 18mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: ${BODY_FONT}; font-size: 8.5pt; line-height: ${U}pt; color: #111; font-variant-numeric: oldstyle-nums; font-kerning: normal; }
.card { column-count: 2; column-gap: 8mm; column-fill: auto; }
p { margin: 0; text-indent: 4mm; text-align: justify; hyphens: auto; hyphenate-limit-chars: 6 3 3; word-spacing: -0.04em; orphans: 2; widows: 2; }
p.quote { text-indent: 0; }
p.quote + p.quote { margin-top: ${U / 2}pt; }
.lead { font-variant-caps: small-caps; letter-spacing: 0.04em; }
h1 + p, h2 + p, h3 + p, p.meta + p, p.meta { text-indent: 0; }
p.meta { color: #555; break-after: avoid; }
/* the head spans both columns: the name and the sentence at the left, the keywords stacked at the right */
/* two hairlines hold the head; everything inside sits the same 2.5 mm from them */
.head { column-span: all; display: flex; gap: 4mm; align-items: stretch; padding: 0; border-top: 0.3pt solid #aaa; border-bottom: 0.3pt solid #aaa; margin-bottom: ${U * 1.5}pt; }
.head + h2 { margin-top: 0; }
.head .lead-cell { flex: 1; padding: 2.5mm 0; }
.head .title-row { display: flex; align-items: center; gap: 3mm; margin: 0 0 ${U / 2}pt; }
.head .title-row .hex { display: block; width: 8.5mm; height: 8.5mm; flex: 0 0 8.5mm; }
.head .title-row .name { flex: 1; text-align: center; white-space: nowrap; }
${KW_BOX ? '.head .kw-cell { border-left: none; background: #efefef; padding: 2.5mm 4mm; margin-top: 0; -webkit-print-color-adjust: exact; }' : ''}
.head .kw-cell { flex: 0 0 58mm; font-variant-caps: small-caps; letter-spacing: 0.01em; font-size: 8.5pt; line-height: ${U}pt; color: #444; ${KW_BOX ? '' : 'border-left: 0.4pt solid #999; padding-left: 4mm; margin-top: 2pt;'} }
.head h1 { font-size: 20pt; font-weight: bold; line-height: ${U * 2.5}pt; margin: 0; font-variant-numeric: lining-nums; }
.head .sentence { font-size: 10pt; line-height: ${U * 1.25}pt; text-indent: 0; }
h2 { font-size: 13pt; font-weight: normal; font-variant-caps: small-caps; letter-spacing: 0.06em; line-height: ${U * 1.5}pt; padding-bottom: 0; border-bottom: 0.4pt solid #999; margin: ${U * 2}pt 0 ${U * 0.75}pt; break-after: avoid; }
h3 { font-size: 8.5pt; line-height: ${U}pt; font-weight: normal; font-variant-caps: small-caps; letter-spacing: 0.08em; margin: ${U}pt 0 0; break-after: avoid; }
p.line { margin-top: ${U}pt; text-indent: 0; break-after: avoid; }
.rules { margin-top: ${U}pt; }
.rules div, .ruled-page div { height: ${U * 2}pt; border-bottom: 0.3pt solid #c8c8c8; }
`;
const RULED_PAGE_CSS = `@page { margin-left: 12mm; margin-right: 18mm; }`; // a ruled page is always a left-hand page

function document(body: string, extraCss = '', band = PEN_BAND): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Universal Language workbook</title><style>${CSS(band)}${extraCss}</style></head><body>${body}</body></html>`;
}

async function renderPdf(page: Page, html: string): Promise<PDFDocument> {
  await page.setContent(html, { waitUntil: 'load' });
  // Margins come from @page so left and right pages can mirror.
  const bytes = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  return PDFDocument.load(bytes);
}

const MAX_RULES = 40; // more than a whole page holds at 7 mm
// Every card on a right-hand page costs a ruled page behind each odd card,
// about 60 pages over the book; off keeps it under 200 (Adrian, 2026-09-17).
const RIGHT_HAND_STARTS = false;
const mmToPt = (mm: number) => (mm * 72) / 25.4;

/**
 * Render one card with the tallest pen box that keeps it on the pages it
 * needs at the smallest box, then rule whatever is left of its last page:
 * the most rules that fit without the render growing by a page.
 */
async function renderCardPdf(page: Page, html: string, startsOnLeft: boolean): Promise<{ pdf: PDFDocument; band: number }> {
  // Chromium mirrors margins by page position, so a card that will sit on a
  // left-hand page renders behind a throwaway first page, dropped below.
  const lead = startsOnLeft ? '<div style="break-after: page"></div>' : '';
  const render = (band: number, k: number) =>
    renderPdf(page, document(lead + html.replace('</section>', `<div class="rules">${'<div></div>'.repeat(k)}</div></section>`), '', band));
  const target = (await render(PEN_BAND, 0)).getPageCount();
  // The tallest box, to the millimetre, that keeps the page count.
  let lo = PEN_BAND, hi = PEN_BAND_MAX;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if ((await render(mid, 0)).getPageCount() <= target) lo = mid; else hi = mid;
  }
  const band = lo;
  // Then the most rules that still fit on the last page.
  let rlo = 0, rhi = MAX_RULES;
  while (rhi - rlo > 0) {
    const mid = Math.ceil((rlo + rhi) / 2);
    if ((await render(band, mid)).getPageCount() <= target) rlo = mid; else rhi = mid - 1;
  }
  return { pdf: await render(band, rlo), band };
}

const COVER_CSS = `@page { size: A4; margin: 0; }
.cover { height: 297mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.cover h1 { font-size: 30pt; font-weight: normal; font-variant-caps: small-caps; letter-spacing: 0.12em; line-height: 1.2; margin: 0; }
.cover .sub { font-size: 11pt; letter-spacing: 0.08em; color: #444; margin-top: 8mm; }
.cover .by { font-size: 10pt; letter-spacing: 0.06em; color: #444; position: absolute; bottom: 30mm; left: 0; right: 0; }
.back .site { font-size: 9pt; letter-spacing: 0.06em; color: #666; position: absolute; bottom: 30mm; left: 0; right: 0; text-align: center; }`;

/** The cover: the book's name, one line under it, and the author at the foot. */
function coverPage(): string {
  return document('<div class="cover"><h1>Universal Language</h1><div class="sub">The sixty-four</div><div class="by">Adrian Rasmussen</div></div>', COVER_CSS);
}

/** The back page: only where the deck lives. */
function backPage(): string {
  return document('<div class="cover back"><div class="site">mandalacodes.com</div></div>', COVER_CSS);
}

function blankPage(): string {
  return document('<div class="cover"></div>', COVER_CSS);
}

/** A page of nothing but rules, for the back of a card that ends on a right-hand page. */
function ruledPage(): string {
  return document(`<div class="ruled-page">${'<div></div>'.repeat(30)}</div>`, RULED_PAGE_CSS);
}

async function buildBooklet(browser: Browser, booklet: number, cards: number[], keepHtml: boolean): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  const tag = booklet === 0 ? 'book' : String(booklet).padStart(2, '0');
  const rendered = cards.map((n) => ({ n, ...renderCard(n) }));
  if (keepHtml) fs.writeFileSync(path.join(OUT, `booklet-${tag}.html`), document(rendered.map((r) => r.html).join('')));

  const page = await browser.newPage();
  // Each card is rendered knowing which side of the sheet it starts on.
  const cardPdfs: { pdf: PDFDocument; indices: number[]; band: number }[] = [];
  let pageIndex = 0;
  for (const r of rendered) {
    const startsOnLeft = pageIndex % 2 === 1;
    const { pdf, band } = await renderCardPdf(page, r.html, startsOnLeft);
    const indices = pdf.getPageIndices().slice(startsOnLeft ? 1 : 0);
    cardPdfs.push({ pdf, indices, band });
    pageIndex += indices.length + (RIGHT_HAND_STARTS ? indices.length % 2 : 0);
  }
  const ruled = await renderPdf(page, ruledPage());
  // The whole book gets a cover and a back page (Adrian, 2026-09-26), each with a blank
  // inside so card 1 still starts on a right-hand page. No pen box, no page number.
  const covers = booklet === 0
    ? { front: await renderPdf(page, coverPage()), back: await renderPdf(page, backPage()), blank: await renderPdf(page, blankPage()) }
    : null;

  await page.close();

  const out = await PDFDocument.create();
  const foot: { card?: { n: number; name: string }; first?: boolean; band?: number }[] = [];
  const addRuled = async () => {
    const [rp] = await out.copyPages(ruled, [0]);
    out.addPage(rp);
  };
  // Every card starts on a right-hand page: a card with an odd number of
  // pages gets a ruled page behind it.
  for (let i = 0; i < rendered.length; i++) {
    const pages = await out.copyPages(cardPdfs[i].pdf, cardPdfs[i].indices);
    pages.forEach((pg, j) => {
      out.addPage(pg);
      foot.push({ card: { n: rendered[i].n, name: rendered[i].name }, first: j === 0, band: cardPdfs[i].band });
    });
    if (RIGHT_HAND_STARTS && pages.length % 2 === 1) {
      await addRuled();
      foot.push({ card: { n: rendered[i].n, name: rendered[i].name } });
    }
  }

  // Running heads the way books set them: the book on left-hand pages, the
  // card (with its hexagram) on right-hand pages, the page number at the
  // outer edge of the foot. Drawn by pdf-lib once the pages are joined.
  out.registerFontkit(fontkit);
  const font = await out.embedFont(fs.readFileSync('/System/Library/Fonts/Supplemental/Georgia.ttf'), { subset: true });
  const grey = rgb(0.54, 0.54, 0.54);
  const size = 7;
  out.getPages().forEach((p, i) => {
    const w = p.getWidth();
    const recto = i % 2 === 0;
    const outer = mmToPt(12);
    const inner = mmToPt(18);
    const y = mmToPt(8);
    const num = String(i + 1);
    // the pen box: a grey outline over the bottom quarter, ruled every 8 mm
    const left = recto ? inner : outer;
    const boxW = w - inner - outer;
    const boxY = mmToPt(12);
    const boxH = mmToPt((foot[i]?.band ?? PEN_BAND) - 4);
    for (let ry = boxY + mmToPt(8); ry < boxY + boxH - mmToPt(2); ry += mmToPt(8)) {
      p.drawLine({ start: { x: left, y: ry }, end: { x: left + boxW, y: ry }, thickness: 0.3, color: rgb(0.82, 0.82, 0.82) });
    }
    // page number in the middle of the foot; the card, with its hexagram, at the right
    void recto;
    void inner;
    p.drawText(num, { x: (w - font.widthOfTextAtSize(num, size)) / 2, y, size, font, color: grey });
    const f = foot[i];
    if (!f?.card) return;
    const name = `${f.card.name} - ${f.card.n}`;
    p.drawText(name, { x: w - outer - font.widthOfTextAtSize(name, size), y, size, font, color: grey });
  });

  if (covers) {
    const [front] = await out.copyPages(covers.front, [0]);
    const [insideFront] = await out.copyPages(covers.blank, [0]);
    const [insideBack] = await out.copyPages(covers.blank, [0]);
    const [back] = await out.copyPages(covers.back, [0]);
    out.insertPage(0, front);
    out.insertPage(1, insideFront);
    out.addPage(insideBack);
    out.addPage(back);
  }

  const file = path.join(OUT, booklet === 0 ? 'universal-language-workbook.pdf' : `booklet-${tag}.pdf`);
  fs.writeFileSync(file, await out.save());
  const pages = out.getPageCount();
  const what = booklet === 0 ? `${cards.length} cards` : `booklet ${booklet}: cards ${rendered.map((r) => `${r.n} ${r.name}`).join(', ')}`;
  console.log(`[workbook] ${what} → ${path.relative(ROOT, file)} (${pages} pages, ${Math.ceil(pages / 2)} sheets)`);
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
  const fontArg = get('--font');
  if (fontArg) BODY_FONT = `"${fontArg}", ${BODY_FONT}`;
  const browser = await chromium.launch();
  try {
    if (args.includes('--book')) {
      await buildBooklet(browser, 0, Array.from({ length: 64 }, (_, i) => i + 1), keepHtml);
      return;
    }
    if (cardsArg) {
      const cards = cardsArg.split(',').map((s) => Number(s.trim())).filter((n) => n >= 1 && n <= 64);
      await buildBooklet(browser, Number(bookletArg || 99), cards, keepHtml);
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
