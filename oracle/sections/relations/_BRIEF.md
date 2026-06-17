# RELATIONS section brief

> **AGENT: load `oracle/WRITE.md` FIRST.** It carries the gate, the precedence
> rule, the voice + copyright + terms spine, and the BATCH-AGENT HARDENING (glob
> vault files, card 3 = worked reference at `sections/relations/03.json`, output
> a verification block incl. the fact_check, stay in your lane). Kin links are
> "UL N" never "Code N". This brief is section-specific only; the universal rules
> live in WRITE.md.

The Universal Language Oracle weaves I Ching, Gene Keys, Human Design, and
Tarot. The first four sections of each card teach the code *internally* —
its hexagram, its shadow/gift/siddhi, its drive in the body, the body
itself. RELATIONS is the **final** section. It turns the code outward:
this card is kin to others, and what they make together.

The reader has already read the four internal sections. They know the
teaching of this code. RELATIONS does **not** re-teach the code — it shows
where the code is woven into the larger field. The cards it pairs with.
The card it programmes with. The codon ring it sits inside. The Tarot face
it carries. The Daoist Immortals who personify its forces. The Tree-of-Life
path it stands on. The sky-attribution its ring carries.

## THE FIDELITY RULES (hardened 2026-06-09 from the card 3 pass)

RELATIONS is mostly FACTS (pair, partner, ring siblings, immortals, Tarot,
Hebrew letter, sky). A wrong fact here is worse than weak prose — it teaches
something false. Two checks caught card 3's scaffold; run both before final.

1. **Verify every correspondence against `_hexagram-NN.md` (and the immortal/
   trigram source files).** Do NOT trust the scaffold's names. Card 3's scaffold
   had the WRONG upper immortal — it said Lü Dongbin and built a "sword of
   discernment" teaching on him, but the source says the Water/Kan trigram
   carries **Li Tie Guai**. Check: paired hexagram, programming partner, the
   five-or-six ring siblings, both immortals (upper trigram + lower trigram),
   the Tarot Arcana, the Hebrew letter. Each must match the vault index.

2. **Kin links are "UL N", NEVER "Code N".** (VISION.md — "UL N" everywhere:
   bar slot, kin links, URLs.) Card 3's scaffold used "Code 4 / Code 50";
   corrected to "UL 4 / UL 50". Grep the finished file for "Code [0-9]" before
   final — there should be zero.

Note on terms: inside RELATIONS, "code" as the general synthesis word IS allowed
(this is the outward/synthesis layer, not a single lineage) — e.g. "this code
stands as the moment of arrival" is fine. The ban is only on "Code N" as a kin
LABEL, which must be "UL N". (Contrast ICHING, where "code" is banned entirely
in favour of "hexagram".)

3. **Mythological detail (immortal attributes, etc.) may use established lore**
   if it serves the card's theme, but the NAME must be source-verified and you
   flag to Adrian when a detail is general lore vs. this-vault. Card 3: Li Tie
   Guai's iron crutch + gourd of medicine is real Eight Immortals lore, kept
   because it serves the Death / Ring-of-Life-and-Death theme.

## SOURCE PRECEDENCE + THE ESOTERIC-FIELD RULE (hardened 2026-06-09 from the proving run)

The 3-card proving run (UL 4/5/6) exposed two source problems. Both rules below
are mandatory.

**1. The vault index `_hexagram-NN.md` ALWAYS WINS over `_per_card_reference.json`.**
`_per_card_reference.json` is an OLDER precomputed file and carries scaffold-era
ERRORS (the run found it lists wrong ring Arcana like "The Sun" for UL 5, and
wrong immortals). It is convenient for the pair/partner NUMBERS, but on ANY
conflict the live vault index `_hexagram-NN.md` is authoritative. Never take a
correspondence (ring Arcana, immortal, sky, letter) from `_per_card_reference.json`
when `_hexagram-NN.md` says otherwise. When they disagree, follow the index and
note the conflict in meta.fact_check.

