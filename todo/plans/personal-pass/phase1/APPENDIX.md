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
