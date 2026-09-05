import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

describe('GitHub Actions test workflow policy', () => {
  it('avoids duplicate feature-branch runs and cancels superseded work', () => {
    const source = readFileSync(resolve('.github/workflows/test.yml'), 'utf8');
    const workflow = parse(source);

    expect(workflow.on.push).toEqual({ branches: ['main'] });
    expect(workflow.on).toHaveProperty('pull_request');
    expect(workflow.concurrency).toEqual({
      group: 'test-${{ github.event.pull_request.number || github.ref }}',
      'cancel-in-progress': true,
    });
    expect(workflow.jobs.test['timeout-minutes']).toBe(15);
  });
});
