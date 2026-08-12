/**
 * Card 23 manuscript-compiler proof.
 *
 * Splits `oracle/cards/23.md` into a target `oracle/manuscripts/23/` +
 * `oracle/editorial/23/` bundle, WITHOUT touching or archiving the legacy
 * file and WITHOUT wiring the new source into the runtime corpus loader.
 * `oracle/cards/23.md` stays the one active, live source for Card 23; the
 * split output exists purely to prove the compiler produces an identical
 * `CanonicalCard` from either layout.
 *
 * This is the pilot proof case from the editorial lifecycle design, not the
 * full Task 8 migration script (dual-layout resolution / legacy archival /
 * the WordForge readiness gate are a later stage — see the plan's stop
 * conditions).
 *
 * Modes:
 *   --check   Read-only. Builds both bundles in memory, compiles both,
 *             reports whether they agree. Writes nothing.
 *   --write   Same comparison, then writes the split files to
 *             oracle/manuscripts/23/ and oracle/editorial/23/ for review.
 *             Leaves oracle/cards/23.md untouched and does not change what
 *             the live corpus loader reads.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stringify } from 'yaml';

import { compileOracleCard } from '../lib/oracle/compiler';
import { parseCardMarkdown } from '../lib/oracle/card-markdown';
import { legacyCardToBundle, v2BundleFromFiles } from '../lib/oracle/manuscript-bundle';
import { ORACLE_LENSES, type ManuscriptFile, type OracleManuscriptBundle } from '../lib/oracle/manuscript-schema';

const CARD_NUMBER = 23;

interface SplitResult {
  cardFile: ManuscriptFile;
  lensFiles: Record<Lowercase<typeof ORACLE_LENSES[number]>, ManuscriptFile>;
  editorialFiles: Record<string, string>; // relative filename -> content
}

function splitLegacyBody(raw: string, file: string): Record<string, string> {
  const normalized = raw.replace(/\r\n?/g, '\n');
  const match = normalized.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  if (!match) throw new Error(`${file}: missing YAML frontmatter`);
  const body = match[1].replace(/^#\s+.*\n+/, ''); // drop the "# UL 23 — Title" line

  const chunks = body.split(/\n(?=## )/g).filter(chunk => chunk.trim() !== '');
  const byHeading: Record<string, string> = {};
  for (const chunk of chunks) {
    const heading = chunk.match(/^##\s+(.+)$/m);
    if (!heading) continue;
    byHeading[heading[1].trim()] = chunk.replace(/\s+$/, '') + '\n';
  }
  return byHeading;
}

export function splitCard23(raw: string, file: string): SplitResult {
  const parsedLegacy = parseCardMarkdown(raw, file);
  const fm = parsedLegacy.frontmatter;
  const statusMap = fm.status as Record<string, string>;
  const sectionsByHeading = splitLegacyBody(raw, file);

  const cardFrontmatter = {
    schema: 'oracle-card/v2',
    number: fm.number,
    card_name: fm.card_name,
    hexagram_name: fm.hexagram_name,
    trigrams: fm.trigrams,
    gene_keys: fm.gene_keys,
    human_design: fm.human_design,
    body: fm.body,
    relations: fm.relations_data,
    iching_lines: fm.iching_lines,
  };

  const cardFile: ManuscriptFile = {
    path: 'oracle/manuscripts/23/_card.md',
    raw: `---\n${stringify(cardFrontmatter)}---\n`,
  };

  const lensFiles = {} as SplitResult['lensFiles'];
  for (const lens of ORACLE_LENSES) {
    const key = lens.toLowerCase() as Lowercase<typeof ORACLE_LENSES[number]>;
    const sectionBody = sectionsByHeading[lens];
    if (!sectionBody) throw new Error(`${file}: could not locate section ## ${lens} for the split`);

    const lensFrontmatter = { schema: 'oracle-lens/v1', status: statusMap[key] };
    lensFiles[key] = {
      path: `oracle/manuscripts/23/${key}.md`,
      raw: `---\n${stringify(lensFrontmatter)}---\n\n${sectionBody}`,
    };
  }

  const meta = fm.meta as { sourcing_log?: Record<string, string[]>; fact_check?: string; generated?: string } | undefined;
  const editorialFiles: Record<string, string> = {
    'CARD.md': [
      '---',
      'schema: oracle-migration-receipt/v1',
      'kind: card',
      `card: ${CARD_NUMBER}`,
      `migrated_from: oracle/cards/23.md`,
      `legacy_generated_marker: ${JSON.stringify(meta?.generated ?? null)}`,
      '---',
      '',
      '## Fact check (imported from legacy meta.fact_check)',
      '',
      meta?.fact_check?.trim() ?? '_none recorded_',
      '',
    ].join('\n'),
  };
  for (const lens of ORACLE_LENSES) {
    const key = lens.toLowerCase();
    const log = meta?.sourcing_log?.[key] ?? [];
    editorialFiles[`${lens}.md`] = [
      '---',
      'schema: oracle-migration-receipt/v1',
      'kind: lens',
      `card: ${CARD_NUMBER}`,
      `lens: ${lens}`,
      '---',
      '',
      '## Sourcing log (imported from legacy meta.sourcing_log)',
      '',
      ...(log.length > 0 ? log.map(entry => `- ${entry}`) : ['_none recorded_']),
      '',
    ].join('\n');
  }

  return { cardFile, lensFiles, editorialFiles };
}

function buildV2Bundle(split: SplitResult): OracleManuscriptBundle {
  return v2BundleFromFiles(CARD_NUMBER, split.cardFile, split.lensFiles);
}

export async function checkCard23Migration(oracleRoot: string): Promise<{
  cardEqual: boolean;
  statusesEqual: boolean;
  diff?: string;
}> {
  const legacyFile = resolve(oracleRoot, 'cards', '23.md');
  const raw = await readFile(legacyFile, 'utf8');

  const legacyBundle = legacyCardToBundle(raw, 'oracle/cards/23.md');
  const legacyResult = compileOracleCard(legacyBundle, { artworks: [] });

  const split = splitCard23(raw, 'oracle/cards/23.md');
  const v2Bundle = buildV2Bundle(split);
  const v2Result = compileOracleCard(v2Bundle, { artworks: [] });

  const legacyJson = JSON.stringify(legacyResult.card);
  const v2Json = JSON.stringify(v2Result.card);

  return {
    cardEqual: legacyJson === v2Json,
    statusesEqual: JSON.stringify(legacyResult.editorial.statuses) === JSON.stringify(v2Result.editorial.statuses),
    diff: legacyJson === v2Json ? undefined : `legacy=${legacyJson}\nv2=${v2Json}`,
  };
}

async function writeCard23Split(oracleRoot: string): Promise<void> {
  const legacyFile = resolve(oracleRoot, 'cards', '23.md');
  const raw = await readFile(legacyFile, 'utf8');
  const split = splitCard23(raw, 'oracle/cards/23.md');

  const manuscriptsDir = resolve(oracleRoot, 'manuscripts', '23');
  const editorialDir = resolve(oracleRoot, 'editorial', '23');
  await mkdir(manuscriptsDir, { recursive: true });
  await mkdir(editorialDir, { recursive: true });

  await writeFile(resolve(manuscriptsDir, '_card.md'), split.cardFile.raw, 'utf8');
  for (const lens of ORACLE_LENSES) {
    const key = lens.toLowerCase() as Lowercase<typeof ORACLE_LENSES[number]>;
    await writeFile(resolve(manuscriptsDir, `${key}.md`), split.lensFiles[key].raw, 'utf8');
  }
  for (const [name, content] of Object.entries(split.editorialFiles)) {
    await writeFile(resolve(editorialDir, name), content, 'utf8');
  }
}

async function main() {
  const mode = process.argv.includes('--write') ? 'write' : 'check';
  const oracleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'oracle');

  const result = await checkCard23Migration(oracleRoot);
  console.log(JSON.stringify({
    card: CARD_NUMBER,
    mode,
    public_card_equal: result.cardEqual,
    editorial_statuses_equal: result.statusesEqual,
  }, null, 2));

  if (!result.cardEqual || !result.statusesEqual) {
    if (result.diff) console.error(result.diff);
    process.exitCode = 1;
    return;
  }

  if (mode === 'write') {
    await writeCard23Split(oracleRoot);
    console.log('Wrote oracle/manuscripts/23/ and oracle/editorial/23/ (oracle/cards/23.md left untouched).');
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
