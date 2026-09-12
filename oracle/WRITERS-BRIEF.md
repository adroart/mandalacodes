# The writer's brief

The rules of `oracle/GUIDELINE.md` with the history and reasoning left out,
for the agent that writes one card. Read this, then `oracle/cards/03.md` (the
worked reference, every section read by Adrian on the page), then the card's
packet at `oracle/_packets/NN.md`. The guideline stays on disk; open one of
its chapters when a rule here is not enough. When this brief and the
guideline disagree, the guideline wins and the disagreement is reported.

Kept in step with the guideline by hand. Last synced 2026-09-12.

---

## 1. What you are writing

One card is one energy, one of sixty-four, spoken in six voices: the I Ching
as a situation, the Gene Keys as an arc from low to high, Human Design as a
place in the body where it presses, the body's own chemistry as the floor,
the deck's field of kin as the doorway out, and, first of all, the deck
itself speaking the energy plainly with no tradition named. The reader
should finish feeling they met one energy whole, not that they toured five
reference books.

The file is `oracle/cards/NN.md`: frontmatter, then `## CODE`, `## ICHING`,
`## KEYS`, `## DESIGN`, `## BODY`, `## RELATIONS`, each with the `###`
subsections the card already carries, in that order. Keep every heading
exactly, including the em dash delimiter and the tail after it. Structure
the parser consumes and you keep: the `_Keywords:_` line, the Judgement and
Image bullets, the `**Line N** · _image:_ ... → becomes Hexagram X, Name.`
markers with their targets, the `_Shadow:_ · _Gift:_ · _Siddhi:_` line, the
one-line underscore intro under RELATIONS, the `- **Label — Value:**` bullets
under Tarot and Deeper correlation. Everything else is plain paragraphs: no
bold, no italics, no lists, no quotes, never the em dash character.

Two words used precisely. The scene is the I Ching's picture in words (the
mare on the ground, the fox at the ford); it belongs to the tradition. The
image is Adrian's artwork, and nothing in the prose is called an image.

What the page already shows, so the prose never repeats it: the card name,
the hexagram name and glyph, the keynotes, the gate number, the three Gene
Keys names, the organ and the amino acid, each as a label. Each panel has a
one-line frame under its name and a popup that explains its system once.
The essence (three sentences from `meta.centre`) sits under the keynotes.
CODE's first paragraph is shown alone in search and after a throw of the
coins; every moving line is shown alone beside it.

Write in this order: ICHING, KEYS, DESIGN, BODY, RELATIONS, then distil the
essence, then CODE, then the keynotes. Assimilate first, distil after: read
the whole packet before writing a word; note where the sources converge and
where they fork; write each section faithful to what they say and to nothing
they do not; then write it as its own thing with no sentence lifted.

## 2. The voice

One person speaking to one person about something real, in plain words.

Every section speaks to you. Not "a person," not "one," not "the reader,"
not "this code" as the subject of a feeling. The card does not talk about
itself: no "this card," "this reading," "the deck," "the oracle," no "you
have drawn." Inside I Ching the thing is a hexagram, inside Human Design a
gate, everywhere else the code, and "code" appears only when the card names
its own kind.

Written for someone who knows nothing. No system word in prose: no
"hexagram" except in I Ching's own heading terms, no "lines," "trigram,"
"gate," "centre," "shadow" as terms of art, no "the six lines show." If a
sentence needs the system to be understood, rewrite it so it does not.

Never say where it came from. No "the tradition says," "the old text," "the
translators," "the teaching gives," no book, no teacher, no source named.
Give the picture, the counsel, the fact as your own to give.

One sentence, one concept, and every sentence complete with its connecting
words in. Two claims may share a sentence only when the second is the
first's consequence, joined by "and" or "so" ("Nothing is yours to keep, so
nothing can be taken"). Cover the second half: if the first stands whole and
the second follows from it, keep them together; if the second brings a new
thing or a new picture, it is the next sentence. Translate the classical
compression into whole thoughts; never chop. A paragraph of ten four-word
sentences is chopping, not writing: fewer ideas per sentence, not more full
stops. Three to five whole thoughts per paragraph.

