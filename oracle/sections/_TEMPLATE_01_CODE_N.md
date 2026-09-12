> **Superseded 2026-09-12.** The one writing guideline is [GUIDELINE.md](../GUIDELINE.md); where this file disagrees with it, the guideline wins. Kept for history.

# TEMPLATE — Section 1 · Code N (the opening face)

> **⚠ SUPERSESSION NOTICE (2026-07-06): §4.3 (`code.reading`) is superseded by
> `../../todo/plans/reading-rewrite.md`.** The three-movement shape (lit face →
> other face → the ask), the "end on the ask, a beat early" rule, the checklist
> line enforcing it, AND all three worked reading samples in §4.3 model the
> arc that produced 64 downer readings. Do not write or imitate a reading from
> this file. The reading now follows the four-questions synthesis (I Ching =
> situation, HD = body, GK = arc, Tarot = face) and ends risen. §4.1
> (card_name), §4.2 (keywords), §4.4 (invocation), and the voice/cut rules in
> §1–§2 still hold.

> Draft for Adrian's review. Not yet locked. This is the first of six section
> templates that will replace the older `00`–`06` guide set and the thin
> per-section `_BRIEF.md` files. Sign-off here sets the shape for the other
> five.
>
> Status: **DRAFT v1** — for review and rewrite together.
> Card 1 reference name used throughout: **Code 1, Earth's Breath.**
> (Workspace-wide rename from "UL N" → "Code N" is a separate follow-up.)

---

## 0. What this section is

The card's **home page**. The complete-on-its-own front door. A reader who
only ever reads Code N has had a real reading: the force has been named, both
its faces have been touched, and the reader has been told what the code asks
of them now.

No system is named here. No structure is explained. This section carries the
spine of the code as a reading for *now* — oracle, not anatomy. The teaching
chapters (ICHING, KEYS, DESIGN, BODY, RELATIONS) come after.

Four fields in the JSON, in this order:

1. `code.card_name` — the poetic title (2–4 words)
2. `code.keywords` — 5–7 brief words (no system jargon)
3. `code.reading` — the opening oracle reading (2–3 clusters, ~200–260 words total)
4. `code.invocation` — the spoken alignment passage (optional; ~5–9 short lines)

Each field gets its own subsection below, with: job, length, do/don't, the
vault sourcing map, the existing locked Code 1 work, and **2–3 alternate
voice variants** so you can pick what lands.

---

## 1. The voice (this section, locked across all 64)

These are the rules every field in this section obeys. They will be repeated
identically at the top of the ICHING, KEYS, DESIGN, BODY, RELATIONS, and
invocation templates — same voice, different teaching.

**Intimate teacher.** Warm, direct, speaks to "you." Names the felt experience.
Accessible without being shallow. The reader hears one person speaking, not a
system reciting.

**The two global "no" rules:**

- **No em dashes anywhere on a card.** Commas, periods, line breaks, parentheses.
  This template uses em dashes freely because it is an internal working
  document. Card prose does not.
- **Must not read as AI.** This is enforced by the four cuts in §2 and the
  vault-anchored writing in §3.

**Spiritual vocabulary — salt and pepper.** Words like *light, soul, fire,
presence, sacred, holy, divine, awakening* are not banned. They are weighted.
A whole card carries **one or two** at most — never sprinkled through every
paragraph. Each one earns its place by being the only word that carries the
meaning. The default reach is for the plain word.

**The keep / cut / never rule for system material:**
- **Keep** — the system *names and architecture*: hexagram names, Shadow /
  Gift / Siddhi name triads, gate names and numbers, Tarot Arcana. These are
  the kept lineage.
- **Cut** — borrowed prose. A teacher's coined phrase ("the genetic wheel of
  samsara," "the single-celled heaven") never appears. Convey the concept in
  your own words.
- **Never** — name a source in card prose. No "Wilhelm writes," no "Rudd's
  Gene Keys," no "the Practical Guide says." The teacher's seeing arrives as
  the card's own seeing.

---

## 2. The four "reads-as-human" cuts (audit every paragraph)

