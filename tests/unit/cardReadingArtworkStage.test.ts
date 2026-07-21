import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(
  resolve(process.cwd(), 'components/oracle/reading/card-reading-fullbleed.css'),
  'utf8',
);

describe('card reading artwork stage', () => {
  it('lets the artwork sit directly on the reading surface without card chrome', () => {
    expect(styles).toMatch(
      /\.card-reading\s+:has\(>\s*\[data-artparallax\]\)\s*\{[^}]*background:\s*transparent\s*!important;[^}]*border-radius:\s*0\s*!important;[^}]*box-shadow:\s*none\s*!important;/s,
    );
  });
});
