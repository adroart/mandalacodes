# The card pass: how one card gets written

## This method is locked

Adrian approved it on 2026-09-23 and asked that it "will not be destroyed,
overwritten, or sidestepped" and "will be held to create the most beautiful
results." So:

- **It changes only by a correction from Adrian.** Whoever edits this file,
  `WRITERS-BRIEF.md`, `WORKSHEET.md`, `CARD-CHECKLIST.md` or
  `scripts/card-gate.mjs` must add his words to
  `todo/plans/writing-guideline/adrian-said.md` in the same pull request. The
  `method-lock` check in CI turns red if they don't.
- **No step is optional, and no step may be swapped for a cheaper one.** If a
  step feels wasteful, say so to Adrian. Do not skip it quietly.
- **Nothing in a dispatch prompt overrides this file.** Point writers at it.
  Never paraphrase it: five paraphrases written in one week each drifted.

## Why it is shaped this way

On 2026-09-23 card 64 passed every script and every reader, and still said one
thing six times. Adrian: "When I read sixty-four it seems like they're all
saying the exact same thing." The cause was the process itself. It shrank the
card to one sentence, wrote every section outward from that sentence, then
checked each sentence alone. A repeated idea passes every sentence check.
Nothing looked sideways, section against section or card against card.

Adrian's two templates exist to look sideways. The writer's brief gives each
section a question only it can answer. The 64 entrance openings put every
energy beside the others, so each card can say what only it does. Adrian:
"The templates are not just a pass or fail, but they need to be used in the
creation of the assimilation of all the information." So the templates are
how the sources are turned into prose. They are not a test run afterwards.

## The files

- [`WRITERS-BRIEF.md`](WRITERS-BRIEF.md): the template. The shape of every
  section and of the entrance, taught through Adrian's own lines.
- `todo/plans/writing-guideline/entrance-openings.md`: the map of how the 64
  differ, one line per energy.
- [`WORKSHEET.md`](WORKSHEET.md): the one-page sheet a writer fills while
  reading.
- [`CARD-CHECKLIST.md`](CARD-CHECKLIST.md): the entrance rules as a numbered
  list, used while writing the entrance. It is not filled in as a form.
- [`CARD-PROGRESS.md`](CARD-PROGRESS.md): the state of the deck, generated.

