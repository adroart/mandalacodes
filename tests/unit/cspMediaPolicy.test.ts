import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const headers = readFileSync(resolve(process.cwd(), 'public/_headers'), 'utf8');

describe('production media policy', () => {
  it('permits locally selected song blobs', () => {
    const mediaSource = headers.match(/media-src\s+([^;]+)/)?.[1] ?? '';
    expect(mediaSource).toMatch(/(?:^|\s)blob:(?:\s|$)/);
  });

  it('permits microphone-driven shows', () => {
    const permissionsPolicy = headers.match(/Permissions-Policy:\s*([^\n]+)/)?.[1] ?? '';
    expect(permissionsPolicy).not.toMatch(/(?:^|,)\s*microphone=\(\)/);
  });
});
