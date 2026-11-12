// Refuses a device build whose web bundle cannot sign in, is not the current commit, or was built from uncommitted changes.
// Usage, from mobile/: node scripts/check-oracle-build.mjs [--warn] [--manifest <file>]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIX = 'VITE_ORACLE_NATIVE_ACCOUNTS=true npm run build:oracle';

// Returns a one-line problem, or '' when the bundle is fit for a device.
export function checkManifest(manifest, head) {
  if (manifest === null) return `The Oracle web bundle is missing. Run: ${FIX}`;
  if (!manifest || manifest.accounts !== true) return `The Oracle web bundle was built without phone sign-in. Run: ${FIX}`;
  if (!head) return `Cannot read the current git commit, so the bundle cannot be checked. Run from a git checkout, then: ${FIX}`;
  if (manifest.commit !== head) return `The Oracle web bundle is from a different commit than HEAD. Run: ${FIX}`;
  // A bundle from before the flag existed cannot say it was clean, so it is treated as built from changes.
  if (manifest.dirty !== false) return `The Oracle web bundle was built from uncommitted changes. Commit or discard them, then run: ${FIX}`;
  return '';
}

export function readManifest(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

export function currentHead(cwd) {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const flag = process.argv.indexOf('--manifest');
  const file = flag > 0 ? path.resolve(process.argv[flag + 1]) : path.resolve(here, '../../dist-oracle/oracle-build.json');
  const problem = checkManifest(readManifest(file), currentHead(here));
  if (problem) {
    const warnOnly = process.argv.includes('--warn');
    console.error(`${warnOnly ? 'Warning' : 'Error'}: ${problem}`);
    if (!warnOnly) process.exit(1);
  }
}
