// The cold reader over every sentence of a card (WRITERS-BRIEF, "The gate that keeps it true";
// CARD-PASS step 6): a reader who knows nothing about the I Ching, Human Design or the Gene Keys
// restates each sentence in their own words, or reports it. It runs from the temp folder so the
// reader loads no project notes and stays cold. It over-flags a little: the writer sorts real
// flags from false ones.
// Usage: node scripts/cold-read.mjs oracle/cards/NN.md [report.txt]
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const [file, out] = process.argv.slice(2);
if (!file) { console.error('usage: node scripts/cold-read.mjs oracle/cards/NN.md [report.txt]'); process.exit(2); }
const raw = readFileSync(file, 'utf8');
const body = raw.replace(/^---\n[\s\S]*?\n---\n/, '');
const keywords = (body.match(/_Keywords:_\s*(.+)/) || [, ''])[1].trim();
const centre = (raw.match(/^meta:\n\s{2}centre:\s*"([^"]*)"/m) || [, ''])[1];

// Walk the prose: headings set the label, every paragraph and bullet is split into sentences.
let label = 'CARD';
let section = '';
const items = [];
let para = [];
const flush = () => {
  const text = para.join(' ').trim();
  para = [];
  if (!text || text.startsWith('_Keywords:_')) return;
  const clean = text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/_image:_[^·→]*/g, '').replace(/→[^.]*\.?/g, '').replace(/^- /, '');
  const sentences = clean.match(/[^.!?]+[.!?]+(?:["”’)]+)?/g) || [clean];
  for (const s of sentences) {
    const t = s.trim();
    if (t.split(/\s+/).length >= 3) items.push({ label, text: t });
  }
};
for (const line of body.split('\n')) {
  const h2 = line.match(/^## (.+)/);
  const h3 = line.match(/^### (.+)/);
  if (h2) { flush(); section = h2[1].trim(); label = section; continue; }
  if (h3) { flush(); label = `${section} / ${h3[1].trim()}`; continue; }
  if (/^\s*$/.test(line)) { flush(); continue; }
  if (/^- /.test(line)) { flush(); para.push(line); flush(); continue; }
  if (/^\*\*Line \d/.test(line)) { flush(); label = `${section} / ${line.replace(/\*\*/g, '').split('·')[0].trim()}`; continue; }
  para.push(line.trim());
}
flush();

let n = 0;
let last = '';
const numbered = items.map((it) => {
  n += 1;
  const head = it.label !== last ? `\n[${it.label}]\n` : '';
  last = it.label;
  return `${head}S${n}. ${it.text}`;
}).join('\n');

const prompt = `You are a cold reader. You know nothing about the I Ching, Human Design, the Gene Keys, tarot or astrology. Read only what is below and answer from it. Use no tools.

This is one card of an oracle deck. Each card describes one energy a person can feel, and every sentence on it should tell the reader something about themselves or their day that they could understand, use or check. The card's keywords: ${keywords}
Its opening lines: ${centre}

For EVERY numbered sentence, decide whether you can say back what it means in plain words as something about a person's life. Report ONLY the sentences that fail, one per line, in exactly this form:
S<number> | CANNOT: <why> ... when you cannot say what it means, or it uses a word you would have to look up or that the card coined
S<number> | NOTHING: <why> ... when you understand it but it tells a reader nothing about themselves: a description of a picture, a symbol, an old character or word, a creature or story, with no meaning for the reader's life
S<number> | ENGLISH: <why> ... when it is not how a person would say it aloud across a table
Then one final line: TOTAL <number of sentences read> FAILED <number failed>.
If a whole paragraph is about a picture or story rather than the reader, list each of its failing sentences.
Do not flag these, they are the page's design: sentences under a KEYS nature heading (Repressive nature, Reactive nature) and Human Design sentences about what people with a centre defined or open are like, which describe a kind of person in the third person on purpose; the Judgement and Image bullets, which render the old saying and may speak of "the wise"; the card title line. Flag a third-person sentence only if it is unclear.
One sentence that names a picture (for example "Fire has long been read as a flame") is allowed when the very next sentence uses that picture to say something about the reader; flag it only when nothing after it makes it about the reader. Section labels in brackets are page headings, not sentences, and names like Shadow or Gift are headings the page explains elsewhere.

${numbered}
`;

const res = execFileSync('claude', ['-p', '--model', 'sonnet', '--no-session-persistence', '--output-format', 'json'], { input: prompt, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, cwd: tmpdir() });
const j = JSON.parse(res.slice(res.indexOf('{')));
const report = `${file}\nsentences sent: ${n}\ncost: $${(j.total_cost_usd ?? 0).toFixed(2)}\n\n${j.result}\n\n--- numbered sentences ---\n${numbered}\n`;
if (out) writeFileSync(out, report);
console.log(`${file}: ${n} sentences, $${(j.total_cost_usd ?? 0).toFixed(2)}`);
console.log(j.result);
