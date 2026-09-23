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
 *   1. FRAMEWORK  oracle/worksheets/NN.md exists (template: oracle/WORKSHEET.md)
 *                 and parts 1 to 3 are filled: the energy whole, thirty or more
 *                 true things with their sources, and the allotment.
 *   2. SHADOW     the entrance's first sentence, CODE's first sentence and the
 *                 keynotes do not name the energy by its shadow or either of its
 *                 natures, and CODE says the shadow word at most twice. The
 *                 shadow is one height of the energy, never the energy.
 *   3. CHECKS     the four existing checks (sentences, prose openers, entrance
 *                 shape, slop) pass, and part 4 of the worksheet answers every
 *                 reader check with a quoted sentence, plus a cold reader's pass.
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

// ---- 1 + 3b. the worksheet -------------------------------------------------
if (!existsSync(sheetPath)) {
  fails.push(`worksheet: ${sheetPath} is missing. Copy the block in oracle/WORKSHEET.md and fill parts 1 to 3 BEFORE writing.`);
} else {
  const ws = readFileSync(sheetPath, 'utf8');
  const part = (n) => (ws.match(new RegExp(`^## ${n}\\.[^\\n]*\\n([\\s\\S]*?)(?=^## \\d\\.|$(?![\\s\\S]))`, 'm')) || [, ''])[1];
  const bullets = (t) => t.split('\n').filter((l) => /^- /.test(l));

  const p1 = part(1);
  const e1 = bullets(p1).filter((l) => /:\s*$/.test(l));
  check('framework: the energy whole', bullets(p1).length >= 7 && !e1.length, e1.length ? `unfilled: ${e1.join(' | ')}` : 'part 1 missing');
  const energyLine = (p1.match(/^- The word a person[^:]*:\s*(.+)$/m) || [, ''])[1];
  check('framework: the entrance word is not the shadow', energyLine && !shadowIn(energyLine.split(/[,.(]/)[0]).length,
    `"${energyLine}" is the shadow`);

  const truths = bullets(part(2)).filter((l) => /\S{3,}.*\S+\.(md|json)\b/.test(l));
  check('framework: thirty true things with sources', truths.length >= 30, `${truths.length} lines carry a source file`);

  const p3 = part(3);
  const e3 = bullets(p3).filter((l) => /:\s*$/.test(l));
  check('framework: the allotment', bullets(p3).length >= 7 && !e3.length, e3.length ? `unfilled: ${e3.join(' | ')}` : 'part 3 missing');

  const p4 = part(4);
  const reader = (p4.split(/^### Cold reader/m)[0] || '');
  const rb = bullets(reader);
  const weak = rb.filter((l) => { const a = l.replace(/^- [^:]*:\s*/, ''); return a.length < 20 || !/["“”]/.test(a); });
  check('checks: every reader check answered with a quoted sentence', rb.length >= 26 && !weak.length,
    `${weak.length} of ${rb.length} unanswered or unquoted: ${weak.slice(0, 3).map((l) => l.split(':')[0]).join(' | ')}`);
  const cold = (p4.split(/^### Cold reader/m)[1] || '');
  const verdict = (cold.match(/^- Verdict[^:]*:\s*(.+)$/m) || [, ''])[1];
  const returned = (cold.match(/^- Returned:\s*([\s\S]+?)^- Could not/m) || [, ''])[1];
  check('checks: the cold reader passed', /\bpass/i.test(verdict) && returned.trim().length > 200,
    verdict ? `verdict "${verdict}", returned ${returned.trim().length} chars` : 'no cold reader verdict');
}

for (const p of passes) console.log(`  pass  ${p}`);
for (const f of fails) console.log(`  FAIL  ${f}`);
console.log(`\ncard ${id} ${title}: ${fails.length ? `${fails.length} failing, not ready` : 'through the gate'}`);
process.exit(fails.length ? 1 : 0);
