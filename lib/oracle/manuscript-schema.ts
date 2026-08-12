export const ORACLE_LENSES = [
  'CODE', 'ICHING', 'KEYS', 'DESIGN', 'BODY', 'RELATIONS',
] as const;

export type OracleLens = typeof ORACLE_LENSES[number];
export type EditorialStatus = 'scaffold' | 'in-progress' | 'final';

const EDITORIAL_STATUSES = new Set<EditorialStatus>([
  'scaffold', 'in-progress', 'final',
]);

export function parseEditorialStatus(value: unknown, context: string): EditorialStatus {
  if (typeof value !== 'string' || !EDITORIAL_STATUSES.has(value as EditorialStatus)) {
    throw new Error(
      `${context}: received ${JSON.stringify(value)}; expected scaffold | in-progress | final`,
    );
  }
  return value as EditorialStatus;
}

export function parseLegacyStatusMap(
  value: unknown,
  context: string,
): Record<Lowercase<OracleLens>, EditorialStatus> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${context}: frontmatter status must be a map`);
  }

  const source = value as Record<string, unknown>;
  const allowed = ORACLE_LENSES.map(lens => lens.toLowerCase());
  const unknown = Object.keys(source).filter(key => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new Error(`${context}: unknown status keys: ${unknown.join(', ')}`);
  }

  return Object.fromEntries(allowed.map(key => {
    if (!(key in source)) throw new Error(`${context}: status.${key} is missing`);
    return [key, parseEditorialStatus(source[key], `${context}: status.${key}`)];
  })) as Record<Lowercase<OracleLens>, EditorialStatus>;
}

/* ─── Manuscript bundle: the compiler's one input shape ──────────────────── */

/** One raw source file, identified by its repository-relative path. */
export interface ManuscriptFile {
  path: string;
  raw: string;
}

/**
 * The compiler's single input contract. A `legacy` bundle wraps one
 * `oracle/cards/NN.md` file (the same `ManuscriptFile` repeated for `card`
 * and every lens, since legacy sections all live in one document). A `v2`
 * bundle wraps a real `oracle/manuscripts/NN/` directory: one `_card.md` for
 * shared structural data plus six per-lens files. Optional editorial sidecar
 * files (`oracle/editorial/NN/*.md`) never feed card construction.
 */
export interface OracleManuscriptBundle {
  cardNumber: number;
  layout: 'legacy' | 'v2';
  card: ManuscriptFile;
  lenses: Record<Lowercase<OracleLens>, ManuscriptFile>;
  editorial: Partial<Record<OracleLens | 'CARD', ManuscriptFile>>;
}
