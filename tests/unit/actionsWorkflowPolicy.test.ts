import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

describe('GitHub Actions test workflow policy', () => {
  it('avoids duplicate feature-branch runs and cancels superseded work', () => {
    const source = readFileSync(resolve('.github/workflows/test.yml'), 'utf8');
    const workflow = parse(source);

    const docsOnly = ['*.md', 'docs/**', 'todo/**'];
    expect(workflow.on.push).toEqual({ branches: ['main'], 'paths-ignore': docsOnly });
    expect(workflow.on.pull_request).toEqual({ 'paths-ignore': docsOnly });
    expect(workflow.concurrency).toEqual({
      group: 'test-${{ github.event.pull_request.number || github.ref }}',
      'cancel-in-progress': true,
    });
    expect(workflow.jobs.test['timeout-minutes']).toBe(15);
  });

  it('skips a push to main that merges a PR head this workflow already passed', () => {
    /* September 2026: 81 of 136 runs were pushes to main, most of them merges
       of PRs whose head had just passed the same suite with the same tree.
       The gate proves that (merge commit, identical tree, green run on the
       head) and the real jobs wait on it. A direct push still runs everything. */
    const source = readFileSync(resolve('.github/workflows/test.yml'), 'utf8');
    const workflow = parse(source);

    expect(workflow.jobs.gate).toBeDefined();
    expect(workflow.jobs.gate['timeout-minutes']).toBeLessThanOrEqual(5);
    const gateRun = workflow.jobs.gate.steps.map((s: { run?: string }) => s.run ?? '').join('\n');
    expect(gateRun).toContain("git rev-parse 'HEAD^{tree}'");
    expect(gateRun).toContain('gh run list --workflow=');
    for (const name of Object.keys(workflow.jobs).filter((n) => n !== 'gate')) {
      expect(workflow.jobs[name].needs, name).toBe('gate');
      expect(workflow.jobs[name].if, name).toContain("needs.gate.outputs.run == 'true'");
    }
  });
});
