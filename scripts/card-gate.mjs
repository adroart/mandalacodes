#!/usr/bin/env node
/**
 * The card gate: one command a card must pass before it is committed.
 * Adrian, 2026-09-23: "The frameworking that everything has to be ran through is
 * not optional. And then the checking after is also not optional."
 *
 * Card 63 went out with every script green and its energy named by its shadow.
 * The scripts only ran what a script can decide, the lint's own list of felt
 * words includes doubt, confusion and fear, and nothing required the reader
 * checks to be done at all. This gate closes those three gaps:
 *
 *   1. SHEET      oracle/worksheets/NN.md exists (template: oracle/WORKSHEET.md),
 *                 per the six steps of oracle/CARD-PASS.md: the card placed among
 *                 five to eight neighbours from the entrance openings, what only
 *                 this card is, six facets that differ from each other with the
 *                 true things filed under them, the sideways read, and a fresh
 *                 reader who named this card and found no repeats.
 *   2. SHADOW     the entrance's first sentence, CODE's first sentence and the
 *                 keynotes do not name the energy by its shadow or either of its
 *                 natures, and CODE says the shadow word at most twice.
 *   3. CHECKS     the sentence script, prose openers, entrance shape and slop.
 *
 * Rewritten 2026-09-23 with the method (Adrian: "The templates are not just a
 * pass or fail, but they need to be used in the creation of the assimilation of
 * all the information"). Locked with it: see the top of oracle/CARD-PASS.md.
 *
 * Usage: npm run card:gate -- 63        Exit 1 on any failure.
 */