Apply these to every text slot. They are how the writing stops reading as AI.

1. **No symmetry.** Cut balanced pairs, tidy triads, "not just X but Y,"
   paragraphs of even length. Real writing is lopsided. One paragraph long,
   the next two lines. Vary it on purpose.
2. **No summary sentence.** Cut the line that steps back and tells the reader
   what the paragraph meant ("This card is about creativity"). The meaning is
   already in the prose. Trust the reader.
3. **Plain vocabulary by default.** *Profound, journey, embrace, navigate,
   essence, transformative, sacred* are defaults to avoid (the last one
   counts toward the salt-and-pepper budget when used). Reach for the plain
   word. Go elevated only when nothing plain will carry it.
4. **End a beat early.** No neat bow. No resolving flourish. End on a small
   plain clause or an open one, and stop slightly before the reader expects.

**A useful texture, not a tell:** the lopsided, slightly clumsy human rhythm
— a run-on with a doubled *and*, a fragment, a sentence that lands a little
rough. Do not smooth these into elegant defaults. The clumsiness is the
human in it.

---

## 3. The vault is the source — nothing is invented

Every image, every figure, every claim in this section traces to a file in
`~/Documents/Obsidian Vault/oracle/`. If you cannot point at the vault file
the image came from, the image does not go in the card.

This is the anti-invention floor. The deck does not make up mythology, does
not invent body locations, does not assign deities, does not coin
philological readings. It carries what is already in the source and translates
it into the deck's voice.

### Read these vault files before writing Code N

For **any** hexagram NN you are writing, read in this order:

1. **`hexagrams/NN/_hexagram-NN.md`** — the master index. Frontmatter carries:
   hexagram name, upper and lower trigram, codon ring, amino acid, HD gate,
   HD centre, paired hexagram, the six line-change target hexagrams. This is
   the file you re-read whenever you forget a fact.

2. **`hexagrams/NN/oracle-NN-<slug>.md`** — the **Eranos**. Ideogram-by-
   ideogram philology of the Chinese. Every Mandarin word in the Judgement
   and Image is broken into its component characters and root meanings.
   Search for "Fields of meaning" blocks. **This is the richest single source
   for imagery.** Read every line.

3. **`hexagrams/NN/gene-key-NN.md`** — Rudd's full Gene Keys chapter (often
   long, 300–500 lines). The Shadow / Gift / Siddhi names and the dilemma /
   repressed / reactive pattern come from here. Also: the body-location
   claims (organ, amino acid as living chemistry) and any mythological
   figures Rudd ties to the code.

4. **`hexagrams/NN/gene-key-NN-<slug>.md`** — the *short* Gene Keys reference
   sheet. Frontmatter has the official names: `shadow`, `gift`, `siddhi`,
   `dilemma`, `repressed`, `reactive`, `codon_ring`, `tarot`. Cross-check
   against (3) for the official spelling.

5. **`hexagrams/NN/practical-NN-<slug>.md`** — the Practical Guide. Often
   carries the historical custom, the deity, the medicinal use, the
   mythological figure for the hexagram (Houtu the earth goddess, Yu the
   Great, etc.). Carry these when present.

6. **`hexagrams/NN/wilhelm-NN-N-<slug>.md`** — Wilhelm/Baynes. The most
   discursive English rendering. Reference for tone and for the canonical
   English phrasing of the Judgement and Image.

7. **`hexagrams/NN/qw-gate-NN-<slug>.md`** — the Quantum Way / Human Design
   gate file. The HD gate keyword and the body-graph placement.

