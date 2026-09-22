// Deck-wide counts of the writer's brief's never-dos in oracle/cards/*.md.
// Read-only. Prose only: frontmatter, headings, markers and bullets are
// stripped before sentence-level checks.
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
import { fileURLToPath } from 'node:url';

const KEYS = ['startAnd', 'twoAnds', 'notXItIsY', 'heightOpeners', 'wayIsTo', 'thisIsTheEnergy', 'threeCommas', 'long30', 'itAlso', 'cardTalk', 'systemWord'];

export function prose(s) {
  return s
    .split('\n')
    .filter((l) => l.trim() && !/^#/.test(l) && !/^_/.test(l) && !/^- /.test(l) && !/^\*\*Line/.test(l))
    .join('\n');
}

export function subsectionBody(sectionText, headingPrefix) {
  const match = sectionText.match(new RegExp(`### ${headingPrefix}[^\n]*\n([\\s\\S]*?)(?=\\n### |\\n## |$)`));
  return match?.[1] ?? '';
}

export function firstProseParagraph(sectionText) {
  const lines = sectionText.split('\n').filter((l) => {
    const t = l.trim();
    return t && !/^#/.test(l) && !/^- /.test(l) && !/^\*\*Line/.test(l) && !/^_/.test(t);
  });
  return (lines[0] ?? '').trim();
}

export function subsectionOpener(sectionText, headingPrefix) {
  const body = subsectionBody(sectionText, headingPrefix);
  const first = firstProseParagraph(body);
  const sentence = first.match(/^[^.!?]+[.!?]?/)?.[0] ?? first;
  return sentence.trim();
}

/** Exact subsection opener shared by three or more cards (trigram subsections exempt). */
export function findSubsectionOpenerRepeats(cardsDir = 'oracle/cards') {
  const files = fs
    .readdirSync(cardsDir)
    .filter((f) => /^\d\d\.md$/.test(f))
    .sort();
  const buckets = new Map();

  for (const f of files) {
    const raw = fs.readFileSync(path.join(cardsDir, f), 'utf8');
    const card = f.slice(0, 2);
    const keys = (raw.split(/\n## KEYS/)[1] ?? '').split(/\n## DESIGN/)[0];
    const relations = raw.split(/\n## RELATIONS/)[1] ?? '';
    const immortals = subsectionBody(relations, 'Immortals');

    for (const [label, sectionText, heading] of [
      ['KEYS > Repressive nature', keys, 'Repressive nature'],
      ['KEYS > Reactive nature', keys, 'Reactive nature'],
      ['RELATIONS > Immortals', immortals, null],
    ]) {
      const opener = heading ? subsectionOpener(sectionText, heading) : firstProseParagraph(sectionText).match(/^[^.!?]+[.!?]?/)?.[0]?.trim() ?? '';
      if (!opener) continue;
      const key = `${label} :: ${opener}`;
      if (!buckets.has(key)) buckets.set(key, new Set());
      buckets.get(key).add(card);
    }
  }

  return [...buckets.entries()]
    .filter(([, cards]) => cards.size >= 3)
    .map(([key, cards]) => ({ key, cards: [...cards].sort(), count: cards.size }))
    .sort((a, b) => b.count - a.count);
}

export function countSubsectionOpeners(cardsDir = 'oracle/cards') {
  const files = fs
    .readdirSync(cardsDir)
    .filter((f) => /^\d\d\.md$/.test(f))
    .sort();
  let cards = 0;
  let repressiveThisPerson = 0;
  let reactiveHere = 0;
  let immortalsStandsAbove = 0;
  let keysInwardFace = 0;

  for (const f of files) {
    cards++;
    const raw = fs.readFileSync(path.join(cardsDir, f), 'utf8');
    const keys = (raw.split(/\n## KEYS/)[1] ?? '').split(/\n## DESIGN/)[0];
    const relations = raw.split(/\n## RELATIONS/)[1] ?? '';
    const repressive = subsectionBody(keys, 'Repressive nature');
    const reactive = subsectionBody(keys, 'Reactive nature');

    if (/\bThis person /.test(repressive)) repressiveThisPerson++;
    if (/\bHere /.test(reactive)) reactiveHere++;
    if (/stands above/.test(relations)) immortalsStandsAbove++;
    if (/inward face of the Shadow/i.test(keys)) keysInwardFace++;
  }

  return {
    cards,
    repressiveThisPerson,
    reactiveHere,
    immortalsStandsAbove,
    keysInwardFace,
  };
}

export function analyzeDeck(cardsDir = 'oracle/cards', only = []) {
  const files = fs
    .readdirSync(cardsDir)
    .filter((f) => /^\d\d\.md$/.test(f))
    .sort();
  const wanted = (c) => only.length === 0 || only.includes(c.card);

  const tot = { cards: 0, sentences: 0 };
  for (const k of KEYS) tot[k] = 0;
  const perCard = [];

  for (const f of files) {
    const raw = fs.readFileSync(path.join(cardsDir, f), 'utf8');
    const body = raw.replace(/^---\n[\s\S]*?\n---\n/, '');
    const noRel = body.split(/\n## RELATIONS/)[0];
    const c = { card: f.slice(0, 2), sentences: 0, stems: [] };
    const text = prose(noRel);
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
    c.wayIsTo = (code.match(/\n(The way is to|The way here is to)\b/g) || []).length;
    c.thisIsTheEnergy = (code.match(/\nThis is the energy of/g) || []).length;
    c.itAlso = (text.match(/\bIt also\b/g) || []).length;
    c.cardTalk = (text.match(/\b(this card|this reading|the deck|the oracle)\b/gi) || []).length;
    c.systemWord = (
      prose(noRel.replace(/\n## DESIGN[\s\S]*?(?=\n## BODY)/, '')).match(/\b(hexagram|trigram|siddhi|shadow|gift|codon)\b/gi) || []
    ).length;
    perCard.push(c);
  }

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

  const openers = countSubsectionOpeners(cardsDir);
  const subsectionRepeats = findSubsectionOpenerRepeats(cardsDir);

  return { tot, perCard, sharedStems, openers, subsectionRepeats };
}

export function violationsForDeck(cardsDir = 'oracle/cards') {
  const { openers, subsectionRepeats } = analyzeDeck(cardsDir);
  const violations = [];
  if (openers.keysInwardFace > 0) {
    violations.push(`banned KEYS stem "inward face of the Shadow" on ${openers.keysInwardFace} card(s)`);
  }
  for (const repeat of subsectionRepeats) {
    violations.push(`subsection opener on ${repeat.count} cards: ${repeat.key}`);
  }
  return violations;
}

function pct(n, sentences) {
  return sentences ? `${((100 * n) / sentences).toFixed(1)}%` : '0%';
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  const strict = args.includes('--strict');
  const cardsDir = process.env.ORACLE_TELLS_CARDS_DIR ?? 'oracle/cards';
  const only = args.filter((a) => /^\d\d$/.test(a));

  const { tot, perCard, sharedStems, openers, subsectionRepeats } = analyzeDeck(cardsDir, only);

  if (json) {
    console.log(
      JSON.stringify({
        ...tot,
        threeCommasPct: pct(tot.threeCommas, tot.sentences),
        long30Pct: pct(tot.long30, tot.sentences),
        openers,
        subsectionRepeats,
      }),
    );
  } else if (only.length) {
    const stemCards = new Map(sharedStems);
    for (const c of perCard.filter((row) => only.includes(row.card))) {
      const { stems, ...rest } = c;
      console.log(JSON.stringify(rest));
      for (const st of new Set(stems.filter((x) => (stemCards.get(x) || new Set()).size >= 3)))
        console.log(`  shared stem "${st}" on ${stemCards.get(st).size} cards`);
    }
  } else {
    console.log(
      `${tot.cards} cards, ${tot.sentences} sentences. startAnd ${tot.startAnd}, twoAnds ${tot.twoAnds}, notXItIsY ${tot.notXItIsY}, heightOpeners ${tot.heightOpeners}, wayIsTo ${tot.wayIsTo}, thisIsTheEnergy ${tot.thisIsTheEnergy}, systemWord ${tot.systemWord}, itAlso ${tot.itAlso}, cardTalk ${tot.cardTalk}, threeCommas ${tot.threeCommas} (${pct(tot.threeCommas, tot.sentences)}), long30 ${tot.long30} (${pct(tot.long30, tot.sentences)})`,
    );
    console.log(
      `subsection openers: Repressive "This person …" ${openers.repressiveThisPerson}/${openers.cards}, Reactive "Here …" ${openers.reactiveHere}/${openers.cards}, Immortals "stands above" ${openers.immortalsStandsAbove}/${openers.cards}, banned KEYS inward-face ${openers.keysInwardFace}/${openers.cards}`,
    );
    const score = (c) => c.twoAnds + c.startAnd + c.heightOpeners + c.wayIsTo + c.systemWord + c.sharedStems;
    const worst = [...perCard].sort((a, b) => score(b) - score(a)).slice(0, 6);
    console.log('worst: ' + worst.map((c) => `${c.card}(${score(c)})`).join(' '));
    console.log(`shared sentence stems (3+ cards): ${sharedStems.length}`);
    for (const [st, set] of sharedStems.slice(0, 12)) console.log(`  ${set.size}  ${st}`);
    console.log(`shared subsection openers (3+ cards): ${subsectionRepeats.length}`);
    for (const repeat of subsectionRepeats.slice(0, 6)) console.log(`  ${repeat.count}  ${repeat.key}`);
    const clean = perCard.filter((c) => score(c) === 0).map((c) => c.card);
    console.log(`cards with none of the hard tells: ${clean.length} of ${tot.cards}: ${clean.join(' ')}`);
  }

  const violations = violationsForDeck(cardsDir);
  if (strict && violations.length) {
    console.error('oracle-tells: FAIL');
    for (const v of violations) console.error(`  ${v}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
