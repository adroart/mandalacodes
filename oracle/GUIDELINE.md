# The Mandala Codes writing guideline

One document for building a card. It replaces the sixteen that came before it
(the concept, the master guide, guides 01 to 06, the writing method, the
template, the deep-pass addendum, the diversify briefs, the reading rewrite
plan). Those stay on disk for history and each carries a two-line notice
pointing here. When this document and any older one disagree, this one wins.

Written 2026-09-12 from the survey at `todo/plans/writing-guideline.md`, the
Fable pass beside it, and Adrian's answers of the same day. The measurement
script `todo/plans/writing-guideline/measure.mjs` re-checks the deck against
sections 4 and 12 after any pass.

What the deck is for, in Adrian's words: "We're trying to pull the energy from
the card number, not any one tradition. It's where all the traditions meet and
what they all point to." And what a card is for: "really understanding and
clarifying the energy and how to work with it to best step into a relation with
this that is healthy." Everything below serves those two sentences.

---

## 0. The ten rules, before anything else

Everything below elaborates these. A writer who holds these ten and reads
nothing else will produce something close. Learned on card 3 with Adrian
reading each pass on the page, 2026-09-12.

1. Written for someone who knows nothing. No system word in prose, no
   explaining the system. The page explains each system once, behind a tap.
2. Never say where it came from. Give the picture, the counsel, the fact as
   your own to give. No "the tradition," "the old text," "the translators."
3. One sentence, one concept, and every sentence complete with its connecting
   words in. Translate the classical compression; never chop it.
4. Describe the state, to you. No "anyone who has," no examples that sort
   readers, no "this hour" filler. Let the reader recognise themselves.
5. The energy, not the problem. Name the pull the cycle brings and answer it
   in the same breath. Never narrate the reader failing.
6. Symbols land on a person. A trigram, a character, a line is given as
   itself in a few words and then as the reader knows it. Never the diagram
   alone.
7. Every unit says what no other unit says. Six panels, six questions, one
   each. A sentence that answers an earlier panel's question is cut.
8. Clarity over completeness. One clear picture, never the scene's inventory.
   If a sentence is being true to every tradition at once, cut to the one
   thing.
9. Nothing pre-said. The reading names the energy; the sections unfold it.
   The reading owes them silence, not a preview.
10. Read it on the page, not in the file. What looked right in Markdown read
    as six documents on the screen. The page is the test.

**The exceptions, all of them, so the ten rules can be trusted alone.** The
general voice rules apply unless this paragraph names the exception. Human
Design may name and explain its gate, centre, channel and defined or open
states in plain language, because that section's whole job is to teach the
wiring; it must not infer the reader's chart or tell the reader how to
decide. Relations may name lineages, never book titles. I Ching may say "the
traditional character draws" on the nine cards where the character is a true
picture, and may describe the symbol inside its popup. The two Gene Keys
natures describe another person; everywhere else the card addresses you
without assigning you a history. The Judgement and Image lines speak as the
classical text. Complete sentences are the default; a deliberate fragment is
allowed when it improves the spoken rhythm, and it is rare. Rule 5's "never
narrate the reader failing" governs the reading; the Shadow, the two natures
and the moving lines describe mishandling as recognition, still without a
verdict. Rule 7's "says what no other unit says" is about teaching and
interpretation; a fact that is true on both cards (an amino acid stays
essential, a trigram keeps its nature) may be stated on both, in different
sentences. Any further exception is recorded in section 15 with the card,
the date and the reason.

The worked reference is card 3 (`oracle/cards/03.md`): every section, the
keynotes and the essence have been through this loop to the end with Adrian
reading each pass on the page (2026-09-12); Relations was written last and
read once.

---

## 1. What a card is

A card is one energy, one of sixty-four, spoken in six voices. The voices are
the traditions that have each described this energy from their own side: the
I Ching as a situation, the Gene Keys as an arc from low to high, Human Design
as a place in the body where it presses, the body's own chemistry as the floor
under all of that, and the deck's own field of kin as the doorway out. The
sixth voice, the first the reader meets, is the deck itself speaking the energy
plainly with no tradition named.

Three laws follow. No voice is a compression of another; each says what only it
can say. A deeper voice never restates a shallower one, and the first voice never
pre-says a deeper one; the reader who swipes from one panel to the next should
find the question the last panel raised being answered, never re-read, and
never already answered. And the card is its own thing: a reader should
finish it feeling they met one energy whole, not that they toured five
reference books about it.

The card as it exists on disk and on screen, which the writing must respect:

- One Markdown file per card, `oracle/cards/NN.md`. Six `##` sections in fixed
  order (CODE, ICHING, KEYS, DESIGN, BODY, RELATIONS) and the `###`
  subsections card 3 carries, in its order. The compiler refuses a card that
  is missing a required one, so this shape is a constraint, not a preference.
  Optional: `### The symbol` under ICHING. The `### Label — Tail` headings use
  an em dash as a parser delimiter; that is the one place the character is
  allowed. The `_Keywords:_` line, the `_Shadow:_ · _Gift:_ · _Siddhi:_` line,
  the one-line underscore intro under RELATIONS (the compiler requires it),
  the Judgement and Image bullets, the `**Line N** · _image:_` markers and the
  `- **Label — Value:**` bullets under Tarot and Deeper correlation are
  structure the parser consumes, not emphasis, and the markdown rule below
  does not apply to them.
- The reader meets the card name, the hexagram name and glyph, the keywords,
  the gate number and the three Gene Keys names as labels before any prose.
  Prose never re-announces them. A first sentence that says "this is Gate 1"
  or "your shadow is Entropy" has wasted itself.
- No markdown survives to the page. Bold, italics, lists and quotes inside
  prose render as literal characters or collapse into one block. Plain
  paragraphs only.
- Two short texts stand for the card, and they are different texts with
  different jobs. The essence is the three sentences on the sheet
  (`meta.centre`), shown on the page under the keynotes (section 2). The
  first paragraph of CODE is the card's standalone introduction: the search
  anchor, the summary a tool returns, the text a cast shows for the hexagram
  it lands on. It is not a second essence and does not repeat it; it must
  stand alone as the whole energy in prose.
- A cast happens inside the card page and shows the reader one moving line by
  itself, plus that first paragraph. Every moving line is therefore written
  to be read alone.
- The six panels are swiped in order: Universal, I Ching, Gene Keys, Human
  Design, Body, Relations. A reader can stop after any one. Each must be
  complete, and each must reward going on.
