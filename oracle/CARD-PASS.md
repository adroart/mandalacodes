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

## The pass: framework first, write, then check. None of it is optional.

Adrian, 2026-09-23: "The frameworking that everything has to be ran through is not
optional. And then the checking after is also not optional but first off the
frameworking." Card 63 is why. Its writer had the brief, the checklist and every
script, and still sent out an entrance and a reading that named the energy by its
shadow, doubt. The writer held the rules in its head instead of on the page. It
polished the old card's sentences instead of starting from the sources, so the
old framing came through untouched. It ran only the checks a script can decide.
And it treated the opening line on file as settled when it was a draft. Every
script was green.

So every card goes through three steps, in this order, and the gate refuses a
card that skipped one.

**1. The framework, before a word of prose.** Copy the block in
[`WORKSHEET.md`](WORKSHEET.md) to `oracle/worksheets/NN.md` and fill parts 1 to 3
from the SOURCES, never from the card's existing prose:
- **the energy whole:** all three heights in one sentence, lived well. The shadow is one height, never the energy.
- **the true things:** thirty or more, each with its source file.
- **the allotment:** which section carries which true thing, nothing twice.

The existing prose is what is being replaced, and its framing is the part most
likely to be wrong. The opening line in
`todo/plans/writing-guideline/entrance-openings.md` is a draft to test, not a
settled line. Four of those drafts (30, 35, 63, 64) name the shadow.

**2. Write the card** from the worksheet: ICHING, KEYS, DESIGN, BODY, RELATIONS,
then CODE, then the keynotes, then the entrance last.

**3. The checks after.** Fill part 4 of the worksheet:
- **every reader check** from the checklist, answered with the sentence it applies to quoted. A bare "yes" fails.
- **a cold reader:** a fresh agent with no sources, given only the keywords, the entrance and CODE. It restates every sentence in its own words. Its output is pasted into the worksheet.

The cold reader is the brief's own gate ("nothing ships without both"), not a
Fable review. Then run the one command:

    npm run card:gate -- NN

It runs everything the four older commands ran (sentences, prose, entrance
shape, slop). It also refuses a card whose entrance, CODE opening or keynotes
name the energy by its shadow, whose CODE says the shadow word more than twice,
or whose worksheet is missing or unfinished. A card is committed only through
the gate. `npm run progress` counts a card as written only when it passes.

## What one writer reads, once

`oracle/WRITERS-BRIEF.md` (the shape of every section and of the entrance),
`oracle/CARD-CHECKLIST.md` (the same rules as 49 numbered tests),
`oracle/WORKSHEET.md` (the framework), the card's sources in the vault, and its
own card file. No paraphrase of any of it: five throwaway briefs were written in
one week, each restating the rule in its own words, and the paraphrases drifted.
That is where "the wait", "a knowing" and "keeps its hours" came from.

## No Fable review inside a card pass

Adrian, 2026-09-22: "I don't want the other one to be doing the Fable review on
it." A card pass is written by Opus and gated by the checks above. Fable writes
the template and is read when the shape itself is in question, which is a
different job from passing judgement on each card as it is written. The cold
reader in step 3 is not that: it knows nothing, reads a few hundred words, and
only says back what each sentence means.

Copy this, fill the two lines:

> OPUS: card prose is written by Opus per Adrian's model rule (oracle cards, 2026-09-16); this is oracle card copy for his review.
>
> Worktree: <path>. Read, in this order and whole: `oracle/CARD-PASS.md`, `oracle/WRITERS-BRIEF.md`, `oracle/CARD-CHECKLIST.md`, `oracle/WORKSHEET.md`. They are the rule; I am not restating it here and nothing in this message overrides them.
>
> Your card: NN. Fill parts 1 to 3 of `oracle/worksheets/NN.md` from the sources before writing a word. Then write every section, the keynotes and the entrance last. Then fill part 4, run the cold reader, and run `npm run card:gate -- NN` until it passes.
>
> Final message: the entrance, the gate's last line pasted, the lines from part 2 that went nowhere, and "Least sure:" with the two sentences you trust least.

## Handing this to a fresh session

Everything below is read off the repository, so a new session needs no briefing
beyond one line: *read `oracle/CARD-PASS.md`, then write the next unticked card.*

**Where the deck stands** (run `npm run progress` for today's count): no card is
through the gate yet. Cards 63 and 64 have their sections written and go back
through the framework, since both entrances name the shadow.

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
prompt; point at the files. Do not run a review round inside a pass. Do not write a card without its worksheet, and do not commit one the gate
refuses. Do not set any
card's status to `final`; that word is Adrian's alone. Do not name a specific card to
two sessions at once; each takes the next unticked one by itself.
