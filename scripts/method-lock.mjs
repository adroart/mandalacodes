#!/usr/bin/env node
/**
 * The method lock. Adrian, 2026-09-23, on the card method: write it so it "will
 * not be destroyed, overwritten, or sidestepped". The files below change only
 * by a correction from Adrian, recorded in adrian-said.md in the same change.
 *
 * Usage: node scripts/method-lock.mjs <base-ref>   (CI passes origin/main)
 * Exit 1 when a locked file changed and adrian-said.md did not.
 */
import { execFileSync } from 'node:child_process';

const LOCKED = [
  'oracle/CARD-PASS.md',
  'oracle/WRITERS-BRIEF.md',
  'oracle/WORKSHEET.md',
  'oracle/CARD-CHECKLIST.md',
  'scripts/card-gate.mjs',
  'scripts/method-lock.mjs',
];
const RECORD = 'todo/plans/writing-guideline/adrian-said.md';

const base = process.argv[2] || 'origin/main';
const changed = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' })
  .split('\n').filter(Boolean);
const touched = LOCKED.filter((f) => changed.includes(f));

if (!touched.length) { console.log('method-lock: no locked file changed'); process.exit(0); }
if (changed.includes(RECORD)) {
  console.log(`method-lock: ${touched.join(', ')} changed, with Adrian's words added to ${RECORD}`);
  process.exit(0);
}
console.log(`method-lock: ${touched.join(', ')} changed, but ${RECORD} did not.`);
console.log('The card method changes only by a correction from Adrian. Add his words, dated, to that file in this change, or revert the edit.');
process.exit(1);
