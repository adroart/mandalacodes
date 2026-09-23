#!/usr/bin/env node
/**
 * Slop detector for oracle entrances.
 *
 * Adrian, 2026-09-22, on "Nothing much happens outside while the inside catches
 * up": "It's like you're not saying anything. This is slop." Slop is not bad
 * grammar, so the entrance linter beside this one cannot see it. Slop is a
 * sentence that would sit on any of the sixty-four cards without anyone
 * noticing. Four tests, in the order they catch things:
 *
 *   1. HEDGES and EMPTY VERBS. much, somewhat, happens, occurs, involves:
 *      words that fill a slot and carry no fact. FAILS the line.
 *   2. STOCK PHRASES. catches up, runs its course, falls into place, holds
 *      space: phrases that arrive whole and were never thought. FAILS the line.
 *   3. THE SWAP TEST, as a warning only. Score the words against all sixty-four
 *      pages and see which card the line sounds most like.
 *
 * What was tried and thrown out, 2026-09-22, because it failed Adrian's own
 * writing: a CONCRETE test (one noun you could point at) failed cards 38 and
 * 53, both his; a BELONGING test on rare shared words failed 38, 53 and 17.
 * His best lines are plain everyday words that share almost nothing with the
 * page they sit on, which is why the swap test only warns here. Run properly it
 * needs a reader: give the line to someone with the sixty-four keyword lists and
 * ask which card it came from. A word count cannot do it.
 *
 * Usage: node scripts/lint-slop.mjs <file>   (blocks of "NN · Title" then prose)
 * Exit 1 if any entrance is slop.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const CARDS = 'oracle/cards';
const HEDGE = ['much','somewhat','kind of','sort of','a bit','various','stuff','somehow','rather','quite'];
const EMPTY_VERB = ['happens','happen','occurs','occur','takes place','involves','involve','relates','relate','works','work out','goes on','going on','exists','exist','manifests','manifest','emerges','emerge','arises','arise'];
const STOCK = ['catches up','catch up','runs its course','run its course','falls into place','fall into place','comes together','come together','holds space','hold space','takes hold','take hold','plays out','play out','sets in','set in','unfolds','unfold','shifts','let go of','lean into','show up for itself','on its own terms','in its own way','at the end of the day','comes full circle'];
const CONCRETE = ['body','hand','hands','breath','chest','stomach','belly','throat','skin','face','eye','eyes','mouth','bone','heart','blood','foot','feet','knee','shoulder','back','room','table','door','window','floor','street','road','house','kitchen','bed','morning','night','day','week','season','winter','summer','rain','sky','water','fire','wood','stone','earth','ground','tree','seed','root','flower','animal','child','friend','stranger','mother','father','money','food','bread','tea','cup','letter','phone','song','wave','light','dark','cold','heat','weight','hour','hours','sleep','walk','step','steps','voice','word','words'];
const STOP = new Set(['a','an','the','and','or','but','so','to','of','in','on','at','by','for','from','with','as','is','are','was','were','be','been','it','its','you','your','they','them','their','this','that','these','those','there','here','what','when','where','who','which','how','why','not','no','if','then','than','can','will','would','should','could','do','does','did','has','have','had','one','all','any','each','every','into','out','up','down','over','under','again','only','own','same','more','most','other','some','such','before','after','while','until','about','through','between','yourself','anyone','anything','someone','something','nothing','everyone','everything','way','ways','come','comes','came','go','goes','went','get','gets','got','make','makes','made','take','takes','took','give','gives','gave','put','puts','say','says','said','see','sees','saw','know','knows','knew','feel','feels','felt','life','lives','people','person','time','times','you','yours','him','her','his','hers','we','our','us','me','my','i']);

const words = (s) => s.toLowerCase().replace(/[^a-z' ]/g,' ').split(/\s+/).filter(Boolean);
const stem = (w) => w.replace(/(ing|ed|es|s)$/,'');

const files = readdirSync(CARDS).filter((f) => /^\d\d\.md$/.test(f));
const cardWords = new Map();
const docFreq = new Map();
for (const f of files) {
  const raw = readFileSync(join(CARDS, f), 'utf8').replace(/^---[\s\S]*?\n---\n/, '');
  const set = new Set(words(raw).filter((w) => !STOP.has(w) && w.length > 2).map(stem));
  cardWords.set(f.slice(0, 2), set);
  for (const w of set) docFreq.set(w, (docFreq.get(w) || 0) + 1);
}

function check(id, title, text) {
  const fails = [];
  const warns = [];
  const low = ' ' + text.toLowerCase().replace(/\s+/g, ' ') + ' ';
  const ws = words(text).filter((w) => !STOP.has(w) && w.length > 2).map(stem);

  const own = cardWords.get(id);

  // The swap test. Score the sentence against all sixty-four pages and see
  // which card it sounds most like. If its own card is not near the top, the
  // sentence would sit on any of them, which is what slop is.
  const scores = [];
  for (const [cid, set] of cardWords) {
    let sc = 0;
    for (const w of new Set(ws)) if (set.has(w)) sc += Math.log(64 / (docFreq.get(w) || 1));
    scores.push([cid, sc]);
  }
  scores.sort((a, b) => b[1] - a[1]);
  const rank = scores.findIndex(([cid]) => cid === id) + 1;
  if (own && rank > 8) warns.push(['swaps', `reads more like card ${scores[0][0]} than card ${id}; it ranks ${rank} of 64 against its own page`]);

  for (const h of HEDGE) if (low.includes(` ${h} `)) fails.push(['hedge', `"${h}" fills a slot and carries no fact`]);
  for (const v of EMPTY_VERB) if (low.includes(` ${v} `)) fails.push(['empty verb', `"${v}" names no action`]);
  for (const p of STOCK) if (low.includes(` ${p} `)) fails.push(['stock phrase', `"${p}" arrived whole, it was never thought`]);

  return { fails, warns };
}

function parseBlocks(raw) {
  const out = []; let cur = null;
  for (const line of raw.split('\n')) {
    const h = line.match(/^(\d{2})\s*·\s*(.+?)\s*$/);
    if (h && !/[.!?]$/.test(h[2])) { if (cur) out.push(cur); cur = { id: h[1], title: h[2], lines: [] }; continue; }
    if (cur && line.trim()) cur.lines.push(line.trim());
    if (cur && !line.trim() && cur.lines.length) { out.push(cur); cur = null; }
  }
  if (cur && cur.lines.length) out.push(cur);
  return out.map((b) => ({ id: b.id, title: b.title, text: b.lines.join(' ') }));
}

const items = parseBlocks(readFileSync(process.argv[2], 'utf8'));
let bad = 0;
for (const it of items) {
  const { fails, warns } = check(it.id, it.title, it.text);
  if (!fails.length && !warns.length) { console.log(`${it.id} ${it.title}: says something`); continue; }
  if (fails.length) bad++;
  console.log(`${it.id} ${it.title}: ${fails.length} slop, ${warns.length} to weigh`);
  for (const [kind, msg] of fails) console.log(`   ${kind}: ${msg}`);
  for (const [kind, msg] of warns) console.log(`   weigh ${kind}: ${msg}`);
}
console.log(`\n${items.length - bad} of ${items.length} say something`);
process.exit(bad ? 1 : 0);
