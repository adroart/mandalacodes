/** Re-export of the shared cast logic (now lib/oracle/cast.ts) so existing
 *  imports in this package keep working. The hosted Function imports the same
 *  shared module. */
export { castHexagram } from '../../../lib/oracle/cast.ts';
export type { CastLine, CastResult, BinaryCard } from '../../../lib/oracle/cast.ts';
