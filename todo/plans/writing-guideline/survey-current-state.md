# Mandala Codes oracle writing, current state

Survey of the 64 card manuscripts at oracle/cards/01.md through 64.md, read-only.
Measurement script: analyze.mjs in this same folder. Raw measurements:
analysis-data.json in this same folder.

A note on method before the numbers. Twenty-six of the 64 card files carry a
trailing HTML comment block (a sourcing log plus a fact check note, sometimes
over a thousand words) sitting immediately after the visible prose, with no
heading of its own. A naive word count that does not strip HTML comments picks
that block up as part of whatever the last visible heading was (usually
Deeper correlation in RELATIONS), which is why an early pass of this analysis
showed one card's RELATIONS section at 2,257 words against a median of 700.
The script strips HTML comments before counting anything. Every number below
is post-strip, body-prose only, frontmatter excluded.

## Part A: measured across all 64 cards

### 1. Word counts per section

All six sections (CODE, ICHING, KEYS, DESIGN, BODY, RELATIONS) are present in
all 64 cards. Word counts, section as a whole (subsections included):

| Section | Min | Median | Max | Min card | Max card |
|---|---|---|---|---|---|
| CODE | 293 | 324 | 379 | 53 | 24 |
| ICHING | 825 | 992 | 1073 | 1 | 63 |
| KEYS | 623 | 742 | 814 | 1 | 62 |
| DESIGN | 368 | 472 | 530 | 1 | 22 |
| BODY | 340 | 390 | 442 | 29 | 4 |
| RELATIONS | 476 | 701 | 801 | 1 | 49 |

Card 1 is the min or near-min on four of six sections. Card 1 is the deck's
original locked reference card (see its own sourcing note), and its prose
sits noticeably leaner than the deck-wide median throughout, most of all in
RELATIONS (476 words against a 701 median, the shortest RELATIONS in the
deck) and KEYS (623, also the shortest). CODE is the tightest section
deck-wide (only 86 words separate the shortest and longest, 293 to 379),
which matches its role as the one section written to a fixed three-paragraph
shape (see Part 3 below).

Word counts, by subsection:

| Section > subsection | Min | Median | Max | Min card | Max card |
|---|---|---|---|---|---|
| ICHING > Combination | 66 | 92 | 114 | 6 | 49 |
| ICHING > Upper trigram | 39 | 51 | 64 | 1 | 9 |
| ICHING > Lower trigram | 39 | 50 | 64 | 61 | 18 |
| ICHING > Reading | 215 | 271 | 309 | 1 | 55 |
| ICHING > Judgement | 16 | 32 | 45 | 56, 60 | 48 |
| ICHING > Image | 18 | 26 | 34 | 6 | 24, 25 |
| ICHING > Moving lines | 384 | 464 | 518 | 1 | 63 |
| KEYS > Shadow | 197 | 227 | 262 | 3 | 62 |
| KEYS > Repressive nature | 40 | 53 | 63 | 3 | 15, 24 |
| KEYS > Reactive nature | 38 | 52 | 61 | 1 | 27 |
| KEYS > Gift | 191 | 219 | 251 | 6 | 37 |
| KEYS > Siddhi | 135 | 186 | 209 | 1 | 13, 63 |
| DESIGN > The drive | 123 | 175 | 221 | 1 | 3 |
| DESIGN > Where it lives | 116 | 150 | 177 | 1 | 6 |
| DESIGN > What completes it | 126 | 143 | 177 | 13 | 10 |
| BODY > Physiology | 188 | 225 | 254 | 29 | 45 |
| BODY > Amino acid | 143 | 166 | 196 | 59 | 7 |
| RELATIONS > Pair | 43 | 62 | 77 | 4 | 63 |
| RELATIONS > Inverse | 36 | 51 | 83 | 64 | 27 |
| RELATIONS > Programming partner | 39 | 62 | 78 | 1 | 51 |
| RELATIONS > Codon ring | 48 | 68 | 95 | 1 | 26 |
| RELATIONS > Tarot | 136 | 331 | 379 | 1, 60 | 26 |
| RELATIONS > Immortals | 48 | 69 | 96 | 1 | 28 |
| RELATIONS > Deeper correlation | 53 | 70 | 97 | 31 | 49 |

RELATIONS > Tarot has the widest spread of any subsection relative to its
median: 136 to 379 words. That variance is structural, not a writing
inconsistency: a card whose two trigrams are the same (an 8-of-64 case, e.g.
card 2, both trigrams Earth) only has one trigram face-pair to describe
instead of two, so its Tarot subsection is legitimately shorter.

Three subsection headings occur only once or three times each and are not
part of the standard 27-subsection template: RELATIONS > Opposite (cards 28,
29, 39), RELATIONS > Pair and inverse (card 28), RELATIONS > This code and
itself (card 29), RELATIONS > Pair / Inverse (card 40), and ICHING > Upper
and lower share Wood (card 32, an added subsection, not a substitute for an
existing one). All five are self-inverse or shared-trigram special cases
where a writer chose a bespoke heading rather than force the standard
Pair/Inverse split; see item 5 below.

### 2. Frontmatter status per lens

| Lens | scaffold | final |
|---|---|---|
| code | 64 | 0 |
| iching | 63 | 1 |
| keys | 63 | 1 |
| design | 63 | 1 |
| body | 63 | 1 |
| relations | 63 | 1 |

