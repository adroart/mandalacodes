// Deck-wide counts of the writer's brief's never-dos in oracle/cards/*.md.
// Read-only. Prose only: frontmatter, headings, markers and bullets are
// stripped, and RELATIONS is skipped while that section is paused.
//
//   node scripts/oracle-tells.mjs            deck totals + worst cards
//   node scripts/oracle-tells.mjs --json     totals as one JSON line
//   node scripts/oracle-tells.mjs 03 14      per-card lines for those cards
//
// Promoted 2026-09-16 from the Phase 1 scratch check (todo/plans/personal-pass.md).
// The Phase 1 clean line is: twoAnds 0, heightOpeners 0, systemWord 0,
// notXItIsY at most one per card, wayIsTo and thisIsTheEnergy shared by no
// more than two cards, threeCommas and long30 each under 5% of sentences.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const json = args.includes('--json');
const only = args.filter((a) => /^\d\d$/.test(a));
const dir = 'oracle/cards';
// Every card is always read, so a shared opening is measured against the
// whole deck even when only one card is asked for; `only` filters the output.
const files = fs
  .readdirSync(dir)
  .filter((f) => /^\d\d\.md$/.test(f))
  .sort();
const wanted = (c) => only.length === 0 || only.includes(c.card);

const KEYS = ['startAnd', 'twoAnds', 'notXItIsY', 'heightOpeners', 'wayIsTo', 'thisIsTheEnergy', 'threeCommas', 'long30', 'itAlso', 'cardTalk', 'systemWord'];
const tot = { cards: 0, sentences: 0 };
for (const k of KEYS) tot[k] = 0;
const perCard = [];

for (const f of files) {
  const raw = fs.readFileSync(path.join(dir, f), 'utf8');
  const body = raw.replace(/^---\n[\s\S]*?\n---\n/, '');
  const noRel = body.split(/\n## RELATIONS/)[0];
  const prose = (s) =>
    s
      .split('\n')
      .filter((l) => l.trim() && !/^#/.test(l) && !/^_/.test(l) && !/^- /.test(l) && !/^\*\*Line/.test(l))
      .join('\n');
  const c = { card: f.slice(0, 2), sentences: 0, stems: [] };
  const text = prose(noRel);
  // The eight trigram subsections repeat one trigram's facts on sixteen cards
  // each (the eldest daughter, the risk of a wind), so they are left out of the
  // copied-opening check; the rest of the card is not.
  const noTrigrams = prose(noRel.replace(/\n### (Upper|Lower) trigram[\s\S]*?(?=\n### |\n## )/g, ''));
  const stemSents = noTrigrams.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || [];
  for (const s0 of stemSents) {
    const w = s0.trim().toLowerCase().replace(/[^a-z' ]/g, '').split(/\s+/).filter(Boolean);
    if (w.length >= 6) c.stems.push(w.slice(0, 6).join(' '));
  }
  const sents = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || [];
  for (const k of KEYS) c[k] = 0;
  c.sentences = sents.length;
  for (const s0 of sents) {
    const s = s0.trim();
    if (/^And\b/.test(s)) c.startAnd++;
    if ((s.match(/\band\b/g) || []).length >= 2) c.twoAnds++;
    if ((s.match(/,/g) || []).length >= 3) c.threeCommas++;
    if (s.split(/\s+/).length > 30) c.long30++;
  }
  c.notXItIsY =
    (text.match(/(?<!\b(?:has|have|had|does|do|did|will|would|could|can|should|must|might) )\b[Nn]ot [^.]{1,60}\. It is\b/g) || []).length +
    (text.match(/\bnot (just|only) [^.]{1,40}, (it is|it's|but)\b/gi) || []).length;
  const keys = (body.split(/\n## KEYS/)[1] || '').split(/\n## DESIGN/)[0];
  c.heightOpeners = (keys.match(/\n(At its (lowest|best|height|highest)|Met, this energy|Held well)/g) || []).length;
  const code = (body.split(/\n## CODE/)[1] || '').split(/\n## ICHING/)[0];
  c.wayIsTo = (code.match(/\n(The way is|The way here is)/g) || []).length;
  c.thisIsTheEnergy = (code.match(/\nThis is the energy of/g) || []).length;
  c.itAlso = (text.match(/\bIt also\b/g) || []).length;
  c.cardTalk = (text.match(/\b(this card|this reading|the deck|the oracle)\b/gi) || []).length;
  c.systemWord = (
    prose(noRel.replace(/\n## DESIGN[\s\S]*?(?=\n## BODY)/, '')).match(/\b(hexagram|trigram|siddhi|shadow|gift|codon)\b/gi) || []
  ).length;
  perCard.push(c);
}

// Deck-wide: a sentence opening (first six words, lowercased) found on three or
// more cards is a template copy, wherever it sits. Found by the wave 1 agents:
// "People who carry this all their lives" on 40 cards, "Whether the other half
// sits in you" on 44, "Notice where you are holding yourself" on 26.
const stemCards = new Map();
for (const c of perCard) {
  for (const stem of c.stems) {
    if (!stemCards.has(stem)) stemCards.set(stem, new Set());
    stemCards.get(stem).add(c.card);
  }
}
const sharedStems = [...stemCards.entries()].filter(([, set]) => set.size >= 3).sort((a, b) => b[1].size - a[1].size);
tot.sharedStems = sharedStems.length;
for (const c of perCard) c.sharedStems = c.stems.filter((st) => (stemCards.get(st) || new Set()).size >= 3).length;

for (const c of perCard.filter(wanted)) {
  tot.cards++;
  tot.sentences += c.sentences;
  for (const k of KEYS) tot[k] += c[k];
}

const pct = (n) => (tot.sentences ? ((100 * n) / tot.sentences).toFixed(1) + '%' : '0%');

if (json) {
  console.log(JSON.stringify({ ...tot, threeCommasPct: pct(tot.threeCommas), long30Pct: pct(tot.long30) }));
} else if (only.length) {
  for (const c of perCard.filter(wanted)) {
    const { stems, ...rest } = c;
    console.log(JSON.stringify(rest));
    for (const st of new Set(stems.filter((x) => (stemCards.get(x) || new Set()).size >= 3)))
      console.log(`  shared stem "${st}" on ${stemCards.get(st).size} cards`);
  }
} else {
  console.log(
    `${tot.cards} cards, ${tot.sentences} sentences. startAnd ${tot.startAnd}, twoAnds ${tot.twoAnds}, notXItIsY ${tot.notXItIsY}, heightOpeners ${tot.heightOpeners}, wayIsTo ${tot.wayIsTo}, thisIsTheEnergy ${tot.thisIsTheEnergy}, systemWord ${tot.systemWord}, itAlso ${tot.itAlso}, cardTalk ${tot.cardTalk}, threeCommas ${tot.threeCommas} (${pct(tot.threeCommas)}), long30 ${tot.long30} (${pct(tot.long30)})`,
  );
  const score = (c) => c.twoAnds + c.startAnd + c.heightOpeners + c.wayIsTo + c.systemWord + c.sharedStems;
  const worst = [...perCard].sort((a, b) => score(b) - score(a)).slice(0, 6);
  console.log('worst: ' + worst.map((c) => `${c.card}(${score(c)})`).join(' '));
  const clean = perCard.filter((c) => score(c) === 0).map((c) => c.card);
  console.log(`shared sentence stems (3+ cards): ${sharedStems.length}`);
  for (const [st, set] of sharedStems.slice(0, 12)) console.log(`  ${set.size}  ${st}`);
  console.log(`cards with none of the hard tells: ${clean.length} of ${tot.cards}: ${clean.join(' ')}`);
}
