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

The worked reference is card 3's I Ching section (`oracle/cards/03.md`), the
only section so far that has been through this loop to the end.

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
  order (CODE, ICHING, KEYS, DESIGN, BODY, RELATIONS) and twenty-seven fixed
  `###` subsections. The compiler refuses a card that is missing any of them,
  so this shape is a constraint, not a preference. The `### Label — Tail`
  headings use an em dash as a parser delimiter; that is the one place the
  character is allowed.
- The reader meets the card name, the hexagram name and glyph, the keywords,
  the gate number and the three Gene Keys names as labels before any prose.
  Prose never re-announces them. A first sentence that says "this is Gate 1"
  or "your shadow is Entropy" has wasted itself.
- No markdown survives to the page. Bold, italics, lists and quotes inside
  prose render as literal characters or collapse into one block. Plain
  paragraphs only. The `_Keywords:_` line, the Judgement and Image bullets,
  and the `**Line N** · _image:_` markers are structure the parser consumes.
- The first paragraph of CODE is the card's essence everywhere else: the
  search anchor, the summary a tool returns, the text a cast shows for the
  hexagram it lands on. It is the most load-bearing paragraph on the card and
  must stand alone as the whole energy.
- A cast happens inside the card page and shows the reader one moving line by
  itself, plus that essence. Every moving line is therefore written to be read
  alone.
- The six panels are swiped in order: Universal, I Ching, Gene Keys, Human
  Design, Body, Relations. A reader can stop after any one. Each must be
  complete, and each must reward going on.

Two words the deck uses precisely. The **scene** is the I Ching's picture in
words: the dragon in the field, the mare on the ground, the fox at the ford,
the bed stripped from its legs up. It is a text description and it belongs to
the tradition. The **image** is Adrian's artwork for the card, the mandala
itself, and nothing in the prose is called an image. The older guides said
"image" for the scene; that word is retired in that sense.

---

## 2. The centre

Every card has a centre: the energy itself, named in one plain sentence such
that all the traditions click around it without forcing. The I Ching's
situation, the Gene Keys' arc, Human Design's pressure, the body's mechanism,
the kin's field all turn out to be describing the same thing, and the sentence
says what that thing is.

The centre is found, not decided in advance. This is the change from the older
plan, which wanted the sentence ratified before any prose was written. Adrian's
order (2026-09-12): assimilate first, distil after. So the five teaching
sections are written from the sources first, each faithful to its own
tradition; the centre is distilled from what those five sections turned out to
say; and the reading is written last, from the centre. Until the sections
exist, nobody knows what the centre is, and a sentence written earlier would be
a guess dressed as a decision.

