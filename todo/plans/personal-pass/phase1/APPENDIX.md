# Phase 1 pass appendix

One page, read after oracle/WRITERS-BRIEF.md and before the two cards. This is the last thing the AI does to the prose. It is not a rewrite. An agent that dislikes a paragraph and cannot fix it by cutting puts it in the report and leaves it.

## The five things, and nothing else

1. The measurable tells to zero. A sentence with two ands; a Gene Keys height opening "At its lowest / best / height / highest", "Met, this energy", "Held well"; a lens entry sentence sharing its first five words with another card (BODY's "this energy is given to the" is on 37 cards, and "the X is where this energy" on several more); a CODE paragraph opening "The way is to" or "The way here is" (38 cards) or "This is the energy of" (7 cards); hexagram, trigram, siddhi, shadow, gift, codon anywhere outside DESIGN; "Not X. It is Y" beyond one per card; a banned word (journey, sacred, invited, step into, you are being, alignment). Each is rewritten in place as one finished thought in the card's own words. The fix for a shared stem is a different entry, never a synonym in the same slot. Before you settle a new entry or opener, grep oracle/cards/*.md for its first five words; if another card has them, choose again.
2. The side-by-side test. Put the CODE reading beside the ICHING reading and compare by meaning. A proposition carried in both is cut from the CODE reading. Record the result in the frontmatter as a new key under meta, `side_by_side:`, one line: either "clean" or what was cut and why. Cards 1 and 2 failed this on the page; the rest have never had it run.
3. Sentences with three or more commas, and sentences over thirty words. Split only where two thoughts share one sentence and the second does not follow from the first. A long sentence that is one thought keeps its commas. Do not hunt these down to a number; touch them where you are already working, and where a split is clearly a repair.
4. The eye tests, fixed only where the fix is a cut: a picture the reader must decode before it does its work; a life assigned to the reader ("anyone who has started a family knows"); a list of examples beyond two; a matched pair set up to be knocked down; a paragraph that ends by saying what it already meant. A cut is safe. A new sentence is not.
5. The report, which is the point. Write todo/plans/personal-pass/phase1/NN.md for each card: every sentence you suspect says nothing (it fails "could a reader say it in other words and check it against a life"), and every sentence you were unsure of. Quote the sentence whole, name its lens, and give the source line from the packet you think the sentence should have carried, or "no source found". Do not rewrite these. Meaning is Adrian's job; this list prints in his workbook margin.

## Untouchable

- `## RELATIONS`, byte for byte. It is paused.
- Every heading, the `_Shadow:_ · _Gift:_ · _Siddhi:_` line, the Judgement and Image bullets, every `**Line N**` marker and its target, every structural frontmatter fact (numbers, names, trigrams, gates, channels, organ, amino acid, relations_data, line targets). Report a contradiction; never change one.
- Lines Adrian wrote or approved on the page. On card 01, the essence and keynotes are his. On card 02, the reading and the three heights were corrected by him. Cards 01 and 02 get the report only, no edits.
- The em dash in headings is a parser delimiter. No em dash anywhere in prose. No italics or underscore emphasis in prose.

## Mechanics

- Worktree: /Users/adrianrasmussen/Documents/Files/2 Areas/Coding/mandalacodes/.claude/worktrees/personalize-ai-writings-book-13d123. Run everything from here. Never cd to the main checkout.
- Packet: `node scripts/oracle-packet.mjs NN` writes oracle/_packets/NN.md. Read it whole before the report; it is where the source lines come from.
- Checks, after each card: `node scripts/oracle-tells.mjs NN` (all hard tells zero for the card), `node todo/plans/writing-guideline/punctuation.mjs oracle/cards/NN.md`, and `node --import tsx scripts/lint-oracle-prose.ts` (no banned words in your cards, no stem pair involving your cards). Plain `tsx` and `npx tsx` fail in the sandbox; use `node --import tsx`.
- Do not run npm builds, do not regenerate data files, do not commit, do not touch any card but your two, do not touch GUIDELINE.md or WRITERS-BRIEF.md.
- A change touches the fewest words that fix the tell. Do not improve the reading. Do not try a new picture. Do not make a sentence more oracular.

## Final message

Short, one block per card: the tells line before and after; what side_by_side recorded; how many sentences you cut, split, or replaced; the count of suspect sentences in the report; anything in the sources that contradicted the frontmatter; the one place you were least sure.

## Addendum, same day: the mechanical pass (Sonnet, cards 17 to 64)

Adrian asked for the rest at lower cost. From card 17 on, the pass is split: a Sonnet agent does the mechanical part on two cards, and Fable writes the step 5 reports for the whole deck afterwards in one reading pass. So for the mechanical agent:

- Do steps 1 to 4 only. Do NOT run the packet script, do not read the packet, do not write the report file. The sources are not needed to remove a tell.
- Step 1 now includes deck-wide copied sentence openings. `node scripts/oracle-tells.mjs NN` prints every sentence stem on your card that three or more cards share ("in a family it is the" is on 53 cards, "whether the other half sits in" on 50, "in the body this energy is" on 48, "people who carry this all their" on 39, "notice where you are holding yourself" on 26). Each one is a template copy. Rework each so the sentence opens in this card's own words and carries the same fact, in the fewest changed words; or cut it where the paragraph already said the thing. The eight trigram subsections are left out of the check (a trigram says the same things on its sixteen cards). The DESIGN channel sentences ("its other half is gate", "together they make the channel of") carry a structural fact: keep the fact, vary the sentence.
- The "Not X. It is Y" hinge is on almost every card, lowercase too ("The fog is not the wall. It is the door"). At most one per card stays; rework the rest as single finished thoughts.
- Measure of done for your card: `node scripts/oracle-tells.mjs NN` shows twoAnds 0, notXItIsY at most 1, heightOpeners 0, wayIsTo 0, thisIsTheEnergy 0, systemWord 0, sharedStems 0; `node --import tsx scripts/lint-oracle-prose.ts` shows no banned word and no stem pair for your card; `node todo/plans/writing-guideline/punctuation.mjs oracle/cards/NN.md` passes.
- Final message: the tells line before and after for each card, the side_by_side you recorded, and the count of sentences cut, split, or replaced. Nothing else.
- Removing the hinge. Do not fold "Not X. It is Y" into "Y, not X" inside one sentence ("Its pleasure sits in the moment a spoiled thing works again, not in the finding"); on forty cards that fold becomes its own tell. Ask whether the reader was assuming X. Almost never. So say Y plainly as its own sentence and cut the "not X" altogether: "Its pleasure is the moment a spoiled thing works again." Where X really is what a reader assumes, keep the two sentences as the card's one allowed hinge.
- A cut sentence that carried a fact from the source (a nugget, not filler) is not a cut; move it if it duplicates, keep it if it does not. Cut what is empty; never cut what is true because it is near the end of a paragraph.

## Second addendum, same evening: copied openings are no longer reworked

Read on cards 21 and 22: reworking a copied opening in the fewest words produces a reordering that clears the counter and leaves the formula standing ("From outside this can look like" became "Seen from outside, this can look like"). The mould is the sentence shape the brief set for Design and Body, and undoing it is rewriting, which Phase 1 must not do. So from card 29 on, and in the mop-up: do not rework copied openings. `sharedStems` is reported, not required; the measure of done is the hard tells only (twoAnds 0, notXItIsY at most 1, heightOpeners 0, wayIsTo 0, thisIsTheEnergy 0, systemWord 0, no banned word, punctuation passing). The copied openings print in the workbook margin as formula slots for Adrian to vary in his own words.