**2. `sky` and `hebrew_letter` DERIVE FROM THE RING ARCANA — re-derive or flag.**
These two fields come from the codon ring's Tarot Arcana via its Golden Dawn
attribution (the Arcana's own `metaphysical_correspondence:` and
`golden_dawn_attribution:` in its `tarot-*.md` file). So:
- First fix the ring Arcana against `_hexagram-NN.md`.
- Then DERIVE sky + hebrew_letter from THAT Arcana's tarot file (read its
  `metaphysical_correspondence` for sky, `golden_dawn_attribution` for the
  Hebrew letter). If they disagree with the scaffold's sky/letter, the scaffold
  was stale (because its ring Arcana was wrong) — correct them.
- If the needed source is an EMPTY STUB (the run found `tarot-codon-rings-mapping.md`
  and `tarot-keywords-full-reference.md` are frontmatter-only stubs), DO NOT
  invent: leave the field, set its value to null, and flag in meta.fact_check as
  "unsourced — stub file empty, needs Adrian/research pass." Never ship a guessed
  esoteric correspondence as fact.

The proving run's UL 5 is the worked example of this failure: ring Arcana
corrected The Sun -> The Star, which made the scaffold's sky (Sun) and letter
(Resh) stale, but the files needed to re-derive were empty stubs — so they were
flagged, not guessed.

## THE TAROT GRAMMAR (hardened 2026-06-09 — the Tarot is a three-axis web, not one card)

The scaffold collapsed the Tarot to the single ring-Arcana. That is too thin —
the Tarot connects to a hexagram on THREE axes, and the connection IS the
teaching. Build all three for every card. The grammar is source-encoded: each
Tarot file in `hexagrams/NN/tarot-*.md` carries an `i_ching_trigram:` field
that says which trigram it links to.

**The three axes:**
1. **Ring Arcana** — the one Major the codon ring carries (via the ring's
   Scorpio/Nun-style attribution). Card 3: Death (Ring of Life and Death).
2. **Upper-trigram Majors** — the Tarot cards whose `i_ching_trigram` matches
   this hexagram's UPPER trigram. Card 3 upper = Water → High Priestess
   (Perceive/Listen), Hanged Man (Pause for Perspective).
3. **Lower-trigram Majors** — same for the LOWER trigram. Card 3 lower =
   Thunder → The Tower (Shock/Upheaval), Judgement (Salvation/Renewal).

**How to build it (per card):**
- Read every `tarot-*.md` in the card's folder. Group by `i_ching_trigram`.
- Take the MAJOR Arcana keyed to each of the two trigrams (usually 1–3 per
  trigram). Use each card's real `upright_keyword` + `archetype` from its file.
- The minor Arcana (Cups/Wands/etc.) are suit-level overflow — DO NOT include
  them. Majors only. This keeps the web meaningful, not a pile of 18 cards.
- Write a one-line teaching per card: how that Arcana's face mirrors that
  trigram's force in THIS hexagram. Then one synthesis line tying the two axes
  (ring + trigrams) into the card's whole motion.

**JSON shape:** `tarot: { ring_arcana: {card,keyword,teaching}, upper_trigram:
{trigram, cards:[...]}, lower_trigram: {trigram, cards:[...]}, teaching }`.
See `sections/relations/03.json` for the worked reference.

This generalizes to all 64 because every hexagram IS two trigrams + a ring —
the same three seats every time. Trigram-level and nuclear-hexagram kin are NOT
needed (Adrian, 2026-06-09); line-change targets live in ICHING (the cast), not
here.

## The shape of the section

