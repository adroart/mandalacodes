/**
 * Unit tests for scripts/oracle-tells.mjs — subsection opener counts and the
 * strict gate on a planted repeat.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it, afterEach } from 'vitest';
import {
  countSubsectionOpeners,
  findSubsectionOpenerRepeats,
  violationsForDeck,
} from '../../scripts/oracle-tells.mjs';

const PLANTED_OPENER =
  'Test Immortal stands above, planted on purpose so the counter can prove it goes red.';

function cardBody(immortalsParagraph: string): string {
  return `---
number: 1
---

## CODE
One paragraph about the code for testing.

## ICHING
### Combination
Wind over wind.

## KEYS
### Repressive nature — Test
A repressive paragraph without the formula.

### Reactive nature — Test
Reactive paragraph without the formula.

## DESIGN
### The drive
Drive text.

## BODY
### Physiology
Body text.

## RELATIONS
### Immortals
${immortalsParagraph}
`;
}

describe('oracle-tells subsection openers', () => {
  it('measures live deck opener counts including RELATIONS', () => {
    const openers = countSubsectionOpeners();
    expect(openers.cards).toBe(64);
    expect(openers.keysInwardFace).toBe(0);
    expect(openers.repressiveThisPerson).toBe(41);
    expect(openers.reactiveHere).toBe(26);
    expect(openers.immortalsStandsAbove).toBe(49);
  });

  describe('planted repeat', () => {
    let tempDir = '';

    afterEach(() => {
      if (tempDir) rmSync(tempDir, { force: true, recursive: true });
    });

    it('reports a shared subsection opener on three planted cards', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'oracle-tells-'));
      for (const id of ['01', '02', '03']) {
        writeFileSync(join(tempDir, `${id}.md`), cardBody(PLANTED_OPENER));
      }
      const repeats = findSubsectionOpenerRepeats(tempDir);
      expect(repeats.some((r) => r.count >= 3 && r.key.includes(PLANTED_OPENER))).toBe(true);
      expect(violationsForDeck(tempDir).length).toBeGreaterThan(0);
    });

    it('goes red with --strict on a planted repeat', () => {
      tempDir = mkdtempSync(join(tmpdir(), 'oracle-tells-'));
      for (const id of ['01', '02', '03']) {
        writeFileSync(join(tempDir, `${id}.md`), cardBody(PLANTED_OPENER));
      }
      const result = spawnSync(process.execPath, ['scripts/oracle-tells.mjs', '--strict'], {
        cwd: process.cwd(),
        env: { ...process.env, ORACLE_TELLS_CARDS_DIR: tempDir },
        encoding: 'utf8',
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('oracle-tells: FAIL');
      expect(result.stderr).toContain('subsection opener on 3 cards');
    });
  });
});
