/**
 * The printed workbook for Adrian's hand pass over the 64 cards.
 * Phase 2 of todo/plans/personal-pass.md, section 1, with the settings
 * decided on 2026-09-16: A4, coil-bound booklets of four cards, small
 * type at reading spacing, every text page backed by a lined page, a mark
 * beside each sentence the Phase 1 reports flagged, and a two-line strip
 * on every page carrying the seven checks and the five marks.
 *
 *   npm run workbook -- --booklet 1          cards 1 to 4
 *   npm run workbook -- --cards 3,14,47,52   any four, in that order
 *   npm run workbook -- --all                all sixteen booklets
 *   npm run workbook -- --booklet 1 --html   also keep the HTML beside the PDF
 *
 * Output: workbook/booklet-NN.pdf (gitignored). The script reads
 * oracle/cards/NN.md through the same parser the card page uses, and the
 * Phase 1 report at todo/plans/personal-pass/phase1/NN.md for the marks.
 * It writes nothing back. Chromium (Playwright) renders the pages; pdf-lib
 * puts a lined page behind every text page.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { parseCardMarkdown, type MdSubheading, type ParsedCard } from '../lib/oracle/card-markdown';
import { ulCardPublicId } from '../utils/universalLanguage';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'workbook');
const CARDS_PER_BOOKLET = 4;
const BOOKLETS = 16;

// The lenses in the order Adrian reads them on the live page. RELATIONS is
// paused and left out.
const LENSES: { key: string; title: string; prefix: string }[] = [
  { key: 'CODE', title: 'Universal', prefix: 'U' },
  { key: 'ICHING', title: 'I Ching', prefix: 'I' },
  { key: 'KEYS', title: 'Gene Keys', prefix: 'K' },
  { key: 'DESIGN', title: 'Human Design', prefix: 'D' },
  { key: 'BODY', title: 'Body', prefix: 'B' },
];

const STRIP_CHECKS = [
  'one thought, one sentence',
  'no copied opener, no closer that explains',
  'the picture whole, then used',
  'can I say it in other words and check it against a life',
  'does the first sentence name the thing',
  'would I use this word',
  'what it is when held well, not only the trouble',
];
const STRIP_MARKS = ['line through: cut', 'circle + word above: swap', 'caret + number: insert (facing page)', 'star: true, keep, fixed', '?: back to the source'];

// ---------- helpers ----------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const norm = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();

function splitSentences(text: string): string[] {
  return (text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || []).map((s) => s.trim()).filter(Boolean);
}

/** The sentences a Phase 1 report quoted, for the margin mark. */
function loadSuspects(n: number): string[] {
  const file = path.join(ROOT, 'todo/plans/personal-pass/phase1', `${String(n).padStart(2, '0')}.md`);
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, 'utf8');
  const out: string[] = [];
  for (const m of raw.matchAll(/^\s*\d+\.\s+"([^"]{12,})"/gm)) out.push(norm(m[1]));
  return out;
}

function isSuspect(sentence: string, suspects: string[]): boolean {
  const s = norm(sentence);
  const head = s.slice(0, 40);
  return suspects.some((q) => q.includes(head) || s.includes(q.slice(0, 40)));
}

/** Split "Repressive nature — Anal" into its two halves. */
function splitHeading(h: string): { head: string; tail: string } {
  const i = h.indexOf(' — ');
  if (i < 0) return { head: h, tail: '' };
  return { head: h.slice(0, i), tail: h.slice(i + 3) };
}

// ---------- rendering one card ----------

interface Counter {
  n: number;
}

function renderSentences(text: string, prefix: string, counter: Counter, suspects: string[]): string {
  return splitSentences(text)
    .map((s) => {
      counter.n += 1;
      const sus = isSuspect(s, suspects);
      return `<span class="s${sus ? ' sus' : ''}"><span class="n">${prefix}${counter.n}</span>${esc(s)}</span>`;
    })
    .join(' ');
}