The one final card, on every lens, is card 3 (Messengers of the Infinite).
No other card carries final anywhere in oracle/cards. This does not match
todo/DEVELOPMENT-STATUS.md, which reports Gene Keys final on 2/64, Human
Design final on 3/64, and Relations final on 2/64. Checking the legacy
per-lens source JSON in oracle/sections explains the gap: card 1 is final
there for keys, design, relations, and card 2 is final there for design, but
neither carried the final status forward into its oracle/cards/NN.md
frontmatter, where both are marked scaffold across every lens including
CODE. Card 1's own sourcing note says as much directly: "KEYS, DESIGN, and
RELATIONS were Adrian-locked (status final in their source JSON)... This
Markdown was assembled from the existing finished section work, preserving
every word," yet the frontmatter status block written into the assembled
markdown reads scaffold on every line. So the writing itself may still be
Adrian-approved prose, but the file that is now the source of truth for the
deck (oracle/cards/01.md, 02.md) reports a lower status than the content
warrants, and DEVELOPMENT-STATUS.md's counts are stale against the current
markdown.

### 3. Formula detection

Openings compared: first five words of the first sentence, per subsection
(all 64 cards), and per paragraph in CODE (all 64 cards). Only matches at 3
or more cards are formulas by the letter of the brief; two classes of match
below are excluded from "real formula" because they are forced by the
deck's fixed structure (only 8 trigrams, 16 codon rings, 8 immortals), not
by a writer defaulting to a stock phrase.

Structural, not a writing fault (excluded from the formula count):
- ICHING > Upper trigram and Lower trigram open with the trigram's own name
  (e.g. "Heaven, Qian" or its plain-English retelling), clustering into
  exactly 8 groups of 7 to 8 cards each, one group per trigram. There are
  only 8 trigrams; every card's upper and lower trigram is one of them, so
  this is the deck's binary logic surfacing in the prose, not stock phrasing.
