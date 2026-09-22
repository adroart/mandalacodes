/**
 * Every Playwright spec takes `test` from tests/fixtures.ts, which answers all
 * production media requests locally. A spec that imports '@playwright/test'
 * directly bypasses that and spends metered R2 operations.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Playwright specs stay off production media', () => {
  it('every spec imports test from the shared fixtures, never from @playwright/test', () => {
    const dir = resolve(process.cwd(), 'tests');
    const specs = readdirSync(dir).filter((f) => f.endsWith('.spec.ts'));
    expect(specs.length).toBeGreaterThan(0);
    const offenders = specs.filter((f) =>
      /import\s*\{[^}]*\btest\b[^}]*\}\s*from\s*'@playwright\/test'/.test(readFileSync(resolve(dir, f), 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('the fixture answers /media itself', () => {
    const source = readFileSync(resolve(process.cwd(), 'tests/fixtures.ts'), 'utf8');
    expect(source).toContain('\\/media\\/');
    expect(source).toContain('route.fulfill');
  });
});
