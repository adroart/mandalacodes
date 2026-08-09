import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Atlas UI after the ownership move', () => {
  it('does not call retired ownership APIs or expose the retired claim door', async () => {
    const source = await readFile(resolve('components/AtlasPage.tsx'), 'utf8');

    for (const retired of [
      '/api/atlas/steward/claim',
      '/api/atlas/holder-chart',
      'ownedKeys',
      'ownedOnGlobe',
      'to="/atlas/claim"',
      'your light',
      'Showing the last gathered sky',
      'servedFallback',
    ]) {
      expect(source, retired).not.toContain(retired);
    }
  });

  it('renders explicit unavailability on the canonical piece page', async () => {
    const source = await readFile(resolve('components/PiecePage.tsx'), 'utf8');

    expect(source).toContain("{ kind: 'error' }");
    expect(source).toContain('The Atlas record is briefly out of reach.');
  });
});
