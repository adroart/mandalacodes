/**
 * Strict YAML frontmatter parsing and bundle adapters.
 *
 * `parseYamlRecord` is the one place the compiler pipeline trusts a real YAML
 * parser (the legacy hand-rolled subset parser in card-markdown.ts stays as
 * the compatibility path for `oracle/cards/*.md`). It fails closed: duplicate
 * keys, YAML syntax errors, and non-mapping roots are all authoring errors
 * with a repository-relative location, never a silently-wrong parse.
 *
 * `legacyCardToBundle` wraps one `oracle/cards/NN.md` file as an
 * `OracleManuscriptBundle` with `layout: 'legacy'` — the whole document is
 * carried once, since legacy sections all live in one file.
 */
import { parseDocument } from 'yaml';

import { OracleAuthoringError } from './authoring-error';
import { ORACLE_LENSES, type ManuscriptFile, type OracleManuscriptBundle } from './manuscript-schema';

export function parseYamlRecord(raw: string, file: string): Record<string, unknown> {
  const document = parseDocument(raw, {
    prettyErrors: true,
    strict: true,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    throw new OracleAuthoringError(document.errors.map(error => ({
      code: 'ORACLE_YAML_INVALID',
      file,
      message: error.message,
      hint: 'Fix the YAML before compiling this card.',
    })));
  }
  const value = document.toJS();
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new OracleAuthoringError([{
      code: 'ORACLE_YAML_ROOT_INVALID',
      file,
      message: 'Frontmatter must be a mapping.',
      hint: 'Use key: value fields at the frontmatter root.',
    }]);
  }
  return value as Record<string, unknown>;
}

function extractCardNumber(raw: string, file: string): number {
  const match = raw.match(/^---\n[\s\S]*?\bnumber:\s*(\d+)\b[\s\S]*?\n---/);
  const number = match ? Number(match[1]) : Number.NaN;
  if (!Number.isInteger(number) || number < 1 || number > 64) {
    throw new OracleAuthoringError([{
      code: 'ORACLE_CARD_NUMBER_INVALID',
      file,
      message: 'Could not find a valid frontmatter "number" (1-64).',
      hint: 'Add or fix the number: field in the frontmatter.',
    }]);
  }
  return number;
}

/**
 * Wrap one legacy `oracle/cards/NN.md` file as a manuscript bundle. The full
 * raw document is reused for `card` and every lens slot, because the legacy
 * layout keeps all six lenses in one file — the compiler's legacy path reads
 * the whole document through the existing hand-rolled section parser.
 */
export function legacyCardToBundle(raw: string, file: string): OracleManuscriptBundle {
  const cardNumber = extractCardNumber(raw, file);
  const wholeFile: ManuscriptFile = { path: file, raw };

  return {
    cardNumber,
    layout: 'legacy',
    card: wholeFile,
    lenses: Object.fromEntries(
      ORACLE_LENSES.map(lens => [lens.toLowerCase(), wholeFile]),
    ) as OracleManuscriptBundle['lenses'],
    editorial: {},
  };
}

/**
 * Wrap a `oracle/manuscripts/NN/` directory's files as a V2 manuscript
 * bundle. Callers (filesystem adapters, the migration script, tests) resolve
 * the six exact lowercase lens filenames plus `_card.md` and pass them here;
 * this function performs no filesystem access itself.
 */
export function v2BundleFromFiles(
  cardNumber: number,
  card: ManuscriptFile,
  lenses: Record<Lowercase<typeof ORACLE_LENSES[number]>, ManuscriptFile>,
  editorial: OracleManuscriptBundle['editorial'] = {},
): OracleManuscriptBundle {
  return { cardNumber, layout: 'v2', card, lenses, editorial };
}
