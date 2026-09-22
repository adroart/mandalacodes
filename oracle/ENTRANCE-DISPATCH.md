# Dispatching an entrance writer

The standing prompt. It names the cards and points at the two files that hold the
rule; it never restates the rule. Five throwaway briefs were written in one week,
each paraphrasing the rule in its own words, and the paraphrases drifted: that is
where "the wait", "a knowing" and "keeps its hours" came from. One home each.
`WRITERS-BRIEF.md` teaches the shape. `ENTRANCE-CHECKLIST.md` is the same shape as
49 numbered tests, 28 of which the scripts run. Nothing else says it.

Copy this, fill the two lines:

> OPUS: card prose is written by Opus per Adrian's model rule (oracle cards, 2026-09-16); this is oracle card copy for his review.
>
> Worktree: <path>. Read, in this order and whole: `oracle/WRITERS-BRIEF.md`, then `oracle/ENTRANCE-CHECKLIST.md`. They are the rule; I am not restating it here and nothing in this message overrides them.
>
> Your cards: NN, NN, NN. Read each card file whole (`oracle/cards/NN.md`, every section) before writing a word. The `centre:` line under `meta:` is the old entrance and is wrong.
>
> Write the whole entrance: three sentences, four at most. Before you send anything, run both checkers on your own lines and fix what they find:
> `npm run lint:entrance -- <file>` and `npm run lint:slop -- <file>`, with your lines in a file as blocks of "NN · Title" then the prose.
>
> Final message: one block per card, the number and title, then the entrance, then one line naming the card's own words you used. Then "Least sure: NN, NN" with one clause each.

The writer loads the brief, the checklist and its own card files. That is the whole
context, and it is less than the old way, which loaded a paraphrase on top of them.