function renderSubheading(sub: MdSubheading, prefix: string, counter: Counter, suspects: string[]): string {
  const { head, tail } = splitHeading(sub.heading);
  let html = `<h3>${esc(head)}${tail ? `<span class="tail">${esc(tail)}</span>` : ''}</h3>`;
  // Walk rawLines so the moving-line markers keep their place between prose.
  const buf: string[] = [];
  const flush = () => {
    const joined = buf.join(' ').trim();
    if (joined) html += `<p>${renderSentences(joined, prefix, counter, suspects)}</p>`;
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
      const m = t.match(/^\*\*Line (\d+)\*\*\s*·\s*_image:_\s*(.*?)\s*→\s*becomes\s*(.*)$/);
      if (m) html += `<p class="line"><span class="ln">Line ${m[1]}</span> ${esc(m[2])} <span class="becomes">becomes ${esc(m[3].replace(/\.$/, ''))}</span></p>`;
      else html += `<p class="line">${esc(t.replace(/\*\*/g, ''))}</p>`;
      continue;
    }
    if (/^- /.test(t)) {
      flush();
      html += `<p class="bullet">${esc(t.slice(2))}</p>`;
      continue;
    }
    if (/^_.*_$/.test(t)) {
      flush();
      html += `<p class="marker">${esc(t.replace(/_/g, ''))}</p>`;
      continue;
    }
    buf.push(t);
  }
  flush();
  return html;
}

function ruled(lines: number, label: string): string {
  return `<div class="ruled" data-label="${esc(label)}">${'<div class="rule"></div>'.repeat(lines)}</div>`;
}

/** The `_Keywords:_ a · b · c` line in the CODE intro. */
function cardKeywords(card: ParsedCard): string[] {
  const line = (card.sections.CODE?.intro || []).find((l) => /^_?Keywords:_?/i.test(l.trim()));
  if (!line) return [];
  return line.replace(/^_?Keywords:_?\s*/i, '').split('·').map((s) => s.trim()).filter(Boolean);
}

function renderCover(n: number, card: ParsedCard): string {
  const fm = card.frontmatter as Record<string, any>;
  const meta = (fm.meta || {}) as Record<string, any>;
  const pid = ulCardPublicId(n);
  const img = pid ? `https://res.cloudinary.com/dobbosnda/image/upload/f_auto,q_auto,w_1400,c_fit/${pid}` : '';
  const kw = cardKeywords(card);
  const essence = String(meta.centre || '');
  return `
<section class="page cover">
  ${img ? `<img class="art" src="${img}" alt="">` : '<div class="art blank"></div>'}
  <div class="cover-text">
    <div class="num">${n}</div>
    <h1>${esc(String(fm.card_name || ''))}</h1>
    <div class="row"><span class="lab">hexagram</span><span class="val">${esc(String(fm.hexagram_name || ''))}</span></div>
    ${ruled(1, 'my gloss')}
    <div class="row"><span class="lab">keynotes</span><span class="val kw">${kw.map(esc).join('<span class="dot">·</span>')}</span></div>
    ${ruled(1, 'mine')}
    <div class="row essence"><span class="lab">essence</span><span class="val">${esc(essence)}</span></div>
    ${ruled(3, 'in my words')}
  </div>
</section>`;
}