import { readFileSync, existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const id = String(process.argv[2] || '').padStart(2, '0');
if (!/^\d\d$/.test(id)) { console.error('usage: npm run card:gate -- NN'); process.exit(2); }
const cardPath = `oracle/cards/${id}.md`;
const sheetPath = `oracle/worksheets/${id}.md`;
const raw = readFileSync(cardPath, 'utf8');

const fails = [];
const passes = [];
const check = (name, ok, why) => (ok ? passes.push(name) : fails.push(`${name}: ${why}`));

const field = (k) => ((raw.match(new RegExp(`^\\s+${k}:\\s*(.+)$`, 'm')) || [])[1] || '').trim();
const title = ((raw.match(/^card_name:\s*(.+)$/m) || [])[1] || '').trim();
const centre = (raw.match(/^\s{2}centre:\s*"([^"]*)"/m) || [, ''])[1];
const code = (raw.match(/^## CODE\n([\s\S]*?)\n## /m) || [, ''])[1];
const keynotes = ((code.match(/^_Keywords:_\s*(.+)$/m) || [, ''])[1]).split('·').map((s) => s.trim()).filter(Boolean);
const codeProse = code.replace(/^_Keywords:_.*$/m, '').trim();
const firstSentence = (t) => (t.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/)[0] || '');

// ---- 2. SHADOW -------------------------------------------------------------
const shadowWords = [field('shadow'), field('repressive'), field('reactive')].filter(Boolean);
const stems = shadowWords.flatMap((w) => w.toLowerCase().split(/[\s-]+/))
  .filter((t) => t.length > 3 && !['self'].includes(t))
  .map((t) => t.replace(/(ness|ing|ion|ed|s)$/, '').slice(0, Math.max(4, t.length - 3)));
const shadowIn = (s) => stems.filter((st) => new RegExp(`\\b${st}`, 'i').test(s));

check('entrance does not open on the shadow', !shadowIn(firstSentence(centre)).length,
  `"${firstSentence(centre)}" names ${shadowWords.join('/')}, which is the shadow, not the energy`);
check('CODE does not open on the shadow', !shadowIn(firstSentence(codeProse)).length,
  `"${firstSentence(codeProse)}" names the shadow`);
const codeCount = stems.reduce((n, st) => n + (codeProse.match(new RegExp(`\\b${st}\\w*`, 'gi')) || []).length, 0);
check('CODE is the whole energy', codeCount <= 2,
  `CODE names ${shadowWords.join('/')} ${codeCount} times; at most 2, the rest belongs to KEYS`);
check('keynotes: five to seven', keynotes.length >= 5 && keynotes.length <= 7, `${keynotes.length} keynotes`);
const longKey = keynotes.filter((k) => k.split(/\s+/).length > 5);
check('keynotes: five words at most', !longKey.length, longKey.join(' | '));
const shadowKeys = keynotes.filter((k) => shadowIn(k).length);
check('keynotes: shadow in one at most', shadowKeys.length <= 1, shadowKeys.join(' | '));

// ---- 3a. the existing checks ----------------------------------------------
const run = (args) => { try { return { ok: true, out: execFileSync('node', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; } catch (e) { return { ok: false, out: (e.stdout || '') + (e.stderr || '') }; } };
const sc = run(['todo/plans/writing-guideline/sentence-check.mjs', cardPath]);
check('sentence check', sc.ok, ((sc.out.match(/\d+ gating/) || ['failed'])[0]));
const dir = mkdtempSync(join(tmpdir(), 'gate-'));
const ent = join(dir, 'entrance.txt');
writeFileSync(ent, `${id} · ${title}\n${centre}\n`);
const le = run(['scripts/lint-entrance.mjs', ent]);
check('entrance shape', le.ok, le.out.trim().split('\n').slice(0, 4).join(' / '));
const ls = run(['scripts/lint-slop.mjs', ent]);
check('entrance slop', ls.ok, ls.out.trim().split('\n').slice(0, 2).join(' / '));
const lp = run(['--import', 'tsx', 'scripts/lint-oracle-prose.ts']);
const mine = lp.out.split('\n').filter((l) => l.includes(`${id}.md`));
check('prose linter', !mine.length, mine.slice(0, 3).join(' / '));

// ---- 1. the sheet --------------------------------------------------------
if (!existsSync(sheetPath)) {
  fails.push(`sheet: ${sheetPath} is missing. Copy the block in oracle/WORKSHEET.md and follow oracle/CARD-PASS.md step 1 before writing.`);
} else {
  const ws = readFileSync(sheetPath, 'utf8');
  const part = (n) => (ws.match(new RegExp(`^## ${n}\\.[^\\n]*\\n([\\s\\S]*?)(?=^## \\d\\.|$(?![\\s\\S]))`, 'm')) || [, ''])[1];
  const line = (t, label) => ((t.match(new RegExp(`^- ${label}[^:]*:[ \\t]*(.*)$`, 'm')) || [, ''])[1] || '').trim();
  const words = (t) => new Set(t.toLowerCase().match(/[a-z']{4,}/g) || []);
  const overlap = (x, y) => { const A = words(x), B = words(y); const n = [...A].filter((w) => B.has(w)).length; return n / Math.max(1, Math.min(A.size, B.size)); };

  const p1 = part(1);
  const neighbours = (line(p1, 'Neighbours').match(/\b\d{1,2}\b/g) || []).filter((n) => +n >= 1 && +n <= 64 && +n !== +id);
  check('step 1: placed among five to eight neighbours', neighbours.length >= 5 && neighbours.length <= 8, `${neighbours.length} neighbour numbers found`);
  const only = line(p1, 'What only this card is');
  check('step 1: what only this card is', only.length > 30, 'missing');
  const word = line(p1, 'The energy word');
  check('step 1: the energy word is not the shadow', word && !shadowIn(word.split(/[,.(]/)[0]).length, word ? `"${word}" is the shadow` : 'missing');
  check("step 1: the card's moment is named", line(p1, "The card's moment").length > 20, "missing: the situation in a life, in the hexagram's plain words, which CODE opens on");

  const p2 = part(2);
  const secs = ['CODE', 'ICHING', 'KEYS', 'DESIGN', 'BODY', 'RELATIONS'];
  const facet = Object.fromEntries(secs.map((k) => [k, line(p2, k)]));
  const empty = secs.filter((k) => facet[k].length < 20);
  check('step 2: six facets', !empty.length, `unfilled: ${empty.join(', ')}`);
  const same = [];
  for (let i = 0; i < secs.length; i++) for (let j = i + 1; j < secs.length; j++)
    if (facet[secs[i]] && facet[secs[j]] && overlap(facet[secs[i]], facet[secs[j]]) >= 0.5) same.push(`${secs[i]}~${secs[j]}`);
  const echo = secs.filter((k) => facet[k] && only && overlap(facet[k], only) >= 0.6);
  check('step 2: the six facets differ', !empty.length && !same.length && !echo.length,
    [same.length && `too alike: ${same.join(', ')}`, echo.length && `restates what only this card is: ${echo.join(', ')}`].filter(Boolean).join('; '));
  const truths = p2.split('\n').filter((l) => /^\s+- \S.*\S+\.(md|json)\b/.test(l));
  check('step 2: true things filed under facets', truths.length >= 20, `${truths.length} sourced lines under the facets`);
  check('step 2: the obvious thing has one home', line(p2, 'The one section').length > 3, 'missing');

  const p3 = part(3);
  check('step 4: the sideways read', line(p3, 'Repeats found').length > 20 && line(p3, 'Contradictions found').length > 20 && line(p3, 'The entrance beside').length > 20, 'unfilled (repeats, contradictions and the entrance beside the neighbours)');

  const p4 = part(4);
  const returned = line(p4, 'Returned');
  const named = line(p4, 'Card it named');
  const verdict = line(p4, 'Verdict');
  const about = line(p4, 'What it says the card is about');
  check('step 6: the reader said what the card is about and why the energy belongs to its name', about.length > 60, about ? `only ${about.length} chars` : 'missing');
  check('step 6: the fresh reader named this card', new RegExp(`\\b0*${+id}\\b`).test(named) || (title && named.toLowerCase().includes(title.toLowerCase())), named ? `it named "${named}"` : 'missing');
  check('step 6: the fresh reader passed', /^pass\b/i.test(verdict) && returned.length > 200, verdict ? `verdict "${verdict}", returned ${returned.length} chars` : 'no verdict');
}

for (const p of passes) console.log(`  pass  ${p}`);
for (const f of fails) console.log(`  FAIL  ${f}`);
console.log(`\ncard ${id} ${title}: ${fails.length ? `${fails.length} failing, not ready` : 'through the gate'}`);
process.exit(fails.length ? 1 : 0);
