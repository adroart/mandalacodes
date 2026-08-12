import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { compileOracleCard, compileParsedCard } from '../../lib/oracle/compiler';
import { legacyCardToBundle, parseYamlRecord, v2BundleFromFiles } from '../../lib/oracle/manuscript-bundle';
import { OracleAuthoringError } from '../../lib/oracle/authoring-error';
import { parseCardMarkdown } from '../../lib/oracle/card-markdown';

describe('Oracle manuscript compiler — strict YAML', () => {
  it('rejects duplicate YAML keys with a repository-relative location', () => {
    expect(() => parseYamlRecord('number: 23\nnumber: 24\n', 'oracle/manuscripts/23/_card.md'))
      .toThrow(OracleAuthoringError);
    try {
      parseYamlRecord('number: 23\nnumber: 24\n', 'oracle/manuscripts/23/_card.md');
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).toMatch(/ORACLE_YAML_INVALID/);
      expect((error as Error).message).toContain('oracle/manuscripts/23/_card.md');
      expect((error as Error).message.toLowerCase()).toMatch(/unique/);
    }
  });

  it('parses folded provenance scalars correctly', () => {
    expect(parseYamlRecord('fact_check: >\n  first line\n  second line\n', 'fixture.md'))
      .toEqual({ fact_check: 'first line second line\n' });
  });

  it('rejects a non-mapping frontmatter root', () => {
    expect(() => parseYamlRecord('- 1\n- 2\n', 'fixture.md')).toThrow(/ORACLE_YAML_ROOT_INVALID/);
  });
});

describe('Oracle manuscript compiler — legacy bundle', () => {
  it('compiles legacy Card 23 through the pure compiler', async () => {
    const file = resolve('oracle/cards/23.md');
    const raw = await readFile(file, 'utf8');
    const result = compileOracleCard(legacyCardToBundle(raw, 'oracle/cards/23.md'), {
      artworks: [],
    });
    expect(result.card).toMatchObject({
      number: 23,
      card_name: 'Beneath the Surface',
      ring_name: 'Ring of Life and Death',
    });
    expect(JSON.stringify(result.card)).not.toMatch(/sourcing_log|fact_check|"status"/i);
    expect(result.editorial.statuses).toEqual({
      code: 'scaffold', iching: 'scaffold', keys: 'scaffold',
      design: 'scaffold', body: 'scaffold', relations: 'scaffold',
    });
  });

  it('compileParsedCard and the legacy bundle path agree for every card', async () => {
    for (const n of [1, 23, 64]) {
      const padded = String(n).padStart(2, '0');
      const file = resolve(`oracle/cards/${padded}.md`);
      const raw = await readFile(file, 'utf8');

      const direct = compileParsedCard(parseCardMarkdown(raw, file), file, []);
      const viaBundle = compileOracleCard(legacyCardToBundle(raw, file), { artworks: [] }).card;

      expect(viaBundle).toEqual(direct);
    }
  });
});

describe('Oracle manuscript compiler — V2 bundle', () => {
  it('rejects an unknown _card.md field', () => {
    const bundle = v2BundleFromFiles(
      23,
      { path: 'oracle/manuscripts/23/_card.md', raw: '---\nschema: oracle-card/v2\nnumber: 23\nbogus: 1\n---\n' },
      {
        code: { path: 'oracle/manuscripts/23/code.md', raw: '---\nschema: oracle-lens/v1\nstatus: scaffold\n---\n## CODE\ntext\n' },
        iching: { path: 'oracle/manuscripts/23/iching.md', raw: '---\nschema: oracle-lens/v1\nstatus: scaffold\n---\n## ICHING\ntext\n' },
        keys: { path: 'oracle/manuscripts/23/keys.md', raw: '---\nschema: oracle-lens/v1\nstatus: scaffold\n---\n## KEYS\ntext\n' },
        design: { path: 'oracle/manuscripts/23/design.md', raw: '---\nschema: oracle-lens/v1\nstatus: scaffold\n---\n## DESIGN\ntext\n' },
        body: { path: 'oracle/manuscripts/23/body.md', raw: '---\nschema: oracle-lens/v1\nstatus: scaffold\n---\n## BODY\ntext\n' },
        relations: { path: 'oracle/manuscripts/23/relations.md', raw: '---\nschema: oracle-lens/v1\nstatus: scaffold\n---\n## RELATIONS\ntext\n' },
      },
    );
    expect(() => compileOracleCard(bundle, { artworks: [] })).toThrow(/ORACLE_CARD_FIELD_UNKNOWN/);
  });

  it('reports a missing required lens file', () => {
    const bundle = v2BundleFromFiles(
      23,
      { path: 'oracle/manuscripts/23/_card.md', raw: '---\nschema: oracle-card/v2\nnumber: 23\n---\n' },
      {} as never,
    );
    expect(() => compileOracleCard(bundle, { artworks: [] })).toThrow(/ORACLE_LENS_FILE_MISSING/);
  });
});
