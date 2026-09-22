# Dispatching a card writer

**One writer per card, and it writes everything that card still needs.** Decided
2026-09-22, after Adrian asked why the context was being loaded twice.

The card file is the expensive thing to read, around six thousand words. The
rules are small beside it. So the waste was never the brief: it was two sessions
each opening card 30, one to write its entrance and one to write its I Ching
sections. The unit of work is the card, not the section. A writer opens the card
once, writes every part of it that is still scaffold, runs the checks on its own
work, and comes back with the whole card.

That retires the separate entrance pass. The entrance is the last thing the card
writer does, after the sections, because it is a summary of the totality and
cannot be written before the totality exists.

## What one writer reads, once

`oracle/WRITERS-BRIEF.md` (the shape of every section and of the entrance),
`oracle/ENTRANCE-CHECKLIST.md` (the same rules as 49 numbered tests), and its own
card files. Nothing else, and no paraphrase of any of it: five throwaway briefs
were written in one week, each restating the rule in its own words, and the
paraphrases drifted. That is where "the wait", "a knowing" and "keeps its hours"
came from.

## No Fable review inside a card pass

Adrian, 2026-09-22: "I don't want the other one to be doing the Fable review on
it." A card pass is written by Opus and gated by the checks below. Fable writes
the template and is read when the shape itself is in question, which is a
different job from passing judgement on each card as it is written. A per-card
review round costs a second full reading of the same six thousand words, which is
the very double load this note exists to remove, and it puts a second opinion
between the writer and Adrian, who is the one whose call it is.

So: no Fable round per card, on either stream. The checks are the gate, and
Adrian reads the card.

## What it runs on itself before it answers

- `npm run lint:prose` and `npm run lint:tells` for the manuscript
- `node todo/plans/writing-guideline/sentence-check.mjs <file>` for long sentences, comma piles, fragments and deck phrases
- `npm run lint:entrance -- <file>` for the entrance as a shape
- `npm run lint:slop -- <file>` for lines that would sit on any of the sixty-four

Four commands is three too many and is filed in the todo as one command. Until
that lands, a writer runs all four.

Copy this, fill the two lines:

> OPUS: card prose is written by Opus per Adrian's model rule (oracle cards, 2026-09-16); this is oracle card copy for his review.
>
> Worktree: <path>. Read, in this order and whole: `oracle/WRITERS-BRIEF.md`, then `oracle/ENTRANCE-CHECKLIST.md`. They are the rule; I am not restating it here and nothing in this message overrides them.
>
> Your cards: NN, NN, NN. Read each card file whole (`oracle/cards/NN.md`, every section) before writing a word. Write every part of the card that is still scaffold, and write the entrance last, after the sections it summarises. The `centre:` line under `meta:` is the old entrance and is wrong.
>
> Before you send anything, run the four checks above on your own work and fix what they find. Put your entrances in a file as blocks of "NN · Title" then the prose, for the entrance and slop checks.
>
> Final message: one block per card, the number and title, then the entrance, then one line naming the card's own words you used. Then "Least sure: NN, NN" with one clause each.

The writer loads the brief, the checklist and its own card files. That is the whole
context. The old way loaded a paraphrase on top of them, and loaded the same card
twice in two sessions.
