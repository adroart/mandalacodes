/**
 * Back up the two mutable Atlas R2 objects to a local, gitignored folder.
 *
 *   npm run backup:atlas
 *
 * Fetches atlas/ledger.json and atlas/stewards.json from the production
 * `mandalacodes-atlas` bucket via `wrangler r2 object get` into
 * backups/atlas-<timestamp>/. Run it BEFORE any structural change ships
 * (see the living-art-legacy plan, M0 — Hardening / Ops checklist).
 *
 * Read-only: this script never writes to R2. It needs a wrangler login
 * with access to the bucket (`npx wrangler login` first if in doubt).
 * stewards.json contains collector emails — backups/ is gitignored and
 * must stay private; move long-term copies to artist-controlled offline
 * storage, never a repo.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BUCKET = 'mandalacodes-atlas';
const KEYS = ['atlas/ledger.json', 'atlas/stewards.json'];

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = join('backups', `atlas-${stamp}`);
mkdirSync(outDir, { recursive: true });

for (const key of KEYS) {
  const file = join(outDir, key.split('/').pop()!);
  console.log(`Fetching ${BUCKET}/${key} → ${file}`);
  // --remote targets the real bucket; without it newer wrangler versions
  // read the local dev simulation, which would back up nothing.
  execFileSync(
    'npx',
    ['wrangler', 'r2', 'object', 'get', `${BUCKET}/${key}`, '--file', file, '--remote'],
    { stdio: 'inherit' },
  );
  const { size } = statSync(file);
  if (size === 0) {
    console.error(`WARNING: ${file} is empty — verify the bucket key exists.`);
    process.exitCode = 1;
  }
}

console.log(`\nBackup complete: ${outDir}`);
