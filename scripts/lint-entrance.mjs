#!/usr/bin/env node
/**
 * Entrance lint. Runs every rule marked AUTO in oracle/ENTRANCE-CHECKLIST.md
 * against a card's entrance (the three or four sentences under the keynotes).
 *
 * Two checkers already exist and this one does not repeat them. scripts/
 * lint-oracle-prose.ts checks whole manuscripts for italics, em dashes,
 * editorial leaks and banned vocabulary. todo/plans/writing-guideline/
 * sentence-check.mjs, written in the card-writing session on 2026-09-18, checks
 * any paragraph for sentences over 25 words, three or more commas, fragments,
 * em dashes, italics, deck phrases and a content word used twice. Rules 10, 23,
 * 41 and 42 of the checklist were dropped from here on 2026-09-22 because that
 * script already runs them. What is left is the entrance as a shape: the energy
 * as the subject, no action wearing a noun, no advice in the tail, the title
 * kept out, the felt word, sentence count.
 *
 * Usage:
 *   node scripts/lint-entrance.mjs <file>     # one entrance per block, "NN · Title" then the prose
 *   node scripts/lint-entrance.mjs --text "…" # one entrance on the command line
 * Exit code 1 if any entrance breaks a rule.
 */
import { readFileSync } from 'node:fs';

const VIRTUES = ['honesty','modesty','care','integrity','humility','courage','kindness','discipline','generosity','loyalty','wisdom','compassion','grace'];
const NOUNED = ['the wait','a wait','the listening','the mending','the reaching','a knowing','the knowing','the wanting','the seeking','the giving','the holding','the waiting'];
const FELT = ['joy','luck','spark','urge','pull','hunger','warmth','sense','charge','wish','yes','quiet','desire','love','will','drive','heat','fear','doubt','confusion','hunch','longing','appetite','stillness','pressure','strength','ease','freedom','friction','calm','clarity','certainty','recognition','influence','enthusiasm','instinct','magnetism','dream','sureness','fullness','taste','limit','ground','surge','guidance','resolve','hindsight','readiness','creation','joy','peace','anger','grief','shame','pride','relief','courage','trust','patience'];
const STOP = new Set(['a','an','the','and','or','but','so','to','of','in','on','at','by','for','from','with','as','is','are','was','were','be','been','it','its','you','your','yours','they','them','their','this','that','these','those','there','here','what','when','where','who','whom','which','how','why','not','no','nor','if','then','than','too','very','can','will','would','should','could','do','does','did','has','have','had','one','all','any','each','every','into','out','up','down','over','under','again','only','own','same','more','most','other','some','such','before','after','while','until','about','through','between','you','yourself','anyone','anything','someone','something','nothing','everyone','everything','way','thing','things','come','comes','came','go','goes','went']);

