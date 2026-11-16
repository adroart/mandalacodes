// Which bundle is this? Filled in by vite.oracle.config.ts at build time.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatBuildLine(commit: string, builtAt: string, build = ''): string {
  const when = new Date(builtAt);
  const date = Number.isNaN(when.getTime()) ? '' : `${when.getUTCDate()} ${MONTHS[when.getUTCMonth()]} ${when.getUTCFullYear()}`;
  return ['Oracle', build ? `build ${build}` : '', commit || 'dev', date].filter(Boolean).join(' · ');
}

export function oracleBuildLine(): string {
  const env = import.meta.env as Record<string, string | undefined>;
  return formatBuildLine(env.VITE_ORACLE_BUILD_COMMIT || 'dev', env.VITE_ORACLE_BUILD_TIME || '', env.VITE_ORACLE_BUILD_NUMBER || '');
}