The plain thing first, then one picture, then let the next sentence explain
the picture. Never a metaphor explained by a second metaphor illustrated by
a list. Every sentence follows from the one before. A picture reused from an
earlier paragraph is named again, never pointed at with "it."

Describe the state, to you, and let the reader recognise it. An illuminating
instance (a horse saddled and standing still, a tower of iron in a city) is
wanted. A scenario that assigns the reader a life ("you started a family,"
"for years nothing in there has changed") is a biography and is cut. No
"anyone who has," "this hour," "this stretch," "this season" as filler, "we
all know." No "this week," "today," no event: the card is about the energy
of a cycle of change, and the reader supplies the moment.

The energy, not the problem. Name the pull the cycle brings and answer it in
the same breath. The reading never narrates the reader failing.

At most one adjective on a noun, and only when the noun cannot stand alone.
No adjective triads. The weighted words (light, soul, fire, presence, sacred,
holy, divine, awakening, transformation) at most once or twice per card.

"Not X. It is Y" once per card, at the one hinge where the correction is the
point. Everywhere else say the true thing without first saying the false one.

Reads as human: no balanced pairs, tidy triads or even paragraphs; no
summary sentence; end a beat early. In every subsection one sentence runs
long (over twenty words) and one lands short (under seven), not in the same
place each time. One paragraph per subsection may end on a punch; the
others end flat, mid-thought, or on the open part. A sentence that could
close a hundred paragraphs unchanged is not this paragraph's.

Retired closers, all of them families not spellings: "The maker gets made."
"It takes most of a life." "What this asks is small." "So the work is to."
"Both are true at once, which is how you know." "There is no technique for
arriving." "The code runs all the way down to this." "There is a teaching in
that." "That placement is the teaching." "Together they teach that." "The
misread is to call this X." "People will call this." A paragraph that ends
by stepping back to say what it meant loses its last sentence.

**The exceptions, all of them.** Human Design may name and explain its gate,
centre, channel and defined or open states in plain language; it must not
infer the reader's chart or tell them how to decide. Relations may name
lineages, never book titles. I Ching may say "the traditional character
draws" on the nine cards where the character is a true picture (3, 18, 27,
42, 47, 48, 49, 50, 56). The two Gene Keys natures describe another person.
The Judgement and Image lines speak as the classical text. A deliberate
fragment is allowed when it improves the spoken rhythm, and it is rare. The
Shadow, the natures and the moving lines describe mishandling as
recognition, never as a verdict. A fact true on two cards may be stated on
both, in different sentences.

**The measured gate**, per section: under 15 words a sentence, under three
commas per hundred words, no sentence with three or more commas. Run
`node todo/plans/writing-guideline/punctuation.mjs oracle/cards/NN.md` from
the repo root and fix what fails before anything else.

## 3. How one energy crosses six sections

Six questions, one each. The reading: what is this energy, and how do I
stand in it? I Ching: what is the situation, and what does it counsel? Gene
Keys: what does this energy become, at its lowest and its highest? Human
Design: where does it press in me, and what does it drive me to do? Body:
what is my body doing while I feel this? Relations: who else carries this,
and what does it become when it meets its kin? A sentence that answers an
earlier panel's question is cut. Each panel reveals something deeper; none
retells.

The scene governs; ICHING shows it. Choose the scene the most translations
share and the one the energy needs; record it in `meta.scene` with what was
set aside; do not bend the other sections to support it. Restate belongs to
ICHING alone. CODE may hold one glimpse of it in plain clothes (the ground,
the fire, one piece and never the list, and only when that piece carries the
energy alone). The moving lines and KEYS vary it: the lines six times, KEYS
by altitude, the same fire as coals, as flame, as a thing entirely itself.
DESIGN and BODY answer a question the scene raised. RELATIONS calls it back
once, in the Tarot lead sentence; the Pair may glance at it when the pair is
the scene's other half. Forbidden: a section opening its own picture from
nothing; a section teaching a fact another section teaches; any sentence in
CODE that also stands in another section; the same interpretive sentence on
two cards.

The mechanism: name in `meta.mechanism` how the card holds together. A
picture at different heats (image-at-heats, and the picture), a verb carried
through every system (verb), a word that names the situation in every
tradition (word), or a refrain of the counsel (refrain).

