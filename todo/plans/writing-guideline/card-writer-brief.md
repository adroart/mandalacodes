# The card writer's brief

The prompt every card writer gets. It wrote cards 3 to 62 and rewrote the rest on
2026-09-24; `scripts/card-queue.mjs` hands it to one headless writer per card. It adds no
rule of its own: the rules are in oracle/WRITERS-BRIEF.md and oracle/CARD-PASS.md, and
this is the order to apply them in.

---

OPUS: oracle card prose is Adrian's standing allocation for Opus; this is the full pass on one card.

You are rebuilding card NN of the Mandala Codes oracle deck, in its own git worktree on
branch claude/card-NN-model, created from origin/main. Stay in that directory. Never run a
command in the background; wait for every command to finish in the foreground.

READ FIRST, whole: oracle/WRITERS-BRIEF.md, oracle/CARD-PASS.md, oracle/WORKSHEET.md,
oracle/CARD-CHECKLIST.md, todo/plans/writing-guideline/entrance-openings.md, and the last
dated sections of todo/plans/writing-guideline/adrian-said.md. Models: card 6's reading,
card 63's other sections, card 9's worksheet. Do not edit the locked files (CARD-PASS.md,
WRITERS-BRIEF.md, WORKSHEET.md, CARD-CHECKLIST.md, scripts/card-gate.mjs).

WHAT ADRIAN SETTLED (2026-09-24), which outranks anything older:
- The card's name is his artwork title (card_name), never the hexagram's name. The I Ching
  feeds the card like every other system and never frames it. No hexagram name or I
  Ching-only word or picture in the reading or entrance. Work the title in only where it fits.
- The card's moment is a situation a person knows from their own day, from all the sources.
- The reading, written fresh from the source files: the gift alive in you; the hard stretch,
  briefly, and how to hold it; how to step into the gift and live it, ending on the gift.
- Every sentence on the card must be something a person could say back as something about
  their life. Trigram paragraphs follow the brief's trigram moves (the vault's trigram files
  are empty, so use the hexagram sources' "Outer and Inner Trigram" fields of meaning). The
  Combination follows the seven moves and never describes an old written character, a
  creature story, or how the sign is drawn. In Relations each tarot card, immortal, sky sign
  and Hebrew letter gets one clause saying what it means for the reader.

THE PROCESS
1. Read every source once (vault: ~/Documents/Obsidian Vault/Mandala Codes/oracle/; the
   card's meta.sources names them). Keep notes.
2. Write oracle/worksheets/NN.md in the new format.
3. Write every section fresh from the sources, reading first. Sources only; never invent.
   Keep any line Adrian wrote or approved (search adrian-said.md); if unsure, keep it and say so.
4. The entrance is `  centre:` inside the frontmatter `meta:` block; the other `  centre:` line
   above it is the Human Design centre, never touch it. Keep this card's line in
   entrance-openings.md matching the entrance's first sentence.
5. `node todo/plans/writing-guideline/sentence-check.mjs oracle/cards/NN.md` to 0 gating.
6. One CODE fresh reader as CARD-PASS step 6 describes, as a bare
   `claude -p --model sonnet --no-session-persistence --output-format json` call run from the
   temp folder. Cut once what it names. Record it in the worksheet (the verdict line starts
   with "pass").
7. `node scripts/cold-read.mjs oracle/cards/NN.md`; fix every real flag, run it once more, stop.
8. `npm run card:gate -- NN` passes. Regenerate: `node --import tsx scripts/build-oracle-corpus.ts`,
   `node --import tsx scripts/build-search-index.ts`, `npm run progress`. `npm run typecheck`
   passes. Statuses stay `scaffold`. No em dashes.
9. Commit, push, open a PR titled "Card NN rebuilt (for Adrian's read)". Do not merge.
10. Report: PR link, the entrance, the reading pasted whole, gate result, and "Least sure:".

To rewrite only a reading on a card that is already written, follow steps 1, 3 (reading
only, without first reading the current paragraphs), 5 to 8, and report the new paragraphs.