function renderCard(n: number): { html: string; sentences: number; suspects: number } {
  const raw = fs.readFileSync(path.join(ROOT, 'oracle/cards', `${String(n).padStart(2, '0')}.md`), 'utf8');
  const card = parseCardMarkdown(raw, `card ${n}`);
  const suspects = loadSuspects(n);
  let html = renderCover(n, card);
  let total = 0;
  for (const lens of LENSES) {
    const sec = card.sections[lens.key];
    if (!sec) continue;
    const counter: Counter = { n: 0 };
    let body = '';
    const intro = sec.intro.filter((l) => !/^_?Keywords:_?/i.test(l.trim()));
    if (intro.length) body += `<p>${renderSentences(intro.join(' '), lens.prefix, counter, suspects)}</p>`;
    for (const sub of sec.subheadings) {
      if (lens.key === 'CODE' && /keywords/i.test(sub.heading)) continue; // on the cover
      body += renderSubheading(sub, lens.prefix, counter, suspects);
      if (lens.key === 'KEYS' && /^(Shadow|Gift|Siddhi)/.test(sub.heading)) body += ruled(1, 'my name for this height');
    }
    total += counter.n;
    html += `<section class="page lens"><div class="lens-head"><span class="card-ref">${n} · ${esc(String(card.frontmatter.card_name || ''))}</span><h2>${lens.title}</h2></div>${body}</section>`;
  }
  const susCount = (html.match(/class="s sus"/g) || []).length;
  return { html, sentences: total, suspects: susCount };
}

// ---------- front matter ----------