What the sections owe each other. CODE shares the sections' central meaning,
because it is distilled from them, and none of their explanations,
distinctive sentences or detailed counsel. ICHING may hand to KEYS in its
last paragraph by naming the shadow's word inside the situation; cut it if
it reads as a preview. KEYS leaves the body unlocated; when the source
places the work in the body, say so once as where the work goes, never as a
seat. DESIGN names the region and the pressure, never the organ, gland or
chemical. BODY names the organ and what it does, never the centre. When
they coincide (throat and thyroid), DESIGN keeps the sensation and BODY the
mechanism. DESIGN owns the misnaming by others (what a person with this
drive gets called); KEYS owns the mishandling by self (what you do with your
own low season); CODE may carry one of them as the low face in its second
paragraph, never both listed.

The one-minute test, per subsection. Take its first and last sentence and
strike the card's name, the hexagram's, the gate's, the three Gene Keys
names, the organ and the amino acid. Put what is left under the ring
sibling's name, then the channel partner's (their first and last sentences
are in the packet). If either sentence is still true there, the subsection
is not this card's yet. The test is of interpretation: a shared fact does
not fail for staying true; move to the next sentence that interprets.

The formula test, per subsection opening. Would its first five words open
the same subsection on another card unchanged? Then they are a formula
whatever follows. Card 3's openings are off limits. Required content is not
required order: each chapter below says what a subsection must contain, and
except Body's two paragraphs, the order inside is this card's own.

## 4. I Ching

The section that carries the scene whole. The Reading is the wisdom:
nothing explains the system, names a source, or refers to the figure's
parts. Every element (the trigrams, the character, the Judgement, the lines)
earns its place by giving the reader something to feel, recognise or do; a
diagram alone ("a firm line struck under two open ones") is cut and the same
thing as a person knows it is kept. Classical phrases become complete modern
sentences that say the same thing ("What this asks of you is simple," not
"the counsel is plain").

- Combination, 40 to 70 words: the picture the two forces make together. No
  "you," no counsel, nothing described as the reader's situation. On the nine
  true-picture cards it may close with "The traditional character draws X";
  nowhere else is the character mentioned, and never "the old character" or
  "the name means."
- Upper and lower trigram, 70 to 110 words each: the force as itself, in the
  world, in a person, and its risk, in whatever order. Nothing about this
  card's situation. These are reference entries; the same trigram reads alike
  on every card that carries it.
- Reading, 180 to 260 words, to you: the situation as a person lives it,
  what it asks, the body once, the posture. Never the Combination's picture
  in its words. Never "lines," "trigram," "hexagram" as parts. The body, once,
  near the end, with its reason turned toward the reader: Heaven the head,
  Earth the belly, Thunder the foot, Wind the thigh, Water the ear, Fire the
  eye, Mountain the hand, Lake the mouth. Say "these two forces each have a
  place in the body," never "the tradition gives." No organs here.
- The symbol, optional, only on a card whose line shape teaches something:
  two short paragraphs on this hexagram's lines, for the popup.
- Judgement and Image, as bullet lines, rendered fresh from all six
  translations and the philology: map where they converge and fork, form the
  sense, draft last, check back. The Image's second line opens on its hinge
  word (So, Thus). These two speak as the classical text.
- Moving lines, six, 50 to 70 words each, read alone after a throw: the
  scene of that line as a person lives it, what it asks, and the counsel in
  its last sentence, with the hexagram it becomes named plainly. The
  `_image:_` marker is the scene in one plain clause that makes sense alone.
  Keep every element of the scene the translations agree on that a stranger
  can use; translate the compressed verdict into what it asks of a person;
  cut what a stranger cannot use and record the cut on the sheet. Check each
  line back: every kept element findable in the rewrite, nothing there the
  sources do not carry. The lines never re-teach the whole hexagram, and no
  line depends on another ("the same horse" fails alone). Inside this
  section the thing is a hexagram, never a code.

## 5. Gene Keys

One energy at three heights and the movement between them. The guidance,
never stated: the Shadow is a seed under the earth that moves only when it
is learned from; the Gift is the plant, you stop fighting the energy, stand
with it, and it gives; the Siddhi is the flower, no longer held as yours, a
force moving through you. The words seed, plant, flower do not appear.

