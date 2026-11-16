import { describe, expect, it } from 'vitest';
import { formatBuildLine, oracleBuildLine } from '../../src/mobile/buildInfo';

describe('Oracle build line', () => {
  it('shows commit and date, with the native build number when known', () => {
    expect(formatBuildLine('a1b2c3d', '2026-11-11T08:30:00.000Z')).toBe('Oracle · a1b2c3d · 11 Nov 2026');
    expect(formatBuildLine('a1b2c3d', '2026-11-11T08:30:00.000Z', '19')).toBe('Oracle · build 19 · a1b2c3d · 11 Nov 2026');
  });

  it('falls back to dev and drops an unreadable date', () => {
    expect(formatBuildLine('', 'not a date')).toBe('Oracle · dev');
    expect(oracleBuildLine()).toMatch(/^Oracle · /);
  });

  it('never uses an em dash', () => {
    expect(formatBuildLine('abc1234', '2026-01-02T00:00:00Z', '3')).not.toContain('—');
  });
});