The centre is one sentence. It is the same sentence wherever the card needs it;
there are not two (the old master guide's card-wide truth and the old rewrite
plan's reading-only truth were always meant to be one). It is recorded on the
card's sheet in the frontmatter (`meta.centre`) and Adrian ratifies it there in
his own pass. Its test is this: if the sentence is right, the situation, the
body-feel, the arc and the field snap into place around it without any of them
having to be bent. If one has to be bent, the sentence is wrong.

Alongside the centre the sheet records the scene (which of the I Ching's
pictures this card carries), the mechanism the card will hold together by (see
section 4), and where the centre recurs (section 4 again).

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

**The punctuation check, measured.** A section passes when it averages under
15 words a sentence, carries under three commas per hundred words, and has no
sentence with three or more commas. The reading Adrian approved runs 11 words
and almost no commas; the first Gene Keys draft ran 15 words and six commas
per hundred and read as broken, and lists like "the work, the house, the
people at your table, the body you wake in" are the usual cause. Run
`node todo/plans/writing-guideline/punctuation.mjs oracle/cards/NN.md` before
showing a section; it prints the three numbers per section. Fewer ideas per
sentence, not more full stops: a run of four-word sentences is chopping.

**No examples, no time filler.** "Anyone who has started a piece of work or a
family knows this hour" sorts readers into those who have and have not, picks
one writer's example, and says nothing with "this hour." Describe the state
itself, to you, and let the reader recognise it. Retired: "anyone who has,"
"this hour," "this stretch," "this season" as filler, "we all know."

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
rhythm rule as well as a word rule. In every section, one sentence runs long
and one lands short, on purpose and not in the same place each time; the short
one is not always the last. Three consecutive sentences within five words of
each other is a fail. And one paragraph per section may end on a punch; the
others end flat, mid-thought, or on the open part, the way a real conversation
does.

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
   Cut one hard or let one run.
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
another section of the same card; the same sentence on two cards.

**Where the centre lives and where it recurs.** The centre sentence lives in
CODE's third paragraph, as the turn, in words a stranger could repeat. Not in
the first paragraph, because the first paragraph is the essence, the energy
lit, and the counsel is what the essence leaves you wanting. It may recur
verbatim once, at the far end of the card: the last sentence of BODY's amino
acid paragraph or of ICHING's reading, so the card closes on what it opened
with, from the floor or from the root. Card 64 uses its centre as a refrain in
three sections; that is the ceiling, allowed only when the sentence is the
counsel itself, is under twelve words, and never sits in adjacent panels.
Everywhere else the centre is varied, not repeated: "never yours to command"
becomes "the fire was never yours" becomes "the fire is fed before it is lit."
A card that says its truth the same way four times has one good sentence and
five panels of wallpaper.

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
to unfold. Everything else it owes them is silence: none of its sentences and
none of its content may be theirs.

ICHING owes CODE the scene's origin, and owes KEYS a hand-off in its last
paragraph, the way card 33 does it ("a deeper layer hears another word inside
the withdrawal: forgetting"). It owes the caster six lines that each stand
alone beside the essence.

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
two cards nearest it.

---

## 5. The reading

The reading is the card's front door, and the whole card for anyone who reads
nothing else. It is written last, from the centre, after the five teaching
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
and a gifted face, it passes.

**Shape.** Three paragraphs, 130 to 180 words, one voice, to you.

The first names the energy of this cycle as it is when in balance: what it is,
what it feels like from the inside. It is the essence, shown alone in search
and after a cast, so it must be the whole energy by itself. Always lit, even on
the dark codes. It may hold one glimpse of the scene, one piece and never the
list, and only when that piece carries the energy alone.

The second names the pull, the challenge this cycle brings, as one plain
picture from ordinary life, and answers it in the same breath. The stance
stays balanced throughout.

The third is the guidance, ending up. The centre sentence lives here. End
plain and a beat early, but end up.

**Provenance.** Not one sentence and not one piece of content comes from the
five sections behind it. It is written from the centre and the sheet. A reading
whose sourcing list names a file from every tradition was written from the
traditions, and the list is the tell.

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

## 6. Card name and keywords

The card name is two to four words, a third thing, a concrete picture, no
system's vocabulary. The names exist for all 64 and are not revisited here.

Keywords are five to seven, one to three words each, written last because they
distil the finished card. No quota per tradition; one test only, does it hold
the energy. The stranger test stands: a stranger with no framework must get it
cold in under a second. Four automatic fails: a word not used in ordinary
speech; a keyword that only makes sense after reading the card; a keyword that
names the shadow rather than the energy; an instruction rather than a naming.

The keywords are shown as labels before any prose, so no section opens by
saying one of them.

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
  repeat.
- Reading, 180 to 260 words, to you: the situation as a person lives it, what
  it asks, the body once, the posture. Never the picture again in the
  Combination's words. Never "lines," "trigram," or "hexagram" as parts.
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

**The movement is the section.** The Shadow paragraph carries the seed and the
first turn (what it is like to feel it instead of pushing it down). The Gift
carries the standing-with and the giving. The Siddhi carries the letting go of
ownership and the force moving through. The reader should feel one thing
rising through three heights, not three descriptions.

**Subsections and lengths.** Shadow, 150 to 200 words. Repressive nature and
Reactive nature, 35 to 55 each. Gift, 150 to 200. Siddhi, 110 to 160, present
tense, spacious. Shorter than the pilot's 600; the older cards packed the
chapter in.

**Voice.** The ten rules. One picture per paragraph, carried across the three
heights at three temperatures; never a new picture per paragraph. Complete
sentences. No "not X but Y" beyond the card's one hinge. The Siddhi does not
end by looking back at the Shadow as raw material, and does not close on a
paradox of effortless arrival.

**Retired here.** "The inward face of the Shadow," "the outward face of the
Shadow" (36 cards). "Most people treat this as a fault." The look-back closer.
The stock paradox.

**The body in this section.** When the source locates the work in the body,
say so once as where the work goes, never as a seat. The seat is Human
Design's.

**Names.** The Shadow, Gift and Siddhi names are kept lineage, shown as labels.
The repressive and reactive names come from the reference row in the vault,
never inferred; the rows are full for all 64 now.

---

## 9. Human Design

The code as a pressure in the body: a gate, the centre it sits in, the channel
it forms. This chapter is mostly new; the older guides denied the section
existed.

**Subsections and lengths.** The drive, 120 to 200 words: what this code is as
a felt pressure, from experience, never opening "Gate N is the Gate of."
Where it lives, 120 to 200: the centre as a felt region and function, and why
the placement is the teaching. What completes it, 120 to 200: the channel it
forms with its partner gate, as internal relating. The partner gate is named
here; the partner card as a card belongs to RELATIONS.

**The bridge rule.** Gate, centre and channel names live in the headings (the
parser reads the name off the heading's tail) and as labels. In the prose,
open from the body and the situation; the mechanics stay quiet.

**What this section owns.** The misnaming beat: what a person carrying this
drive gets called. Without the retired stem.

**What it does not name.** No organ, gland or chemical in the centre paragraph;
that is BODY's. The centre paragraph answers the question the scene raised
(where is this felt, what does it press you to do) rather than describing the
centre in general.

**Retired here.** "The misread is to call this" (40 cards). "The whole teaching"
(27). The Alone-then-Joined turn closing the channel paragraph (52): "alone,
this code is X; joined, it becomes Y."

---

## 10. Body

The literal floor the other systems were describing. Spoken as a layer of the
oracle, never as a biology explainer. The deepest inward point of the card,
written after KEYS, having read it.

**Subsections and lengths.** Physiology, 150 to 250 words: the organ or gland
this code is seated in and what it is doing while the energy is felt. Amino
acid, 120 to 200: the one amino acid, one real fact about it, and what it
means that the code runs this deep.

**Boundary.** Tissue and mechanism, never the centre. BODY names the organ;
DESIGN names the region.

**The shape is optional now.** The three beats (organ, "the shadow has its
bodily floor here," the climb out) and the two beats (fact, "there is a
teaching in that") are retired as required shapes; a section that runs
organ-then-floor-then-climb on all 64 cards is a formula with fresh words.

**The ring rule.** Ring siblings share the amino acid (glycine on 6, 40, 47,
64), so the amino paragraph is written per card from the card's own scene, and
the shared fact is stated in one clause. Run the one-minute test against the
sibling before anything else.

**Retired here.** "Bodily floor" (32 cards). "There is a teaching in that" (39).
"The code runs all the way down to this" (45). "Deeper than the organ."

---

## 11. Relations

The doorway out. Outward relating only: the code does not stand alone, here is
the family it belongs to and what it forms with its kin. The true final section.

**Subsections.** Pair (the King Wen sequence pair, the hexagram the frontmatter
lists as `pair`; the line-negated opposite is a different fact and the
Programming partner paragraph may name it), Inverse (the hexagram turned
over; a separate subsection only when it differs from the pair, one merged
subsection when they are the same hexagram, and a self-inverse heading for the
eight cards that meet their own reflection), Programming partner (the Gene Keys
polar partner), Codon ring (the family and siblings), Tarot (the ring's arcana
and the two trigram arcana; the lead sentence is the card's one callback slot
for the scene), Immortals, Deeper correlation (sky and Hebrew letter). Each 50
to 130 words; Tarot longer because it holds three parts. The trigram tarot
stays under Tarot and sky and letter stay under Deeper correlation; that is
how all 64 cards already have it, and the older guide's other placement is
retired.

**Teach the bond, hide the machinery.** Name the kin card by its name, and say
what the bond means. Never "codon," "amino acid," a ring index, "defined" or
"undefined," or any mechanic in the prose. Nothing the reader must decode.

**Lineages may be named here.** This is the teaching layer and the one place
on the card where a tradition can be called by its name ("the Gene Keys pair
this code with"), with respect and without a book title. The flat "never name
a source" rule in the old master guide was stricter than the concept intended;
the two-tier rule wins. The other five sections never name a tradition.

**Reference entries repeat.** The trigram definitions, the Immortals' name
sentences, the ring labels describe the same thing wherever they appear. Do not
diversify them. But the Immortals subsection opening "[Name] stands above" on
52 of 64 cards is a chosen sentence, not a reference, and is retired.

**One card, three bonds.** When the pair, the inverse and the partner are the
same card (64 with 63), say so once and write the bond once, the way card 64
does it; three subsections that say the same thing are wallpaper.

**When the source is empty.** Trigram meaning, Immortal lore and the tarot
cross-mapping have no file in the vault; every card that wrote them imported
lore from outside and said so in its sheet. Until those files are authored
(section 13), that is the practice: write from established lore, keep it to
what is commonly agreed, and record "established lore, not vault-sourced" in
the sheet.

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

**The sheet.** Every card records, in frontmatter under `meta:`, one entry per
section naming the vault files its sentences trace to, the centre sentence, the
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
5. There is one centre sentence per card, distilled after the sections are
   written, ratified by Adrian, living in CODE's third paragraph. The two
   truths were always one.
6. ICHING Reading: 200 to 300 words.
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

**The order of passes on a card.** The AI layer first, in this order:

1. Read the sheet if one exists, and every source file the card may draw on.
2. ICHING, from the six translations and the Eranos philology: the scene
   whole.
3. KEYS, from the chapter, the essay and the reference row: the scene at
   three heats.
4. DESIGN, from the gate essay, the articles and the centre chapter: where the
   scene presses.
5. BODY, having read KEYS: what the tissue is doing.
6. RELATIONS, from the facts and the established lore: the field.
7. Distil the centre from the five. Record it, the scene and the mechanism on
   the sheet.
8. The reading, from the centre, with no sentence from the five.
9. Keywords, from the finished card.
10. The one-minute test on every section against the ring sibling and the
    channel partner; the lens check on the reading; the measurement script
    across the deck.
11. The sheet: sources per section, complete.

Then the human layer: Adrian reads the card on the live page, not in Markdown,
ratifies or strikes the centre, and makes the card his. That pass is the one
that takes a section to final, and it is the point of everything above. The
AI layer's job is to make that pass short.

**Batches.** Never all 64 blind in one day; that was the failure of June. Pilot
on five (3, one bright, one dark, one body-led, one of Adrian's choosing), read
them on the live page, and lock or iterate before the rest.

**Re-measure after every pass.** `node todo/plans/writing-guideline/measure.mjs`
from the repo root reports word counts, shared openings and cross-references.
A pass that changed the deck and did not run it is not done.