- Under the name and keynotes, before the chart question, the page shows the
  card's essence from the sheet. Each system panel carries a one-line frame
  under its name and a popup behind its glyph that explains the system once
  (the I Ching essay, Adrian's Gene Keys essay, the Human Design essay). The
  I Ching popup shows this card's symbol above the essay. The Image sits
  before the Judgement, both with plain subtitles. The coins carry a stranger's
  explanation and, after a throw, "Your throw," "Turning into," "The lines in
  motion," "Turned over, it leads to." Body shows organ and amino acid only.
  Nothing in the prose repeats what these carry.

Two words the deck uses precisely. The **scene** is the I Ching's picture in
words: the dragon in the field, the mare on the ground, the fox at the ford,
the bed stripped from its legs up. It is a text description and it belongs to
the tradition. The **image** is Adrian's artwork for the card, the mandala
itself, and nothing in the prose is called an image. The older guides said
"image" for the scene; that word is retired in that sense.

---

## 2. The essence

Every card has an essence: the whole energy in three short sentences. The
first names the energy. The second names its challenge. The third names its
way. Each sentence is short and whole; three sentences that read as one run-on
have failed. Card 3's:

> A beginning is real long before it is settled. You are full of what is
> coming, with nothing to show. It needs room more than it needs a plan.

The essence is found, not decided in advance. Adrian's order (2026-09-12):
assimilate first, distil after. The five teaching sections are written from
the sources first, each faithful to its own tradition; the essence is
distilled from what those sections turned out to say; the reading is written
last, from the essence; the keynotes last of all, from the finished card.
Until the sections exist, nobody knows what the essence is.

**Each sentence passes the stranger test alone.** The essence is the first
prose a reader meets, above the reading, so each of its three sentences must
land with no card behind it. The challenge names the pull as the reader
feels it, in ordinary words ("The pull is to push ahead and set the
direction yourself"). A source idea folded into a phrase fails even at two
words: card 2's first essence said "Coming second feels like being lost,"
which was the mare who follows rather than leads, and Adrian read it as a
race placing (2026-09-12). No pronoun in the essence points at a thing named
only in another sentence.

There is one essence per card. It is recorded on the card's sheet
(`meta.centre`) and Adrian ratifies it there. Its test: if it is right, the
situation, the body, the arc and the field click around it without any of
them being bent. The tone is the card's tone: a name, a recognition, a way,
never counsel dressed as description ("the new thing in you grows by small
rough moves" was counsel and was replaced).

Alongside the essence the sheet records the scene (which of the I Ching's
pictures this card carries), the mechanism the card holds together by (see
section 4), and where the essence recurs (section 4 again).

---

## 3. Voice

The voice is one person speaking to one person about something real. Plain
words. The tradition's authority is in what is said, never in how it is
dressed.

**Who speaks to whom.** Every section speaks to you. Not "a person," not "one,"
not "the reader," and not "this code" as a subject when the card is describing
what a person feels. The sections describe different things (a situation, an
arc, a pressure, an organ, a field) but they all describe them to the same
you. The one exception is the Judgement and Image lines under I Ching, which
are the classical text rendered fresh and speak as the tradition. This settles
the register question: the older cards walked from "you" to "a person" to "this
code" as they went deeper, and it read as six documents. Card 33 holds "you"
all the way to the body ("put a hand to your throat and swallow") and reads as
one card. That is the model.

**The standing rules.** Never the em dash character in prose; comma, colon,
period or a new sentence. No italics or underscore emphasis anywhere a reader
meets text. No source named in any of the six sections: no Wilhelm, no Rudd, no
Eranos, no book, no teacher. No borrowed sentence from any source. Plain words
by default; the weighted words (light, soul, fire, presence, sacred, holy,
divine, awakening, transformation) at most once or twice per card and only
when nothing plainer carries it. No adjective triads. No metaphor explained
after it is used. Ground every abstraction: who feels it, when, doing what.

**The card does not talk about itself.** No "this card," "this reading," "the
deck," "the oracle," and no maker's voice ("this is why the card keeps
returning to the same instruction"). No throat-clearing ("you have drawn," "the
oracle speaks"). Inside the I Ching section the thing is a hexagram; inside
Human Design it is a gate; everywhere else it is the code, and the word "code"
appears in prose only when the card is naming its own kind, never as a way to
avoid saying "you."

**The house tic.** "Not X. It is Y" (a fragment negation, then the correction)
is the deck's single most consistent fingerprint: two to four times in every
card read, in every section. It is allowed once per card, at the one hinge
where the correction is the point. Everywhere else say the true thing without
first saying the false one.

**Written for someone who knows nothing.** Every sentence on the card makes
sense to a reader who has never heard of the I Ching, the Gene Keys or Human
Design and has read no other section. No system word in prose: no "hexagram"
except in the I Ching section's own heading terms, no "lines," "trigram,"
"gate," "centre," "shadow" as a term of art, no "the six lines show." If a
sentence needs the system to be understood, it is rewritten so it does not.
The page explains each system once, behind its own tap; the prose never does.

**Never say where it came from.** No "the tradition says," "the old text,"
"the translators," "the teaching gives." Give the picture, the counsel, the
fact, as if it were yours to give. The one exception is "the traditional
character draws," on the nine cards where that is true (section 7).

**Complete sentences, connecting words in.** The classical sources are
compressed; the card is not. "Ready, and staying" is a note. "Be ready to go,
and stay where you are" is a sentence. Translate the compression into
complete thoughts a stranger can follow, without changing what is said.

**The plain thing first, then one picture.** Never a metaphor explained by a
second metaphor illustrated by a list ("a grip," then "on loan," then "the
work, the house, the body"). Say what it is in plain words, then give one
picture for it, then let the next sentence explain the picture. Every sentence
follows from the one before; a paragraph is one thought leading on, not a row
of true statements. The punctuation numbers are necessary and not sufficient:
a paragraph can pass them and still read as chopped.

**One claim per sentence, two when the second is the first's consequence.**
"You try things, and most of them fail." "Nothing is yours to keep, so nothing
can be taken." Two claims, one thought, because the second follows from the
first and the joint is "and" or "so." Test: cover the second half. If the
first half stands as a whole thought and the second is its consequence, keep
them together. If the second half brings in a new thing or a new picture, it
is the next sentence. A sentence carrying three claims ("the unease is a
beginning, and where the hands stop closing on it, it turns into material")
fails even at eleven words, and its two "it"s point at different things. A
picture reused from an earlier paragraph is named again ("when you stop
holding on"), never pointed at with "it."

**The punctuation check, measured.** A section passes when it averages under
15 words a sentence, carries under three commas per hundred words, and has no
sentence with three or more commas. The reading Adrian approved runs 11 words
and almost no commas; the first Gene Keys draft ran 15 words and six commas
per hundred and read as broken, and lists like "the work, the house, the
people at your table, the body you wake in" are the usual cause. Run
`node todo/plans/writing-guideline/punctuation.mjs oracle/cards/NN.md` before
showing a section; it prints the three numbers per section. Fewer ideas per
sentence, not more full stops: a run of four-word sentences is chopping.

**No biography for the reader, no time filler.** "Anyone who has started a
piece of work or a family knows this hour" sorts readers into those who have
and have not, picks one writer's example, and says nothing with "this hour."
Describe the state itself, to you, and let the reader recognise it. Retired:
"anyone who has," "this hour," "this stretch," "this season" as filler, "we
all know." The distinction that matters: an illuminating instance (a horse
saddled and standing still, a tower of iron in a city) is a picture the
reader looks at and is wanted (see Specificity, below); a scenario that
assigns the reader a life ("you started a family," "for years nothing in
there has been allowed to change") is a biography and is cut.

**Every unit says what no other unit says.** The reading names the energy.
The Combination gives the picture. The trigrams give the forces as
themselves. The Reading gives the counsel. Gene Keys gives the arc. Human
Design gives the pressure. Body gives the tissue. Relations gives the kin. A
sentence that says what an earlier unit already said, in different clothes,
is cut from the later one. Three texts a screen apart describing the same
situation is the fault this rule exists for.

**Retired closers.** "The maker gets made." "It takes most of a life." "What
this asks is small." "So the work is to." "Both are true at once, which is how
you know." "There is no technique for arriving." "The code runs all the way
down to this." "There is a teaching in that." "That placement is the teaching."
"Together they teach that." A paragraph that ends by stepping back to say what
it meant has its last sentence cut.

**Reads as human.** The four cuts stand: no symmetry (balanced pairs, tidy
triads, even paragraphs), no summary sentence, plain vocabulary by default, end
a beat early. Keep the lopsided rhythm a person has: a doubled "and," a
fragment, a rough landing. A sentence that could close a hundred different
paragraphs unchanged is not this paragraph's sentence. The two-minute check
below is the operational form of this.

**Rhythm is a second layer.** A word list alone does not make a voice; the
outside research on this (2026-09-12, `todo/plans/writing-guideline/not-ai-research.md`)
converges on one point: you can give a model the vocabulary, the tone and the
favourite pictures and still get four-four time. So the deck has an explicit
rhythm rule as well as a word rule. In every subsection, one sentence runs long
(over twenty words) and one lands short (under seven), on purpose and not in
the same place each time; the short one is not always the last. Three
consecutive sentences within five words of each other is the signal to read
the passage aloud; it is a fail only if the ear hears the beat. Approved
passages on card 3 carry such triples and read well, so this one is an ear
check, unlike the punctuation numbers, which are gates. And one paragraph per
subsection may end on a punch; the others end flat, mid-thought, or on the
open part, the way a real conversation does.

### 3a. The two-minute check

Run on one paragraph at a time, before anything else. Each line is a test; a
fail is the fix, applied on the spot. Built from the deck's own tells (section
3, section 12) and from what people outside the project found works.

1. Find every "Not X. It is Y" and every "not just X, it's Y." Was the reader
   assuming X before this sentence? If not, cut the negation and keep Y. One
   such hinge per card, total.
2. Count the items in every list of three. Does the third add what the first
   two did not already promise? If not, cut to two.
3. Read the last sentence. Could its shape have been predicted before reading
   it (a summary, a moral, "which is how you know," "that is the teaching")?
   If yes, cut it and let the paragraph end a beat early.
4. Circle the weighted and elevated words: profound, journey, embrace,
   navigate, essence, transformative, sacred, divine, awakening, tapestry,
   resonate. Would you say this word to the person across the table? If not,
   the plain word.
5. Find any sentence that announces significance instead of showing it
   ("there is a teaching in that," "this is where," "the whole teaching is").
   Delete the announcement. Does what is left still stand? Keep only what is
   left.
6. Measure three consecutive sentences. All within five words of each other?
   Read them aloud; if the ear hears the beat, cut one hard or let one run.
7. Find every colon setup and every "what makes this X is" opener. Delete
   everything before the colon or the "is." Meaning lost, or only runway?
8. Count inanimate subjects doing human verbs in a row (the code asks, the
   ring teaches, the chemistry says). Three in a row: put you back in one of
   them.
9. Take the first five words. Would they open the same subsection on another
   card unchanged? Then they are a formula, whatever follows.
10. Cover the labels and take the first and last sentence. Strike the names.
    Still true on the ring sibling or the channel partner? Then it is not this
    card's yet.
11. Read it aloud. If it sounds like a memo, say the worst sentence in your own
    words to someone, then tighten the grammar without losing what you said.
12. Split every sentence at its commas. Does each half carry its own idea?
    Then they are two sentences. Count adjectives: more than one on a noun is
    a fail.
13. Check the ending of the section. Does it resolve its own tension in one
    tidy sentence? If a real conversation on this would end on the open part,
    end there.
14. Find every pair of sentences or clauses built to the same shape
    ("Nothing in it rises. Nothing in it strikes."; "real as a feeling and
    false as a fact"). A matched pair is the tidiest thing a model writes.
    Break one of the two or cut it.
15. Put CODE and the I Ching Reading beside the Judgement, the Image and the
    six lines and compare by meaning, not wording: a counsel rendered twice
    in different clothes is still rendered twice. Record the duplicated
    proposition and cut the later one.
16. Read the Siddhi's whole closing paragraph, not its last sentence: a
    decorative final line does not excuse a paradox or a pair of absences
    two sentences earlier.
17. In Body, circle every "all," "only," "never," "always," every fixed
    number or duration, and every "then X takes over" sequence. Each needs
    evidence at exactly that scope or is softened to what is known.
18. Across a batch, read each section's last sentences in a row, card after
    card. Interchangeable wisdom and a repeated grammatical template fail
    even when their first five words differ.

**Constructions, not strings.** The retired closers and stems in this document
are families, not spellings. "The misread is to call this" and "people will
call this" are the same move; "runs all the way down to this" and "goes all the
way to the root" are the same move. A text search catches the spelling already
caught; the eye catches the next word in the same slot. When a new tell is
found, record it with its family and the reason, the way the diversify passes
recorded their keeps.

**Specificity.** Write from one concrete instance and let the general follow;
never the reverse. Card 64's "a vast tower of iron in the middle of my city"
reaches outside the deck's vocabulary for a real thing and is the most
concrete sentence in six cards. The deck's stock words (fire, threshold, the
body, the dark) are not banned, but a card made only of them could be any card.

---

## 4. How one energy crosses six sections

This is the chapter the older documents did not have. They governed connection
only by subtraction (do not repeat what belongs elsewhere). This chapter says
what the sections owe each other, and it starts with the rule that makes depth
possible without repetition.

**Six questions, one each.** Each panel answers one question only it can
answer, and never another panel's. The reader goes deeper because each panel is
a new question, not a new wording.

- The reading: what is this energy, and how do I stand in it?
- I Ching: what is the situation, and what does it counsel?
- Gene Keys: what does this energy become, at its lowest and its highest?
- Human Design: where does it press in me, and what does it drive me to do?
- Body: what is my body doing while I feel this?
- Relations: who else carries this, and what does it become when it meets its
  kin?

The test: a sentence that answers a question belonging to an earlier panel is
cut. Each panel has its strength and reveals something a little deeper; none
retells.

**The scene governs; ICHING shows it.** The I Ching's scene is the one
picture all the traditions already share: Rudd named his keys from the
hexagram lines, Human Design kept the hexagram numbers, the tarot mapping hangs
off the trigrams. So the scene is the card's picture, and a writer who invents
a different governing picture (the wave on card 47) is building a fifth
tradition. ICHING shows the scene whole, with its trigrams, its judgement, its
lines. CODE may hold one piece of it, in plain clothes: no hexagram named, no
dragon called a dragon if the word would name the system, but the fire, or the
ground, or the last step, one of them and never the list, and only when that
one piece carries the energy by itself. The reader who swipes from CODE to
ICHING should feel they have found where the picture came from, not that they
have already read it.

**How the scene travels.** Four ways, and each section gets one.

Restate belongs to ICHING alone. CODE may hold one glimpse of the scene;
ICHING shows the scene. A glimpse in CODE and the whole picture in ICHING is
the only place a picture appears twice on the card, and the glimpse is a
piece, never a summary.

Vary belongs to the moving lines and to KEYS. The lines vary the scene six
times (the dragon hidden, in the field, in the sky, too high). KEYS varies it
by altitude: the same fire as coals, as flame, as a thing entirely itself. KEYS
never re-teaches the situation; it says what the scene is at its lowest and
highest heat.

Answer belongs to DESIGN and BODY. Each answers a question the scene raised.
DESIGN answers where the situation is felt and what it presses you to do. BODY
answers what is literally happening in the tissue while it is felt. Card 23 is
the model: the stripping raised "what survives," and BODY answers with the one
amino acid that says begin building.

Callback belongs to RELATIONS, once, in the Tarot lead sentence, which is
already where the cards put their single picture ("a hand letting go"). The
Pair paragraph may call back too when the pair is the scene's other half.

Forbidden: a section opening its own picture from nothing when the card already
has one; a section teaching a fact another section teaches (the magnetite on
card 02, the thyroid on card 33); any sentence in CODE that also stands in
another section of the same card; the same interpretive sentence on two
cards. Exempt from that last one: approved trigram definitions, the
Immortals' placing sentences, ring-theme sentences and necessary facts, which
may recur across cards in their own words.

**When the sources disagree.** The six translations and the philology do not
always give one scene, and the Gene Keys and Human Design do not always read
the hexagram the same way. Choose the scene the most translations share and
the one the card's energy actually needs, record the choice on the sheet
(`meta.scene`) with what was set aside, and do not bend the other sections
to support the picture. Assimilate first means the sources are allowed to
disagree; the card chooses, and the sheet says so.

**Where the essence lives and where it recurs.** The essence is shown once,
on the page under the keynotes, in its own three sentences. Nowhere on the
card is it repeated verbatim. The reading carries its way in other words in
the third paragraph; the sections vary it, never restate it: "never yours to
command" becomes "the fire was never yours" becomes "the fire is fed before
it is lit." Card 64's three-fold refrain of its old centre is retired as a
model. A card that says its truth the same way four times has one good
sentence and five panels of wallpaper.

**The mechanism.** The six cards that hold together do it by four different
means, and the sheet names which one this card uses: a picture at different
heats (card 01, fire), a verb carried through every system (card 33, stop), a
word that names the situation in every tradition (card 47, pressure), or a
refrain of the counsel (card 64, confusion needs time). Card 02 has none and is
the one that splits: the tradition's picture lives in ICHING and RELATIONS,
the writer's picture lives everywhere else, and nothing joins them.

**What each section owes its neighbours.**

CODE owes the sections nothing in advance. It may hold one glimpse of the
scene for ICHING to open and one plain picture of the difficult face for KEYS
to unfold. Everything else it owes them is silence: it shares their central
meaning, because it is distilled from them through the essence, but none of
their explanations, distinctive sentences or detailed counsel.

ICHING owes CODE the scene's origin, and may hand to KEYS in its last
paragraph, the way card 33 does it ("a deeper layer hears another word inside
the withdrawal: forgetting"); the hand-off is optional and is cut when it
reads as a preview. It owes the caster six lines that each stand alone
beside CODE's first paragraph.

KEYS owes ICHING silence about the situation, and owes DESIGN the body
unlocated: the arc is felt, but KEYS does not say where. When the source
locates the work in the body (the belly, on the alchemy ring), KEYS says so
once as where the work goes, never as a seat.

DESIGN owes KEYS the misnaming beat (below), and owes BODY the organ: DESIGN
names the region and the pressure, never the gland. It owes RELATIONS the
partner gate, kept inside as internal relating.

BODY owes KEYS a first reading (write BODY after KEYS, having read it), and
owes DESIGN the boundary the other way: BODY names the organ and what it does,
never the centre. It owes the ring siblings a different amino paragraph,
because they share the fact.

RELATIONS owes every section the doorway out and nothing inward: it may call
the scene back once, and it never re-teaches the arc, the situation, the drive
or the organ.

**The misread beat, split.** Two beats were written as one and they are
different. DESIGN's is the misnaming by others: what a person carrying this
drive gets called (ego, passive, arrogant, dwelling). KEYS' is the mishandling
by self: what you do with your own low season (treat it as a fault, think
harder, rearrange the outside). DESIGN owns the first, KEYS the second, and the
stem "The misread is to call this X, or Y, or Z. It is none of those" is
retired from both. CODE may carry one of them, as the low face in its second
paragraph, never as a pair listed.

**The two bodies.** Human Design answers where the energy is felt: a region, a
pressure, a function. The throat as a gate; the crown as a broadcaster. BODY
answers what tissue is doing the work: the thyroid setting the pace, the
pineal reading a light it never sees. So DESIGN's centre paragraph names no
organ, gland or chemical, and BODY's physiology names no centre. When they
coincide (throat and thyroid on 23 and 33, head and pineal on 64), DESIGN
keeps the sensation and BODY keeps the mechanism, and the same sentence never
appears in both. The reader who swipes from Human Design to Body should feel
they went from feeling to fact, not from one description of the neck to
another.

**The one-minute test.** Cover the labels. Take the section's first sentence
and its last, and strike from them the card's name, the hexagram's name, the
gate's name, the three Gene Keys names, the organ and the amino acid. Put what
is left under the ring sibling's name, then under the channel partner's. If
either sentence is still true there, the section is not this card's yet. Run
it on the sibling and the partner specifically, because that is where the
lifts are (the glycine paragraph on 47 and 64, the thyroid sentence on 23 and
33). A section passes when its first and last sentences would be false on the
two cards nearest it. The test is of interpretation, not of fact: a shared
fact (leucine is eaten, not made; Thunder moves) does not fail because it
stays true on the sibling. If the sentence is only a shared fact, the test
moves to the next sentence that interprets.

---

## 5. The reading

The reading is the card's front door, and the whole card for anyone who reads
nothing else. It is written last, from the essence, after the five teaching
sections exist. It is guidance: it names the energy of this cycle of change and
shows how to stand in it well.

**It is about the energy, not the reader's week.** No "this week," no "today,"
no event. The reading names a phase every life passes through, and the reader
supplies the moment. Adrian, 2026-09-12: "we dont need to talk about the week
first or day this is about the energy of the cycles of change."

**Assume the reader knows nothing.** No system, no hexagram, no other section.
Every sentence must make sense to a stranger with nothing else on the page.
A sentence that leans on a picture the reader has not been given yet ("the
picture changes," "the horse will not go") is a fail.

**One sentence, one concept.** If a sentence needs a comma to carry a second
thing, the second thing is the next sentence. At most one adjective, and only
when the noun cannot stand alone. But fewer ideas, not more full stops: a
paragraph of ten short sentences is chopping, not writing. Three to five whole
thoughts per paragraph.

**Clarity over completeness.** The card has a vast amount of knowledge behind
it. The reading uses none of it as inventory. One clear picture at most, never
the scene's elements stacked ("cloud, thunder, rain still holding off"). If the
sentence is trying to be true to every tradition at once, it is trying too
hard; cut to the one thing.

**Nothing the sections say later is said here first.** The reading brings the
energy together; the sections unfold it. The sacral yes belongs to Human
Design, the gripping to the Gene Keys, the judgement's counsel to the I Ching.
Pre-emption test, sentence by sentence: if a later section will say this, cut
it here. The reading owes the sections silence, not a preview.

**The stance.** The reading speaks from balance. The difficult face is named as
the pull the cycle brings, never as the reader giving in to it. "The challenge
of this stretch is the pull to hurry," not "you explain the thing before it can
explain itself." Never narrate the reader failing; name the pull, then answer
it in the same paragraph with the balanced stance. The shadow stays present as
the challenge; the guidance always points toward the healthy relation.
Adrian's test: read it and ask what it is mainly about. If the answer is a
problem the reader has, it fails. If it is a live energy with a difficult face
and a gifted face, it passes. This stance rule is the reading's. The Shadow,
the two natures and the moving lines describe mishandling, as recognition
and never as a verdict; section 8 says how.

**Shape.** Three paragraphs, 130 to 180 words, one voice, to you.

The first names the energy of this cycle as it is when in balance: what it is,
what it feels like from the inside. It is shown alone in search and after a
cast, so it must be the whole energy by itself. Always lit, even on the dark
codes. It may hold one glimpse of the scene, one piece and never the list,
and only when that piece carries the energy alone. It is not the essence
and does not restate it; the essence is on the page above it.

The second names the pull, the challenge this cycle brings, as one plain
picture from ordinary life, and answers it in the same breath. The stance
stays balanced throughout.

The third is the guidance, ending up. The essence's way is carried here in
other words; the essence itself is shown on the page under the keynotes, so
the reading never repeats it verbatim. End
plain and a beat early, but end up.

**Provenance.** The reading is written from the essence and the sheet, after
the five sections, and it is distilled from them through the essence, so it
shares their central meaning and keeps honest provenance on the sheet. What
it may not do is repeat their explanations, their distinctive sentences or
their detailed counsel. The tell is not a sourcing list that names several
traditions; the tell is a paragraph a reader meets again, in different
clothes, three panels later.

**Checks, after writing, in this order.** The stranger test. The one-sentence
one-concept test. The pre-emption test. The stance test (is the reader ever
shown failing). The recognition test, which runs the other way from the old
lens check: a reader who knows only the I Ching should recognise this energy
as hexagram N with no hexagram furniture in the text, and the same for the
Gene Keys, Human Design and the tarot. Recognition, never inventory. Then
Adrian's mainly-about test.

**Sheet entry.** The reading gets a sourcing entry (section 13): which vault
files the energy, the difficult face and the closing trace to, and which one
piece of the scene, if any, it holds.

---

## 6. Card name and keynotes

The card name is two to four words, a third thing, a concrete picture, no
system's vocabulary. The names exist for all 64 and are not revisited here.

**Keynotes are the card in seven short phrases.** They are the first thing a reader
sees after the name, on the page and on the card face, before any prose. A
reader who reads nothing else has to understand what this energy is about
from them alone. Adrian, 2026-09-12: "they need to be understandable, they
need to be something that I can really understand what this is about,
without going into it."

**Written last, from the finished card.** Five to seven, one to four words
each. Each keynote points at something the finished card actually says, in
the card's own words where it has them ("Root Before Shoot," "Small Rough
Moves," "The Pull to Hurry" on card 3). A keynote that could sit on twenty
cards ("Right Timing," "Fresh Ideas") is cut. A word lifted from one height
without its context ("Play" from the Siddhi) is cut.

**Both faces.** The set covers the energy in balance and its challenge, in
the reading's proportion: most of the seven name the energy, one or two name
the pull ("Not Yet Settled," "The Pull to Hurry"). None names the shadow as
a verdict.

**The stranger test stands.** A stranger with no framework must get each one
cold in under a second. Four automatic fails: a word not used in ordinary
speech; a keynote that only makes sense after reading the card; a keynote
that names the shadow rather than the energy; an instruction rather than a
naming. Read the seven aloud in a row; they should sound like one energy
described from seven sides, not a list of nouns.

The keynotes are shown as labels before any prose, so no section opens by
saying one of them. The reference: card 3's seven.

---

## 7. I Ching

The section that carries the scene whole. The oldest voice on the card, and
the one with the most behind it: six translations, the philology, the lines.
That depth is the point, and it is also the trap: this section must never read
as a history book. Worked through on card 3, 2026-09-12, with Adrian reading
each pass on the page; the rules below are what survived.

**The Reading is the wisdom.** Nothing in this section explains the system,
names a source, or refers to the figure's parts. No "a hexagram is," no "the
six lines show," no "the tradition returns to," no "the translators." The page
carries one short essay behind the glyph for anyone who wants the system, and
it is written once. Every sentence here is the wisdom of this hexagram for the
person reading, given as if it were the writer's own to give.

**Symbols land on a person.** Every element (the two trigrams, the character,
the Judgement, the lines) earns its place only if it gives the reader something
to feel, recognise or do. "A firm line struck under two open ones" describes a
diagram. "The part of you that has already started moving, before there is
anywhere to move to" is the same trigram as a person knows it. Never the
diagram alone.

**Old words brought up to date.** "The counsel is plain" means nothing to a
stranger; "What this asks of you is simple" does. Every classical phrase is
translated into a complete modern sentence with its connecting words in. Do not
change what is said; make it followable.

**One unit, one job, no retelling.** On the page the reader meets, in order:
the glyph (tap for the symbol and the essay), the Combination, the two
trigrams behind tabs, the Reading, the Image, the Judgement, the coins. Each
says something the others do not.

- Combination, 40 to 70 words: the picture the two forces make together. No
  "you," no counsel, no situation described as the reader's. On the nine cards
  whose character is a true picture (3, 18, 27, 42, 47, 48, 49, 50, 56, per
  `todo/plans/writing-guideline/hexagram-characters.md`) it may close with
  "The traditional character draws X." Nowhere else is the character mentioned,
  and never "the old character" or "the name means."
- Upper and lower trigram, 70 to 110 words each: the force as itself, in the
  world, then in a person, then its risk. Nothing about this card's situation;
  that belongs to Combination and Reading. The same trigram reads alike on
  every card that carries it; these are reference entries and are meant to
  repeat. On the eight cards that double a trigram, the upper entry carries
  the reference text and the lower entry says what it is to have the same
  force underneath as well, in the same register; two unrelated Earths (card
  2's field above, seed below) are two inventions where one reference was
  wanted.
- Reading, 180 to 260 words, to you: the situation as a person lives it, what
  it asks, the body once, the posture. Never the picture again in the
  Combination's words. Never "lines," "trigram," or "hexagram" as parts.
  Never a Judgement line rendered a second time (card 2's Reading closed a
  paragraph on the Judgement's own "rest in what is steady, and it goes
  well"), and never a moving line's scene (the frost, the tied sack); the
  lines are read alone after a throw, and a Reading that spends them has
  spent the throw.
- The symbol, optional, two short paragraphs, this hexagram's lines only:
  where the whole lines sit, where the open ones, what that shape says. It
  lives in the popup behind the glyph, above the general essay, never in the
  flow. Written only where the shape teaches something.
- The Image, then the Judgement, then the coins. The Image sits first because
  it continues the Reading's posture (a scene, then how to act in it); the
  Judgement's ruling sits beside the throw whose moving lines qualify it.

**The body, once, with its reason.** The Shuogua, the I Ching's own appendix,
gives each trigram a body part: Heaven the head, Earth the belly, Thunder the
foot, Wind the thigh, Water the ear, Fire the eye, Mountain the hand, Lake the
mouth. Real tradition, and it may be used. It appears once per card, near the
end of the Reading, never in the trigram texts, with the reason (the foot steps
first; the ear takes in what the eye cannot yet see) turned toward the reader:
feel for it now. Say "these two forces each have a place in the body," not "the
tradition gives." Organs are not this section's: the five-phase organ mapping
is later and contested and belongs to Body if anywhere. The body is one aspect
of the reading, never the reading.

**The labels carry the meaning.** The classical names stay, and a plain
subtitle beneath each says what the thing is in eight words or fewer: "The
Judgement" over "the ruling on this situation"; "The Image" over "the scene,
and how to act in it." "The oracle's answer" is false (the Judgement is King
Wen's verdict on the situation, not a reply) and is retired. The classical
lines themselves are rendered fresh by the method below and are never
annotated; the frame explains, the text never does.

**The coins.** The widget throws against this card's own lines; the reader
already holds the card. The copy says what casting is to a stranger and makes
them want to: what people have done for three thousand years, that this card is
already their answer, that the throw shows where they are in it and what it is
turning into. Two or three sentences. After the throw: "Your throw" over the
bars, "Turning into" over the becoming hexagram, "The lines in motion" over the
lines, each "Line 2 · in motion" then "Turned over, it leads to Hexagram 60 ·
Limitation." Retired: "cast" as a noun, "moving toward," "unstable," "flipped."

**Moving lines.** Each is read alone after a throw, beside the essence, so each
is a self-contained micro-reading, 50 to 70 words: the scene of that line as a
person lives it, what it asks, and the counsel in its last sentence, with the
hexagram it becomes named plainly. The `_image:_` marker is the scene in one
plain clause, shown on its own after a throw, so it must make sense alone
("a post set in the ground, the marker that will not be moved"). The same
rules as the Reading: complete sentences, no system words, no source announced
("the old commentary jokes" is retired). The lines never re-teach the whole
hexagram. Inside this section the thing is a hexagram, never a code. Card 3's
six lines are the reference.

How a line is made, and the check that it is faithful: read the line in all
six translations and the Eranos gloss; keep every element of the scene the
sources agree on (the horse standing, the suitors not raiders, the ten years);
translate the compressed verdict into what it asks of a person ("advantageous
to be made a feudal ruler" becomes "set something down that stays put, a place
people can find you"); cut any detail a stranger cannot use (the soapnut tree).
Then check the line back against the source: every element of the original
scene should be findable in the rewrite, and nothing should be there that the
sources do not carry. A line that reads well but drops the scene is a
paraphrase, not a translation.

**The hand-off.** The last paragraph of the Reading may hand to the Gene Key by
naming the shadow's word inside the situation, never by naming the system.

**The classical-text method** for the Judgement and Image lines: assemble the
six translations (Legge, Wilhelm, Huang, Cleary Taoist, Cleary Buddhist, Deng)
and the Eranos philology; map where they converge and where they fork; form
the sense before drafting; draft the fresh rendering last; check it back for
faithfulness. The Image's second line opens on its hinge word (So, Thus).
Wilhelm is in the vault for all 64 now and is cited.

**The deep-pass standard** stands for this section and for BODY: carry the
philology inside the teaching rather than announcing it; no bare
transliteration standing alone; carry the named figures from the sources
without crediting them; write each moving line from its own line file's scene.

---

## 8. Gene Keys

Its question: what does this energy become, at its lowest and its highest.
Not the situation (the I Ching has it), not where it presses (Human Design has
it). One energy at three heights, and the movement between them.

**The guidance, never stated.** Adrian's own reading of the three heights,
2026-09-12, is the model every Gene Keys section is written to, and no card
says it. The Shadow is the seed: under the earth, surrounded by what has died,
pushed down or lashed out from, and it moves only when it is learned from. The
Gift is the plant: you stop fighting the energy, stand with it, and it starts
to give. The Siddhi is the flower: you stop holding it as yours, it is a force
moving through you, and you are what it moves through. The reason to learn the
Shadow at all is to recognise it in yourself and move: through the pushing
down, into feeling it, holding it, letting the stories around it go, and up.
This arc is woven through every paragraph as its shape and direction. The
words seed, plant, flower do not appear on a card; the arc lives once, in the
page's "Gene Keys · about" essay, in Adrian's words.

**Assume nobody knows the Gene Keys.** Shadow, Gift and Siddhi are shown as
labels. The prose never explains the system and never uses those three words
as terms of art; "at its lowest," "when it is met," "at its height" do the
work. No Rudd, no "the 64th Gene Key," no coined phrases.

**Describe the energy, never diagnose the reader.** "Numbness is," not "you
are numb." The Shadow is written as recognition: what this energy is like when
it is held down, so a reader can find it in themselves without being told
they have it. The two natures are two pictures of a person, one who goes still
and one who lashes out, each a whole person in three sentences, never a
verdict.

**Each height stands on its own.** A reader may already live at the Gift or
the Siddhi; the card is not a course they take in order. The Gift opens on
what the gift is and does, as something the reader may have been born with.
The Siddhi opens on the height itself. Neither is written as the exit from the
one before ("when you stop fighting the fear" is retired as an opener). Then,
in its second paragraph, each height names the state below it as its fuel: the
Gift grows out of the very fear under the Shadow; the Siddhi is what the Gift
becomes when even the maker lets go. Someone coming up from the lower state
sees their fear as the raw material of this exact gift. Fuel, growth,
transition, never the door the reader came through.

**Open on what is present.** The first sentence of any height says what the
energy is, never what is absent. "Nobody in you is holding anything and
nothing needs holding" describes two absences, and a reader cannot feel an
absence. "Innocence: meeting whatever comes as if for the first time, with
nothing to protect" is something they have felt. Negation belongs later, if
at all.

**The movement is the section.** The Shadow paragraph carries the seed and the
first turn (what it is like to feel it instead of pushing it down). The Gift
carries the standing-with and the giving. The Siddhi carries the letting go of
ownership and the force moving through. The reader should feel one thing
rising through three heights, not three descriptions.

**Read with five questions, per height.** Before a sentence is written, answer
from the chapter and the essay, for the Shadow, the Gift and the Siddhi: what
it is; what it does; what it asks you to do; what it feels like; what it is
not. The section is done only when it answers all five for each height without
the source open. The first card 3 draft answered the first three and skipped
the last two, and every serious loss sat in those two: the Gift had none of the
delight the source insists on, and the Siddhi opened on the newborn's
innocence, the one kind the source says it is not.

**Find the thread word and carry it to every height.** Read the last paragraph
of the Shadow and the last of the Siddhi in both texts and see what they share.
On key 3 it is love: clinging at the bottom, the centre at the top. That word
appears once at each height in its plainest form. "There was an order under
the fear the whole time, and it was holding you" becomes "What was under the
fear was love, and it had been holding you the whole time."

**Earn the label.** Cover the label and read the paragraph. If a stranger would
guess a neighbour (Fear, Clinging) rather than the name (Chaos), the paragraph
has described the neighbour. Rudd's answer for Chaos is that the disorder you
dread is the shaking of your own grip, and a threat shows it rather than causes
it; the section has to make that join.

**Subsections and lengths.** Shadow, 150 to 200 words. Repressive nature and
Reactive nature, 35 to 55 each. Gift, 150 to 200. Siddhi, 110 to 160, present
tense, spacious. Shorter than the pilot's 600; the older cards packed the
chapter in.

**Voice.** The ten rules. One picture per paragraph, carried across the three
heights at three temperatures; never a new picture per paragraph. Complete
sentences. No "not X but Y" beyond the card's one hinge. The Siddhi does not
end by looking back at the Shadow as raw material, does not close on a
paradox of effortless arrival, and does not close on a pair of absences
("nothing here to reach and nothing here to lose"); the last sentence of the
card's highest paragraph names something present.

**Retired here.** "The inward face of the Shadow," "the outward face of the
Shadow" (36 cards). "Most people treat this as a fault." The look-back closer.
The stock paradox.

**The body in this section.** When the source locates the work in the body,
say so once as where the work goes, never as a seat. The seat is Human
Design's.

**The reference.** Card 3's Gene Keys section, written from the whole
chapter by the method in `todo/plans/writing-guideline/gene-keys-guidance.md`:
read the chapter and the essay completely, say what each height teaches in the
plainest words, keep the source's insistences (being changed by what happens;
joining rather than standing alone), leave out what a stranger cannot use, then
write with one picture across the three heights.

**Names.** The Shadow, Gift and Siddhi names are kept lineage, shown as labels.
The repressive and reactive names come from the reference row in the vault,
never inferred; the rows are full for all 64 now.

---

## 9. Human Design

Its question: where does this energy press in me, and what does it drive me to
do. The I Ching reads the situation and the Gene Keys read what the energy
becomes; neither says where in you it is happening or what it makes your
hands do. Human Design is the one tradition that put the sixty-four on a body,
and that is this section's job. Worked through on card 3 with Adrian,
2026-09-12; the plan and the audit are in
`todo/plans/writing-guideline/human-design-guidance.md`.

**The frame: borrowed wiring.** A gate is about always and a reading is about
now. The bridge is the system's own claim that everyone meets every gate's
theme through the people near them and the turning of the year. So the
section describes this energy from inside a body that carries it, and what
the people built for it have had to learn: where it sits, what it drives, what
it needs to run, what starves it. The page carries the frame line once under
the panel's name ("where this presses in you, what it drives") and the system
once in the "Human Design · about" popup. The prose never explains the
system and never says "with this card drawn" or "this card." It says
"through this lens" or names the energy.

**It is a lens, not the energy.** The energy is the thing; Human Design is one
lens on it. Every subsection opens from the energy as this lens sees it, never
from the system. That is a move, not a string: card 3's "Through this lens,
the energy of beginning is" and "Seen through this lens" are card 3's
openings, and the first-five-words test (section 12) applies to them as to
anything else. Card 2 repeated them and the measurement flagged both
(2026-09-12); each card enters the lens in its own words. Gate, centre and channel are named once each because readers
who know the system expect them and the labels show them, and each is
explained in body terms the first time. The name arrives inside a sentence
that does work ("Gate 2 is the part of you that knows which way your life
faces"), never as a bare re-announcement of the heading ("Gate 2 is called
the Direction of the Self," "The place is called the Identity Centre").

**Embodied education, both at once.** Adrian wants readers to learn Human
Design through the cards and to embody the energy better. So the mechanics
are real (the centre named, defined and open told apart, the pulse, the
response) and every mechanic is felt in the body as it is taught and related
to the reader and to this energy. "Gate 3 sits in the Sacral" is a fact;
"something in you is trying to begin, and this is the place it begins from"
is the same fact as the reader lives it. Both sentences are needed.

**Never claim the chart.** The prose never says the reader has this gate,
lacks the partner gate, or has this centre defined or open. It says what each
case is like ("if your Sacral is defined, as it is in seven people in ten; if
it is open"). The page shows a signed-in reader which case is theirs and
links the partner card; a signed-out reader is invited to sign in. Types,
strategy, authority and profile are the reader's chart and are never taught.

**The three subsections, each entering deeper.**

- The drive, 150 to 200 words: enter the energy through this lens. Open on
  what the energy is as Human Design sees it and what it is for (the gift
  first: gate 3 is the drive that gives new things a form that can last),
  then what it does in you, then the name it gets called from outside and
  what is really happening. Ends on recognition, never on instruction. Not a
  paragraph about the misnaming; the first draft spent its length there and
  read as all negative.
- Where it lives, 180 to 240 words: enter the body. Where the energy runs
  (the centre named and located), what that place does, what it is like when
  it is defined and when it is open, what this energy needs to run there and
  what starves it, and how it moves (steady, pulsed). The operating conditions
  are spent here once. No organs or glands; that is Body's.
- What completes it, 70 to 100 words: enter the circuit. What this pressure
  needs from outside itself, the partner gate named once with what it is
  called, what the two make together, and that the other half may sit in you
  or in someone near you. Short, because the partner's own material lives on
  the partner's card, which the page links, and the your-chart line beneath
  says whether it is defined in you. Some gates sit in more than one
  channel; the card writes the channel its frontmatter names
  (`design.channel`) and says "one of the wirings" rather than implying a
  unique completion. The packet and the one-minute test use that partner.
  Describing what the wiring does is the section's job; telling the reader
  how to make decisions is not, whatever the books say about authority.

**The five questions, adapted to a gate.** Before writing, answer from the
gate article, the gate essay, the channel article and the centre reference:
what this energy is through this lens; what it does in a person; what it
presses you to do; what it feels like from inside; what it is not. Done only
when the section answers all five without the sources open.

**Sources and the packet.** The seven Human Design books in the vault are
460,000 words and organised by chapter, not by gate. The one-time preparation
is a reference for each of the nine centres (about 450 words, in the card's
voice, no organs) and one for the system's principles, distilled from Winn's
centre chapter, Parker's centre chapter and one function line each from the
Modern Guide and the 2021 guide, read by Adrian, then reused. A script with
no model assembles the per-gate packet: gate article, gate essay, channel
article, the partner's essay, the Modern Guide's per-gate and per-channel
entries, the centre chapter's lines on that gate, the centre reference, the
principles reference, about 4,900 words. The sacral and principles references
are drafted at `oracle/human-design/centers/_reference-sacral.md` and
`oracle/human-design/_reference-principles.md` in the vault. Understanding
the Profiles, Understanding Your Clients and most of You and the Shadow are
never read for the cards.

**Voice.** The ten rules, the punctuation check, the plain thing first. No
"Gate N is the Gate of" opener. No "the misread is to call this" stem (40
cards). No "the whole teaching" (27). No Alone-then-Joined turn closing the
channel (52); "Together they make" and "The two of them make" are the same
move. No coaching close on every paragraph; the operating conditions
appear once, in Where it lives.

**The reference.** Card 3's Design section.

---

## 10. Body

Its question: what is my body doing while I feel this. Not where it presses
(Human Design has it), not what it becomes (the Gene Keys have it). One
literal thing in the body and one literal building block, and what each is
doing.

**The frame.** Body is the floor. Every other section describes the energy
as it is lived; this one hands the reader a fact they can check outside the
card, in their own body, and it lands because it is true whether or not any
of the systems are. It is spoken as a layer of the oracle, never as a biology
explainer, and never as a healer. The deepest inward point of the card,
written after KEYS and after DESIGN, having read both.

**Assume nobody knows any of it.** The organ and the amino acid are named in
the two subsection headings and as labels. The prose never explains where
the assignments came from, never names a codon, a ring, a chart, a centre or
a system, and never says "this code is seated in." It says what the organ is
and what it is doing, and what the amino acid is and what it does, to you,
in words a stranger could repeat to a friend.

**The two subsections, each giving one thing.**

- Physiology, 120 to 180 words: the organ or gland, what it is in plain
  words, and what it is doing while this energy is felt. Open on the thing
  itself, never on the region ("put a hand below the navel" is Design's
  gesture now). One mechanism, told as something happening in you right
  now, that a reader could notice inside a minute. When the organ is a
  Human Design centre by another name (the sacral plexus, the solar plexus,
  the throat and thyroid) the region is already spent in Design, and this
  paragraph writes only the tissue and what it does.
- Amino acid, 100 to 150 words: the one amino acid, what it is (made by the
  body or eaten), what it builds or signals, where it comes from, and one
  fact about it that is relevant to this card and not the obvious lead on
  its ring siblings. Facts a reader could take into a kitchen, stated as
  facts and never as advice. Then, when the card's scene and the fact rhyme
  on their own, one sentence that lets them; when they do not, the paragraph
  ends on the fact. Under 330 words for the section.

**The entry, and the paragraphs.** Body opens like every section, from the
energy through this lens. Card 3's entry: "Seen through the body, the energy
of beginning sits at the navel, the one place on you where a beginning was
once made under a cut supply." Those are card 3's words; the next card
enters the same way in its own (the first-five-words test applies, and card
2's copy of the opening was flagged, 2026-09-12). The lens is named, so the
placing is the lens's and not a
claim that the energy lives in the organ; that is the one place a location
is given, and the prohibition below is on bare seat claims ("this code is
seated in," "the body holds this energy at"). Then the thing itself. It is
never a bare anatomy paragraph with no connection to the energy or the
reader. Two paragraphs per subsection: the entry with the thing, then the
mechanism the reader can check. Not one block, and not four; an entry
sentence standing alone is a stub, and a mechanism split in two breaks its
motion. Adrian approved the two-paragraph shape on the page; it is the one
required shape in this chapter, and the order inside the paragraphs is the
card's own.

**Only what the reference supports.** Every physiological claim traces to
the organ entry or the amino acid entry, at the claim's own scope. "The
strongest signal a cell gets" needs the entry to say so; a neighbouring fact
or an oracle metaphor is not evidence. A claim the entry does not support is
softened to what it does support or cut. Nothing asserts that the energy
causes a physiological change.

**Read with five questions, for the organ and again for the amino acid.**
Before a sentence is written, answer from the two reference entries and the
card's KEYS and DESIGN: what it is; what it does; what it is doing while
this energy is felt (for the amino acid: what it signals); what a reader
could notice or use; what it is not, which for the organ is the region and
for the amino acid is the ring's meaning. The section is done only when it
answers all five for both without the references open.

**The ring rule.** Ring siblings share the amino acid (leucine on 3, 20, 23,
24, 27, 42). The shared facts (made or eaten, what it signals) are stated in
one clause at most, and the paragraph is written from this card's scene; run
the one-minute test against the two nearest siblings before anything else.
Today three leucine cards carry the same two facts as their lead, which is
the fault this rule exists for.

**Voice.** The ten rules and the two-minute check. To you throughout ("put a
hand to your throat and swallow" on card 33 is the model register). One
picture per paragraph, and the picture is the mechanism itself, never a
second picture of the scene. The measured checks apply here as everywhere:
under 15 words a sentence, under three commas per hundred words, no sentence
with three commas, no list of nouns. Card 3's Body measured 16.4 words a
sentence and 4.4 commas per hundred on 2026-09-12, over the line; Adrian
read it on the page and kept it, recorded in section 15 as an exception.

**What it must not do.** Describe the region a second time; name the centre;
make a bare seat claim outside the lens entry above; claim the
amino acid is the card's chemistry, or that contemplating the card affects
it, or that eating more of it serves the card; mention supplements, illness
or healing; call any of it old ("the old maps," "the old yogas," "the old
teaching" are retired here with the rest); explain or defend the
hexagram-to-codon correspondence; invent anatomy (every mechanism traces to
the organ entry or is cut); and end by stepping back to say what it meant.

**Retired here.** "Bodily floor" (32 cards). "There is a teaching in that"
(39). "The code runs all the way down to this" (45). "Deeper than the organ."
"The old teaching puts," "the old maps tie," "the old yogas watched." "The
shadow has a bodily floor here too." "The climb out is also bodily." "The
letter this code is written in" and "the letter under this code" as the
amino acid's introduction on every card. "One real fact about it" as a
required beat: a paragraph is not one fact plus a moral.

**The shape is optional.** The three beats (organ, the shadow's floor, the
climb out) and the two beats (fact, teaching) are retired as required
shapes. A section that runs organ-then-floor-then-climb on all 64 cards is a
formula with fresh words.

**The reference.** Two files in the vault, made once: the amino acid entries
(twenty-two, one per ring) and the organ entries (about thirty-five), each
with a `sources:` list, drawn from clinical and anatomical references and
not from any of the three systems. The packet per card is the two frontmatter
words, the two entries, and the card's finished KEYS and DESIGN.
`todo/plans/writing-guideline/body-guidance.md` holds the reasoning.

**Names.** The organ and the amino acid are the chapter's two words, kept as
labels from the card's frontmatter (`body:`), never inferred. The codon ring
is a family and lives in RELATIONS.

---

## 11. Relations

Its question: who else carries this, and what does it become when it meets
its kin. Not the energy itself (the five sections above have it), but the
energy beside others, so its edges show. The doorway out and the true final
section.

**The frame.** Relations is read one kin at a time. The panel shows this
card at the centre and its kin around it, and a reader taps one node and
reads one text. So each kin's paragraph stands alone: it names its kin in a
sentence a stranger can place, says what the two energies make together, and
says why you would open that card next. No paragraph refers to another
("these five," "read together," "also carries"), and no sentence totals the
section ("between them they hold," "six voices and one message"). The one
exception is the one-line underscore intro under the heading, which the
compiler requires: one sentence, to you, saying what this card's kin have in
common, with no "this card" and no totalling closer.

**Assume nobody knows any card but this one.** A kin is named by its card
name and then placed in plain words in the same sentence (Veils of
Knowledge, the not-knowing that has moved into the head). Never a name
alone, and never a list of names. Lineages may be named here and nowhere
else on the card ("the Gene Keys pair this with," "the I Ching turns this
over into"), without a book title. Never the mechanics: no codon, amino
acid, ring index, gate number, defined or undefined, upright or reversed.

**Never claim the chart.** The channel partner is kin here as on every card;
the prose never says whether the reader carries the other half. The panel
shows a signed-in reader that from their own chart.

**Subsections and lengths.** Pair, 50 to 90 words: the same energy a season
on. Inverse, only when it differs from the pair (one merged Pair when they
are the same hexagram, a self-inverse heading for the eight cards that meet
their own reflection). Programming partner, 50 to 90: the opposite pole, the
two low faces feeding each other, why open it. Codon ring, 50 to 90: the
family, what the members share, where this card sits, siblings by plain
theme. Channel partner, 30 to 50, once the compiler carries the heading;
until then the partner is named once inside the Human Design section and
nowhere in Relations.
Tarot: one lead sentence as the card's single scene callback, then the ring
arcana bullet at 30 to 50 words and each trigram bullet at 25 to 45.
Immortals, 40 to 70. Deeper correlation, two bullets of 20 to 35. Under 650
words for the section, and under 400 in the kin that matter (pair, partner,
ring, channel).

**Read with five questions, per kin.** Before a sentence is written, answer
from the kin card's kin brief (a short source-checked note per card, made
once, so this section never waits on the kin's own finished sections) and
the ring or trigram file: who
this kin is; what the two make together; why you would open it next; what it
feels like to meet it; what it is not. A kin paragraph is done when a reader
who has read only this card could say which card to open and why.

**Voice.** The ten rules and the two-minute check. To you throughout. One
picture per kin. The measured checks apply here as everywhere: under 15
words a sentence, under three commas per hundred words, no sentence with
three commas, no list of nouns. This has been the deck's worst-measured
section; card 3's Relations ran 25 words a sentence and eight commas per
hundred before today.

**What it must not do.** Re-teach the scene, the arc, the drive or the organ
(the one callback is the Tarot lead sentence, and the Pair may glance at the
scene when the pair is its other half). Describe the kin card in full; one
sentence places it, and the panel links it. Stack teaching on a
correspondence two hops away. Name the reader's chart. Total the section.

**Retired here.** "[Name] stands above" (52 cards). "Between them they hold,"
"six voices, one message" and every totalling closer. "Read together." "X
also carries Y" and "the ring gives one Major" inside a bullet. The arcana
inventory paragraph before the bullets (the lead is one sentence). "Keep this
crossing" as a stock Immortals opener. The Alone-then-Joined turn.

**Reference entries repeat.** The trigram definitions, the Immortals' placing
sentences and the ring's shared-theme sentence describe the same thing
wherever they appear and are not diversified. They come from the reference
files below, once those exist.

**The one-time preparation.** Three sets of files, made once, then read by
every card that shares them. The 22 ring files each gain a shared-theme
paragraph of about 80 words in the card's voice (what the members share,
where each sits), drawn from the members' Gene Keys chapters and the 64
Ways essays, which is the only place the theme is stated; Fable writes them
because the theme is a reading, not a fact, and Adrian reads them once. The
eight trigram files each gain about 150 words: the trigram's meaning in a
person (the deck's ICHING trigram paragraphs already do this well and can be
harvested), its classical body part from the Shuogua (already gathered in
`trigram-body-research.md`), its two arcana with the plain reason for each,
and its Immortal; Sonnet drafts, Fable checks the voice. The eight Immortal
files each gain the placing sentence and one story line of about 60 words
from commonly agreed lore, labelled as such; a Sonnet job. Then the per-card
packet is assembled by script with no model in it: the pair card's CODE, the
partner card's CODE, the channel partner's CODE, the ring file, the two
trigram files, the ring arcana's tarot reference card, the Immortal
references for this card's pair, the inverse when it differs from the
opposite, and `relations_data`. About 2,500 words. The Deeper correlation needs no file; its two facts are on
the tarot reference card. Until the files exist, the practice stands: write
from established lore, keep to what is commonly agreed, record "established
lore, not vault-sourced" in the sheet.

**Names.** Kin names and numbers, the ring, the arcana, the Immortals, the
sky and the letter are facts from `relations_data`, kept as labels in the
headings and bullets, never inferred.

---

## 12. The anti-formula method

The method that finally worked, after four passes, and its extension.

**Ban stems, never phrases.** Banning "the body seats this code in the chest"
produced "at the chest" on 23 cards. Ban the first four or five words
regardless of what follows, and measure the same way.

**The one test.** Take the sentence's first five words and ask whether it would
work unchanged on any of the other 63 cards. If yes, it is a formula whatever
its grammar. The measurement script runs this over every subsection opening
and every CODE paragraph and reports any opening shared by three or more cards.

**A banned phrase is a construction, not a string.** "Held together, they are"
totalling up a field is the formula; "a group held together by a bond nobody
can see" is writing. The seven decided keeps in the old pass-four record stay
kept.

**Shapes are formulas too.** A fixed order of beats is a formula even with
fresh words: organ, then floor, then climb; fact, then teaching, then "runs all
the way down"; drive, then misread; alone, then joined; Siddhi, then the look
back. The test extends from the first five words to the section's spine: if
the paragraph order could be described identically for another card, vary it.
Required content is not a required order. Chapters 7, 9 and 10 say what each
subsection must contain (the trigram as itself and as the reader knows it,
the drive and where it lives, the organ and its mechanism); they do not fix
the order those things arrive in, except Body's two paragraphs, which Adrian
approved as a shape. Card 3 shows one order; the next card finds its own.

**Test the neighbours first.** Cross-card lifts cluster on ring siblings and
channel partners because they share facts. Run the one-minute test against
those two cards before the deck at large.

**A worked sample teaches its own opening.** If a brief must carry one, say
that its first sentence is off limits.

---

## 13. Sources and what they allow

**Where the corpus is.** `~/Documents/Obsidian Vault/Mandala Codes/oracle/`.
Per hexagram: six I Ching translations (Legge, Wilhelm, Huang, Cleary Taoist,
Cleary Buddhist, Deng), the Eranos philology, Benebell Wen's I Ching the Oracle
(the file the vault calls the Practical Guide), the Gene Keys chapter, the 64
Ways essay, the Gene Keys reference row, the Quantum Wellness gate essay, the
tarot correspondence cards, six moving-line files carrying five translators
each, and the hexagram index. Beside them: the codon-ring membership tables,
the scraped gate and channel articles, Robin Winn's centre chapters, and seven
unwired Human Design books. As of 2026-09-12 every file is populated for all
64 hexagrams; the 39 empty extracts in hexagrams 50 to 64 were refilled from
the original chapter PDFs.

**The refill practice, with no model in it.** `scripts/refill-vault-extracts.mjs`
finds empty vault extracts and fills them from the chapter PDFs with
pdftotext, falling back to OCR where a PDF's fonts are broken (the ten Wilhelm
chapters), and regenerates the Gene Keys reference rows from the master
spreadsheet. Dry run by default; `--write` applies; every write records its
source and method in the frontmatter. Run it whenever a source file is added
or an extract is found empty. Firecrawl is not needed for local PDFs and costs
credits; use it only for a web source.

**What each section may draw on, and where it is thin.** ICHING's Reading,
Judgement, Image and lines are the best fed material in the corpus. KEYS is
well fed by the chapter, the 64 Ways essay and the reference row. DESIGN has
the gate essay, the gate and channel articles and the deep centre chapters.
BODY has one line naming the organ in the Gene Keys chapter, and nothing else;
the amino acid is a fact in two places. RELATIONS has facts (pairing, partner,
ring membership, the tarot cards) and almost no teaching behind them: trigram
meaning, Immortal lore, ring themes and the tarot cross-mapping have no file.
Those four are the connective layer, and they were never extracted from a book
because they were always meant to be authored. Authoring them is its own
piece of work, one file per trigram, one per Immortal, one per ring; until then
section 11's "established lore" practice holds.

**Assimilate perfectly, then write.** Adrian's order: the base is AI assimilating
the texts completely, then the human element goes in. For a section this
means: read every source file the section may draw on, all of them, before
writing a word; note where they converge and where they fork; write the section
faithful to what they say and to nothing they do not say; and then write it as
its own thing, in the voice of section 3, with no sentence lifted. The card is
not a reference that plugs in sources. It is a complete thing that has read
them all and speaks for itself. A section that reads as a summary of its
sources has done the first half and skipped the second.

**Rights.** Legge is public domain. Everything else is in copyright, and three
families are long verbatim dumps (the Gene Keys chapter, the 64 Ways essay, the
centre chapters). Paraphrase, never quote at length; names, ring membership
and correspondence tables are facts and may be stated directly. Rudd's coined
phrases are his; the Shadow, Gift and Siddhi names are kept lineage.

**The sheet.** The app's frontmatter parser (`lib/oracle/card-markdown.ts`,
a hand-written YAML subset) stops reading `meta` at the first folded block
(`key: >`); `centre`, `scene`, `mechanism` and `sources` therefore come
first under `meta:` and every folded block after them, or the essence never
reaches the page (card 10, 2026-09-12). Every card records, in frontmatter under `meta:`, one entry per
section naming the vault files its sentences trace to, the essence, the
scene, the mechanism, and any place it wrote from established lore rather than
a file. One convention, replacing the two in use (the older `sourcing_note`
field and the newer trailing HTML comment). Fifty-two cards carry no trail
today; the trail is added in the pass that next touches each card. A card with
no sheet is not final.

---

## 14. Settled questions

The ten places two older documents disagreed, answered once.

1. KEYS length: the longer shape (about 600 words across five subsections,
   repressive and reactive as their own subsections). The 230-word shape is
   retired.
2. The Human Design channel lives in DESIGN as internal relating. The partner
   card lives in RELATIONS. The old connections guide's placement is retired.
3. Trigram-level tarot sits under Tarot; sky and Hebrew letter sit under Deeper
   correlation. As the cards already have it.
4. The card has six prose sections including DESIGN and BODY. The master
   guide's five-part anatomy is retired.
5. There is one essence per card, three short sentences, distilled after the
   sections are written, ratified by Adrian, stored in `meta.centre` and
   shown on the page under the keynotes. CODE's first paragraph is the
   standalone introduction the search and the coins show; CODE's third
   paragraph carries the essence's way in other words. Three texts, three
   jobs, and none repeats another.
6. ICHING Reading: 180 to 260 words, as section 7 gives it. Over 260 is a
   review, not a rejection; over 300 is cut.
7. The word in prose is "code" for the thing and "you" for the reader. The
   heading `## CODE`, the title `UL N` and the pill label "Universal" are
   structure and are not prose questions.
8. Sources are never named in CODE, ICHING, KEYS, DESIGN or BODY. Lineages may
   be named, without book titles, in RELATIONS.
9. Status is per section, six keys in the frontmatter, as the files already
   carry it.
10. `oracle/manuscripts/` and `oracle/editorial/` are migration residue one
    pass behind the cards and are archived. `oracle/cards/NN.md` is the only
    manuscript.

---

## 15. Status and passes

**Status** is per section: `scaffold`, `in-progress`, `final`. Final is an
editorial decision Adrian makes, never an automated score. Cards 1 and 2 lost
their locked KEYS, DESIGN and RELATIONS status in the move to Markdown and
carry `scaffold` where they should carry what he decided; that is re-set by
hand, not re-earned.

**The order of passes on a card.** The pilot on card 3 (2026-09-12) built
this document one section at a time, each read by Adrian on the page before
the next began: write, put it on the page, read, correct, crystallise the
correction here, then the next section. That loop is what this document
now carries, so production runs differently: the AI layer writes the whole
card in one sitting in the order below, the scripts check what can be
measured, and Adrian reads it on the page one section at a time, with every
correction still crystallised here before the next card is written. A
correction that is only this card's is recorded as an exception (below).

1. Read the sheet if one exists, and every source file the section may draw
   on; for Human Design and Body, the per-gate packet and the reference files
   (sections 9 and 10).
2. ICHING, from the six translations and the Eranos philology: the scene
   whole, then the symbol for the popup, then the six lines checked back
   against their sources.
3. KEYS, from the chapter, the essay and the reference row, with the five
   questions answered per height and the thread word found.
4. DESIGN, from the packet: the drive as the gift first, where it lives with
   the operating conditions, the channel short.
5. BODY, having read KEYS and DESIGN: the entry, then the tissue and the
   building block, two checkable facts.
6. RELATIONS, from the facts and the established lore, once section 11 has
   been through the loop.
7. Distil the essence from the five: three short sentences, energy, challenge,
   way. Record it, the scene and the mechanism on the sheet. Adrian ratifies.
8. The reading, from the essence, with no sentence from the five.
9. Keynotes, from the finished card.
10. On every section: the two-minute check, the punctuation script, the
    one-minute test against the ring sibling and the channel partner; on the
    reading, the recognition test; across the deck, the measurement script.
11. The sheet: sources per section, complete. Regenerate the corpus and the
    search index. Repoint any content-pinning test.
12. On the page: every panel loaded and read, the popups opened, the coins
    thrown once.

Then the human layer: Adrian reads the card on the live page, not in Markdown,
ratifies or strikes the essence, and makes the card his. That pass is the one
that takes a section to final, and it is the point of everything above. The
AI layer's job is to make that pass short.

**Who writes (decided 2026-09-12, confirmed 2026-09-13).** Fable writes
the template and nothing else: `oracle/WRITERS-BRIEF.md` is Fable's, under
1,900 words, positive, written in the register it teaches, and its one idea
is "say it to one person before you write it." Opus writes every card from
it; Fable never writes a card. (Fable's one trial section, card 1's Gene
Keys of 2026-09-13, is kept at `oracle/_archive/card-01-keys-fable-sample-2026-09-13.md`
as the sample the brief was written beside; the card itself is Opus's.) Opus writes the card, one fresh
agent per card, with the brief, card 3 and card 1's Gene Keys, and the
card's packet
(`node scripts/oracle-packet.mjs NN`, about 35,000 words, no model) as its
whole world, at the session's default effort. Two cards per agent at most:
the fixed reading is shared, and the third card in a long context loses
quality. Fable is not the writer; its cost is not
justified by the writing once the template holds, and card 3 was mostly
written by Opus under Adrian's reading. Scripts, with no model, do
everything measurable: the packet, the punctuation numbers, word counts,
shared openings, banned stems, system words outside their sections, em
dashes, italics, the frontmatter facts. Codex, on its own plan, gives one
independent review per batch if wanted. Adrian on the page is the only
human gate and the one that takes a section to final. Sonnet assembles
packets and references. The one-time references (nine centres, the
principles, the amino acids, the organs, the trigrams, the Immortals, the
rings, and a short source-checked kin brief per card so Relations can be
written before its kin are finished) are made once and reused sixty-four
times; each records its sources, its version and who checked it, and a
changed reference reopens only the claims that depend on it.

**Locked 2026-09-16.** `oracle/WRITERS-BRIEF.md` is locked as the template the 64 are written from, after card 1 went through the loop section by section on the page. Relations is paused and hidden on the page (`RELATIONS_PANEL_ENABLED`) until it has its own deeper dive; the other five sections and the essence, keynotes and reading are the production shape. Body is written from the organ and amino acid reference entries in the vault (`body/organs/`, `body/amino-acids/`), which the packet script pulls in and which are written once per organ and per amino acid before the cards that carry them.

**Batches.** Never all 64 blind in one day; that was the failure of June.
Card 2 is the test of whether the template alone carries a card: if Adrian's
corrections on it are few and local, the rest runs in batches of four with
rings and centres mixed (never two siblings in one batch, so lifts cannot
hide); if they are structural, the template was not ready and the batch
waits. Cards 14, 47, 52 and 64 were written before the loop and are brought
up to this document as migration cases before any new batch.

**Exceptions and versions.** Adrian may keep a passage that fails a written
rule; the exception is recorded here with the card, the section, the date
and the reason, and the rule is not loosened for it. A recorded exception
is not a precedent. Every approval is dated; a measurement quoted here
carries its date, and one older than the manuscript it describes is stale
and re-run before it is cited. Recorded so far: card 3 Body, 2026-09-12,
16.4 words a sentence and 4.4 commas per hundred, kept as read on the page.

**What card 2 taught (2026-09-12, the first card written whole from this
document by a fresh agent).** Eight faults, all now rules above: the essence
folded a source idea into a phrase (section 2); the mandated lens openers
became a formula across cards (sections 9, 10, 12); gate and centre names
were re-announced bare (section 9); the Reading rendered a Judgement line
twice and spent two moving lines' scenes (section 7); a doubled trigram got
two inventions (section 7); the Siddhi closed on paired absences (section
8); "Together they make" closed the channel (section 9); matched pairs
passed every check (3a.14). Everything measurable passed first time: all
six sections under the punctuation line, every length in range, no shared
opening. The faults the scripts cannot see are the ones this list is for.

**What cards 1, 4, 5 and 10 taught (2026-09-12, night, written from the
brief and the packets, checked by Codex at
`todo/plans/writing-guideline/codex-review-five-cards.md`).** The
mechanical faults were fixed before Adrian read them: a sheet written
outside the frontmatter, one-paragraph amino sections on all four, "today"
twice, a five-word keynote, the retired Siddhi paradox on card 10, and
physiological absolutes ("never touched," "about ten seconds," "then the
slower fuels take over"). The rest of that review is judgment and waits for
Adrian on the page. Four checks were added (3a.15 to 3a.18) because more
than one card broke the same thing: counsel rendered twice by meaning,
the Siddhi's closing paragraph, Body's absolutes, and last sentences read
across a batch.

**Re-measure after every pass.** `node todo/plans/writing-guideline/measure.mjs`
from the repo root reports word counts, shared openings and cross-references.
A pass that changed the deck and did not run it is not done.
