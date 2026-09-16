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

## After the pass, 2026-09-16 22:10 WITA

Measured on the branch after all 64 cards, with the corrected script (hinge counts lowercase, skips has-not; way-is-to matches the instruction frame only; copied openings counted deck-wide but no longer required):

    64 cards, 9330 sentences. startAnd 0, twoAnds 2, notXItIsY 49, heightOpeners 2, wayIsTo 1, thisIsTheEnergy 2, systemWord 1, itAlso 0, cardTalk 0, threeCommas 1060 (11.4%), long30 780 (8.4%)
    lint:prose: 0 errors; 18 banned-word hits, all inside RELATIONS (paused, untouchable) or cards 01 and 02
    every residual hard tell is on card 01 or 02 (Adrian's; report only, no edits), except two counted hinges on 46 and 61 that are not hinges

What moved: "Not X. It is Y" 92 to 49 (one allowed per card), "The way is to" 38 to 1, two-ands 17 to 2, copied Body openers reworded on 03 to 28 only (then dropped as cosmetic; see the second addendum). Three-comma and thirty-word sentences barely moved (11.9 to 11.4 percent, 9.1 to 8.4) because the pass split only where two thoughts shared a sentence; the plan's 5 percent target was a guess and is not met, on purpose.

What was NOT done from the plan's clean line: copied openings to zero (dropped, cosmetic), comma and length under 5 percent (not chased), the Fable four-card read (next step, with the deck-wide suspect lists). Reports (step 5) exist for cards 01 to 16 only; the Fable reading pass writes the other 48.

Cost, measured: Opus pairs 310k to 420k tokens each (8 pairs); Sonnet pairs 150k to 215k (24 pairs). About 7.5M tokens in agents for the pass.

## The reading pass, 2026-09-16 23:00 WITA

Fable read cards 17 to 64 in six batches of eight (about 185k tokens a batch, 1.1M in all) and wrote the step 5 report for each; Opus had written 01 to 16 during its pass. All 64 reports are in this folder. Each carries: the suspect sentences (quoted, with what they would need to carry), the propositions said twice on the card, the unsure ones, and the formula slots (openings shared with three or more cards) for the workbook margin. Two deck-level finds from the reading: card 39 carries a Root-centre paragraph copied word for word from card 38; the "said twice" count runs 3 to 7 a card, mostly CODE against Gift or DESIGN.
