/**
 * Typed, actionable compiler failures for the Oracle manuscript pipeline.
 *
 * Every failure the compiler raises (strict YAML errors, missing lens files,
 * ambiguous sources, malformed structure) carries a machine-checkable code,
 * a repository-relative file location, and a human hint — so the reader can
 * render an actionable error instead of a blank card, and tooling can assert
 * on `code` without regexing prose.
 */
import type { OracleLens } from './manuscript-schema';

export interface OracleAuthoringIssue {
  code: string;
  card?: number;
  lens?: OracleLens;
  file: string;
  path?: string;
  message: string;
  hint: string;
}

export class OracleAuthoringError extends Error {
  constructor(public readonly issues: readonly OracleAuthoringIssue[]) {
    super([
      'Oracle manuscript compilation failed:',
      ...issues.map(issue =>
        `[${issue.code}] ${issue.file}${issue.path ? ` ${issue.path}` : ''}: ${issue.message} ${issue.hint}`,
      ),
    ].join('\n'));
    this.name = 'OracleAuthoringError';
  }
}