**One writer per card, and that writer writes the whole card** (Opus, per
Adrian's model rule). The card is the unit, so the sources are read once.

## Which card to take

Open [`CARD-PROGRESS.md`](CARD-PROGRESS.md) and take the first unticked card.
One session works down from 64 and the other works up from 1, so no two
sessions open the same file. Nothing outside your own card is yours to edit.

## The six steps

Copy the block in `WORKSHEET.md` to `oracle/worksheets/NN.md` and fill it as
you go. The gate reads it.

**1. Place the card among the 64.** Read all 64 lines in the openings file.
Name the five to eight cards whose lines sit closest to this one. Then write
one sentence that says what only this card is, and check it: it must be
false for every one of those neighbours. Name the energy in a word a person
says they feel. Never use the shadow word. The card's own line in the openings
file is a draft to test like any other, and four of them name the shadow.
Then name the card's moment: the situation in a life this card is, in the
hexagram's own plain words. CODE's first sentence says that moment, and the
energy comes second, as what lives in it. Adrian, 2026-09-23, on card 64: "Why
don't you start by saying this is the moment just before something is
finished." Its reading had opened on the Gene Keys gift, so it read as
imagination in general, not as this card.

**2. Give each section its own facet before writing.** Read each section's
sources through that section's question in the brief:
- CODE: what this energy is, and how you stand in it.
- ICHING: what the situation is, and what it counsels.
- KEYS: what the energy becomes, from its lowest height to its highest.
- DESIGN: where it presses in you, and what it drives you to do.
- BODY: what your body is doing while you feel it.
- RELATIONS: where the energy goes next.

Write one line per section naming the facet that section carries. All six
lines are different. None of them restates the step 1 sentence in other words.
The obvious thing belongs to one section only, and the sheet names which. File
each true thing you find under the facet it serves, with its source file.

**3. Write each section through its shape.** The Combination takes the seven
moves. The trigrams take moves 2, 4 and 5. The Gene Keys take three heights
with one picture across them. The Body takes the join its three sources agree
on. Relations takes where the energy goes next. Each section uses only its own
facet and its own true things. This is the step where the template does the
assimilating. It cannot be done at the end.

**4. Read the card sideways.** Put the six facet lines side by side, then the
first and last sentence of every section. Wherever two say the same thing,
rewrite the weaker one from its own facet. Then look for the opposite fault:
two sections that say contrary things about the same thing. Settle it into one
line every section agrees with. On card 64, CODE said imagination shows you the
whole thing while DESIGN said the pictures do not make sense, and Adrian could
not tell which was meant; the line became "the picture is clear, the how is
not". Write in the sheet what you found and what you changed. "Nothing" is an
answer only when it is true.

**5. Write the reading's CODE, the keynotes and the entrance last**, from the
six facets together, with the brief's entrance section and `CARD-CHECKLIST.md`
open. Put the entrance beside the neighbours' opening lines. It must not
share their shape. On 2026-09-23 card 64's entrance took "arrives before you
can say", which cards 17, 23, 43 and 57 already use.

**6. Two checks, then Adrian reads it.**
- Run `npm run card:gate -- NN`. It runs the sentence script, the entrance
  and slop checks, and the sheet checks, and it refuses a card that names its
  energy by its shadow.
- Send one fresh reader (Sonnet), with no sources, the keywords, the entrance,
  the CODE section and the neighbours' opening lines, each sentence numbered.
  List this card among them with the step 1 sentence as its line, never its
  line from the openings file. It must restate every sentence in its own
  words, say which of the listed cards the text belongs to, and name any two
  CODE sentences that say the same thing. It does not count CODE against the
  entrance: the entrance summarises the card, so they share its core by
  design, and on card 64 every such fix cut the reading until Adrian read it as
  too short ("it's not really relating it to the card"). Paste its answer into
  the sheet. A pair counts only when the reader's own two restatements say
  the same thing; where they differ, quote both in the sheet and the pair does
  not count (Adrian, 2026-09-23: twelve of twelve strict readers on card 64
  each found exactly one pair, the last with two different restatements). It
  passes only when it names this card and finds no repeats inside CODE.

Then regenerate `data/oracle-corpus.json` and `data/oracle-search-index.json`
(`node --import tsx scripts/build-oracle-corpus.ts`, then
`scripts/build-search-index.ts`) and run `npm run progress`, all in the same
commit as the card. Leave every `status:` as `scaffold`. `final` is Adrian's
word alone.

## Copy this to dispatch a card

> OPUS: card prose is written by Opus per Adrian's model rule (oracle cards, 2026-09-16); this is oracle card copy for his review.
>
> Worktree: <path>. Read, in this order and whole: `oracle/CARD-PASS.md`, `oracle/WRITERS-BRIEF.md`, `todo/plans/writing-guideline/entrance-openings.md`, `oracle/WORKSHEET.md`, `oracle/CARD-CHECKLIST.md`. They are the rule; I am not restating it here and nothing in this message overrides them.
>
> Your card: NN. Follow the six steps in `oracle/CARD-PASS.md` in order, filling `oracle/worksheets/NN.md` as you go, until `npm run card:gate -- NN` passes.
>
> Final message: the step 1 sentence and its neighbours, the six facet lines, the entrance, the gate's last line, and "Least sure:" with the two sentences you trust least.

## Where the deck stands

Run `npm run progress` for the count. Card 64 was written whole on 2026-09-23
under the old process and is being rebuilt under this one as the model card.
Once Adrian has read it, what he corrects there is added to the brief, and the
other cards follow.

Still waiting on Adrian: card 3 has two opening lines, one on `main` and one
on the closed `claude/card-writing` branch, and neither is settled. The
entrance does not render on the card page yet. It belongs under the header
"Message at a glance".