RELATIONS is a **correspondence sheet**, not a continuous essay. It is laid
out as a TCG / Pokémon-style stat block — every kin has a fixed seat the
reader learns once and scans by glance from card to card. Each card's
RELATIONS JSON holds **ten prose fields** plus their metadata.

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER BAND ─ unity_line ─ "Joined with Code N, this becomes…" │
├─────────────────────────────────────────────────────────────────┤
│  PAIR PLATE ─ this hex + paired hex ─ pair_teaching             │
│  INVERSE PLATE (smaller) ─ inverse_teaching                     │
├─────────────────────────────────────────────────────────────────┤
│  KINSHIP ROW (3 seats):                                         │
│   programming_partner ─ codon_ring ─ tarot                      │
├─────────────────────────────────────────────────────────────────┤
│  CORRESPONDENCE GRID (2×2):                                     │
│   trigrams ─ sky                                                │
│   immortal_upper / immortal_lower ─ hebrew_letter               │
└─────────────────────────────────────────────────────────────────┘
```

## The ten prose fields, with length ceilings

| Field | Role | Length |
|---|---|---|
| `unity_line` | The spine. One italic sentence opening the section. What this code *becomes* when met by its pair. | 1 sentence · 18-25 words · hard ceiling 30 |
| `pair_teaching` | What the I-Ching pair makes together. The two as one movement. | 2 sentences · 35-50 words · hard ceiling 60 |
| `inverse_teaching` | The same lines turned. What this code looks like from the other side. (Or, for self-inverse cards, what it means that this code meets its own reflection.) | 1-2 sentences · 25-40 words · hard ceiling 50 |
| `programming_partner_teaching` | The code that thinks alongside this one. What the pairing does. | 2-3 sentences · 35-50 words · hard ceiling 60 |
| `codon_ring_teaching` | The family this code belongs to. What the ring as a whole carries. | 2-3 sentences · 35-50 words · hard ceiling 60 |
| `tarot_teaching` | The Tarot arcana this code resonates with. What that face carries that this code also carries. | 2-3 sentences · 35-50 words · hard ceiling 60 |
| `trigrams_teaching` | The two forces this code is built from. One short felt statement. | 1 sentence · 18-28 words · hard ceiling 35 |
| `sky_teaching` | The sign / planet / element this code's ring is keyed to. What that sky-attribution adds to the teaching. | 1 sentence · 18-28 words · hard ceiling 35 |
| `immortals_teaching` | The Daoist Immortals who carry this code's two trigrams. (One immortal if both trigrams are the same.) | 1-2 sentences · 25-40 words · hard ceiling 50 |
| `hebrew_letter_teaching` | The Hebrew letter + Tree-of-Life path this code's ring stands on. What that letter and path say about this code. | 1-2 sentences · 25-40 words · hard ceiling 50 |

**Total prose per card: roughly 220-300 words.** Same scale as DESIGN.

## The metadata (pre-filled, do not invent)

Every card's metadata is pre-computed in `_per_card_reference.json`. Look
up your card number and use those values for:

- `pair.number`, `pair.card_name`, `pair.hexagram_name`
- `inverse.number`, `inverse.card_name`, `inverse.hexagram_name`, `inverse.is_self_inverse`
- `programming_partner.number`, `programming_partner.card_name`
- `codon_ring.name`, `codon_ring.tarot`, `codon_ring.description`, `codon_ring.siblings`
- `tarot.card`
- `sky.value`, `sky.type` (one of: `sign` · `planet` · `element`)
- `hebrew_letter.letter`, `.meaning`, `.path_number`, `.path_connects`
- `immortals.upper.{name, virtue, teaching}`, `immortals.lower.{...}`, `immortals.same_trigram`
- `trigrams.upper`, `trigrams.lower`, `trigrams.same`

**You may not change a number, name, sign, letter, or Immortal.** Those are
canonical. You may only write the **teaching prose** for each field.

## Voice (locked, same as KEYS and DESIGN)

- Intimate teacher. Plain. Warm.
- **No em dashes, no en dashes.** Use commas, periods, or "to" for ranges.
- No markdown formatting in the prose. No asterisks, no italics in the
  JSON value. (The card UI handles styling.)
- No banned KEYS openers: no "There is a…", no "Something + verb when…",
  no "At some point / Eventually / Far enough / One day…"
- No previous DESIGN drift formulas: no "The centre this gate sits in…",
  no "Half a circuit…", no "As a gate, this code is…"
- Read each card's prose openers in a row. If any two share an opening
  word or syntactic shape, rewrite one.

## The bridge rule (still in force)

A newcomer must be able to read RELATIONS and get the teaching. System
terms are allowed only where they are the actual name of the thing:

- "the pair", "the inverse" — bare nouns are fine.
- "channel", "gate", "centre" — **forbidden as prose terms**, same as DESIGN.
- "circuit" — forbidden.
- "Major Arcana", "Tarot card", "Tree of Life", "path on the Tree",
  "Hebrew letter", "Daoist Immortal" — allowed once each where they are
  the proper name of what is being shown. Use plainly, do not lecture.
- "Sky" / "sign" / "planet" / "element" — speak whichever is true for the
  card. Never call a planet a sign. Never call an element a planet.

## Per-field writing notes

### unity_line
This is the most important sentence in the section. One line, italic in
the UI, opening the whole panel. **It is NOT the same as the existing
`hexagrams_in_pairs.context` text.** That field describes what the I Ching
calls the pair; this field tells the reader **what the two together
become**.

Pattern (not a frame, just the work): name the pairing as a single thing.
Use the pair's relationship — channel name, trigram complement, line
mirror — as the substance of the line. Avoid the verb "join" if it has
been used in the previous card you can see. Vary opening word.

Example shapes (vary, do not template):
- "Met by Code 2, this is the world coming into form."
- "With its pair, the force that creates and the field that receives are one motion."
- "These two together make the channel of inspiration."
- "Read alongside Code 12, the pair is the year breathing in and out."

### pair_teaching
What the two cards make when held side by side. The teaching of the
pair, not of either card alone. Reference the pair by name (the pair's
card_name and hexagram_name from the reference). One pair sentence + one
teaching sentence is a strong shape, but do not template.

### inverse_teaching
For non-self-inverse cards: this code's lines turned upside down become
the inverse hexagram. Name the inverse by number AND card_name. Teach
what the same lines mean read from the other end. One to two sentences.

For self-inverse cards (1, 2, 27, 28, 29, 30, 61, 62): name the structural
fact (this code is its own inverse, one of the eight) and teach what
that fact says about the code's nature. Be specific to which of the eight
this is. Do not write the same teaching for all eight.

### programming_partner_teaching
Programming partners in Gene Keys run on the same hexagram-pair structure
across the genetic code. The teaching is functional: what does this
partnership do? What do these two together know, that neither knows alone?
Often the partner is also the I-Ching pair (e.g. 1↔2) — when that is the
case, the unity_line and the programming_partner_teaching should NOT say
the same thing. Unity line is poetic / felt; partner teaching is
functional / what-they-do-together.

### codon_ring_teaching
Each ring is a family of cards bound by their amino acid (the body
correspondence). Use the ring's name and Tarot face. Teach what the ring
as a whole carries; what kind of family this is. Reference the siblings
by number where useful, but do not list all of them in prose if the list
is long.

For Ring of Origin (only card 41) and singleton rings, teach the
significance of standing alone in its ring.

### tarot_teaching
This is the resonance between this code and its assigned Tarot card.
Note: the ring's Tarot Major Arcana (e.g. "14 - Temperance") is the ring
identity; the per-card Tarot (e.g. "XIV · The Art") is often the same
card under a different naming. **Use the per-card tarot.card value.**
Teach what the arcana's image and meaning carries that this code also
carries.

### trigrams_teaching
The two trigrams the hexagram is built from. Speak them as forces, not
as chart-elements. "Heaven over Earth" or "Wind moving through Mountain"
or "Fire above Water." One short felt statement, no jargon. If both
trigrams are the same (Heaven over Heaven, Earth over Earth, etc.), the
teaching honours the doubling: this code is one force, unmixed.

### sky_teaching
Use whichever the data carries. **Sign:** speak the sign's
character — fixed earth, mutable fire, cardinal water. **Planet:** speak
the planet's force. **Element:** speak the element. One short sentence.

This field's value comes from the Golden Dawn correspondence the codon
ring's Tarot Arcana carries. It is honest to the system, not invented.

### immortals_teaching
The Daoist Eight Immortals each carry one of the eight trigrams. Each
hexagram thus has two Immortals (one upper, one lower) — unless the two
trigrams are the same, in which case the upper and lower Immortal are
identical and the teaching honours that doubling.

Teach what the two figures together carry, or what the single figure
doubled carries. Name them: use both Immortal names. Their virtues are
in the reference; do not paraphrase the virtue as your teaching — say
what the **pair** (or doubled single) brings to this code.

### hebrew_letter_teaching
The codon ring's Tarot Arcana corresponds to one of the 22 paths on the
Tree of Life, each path carrying one of the 22 Hebrew letters. Name the
letter (transliterated only, no Hebrew character in the prose), name the
path-meaning, name what the path connects. One sentence on what the
letter teaches about this code. The reference's `path_connects` value
(e.g. "Tiphareth to Yesod") is the structural fact; the teaching is what
that connection means.

## What's forbidden

- **Em dashes, en dashes.** Use commas, periods, "to" for ranges.
- **Re-teaching the code.** This is not the place to restate gift/shadow
  or the gate's drive. Trust that the reader has read the previous four
  sections.
- **Reading the ring's description verbatim** as a teaching. The reference
  has the ring's description; your job is to write a sharper teaching for
  this card's relationship to the ring.
- **Inventing numbers, names, signs, letters, or Immortals.** All are
  pre-computed; use what's there.
- **Lecturing on the Tree of Life, Golden Dawn, Tarot, Daoism, or Human
  Design.** Single-sentence touches only.
- **The opener templates KEYS broke:** "There is a…", "Something + verb
  when…", "Far enough…", "Half a circuit…", "The centre this gate sits
  in…", "As a gate, this code is…", "At some point…", "Eventually…".

## Output

Save to `oracle/sections/relations/NN.json` (pad to two digits). The
shape:

```json
{
  "number": <int>,
  "section": "relations",
  "status": "final",
  "card_name": "<from reference>",

  "unity_line": "<your prose>",

  "pair": { "number": <int>, "card_name": "<ref>", "hexagram_name": "<ref>", "teaching": "<your prose>" },
  "inverse": { "number": <int>, "card_name": "<ref or null>", "hexagram_name": "<ref or null>", "is_self_inverse": <bool>, "teaching": "<your prose>" },

  "programming_partner": { "number": <int>, "card_name": "<ref>", "teaching": "<your prose>" },
  "codon_ring": { "name": "<ref>", "tarot": "<ref>", "siblings": [<ints>], "teaching": "<your prose>" },
  "tarot": { "card": "<ref>", "teaching": "<your prose>" },

  "trigrams": { "upper": "<ref>", "lower": "<ref>", "teaching": "<your prose>" },
  "sky": { "value": "<ref>", "type": "<sign|planet|element>", "teaching": "<your prose>" },
  "immortals": {
    "upper": { "trigram": "<ref>", "name": "<ref>", "virtue": "<ref>" },
    "lower": { "trigram": "<ref>", "name": "<ref>", "virtue": "<ref>" },
    "same_trigram": <bool>,
    "teaching": "<your prose>"
  },
  "hebrew_letter": { "letter": "<ref>", "meaning": "<ref>", "path_number": "<ref>", "path_connects": "<ref>", "teaching": "<your prose>" },

  "meta": {
    "source": "relations v1, locked sample UL 1",
    "generated": "relations-v1"
  }
}
```

## The reference card

`oracle/sections/relations/01.json` is the Adrian-locked sample. Match
the voice. Read it before writing your card. It teaches what each field
sounds like at the right length and register.

## When done

Report card number, the unity_line, word counts per prose field, and
confirm "no em dashes, no banned openers, all metadata matches the
reference."
