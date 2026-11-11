import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { checkManifest, currentHead } from '../scripts/check-oracle-build.mjs';

const head = 'a'.repeat(40);
const script = new URL('../scripts/check-oracle-build.mjs', import.meta.url).pathname;

test('a current, clean bundle with accounts passes', () => {
  assert.equal(checkManifest({ accounts: true, commit: head, dirty: false, builtAt: 'x' }, head), '');
});

test('a bundle built from uncommitted changes, or one that does not say, is refused in one line', () => {
  for (const manifest of [{ accounts: true, commit: head, dirty: true }, { accounts: true, commit: head }]) {
    const message = checkManifest(manifest, head);
    assert.match(message, /uncommitted changes\. Commit or discard them, then run: VITE_ORACLE_NATIVE_ACCOUNTS=true npm run build:oracle/);
    assert.equal(message.includes('\n'), false);
  }
});

test('a missing manifest, accounts false, or another commit each fail with the command to run', () => {
  for (const manifest of [null, { accounts: false, commit: head }, { commit: head }, { accounts: true, commit: 'b'.repeat(40) }]) {
    const message = checkManifest(manifest, head);
    assert.match(message, /Run: VITE_ORACLE_NATIVE_ACCOUNTS=true npm run build:oracle/);
    assert.equal(message.includes('\n'), false);
  }
  assert.match(checkManifest({ accounts: true, commit: head }, ''), /git/);
});

test('the command line exits nonzero on a bad manifest, and only warns with --warn', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oracle-guard-'));
  const manifest = path.join(dir, 'oracle-build.json');
  const run = (...args) => spawnSync(process.execPath, [script, '--manifest', manifest, ...args], { encoding: 'utf8' });
  assert.equal(run().status, 1);
  assert.match(run().stderr, /^Error: .*missing/);
  const warn = run('--warn');
  assert.equal(warn.status, 0);
  assert.match(warn.stderr, /^Warning: /);
  fs.writeFileSync(manifest, JSON.stringify({ accounts: false, commit: 'x' }));
  assert.equal(run().status, 1);
  const real = currentHead(path.dirname(script));
  if (real) {
    fs.writeFileSync(manifest, JSON.stringify({ accounts: true, commit: real, dirty: false }));
    const ok = run();
    assert.equal(ok.status, 0);
    assert.equal(ok.stderr, '');
    // Built from uncommitted changes: the device path refuses, the simulator path only warns.
    fs.writeFileSync(manifest, JSON.stringify({ accounts: true, commit: real, dirty: true }));
    const dirty = run();
    assert.equal(dirty.status, 1);
    assert.match(dirty.stderr, /^Error: .*uncommitted changes\. Commit or discard them/);
    assert.equal(dirty.stderr.trim().includes('\n'), false);
    const simulator = run('--warn');
    assert.equal(simulator.status, 0);
    assert.match(simulator.stderr, /^Warning: .*uncommitted changes/);
  }
});