Code 1 specifically (the worked reference) also has:
- `tarot-14-temperance.md` (the Ring of Fire's Arcana)
- `line-01-1.md` through `line-01-6.md` (the six moving-line readings — these
  belong to the ICHING template, not Code N, but read them so the opening
  reading is grounded in the same dragon imagery the line files carry)

**You may not skim. Read every named file to completion before writing.**

---

## 4. Field-by-field spec

Each field below carries: **job**, **length**, **do/don't**, **what the vault
gives you**, **the existing Code 1 work**, and **2–3 alternate-voice variants**
of how Code 1 might be written, so we can pick the rhythm together.

---

### FIELD 4.1 — `code.card_name`

**Job.** The poetic title. Holds the code as one image. A *third thing* — not
the hexagram name ("The Creative"), not the Gift name ("Freshness") — but
Adrian's own image that the four lineages live inside.

**Length.** 2–4 words.

**Do.** Concrete image. Two words is often best. Obeys §1, §2.
**Don't.** Abstract noun ("Originating Force"), system jargon ("The Creative,"
"Gate of Self-Expression"), or a name that names the *category* rather than
the *image*.

**What the vault gives you.** Nothing directly — the card name is your own.
But the imagery in the Eranos (dragon, sky, sunlight on fields, sprouts
rising) and the Gene Key (the Ring of Fire, freshness, the kindling) are the
imaginative material you pull from.

**Existing locked Code 1 name:**

> **Earth's Breath**

This name was set in the earlier Gene Keys reference (`gene-key-01-earths-breath.md`
already carries it in the filename and frontmatter). It is not invented for
this deck — Rudd named Gene Key 1 "Earth's Breath" in the source. Keeping it
is the right call.

**My read on it.** "Earth's Breath" is doing a quiet thing the Eranos
supports: the ideogram QIAN means *vapors rising from the ground and
sunlight*. Breath rising from the earth, drawn upward by the sun. The name is
already vault-true. Recommend keeping.

**Alternate variants if we ever want to revisit** (not recommendations, just
to show the shape of alternatives):

- *First Fire* — sharper, more elemental. Drops the breath, keeps the rising.
- *The Rising* — single-word, very plain. Carries the dragon's arc.
- *Heaven's Breath* — more direct to the trigram (Heaven doubled). Slightly
  more conventional in spiritual register.

**Recommend:** keep **Earth's Breath**.

---

### FIELD 4.2 — `code.keywords`

**Job.** 5–7 brief words that pinpoint the code at a glance. The synthesis
made visible. No system jargon, no decoder ring needed. The reader sees them
under the artwork and the code lands instantly.

**Length.** 5–7 items. Each item 1–3 words.

**Do.** Each keyword carries the energy of the *whole* code, not one lineage.
The 7 together feel like one mind speaking.
**Don't.** Don't pull from the system vocabularies ("Hexagram," "Siddhi,"
"Gate," "Arcana"). Don't list synonyms ("Beginning, Origination, Genesis" —
three words for one thing). Don't use any of the §2 banned vocabulary.

**What the vault gives you.** The Eranos "Fields of meaning" entries carry
the raw English material — *unceasing, untiring, originating, rising,
spring, growing, harvesting, trial, sprouting, vapors, sunlight*. The Gene
Key adds *freshness, kindling, fire, dance, beauty, melancholy*. The
Practical adds *dragon, ascending, hidden becoming visible*. Pull from these.

**Existing locked Code 1 keywords** (two competing sets exist):

The current `01.json` (used by the live card) carries:
> Creative Force · Origination · Inner Fire · Aliveness · First Movement ·
> Pure Beginning · Unity Through Beauty

The earlier `synthesis/key_1.json` carries:
> Originating Force · Pure Potential · Creative Impulse · Renewal · Genesis ·
> The Tempering

**My read.** The first set has the synonym problem flagged above — *Creative
Force, Origination, First Movement, Pure Beginning* are four words for the
same idea, and *Unity Through Beauty* is the Siddhi sneaking in as a phrase.
The second set is tighter but "Pure Potential" and "Creative Impulse" are
still close, and "The Tempering" pulls the Tarot in by name.

**Alternate variant A — leaner, single-image keywords (recommended for review):**

> Pure Beginning · Inner Fire · The Dragon Rising · Untiring · Freshness ·
> Kindling · Tempering

(7 items. Each is its own image. *Untiring* comes straight from the Eranos
*persist, JIAN*. *Kindling* is from the Gene Key. *Tempering* is the
Ring-of-Fire Tarot resonance compressed to one word. *The Dragon Rising* is
the Eranos / Practical image, carried as-is.)

