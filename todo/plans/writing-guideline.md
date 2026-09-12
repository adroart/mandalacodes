# One writing guideline for the deck: where the writing is, what it is meant to be, and what the sources allow

Status: survey complete, 2026-09-12. Nothing has been written against it yet.
Next step is the Fable pass (section 8), then the guideline itself.

This file is the synthesis. The four raw survey reports and the measurement
script sit beside it in `writing-guideline/`:

- [survey-specs.md](writing-guideline/survey-specs.md), every spec document read, per section, with contradictions cited
- [survey-current-state.md](writing-guideline/survey-current-state.md), all 64 cards measured, six cards read closely
- [survey-sources.md](writing-guideline/survey-sources.md), the book-extract corpus in the vault, family by family
- [survey-render.md](writing-guideline/survey-render.md), what a visitor actually sees, surface by surface
- [measure.mjs](writing-guideline/measure.mjs), re-run from the repo root with `node todo/plans/writing-guideline/measure.mjs` to re-measure word counts, formulas and cross-references after any pass

Read the raw reports when a claim below needs its evidence. This page is the
map.

## 1. Where things stand, in one paragraph

Sixteen documents describe how a card should be written. No single one of
them is the spec. They stack three ways (structure from `WRITING_METHOD.md`,
voice and copyright from the older `00` to `06` guides, the opening reading
from `todo/plans/reading-rewrite.md`), and a writer has to apply the
precedence rule field by field to find out which one wins. The master guide
still describes a five-section card; the deck shipped with six. None of the
sixteen says how one section should speak to another. The 64 cards are
finished, present in every section, mostly well written, and all but one are
`scaffold`. The opening readings are known to be in the wrong register (your
diagnosis, 2026-09-02) and the rewrite was routed into WordForge and has not
started. The vault holds a wide book corpus for the I Ching and Gene Keys
sections and almost nothing for the connective layer (trigram meaning,
immortals, ring themes, tarot cross-mapping), which is exactly the layer the
Relations section reaches for. 52 of 64 cards carry no record of which
sources they came from.

## 2. The card as it exists

One Markdown file per card, six `##` sections, 27 fixed subsections. The
compiler refuses to build a card that is missing any of them, so this shape is
a hard constraint, not a convention.

| Section | Subsections | Median words | Job as the specs state it |
|---|---|---|---|
| CODE | the reading (three paragraphs), keywords line | 324 | The whole code spoken plainly, no system named. Complete on its own. |
| ICHING | Combination, Upper trigram, Lower trigram, Reading, Judgement, Image, six Moving lines | 992 | The situation and its natural image. Moving lines are internal relating and live only here. |
| KEYS | Shadow, Repressive nature, Reactive nature, Gift, Siddhi | 742 | One energy at three altitudes. Describe the energy, never diagnose the reader. |
| DESIGN | The drive, Where it lives, What completes it | 472 | The code in the energy body: gate, centre, channel. Partner gate here; partner card in Relations. |
| BODY | Physiology, Amino acid | 390 | The literal floor the other systems describe. Chemical seat here; ring siblings in Relations. |
| RELATIONS | Pair, Inverse, Programming partner, Codon ring, Tarot, Immortals, Deeper correlation | 701 | The doorway out. Outward relating only. Teach the bond, hide the machinery. |

What a visitor meets, in order (from the render survey): card name, hexagram
glyph and keywords as chips; then six horizontally swiped panels labelled
Universal, I Ching, Gene Keys, Human Design, Body, Relations. The first prose
read is the CODE reading, drop-capped. Its first paragraph is also the card's
`essence`: the search anchor, the MCP summary, and what a cast shows for the
resulting hexagram. That one paragraph is the most load-bearing prose on a
card and no spec treats it as a unit.

Three things the renderer does that the writing must respect:

- Name, keywords, hexagram name, gate number and the three Gene Keys names are
  shown as labels before any prose. Prose that re-announces them wastes its
  first sentence.
