# The card pass: how one card gets written

## Where this sits

One template governs the whole card and the entrance is part of it, not a second
stream. Renamed 2026-09-23, when Adrian said "I want to make sure the entrance and
the oracle card template is together", because two files called ENTRANCE-something
read as a separate job when they are the tail of this one.

- [`WRITERS-BRIEF.md`](WRITERS-BRIEF.md) is the template: the shape of every section
  and of the entrance, in prose, with Adrian's own lines as the model.
- [`CARD-CHECKLIST.md`](CARD-CHECKLIST.md) is the entrance's 49 rules as numbered
  tests, 28 of which the scripts run.
- [`CARD-PROGRESS.md`](CARD-PROGRESS.md) is the state of the deck, generated.
- [`GUIDELINE.md`](GUIDELINE.md) is the long reference behind the template.

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

## Which card to take

Open [`CARD-PROGRESS.md`](CARD-PROGRESS.md) and take the first unticked card in
"not started". One session works down from 64, the other up from 1, so the two
never open the same file. Nothing outside your own card is yours to edit.

## What one writer reads, once

`oracle/WRITERS-BRIEF.md` (the shape of every section and of the entrance),
`oracle/CARD-CHECKLIST.md` (the same rules as 49 numbered tests), and its own
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
> Worktree: <path>. Read, in this order and whole: `oracle/WRITERS-BRIEF.md`, then `oracle/CARD-CHECKLIST.md`. They are the rule; I am not restating it here and nothing in this message overrides them.
>
> Your cards: NN, NN, NN. Read each card file whole (`oracle/cards/NN.md`, every section) before writing a word. Write every part of the card that is still scaffold, and write the entrance last, after the sections it summarises. The `centre:` line under `meta:` is the old entrance and is wrong.
>
> Before you send anything, run the four checks above on your own work and fix what they find. Put your entrances in a file as blocks of "NN · Title" then the prose, for the entrance and slop checks.
>
> Final message: one block per card, the number and title, then the entrance, then one line naming the card's own words you used. Then "Least sure: NN, NN" with one clause each.

The writer loads the brief, the checklist and its own card files. That is the whole
context. The old way loaded a paraphrase on top of them, and loaded the same card
twice in two sessions.

## Handing this to a fresh session

Everything below is read off the repository, so a new session needs no briefing
beyond one line: *read `oracle/CARD-PASS.md`, then write the next unticked card.*

**Where the deck stands** (run `npm run progress` for today's count): card 64 is
written and waiting on Adrian's yes. Eight cards are part way. The rest have not
started.

**The three jobs left, in the order they should be done.**

1. **Write the remaining cards**, one writer per card, sections then entrance. This
   is the bulk of the work and is described above.
2. **Put the settled entrance into the eight part-way cards.** Their sections are
   already written, and the opening sentence Adrian agreed for each is sitting in
   `todo/plans/writing-guideline/entrance-openings.md` rather than in the card. That
   file is the record of the sentence; the card is where it belongs.
3. **Show the entrance on the card page.** Nothing renders it today: a visitor sees
   the reading's first paragraph under the keywords instead. It belongs under the
   header "Message at a glance", which is the one place the deck says what the
   paintings are: a window to the energy, the painting does nothing, you look.

**The one decision waiting on Adrian, besides reading cards.** Card 3 has two
different opening lines, one on `main` and one on the closed `claude/card-writing`
branch, both written before the current rule. Neither is his settled line. Card 3's
pass puts the question in front of him.

**What not to do.** Do not write a paraphrase of the template into a dispatch
prompt; point at the files. Do not run a review round inside a pass. Do not set any
card's status to `final`; that word is Adrian's alone. Do not name a specific card to
two sessions at once; each takes the next unticked one by itself.