**Alternate variant B — sparser, more elemental:**

> First Move · The Fire · Rising · Freshness · The Quiet Before · Untiring

(6 items. Drops the dragon. Carries the cycle — fire, rising, the quiet, the
not-tiring. *The Quiet Before* is the low season of the fire, made into a
keyword.)

**Alternate variant C — closest to current, with cuts:**

> Originating Force · Inner Fire · First Movement · Aliveness · Freshness ·
> Tempering

(6 items. Cuts the synonyms from the current set. Folds *Freshness* and
*Tempering* in from the Gene Keys and Tarot lineages.)

**Recommend:** Variant A, or A with one or two swaps. We pick together.

---

### FIELD 4.3 — `code.reading`

**Job.** The opening oracle reading. The most important text in the deck —
the part every reader sees, and many read alone. It must **land the code**:
name what this force is, so a reader who reads only the reading already
knows what they are holding.

It has three movements, written as **2–3 clusters** of flowing prose. A
**full empty line** separates each cluster. The clusters are real movements
of the meaning, not arbitrary breaks.

The three movements:
1. **What the force is** — the lit face. What it feels like awake in a
   person. Named *bare*, no scaffold (no "this is the code of...," no "you
   know this one"). The first sentence is already about *this* code.
2. **The other face** — the shadow side, as a *felt* thing, named as the
   same force. Not as the reader's failure. As the code's other season.
3. **What the code asks** — what the reader is to do with this, now. Often
   small. Often ends a beat early.

**Length.** 200–260 words total, across all clusters.

**Do.** Open on the substance (§1.4 of the old WRITING_METHOD). Recognition
woven through the body ("you carry it already"), never as the opening hook.
Name both faces as the same force. End on the ask, a beat early.
**Don't.** Open with a fixed frame. Write the reading as one block. Name a
system. Explain the hexagram structure or the Shadow/Gift/Siddhi mechanism.
Use oracle throat-clearing ("you have drawn," "the cards reveal," "the
oracle speaks").

**What the vault gives you for Code 1 specifically:**

- **The Eranos** (`oracle-01-energy.md`): QIAN = *unceasing forward
  movement, dynamic, enduring, untiring*. Its second pronunciation GAN
  carries the dark face: *parch, dry up, burn, exhaust*. The ideogram is
  *sprouts or vapors rising from the ground and sunlight, both fecundating
  moisture and scorching drought.* — both faces are in the character itself.
- **The dragon arc**: the dragon sleeps under the earth or at the bottom of
  the waters, emerges in spring, rises to heaven, and at line 6 overreaches.
  This six-position arc is the structural image.
- **The Image text**: *Heaven moves persistently. A jun zi uses originating
  strength not to pause.* The Image is permission to not pause, not a demand
  to grind.
- **Rudd's framing**: the cycle of fire and low. The fire burns, retreats
  into the low, and what emerges next is *fresh*. The low is part of the
  fire, not a failure of it.
- **The Practical**: *Take pause before you proceed on your endeavor. Be
  assured of your course of action before you proceed.* The pause is a part
  of the energy, not a violation of it.

**Existing locked Code 1 sample** (from `WRITING_METHOD.md` §3, three
clusters, the current reference):

> Pure beginning. The force that arrives before the thing it will make. You
> carry it already. It is what wants to start, to make, to put something into
> the world that was not there an hour ago. When it is awake in you, it feels
> like appetite. You begin things. You want to.
>
> *(full empty line)*
>
> It has another face, and most people never learn it is the same force. The
> flat weeks. The mornings when nothing pulls at you, when the days run
> together and you cannot remember the last time you wanted to make anything.
> That is not the fire failing. That is the fire low, and low is one of its
> two seasons.
>
> *(full empty line)*
>
> What this asks of you is small, and it takes a long life to learn. You
> carry the fire. You do not make it. It rises on its own schedule and sinks
> on its own schedule, and the work is to stop arguing with which one is
> happening. When it is low, let it be low. The numb stretch is the fire
> gathering, and it cannot be hurried. When it climbs, go with it before you
> feel ready. Ready is not a thing it waits for. Let it move through you, let
> it do what it came to do, and let it go when it goes.

**My read on the current sample.** It is doing the structural work well —
three real movements, breaks on the real turns, bare opening, both faces as
the same force, ends on the ask a beat early. Word count is ~250, inside the
range.

**What it draws from the vault.** *Fire / low / season* — fully present in
Rudd. *The force you carry but do not make* — present in Rudd and the
Practical ("Harnessing the qi of Heaven"). The *appetite* image is Adrian's
own translation of *unceasing forward movement*.

**What it leaves on the table** (the vault material *not* yet used):
- The **dragon** (Eranos, Practical, every translation). The current reading
  has no dragon. That is a real omission — the dragon is the I-Ching's own
  image for this force, and it would let the reading rest on a single
  concrete image instead of the abstract "fire."
- The **rising from the deep / sleeping under the water** image, which is
  the dragon's first position and is exactly the "low season" the reading
  describes.
- The **ideogram doubling** — sprouts rising AND scorching drought, both in
  one character. The current reading describes the two faces; the vault has
  a single image (the character QIAN/GAN) that holds both. We could carry it.

**Variant A — the locked current sample, unchanged.** Already above.
Strong. Slightly abstract.

**Variant B — the same shape, with the dragon image carried** (rewrite for
your read):

> Pure beginning. The force that arrives before the thing it will make. You
> carry it already. The old books drew it as a dragon, not because it is
> ferocious but because it sleeps under the deep water for a long time and
> then, in the season, rises. When it is awake in you, it feels like
> appetite. You begin things. You want to.
>
> *(full empty line)*
>
> It has another face, and most people never learn it is the same force. The
> flat weeks. The mornings when nothing pulls at you, when the days run
> together and you cannot remember the last time you wanted to make anything.
> That is the dragon under the water. That is not the fire failing. That is
> the fire low, and low is one of its two seasons.
>
> *(full empty line)*
>
> What this asks of you is small, and it takes a long life to learn. You
> carry the fire. You do not make it. It rises on its own schedule and sinks
> on its own schedule, and the work is to stop arguing with which one is
> happening. When it is low, let it be low. The deep is the fire gathering,
> and it cannot be hurried. When it climbs, go with it before you feel ready.
> Ready is not a thing it waits for. Let it move through you, let it do what
> it came to do, and let it go when it goes.

(~260 words. Changes: the dragon arrives in the first cluster as quiet image,
returns in the second as *the dragon under the water* — naming the low as
the dragon's first position from the vault. Third cluster swaps *the numb
stretch* for *the deep* — same meaning, more image.)

**Variant C — opens on the ideogram, carries the doubled face from the
character itself:**

> Pure beginning. The character the I-Ching uses for this force shows two
> things at once: vapors rising from the warm earth, and the sun scorching
> the same ground dry. Both faces are in the single sign. You carry this
> already. When it is awake, it feels like appetite. You begin things.
> You want to.
>
> *(full empty line)*
>
> The other face is the dry season. The flat weeks. The mornings when
> nothing pulls at you, when the days run together and you cannot remember
> the last time you wanted to make anything. That is not the fire failing.
> That is the same character, turned to its other side. Drought is one of
> its two seasons.
>
> *(full empty line)*
>
> What this asks of you is small. You carry the fire. You do not make it.
> It rises on its own schedule and sinks on its own schedule, and the work
> is to stop arguing with which one is happening. When the ground is dry,
> let it be dry. The dryness is the fire gathering, and it cannot be hurried.
> When the rain comes, go with it before you feel ready. Ready is not a
> thing it waits for. Let it move through you, and let it go when it goes.

(~240 words. Most vault-anchored of the three. Carries the *vapors / sunlight
/ drought* image from the Eranos directly — this is one place where the
*single character holding both faces* is a real teaching the deck could
land. The dragon is dropped from cluster 1 in favor of the character itself.
The "salt and pepper" spiritual register stays low; the word *fire* is the
only elevated word, and it is the code's name.)

**Recommend:** read all three aloud. The locked current sample is strong;
Variant B is the same with one vault image folded in; Variant C is a real
rewrite anchored on the Eranos character. Your call — none of them are
locked yet.

---

### FIELD 4.4 — `code.invocation`

**Job.** The spoken alignment passage. First person. The reader briefly
*becomes* the code. A descent in three movements: recognition → embodiment
→ opening.

This is **optional**. A card is complete without an invocation. The Code 1
invocation already exists and is the locked reference for the deck.

The invocation worksheet (how you compose one) gets its own document,
referenced as `02_INVOCATION_WORKSHEET.md` (to be drafted after this
template is approved, per your earlier instruction: card-first, vault-second,
aggregation not generation).

**Length.** 5–9 short, speakable lines. One held breath of attention.

**Do.** First person. Every line honest from anywhere — the reader may be
deep in the Shadow, standing in the Gift, or just reading through. Never
forces the reader to claim a state. Closes on an image, not a full stop.
**Don't.** Affirmation ("I am abundant"). Summary of the description.
Instruction ("let go of fear"). Source naming. Decoration of a height not
yet seen.

**What the vault gives you for the worksheet (Code 1):**

- **The verb** (what the lived energy *does*, in present tense): *carry,
  rise, gather, begin, kindle, ride*.
- **The low movement** (what a person does when caught in the Shadow):
  *let the fire go quiet, brace against the flat weeks, fill the gap with
  motion*.
- **The opening image** (the closing line, often an image, often very quiet):
  the dragon under the water, the fire carried not made, the breath rising
  from the earth.

**Existing locked Code 1 invocation** (from `oracle/generated/01.json`):

> I recognize where I have let my fire go quiet,
> and I am ready to learn what this code would teach me.
> I set down the weight of what is already done.
> I make the first move before I am certain.
> I let creation move through me and ask nothing back.
> The fire was never mine to make. Only to carry.

**My read.** Six lines. The structure is right (recognition + readiness in
lines 1–2, embodiment in lines 3–5, opening image in line 6). The closing
line — *The fire was never mine to make. Only to carry.* — is the strongest
line in the invocation and the right place to land. Every line is honest
from anywhere. No em dashes. No source named.

**What it draws from the vault.** *Fire / carry / not mine to make* — the
through-line from Rudd and the Practical's *Harnessing the qi of Heaven, the
sage strives to be strong*. The verb is *carry*. The closing image is the
fire-as-trust.

**What it leaves on the table.** The dragon is not in the invocation. That
is probably correct — the dragon belongs to the I-Ching teaching, not the
invocation. The invocation speaks the *one energy* the four lineages point
at, not any of the four images directly. The current invocation does this
well.

**Variant A — keep the locked invocation, unchanged.** Strong. Already
locked. Recommend leaving it as-is until we have a reason to move it.

**Variant B — same shape, ground the embodiment in the dragon's two seasons**
(if you want the low-season more present):

> I recognize where I have let my fire go quiet,
> and I am ready to learn what this code would teach me.
> I set down what is already done.
> I let the low season be low.
> I make the first move before I am certain.
> The fire was never mine to make. Only to carry.

(Same six-line shape. Adds *I let the low season be low* as a fourth line
that honours the dry / hidden phase. Speaks both seasons, not just the
beginning.)

**Variant C — shorter, opens harder:**

> I recognize where the fire has gone quiet,
> and I am ready to learn what this code would teach.
> I make the first move before I am ready.
> I let it move through me and ask nothing back.
> It was never mine to make. Only to carry.

(Five lines. Tighter. Drops *the weight of what is already done* and
*creation* as a noun. The "I" steps back slightly in line 5 — *it* instead
of *the fire* — which can land as more universal or as too thin. Read it
aloud both ways.)

**Recommend:** keep Variant A (the locked invocation). It is the right
voice and the right ending. If a low-season line is wanted, Variant B is the
small move to make.

---

## 5. The per-card checklist for Code N (Section 1)

Run after writing the section. Every box must be checkable.

- [ ] **Card name** — 2–4 words, concrete image, no system jargon, no abstract
      noun. Read aloud, lands as one image.
- [ ] **Keywords** — 5–7 items, no system vocabulary, no synonym duplication,
      each carries the whole code.
- [ ] **Reading** — 2–3 cluster array (`string[]`), each cluster a real
      movement of the meaning, full empty line between them, total
      200–260 words.
- [ ] **Reading opens bare** — first sentence is already about *this* code,
      no fixed-frame opening ("this is the code of," "you know this one"),
      no oracle throat-clearing.
- [ ] **Both faces named as the same force**, not as the reader's failure.
- [ ] **Reading ends on the ask, a beat early.** No neat bow.
- [ ] **Invocation** (if present) — 5–9 short lines, first person, descent
      shape, every line honest from anywhere, closes on an image, no
      affirmation, no instruction.
- [ ] **No em dashes** in any field. Anywhere.
- [ ] **Spiritual vocabulary** within the salt-and-pepper budget — one or
      two elevated words across the whole section, no more.
- [ ] **§2 four cuts applied** — no symmetry, no summary sentence, plain
      vocabulary default, ends a beat early.
- [ ] **Vault sourcing logged** — for every concrete image, figure, or
      claim, the vault file it came from is named in the agent's report.
      (For Code 1: dragon → `oracle-01-energy.md` + `practical-01-creative-power.md`;
      *fire / freshness / low season* → `gene-key-01.md`; *carry, do not make*
      → `practical-01-creative-power.md` line 73–78.)
- [ ] **No source named** in prose. Eranos, Wilhelm, Rudd, the Practical
      Guide — none of these are spoken by the card.
- [ ] **Read aloud, top to bottom.** The body shifts slightly. If it
      doesn't, rewrite.
- [ ] **Status set.** `scaffold` for AI-drafted; `final` once Adrian has
      personally written or reworked it.

---

## 6. The JSON shape this section writes to

```json
{
  "number": 1,
  "status": "final",
  "code": {
    "card_name": "Earth's Breath",
    "keywords": [
      "Pure Beginning",
      "Inner Fire",
      "The Dragon Rising",
      "Untiring",
      "Freshness",
      "Kindling",
      "Tempering"
    ],
    "reading": [
      "Pure beginning. The force that arrives before the thing it will make. ...",
      "It has another face, and most people never learn it is the same force. ...",
      "What this asks of you is small, and it takes a long life to learn. ..."
    ],
    "invocation": "I recognize where I have let my fire go quiet,\nand I am ready to learn what this code would teach me.\nI set down the weight of what is already done.\nI make the first move before I am certain.\nI let creation move through me and ask nothing back.\nThe fire was never mine to make. Only to carry."
  }
}
```

Note: the existing JSON uses `ul.*` field names. The rename to `code.*` is
part of the global "UL N → Code N" follow-up, not this template's job.

Markdown markers (`**bold**`, `*italic*`) do **not** belong in JSON string
values. Emphasis is the card renderer's job, not the data's.

---

## 7. What you decide on this template before we move to Section 2

To lock Section 1, three calls from you:

1. **Card name** — keep *Earth's Breath* (recommended), or revisit.
2. **Keywords** — current locked set, or Variant A / B / C from §4.2, or a
   mix.
3. **Reading** — keep the current locked sample (Variant A), or move to
   Variant B (sample + dragon), or Variant C (sample rewritten on the
   Eranos character).
4. **Invocation** — keep locked (Variant A, recommended), or move to
   Variant B / C.
5. **Template shape itself** — does this structure (Job / Length / Do-Don't
   / Vault sources / Existing work / Variants / Checklist) work for you as
   the model for the other five sections?

Mark up this file directly, or talk me through your calls. Once Section 1 is
locked, I draft Section 2 (ICHING — which includes the full moving-line
template you asked for) in the same shape.
