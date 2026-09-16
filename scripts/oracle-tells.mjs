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
const files = fs
  .readdirSync(dir)
  .filter((f) => /^\d\d\.md$/.test(f) && (only.length === 0 || only.includes(f.slice(0, 2))))
  .sort();

const KEYS = ['startAnd', 'twoAnds', 'notXItIsY', 'heightOpeners', 'wayIsTo', 'thisIsTheEnergy', 'threeCommas', 'long30', 'itAlso', 'cardTalk', 'systemWord'];
const tot = { cards: 0, sentences: 0 };
for (const k of KEYS) tot[k] = 0;
const perCard = [];

for (const f of files) {
  const raw = fs.readFileSync(path.join(dir, f), 'utf8');
  const body = raw.replace(/^---\n[\s\S]*?\n---\n/, '');
  const noRel = body.split(/\n## RELATIONS/)[0];
  const lines = noRel
    .split('\n')
    .filter((l) => l.trim() && !/^#/.test(l) && !/^_/.test(l) && !/^- /.test(l) && !/^\*\*Line/.test(l));
  const text = lines.join('\n');
  const sents = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || [];
  const c = { card: f.slice(0, 2), sentences: sents.length };
  for (const k of KEYS) c[k] = 0;
  for (const s0 of sents) {
    const s = s0.trim();
    if (/^And\b/.test(s)) c.startAnd++;
    if ((s.match(/\band\b/g) || []).length >= 2) c.twoAnds++;
    if ((s.match(/,/g) || []).length >= 3) c.threeCommas++;
    if (s.split(/\s+/).length > 30) c.long30++;
  }
  c.notXItIsY =
    (text.match(/\bNot [^.]{1,40}\. It is\b/g) || []).length +
    (text.match(/\bnot (just|only) [^.]{1,40}, (it is|it's|but)\b/gi) || []).length;
  const keys = (body.split(/\n## KEYS/)[1] || '').split(/\n## DESIGN/)[0];
  c.heightOpeners = (keys.match(/\n(At its (lowest|best|height|highest)|Met, this energy|Held well)/g) || []).length;
  const code = (body.split(/\n## CODE/)[1] || '').split(/\n## ICHING/)[0];
  c.wayIsTo = (code.match(/\n(The way is|The way here is)/g) || []).length;
  c.thisIsTheEnergy = (code.match(/\nThis is the energy of/g) || []).length;
  c.itAlso = (text.match(/\bIt also\b/g) || []).length;
  c.cardTalk = (text.match(/\b(this card|this reading|the deck|the oracle)\b/gi) || []).length;
  c.systemWord = (
    text.replace(/\n## DESIGN[\s\S]*?(?=\n## BODY)/, '').match(/\b(hexagram|trigram|siddhi|shadow|gift|codon)\b/gi) || []
  ).length;
  tot.cards++;
  tot.sentences += c.sentences;
  for (const k of KEYS) tot[k] += c[k];
  perCard.push(c);
}

const pct = (n) => (tot.sentences ? ((100 * n) / tot.sentences).toFixed(1) + '%' : '0%');

if (json) {
  console.log(JSON.stringify({ ...tot, threeCommasPct: pct(tot.threeCommas), long30Pct: pct(tot.long30) }));
} else if (only.length) {
  for (const c of perCard) console.log(JSON.stringify(c));
} else {
  console.log(
    `${tot.cards} cards, ${tot.sentences} sentences. startAnd ${tot.startAnd}, twoAnds ${tot.twoAnds}, notXItIsY ${tot.notXItIsY}, heightOpeners ${tot.heightOpeners}, wayIsTo ${tot.wayIsTo}, thisIsTheEnergy ${tot.thisIsTheEnergy}, systemWord ${tot.systemWord}, itAlso ${tot.itAlso}, cardTalk ${tot.cardTalk}, threeCommas ${tot.threeCommas} (${pct(tot.threeCommas)}), long30 ${tot.long30} (${pct(tot.long30)})`,
  );
  const score = (c) => c.twoAnds + c.startAnd + c.heightOpeners + c.wayIsTo + c.systemWord;
  const worst = [...perCard].sort((a, b) => score(b) - score(a)).slice(0, 6);
  console.log('worst: ' + worst.map((c) => `${c.card}(${score(c)})`).join(' '));
  const clean = perCard.filter((c) => score(c) === 0).map((c) => c.card);
  console.log(`cards with none of the hard tells: ${clean.length} of ${tot.cards}: ${clean.join(' ')}`);
}
