/**
 * Back up the five Atlas R2 objects to a local, gitignored folder.
 *
 *   npm run backup:atlas
 *
 * Fetches atlas/ledger.json, atlas/stewards.json, atlas/public.json,
 * atlas/claimRequests.json and atlas/letters.json from the production
 * `mandalacodes-atlas` bucket via `wrangler r2 object get` into
 * backups/atlas-<timestamp>/. Run it BEFORE any structural change ships
 * (see the living-art-legacy plan, M0 — Hardening / Ops checklist).
 *
 * Read-only: this script never writes to R2. It needs a wrangler login
 * with access to the bucket (`npx wrangler login` first if in doubt).
 * stewards.json and claimRequests.json contain collector emails —
 * backups/ is gitignored and must stay private; move long-term copies to
 * artist-controlled offline storage, never a repo.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BUCKET = 'mandalacodes-atlas';
// `required` keys existed from day one and must be present; the `optional`
// ones are created lazily on first use (M4 claim requests, M5 letters,
// first public regen) — a missing optional key is reported but doesn't
// fail the backup.
const KEYS: Array<{ key: string; required: boolean }> = [
  { key: 'atlas/ledger.json', required: true },
  { key: 'atlas/stewards.json', required: true },
  { key: 'atlas/public.json', required: false },
  { key: 'atlas/claimRequests.json', required: false },
  { key: 'atlas/letters.json', required: false },
];

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = join('backups', `atlas-${stamp}`);
mkdirSync(outDir, { recursive: true });

for (const { key, required } of KEYS) {
  const file = join(outDir, key.split('/').pop()!);
  console.log(`Fetching ${BUCKET}/${key} → ${file}`);
  // --remote targets the real bucket; without it newer wrangler versions
  // read the local dev simulation, which would back up nothing.
  try {
    execFileSync(
      'npx',
      ['wrangler', 'r2', 'object', 'get', `${BUCKET}/${key}`, '--file', file, '--remote'],
      { stdio: 'inherit' },
    );
  } catch {
    if (required) {
      console.error(`ERROR: could not fetch required key ${key}.`);
      process.exitCode = 1;
    } else {
      console.warn(`NOTE: ${key} not fetched (likely not created yet) — skipping.`);
    }
    continue;
  }
  const { size } = statSync(file);
  if (size === 0) {
    console.error(`WARNING: ${file} is empty — verify the bucket key exists.`);
    if (required) process.exitCode = 1;
  }
}

console.log(`\nBackup complete: ${outDir}`);
