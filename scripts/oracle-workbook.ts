/**
 * The printed workbook for Adrian's hand pass over the 64 cards.
 * Phase 2 of todo/plans/personal-pass.md, section 1, with the settings
 * decided on 2026-09-16: A4, coil-bound booklets of four cards, small
 * type at reading spacing, every text page backed by a lined page, a mark
 * beside each sentence the Phase 1 reports flagged, and a two-line strip
 * at the foot of every page carrying the seven checks and the five marks.
 *
 *   npm run workbook -- --booklet 1          cards 1 to 4
 *   npm run workbook -- --cards 3,14,47,52   any four, in that order
 *   npm run workbook -- --all                all sixteen booklets
 *   npm run workbook -- --booklet 1 --html   also keep the HTML beside the PDF
 *
 * Output: workbook/booklet-NN.pdf (gitignored). The script reads
 * oracle/cards/NN.md through the same parser the card page uses, and the
 * Phase 1 report at todo/plans/personal-pass/phase1/NN.md for the marks.
 * It writes nothing back.
 *
 * How the pages are made. Every unit that starts a fresh page (the front
 * matter, each cover, each lens) is rendered by Chromium as its own small
 * PDF, so the script knows exactly which pages belong to which lens. The
 * running head and the strip are Chromium's print header and footer, which
 * is the one way to put them on every page including overflow pages. Then
 * pdf-lib puts a lined page behind every text page, labelled with the page
 * it will face once the sheets are printed both sides and bound on the left.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright';
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

// The strip is two lines at the foot of every page. The seven checks have
// to fit one line of A4 at a size a person can read, so they are the
// shortest phrasing that still names each check; the full wording is on
// the front matter's checks page.
const STRIP_CHECKS = [
  'one thought, one sentence',
  'no copied opener, no explaining closer',
  'the picture whole, then used',
  'say it in other words, check it against a life',
  'first sentence names the thing',
  'would I use this word',
  'held well, not only the trouble',
];
const STRIP_MARKS = ['line through: cut', 'circle, word above: swap', 'caret, number: insert, text on the facing page', 'star: true, keep, fixed', 'question mark: back to the source'];

// ---------- page geometry (mm) ----------
// Text pages are right-hand pages once the booklet is bound on the left, so
// the binding margin is on the left and the pen margin is on the right.
// Lined pages are the backs of text pages, so their margins are mirrored.
const M = { top: 22, bottom: 24, bind: 18, outer: 14 };
const MEASURE = 118; // the text column, about 62 characters of Charter at 9 pt

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
      return `<span class="s${sus ? ' sus' : ''}"><span class="n">${sus ? '<i class="mark"></i>' : ''}${prefix}${counter.n}</span>${esc(s)}</span>`;
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
      html += `<p class="quote">${esc(t.slice(2))}</p>`;
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
  return `<div class="ruled"><span class="lab">${esc(label)}</span>${'<div class="rule"></div>'.repeat(lines)}</div>`;
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
<section class="cover">
  ${img ? `<img class="art" src="${img}" alt="">` : '<div class="art blank"></div>'}
  <div class="cover-text">
    <div class="num">Card ${n}</div>
    <h1>${esc(String(fm.card_name || ''))}</h1>
    <div class="row"><span class="lab">hexagram</span><span class="val">${esc(String(fm.hexagram_name || ''))}</span></div>
    ${ruled(1, 'my gloss')}
    <div class="row"><span class="lab">keynotes</span><span class="val">${kw.map(esc).join(', ')}</span></div>
    ${ruled(1, 'mine')}
    <div class="row"><span class="lab">essence</span><span class="val essence">${esc(essence)}</span></div>
    ${ruled(3, 'in my words')}
  </div>
</section>`;
}

interface Unit {
  kind: 'cover' | 'lens';
  card: number;
  name: string;
  lens?: string;
  html: string;
}

function renderCard(n: number): { units: Unit[]; sentences: number; suspects: number; name: string } {
  const raw = fs.readFileSync(path.join(ROOT, 'oracle/cards', `${String(n).padStart(2, '0')}.md`), 'utf8');
  const card = parseCardMarkdown(raw, `card ${n}`);
  const suspects = loadSuspects(n);
  const name = String(card.frontmatter.card_name || '');
  const units: Unit[] = [{ kind: 'cover', card: n, name, html: renderCover(n, card) }];
  let total = 0;
  let susCount = 0;
  for (const lens of LENSES) {
    const sec = card.sections[lens.key];
    if (!sec) continue;
    const counter: Counter = { n: 0 };
    let body = '';
    // The `_Shadow:_ a · _Gift:_ b · _Siddhi:_ c` line is a label, not a
    // sentence; it prints grey and unnumbered, the way the heights read on
    // the card page. Keywords are on the cover.
    const intro = sec.intro.filter((l) => !/^_?Keywords:_?/i.test(l.trim()));
    const labels = intro.filter((l) => /^_[A-Za-z ]+:_/.test(l.trim()));
    const prose = intro.filter((l) => !labels.includes(l));
    for (const l of labels) body += `<p class="marker">${esc(l.trim().replace(/_/g, '').replace(/\s*·\s*/g, ', '))}</p>`;
    if (prose.length) body += `<p>${renderSentences(prose.join(' '), lens.prefix, counter, suspects)}</p>`;
    for (const sub of sec.subheadings) {
      if (lens.key === 'CODE' && /keywords/i.test(sub.heading)) continue; // on the cover
      body += renderSubheading(sub, lens.prefix, counter, suspects);
      if (lens.key === 'KEYS' && /^(Shadow|Gift|Siddhi)/.test(sub.heading)) body += ruled(1, 'my name for this height');
    }
    total += counter.n;
    susCount += (body.match(/class="s sus"/g) || []).length;
    units.push({ kind: 'lens', card: n, name, lens: lens.title, html: `<section class="lens"><h2>${lens.title}</h2>${body}</section>` });
  }
  return { units, sentences: total, suspects: susCount, name };
}

// ---------- front matter ----------

interface CardStat {
  n: number;
  name: string;
  suspects: number;
}

function frontMatter(booklet: number, cards: CardStat[]): string {
  const list = cards.map((c) => `<div><span class="cn">${c.n}</span>${esc(c.name)}</div>`).join('');
  const marked = cards.reduce((a, c) => a + c.suspects, 0);
  return `