function frontMatter(booklet: number, cards: number[]): string {
  const list = cards.join(', ');
  return `
<section class="page fm title">
  <div class="fm-kicker">Universal Language · the pass</div>
  <h1>Booklet ${booklet} of ${BOOKLETS}</h1>
  <p class="big">Cards ${list}</p>
  <p>One card is one sitting. The text is on the right-hand page; the lined page on the left is yours. Every sentence carries a small number so a note can point at it without copying it. A small square before a number means the reading pass thought that sentence says nothing a reader could check against a life; start there, do not end there.</p>
  <p>The two lines at the top of every page are the coach: the seven checks, and the five marks.</p>
</section>
<section class="page fm">
  <h2>The sitting</h2>
  <ol>
    <li>The artwork first, two minutes, before any prose. What did you see when you named the piece? That is the one source no packet holds.</li>
    <li>The card with the seven checks, 30 to 40 minutes. Mark; do not yet rewrite.</li>
    <li>For each lens that failed check 4 or 5, the one or two source texts on the shelf page, in full, 15 to 25 minutes a lens. Read until you could shut the book and tell a friend what this energy is at its lowest and its highest in your own words.</li>
    <li>Then rewrite: on the line for a sentence, on the facing page for a paragraph. Never with the card text in view; cover it with a hand and write from the sources and the piece.</li>
    <li>One memo on the phone, three to five minutes, headed "card NN in my life": what this energy is when you have lived it, one concrete instance. The only material in the whole system that is unambiguously yours.</li>
  </ol>
  <p class="note">Every rewritten paragraph is read aloud once before the sitting ends. At the start of each booklet, re-read the last card of the previous one against the checks, ten minutes, cold.</p>
</section>
<section class="page fm">
  <h2>The seven checks</h2>
  <p class="note">Check 4 outranks the rest and runs first on every paragraph. Three families, three fixes: an AI tell is cut or broken; an empty sentence is rewritten from the source; a sentence that is not yours is rewritten by you.</p>
  <h3>Reads as AI. Fix: cut, or break the sentence.</h3>
  <ol>
    <li>Does a sentence start with And, carry two ands, or rope three thoughts together? "It is the push in you to make something that was not there before, and to make it your own way, and it keeps no schedule." Your verdict: very bad English.</li>
    <li>Does the section open the way the same section opens on another card, or does a paragraph end by stepping back to say what it meant? "At its lowest, this energy is" on cards 1 and 2: "I do not want that a part of the template."</li>
    <li>Is the picture given whole and then used, or must the reader decode it? "An idea held too tightly goes out like a small fire under a closed hand" makes the reader decode. "This energy comes in waves, and between the waves there is nothing" gives the wave and uses it.</li>
  </ol>
  <h3>No meaning. Fix: go to the source, find the nugget, say it plainly.</h3>
  <ol start="4">
    <li>Cover everything but this sentence. Can I say what it means in other words, and does it tell me something true I could check against my own life? "It is the oldest thing in you. Held well, it is light." Your verdict: "This becomes more of a riddle once again."</li>
    <li>Does the first sentence of the section name what it is talking about? "What begins things in you rises on its own." Your verdict: "Are you talking about making bread?"</li>
  </ol>
  <h3>Not my voice. Fix: you write it.</h3>
  <ol start="6">
    <li>Would I use this word? Nondescript verbs, one country's word, wellness words, a life assigned to the reader. "Is up in you" became "is alive in you"; "anyone who has started a piece of work or a family knows this hour" was cut because it tells the reader what their life contains.</li>
    <li>Is this about what the energy is when it is held well, or only about the trouble? "We're looking at what this energy is, not what it is when you're having a hard time with it." A challenge is a sentence or two inside the balance, never the paragraph, never a verdict.</li>
  </ol>
</section>
<section class="page fm">
  <h2>The source shelf</h2>
  <p>What repays reading whole, per lens, and what stays shut on the first pass.</p>
  <p><b>Universal.</b> No source of its own; it is the whole card distilled. When it fails, read the Gene Keys chapter and the Eranos fields, then write the reading fresh.</p>
  <p><b>I Ching.</b> The Eranos fields of meaning (about 3,400 words, the text the scenes came from) and Legge (about 950 words, public domain). Wilhelm's judgement and image take two minutes. Shut on the first pass: Huang, both Cleary translations, Deng. The line files only when a moving line failed.</p>
  <p><b>Gene Keys.</b> The Rudd chapter (about 4,000 words) in full, every time, whichever lens failed. The 64 Ways essay second, when the chapter's picture does not land.</p>
  <p><b>Human Design.</b> The gate file and the centre reference (about 450 words). The channel file only when "What completes it" failed. You have no life-test in this lens yet; expect it to take longer and yield fewer rewrites, and let it.</p>
  <p><b>Body.</b> The organ entry, five minutes. Not the amino acid sources: the source is silent about the molecule and every invented reason failed on the page. If the amino paragraph fails check 4, the fix is shorter and more honest, not deeper.</p>
  <p class="note">The travel kit is three books: this workbook, the Gene Keys, and an I Ching (the Eranos, or Wilhelm).</p>
</section>
<section class="page fm">
  <h2>The five marks</h2>
  <ol>
    <li><b>A line through:</b> cut.</li>
    <li><b>A word circled with the word above:</b> swap.</li>
    <li><b>A caret with a number:</b> insert here; the text is on the facing page under that number.</li>
    <li><b>A star in the margin:</b> true, keep, fixed from now on.</li>
    <li><b>A question mark in the margin:</b> back to the source, not done; a resume marker for the next sitting.</li>
  </ol>
  <p>Five marks, nothing else. Afterwards: photograph the marked pages in order into the card's folder in the vault with the memo. A typist writes a verbatim transcript by sentence number; you read it and say apply; a script with no model patches the card. Starred and inserted lines go into the approved file, which a test guards. Status flips to final only on your word.</p>
</section>
<section class="page fm">
  <h2>What done means for a card</h2>
  <div class="boxes">
    <div class="box">every lens read on paper</div>
    <div class="box">every mark applied and re-read on the page</div>
    <div class="box">no question mark left</div>
    <div class="box">the essence, keynotes and gloss in my words</div>
    <div class="box">the three heights carry my own names</div>
    <div class="box">five lenses at final on my say</div>
    <div class="box">one "in my life" memo in the card's folder</div>
  </div>
  <p class="note">A card with six of the seven is not done; it is a card with a resume note.</p>
</section>`;
}

// ---------- CSS ----------