- No markdown survives to the page. Bold, italics, lists and blockquotes
  inside prose render as literal characters or collapse into one block. Plain
  paragraphs only. The `_Keywords:_` line, the `### Sub — Tail` headings and
  the `**Line N** · _image:_` markers are structure the parser consumes, not
  styling.
- The cast happens inside the card page. A visitor who throws coins reads only
  the moving line(s) that fell, in full, plus the resulting card's essence.
  Each moving line must therefore stand alone.

## 3. What is actually wrong with the writing, measured

The close reads and the numbers agree on five faults. They are listed by
cost, not by count.

1. **The opening readings are in the wrong register.** Cards 1, 23, 33 and 47
   each spend two of three paragraphs on the shadow face before one paragraph
   of return. This is the imbalance you named: the card arrives as a problem
   to solve, not an energy to meet. The prose is good; it is saying the wrong
   kind of thing. 15 of 64 readings also close on the same stem ("What this
   asks is small", "So the work is to"), a formula in the one section that
   must read bespoke. Nothing on disk yet follows the live spec for the
   reading, by design, since the rewrite was moved into WordForge.

2. **CODE and ICHING are islands; the other four talk to the card.** Across
   the deck CODE names its own card once and says "code" four times; ICHING
   touches a Gene Keys term in 15 cards and the gate keyword in 9. DESIGN,
   BODY and RELATIONS say "this code" in all 64. The result on a well-made
   card is six well-written encyclopedia entries on one subject, each opening
   its own metaphor from scratch (card 1: dragon, coals, itch, forge, pair).
   Where the deck already does it right, the mechanism is visible: card 2
   carries the mare from ICHING into CODE; card 23 holds the throat across
   CODE, DESIGN and BODY; card 33 restates three ideas with three different
   images; card 47 has five sections converge on "pressure becomes fuel"
   without copying a sentence. Those four cards are the evidence for what the
   guideline should ask of all 64.

3. **One house tic reads as the deck's fingerprint.** "Not X. It is Y" (a
   fragment negation, then the correction) appears two to four times in every
   card read, in every section. The master guide allows it once per card. It
   is now more consistent than any repeated sentence stem the diversify passes
   removed. Alongside it: the stock Siddhi paradox ("there is no technique for
   arriving", "both are true at once"), and the summarising closer ("The maker
   gets made").

4. **KEYS still carries the formula class the other five sections were swept
   of.** 36 of 64 cards open Repressive and Reactive with the identical stem
   ("The inward face of the Shadow", "The outward face of the Shadow"). The
   Immortals subsection opens "[Name] stands above" on 52 of 64. Both are the
   same fault fixed in ICHING, BODY, RELATIONS (2026-09-01) and DESIGN
   (2026-09-08) with a written method. Agent-runnable; no new method needed.

5. **Register shifts by section and no document says so.** CODE, KEYS and
   DESIGN address "you"; ICHING teaches in "the" and "one"; BODY and RELATIONS
   describe "this code". Predictable, but it is one more way the six sections
   read as six documents. Card 33 stays in "you" into BODY ("put a hand to
   your throat and swallow") and reads as the most unified of the six.

Not wrong, and worth stating so nobody "fixes" it: em dashes appear only as
structural delimiters in headings and the Tarot and Deeper correlation label
bullets, never in a sentence; italics appear only as the eleven fixed
structural labels per card; Relations headings vary (Pair alone, Pair plus
Inverse, or a bespoke self-inverse heading) exactly where the I Ching's
pairing logic forces it; the trigram and codon-ring openings repeat because
there are only eight trigrams and sixteen rings.

## 4. The interconnection gap, stated precisely

The specs govern connection only by subtraction. Every cross-section rule is
"do not repeat what belongs elsewhere": moving lines stay in ICHING, the
partner card stays in RELATIONS, ring siblings stay out of BODY, KEYS must not
re-teach the hexagram. The one positive test in the whole set is Step D of
the reading rewrite (would a reader who knows only the I Ching, only Gene
Keys, only Human Design, only Tarot each recognise this as theirs). Nothing
equivalent exists for the five teaching sections, and nothing tells a writer
how an image, a body location or a thesis sentence is meant to travel from
one section into the next.

Two connections are stated once each and nowhere else: BODY must read KEYS
first so its imagery sits inside the established Shadow, Gift, Siddhi voice
(the deep-pass addendum); the invocation may draw felt textures from the
hexagram's natural image (the invocation guide, stated from the invocation's
side only). And two beats were invented independently in two sections with
no cross-reference: the "common misread" beat in DESIGN's drive and the
"most people treat this as a fault" beat in KEYS' Shadow; the Human Design
centre ("where it lives") and BODY's organ are both "where in the body" and
no rule keeps them from reading as the same claim twice.

So the guideline's genuinely new content is a positive model of how the six
sections carry one energy: which section owns the governing image, which
sections are allowed to inherit it and how (restate, vary, answer, or
callback), what the one-breath truth is and where it may recur verbatim (the
master guide says once; card 64 uses it as a refrain and it works), and a
test that fails when a section could be moved to another card with only the
names changed (card 23's KEYS fails it today).

## 5. What the sources allow

The corpus lives at `~/Documents/Obsidian Vault/Mandala Codes/oracle/`, not
the path `oracle/INDEX.md` still cites. Per hexagram: six I Ching
translations (Legge, Wilhelm, Huang, two Cleary, Deng), the Eranos philology,
a practical guide, the Gene Keys chapter, the 64 Ways essay, a structured
Gene Keys reference row, the Quantum Wellness gate essay, roughly eighteen
tarot correspondence cards, six moving-line files carrying five translators
each, and your own index file. Beside them: 22 codon-ring membership tables,
64 scraped gate articles, 36 channel articles, nine deep centre chapters, and
seven unwired Human Design books.

Where it is thin, by section:

- ICHING Combination and the two trigram natures: no file anywhere says what
  a trigram means. `systems/trigrams/` is ten empty files.
- RELATIONS Immortals: `systems/eight-immortals/` is ten empty files. Every
  card that wrote one imported lore from outside the vault and said so.
- RELATIONS Tarot and Deeper correlation: the three cross-mapping files in
  `systems/tarot/` are empty; cards reverse-engineered sky and Hebrew letter
  from whichever hexagram folder happened to hold the right Major Arcana card.
- RELATIONS Codon ring and Pair: membership and pairing are facts with no
  teaching behind them. The prose connecting two paired cards is invented per
  card.
- BODY Physiology: the organ is named in one line of the Gene Keys chapter and
  nowhere else.
- Hexagrams 50 to 64: 39 extract files are empty stubs from one shared
  extraction failure (Gene Keys chapter, Eranos, practical guide, Wilhelm).
  A batch over those cards writes from thin air until they are refilled.

Two facts about how the sources have been used: only 12 cards record their
sources at all, in two different conventions; and Wilhelm, the most quoted
English I Ching, is populated for 54 hexagrams and cited by none.

Rights: Legge is public domain. Everything else is in copyright, and three
families are long verbatim dumps (the Gene Keys chapter up to 15,000 words,
the 64 Ways essay, the centre chapters up to 12,000). The guideline's
paraphrase rule matters most there. Names, ring membership and correspondence
tables are facts and can be stated directly.

## 6. Spec contradictions the guideline must settle

Each of these is a place where two live documents disagree and a writer
currently has to guess. The guideline resolves them once; the old documents
get a supersession line pointing here.

1. KEYS length: `01_DESCRIPTION_SPEC.md` says ~230 words total with
   repressive and reactive as clauses inside Shadow; `WRITING_METHOD.md` says
   ~600 with them as separate fields. The deck follows the longer one.
2. The Human Design channel: `06_CONNECTIONS_GUIDE.md` teaches it inside
   Relations; the schema and every card put it in DESIGN as internal
   relating. DESIGN is right and no notice says so.
3. Trigram-level tarot: the connections guide places it in Deeper
   correlation; every card places it under Tarot and keeps Deeper correlation
   for sky and Hebrew letter. The cards are consistent; the guide is not.
4. Card anatomy: `00_MASTER_WRITING_GUIDE.md` §4 and §5.4 deny DESIGN and
   BODY exist as prose sections. They do.
5. The one-breath truth: the master guide wants one per card used
   everywhere; the reading rewrite computes its own for CODE with its own
   ratification gate. Nobody says whether they are the same sentence.
6. The ICHING reading ceiling: 200 to 320 in the method table, 200 to 300 in
   its own addendum.
7. Naming: the card title says "UL 1", the first section heading says
   "CODE", the vision doc's nav bar says "UL 1 · ICHING · …", the pill nav
   says "Universal". Pick one word for the thing and use it in headings, chips
   and prose.
8. Source naming: the master guide says never name a source anywhere;
   `CONCEPT.md` §11 allows lineages to be named in the teaching layer
   (Relations, an about page). The two-tier rule is the intended one and most
   guides quote the flat one.
9. Status: the guides define one status per card; the files carry one per
   section. The per-section shape is right and undocumented.
10. `oracle/manuscripts/` and `oracle/editorial/` exist, hold card 23 in a
    per-lens layout one diversify pass behind `oracle/cards/23.md`, and are
    named in no document. They are migration residue and should be archived.

## 7. Found in passing, not writing work

Filed here so they are not lost; none belongs in the guideline.

- **Hard-coded card 1 text on every card.** The live page shows card 1's
  repressive and reactive paragraphs, its gate chips ("Gate 1", "Identity
  Center", "Channel of Inspiration 1–8") and its body labels ("Ring of Fire",
  "The Liver", "Lysine") on all 64 cards. The authored repressive and reactive
  prose never reaches a visitor. `components/oracle/eb/generated/EBReading.generated.tsx`
  around lines 601, 748 and 790. Filed as a task chip during the survey.
- **Cards 1 and 2 lost their locked status in the JSON-to-Markdown move.**
  Their KEYS, DESIGN and RELATIONS were `final` in the source JSON and are
  `scaffold` in the files that now ship. `todo/DEVELOPMENT-STATUS.md` counts
  are stale against the Markdown for the same reason.
- **The Judgement and Image bullets collapse into one run-on line** on the
  page (joined with newlines into a single paragraph, no `pre-line`).
- **`oracle/INDEX.md` cites the vault at a path that does not exist.**
- **The i64os MCP rejected its bearer token** this session, so transcript
  recall was unavailable.

## 8. The Fable pass: what to feed it and what to ask

Fable holds taste and copy on this project. The pass is analysis, not
writing; no card prose changes.

Feed it: this page; `oracle/CONCEPT.md`; your 2026-09-02 diagnosis and the
four-questions synthesis model from `todo/plans/reading-rewrite.md`; the six
closely read cards in full (01, 02, 23, 33, 47, 64); and the section 5 table
of what the sources can support. Withhold the sixteen spec documents; they
are the thing being replaced, and reading them teaches the shape that
produced the current faults.

Ask it for three things, in this order:

1. **A verdict per section on the six cards**: which sections carry the
   card's energy and which could be lifted onto another card unchanged. Its
   own read of the interconnection, before it sees the measurements in
   section 3, so the measurement does not lead the judgement.
2. **The model of one energy across six sections**: who owns the governing
   image, how it travels, where the one-breath truth may recur, how register
   is allowed to move, and the test that fails a stapled-on section. Written
   against the 27-subsection shape and the render facts in section 2, not
   against an ideal card.
3. **The guideline's table of contents**, one document, with a line per
   heading saying what it takes from the sixteen (voice rules, the anti-
   formula method, the keywords stranger test, the translation method, the
   deep-pass standard for ICHING and BODY, the hide-the-machinery rule for
   Relations) and what is new.

Then the guideline is written, the ten contradictions in section 6 are
settled inside it, and every older document gets a two-line supersession
notice pointing to it. The reading rewrite's four-questions method becomes
one chapter of it, not a separate plan.

Before the pass runs, one input only you can give: the problems you have with
the current writing, in your own words. The survey found the faults it could
measure; yours are the ones that matter, and the pass should be aimed at them.