function sentences(text) {
  return text.replace(/\s+/g,' ').trim().split(/(?<=[.!?])\s+/).filter(Boolean);
}
const words = (s) => s.toLowerCase().replace(/[^a-z' ]/g,' ').split(/\s+/).filter(Boolean);

function checkEntrance(id, title, text) {
  const out = [];
  const S = sentences(text);
  const all = text.toLowerCase();
  const push = (rule, msg) => out.push({ rule, msg, warn: false });
  const warn = (rule, msg) => out.push({ rule, msg, warn: true });

  if (S.length < 3) push(4, `only ${S.length} sentence${S.length === 1 ? '' : 's'}; the entrance is three, four at most`);
  if (S.length > 4) push(4, `${S.length} sentences; four at most`);

  const w1 = words(S[0] || '').length;
  if (w1 > 20) push(9, `sentence one is ${w1} words; twenty at most, and Adrian's card 38 is exactly twenty`);

  const last = S[S.length - 1] || '';
  if (/^(so\s+)?(remember|try|make sure|be sure|allow|let yourself|embrace|practice|choose to)\b/i.test(last.trim())) push(18, 'last sentence reads as advice');

  if (title) { const t = title.toLowerCase().replace(/[^a-z ]/g,''); if (t && all.includes(t)) push(16, `the title "${title}" is in the sentence`); }
  if (/—/.test(text)) push(23, 'em dash');
  if (/\bsome people\b/i.test(all)) push(20, '"some people"');
  const te = (all.match(/\bthis energy\b/g) || []).length;
  if (te > 1) push(24, `"this energy" ${te} times; the frame is given once at most`);
  if (/\bnot [^,.;]{1,30} but\b/i.test(all)) push(25, '"not X but Y"');
  if (/\b(like|as if|as though)\b/i.test(all)) push(31, 'simile');
  if (/\bfeeling of\b.*\bat\b|\b(joy|anger|grief|warmth|fear) at\b/i.test(all)) push(43, 'a feeling is "of", never "at"');
  if (/\b(energy|it) (gives|makes) (you|us)\b/i.test(all)) push(37, 'the energy "gives" or "makes"');

  const ADV_OK = new Set(['only','early','really','apply','supply','likely','family','plainly']);
  for (const w of words(text)) if (/ly$/.test(w) && !ADV_OK.has(w) && w.length > 4) push(29, `adverb "${w}"`);

  S.forEach((s, i) => {
    const its = (s.toLowerCase().match(/\bit\b/g) || []).length;
    if (its > 2) push(39, `sentence ${i + 1} has ${its} uses of "it"`);
  });

  for (const v of VIRTUES) if (new RegExp(`\\b${v}\\b`).test(all)) push(12, `virtue word "${v}"`);
  for (const n of NOUNED) if (all.includes(n + ' ')) push(13, `action wearing a noun: "${n}"`);

  const first = words(S[0] || '');
  const subjectFelt = first.slice(0, 5).some((w) => FELT.includes(w.replace(/s$/, '')));
  if (!subjectFelt) warn(11, 'no felt word in the first five words; read it yourself, the list can never be complete');

  const content = words(text).filter((w) => !STOP.has(w) && w.length > 2);
  const seen = new Map();
  for (const w of content) { const k = w.replace(/(ing|ed|es|s)$/, ''); seen.set(k, (seen.get(k) || 0) + 1); }

  return { id, title, text, issues: out, sentences: S };
}

function parseBlocks(raw) {
  const blocks = [];
  let cur = null;
  for (const line of raw.split('\n')) {
    const h = line.match(/^(\d{2})\s*·\s*(.+?)\s*$/);
    if (h && !/[.!?]$/.test(h[2])) { if (cur) blocks.push(cur); cur = { id: h[1], title: h[2], lines: [] }; continue; }
    if (cur && line.trim()) cur.lines.push(line.trim());
    if (cur && !line.trim() && cur.lines.length) { blocks.push(cur); cur = null; }
  }
  if (cur && cur.lines.length) blocks.push(cur);
  return blocks.map((b) => ({ id: b.id, title: b.title, text: b.lines.join(' ') }));
}

const args = process.argv.slice(2);
let items = [];
if (args[0] === '--text') items = [{ id: '--', title: '', text: args.slice(1).join(' ') }];
else items = parseBlocks(readFileSync(args[0], 'utf8'));

let bad = 0;
for (const it of items) {
  const r = checkEntrance(it.id, it.title, it.text);
  const fails = r.issues.filter((i) => !i.warn);
  const warns = r.issues.filter((i) => i.warn);
  if (!fails.length && !warns.length) { console.log(`${r.id} ${r.title}: clean`); continue; }
  if (fails.length) bad++;
  console.log(`${r.id} ${r.title}: ${fails.length} fail, ${warns.length} to read yourself`);
  for (const i of fails) console.log(`   rule ${i.rule}: ${i.msg}`);
  for (const i of warns) console.log(`   read  ${i.rule}: ${i.msg}`);
}
console.log(`\n${items.length - bad} of ${items.length} clean`);
process.exit(bad ? 1 : 0);
