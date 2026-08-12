/**
 * Backfill missing genesis events for FULL_ARCHIVE pieces.
 *
 * The atlas ledger only knows a piece once it has a 'created' genesis event.
 * Some FULL_ARCHIVE pieces (data/mockData.ts) predate the ledger and have no
 * chain at all yet. This script reads the production ledger from R2, finds
 * every FULL_ARCHIVE piece with no existing chain, and appends a 'created'
 * event for it: status seeking, no city, actor admin. It never touches
 * pieces that already have a chain, so re-running it is safe.
 *
 * READ-ONLY SINCE THE 2026-08-09 MOVE. It prints what the retired system would
 * have appended and exits without touching R2. `--write` hard-fails. Mandala's
 * bucket is historical evidence, never a production write target.
 *
 * Idempotency: on every dry run the script re-fetches the historical
 * ledger, groups it into per-piece chains with the same groupChains() used
 * by the /api/atlas/event handler, and skips any pieceId that already has a
 * chain (chain.length > 0 for key `${pieceId}:0`). A piece can never get a
 * second genesis event from this script, matching the genesis guard in
 * functions/api/atlas/event.ts.
 *
 * Run: tsx scripts/genesis-all-pieces.ts
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FULL_ARCHIVE } from '../data/mockData';
import { appendEvent, groupChains } from '../utils/ledger';
import type { LedgerEvent } from '../types';

const BUCKET = 'mandalacodes-atlas';
const LEDGER_KEY = 'atlas/ledger.json';

function readLedgerFromR2(): LedgerEvent[] {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-genesis-'));
  const file = join(dir, 'ledger.json');
  try {
    // --remote targets the real bucket; without it newer wrangler versions
    // read the local dev simulation, which would look empty.
    execFileSync(
      'npx',
      ['wrangler', 'r2', 'object', 'get', `${BUCKET}/${LEDGER_KEY}`, '--file', file, '--remote'],
      { stdio: 'inherit' },
    );
  } catch (err) {
    console.error(`ERROR: could not fetch ${BUCKET}/${LEDGER_KEY} from R2.`);
    throw err;
  }
  const text = readFileSync(file, 'utf8');
  rmSync(dir, { recursive: true, force: true });
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error('Ledger fetched from R2 is not an array, refusing to proceed.');
  }
  return parsed as LedgerEvent[];
}

async function main(): Promise<void> {
  if (process.argv.includes('--write')) {
    throw new Error(
      'Atlas R2 writes moved to Adrian-Website on 2026-08-09; --write is permanently disabled.',
    );
  }

  console.log(`Reading ${BUCKET}/${LEDGER_KEY} ...`);
  const events = readLedgerFromR2();
  const chains = groupChains(events);

  const today = new Date().toISOString();
  const missing = FULL_ARCHIVE.filter((a) => {
    const chain = chains.get(`${a.id}:0`) ?? [];
    return chain.length === 0;
  });

  if (missing.length === 0) {
    console.log('Every FULL_ARCHIVE piece already has a genesis chain, nothing to do.');
    return;
  }

  console.log(
    `${missing.length} of ${FULL_ARCHIVE.length} FULL_ARCHIVE pieces have no ledger chain:`,
  );
  for (const a of missing) console.log(`  ${a.id}  ${a.title}`);

  const newEvents: LedgerEvent[] = [];
  for (const a of missing) {
    const full = await appendEvent([], {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? (crypto as Crypto).randomUUID()
          : `genesis-${a.id}-${Date.now()}`,
      pieceId: a.id,
      type: 'created',
      date: today,
      cityId: null,
      note: 'Genesis backfill: piece existed in FULL_ARCHIVE without a ledger chain',
      actor: 'admin',
      // Series/category on the genesis event (gap 4) so the backfilled piece
      // carries its full taxonomy even for pieces outside FULL_ARCHIVE at
      // projection time. Undefined values are dropped by the canonicalizer,
      // leaving pre-existing hashes untouched.
      ...(a.series ? { series: a.series } : {}),
      ...(a.category ? { category: a.category } : {}),
    });
    newEvents.push(full);
  }

  console.log('\nREAD-ONLY REPORT, nothing written. Historical events that would have been appended:');
  console.log(JSON.stringify(newEvents, null, 2));
  console.log(`\n${newEvents.length} historical event(s) reported. R2 remains unchanged.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
