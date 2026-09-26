// Write cards unattended: one headless Opus writer per card, a few at a time, each in its own
// worktree on claude/card-NN-model from origin/main, following
// todo/plans/writing-guideline/card-writer-brief.md. Wrote cards 3 to 62 on 2026-09-24
// (about $5.70 and 19 minutes a card at API prices, seven at a time).
// Usage: node scripts/card-queue.mjs 10 11 12   [CONCURRENCY=7] [CLAUDE_BIN=claude] [EFFORT=medium]
// Run one card first and have Adrian read it before queueing the rest (CARD-PASS step 6).
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, appendFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const REPO = resolve(execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim());
const COMMON = resolve(REPO, execFileSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf8', cwd: REPO }).trim());
const WORKTREES = join(COMMON, '..', '.claude', 'worktrees');
const CLAUDE = process.env.CLAUDE_BIN || 'claude';
const EFFORT = process.env.EFFORT || 'medium';
const CONCURRENCY = Number(process.env.CONCURRENCY || 7);
const RUNS = join(tmpdir(), 'card-queue');
mkdirSync(RUNS, { recursive: true });
const cards = process.argv.slice(2).map((n) => String(n).padStart(2, '0'));
if (!cards.length) { console.error('usage: node scripts/card-queue.mjs NN [NN ...]'); process.exit(2); }
const status = (s) => { const line = `${new Date().toISOString().slice(11, 19)} ${s}`; appendFileSync(join(RUNS, 'STATUS.txt'), line + '\n'); console.log(line); };

function prepare(nn) {
  const dir = join(WORKTREES, `card-${nn}-model`);
  if (!existsSync(dir)) {
    execFileSync('git', ['-C', REPO, 'fetch', '-q', 'origin', 'main']);
    execFileSync('git', ['-C', REPO, 'worktree', 'add', '-q', '-b', `claude/card-${nn}-model`, dir, 'origin/main']);
  }
  rmSync(join(dir, 'node_modules'), { force: true, recursive: false });
  symlinkSync(join(REPO, 'node_modules'), join(dir, 'node_modules'));
  return dir;
}

function run(nn) {
  return new Promise((done) => {
    let dir;
    try { dir = prepare(nn); } catch (e) { status(`${nn} PREPARE FAILED ${e.message.split('\n')[0]}`); return done(); }
    status(`${nn} start`);
    const prompt = `Read todo/plans/writing-guideline/card-writer-brief.md and follow it exactly. Your card is ${nn}; everywhere it says NN, use ${nn}.`;
    const p = spawn(CLAUDE, ['-p', '--model', 'claude-opus-5-5', '--effort', EFFORT, '--permission-mode', 'acceptEdits',
      '--allowedTools', 'Bash,Read,Edit,Write,Glob,Grep', '--add-dir', join(process.env.HOME, 'Documents/Obsidian Vault'),
      '--add-dir', tmpdir(), '--output-format', 'json', prompt], { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
    let buf = '';
    p.stdout.on('data', (d) => { buf += d; });
    p.stderr.on('data', (d) => { buf += d; });
    p.on('close', () => {
      writeFileSync(join(RUNS, `${nn}.json`), buf);
      let summary = 'no result';
      try { const j = JSON.parse(buf.slice(buf.indexOf('{'))); summary = `${j.is_error ? 'ERROR' : 'ok'} ${Math.round(j.duration_ms / 60000)}min $${(j.total_cost_usd || 0).toFixed(2)}`; } catch {}
      let gate = 'GATE-FAIL';
      try { execFileSync('npm', ['run', '-s', 'card:gate', '--', nn], { cwd: dir, stdio: 'ignore' }); gate = 'gate-pass'; } catch {}
      status(`${nn} done ${summary} ${gate}`);
      done();
    });
  });
}

const queue = [...cards];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (queue.length) await run(queue.shift()); }));
status('ALL DONE');
