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
 * DRY RUN BY DEFAULT. Without --write, it only prints what it would append
 * and exits without touching R2. Pass --write to actually read-modify-write
 * the ledger. Adrian, do not run this with --write without reviewing the
 * dry-run output first, this is a supervised ops step.
 *
 * Idempotency: on every run (dry or write) the script re-fetches the live
 * ledger, groups it into per-piece chains with the same groupChains() used
 * by the /api/atlas/event handler, and skips any pieceId that already has a
 * chain (chain.length > 0 for key `${pieceId}:0`). A piece can never get a
 * second genesis event from this script, matching the genesis guard in
 * functions/api/atlas/event.ts.
 *
 * Unlike the live /api/atlas/event handler, this script talks to R2 via the
 * wrangler CLI (same pattern as backup-atlas.ts and seed-atlas.ts), not the
 * Workers R2 binding, so it does not get mutateLedger's etag-conditional
 * retry loop. Run it when no concurrent admin writes are in flight.
 *
 * Run: tsx scripts/genesis-all-pieces.ts            (dry run, default)
 *      tsx scripts/genesis-all-pieces.ts --write     (actually append)
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FULL_ARCHIVE } from '../data/mockData';
import { appendEvent, groupChains } from '../utils/ledger';
import type { LedgerEvent } from '../types';

const BUCKET = 'mandalacodes-atlas';
const LEDGER_KEY = 'atlas/ledger.json';

const WRITE = process.argv.includes('--write');

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

function writeLedgerToR2(events: LedgerEvent[]): void {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-genesis-'));
  const file = join(dir, 'ledger.json');
  writeFileSync(file, JSON.stringify(events, null, 2), 'utf8');
  execFileSync(
    'npx',
    ['wrangler', 'r2', 'object', 'put', `${BUCKET}/${LEDGER_KEY}`, '--file', file, '--remote', '--content-type', 'application/json'],
    { stdio: 'inherit' },
  );
  rmSync(dir, { recursive: true, force: true });
}

async function main(): Promise<void> {
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

  if (!WRITE) {
    console.log('\nDRY RUN, nothing written. Events that WOULD be appended:');
    console.log(JSON.stringify(newEvents, null, 2));
    console.log(`\n${newEvents.length} event(s) would be appended. Re-run with --write to apply.`);
    return;
  }

  console.log(`\nWriting ${newEvents.length} new genesis event(s) to ${BUCKET}/${LEDGER_KEY} ...`);
  const next = [...events, ...newEvents];
  writeLedgerToR2(next);
  console.log('Done. Remember: atlas/public.json is only regenerated by a live ledger write');
  console.log('through the Functions API (mutateLedger + regeneratePublicState), not by this');
  console.log('script, so trigger a public-state refresh separately if the site needs it now.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
