# Phase 1 baseline, 2026-09-16

Measured on main at 2f2aa2c (after PR #211, the entrance rewrite) with `npm run lint:tells` and `node --import tsx scripts/lint-oracle-prose.ts`. Every Phase 1 number is read against this line.

    64 cards, 9308 sentences. startAnd 0, twoAnds 17, notXItIsY 1, heightOpeners 2, wayIsTo 38, thisIsTheEnergy 7, systemWord 9, itAlso 1, cardTalk 0, threeCommas 1107 (11.9%), long30 850 (9.1%)
    lint:prose: 0 errors, 39 banned-vocabulary hits, 39 repeated-opening-stem pairs (37 in BODY, "this energy is given to the")
    cards with none of the hard tells: 16 of 64

The clean line (from todo/plans/personal-pass.md, Phase 1): twoAnds 0, heightOpeners 0, systemWord 0, notXItIsY at most one per card, no CODE paragraph opener and no lens entry stem shared by more than two cards, threeCommas under 5%, long30 under 5%, lint:prose zero repeated-stem pairs, side-by-side test recorded on every card's sheet, unit tests green.

Per-card reports land beside this file as NN.md, one per card, written by the pass agent: every sentence it suspects says nothing, quoted, with the source line it thinks the sentence should have carried. Those are not rewritten; they print in the workbook margin.

## Correction, same day, after wave 1

Two agents found the script under-counting. "Not X. It is Y" only matched a capital Not, so the deck reads 92 of them (about 1.4 a card), not 1; and system words were never excluded from DESIGN because the section split ran after the headings were stripped. Both fixed in the script at this commit. Corrected baseline on the deck before wave 2 (cards 03 to 06 already passed):

    notXItIsY 92, systemWord 3 (DESIGN excluded)

Cards 03 to 08 were passed against the old count; the closing mop-up wave re-runs the tells on them.
