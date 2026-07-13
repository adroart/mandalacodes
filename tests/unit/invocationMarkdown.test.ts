import { describe, expect, it } from 'vitest';
import { buildInvocationArtifact, parseInvocationMarkdown, serializeBlocks } from '../../lib/oracle/invocationMarkdown';

describe('invocation Markdown', () => {
  it('accepts constrained prose and safe inline syntax', () => {
    const parsed = parseInvocationMarkdown('## Arrival\n\nBe *still*.\nBreathe.\n\n[Read](https://example.com)');
    expect(parsed.blocks).toHaveLength(3);
    expect(parsed.normalized).toContain('Be *still*.');
  });

  it.each(['<script>alert(1)</script>', '![x](https://example.com/x.png)', '[x](javascript:alert(1))', '# H1', '- list', '---'])('rejects unsafe or unsupported input: %s', (input) => {
    expect(() => parseInvocationMarkdown(input)).toThrow();
  });

  it('serializes ordered blocks and writes stable private artifacts', () => {
    expect(serializeBlocks([
      { id: 'b', kind: 'prose', segmentId: null, markdown: 'Second', sortOrder: 1 },
      { id: 'a', kind: 'segment', segmentId: 'secret', markdown: 'First', sortOrder: 0 },
    ])).toBe('First\n\nSecond');
    const artifact = buildInvocationArtifact({ hexagramNumber: 22, title: 'Grace', versionNumber: 3, artifactId: 'request-a', author: 'admin-1', createdAt: '2026-07-13T01:00:00.000Z', updatedAt: '2026-07-13T01:00:00.000Z', body: 'Be still.' });
    expect(artifact.key).toBe('invocations/22/invocation-22-grace/v000003-request-a.md');
    expect(artifact.contents).toContain('status: live');
    expect(artifact.contents).not.toContain('segment:');
  });

  it('uses distinct artifact keys for concurrent requests targeting the same next version', () => {
    const base = { hexagramNumber: 22, title: 'Grace', versionNumber: 3, author: 'admin-1', createdAt: '2026-07-13T01:00:00.000Z', updatedAt: '2026-07-13T01:00:00.000Z', body: 'Be still.' };
    expect(buildInvocationArtifact({ ...base, artifactId: 'winner' }).key).not.toBe(buildInvocationArtifact({ ...base, artifactId: 'loser' }).key);
  });
});
