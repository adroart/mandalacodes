import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('Atlas genesis archival script', () => {
  it('hard-fails --write and contains no production R2 put path', async () => {
    const script = resolve('scripts/genesis-all-pieces.ts');
    const source = await readFile(script, 'utf8');
    const attempt = spawnSync(resolve('node_modules/.bin/tsx'), [script, '--write'], {
      encoding: 'utf8',
    });

    expect(source).not.toContain('writeLedgerToR2');
    expect(source).not.toContain("'object', 'put'");
    expect(attempt.status).not.toBe(0);
    expect(attempt.stderr).toContain('--write is permanently disabled');
    expect(attempt.stdout).not.toContain('Reading mandalacodes-atlas');
  });
});
