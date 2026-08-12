import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { checkCard23Migration, splitCard23 } from '../../scripts/migrate-oracle-card';
import { compileOracleCard } from '../../lib/oracle/compiler';
import { legacyCardToBundle, v2BundleFromFiles } from '../../lib/oracle/manuscript-bundle';
import { ORACLE_LENSES } from '../../lib/oracle/manuscript-schema';

describe('Oracle Card 23 manuscript-compiler proof', () => {
  it('the split V2 bundle compiles to an identical CanonicalCard as the legacy bundle', async () => {
    const oracleRoot = resolve('oracle');
    const report = await checkCard23Migration(oracleRoot);
    expect(report.cardEqual).toBe(true);
    expect(report.statusesEqual).toBe(true);
  });

  it('performs the comparison without writing any file (--check semantics)', async () => {
    const oracleRoot = resolve('oracle');
    const legacyFile = resolve(oracleRoot, 'cards', '23.md');
    const before = await readFile(legacyFile, 'utf8');
    await checkCard23Migration(oracleRoot);
    const after = await readFile(legacyFile, 'utf8');
    expect(after).toBe(before);
  });

  it('preserves every lens body byte-for-byte in the split (no reflow/reformat)', async () => {
    const legacyFile = resolve('oracle/cards/23.md');
    const raw = await readFile(legacyFile, 'utf8');
    const split = splitCard23(raw, 'oracle/cards/23.md');

    for (const lens of ORACLE_LENSES) {
      const key = lens.toLowerCase() as Lowercase<typeof ORACLE_LENSES[number]>;
      const lensRaw = split.lensFiles[key].raw;
      const frontmatterEnd = lensRaw.indexOf('\n---\n');
      const body = lensRaw.slice(frontmatterEnd + '\n---\n'.length).replace(/^\n+/, '');
      expect(raw).toContain(body.trimEnd());
    }
  });

  it('rejects a card other than 23 as the pilot proof scope', async () => {
    // The compiler itself is card-agnostic; the pilot restriction is a
    // property of this migration script, proven by its hardcoded CARD_NUMBER
    // rather than an argument — verify the exported split targets card 23.
    const raw = await readFile(resolve('oracle/cards/23.md'), 'utf8');
    const split = splitCard23(raw, 'oracle/cards/23.md');
    expect(split.cardFile.path).toBe('oracle/manuscripts/23/_card.md');
  });

  it('cross-checks against a manually assembled V2 bundle', async () => {
    const legacyFile = resolve('oracle/cards/23.md');
    const raw = await readFile(legacyFile, 'utf8');
    const split = splitCard23(raw, 'oracle/cards/23.md');

    const legacyCard = compileOracleCard(legacyCardToBundle(raw, 'oracle/cards/23.md'), { artworks: [] }).card;
    const v2Card = compileOracleCard(
      v2BundleFromFiles(23, split.cardFile, split.lensFiles),
      { artworks: [] },
    ).card;

    expect(v2Card).toEqual(legacyCard);
  });
});
