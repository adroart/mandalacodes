/* Bind pass for the Card Reading import.

   The design files carry some sample content as literal text rather than as a
   {{ slot }}, so it cannot be driven by data. Card 62's title is the one that
   matters: without this, every card's header reads "No. 62 · Universal
   Language / Voice of Nature" no matter which card is open.

   This turns those literals into slots in the source .dc.html, so the converter
   emits real bindings. Run before the converter, after any re-download from
   Claude Design:

     node components/oracle/reading/_src/bind-slots.mjs

   Idempotent — replacements are skipped if the slot is already present. Each
   swap replaces text content only, never markup, so the tree stays balanced. */
import { readFileSync, writeFileSync } from 'node:fs';

const DESKTOP = 'components/oracle/reading/_src/Card Reading v2 - Wide Image (Desktop, locked).dc.html';

const BINDINGS = [
  {
    file: DESKTOP,
    swaps: [
      // Header title block, above the meta list.
      ['No. 62 · Universal Language', '{{ cardKicker }}'],
      ['Voice of Nature', '{{ cardName }}'],
    ],
  },
];

for (const { file, swaps } of BINDINGS) {
  let html = readFileSync(file, 'utf8');
  let changed = 0;

  for (const [literal, slot] of swaps) {
    if (html.includes(slot)) continue;          // already bound
    if (!html.includes(literal)) {
      console.warn(`  ! "${literal}" not found — the design may have changed; check the header block`);
      continue;
    }
    html = html.split(literal).join(slot);
    changed++;
  }

  if (changed) {
    writeFileSync(file, html);
    console.log(`${file} — bound ${changed} literal(s) to slots`);
  } else {
    console.log(`${file} — already bound`);
  }
}