<section class="page fm title">
  <div class="fm-kicker">Universal Language, the pass</div>
  <h1>Booklet ${booklet} of ${BOOKLETS}</h1>
  <div class="big">${list}</div>
  <p class="inherit">The reading pass marked ${marked} sentences across these ${cards.length} cards.</p>
  <p>One card is one sitting. The text is on the right-hand page; the lined page on the left is yours. Every sentence carries a small number so a note can point at it without copying it. The square before a number means the reading pass thought that sentence says nothing a reader could check against a life; start there, do not end there.</p>
  <p>The two lines at the foot of every page are the coach: the seven checks, and the five marks.</p>
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
  ${ruled(2, 'the eighth check, if one is missing')}
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

// One reading face, Charter, made for small sizes on paper; the labels and
// the strip in a plain sans. Black text, hairlines in grey, nothing else.
const CSS = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: Charter, "Iowan Old Style", Georgia, serif; font-size: 9pt; line-height: 1.5; color: #111; -webkit-print-color-adjust: exact; }
.lab, .num, .fm-kicker, .lined .head { font-family: Helvetica, Arial, sans-serif; }
.page { break-before: page; }
.page:first-of-type { break-before: auto; }
p { margin: 0 0 3mm; hyphens: none; orphans: 2; widows: 2; }
b { font-weight: bold; }