const CSS = `
@page { size: A4 portrait; margin: 16mm 14mm 16mm 14mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: Georgia, "Times New Roman", serif; font-size: 9pt; line-height: 1.38; color: #111; }
.strip { margin: 0 0 3mm; font-family: Helvetica, Arial, sans-serif; font-size: 5.6pt; line-height: 1.3; color: #666; letter-spacing: 0.01em; }
.strip div { white-space: nowrap; overflow: hidden; }
.page { break-before: page; }
.page:first-of-type { break-before: auto; }
/* text column: room on the outer edge for the pen */
.lens { padding-right: 34mm; }
.lens-head { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 0.4pt solid #999; margin-bottom: 4mm; padding-bottom: 1mm; }
.lens-head h2 { font-size: 11pt; font-weight: normal; margin: 0; letter-spacing: 0.04em; }
.card-ref { font-family: Helvetica, Arial, sans-serif; font-size: 6.5pt; color: #666; }
h3 { font-size: 9pt; font-weight: bold; margin: 4mm 0 1.2mm; }
h3 .tail { font-weight: normal; color: #555; }
h3 .tail::before { content: " · "; }
p { margin: 0 0 2.4mm; text-align: left; hyphens: none; }
p.line { margin-top: 3mm; }
p.line .ln { font-weight: bold; }
p.line .becomes { color: #555; }
p.line .becomes::before { content: "→ "; }
p.bullet { padding-left: 4mm; text-indent: -4mm; }
p.bullet::before { content: "· "; }
p.marker { color: #555; font-size: 8pt; }
.s .n { font-family: Helvetica, Arial, sans-serif; font-size: 5pt; color: #999; vertical-align: super; margin-right: 0.4mm; }
.s.sus .n::before { content: "■ "; color: #111; font-size: 4.5pt; vertical-align: 0; }
.ruled { margin: 2mm 0 3mm; position: relative; padding-top: 1mm; }
.ruled::before { content: attr(data-label); position: absolute; left: 0; top: -1.6mm; font-family: Helvetica, Arial, sans-serif; font-size: 5.6pt; color: #888; }
.rule { border-bottom: 0.4pt solid #aaa; height: 7.5mm; }
/* cover */
.cover .art { display: block; width: 100%; max-height: 150mm; object-fit: contain; margin: 0 auto 6mm; }
.cover .art.blank { height: 150mm; border: 0.4pt solid #ccc; }
.cover-text { padding-right: 34mm; }
.cover .num { font-family: Helvetica, Arial, sans-serif; font-size: 8pt; color: #666; }
.cover h1 { font-size: 18pt; font-weight: normal; margin: 0 0 4mm; }
.cover .row { display: flex; gap: 4mm; align-items: baseline; margin-bottom: 1mm; }
.cover .lab { flex: 0 0 18mm; font-family: Helvetica, Arial, sans-serif; font-size: 6pt; color: #666; }
.cover .val { flex: 1; }
.cover .kw .dot { margin: 0 1.6mm; color: #888; }
.cover .essence .val { font-size: 10pt; line-height: 1.5; }
/* front matter */
.fm { padding-right: 20mm; }
.fm h1 { font-size: 22pt; font-weight: normal; margin: 20mm 0 4mm; }
.fm h2 { font-size: 12pt; font-weight: normal; margin: 0 0 4mm; letter-spacing: 0.04em; border-bottom: 0.4pt solid #999; padding-bottom: 1mm; }
.fm h3 { margin-top: 4mm; }
.fm .fm-kicker { font-family: Helvetica, Arial, sans-serif; font-size: 7pt; color: #666; letter-spacing: 0.08em; text-transform: uppercase; }
.fm .big { font-size: 12pt; }
.fm ol { padding-left: 5mm; margin: 0 0 3mm; }
.fm li { margin-bottom: 2mm; }
.fm .note { color: #555; }
.boxes { margin: 4mm 0; }
.box { border: 0.5pt solid #444; height: 9mm; margin-bottom: 2.5mm; padding: 1.5mm 2mm 0 10mm; position: relative; font-size: 9.5pt; }
.box::before { content: ""; position: absolute; left: 2mm; top: 2mm; width: 4.5mm; height: 4.5mm; border: 0.6pt solid #444; }
/* lined page */
.lined-page .l { border-bottom: 0.35pt solid #b5b5b5; height: 8mm; }
.lined-page .head { font-family: Helvetica, Arial, sans-serif; font-size: 6pt; color: #888; height: 6mm; }
`;