- RELATIONS > Codon ring openings cluster by ring name ("Within the ring of
  X..." or "Within the codon ring of X...") because there are only 16 rings
  and the subsection exists specifically to name the ring.
- RELATIONS > Immortals openings are "[Immortal name] stands above..." on
  52 of 64 cards (grouped 6 to 7 cards per immortal, one group per one of
  the 8 upper-trigram immortals). This is closer to a real formula than the
  trigram case: nothing forces the sentence to start with the name and the
  word "stands," a writer chose that shape and repeated it in every single
  Immortals subsection in the deck (all 64, not just the 52 sharing the
  exact five-word match; the remaining 12 use a synonym of "stands," not a
  different structure). Low cost to fix (it is a single connective
  sentence, not the substance of the subsection) but worth naming as the
  most totalizing single-sentence formula in the deck.

Genuine formulas, not structurally forced:

| Subsection | Shared opening | Cards | Count |
|---|---|---|---|
| KEYS > Repressive nature | "The inward face of the [Shadow]" | 1,2,3,4,5,6,7,11,12,13,14,15,18,21,22,24,25,27,34,36,37,38,45,46,47,48,52,53,55,57,58,59,61,62,63,64 | 36 |
| KEYS > Reactive nature | "The outward face of the [Shadow]" | 1,2,3,4,5,6,7,11,12,13,14,15,18,21,22,24,25,27,34,36,37,38,45,46,47,48,52,53,55,57,58,59,61,62,63,64 | 36 |
| ICHING > Moving lines, Line 1 | "**Line 1** _image:_ the..." | 23 cards | 23 |
| ICHING > Moving lines, Line 1 | "**Line 1** _image:_ a..." | 12 cards | 12 |
| RELATIONS > Inverse | "Turn this code's lines over..." | 8,10,19,38,41,48,57,60 | 8 |
| RELATIONS > Inverse | "Turn this code upside down..." | 1,2,27,59 | 4 |
| RELATIONS > Pair | "Turned over, this code becomes..." | 15,22,26,44 | 4 |
| KEYS > Reactive nature | "Others answer it by never..." | 35,42,56 | 3 |
| KEYS > Siddhi | "What is left when the..." | 14,25,49,57 | 4 |
| BODY > Amino acid | "Deeper than the organ, this..." | 1,4,6 | 3 |
| RELATIONS > Codon ring | "This code sits in the..." | 13,45,50 | 3 |

The KEYS Repressive/Reactive pair is the single clearest formula in the
deck: 36 of 64 cards (56%) open both subsections with the identical
sentence stem, word for word except the shadow name plugged in. This is
exactly the fault pattern the project's own diversify-pass method already
found and fixed in ICHING, BODY, and RELATIONS (2026-09-01) and in DESIGN
(2026-09-08, PR #180, ban stems not phrases): see Part C. KEYS was not
included in either swept list and still carries the identical class of
formula at a higher rate (56%) than DESIGN did before its sweep (51/64,
80%, per the archived todo item), so it reads as the one lens the existing
cleanup method has not yet reached, not a new problem needing a new method.

CODE section, first five words of every paragraph (paragraphs, not
subsections, since CODE has none):

| Opening | Cards | Count |
|---|---|---|
| "What this asks is small" | 4,12,16,20,33,36,41,46,48,56 | 10 |
| "So the work is to" | 27,32,37,60,61 | 5 |
| "So the work is small" | 5,22,47 | 3 |
| "The trouble starts when the" | 17,18,60 | 3 |
| "What the code asks is" | 18,35,45 | 3 |

Fifteen of 64 cards (23%) close their CODE reading's final paragraph with
some variant of "What this asks..." or "So the work is...". CODE is the one
section meant to read as bespoke direct address rather than encyclopedia
entry (see Part B), so a repeated closing formula there costs more than the
same repetition would in KEYS or RELATIONS. This is also the section
flagged by Adrian's own 2026-09-02 note in todo/plans/reading-rewrite.md as
the one getting a full rewrite regardless (see Part C), so this specific
formula may already be moot pending that rewrite, but it is worth recording
as a second data point for what "the CODE section reads formulaic" means
concretely.

### 4. Interconnection: does each section talk to the card, or sit as an island

Per section, counts across all 64 cards of references to: the card's own
name, the word "code," either trigram name, any of the three Gene Keys terms
(shadow/gift/siddhi), the Human Design gate keyword, and the organ or amino
acid name.

| Section | Card name refs (cards) | "code" refs (cards) | Trigram refs (cards) | Gene Keys term refs (cards) | HD gate keyword refs (cards) | Organ/amino refs (cards) |
|---|---|---|---|---|---|---|
| CODE | 1 (1) | 4 (4) | 29 (17) | 66 (32) | 27 (15) | 7 (4) |
| ICHING | 0 (0) | 2 (2) | 825 (64) | 74 (15) | 47 (9) | 4 (2) |
| KEYS | 3 (3) | 15 (13) | 49 (19) | 639 (64) | 35 (13) | 3 (3) |
| DESIGN | 0 (0) | 255 (64) | 14 (5) | 83 (32) | 161 (44) | 12 (7) |
| BODY | 0 (0) | 239 (64) | 31 (9) | 152 (57) | 31 (20) | 211 (63) |
| RELATIONS | 0 (0) | 297 (64) | 795 (64) | 185 (49) | 55 (20) | 5 (4) |

("Card name refs" counts occurrences of the card's own evocative name, e.g.
"Earth's Breath," inside that card's own section prose.)

Reading the table: CODE almost never names the card it is on (1 card out of
64), almost never says the word "code" (4 of 64), and touches the Gene Keys
terms in exactly half the deck (32 of 64) but the Human Design keyword in
fewer than a quarter (15 of 64). CODE is written in its own vocabulary
(fire, the tangle, the drop, whatever image that card's writer chose) rather
than in the deck's cross-referencing vocabulary, which is consistent with
Part B's close reading: CODE reads as a freestanding meditation, not a
synthesis of the other five lenses.

ICHING is the deck's other island: it references Gene Keys terms in only 15
of 64 cards and the HD keyword in only 9, and never once names the card or
says "code." It talks fluently about trigrams (all 64 cards, by definition,
since ICHING is where the trigrams are described) but almost nothing else.

DESIGN, BODY, and RELATIONS are the three sections that consistently call
back to the rest of the card: all three say "code" in all 64 cards (this is
the literal payload of their closing formula, e.g. "The code runs all the
way down to this," see Part B), and BODY in particular references the organ
or amino acid in 63 of 64 cards, which is exactly what it should do since
that is BODY's own subject matter.

No section, in any card, ever names the card's own evocative title inside
CODE, DESIGN, or BODY prose. The card's own name effectively only appears in
its own heading line, its Keywords line, and occasionally the RELATIONS
intro caption ("Met by UL 2...") where the sibling card's name is used, not
the card's own. This is a real and consistent finding: across 384 section
instances (64 cards times 6 sections), a card refers to itself by its own
poetic name only 4 times total (1 in CODE, 3 in KEYS).

### 5. Missing sections or subsections, and heading deviations

No card is missing any of the six required H2 sections (CODE, ICHING, KEYS,
DESIGN, BODY, RELATIONS): 64 of 64 present, always.

Within KEYS, ICHING, DESIGN, and BODY, every expected subsection (the fixed
template: Combination, Upper trigram, Lower trigram, Reading, Judgement,
Image, Moving lines for ICHING; Shadow, Repressive nature, Reactive nature,
Gift, Siddhi for KEYS; The drive, Where it lives, What completes it for
DESIGN; Physiology, Amino acid for BODY) is present in all 64 cards. No gaps.

RELATIONS is the one section with real structural variation, all of it
traceable to the I Ching's own pairing logic rather than to an inconsistent
writer:

- 32 of 64 cards have a Pair subsection but no separate Inverse subsection.
  In every one of these 32 (spot-checked cards 3, 33, 47, and 62 in full),
  the card's pair hexagram and its inverse hexagram are the same number
  (e.g. card 3's pair and inverse are both UL 4). Rather than write two
  subsections that would say the same thing twice, the writer merges them
  into one Pair subsection and never opens an Inverse heading. This is
  consistent, deliberate, and not a defect.
- 28 of 64 cards have both a separate Pair and a separate Inverse
  subsection, because the pair and inverse hexagrams genuinely differ.
- 8 of 64 cards (1, 2, 27, 28, 29, 30, 61, 62; confirmed against the "one of
  only eight" self-inverse language repeated in cards 1 and 2's own prose)
  are self-inverse, meaning the card is its own inverse. Five of these use
  the standard Inverse heading with prose explaining the self-reflection
  (cards 1, 2, 27, 30, 61); three use a bespoke heading instead: card 28
  ("Pair and inverse"), card 29 ("This code and itself"), and by a different
  route card 39/40 use "Opposite" and "Pair / Inverse" respectively for a
  related but not identical relations quirk (opposite-hexagram emphasis).
  None of these bespoke headings are errors; each explains its own case in
  its subsection body, they are just not the majority spelling.
- Card 32 adds one subsection to ICHING that no other card has: "Upper and
  lower share Wood," because card 32 is the one hexagram in the deck whose
  two trigrams (Thunder and Wind) both belong to the Wood element in the
  five-element system, a genuine one-off worth a genuine one-off heading.

Net: zero missing content, one deliberate added subsection, and RELATIONS'
apparent inconsistency is fully explained by which cards' pair equals their
inverse. Nothing here needs fixing.

### 6. Em dashes and italic/underscore emphasis in body text

Across all 64 cards, body prose (frontmatter and the trailing HTML comment
blocks excluded) never uses an em dash inside a sentence. Every single em
dash that survives stripping (410 total, 3 to 7 per card, median 7) sits
inside a bulleted "Label, Value:" line in the Tarot and Deeper correlation
subsections (for example "- **Sky, Sagittarius:** the mutable fire..."),
which is the same structural delimiter the H3 headings themselves use (e.g.
"### The drive, Gate 1, Self-Expression"). Confirmed by isolating every
line containing an em dash that is neither a heading nor a "- **Label**"
bullet: zero lines matched, across all 64 files. So the "no em dash"
convention is intact everywhere it is meant to be intact; the deck simply
reuses the em dash as one fixed structural glyph, never as sentence
punctuation.

Italic or underscore emphasis is exactly 11 instances per card, on every
single card, no exceptions. Inspecting where: it is always the same 11
structural micro-labels, never a word or phrase emphasised inside a running
paragraph. Per card: 1 for the CODE "_Keywords:_" label, 6 for the six
"_image:_" tags inside Moving lines, 3 for the "_Shadow:_ / _Gift:_ /
_Siddhi:_" inline labels under the KEYS heading, and 1 for the italicised
one-line RELATIONS intro caption ("_Met by UL 2, this is..._" or "_Read
alongside UL 34..._"). Zero cards use italics for emphasis inside a
sentence. This is a genuinely clean, deck-wide pattern: emphasis marking
is 100 percent structural, 0 percent expressive.

## Part B: close reading of cards 01, 02, 23, 33, 47, 64

Card 23's oracle/editorial/23 and oracle/manuscripts/23 folders were checked.
Both are migration receipts, not editorial commentary: editorial/23 holds
seven files (CARD.md plus one per lens) each carrying only the imported
sourcing_log and fact_check text already present in card 23's frontmatter,
with no new human notes added. manuscripts/23 splits the same card into one
file per lens (code.md, iching.md, and so on); diffed against oracle/cards/
23.md, the prose is byte-identical, just re-packaged with a small schema
frontmatter block. Neither folder adds anything a close reading of
oracle/cards/23.md does not already show.

### Card 1, Earth's Breath (The Creative)

The CODE reading runs the shape every card in this sample runs: paragraph
one names the lit, generative face of the code ("There is a fire in you
that begins things... You are most yourself here, lit and moving"),
paragraph two names its low or shadow face ("Then it drops, and almost no
one is told the quiet is the same fire"), paragraph three resolves into
instruction ("So the art of it is small and takes most of a life... Only
to carry while it is here, and to let go the moment it goes"). It lands
because the central image, fire that burns clean then bank down to coals
that are still doing work, is sustained and literal rather than
decorative; nothing in the reading needs the reader to already know Gene
Keys or Human Design to feel true.

ICHING, KEYS, DESIGN, BODY, and RELATIONS read as five well-written but
separate encyclopedia entries on the same subject rather than one
argument in five voices. Each opens its own metaphor from scratch: ICHING
gets the dragon rising through six positions, KEYS gets fire and coals
again (independently arrived at, not cross-referenced from CODE), DESIGN
gets an itch toward expression, BODY gets the liver as a hidden forge,
RELATIONS gets the pairing of pure force and pure ground. They agree in
tone and in the deep structural point (creative force needing to be fed
before it can create, stated independently in both KEYS and BODY), but
none of them says "as CODE already showed you" or otherwise signals that
the reader has been here before four sections ago. The strongest single
sentence: "The fire was never yours" (ICHING > Reading), which lands
because it recurs almost unchanged at the very end of CODE, giving the
reader one moment where two sections do audibly answer each other.

Weakest sentence, KEYS > Gift: "The maker gets made." This is the exact AI
tell the brief asks about: a punchy summarizing inversion planted at a
paragraph's end that sounds conclusive without adding information, the
kind of line that could close a hundred different paragraphs about a
hundred different subjects unchanged.

Register: consistently "you," addressed straight at the reader, in CODE,
KEYS, and DESIGN. ICHING switches into "the" and "one" (teaching-the-
tradition register: "The counsel is not to make more..."), and RELATIONS
mostly describes "this code" in third person. So register shifts
predictably by section, not randomly, but it does shift, which is one more
way the six sections read as different documents.

AI tells: the "not X but Y" construction appears repeatedly and does real
work here rather than padding ("It is not possible to be [lost]... The
feeling is a true reading the body takes and a false fact" in card 2, not
card 1, but the same construction shows up in card 1's DESIGN: "It is
none of those. It is the creative force trying to show up..."). Triads
show up in the RELATIONS Tarot bullet prose ("Flow, Alignment" style
paired abstractions) more than in the CODE prose, which mostly avoids them.

### Card 2, Beyond the Shell (The Receptive)

CODE opens on dislocation ("Some people carry a quiet sense of being
slightly out of place... a home you cannot name and have never actually
seen") and resolves into surrender rather than effort ("So the way back is
not a search. It is a softening"). This is the deck's clearest example of
a reading built entirely around one physical image, the mare that "has the
spirit of the racing horse but runs along the ground," carried from ICHING
straight into CODE almost as a paraphrase, which is the single strongest
piece of cross-section connective tissue found in this whole sample: CODE
and ICHING are visibly the same reading here, not two independent takes.

KEYS repeats several of CODE's own sentences nearly verbatim ("a sense of
being slightly out of place... adrift from a home you cannot quite name,"
KEYS > Shadow, versus CODE's near-identical wording). Where card 1's KEYS
independently reinvented the fire metaphor, card 2's KEYS instead restates
CODE. That is a different and arguably better kind of connection (the
sections are visibly the same reading told twice) but it also means the
Shadow subsection spends its first two paragraphs re-summarizing ground
CODE already covered rather than adding to it, which reads as padding on a
second read.

Best sentence: BODY > Amino acid, "The field that takes everything in is
built, at the bottom, from something taken in." It earns its neatness
because it closes a real chain of reasoning (Phenylalanine must be
ingested, therefore even total receptivity depends on something received
from outside) rather than asserting a conclusion the paragraph has not
built.

Weakest sentence: RELATIONS > Codon ring, "there is an old sadness in
water, the longing for home that drives the whole search." This is
generic mystic-register filler; "old sadness," "the whole search," and
"longing for home" could sit in almost any card's RELATIONS without
alteration, and nothing in the sentence is specific to card 2's actual
codon ring content (which is otherwise concrete: two hexagrams, one
element, one shared amino acid).

Register: "you" throughout CODE and DESIGN, sliding into descriptive third
person by RELATIONS, same pattern as card 1.

AI tells: "not a search. It is a softening" is the "not X but Y" pattern
doing real work. "This is orientation, and the strange thing about it is
that it arrives by surrender, not by searching" (KEYS > Gift) is the same
construction used twice in one paragraph, which starts to read as a
verbal tic rather than a chosen rhetorical figure once you notice the
first card in the deck already used the identical move three separate
times.

### Card 23, Beneath the Surface (Splitting Apart)

This is the sample's clearest case of an image sustained end to end. The
throat, the tangle of overexplaining, and the bed being stripped of its
legs, frame, and skin (the classical line-image sequence) are all read as
one continuous body: CODE opens on "the knowing arrives quiet and complete,
deep in the gut... the whole work of your life is the crossing," ICHING's
Reading returns to "the surest way to ruin it," DESIGN's "The teaching is
to let the throat be a gate, not an engine" answers CODE directly, and BODY
closes the loop physically ("Speech has to squeeze past a gland on its way
out"). Of the six cards read closely, this is the one where DESIGN, BODY,
and CODE most convincingly read as the same argument rather than adjacent
essays; the throat is the load-bearing image in three sections at once, not
reinvented three times.

KEYS is the outlier inside this otherwise unified card: its Shadow
paragraph ("The mind does not trust simple things. A simple thing gives it
nothing to do") opens a fresh line of reasoning about mental complexity
that never quite rejoins the throat/speech image running through the other
five sections; it is good writing on its own terms (the kitchen-reduction
metaphor in Gift is genuinely inventive: "It works like reduction in a
kitchen. You add only what belongs, then you cook it down and down until
what is left is concentrated and clear") but it is the one section here
that could be moved to a different card's KEYS with only the Shadow/Gift/
Siddhi names changed and still read as competent.

Best sentence: CODE, "What gets stripped was never lost. It was only freed
to be said again, simpler." Concrete, specific to this card's actual
content (stripping, speech, simplicity), and it does not oversell itself.

Weakest sentence: KEYS > Siddhi, "There is no technique for arriving. The
ones who get here say it was always found by accident, in a state of
wonder, never by the seeking." This is the deck's stock Siddhi-register
move (a paradox about effortless arrival) and reads near-identically in
several other cards' Siddhi sections; it is the kind of sentence the
brief's "reads as a downer / abstract" categories both apply to, since it
also tells the reader what they cannot do (arrive on purpose) without
offering anything to do instead.

Register: "you" in CODE, KEYS, DESIGN; "the throat," "this code" in BODY;
descriptive in ICHING and RELATIONS. Same pattern as cards 1 and 2.

AI tells: "This is not X. It is Y" appears at least four times across the
card (DESIGN > The drive: "The misread is to call this arrogance... That is
only the code under fear"; KEYS > Gift: "Simplicity is not stupidity,
though the mind will call it that"). "The work is the crossing" (CODE,
repeated near-verbatim in DESIGN > The drive as "The work is the
crossing, getting it from the silent place") is a genuine intentional
callback, not a tell, but it sits right next to enough real tells that a
reader who has noticed the pattern elsewhere in the deck will likely also
flag this one.

### Card 33, Echos of Time (Retreat)

CODE's opening move, "You read your life as a forward rush... So the same
week keeps arriving feeling new," is the strongest single opening in the
sample: it names a recognisable, specific psychological pattern (repeating
an argument without learning from the last one) before naming the I Ching
hexagram's actual subject (retreat, withdrawal, timing), which is the
opposite order from cards 1, 2, and 23, where the opening paragraph and the
hexagram's traditional meaning are closer to synonymous from the first
line. It reads as the most independently-conceived CODE reading of the six.

ICHING, KEYS, and DESIGN all converge on the same three real ideas (forced
speech distorts the message; the pause is not avoidance but ripening;
timing, not content, is the actual skill), and each restates them with a
different concrete image (the ox-hide thong in ICHING, hui gan/"reflecting
sweetly" in KEYS, "hold it in the throat a beat longer than feels
comfortable" in DESIGN). This is a genuine case of one code producing
consistent variations rather than either exact repetition or six unrelated
essays, and it is the best-integrated card of the six for that reason.

Best sentence: KEYS > Shadow, "You are so deep in the plot you cannot see
the plot." Specific, a real observation, and it does something a lot of
this deck's more careful, controlled prose avoids: it is genuinely funny
in a way that lands rather than undercutting the register.

Weakest sentence: BODY > Amino acid, "The halt is not a failure of the
sequence. It is what lets the sequence become a thing at all." This is
another "not X but Y" summarizing move, and it is doing real conceptual
work (stop codons are the point, not an absence), but the phrasing itself
("become a thing at all") is the kind of vague intensifier this deck
otherwise mostly avoids.

Register: "you" throughout CODE, KEYS, DESIGN, and even into BODY ("Put a
hand to your throat and swallow"), which is more consistently second-person
than cards 1, 2, or 23; this may be the deck's more successful register
choice for a CODE-forward card. ICHING and RELATIONS stay in "the" and
"this code."

AI tells: "Not flight. A measured leaving" (ICHING > Combination) and
"Not to escape the present. The remembering is the present" (KEYS > Gift)
are both instances of a short fragment-negation-then-correction move used
as a paragraph's rhetorical hinge; it recurs often enough across this
sample (cards 1, 2, 23, and 33 all use some version of it at least twice)
that it reads as a house style rather than a per-card choice, which is
itself worth naming since house style shading into formula is exactly what
the brief is asking about.

### Card 47, Garden of Alchemy (Oppression)

CODE opens on inherited, non-personal weight ("Some mornings the weight is
on you before anything has happened... you carry the leftover fear of
everyone who came before, looped through the blood") and this is the one
CODE reading in the sample that most squarely fits Adrian's own diagnosis
in todo/plans/reading-rewrite.md, that readings tend to frame the card's
energy as a problem to be solved rather than an energy with both a
difficult and a gifted face: two of CODE's three paragraphs describe the
trap (going numb, or clamping into false certainty) before the third
paragraph turns to instruction, so the read time spent on the shadow
outweighs time spent on the code's actual gift (transmutation) by roughly
two to one.

ICHING, KEYS, DESIGN, and BODY all independently reach for a version of
"pressure becomes fuel" (ICHING: "You change frequency inside it, and the
walls become the vessel"; KEYS: "The pressure does not lift so much as
change state. What felt like dead weight is revealed as fuel"; BODY: "Not
a force that pushes back against the pressure, but one that fits into the
cramped place and quiets the alarm"), which is a genuinely strong case of
five sections converging on one real idea without copying each other's
sentences. This is the clearest evidence in the whole sample that the
deck's sections do share a spine even when they never name each other or
the card directly.

Best sentence: KEYS > Gift, "This is the old work the alchemists were
really after, not lead into gold in a flask, but anguish into wisdom in a
person." Concrete, earns its metaphor by cashing it out immediately rather
than leaving it decorative.

Weakest sentence: KEYS > Shadow, "The strange mercy is that a weight you
finally stop running from stops being only a weight." This is a hedge
dressed as a resolution: "stops being only a weight" commits to nothing
(only a weight, then what, exactly), which is the brief's "hedged" failure
mode in close to its purest form in this sample.

Register: "you" in CODE and KEYS, shifting to "this code" and "a person" in
DESIGN, BODY, and RELATIONS, same pattern as the rest of the sample.

AI tells: "Not X, but Y" appears at least three times (DESIGN > The drive:
"The misread is to call this defeat... That collapse is the trap, not the
truth of the code"; BODY > Amino acid: "Not a force that pushes back
against the pressure, but one that fits into the cramped place"). "This is
where..." does not appear verbatim, but its close cousin "This is the old
work..." (KEYS > Gift) and "That is the constriction" (ICHING > Reading)
both function as the same kind of summarizing signpost sentence the brief
flags.

### Card 64, Communion (Before Completion)

The last card in the deck, and CODE opens on the same "too big to hold"
image that runs the whole card: "You hold something too big to lay flat.
It came to you whole and out of order... it sits high and crowded behind
your brow like a pressure with no way out." This reading earns its
placement: unlike cards 1 to 47 in this sample, card 64's RELATIONS
subsection is explicit and specific about the deck's own structure ("the
book chose to end here, on the brink rather than the arrival, so the last
word is a crossing still underway"), which is the single most
self-referential sentence found anywhere in the six cards read for this
survey, a section actually talking about being part of a deck rather than
only about its own hexagram.

ICHING and CODE are close to a single reading told twice here (the fox
wetting its tail one step from the far bank appears, worded almost
identically, in both CODE paragraph two and ICHING's Reading), which
matches the pattern already seen in card 2. KEYS, DESIGN, and BODY each
reach independently for the same "confusion needs time, not an answer"
idea, in near-identical closing sentences: KEYS > Shadow, "This one needs
time. Not an answer. Time, and the nerve to stay uncertain inside it";
CODE itself, "What this asks is plain and hard. Confusion needs time. Not
an answer, time." This is the clearest case in the sample of a section
lifting a sentence from CODE almost verbatim rather than reinventing it,
which reads as intentional repetition (a refrain) rather than accidental
formula, because it is the card's actual thesis stated plainly each time.

Best sentence: KEYS > Gift, "Someone once thought, I will put a vast tower
of iron in the middle of my city, and a decade later the thing stood there
and a whole culture wore it as its face." The Eiffel Tower example
(unnamed, left as "a vast tower of iron") is the single most concrete,
least abstract image found in KEYS across all six cards read, because it
reaches outside the deck's own vocabulary (fire, thresholds, the body)
for a real historical instance.

Weakest sentence: KEYS > Siddhi, "Some who reach this say it is the most
ordinary thing in the world. Others remember the supernova. Both are true
at once, which is how you know you have arrived." "Both are true at once"
is the deck's paradox-move again, and "which is how you know you have
arrived" is a summarizing tell dressed as insight; it tells the reader they
have understood something without the preceding sentences having actually
demonstrated it.

Register: "you" in CODE and KEYS; DESIGN moves between "a person with this
code" and direct address ("Stay with the image"); BODY and RELATIONS stay
descriptive. Card 64 also carries the deck's most visible provenance flag
left inline in the visible text rather than only in the frontmatter: an
HTML comment directly under Immortals flagging a corrected immortal
attribution (see the file for the literal comment), and card 64's frontmatter
notes that KEYS's own repressive/reactive names ("Anxious"/"Manic") are
inferred, not source-confirmed, because the source Gene Keys file is an
empty stub. Worth flagging on its own: this is the one card in the sample
where a genuine sourcing gap (unconfirmed repressive/reactive names) sits
directly behind otherwise fully confident, unhedged prose ("The inward
face of the Shadow. Some people meet the not-knowing by clamping the mind
down on it," KEYS > Repressive nature, stated as flatly as every other
card's Repressive nature despite the name behind it being a guess).

AI tells: "Not an answer, time" (CODE) and "Not a metaphor laid on top of
the body. It is the crown going quiet enough for something to shine in it"
(BODY > Physiology) are both the fragment-negation move again, now seen
across all six sampled cards, at least once and usually two or three
times each. Across the sample this is the single most consistent
stylistic fingerprint, more consistent than any single repeated sentence
stem measured in Part A.

## Part C: writing-related todo items

Checked: oracle/TODO.md, todo/DEVELOPMENT-STATUS.md, todo/TODO.md (the
project's actual open list lives at the repo root, TODO.md; there is no
separate todo/TODO.md file), and todo/archive.md.

### oracle/TODO.md (last revised 2026-05-23, stale)

Its own "state right now" table already disagrees with the current
oracle/cards frontmatter (it describes UL 1 as locked/final on KEYS,
DESIGN, RELATIONS and pilots on UL 3, 22, 50 for ICHING and BODY). Per
Part A item 2, only card 3 currently reads final in oracle/cards, and
cards 22 and 50 read all-scaffold, so this file describes an earlier state
of the source JSON, not the current merged markdown. It still correctly
names the one open structural decision (whether to commit the deep-pass
rewrite for the remaining 61 ICHING and BODY cards), which recurs, still
unresolved, in the current root TODO.md.

### todo/DEVELOPMENT-STATUS.md (current, "counts verified against the
actual content files")

Section 2, "Adrian's voice writing (the real content backlog, not
delegable)":

| Writing surface | Done / total | Status per this survey |
|---|---|---|
| Rewrite the 64 opening readings | 0/64 | Confirmed: CODE status is scaffold on all 64 cards; not started |
| Invocations (cards 2-64) | 1/64 | Not directly measured (invocations live outside oracle/cards) |
| Gene Keys sections to final | 2/64 | Does not match oracle/cards frontmatter, which shows 1/64 (card 3 only); the "2" appears to count card 1, which is final in the legacy oracle/sections/keys/01.json but was written into oracle/cards/01.md as scaffold |
| Human Design sections to final | 3/64 | Same mismatch: oracle/cards shows 1/64 (card 3); the legacy JSON shows cards 1, 2, 3 final for design |
| Relations sections to final | 2/64 | Same mismatch: oracle/cards shows 1/64 (card 3); legacy JSON shows cards 1, 3 final for relations |
| Live changing-line texts | 0/384 | Not measured directly (lives in data/ichingLines.ts, outside oracle/cards) |
| Per-artwork readings | 1/64 | Not measured directly (lives in oracle/readings/) |

The status-count mismatch is worth Adrian's attention on its own terms,
separate from the prose-quality findings above: the current oracle/cards/
NN.md manuscripts, which is what actually ships, silently downgraded
cards 1 and 2's already-locked keys/design/relations status back to
scaffold during the JSON-to-markdown migration, and no open todo item
currently tracks re-confirming or re-locking that content.

Also recorded in DEVELOPMENT-STATUS.md: "Writing is the long pole and only
you can do most of it: the 64 opening readings, invocations, line texts,
and piece stories. Everything above is scaffolding to make that writing
land well," and the deep-pass rewrite decision is named as still gating
"how far an agent can push card content."

### Root TODO.md (current, open items)

Open items naming writing, reading, prose, or rewrite work directly:

- Rewrite the 64 opening readings so each speaks the whole code and ends
  lifting, not heavy. Band: you-required. Effort: deep. Plan:
  todo/plans/reading-rewrite.md. Not started (0/64 per DEVELOPMENT-STATUS.md).
- Scrub the remaining soft source-name phrases in card prose ("the lineage
  calls this," "the text calls this," "the Eranos source calls this") on
  cards 1, 4, 5, 6, 13, 40, 60. Band: you-required. Effort: quick. Flagged
  as Adrian's call since "the lineage" may read as acceptable in-world voice.
- Write per-artwork readings into oracle/readings/ over time, UL-122 is the
  reference. Band: you-required. Effort: moderate.
- Do the full whole-deck review of all 64 cards against the writing method,
  then launch. Band: you-required. Effort: moderate. Plan: oracle/TODO.md.
- Decide whether to commit the full deep-pass rewrite for the remaining 61
  ICHING and BODY cards. Band: you-required. Effort: moderate. Plan:
  oracle/TODO.md. A drafted deeper rewrite reportedly exists for most cards
  but has not been committed pending Adrian's call on quality.
- Start writing the 384 I Ching changing-line texts via /cast-content. Band:
  you-required. Effort: moderate. PR #6.

### todo/archive.md (recently closed writing items)

- 2026-09-08, PR #180: "The Design section repeats one opening on 51 of the
  64 cards, the same fault just fixed everywhere else." The fault was
  "Where this drive lives in..." across three variants. ICHING, BODY, and
  RELATIONS were swept clean of this class of formula on 2026-09-01 and
  measured zero afterward; DESIGN was outside that scope until this pass.
  Closed by rewriting 35 Drive openings on the "This code is the" stem,
  removing 21 "That placement is the teaching" closing signposts, and
  varying 5 "On its own this" openings. The method is written down in
  oracle/sections/_DIVERSIFY_PASS_THREE.md and _DIVERSIFY_PASS_FOUR.md: ban
  the stem, not the phrase, and test every candidate sentence with "would
  this work unchanged on another card."
- 2026-09-08, same PR: a second, smaller formula item in DESIGN, "closing
  signposts and openings left standing after the first sweep," closed the
  same day using the same method.

This confirms directly that KEYS was never included in the 2026-09-01 or
2026-09-08 sweeps (only ICHING, BODY, RELATIONS, then DESIGN), and Part A
item 3 above found KEYS still carrying the identical class of formula
(Repressive/Reactive nature opening sentences) at 56% of the deck, which is
a higher rate than DESIGN's pre-sweep 80% would suggest is urgent on its
own, but is the same shape of problem the existing, already-proven
diversify-pass method was built to fix, on the one lens it has not yet
reached.

### The governing note on CODE specifically

todo/plans/reading-rewrite.md carries Adrian's own diagnosis, dated
2026-09-02, which supersedes an earlier 2026-07-05 note about endings not
lifting:

"I found they were a bit more on the negative side rather than a balance
between positive and negative. It was approaching everything as if it was
a problem. But not the energy of the Card as much as the problems."

The plan file states this is a whole-reading framing problem, not a
last-paragraph fix, and that the existing CODE prose is "already good
prose saying the wrong kind of thing," so an agent editing pass over the
existing text will not solve it; the plan calls for the readings to be
rebuilt inside the WordForge tool (an i64os subsystem) rather than as a
markdown pass, gated on a five-card pilot that must include card 3. The
close reading in Part B above is consistent with this diagnosis: cards 1,
23, 33, and 47 in this sample all spend roughly two paragraphs on the
shadow face before one paragraph of resolution, which is the specific
imbalance Adrian names, and card 47 in particular is the clearest instance
of it in this sample.

## A note on an unrelated hook flag

Mid-survey, a grep over the project's root TODO.md tripped an automated
credential-scan warning on this session's tool output. Checked directly
against TODO.md's contents with a pattern match for key/token/secret plus a
long value: no match. The only string in the grepped output resembling a
token was a git branch name (claude/oracle-mcp-artwork-readings-MMa1k),
which is not a credential. This appears to be a false positive; nothing in
the file needs rotating.