Shadow, Gift and Siddhi are labels; the prose never uses them as terms of
art ("at its lowest," "when it is met," "at its height" do the work). No
"the 64th Gene Key," no coined phrases. Describe the energy, never diagnose
the reader: "Numbness is," not "you are numb."

Each height stands on its own and opens on what is present, never on an
absence and never as the exit from the height below ("when you stop
fighting the fear" is retired as an opener). Then, in its second paragraph,
each height names the state below it as its fuel: the Gift grows out of the
very fear under the Shadow; the Siddhi is what the Gift becomes when even
the maker lets go. The Shadow carries the seed and the first turn (feeling
it instead of pushing it down). One picture across the three heights at
three temperatures, never a new picture per paragraph. Find the thread word
the Shadow's last paragraph and the Siddhi's share in the chapter (love on
key 3) and use it once at each height in its plainest form. Earn the label:
cover it and read; if a stranger would guess a neighbour (Fear for Chaos),
the paragraph described the neighbour.

Before writing, answer five questions per height from the chapter and the
essay: what it is; what it does; what it asks you to do; what it feels like;
what it is not. The last two are where the losses hide.

Lengths: Shadow 150 to 200; Repressive nature and Reactive nature 35 to 55
each, each a whole person in three sentences, one who goes still and one
who lashes out, never a verdict, and their names from the reference row's
frontmatter (`repressed:`, `reactive:`), never inferred; Gift 150 to 200;
Siddhi 110 to 160, present tense, spacious. The Siddhi does not end by
looking back at the Shadow and does not close on a paradox of effortless
arrival. Retired: "the inward face of the Shadow," "the outward face of the
Shadow," "Most people treat this as a fault."

## 6. Human Design

Where does this energy press in me, and what does it drive me to do. The
frame is borrowed wiring: a gate is about always, a reading is about now,
and everyone meets every gate's theme through the people near them and the
turning of the year. So describe this energy from inside a body that carries
it and what such people have had to learn: where it sits, what it drives,
what it needs to run, what starves it.

It is a lens, not the energy. Every subsection opens from the energy as this
lens sees it ("Through this lens, the energy of ..."; "Seen through this
lens, ..."), never from the system, never "this card" or "with this card
drawn." Gate, centre and channel are named once each and explained in body
terms the first time. Both kinds of sentence are needed: the mechanic
("Gate 3 sits in the Sacral") and the same fact as the reader lives it
("something in you is trying to begin, and this is the place it begins
from"). Never claim the chart: never say the reader has this gate, lacks the
partner, or has the centre defined or open; say what each case is like ("if
your Sacral is defined, as it is in seven people in ten; if it is open").
Types, strategy, authority and profile are never taught, and the section
never tells the reader how to make decisions.

- The drive, 150 to 200 words: what the energy is as this lens sees it and
  what it is for, the gift first; what it does in you; the name it gets
  called from outside and what is really happening, briefly. Ends on
  recognition, never instruction. Never "Gate N is the Gate of."
- Where it lives, 180 to 240 words: where the energy runs (the centre named
  and located), what that place does, what it is like defined and open, what
  this energy needs to run there and what starves it, how it moves (steady,
  pulsed). The operating conditions are spent here once. No organs or glands.
- What completes it, 70 to 100 words: what this pressure needs from outside
  itself, the partner gate named once with what it is called, what the two
  make together, and that the other half may sit in you or in someone near
  you. Short: the partner's card is linked on the page and a your-chart line
  sits beneath. Where a gate sits in more than one channel, write the one
  the frontmatter names and say "one of the wirings." No Alone-then-Joined
  turn ("On its own ... Joined they make").

Five questions first, from the gate file, the channel file, the centre file
and the principles: what this energy is through this lens; what it does in a
person; what it presses you to do; what it feels like from inside; what it
is not.

## 7. Body

What is my body doing while I feel this. One organ and one amino acid, from
the frontmatter, and what each is doing. Body is the floor: a fact the
reader can check outside the card, true whether or not any system is.
Written after KEYS and DESIGN, having read both. Never a biology explainer,
never a healer. The prose never explains where the assignments came from and
never names a codon, a ring, a chart, a centre or a system.

Each subsection is two paragraphs, the one required shape on the card: the
entry with the thing, then the mechanism the reader can check. Not one
block, not four. The entry opens through the lens, as card 3 does ("Seen
through the body, the energy of beginning sits at the navel ..."); the lens
is named, so that placing is the lens's, and it is the only place a location
is given. Never a bare seat claim ("this code is seated in").

- Physiology, 120 to 180 words: the organ or gland, what it is in plain
  words, what it is doing while this energy is felt, told as something
  happening in you now that you could notice inside a minute. Open on the
  thing itself, never the region; the region is Design's.
- Amino acid, 100 to 150 words: what it is (made by the body or eaten), what
  it builds or signals, where it comes from, and one fact relevant to this
  card that is not the obvious lead on its ring siblings. Facts a reader
  could take into a kitchen, never advice. Ring siblings share the amino
  acid, so the shared facts take one clause at most, and the paragraph is
  written from this card's scene. When the scene and the fact rhyme on their
  own, one sentence lets them; otherwise end on the fact.

Only what you can stand behind: every physiological claim at its own scope
("the strongest signal a cell gets" needs a source that says so). Soften or
cut what you cannot support; nothing asserts that the energy causes a
physiological change. Until the organ and amino acid reference entries
exist, record "established lore, not vault-sourced" in `meta.lore`. Never:
supplements, illness, healing; "the old maps," "the old teaching"; claiming
the amino acid is the card's chemistry or that eating it serves the card;
"bodily floor," "the letter this code is written in," "deeper than the
organ," "the climb out is also bodily." Under 330 words for the section.

## 8. Relations

Who else carries this, and what does it become when it meets its kin. Read
one kin at a time on the page, so each paragraph stands alone: it names the
kin by card name and places it in plain words in the same sentence ("Veils
of Knowledge, the not-knowing that has moved into the head"), says what the
two energies make together, and says why you would open that card next. No
paragraph refers to another ("these five," "read together"), no sentence
totals the section. The one-line underscore intro under the heading is
required: one sentence, to you, what this card's kin have in common, no
"this card," no totalling closer. Lineages may be named here without book
titles. Never the mechanics: no codon, amino acid, ring index, gate number,
defined or undefined, upright or reversed. Never the reader's chart.

- Pair, 50 to 90 words: the same energy a season on. Inverse only when it
  differs from the pair; a self-inverse card keeps its own heading.
- Programming partner, 50 to 90: the opposite pole, the two low faces
  feeding each other, why open it.
- Codon ring, 50 to 90: the family, what the members share, where this card
  sits, siblings by plain theme.
- Tarot: one lead sentence as the card's single scene callback, then the
  ring arcana bullet at 30 to 50 words and each trigram bullet at 25 to 45.
  Retired: the arcana inventory paragraph before the bullets, "X also
  carries Y," "the ring gives one Major."
- Immortals, 40 to 70, to you, from commonly agreed lore. Retired: "Keep
  this crossing" as opener, "[Name] stands above."
- Deeper correlation, two bullets of 20 to 35.

Under 650 words for the section. Never re-teach the scene, the arc, the
drive or the organ; never describe the kin card in full (one sentence
places it, the panel links it); never stack teaching on a correspondence two
hops away. Reference material (trigram definitions, the Immortals' placing
sentences, the ring's shared theme) may recur across cards. Facts (kin names
and numbers, ring, arcana, Immortals, sky, letter) come from
`relations_data` and are never inferred.

## 9. The essence

Three short sentences in `meta.centre`: the first names the energy, the
second its challenge, the third its way. Each whole; three that read as one
run-on have failed. Card 3's: "A beginning is real long before it is
settled. You are full of what is coming, with nothing to show. It needs
room more than it needs a plan." Found after the five sections are written,
not decided in advance: if it is right, the situation, the body, the arc and
the field click around it without any being bent. A name, a recognition, a
way; never counsel dressed as description. It is shown once on the page and
never repeated verbatim anywhere on the card.

## 10. The reading (CODE)

The front door, and the whole card for anyone who reads nothing else.
Written last, from the essence and the sheet. It names the energy of this
cycle of change and shows how to stand in it well. Every sentence makes
sense to a stranger with nothing else on the page; a sentence that leans on
a picture not yet given ("the horse will not go") fails.

Three paragraphs, 130 to 180 words. The first names the energy in balance,
what it is and what it feels like from inside, always lit, even on the dark
codes; it is shown alone in search and after a throw, so it must be the
whole energy by itself; it is not the essence and does not restate it. The
second names the pull this cycle brings as one plain picture from ordinary
life and answers it in the same breath ("The challenge here is the pull to
hurry," never "you explain the thing before it can explain itself"). The
third is the guidance, carrying the essence's way in other words, ending
plain, a beat early, and up.

Nothing the sections say later is said here first: the sacral yes belongs
to Human Design, the gripping to the Gene Keys, the judgement's counsel to
the I Ching. Clarity over completeness: one clear picture at most, never
the scene's inventory, never true to every tradition at once. Read it and
ask what it is mainly about: a problem the reader has fails; a live energy
with a difficult face and a gifted face passes. A reader who knows only the
I Ching should recognise this energy as this hexagram with no hexagram
furniture in the text, and the same for the other traditions.

## 11. Keynotes

Five to seven, one to four words each, on the `_Keywords:_` line, written
last from the finished card in the card's own words where it has them ("Root
Before Shoot," "Small Rough Moves"). Most name the energy; one or two name
the pull ("Not Yet Settled," "The Pull to Hurry"); none names the shadow as
a verdict. Four automatic fails: a word not used in ordinary speech; a
keynote that only makes sense after reading the card; a keynote naming the
shadow; an instruction. A keynote that could sit on twenty cards ("Right
Timing") is cut. Read the set aloud: one energy from seven sides, not a
list of nouns.

## 12. The two-minute check, per paragraph, after writing

1. Every "Not X. It is Y": was the reader assuming X? If not, keep Y alone.
   One hinge per card.
2. Every list of three: does the third add what the first two did not? If
   not, cut to two.
3. The last sentence: could its shape be predicted (a summary, a moral,
   "which is how you know")? Cut it and end a beat early.
4. Weighted words (profound, journey, embrace, navigate, essence,
   transformative, sacred, divine, awakening, tapestry, resonate): would you
   say it across a table? If not, the plain word.
5. Any sentence announcing significance ("there is a teaching in that,"
   "this is where"): delete it; keep only what still stands.
6. Three consecutive sentences within five words of each other: read them
   aloud; if the ear hears the beat, cut one hard or let one run.
7. Every colon setup and "what makes this X is" opener: delete the runway;
   was meaning lost?
8. Three inanimate subjects doing human verbs in a row (the code asks, the
   ring teaches): put you back in one.
9. The first five words: would they open this subsection on another card?
   Then they are a formula.
10. First and last sentence, names struck: still true on the ring sibling or
    the channel partner? Not this card's yet.
11. Read it aloud. If it sounds like a memo, say the worst sentence to
    someone in your own words, then tighten the grammar.
12. Split every sentence at its commas: does each half carry its own idea?
    Then two sentences. More than one adjective on a noun is a fail.
13. The section's ending: does it resolve its own tension in one tidy
    sentence? If a real conversation would end on the open part, end there.

Then the punctuation script per section, then from the repo root
`node todo/plans/writing-guideline/measure.mjs`, and confirm this card's
openings appear in no shared-opening group of three or more in
`todo/plans/writing-guideline/measure-output.json`.

## 13. The sheet

Under `meta:` in the frontmatter: `centre` (the essence), `scene` (with
what was set aside), `mechanism`, `sources` with one entry per section
(code, iching, keys, design, body, relations) listing the packet filenames
each section's sentences trace to, and `lore` naming anything written from
established lore rather than a file. Keep any existing `sourcing_note` or
`fact_check` as history; delete a trailing HTML comment block after the
prose (its content is now `meta.sources`). Leave every `status:` value as
`scaffold`; final is Adrian's decision on the page. Do not run builds,
regenerate data, touch another card, or commit.

## 14. The final message

Short: the essence; the scene and what was set aside; the mechanism; the
keynotes; the punctuation numbers per section; which sources each section
drew on most; anything in the sources that contradicted the frontmatter
(report, never change a structural fact); and the two or three places you
were least sure the writing is this card's own, or a rule could not be
applied as written, with the rule's chapter number.
