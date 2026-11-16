import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repo = fileURLToPath(new URL('../..', import.meta.url));

test('runs the selected-card tells check and fails closed when a checker cannot run', async () => {
  const root = mkdtempSync(join(tmpdir(), 'gate-tells-test-'));
  const put = (name, contents) => { const path = join(root, name); mkdirSync(resolve(path, '..'), { recursive: true }); writeFileSync(path, contents); };
  const run = (script, ...args) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, ORACLE_TELLS_CARDS_DIR: join(root, 'oracle/cards') } });
  const opener = 'The same synthetic opening returns for a third test card.';
  const card = (id, repeated) => `---\ncard_name: Card ${id}\n  shadow: Dread\n  repressive: Withdrawn\n  reactive: Anger\n  centre: "A clear beginning meets the day."\n---\n## CODE\n_Keywords:_ One · Two · Three · Four · Five\nA clear beginning meets the day.\n## ICHING\n### Combination\nAn ordinary event occurs.\n## KEYS\n### Repressive nature — Test\n${repeated ? opener : 'A different opening belongs to this card.'}\n### Reactive nature — Test\nAnother ordinary event occurs for card ${id}.\n## DESIGN\n### The drive\nA body moves toward a choice.\n## BODY\n### Physiology\nA body holds the effect.\n## RELATIONS\n### Immortals\nA separate relation appears for card ${id}.\n`;
  const words = (label) => `${label} describes a distinct and detailed source grounded point for this synthetic worksheet.`;
  const facets = ['Quartz ember lantern canyon', 'River tide marsh current', 'Golden wheat orchard harvest', 'Stone arch quarry granite', 'Silver thread needle garment', 'Forest root canopy moss'];
  const sheet = (id) => `## 1. Placement\n- Neighbours: 5, 6, 7, 8, 9\n- What only this card is: ${words('Only')}\n- The energy word: clarity\n- The card's moment: ${words('Moment')}\n## 2. Facets\n${['CODE','ICHING','KEYS','DESIGN','BODY','RELATIONS'].map((s, i) => `- ${s}: ${facets[i]}`).join('\n')}\n${Array.from({length:20}, (_, i) => `  - source${i}.md: This is a sourced line for the test.`).join('\n')}\n- The one section: CODE\n## 3. Sideways read\n- Repeats found: ${words('Repeats')}\n- Contradictions found: ${words('Contradictions')}\n- The entrance beside: ${words('Entrance')}\n## 4. Reader\n- Returned: ${'The reader offered a detailed independent account of this synthetic card. '.repeat(5)}\n- Card it named: ${id}\n- Verdict: pass\n- What it says the card is about: ${words('Reader')} ${words('Choice')}\n`;
  try {
    symlinkSync(join(repo, 'node_modules'), join(root, 'node_modules'));
    for (const id of ['01', '02', '03', '04']) {
      put(`oracle/cards/${id}.md`, card(id, id !== '04'));
      put(`oracle/worksheets/${id}.md`, sheet(id));
    }
    put('scripts/card-gate.mjs', await (await import('node:fs/promises')).readFile(join(repo, 'scripts/card-gate.mjs'), 'utf8'));
    put('scripts/oracle-tells.mjs', await (await import('node:fs/promises')).readFile(join(repo, 'scripts/oracle-tells.mjs'), 'utf8'));
    put('todo/plans/writing-guideline/sentence-check.mjs', 'process.exit(0);\n');
    put('scripts/lint-entrance.mjs', 'process.exit(0);\n');
    put('scripts/lint-slop.mjs', 'process.exit(0);\n');
    put('scripts/lint-oracle-prose.ts', 'console.log("[lint:prose] checked 4 files.");\n');
    const selected = run('scripts/oracle-tells.mjs', '--strict', '01');
    assert.equal(selected.status, 1, selected.stderr);
    assert.match(selected.stderr, /subsection opener on 3 cards/);
    const unrelated = run('scripts/oracle-tells.mjs', '--strict', '04');
    assert.equal(unrelated.status, 0, unrelated.stderr);
    put('oracle/cards/04.md', card('04', false).replace('A different opening belongs to this card.', 'The inward face of the Shadow appears here.'));
    const bannedStem = run('scripts/oracle-tells.mjs', '--strict', '04');
    assert.equal(bannedStem.status, 1, bannedStem.stderr);
    assert.match(bannedStem.stderr, /banned KEYS stem/);
    put('oracle/cards/04.md', card('04', false));
    const deck = run('scripts/oracle-tells.mjs', '--strict');
    assert.equal(deck.status, 1, deck.stderr);
    const missing = run('scripts/oracle-tells.mjs', '--strict', '05');
    assert.notEqual(missing.status, 0);
    const gateAffected = run('scripts/card-gate.mjs', '01');
    assert.equal(gateAffected.status, 1, gateAffected.stdout + gateAffected.stderr);
    assert.match(gateAffected.stdout, /FAIL  tells check:/);
    const gateUnrelated = run('scripts/card-gate.mjs', '04');
    assert.equal(gateUnrelated.status, 0, gateUnrelated.stdout + gateUnrelated.stderr);
    assert.match(gateUnrelated.stdout, /pass  tells check/);
    assert.doesNotMatch(gateUnrelated.stdout, /FAIL  tells check:/);
    assert.doesNotMatch(gateUnrelated.stdout, /linter failed|tells checker failed/);
    // A completed deck-wide prose lint may exit nonzero for another card.
    put('scripts/lint-oracle-prose.ts', 'console.error("oracle/cards/01.md:12 [em-dash] planted on another card"); console.log("[lint:prose] checked 4 files."); process.exitCode = 1;\n');
    const otherProse = run('scripts/card-gate.mjs', '04');
    assert.equal(otherProse.status, 0, otherProse.stdout + otherProse.stderr);
    assert.match(otherProse.stdout, /pass  prose linter/);
    // A missing prose runner cannot silently pass just because no target finding printed.
    rmSync(join(root, 'scripts/lint-oracle-prose.ts'));
    const brokenProse = run('scripts/card-gate.mjs', '04');
    assert.equal(brokenProse.status, 1);
    assert.match(brokenProse.stdout, /FAIL  prose linter: linter failed before completing:/);
    put('scripts/lint-oracle-prose.ts', 'throw new Error("synthetic prose crash");\n');
    const crashedProse = run('scripts/card-gate.mjs', '04');
    assert.equal(crashedProse.status, 1);
    assert.match(crashedProse.stdout, /FAIL  prose linter: linter failed before completing:/);
    put('scripts/lint-oracle-prose.ts', 'console.log("[lint:prose] checked 4 files.");\n');
    // An unexpected child failure must remain a gate failure, even with no finding marker.
    rmSync(join(root, 'scripts/oracle-tells.mjs'));
    const broken = run('scripts/card-gate.mjs', '04');
    assert.equal(broken.status, 1);
    assert.match(broken.stdout, /FAIL  tells check: tells checker failed:/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
