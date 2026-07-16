import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'components/oracle/entry/_src/Oracle Entry.dc.html'), 'utf8');
const generated = readFileSync(resolve(process.cwd(), 'components/oracle/entry/generated/OracleEntry.generated.tsx'), 'utf8');

describe('Oracle Entry card navigation', () => {
  it('does not retain the obsolete preview reading prompt', () => {
    expect(source).not.toContain('Enter the reading');
    expect(generated).not.toContain('Enter the reading');
  });

  it('does not render a second preview lightbox', () => {
    expect(source).not.toContain('Reading lightbox');
    expect(generated).not.toContain('vals.reading');
  });
});