/* text pages: a column of ${MEASURE}mm, the rest of the width for the pen */
.lens { width: ${MEASURE}mm; }
.lens h2 { font-size: 15pt; font-weight: normal; margin: 0 0 6mm; letter-spacing: 0.01em; }
h3 { font-size: 9pt; font-weight: bold; margin: 5mm 0 1.5mm; break-after: avoid; }
h3 .tail { font-weight: normal; color: #666; margin-left: 2.2mm; }
p.line { margin-top: 4mm; break-after: avoid; }
p.line .ln { font-weight: bold; margin-right: 1mm; }
p.line .becomes { color: #666; }
p.quote { padding-left: 4mm; margin-bottom: 1.5mm; }
p.marker { color: #666; }
.s .n { font-size: 5.5pt; color: #8a8a8a; vertical-align: 0.45em; margin-right: 0.5mm; letter-spacing: 0.02em; white-space: nowrap; }
.s .n .mark { display: inline-block; width: 1.3mm; height: 1.3mm; background: #111; margin-right: 0.6mm; vertical-align: -0.05em; }

/* ruled lines for his hand, with a small label sitting on the first line */
.ruled { position: relative; margin: 1.5mm 0 4mm; }
.ruled .lab { position: absolute; left: 0; top: 0.6mm; font-size: 5.5pt; color: #8a8a8a; }
.ruled .rule { border-bottom: 0.35pt solid #9a9a9a; height: 8mm; }

/* cover */
.cover .art { display: block; width: 100%; max-height: 124mm; object-fit: contain; object-position: left; margin: 0 0 6mm; }
.cover .art.blank { height: 124mm; border: 0.35pt solid #bbb; }
.cover-text { width: 150mm; }
.cover .num { font-size: 6.5pt; color: #8a8a8a; letter-spacing: 0.1em; text-transform: uppercase; }
.cover h1 { font-size: 22pt; font-weight: normal; margin: 0.5mm 0 4mm; letter-spacing: 0.005em; }
.cover .row { display: flex; gap: 4mm; align-items: baseline; margin: 0 0 1mm; }
.cover .row .lab { flex: 0 0 20mm; font-size: 5.5pt; color: #8a8a8a; }
.cover .val { flex: 1; font-size: 10pt; }
.cover .val.essence { line-height: 1.55; }
.cover .ruled { margin-left: 24mm; }
.cover .ruled .lab { left: -24mm; }

/* front matter */
.fm { width: 138mm; }
.fm h1 { font-size: 24pt; font-weight: normal; margin: 26mm 0 5mm; }
.fm h2 { font-size: 15pt; font-weight: normal; margin: 0 0 6mm; }
.fm h3 { margin-top: 5mm; }
.fm .fm-kicker { font-size: 6.5pt; color: #8a8a8a; letter-spacing: 0.1em; text-transform: uppercase; }
.fm .big { font-size: 12pt; margin-bottom: 8mm; line-height: 1.6; }
.fm .big .cn { display: inline-block; width: 9mm; color: #8a8a8a; }
.fm .inherit { margin-bottom: 8mm; }
.fm ol { padding-left: 5mm; margin: 0 0 3mm; }
.fm li { margin-bottom: 2.5mm; padding-left: 1mm; }
.fm .note { color: #555; }
.fm .ruled { margin-top: 8mm; }
.boxes { margin: 2mm 0 5mm; }
.box { border: 0.35pt solid #555; height: 10mm; margin-bottom: 2.5mm; padding: 2mm 2mm 0 11mm; position: relative; font-size: 9.5pt; }
.box::before { content: ""; position: absolute; left: 2.2mm; top: 2.4mm; width: 4.6mm; height: 4.6mm; border: 0.5pt solid #555; }

/* lined pages: the back of a text page, facing the next one */
.lined .head { display: flex; justify-content: space-between; font-size: 6.5pt; color: #8a8a8a; height: 8mm; letter-spacing: 0.02em; }
.lined .lines { position: relative; }
.lined .l { border-bottom: 0.3pt solid #b0b0b0; height: 8mm; }
.lined .col { position: absolute; top: 0; bottom: 0; left: 12mm; border-left: 0.3pt solid #b0b0b0; }
`;

function document(body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Universal Language workbook</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

// ---------- the running head and the strip (Chromium print header/footer) ----------

const TEMPLATE_FONT = 'font-family: Helvetica, Arial, sans-serif; color: #8a8a8a;';

function footerStrip(bind: number, outer: number): string {
  const gap = '<span style="display:inline-block;width:2mm"></span>';
  const checks = STRIP_CHECKS.map((c, i) => `<span style="white-space:nowrap">${i + 1}&nbsp;&nbsp;${esc(c)}</span>`).join(gap);
  const marks = STRIP_MARKS.map((m) => `<span style="white-space:nowrap">${esc(m)}</span>`).join(gap);
  return `<div style="width:100%; margin:0 ${outer - 2}mm 11mm ${bind - 2}mm; padding-top:1.2mm; border-top:0.3pt solid #b0b0b0; ${TEMPLATE_FONT} font-family:'Avenir Next Condensed', 'Arial Narrow', Helvetica, sans-serif; font-size:5.7pt; line-height:1.45;"><div>${checks}</div><div>${marks}</div></div>`;
}

function runningHead(left: string, right: string, bind: number, outer: number): string {
  return `<div style="width:100%; margin:10mm ${outer}mm 0 ${bind}mm; ${TEMPLATE_FONT} font-size:6.5pt; letter-spacing:0.02em; display:flex; justify-content:space-between;"><span>${left}</span><span>${right}</span></div>`;
}

const emptyHead = '<div></div>';

// ---------- build ----------

interface RenderOpts {
  head?: string;
  mirrored?: boolean;
}

async function renderPdf(page: Page, html: string, opts: RenderOpts = {}): Promise<Uint8Array> {
  const bind = opts.mirrored ? M.outer : M.bind;
  const outer = opts.mirrored ? M.bind : M.outer;
  await page.setContent(html, { waitUntil: 'networkidle' });
  const bytes = await page.pdf({
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: opts.head || emptyHead,
    footerTemplate: footerStrip(bind, outer),
    margin: { top: `${M.top}mm`, bottom: `${M.bottom}mm`, left: `${bind}mm`, right: `${outer}mm` },
  });
  return new Uint8Array(bytes);
}

interface TextPage {
  pdf: PDFDocument;
  index: number; // page index inside that pdf
  label: string; // what the page is, for the lined page that will face it
}

/** One lined page per text page, each headed with the page it will face. */
function linedDocument(facing: (string | null)[]): string {
  const lines = '<div class="l"></div>'.repeat(29);
  return document(
    facing
      .map((f) => `<section class="page lined"><div class="head"><span>${f ? esc(f) : ''}</span><span>${f ? 'facing page' : 'end of booklet'}</span></div><div class="lines"><div class="col"></div>${lines}</div></section>`)
      .join(''),
  );
}

async function buildBooklet(browser: Browser, booklet: number, cards: number[], keepHtml: boolean): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  const tag = String(booklet).padStart(2, '0');
  const page = await browser.newPage();

  const rendered = cards.map((n) => ({ n, ...renderCard(n) }));
  const stats: CardStat[] = rendered.map((r) => ({ n: r.n, name: r.name, suspects: r.suspects }));
  const fmHtml = document(frontMatter(booklet, stats));
  if (keepHtml) {
    fs.writeFileSync(path.join(OUT, `booklet-${tag}-front.html`), fmHtml);
    fs.writeFileSync(path.join(OUT, `booklet-${tag}-cards.html`), document(rendered.flatMap((r) => r.units).map((u) => `<div class="page">${u.html}</div>`).join('')));
  }

  const out = await PDFDocument.create();
  const fmPdf = await PDFDocument.load(await renderPdf(page, fmHtml));
  const fmPages = await out.copyPages(fmPdf, fmPdf.getPageIndices());
  for (const p of fmPages) out.addPage(p);
  if (fmPages.length % 2 === 1) out.addPage(); // the first card cover lands on a right-hand page

  // Every cover and every lens is its own render, so the running head can
  // carry the lens and its page count, and so we know which page faces
  // which once the lined pages go in.
  const textPages: TextPage[] = [];
  for (const r of rendered) {
    for (const u of r.units) {
      const head = u.kind === 'lens' ? runningHead(`Card ${u.card}, ${esc(u.name)}`, `${esc(u.lens || '')}, page <span class="pageNumber"></span> of <span class="totalPages"></span>`, M.bind, M.outer) : emptyHead;
      const pdf = await PDFDocument.load(await renderPdf(page, document(u.html), { head }));
      const count = pdf.getPageCount();
      for (let i = 0; i < count; i++) {
        const label = u.kind === 'cover' ? `Card ${u.card}, ${u.name}, the cover` : `Card ${u.card}, ${u.name}, ${u.lens}, page ${i + 1} of ${count}`;
        textPages.push({ pdf, index: i, label });
      }
    }
  }
  // The lined page behind text page i faces text page i + 1.
  const facing = textPages.map((_, i) => (i + 1 < textPages.length ? textPages[i + 1].label : null));
  const linedPdf = await PDFDocument.load(await renderPdf(page, linedDocument(facing), { mirrored: true }));

  for (let i = 0; i < textPages.length; i++) {
    const [tp] = await out.copyPages(textPages[i].pdf, [textPages[i].index]);
    out.addPage(tp);
    const [lp] = await out.copyPages(linedPdf, [i]);
    out.addPage(lp);
  }
  await page.close();

  const bytes = await out.save();
  const file = path.join(OUT, `booklet-${tag}.pdf`);
  fs.writeFileSync(file, bytes);
  console.log(`[workbook] booklet ${booklet}: cards ${cards.join(', ')} → ${path.relative(ROOT, file)} (${fmPages.length} front pages, ${textPages.length} text pages, ${out.getPageCount()} pages in all)`);
  for (const r of rendered) console.log(`  card ${r.n}: ${r.sentences} sentences, ${r.suspects} marked`);
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