function strip(): string {
  return `<div class="strip"><div>${STRIP_CHECKS.map((c, i) => `${i + 1} ${esc(c)}`).join('  ·  ')}</div><div>${STRIP_MARKS.map(esc).join('  ·  ')}</div></div>`;
}

function document(body: string): string {
  const withStrips = body.replace(/<section class="page([^"]*)">/g, (m) => `${m}${strip()}`);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Universal Language workbook</title><style>${CSS}</style></head><body>${withStrips}</body></html>`;
}

function linedDocument(): string {
  const lines = '<div class="l"></div>'.repeat(31);
  return document(`<section class="page"><div class="lined-page"><div class="head">notes</div>${lines}</div></section>`);
}

// ---------- build ----------

async function renderPdf(html: string): Promise<Uint8Array> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    const bytes = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
    return new Uint8Array(bytes);
  } finally {
    await browser.close();
  }
}

async function buildBooklet(booklet: number, cards: number[], keepHtml: boolean): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  const tag = String(booklet).padStart(2, '0');
  let cardsHtml = '';
  const stats: string[] = [];
  for (const n of cards) {
    const r = renderCard(n);
    cardsHtml += r.html;
    stats.push(`card ${n}: ${r.sentences} sentences, ${r.suspects} marked`);
  }
  const fmHtml = document(frontMatter(booklet, cards));
  const bodyHtml = document(cardsHtml);
  if (keepHtml) {
    fs.writeFileSync(path.join(OUT, `booklet-${tag}-front.html`), fmHtml);
    fs.writeFileSync(path.join(OUT, `booklet-${tag}-cards.html`), bodyHtml);
  }
  const fmPdf = await renderPdf(fmHtml);
  const cardsPdf = await renderPdf(bodyHtml);
  const linedPdf = await renderPdf(linedDocument());

  // Front matter as is, then every card page followed by a lined page, so on
  // a duplex print the lined page is the back of each text page.
  const out = await PDFDocument.create();
  const fm = await PDFDocument.load(fmPdf);
  const cs = await PDFDocument.load(cardsPdf);
  const ln = await PDFDocument.load(linedPdf);
  const fmPages = await out.copyPages(fm, fm.getPageIndices());
  for (const p of fmPages) out.addPage(p);
  if (fmPages.length % 2 === 1) out.addPage(); // the first card cover lands on a right-hand page
  const cardPages = await out.copyPages(cs, cs.getPageIndices());
  for (const p of cardPages) {
    out.addPage(p);
    const [l] = await out.copyPages(ln, [0]);
    out.addPage(l);
  }
  const bytes = await out.save();
  const file = path.join(OUT, `booklet-${tag}.pdf`);
  fs.writeFileSync(file, bytes);
  console.log(`[workbook] booklet ${booklet}: cards ${cards.join(', ')} → ${path.relative(ROOT, file)} (${fmPages.length} front pages, ${cardPages.length} text pages, ${out.getPageCount()} pages in all)`);
  for (const s of stats) console.log(`  ${s}`);
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
  if (cardsArg) {
    const cards = cardsArg.split(',').map((s) => Number(s.trim())).filter((n) => n >= 1 && n <= 64);
    await buildBooklet(Number(bookletArg || 0), cards, keepHtml);
    return;
  }
  const booklets = args.includes('--all') ? Array.from({ length: BOOKLETS }, (_, i) => i + 1) : [Number(bookletArg || 1)];
  for (const b of booklets) {
    const start = (b - 1) * CARDS_PER_BOOKLET + 1;
    const cards = Array.from({ length: CARDS_PER_BOOKLET }, (_, i) => start + i).filter((n) => n <= 64);
    await buildBooklet(b, cards, keepHtml);
  }
}

main().catch((err) => {
  console.error('[workbook] failed:', err);
  process.exit(1);
});
