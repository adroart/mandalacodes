/**
 * Repo-root and oracle path resolution.
 *
 * The server lives at mcp/oracle-server/src/. The oracle corpus lives at the
 * repo root under oracle/ and data/. Everything is resolved relative to this
 * file so the server can be launched from any working directory (which is how
 * MCP clients spawn it).
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url)); // mcp/oracle-server/src
export const REPO_ROOT = resolve(here, '..', '..', '..');
export const ORACLE_DIR = resolve(REPO_ROOT, 'oracle');
export const DATA_DIR = resolve(REPO_ROOT, 'data');

export const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));
