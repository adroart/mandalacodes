// Mechanical sentence check for the split pass (2026-09-18).
// Usage: node todo/plans/writing-guideline/sentence-check.mjs <card.md or paragraph.txt>
//        node todo/plans/writing-guideline/sentence-check.mjs --deck
// Reads only the plain paragraphs a reader meets (no frontmatter, headings, keyword lines,
// bullets, moving-line markers, underscore intros, or the meta sheet). Gating flags, per
// sentence: over 25 words; 3+ commas/semicolons/colons; fragment under 5 words; em dash;
// italics; a general truth in the past simple; a deck phrase. Advisory: a passive with no
// actor; a content word twice (Adrian's locked lines repeat a noun on purpose). Exit 1 on any gating flag so a run can gate on it.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
let DECK = [];
try { DECK = JSON.parse(fs.readFileSync(path.join(HERE, 'deck-phrases.json'), 'utf8')).phrases; } catch {}
const normal = (s) => ' ' + s.toLowerCase().replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';

const STOP = new Set('a an the and or but so of to in on at for with from by as is are was were be been being it its this that these those you your yours i we they them their he she his her him not no nor if then than when where which who whom what how do does did done have has had will would can could may might shall should must into onto out up down over under again once here there all any each few more most other some such only own same too very just about above after before between through during without within along across behind beyond off per until while one two three'.split(' '));
const PAST = /\b(came|grew|was|were|had|did|went|made|took|gave|found|stood|held|ran|fell|left|kept|rose|lost|became|began|brought|thought|knew|got|said|told|felt|meant|put|set|let|showed|turned|lived|died|moved|passed|ended|started|opened|closed)\b/;
const TIME = /\b(once|when|then|ago|last|that day|one day|the day|the year|the week|after|before|until|since|in the end|at first|first|for years|for a long time|at seven|at birth)\b/;

export function checkSentence(s) {
  const flags = [];
  const words = s.trim().split(/\s+/);
  const w = words.length;
  if (w > 25) flags.push(`${w} words`);
  const punct = (s.match(/[,;:]/g) || []).length;
  if (punct >= 3) flags.push(`${punct} clause marks`);
  if (w < 4 && !/^(so|then|yes|no)\b/i.test(s)) flags.push('fragment');
  if (/—|–/.test(s)) flags.push('em dash');
  if (/(^|\s)_[^_]+_(\s|[.,;:]|$)|\*[^*]+\*/.test(s)) flags.push('italics');
  if (/\b(was|were|is|are|be|been)\s+(\w+ed|\w+en|built|kept|held|made|put|set|left|lost|felt|hurried|rushed)\b/.test(s) && !/\bby\b/.test(s)) flags.push('passive? (advisory)');
  const content = words.map(x => x.toLowerCase().replace(/[^a-z']/g, '')).filter(x => x && !STOP.has(x) && x.length > 3);
  const seen = new Set();
  for (const c of content) { if (seen.has(c)) { flags.push(`"${c}" twice (advisory)`); break; } seen.add(c); }
  if (/\b(everything|nothing|every|always|never|anyone|no one|nobody)\b/i.test(s) && PAST.test(s) && !TIME.test(s)) flags.push('general truth in past tense');
  const n = normal(s);
  for (const ph of DECK) { if (n.includes(' ' + ph + ' ')) { flags.push('deck phrase: ' + ph); break; } }
  return flags;
}

export function proseOf(text) {
  const start = text.indexOf('\n## ');
  let body = start >= 0 ? text.slice(start) : text;
  const m = body.indexOf('\nmeta:');
  if (m >= 0) body = body.slice(0, m);
  return body.split('\n').filter(l => l.trim() && !/^(#|-|_|\*\*|\s*-|\s*\*)/.test(l) && !/^[a-z_]+:\s/.test(l));
}

export function checkText(text) {
  const out = [];
  for (const line of proseOf(text)) {
    for (const s of line.split(/(?<=[.!?])\s+(?=[A-Z"])/)) {
      const f = checkSentence(s);
      if (f.length) out.push({ s, f });
    }
  }
  return out;
}

const gatingOf = (r) => r.filter(x => x.f.some(f => !f.includes('advisory')));

if (process.argv[1] && process.argv[1].endsWith('sentence-check.mjs')) {
  if (process.argv.includes('--deck')) {
    // Formula guard: a paragraph opener (first three words) used on more than three cards is a template.
    let total = 0, bad = 0; const openers = {};
    for (let i = 1; i <= 64; i++) {
      const t = fs.readFileSync(`oracle/cards/${String(i).padStart(2, '0')}.md`, 'utf8');
      for (const para of proseOf(t)) { const o = normal(para).trim().split(' ').slice(0, 3).join(' '); (openers[o] ||= new Set()).add(i); }
    }
    const formulas = Object.entries(openers).filter(([, s]) => s.size > 3).sort((a, b) => b[1].size - a[1].size);
    if (formulas.length) { console.log(`${formulas.length} paragraph openers used on more than three cards (a template):`); for (const [o, s] of formulas.slice(0, 15)) console.log(`  ${s.size} cards: "${o}"`); }
    for (let i = 1; i <= 64; i++) {
      const t = fs.readFileSync(`oracle/cards/${String(i).padStart(2, '0')}.md`, 'utf8');
      bad += gatingOf(checkText(t)).length;
      total += proseOf(t).join(' ').split(/(?<=[.!?])\s+/).length;
    }
    console.log(`${bad} flagged of ${total} sentences`);
    process.exit(bad || formulas.length ? 1 : 0);
  }
  const r = checkText(fs.readFileSync(process.argv[2], 'utf8'));
  for (const { s, f } of r) console.log(`[${f.join('; ')}] ${s}`);
  const gating = gatingOf(r).length;
  console.log(r.length ? `${gating} gating, ${r.length - gating} advisory` : 'clean');
  process.exit(gating ? 1 : 0);
}
