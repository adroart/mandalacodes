# Survey: the Mandala Codes Oracle writing specification set

Scope: read-only survey of every writing-specification document listed in the
task, plus the live card files (oracle/cards/01.md, oracle/cards/23.md) and the
editorial/manuscript snapshots for card 23, to determine what each card section
is supposed to be, which document actually governs it today, where the
documents disagree, and where the documents disagree with what has actually
shipped. No repo file was modified.

Repo root for all paths below:
`mandalacodes/.claude/worktrees/fresh-chat-handoff-a8e5cd`

---

## 0. How authority is structured across the document set (read this first)

`oracle/INDEX.md`, "Before you write any card prose," establishes a mandatory
read order: `CONCEPT.md` → `00_MASTER_WRITING_GUIDE.md` → `WRITING_METHOD.md` +
`sections/_TEMPLATE_01_CODE_N.md` → `todo/plans/reading-rewrite.md`. INDEX.md
states plainly: "An agent that stopped at the table below would follow a spec
that has been superseded since 2026-07-06."

`oracle/WRITE.md`, "THE PRECEDENCE RULE," names two doctrine layers explicitly
and says they "do not fully agree":

1. The SIX-SECTION method (newer, canonical on structure): `WRITING_METHOD.md`
   + `sections/_TEMPLATE_01_CODE_N.md` + `sections/_DEEP_PASS_ADDENDUM.md`.
   "Where these conflict with the older 00-06 set on STRUCTURE or FIELD SHAPE,
   these win" (WRITE.md quoting WRITING_METHOD §0).
2. The 00-06 guide set (older, still canonical on voice, copyright, and craft):
   `00_MASTER_WRITING_GUIDE.md` (two-phase frame §1, terms §3, coherence §5,
   copyright §6, voice §7, status §10), `05_KEYWORDS_GUIDE.md` (keywords),
   `06_CONNECTIONS_GUIDE.md` (Relations voice), `01`-`04` (older craft +
   worked examples + the translation method). "These win on VOICE, COPYRIGHT,
   KEYWORDS, RELATIONS, and STATUS."

On top of both sits a third, narrower override, stated in `oracle/WRITE.md`'s
supersession banner and repeated verbatim in `oracle/INDEX.md`, `oracle/WRITING_METHOD.md`,
`oracle/sections/_TEMPLATE_01_CODE_N.md`, and `oracle/ANCHOR.md`: the opening
reading's shape (the `## CODE` field called `code.reading` / `ul.reading`) is
governed by `todo/plans/reading-rewrite.md` + `CONCEPT.md` §4, which supersedes
the three-movement shape in `WRITING_METHOD.md` §1.4b/§3 SECTION 1 and
`sections/_TEMPLATE_01_CODE_N.md` §4.3, including their locked Hexagram 1
sample text.

Plain summary used throughout this report: **structure/length/field-shape →
WRITING_METHOD.md; voice/copyright/keywords/Relations-craft/status →
00 + 05 + 06; the CODE reading's shape specifically → reading-rewrite.md +
CONCEPT §4, overriding WRITING_METHOD and the template on that one field.**

The live card shape (confirmed against `oracle/cards/01.md` and
`oracle/cards/23.md`) is six headed sections in one Markdown file per card:
`## CODE`, `## ICHING`, `## KEYS`, `## DESIGN`, `## BODY`, `## RELATIONS`, with
YAML frontmatter carrying structural facts, a per-lens `status` map, and a
`meta.sourcing_log` / `meta.fact_check` block. This matches `WRITING_METHOD.md`
§0's six sections and `oracle/WRITE.md`'s "MARKDOWN IS THE OUTPUT FORMAT"
section almost exactly.

---

## 1. CODE (the opening reading), including keywords and invocation

### 1.1 What it is for

`sections/_TEMPLATE_01_CODE_N.md` §0: "The card's home page. The
complete-on-its-own front door. A reader who only ever reads Code N has had a
real reading." `oracle/VISION.md`, "Why it is split into sections": "The
opening face, the oracle-type reading. Guidance for now. This is the
beginning page; it stands alone and is complete by itself." `oracle/CONCEPT.md`
§4 calls the equivalent unit "the Glance" and specifies its job is to give "a
short, woven reading of the code itself... drawing the threads of all the
systems together without naming them."

`WRITING_METHOD.md` §0 decision 2: "UL N is a real section... It holds the
art, the name, the keywords, the invocation, and the opening reading. It is the
card's home and is complete on its own."

### 1.2 Shape, length, voice, person, must/must-not

**Card name** (`code.card_name`): 2-4 words, a "third thing," concrete image,
no system jargon (`00_MASTER_WRITING_GUIDE.md` §9; `sections/_TEMPLATE_01_CODE_N.md`
§4.1).

**Keywords** (`code.keywords`): 5-7 items, 1-3 words each, no per-system quota,
judged by one test only ("does it hold the energy of the card") , 
`05_KEYWORDS_GUIDE.md` §2-3. Keywords must pass "THE STRANGER TEST" (§3b,
added 2026-06-09): a stranger with no framework knowledge must get it cold in
under a second; four auto-fail conditions are listed (contains a word not used
in ordinary speech; only makes sense if you have read the card; names the
shadow rather than the energy; is an instruction rather than a naming). Card 1
worked example in §4 shows a real correction from 9 keywords down to 7. Live
card 1 keywords ("Freshness · Inner Fire · The Low Season · Pure Beginning ·
Aliveness · Creating · Letting Go") do not exactly match any of the guide's
worked variants, confirming keywords keep evolving past the guide's own
examples.

**Reading** (`code.reading`): per the LIVE authority (`reading-rewrite.md`),
not the superseded WRITING_METHOD shape:
- Built from a **distillation sheet** written before any prose (Step A): the
  I Ching answers "the situation," Human Design answers "the body" (where it
  is physically felt), Gene Keys answers "the arc" (collapsed vs. ripened, one
  energy two altitudes), Tarot answers "the face" (one figure/gesture). A
  single "one-breath truth" sentence must make all four click into place
  without forcing.
- Adrian ratifies the one-breath truth per card (Step B) before any prose is
  drafted.
- Prose (Step C): three paragraphs, ~200-260 words, four beats braided into
  ONE voice (never four voices in sequence): (1) the force lit, anchored in
  body + a lived moment; (2) the other face, felt not diagnosed, never a
  restatement of the KEYS Shadow text; (3) the turn AND the ask together,
  **ending risen**, "the reading ends risen. The 'no neat bow' rule is
  amended... end plain and a beat early, but end UP."
- Lens-validation (Step D): would a reader who knows only the I Ching, only
  Gene Keys, only HD, or only Tarot each recognize this as their own
  hexagram/code, with none saying "this is mine alone"? Plus: no phrase
  duplicated from the card's own KEYS/ICHING sections.
- A `sourcing_log` entry is required (Step E), CODE previously had none,
  which `reading-rewrite.md` names as one of the five root causes of the
  original failure.

Voice for the whole CODE section, per `sections/_TEMPLATE_01_CODE_N.md` §1-3
and `WRITING_METHOD.md` §1: intimate teacher, second person ("you"), no
em dashes, no fixed opening frame ("This is the code of...", "You know this
one"), no oracle throat-clearing ("you have drawn," "the oracle speaks"), no
system named, no "entrance" explaining what a system is, spiritual vocabulary
salt-and-pepper (one or two words per whole section, not per paragraph), and
every image traced to a vault file (§3, "nothing is invented").

**Invocation** (`code.invocation`, optional): first person, 5-9 short
speakable lines, a descent (recognition+readiness → embodiment as present-tense
action → opening as the lightest touch, never claimed) per
`02_INVOCATION_GUIDE.md` §2 and `sections/_TEMPLATE_01_CODE_N.md` §4.4. Must
be "true from anywhere" the reader is standing (Shadow, Gift, or just reading
through), never forces a false state. Not an affirmation, not a summary, not
an instruction (`02_INVOCATION_GUIDE.md` §1).

### 1.3 Live authority vs. superseded vs. contradiction

- **LIVE for the reading's shape:** `todo/plans/reading-rewrite.md` +
  `CONCEPT.md` §4.
- **SUPERSEDED, explicitly and by name:** `WRITING_METHOD.md` §1.4b and §3
  SECTION 1 ("The reading is 2-3 clusters... For Hexagram 1 the three clusters
  are the reading's three genuine movements: what the force is → its hidden
  face → what it asks"), and `sections/_TEMPLATE_01_CODE_N.md` §4.3 (identical
  three-movement shape, plus all three "Variant A/B/C" worked samples for
  Hexagram 1). `oracle/WRITE.md`'s banner states this in the imperative: "Do
  not write, revise, or imitate a `## CODE` reading from this file."
- **Card name, keywords, invocation fields:** still governed by
  `sections/_TEMPLATE_01_CODE_N.md` §4.1, §4.2, §4.4 and
  `05_KEYWORDS_GUIDE.md` / `02_INVOCATION_GUIDE.md`, the supersession notice
  in the template file itself says so explicitly: "§4.1 (card_name), §4.2
  (keywords), §4.4 (invocation), and the voice/cut rules in §1-§2 still hold."
- **Contradiction found in the live files, not just the docs:** both
  `oracle/cards/01.md` and `oracle/cards/23.md` (the two live cards this
  survey read in full) carry `## CODE` readings written in the exact
  superseded three-movement shape. Card 1's reading: paragraph 1 = "There is a
  fire in you that begins things..." (the force lit); paragraph 2 = "Then it
  drops, and almost no one is told the quiet is the same fire..." (the other
  face); paragraph 3 = "So the art of it is small and takes most of a life...
  Only to carry while it is here, and to let go the moment it goes" (the ask).
  Card 23's reading follows the identical three-beat pattern almost word for
  word in structure. Neither reading shows the four-questions distillation
  sheet's explicit Tarot-anchored close, and neither reading's final paragraph
  fuses "the turn AND the ask together" as `reading-rewrite.md` Step C.3
  requires, both simply end on the ask, which is the retired shape. This is
  not a documentation disagreement; it is the shipped product not yet having
  been migrated to the document that is supposed to govern it. `reading-rewrite.md`
  itself explains why: as of 2026-09-02 the plan was redirected ("Route: build
  these in WordForge, not as a markdown pass") and the next session's job list
  ends at "Stop there. Do not write or rewrite reading prose. The writing is
  his." So the 64 CODE readings, including cards 1 and 23, are still running
  on the old spec while the new spec sits unapplied, by design, waiting on
  Adrian working inside WordForge.
- Word counts measured directly: card 1's CODE reading is 293 words, card 23's
  is 282 words, both above the "~200-260" (WRITING_METHOD §3 SECTION 1) /
  "200-280" (TEMPLATE checklist) target range, though the docs call these
  "typical ranges, not gates" (`00_MASTER_WRITING_GUIDE.md` §7 lead-in and
  repeated throughout `03_ICHING_GUIDE.md` §2, `01_DESCRIPTION_SPEC.md` §2).

### 1.4 Connections to other sections

- `sections/_TEMPLATE_01_CODE_N.md` §0: "No system is named here. No structure
  is explained... The teaching chapters (ICHING, KEYS, DESIGN, BODY, RELATIONS)
  come after." The reading is explicitly upstream of every other section and
  must not explain any of them.
- `reading-rewrite.md` Step D (lens validation) explicitly checks the reading
  against KEYS and ICHING: "no phrase duplicated from the card's own
  KEYS/ICHING sections." This is the clearest stated cross-section rule for
  CODE.
- `WRITING_METHOD.md` §2 ("Internal vs. outward relating") applies globally,
  including to CODE by implication, though CODE is not itself a place where
  internal or outward relating is taught, it is meant to synthesize without
  teaching mechanism at all.
- The keywords are explicitly downstream synthesis: `05_KEYWORDS_GUIDE.md` §2
  says keywords are "written last, because they distil the finished card,"
  consulting the I Ching, Gene Keys, HD gate, and Tarot Arcana but owing
  loyalty to none of them, the guide is explicit that provenance from any one
  section does not matter.
- The invocation is also written last among CODE's own fields
  (`00_MASTER_WRITING_GUIDE.md` §8 step 5: "the invocation is the last prose
  written, because it is the distillation of everything above it"), pulling
  from the whole card, not from CODE's own reading specifically.
- The spec is silent on one connection point: nothing tells a writer whether
  the CODE reading's one-breath truth (from the distillation sheet) is
  supposed to be the *same* one-breath truth used elsewhere on the card (e.g.
  the card name, per `00_MASTER_WRITING_GUIDE.md` §8 step 1) or a fresh one
  computed independently for the reading. `00_MASTER_WRITING_GUIDE.md` §5.2
  calls this "the one repetition that is allowed... the one-breath truth of
  the code," implying one shared truth for the whole card, but
  `reading-rewrite.md` describes deriving its own center sentence per card
  with its own ratification step, without cross-referencing the master
  guide's version. The two processes are never explicitly reconciled.

---

## 2. ICHING (Combination, upper/lower trigram natures, Reading, Judgement, Image, Moving lines)

### 2.1 What it is for

`VISION.md`: "The situation and its natural image; the moving lines (internal
relating) resolved by the cast." `03_ICHING_GUIDE.md` §0 (opening paragraph):
the section's design problem is to keep a 3,000-year lineage "whole and
authoritative" while making the card "reachable," solved by layering rather
than blending or modernizing.

### 2.2 Shape, length, voice, structure, must/must-not

`WRITING_METHOD.md` §3 SECTION 2 is the LIVE field-by-field spec (see §0 of
this report for precedence):

| Field | Job | Length |
|---|---|---|
| `iching.hexagram_name` | The hexagram's name | 1-4 words |
| `iching.combination` | What the two trigrams make together; the selector's default view | ~60-90 words |
| `iching.upper_nature` / `iching.lower_nature` | Each trigram's own nature; may reuse shared trigram text across the 64 | ~30-50 words each |
| `iching.reading` | The situation + how the natural image unlocks it; "the section's centre of gravity" | ~200-320 words |
| `iching.judgement_lines[]` | The Judgement, freshly rendered, original wording | 2-5 short lines |
| `iching.image_lines[]` | The Image, freshly rendered | 2-4 short lines |
| `iching.lines[]` | Six moving lines, each self-contained, each naming a "becomes" hexagram | ~50-70 words each |

`03_ICHING_GUIDE.md` (the older but still-cited layering doctrine) describes
the same three top layers under different names, Layer 1 "Intro" (~40-70
words, plain voice, names the life-situation), Layer 2 "The Classic"
(Judgement + Image, terse, no word-count gate, "whatever the Judgment and
Image honestly require"), Layer 3 "The Interpretation" (~60-100 words,
unlocks the natural image). `WRITING_METHOD.md`'s "combination/reading" split
does not map one-to-one onto the older guide's "Intro/Interpretation" split , 
see contradiction note below.

Do/don't (`WRITING_METHOD.md` §3 SECTION 2): "in `combination`, teach the
image... Don't restate the UL N/CODE reading; drift into Shadow/Gift/Siddhi."
For lines: "keep each line a self-contained micro-reading; name the becoming
hexagram plainly... Don't let the lines re-teach the whole hexagram."

The deep-pass standard (`sections/_DEEP_PASS_ADDENDUM.md`) governs a *denser*
rewrite pass specific to ICHING and BODY: carry the Chinese philology inside
the teaching rather than announcing it ("GOOD" vs. "BAD (banned, 'entrance')"
examples given, §2.1); no bare Mandarin transliteration standing alone (§2.2);
carry named mythological/historical figures from the Practical Guide without
crediting the source (§2.3); write each of the six moving lines from its own
line file's specific image, not from "the position" generically (§2.4). The
addendum tightens length: `combination` 60-90, `reading` 200-300, each line
40-60 (§4), slightly different ceilings than WRITING_METHOD's own table
(200-320 for `reading`), a minor internal inconsistency between the method
table and its own addendum.

Voice/tense/person: same as CODE, intimate teacher, second person is used
more sparingly here than in CODE (the worked Hexagram 1 `iching.reading`
sample in `WRITING_METHOD.md` §3 uses "you" directly: "You are standing in the
moment before... You ride the force"). Present tense for the counsel, past/
descriptive for the classic layer. No em dashes; no source naming
(Wilhelm/Eranos/Rudd never named in prose, per `oracle/WRITE.md`'s
non-negotiables list and `04_TRANSLATION_METHOD.md` throughout).

Terms discipline specific to this section, stated only in `oracle/WRITE.md`
("THE NON-NEGOTIABLE RULES"): "Inside the ICHING section, the thing is a
'hexagram,' never a 'code.'" This is called out as a rule hardened after a
real failure: "(Adrian's rule, 2026-06-09, caught 'this code names' in card 3
ICHING.)"

**The classic layer's translation method** (`04_TRANSLATION_METHOD.md`) is a
separate, heavily proceduralized sub-spec for `judgement_lines[]` and
`image_lines[]` only: seven-step procedure (AI assembles evidence from
verified sources only, never model recall → AI maps convergence/divergence →
**Adrian forms his own sense before any AI draft exists** → AI drafts a
synthesis last → Adrian verifies and writes the final line → a faithfulness/
register check → optional expert review), with a mandatory worksheet per
hexagram recording every contested fork and Adrian's reasoned choice. This is
the one place in the whole spec set where the two-phase model (`00
_MASTER_WRITING_GUIDE.md` §1) is explicitly declared not to apply the normal
way: `04_TRANSLATION_METHOD.md`'s own note says "A translation is not a draft
to be replaced by personal voice... So here, the method itself *is* the
finished process."

### 2.3 Live authority / superseded / contradictions

- **LIVE on structure and length:** `WRITING_METHOD.md` §3 SECTION 2, further
  densified by `sections/_DEEP_PASS_ADDENDUM.md` for a "deep pass."
- **LIVE on the layering doctrine and the classic-text sourcing method:**
  `03_ICHING_GUIDE.md` and `04_TRANSLATION_METHOD.md`, neither is marked
  superseded anywhere in the corpus, and `oracle/WRITE.md`'s load-order table
  requires both when writing this section.
- **Contradiction, structural naming:** `03_ICHING_GUIDE.md` names three
  layers "Intro / Classic / Interpretation," each independently complete and
  the reader "loses nothing structural" by stopping at any one.
  `WRITING_METHOD.md` §3 SECTION 2 instead names the live JSON/Markdown fields
  `combination`, `upper_nature`, `lower_nature`, `reading`,
  `judgement_lines[]`, `image_lines[]`. The two schemes are never explicitly
  mapped onto each other in any document read, a writer following
  `03_ICHING_GUIDE.md` alone would produce an "Intro" and an "Interpretation"
  paragraph; the live cards (`01.md`, `23.md`) instead show a `### Combination`,
  `### Upper trigram`, `### Lower trigram`, `### Reading`, `### Judgement`,
  `### Image`, `### Moving lines` heading structure, i.e. the WRITING_METHOD
  shape, confirming WRITING_METHOD is what actually shipped, per the stated
  precedence rule. `03_ICHING_GUIDE.md` is best read now as the doctrine
  underneath the fields (why layering, why not modernize) rather than the
  field list itself.
- **Contradiction, length ceiling:** WRITING_METHOD's table gives
  `iching.reading` as ~200-320 words; the deep-pass addendum (§4) tightens
  this to 200-300 for the same field. Neither document cross-references the
  other's number.
- Live check: card 1's ICHING `### Reading` runs three paragraphs of visibly
  similar length to the worked sample in `WRITING_METHOD.md` §3 (which is
  quoted as the reference and is reused verbatim as card 1's live reading , 
  the "Hexagram 1" worked sample IS card 1's shipped ICHING reading, word for
  word). This is the one section where the guide's worked example and the
  live product are identical, because Hexagram 1 was the design reference
  card throughout (`ANCHOR.md` §1: "Hexagram 1 worked samples drawn from the
  real vault source").

### 2.4 Connections to other sections

- `WRITING_METHOD.md` §2 ("Internal vs. outward relating") assigns the six
  moving lines to ICHING specifically as "internal relating," and states they
  must stay here: "internal relating is never repeated in RELATIONS." This is
  the most explicit, most repeated cross-section rule in the whole corpus
  (also stated in `VISION.md` "Internal vs. outward relating," and enforced as
  a checklist item in `WRITING_METHOD.md` §4).
  `sections/relations/_BRIEF.md` and `06_CONNECTIONS_GUIDE.md` correspondingly
  forbid RELATIONS from re-teaching the moving lines.
- The ICHING `combination`/`reading` must not restate the CODE reading
  (WRITING_METHOD §3 SECTION 2, "Don't: restate the UL N reading") and must
  not drift into Gene Keys material ("drift into Shadow/Gift/Siddhi").
- `oracle/WRITE.md`'s term-discipline rule ties ICHING to the term "hexagram"
  specifically to keep it distinguishable from "code" (CODE's term) and "gate"
  (DESIGN's term), an explicit boundary-drawing connection, not a content
  connection.
- The deep-pass addendum (§2.5, actually about BODY) cross-references reading
  the "KEYS section for this card" so BODY imagery sits "coherent with the
  established Shadow/Gift/Siddhi voice", this is a BODY-to-KEYS connection,
  not ICHING's, but it is the clearest documented example of one section's
  brief explicitly telling the writer to read a sibling section before
  drafting.
- Gap: nothing in `03_ICHING_GUIDE.md`, `WRITING_METHOD.md`, or the deep-pass
  addendum tells a writer whether the ICHING `reading`'s natural image
  (mountain over lake, etc.) is allowed to reappear as the felt texture in the
  CODE invocation. `02_INVOCATION_GUIDE.md` §3 says the invocation may draw
  "felt textures... image / body-location / gesture from any mapping"
  including the hexagram's natural image, so there IS a sanctioned connection
  there, but it is stated only from the invocation's side, never cross-linked
  from the ICHING guide's side.

---

## 3. KEYS (Gene Keys: Shadow, Repressive, Reactive, Gift, Siddhi)

### 3.1 What it is for

`VISION.md`: "Shadow / Gift / Siddhi, the inner spectrum of the code."
`01_DESCRIPTION_SPEC.md` §0: "The description teaches, the reader understands
the code... its unique job is the three frequencies; it does not re-explain
the hexagram or the natural image."

### 3.2 Shape, length, voice, structure, must/must-not

**LIVE lengths and field list**, `WRITING_METHOD.md` §3 SECTION 3:

| Field | Job | Length |
|---|---|---|
| `gene_keys.shadow_name` / `gift_name` / `siddhi_name` | The three frequency names | 1-2 words each |
| `gene_keys.shadow` | The low frequency, as energy, never as reader diagnosis | ~180-200 words |
| `gene_keys.repressive` | Shadow's inward face, one real person who goes still | ~30-45 words |
| `gene_keys.reactive` | Shadow's outward face, a different real person who speeds up | ~30-45 words |
| `gene_keys.gift` | The turn; same energy metabolized | ~180-200 words |
| `gene_keys.siddhi` | The highest frequency, present tense, spacious | ~150-180 words |

Confirmed against the live file: card 1's Shadow paragraph = 200 words, Gift =
200 words, Siddhi = 135 words, Repressive = 42 words, Reactive = 38 words , 
matching WRITING_METHOD's table closely (Siddhi runs a little short of its
150-180 floor but within the "typical, not a gate" allowance).

**Superseded, shorter lengths**, `01_DESCRIPTION_SPEC.md` §2 gives an older,
much shorter shape for the same content: opening line (~15-22 words), Shadow
paragraph "~70 to 90 words" (repressed and reactive as one clause each *inside*
the Shadow paragraph, not as their own fields), Gift paragraph "~70 to 90
words," Siddhi paragraph "~60 to 80 words," "a description usually lands near
230 words total." This is roughly one third the length of the live
WRITING_METHOD/shipped-card shape (which runs 180+42+38+200+135 = 595 words
for the same five parts in card 1). `01_DESCRIPTION_SPEC.md` is not marked
superseded anywhere in its own text or in `WRITE.md`'s load-order table (which
still lists it as required reading for the KEYS section), but by the stated
precedence rule ("WRITING_METHOD wins on structure or field shape") and by
what has actually shipped, its length figures and its single-paragraph
repressed/reactive-as-a-clause structure are dead. A writer who read only
`01_DESCRIPTION_SPEC.md` and not `WRITING_METHOD.md` would write a
description roughly a third the length of what the deck actually contains and
would fold Repressive/Reactive into the Shadow paragraph rather than writing
them as separate labelled fields, this is a live, unflagged contradiction
between two documents `oracle/WRITE.md`'s own load order tells a writer to
read for the same section.

**The KEYS-specific standard, "locked with the UL 1 build"**
(`WRITING_METHOD.md` §3 SECTION 3): describe the energy, never diagnose the
reader ("not 'you are numb' but 'numbness is...'"); each frequency carries its
own resolution woven in, never tacked on; commit to one image and carry it
across the whole arc (low coals, the floor, the road); run the §1.5
"reads-as-human" audit (no triads, no summary sentences, no elevated-default
vocabulary, no tidy bows, keep deliberate unevenness).

Voice/tense/person: third person / general ("a person," "you" used sparingly
compared to CODE), present tense throughout, description not narration.
Repressive/Reactive must each read as "two distinct people" per both
`01_DESCRIPTION_SPEC.md` §3 and `WRITING_METHOD.md`'s worked sample commentary.

Copyright-specific note for this section: `00_MASTER_WRITING_GUIDE.md` §6
"KEEP" list explicitly protects the Shadow/Gift/Siddhi *name triads* as kept
lineage while "CUT" bans any of Rudd's specific coined prose. `reading-rewrite.md`'s
"Related but separate" section flags a live copyright leak found in the
process of this rewrite: the card page's rendering code (`UniversalLanguageCard.tsx`)
was found to fall back to "OLD synthesis JSON" that "names Richard Rudd and
uses his coined phrases, live copyright violations per master guide §6,"
independent of whether the Markdown KEYS section itself is clean.

### 3.3 Live authority / superseded / contradictions

- **LIVE:** `WRITING_METHOD.md` §3 SECTION 3 for structure/length/field list;
  `01_DESCRIPTION_SPEC.md` for the underlying "arc" doctrine (recognition →
  diagnosis → the turn → the horizon, §1) and the copyright/voice discipline,
  which is not superseded even though its length figures are stale.
- **Contradiction:** see length table above, `01_DESCRIPTION_SPEC.md`'s
  ~230-word total vs. `WRITING_METHOD.md`'s ~600-word total for the same five
  parts, unreconciled in either document.
- The `keys/_DIVERSIFY_BRIEF.md` and `keys/_TRIM_BRIEF.md` referenced in
  `oracle/WRITE.md`'s per-section load table were not directly read in this
  survey (not on the reading list given), but their existence implies at
  least two more historical correction passes specific to KEYS beyond what
  `_DIVERSIFY_PASS_THREE.md` / `_DIVERSIFY_PASS_FOUR.md` cover for the other
  sections.

### 3.4 Connections to other sections

- `WRITING_METHOD.md` §3 SECTION 3 "Don't": "re-explain the hexagram; restate
  the UL N reading; pull the partner code in (that is RELATIONS); diagnose the
  reader's state." This is the clearest explicit boundary against ICHING,
  CODE, and RELATIONS bleeding into KEYS.
- `sections/_DEEP_PASS_ADDENDUM.md` §1 (BODY reading list) explicitly tells a
  BODY writer to read "The KEYS section for this card... so the body imagery
  sits coherent with the established Shadow/Gift/Siddhi voice", a documented
  KEYS→BODY dependency, one-directional as written (BODY depends on KEYS;
  nothing states the reverse).
- `05_KEYWORDS_GUIDE.md` §4 worked example explicitly draws on Gene Keys
  material ("Kindling," "Freshness," "Tempering") when building keywords,
  making KEYS one of several inputs to the keyword-distillation step, alongside
  ICHING and Tarot.
- Gap: the spec never states whether the Shadow paragraph's "root fear or
  belief" (required by `01_DESCRIPTION_SPEC.md` §2) is allowed to be the same
  "root" that DESIGN's `gate` field names as its "misread" (DESIGN also has a
  "misread" convention, see §4 below). Both sections independently developed
  a "the common misread of this energy" beat with no cross-reference to keep
  them from either duplicating or contradicting each other.

---

## 4. DESIGN (Human Design: the drive/gate, the centre, the channel)

### 4.1 What it is for

`VISION.md`: "The gate, the centre, the channel, the code in the energy
body." `WRITING_METHOD.md` §3 SECTION 4: "The code in the energy body: the
gate, the centre it sits in, the channel it forms."

### 4.2 Shape, length, voice, structure, must/must-not

`WRITING_METHOD.md` §3 SECTION 4 table (LIVE):

| Field | Job | Length |
|---|---|---|
| `human_design.keyword` | The gate's name/keyword | 1-3 words |
| `human_design.gate` | What this code *is* as a gate, from felt experience | ~120-200 words |
| `human_design.centre` | The centre it sits in and why that placement is the teaching | ~120-200 words |
| `human_design.channel` | The channel it forms with its partner gate; internal relating | ~120-200 words |

Explicit not-do, stated as a **rejected source template**: "opening every
entry with 'Gate N is the Gate of...' is a not-do. Open from the body, from
experience, from the image." This is repeated in `VISION.md` ("Human Design's
gate descriptions all open 'Gate 1...' with a fixed template, that is a
*not-do*") and again in `oracle/WRITE.md`'s non-negotiables list. `oracle/WRITE.md`'s
per-section load table lists `sections/design/_BRIDGE_REWRITE_BRIEF.md` (not
directly read in this survey) as the document that actually enforces the "no
HD jargon" bridge rule named in `ANCHOR.md` §4: "DESIGN section follows the
'bridge' rule: no HD jargon (gate/centre/channel/circuit) in the prose;
architecture lives as quiet metadata for the UI." This appears to conflict at
the letter with `oracle/WRITE.md`'s own per-section term check ("DESIGN says
'gate/centre/channel' only as the bridge rule allows"), i.e. the bridge rule
is described in two different documents with two different strictness levels
(ANCHOR says no jargon words at all in prose; WRITE.md's own headings for the
section use "Gate 1, Self-Expression" openly as a heading label, and the live
card's own subheadings read "### The drive, Gate 1, Self-Expression" and
"### Where it lives, the Identity Center," i.e. the jargon words DO appear,
just not as the opening sentence template). The live product resolves this in
practice: gate/centre/channel names appear in **headings**, never as the
prose's opening sentence construction.

Voice: same intimate-teacher rules; DESIGN carries its own "misread" beat,
stated in the worked samples but not in a checklist line: card 1's `gate`
paragraph explicitly writes "The misread is to call this ego, or
attention-seeking, or a need to be original. It is none of those." This
mirrors the KEYS section's "most people treat this as a fault" convention (see
§3.4 gap above) without either guide cross-referencing the other.

### 4.3 Live authority / superseded / contradictions

- **LIVE:** `WRITING_METHOD.md` §3 SECTION 4, plus the unread-in-this-survey
  `sections/design/_BRIEF.md` and `_BRIDGE_REWRITE_BRIEF.md`.
- **Direct contradiction with `00_MASTER_WRITING_GUIDE.md`:** §5.4 of the
  master guide states flatly: "Human Design and Tarot are not written-out
  sections. They are mapping lineages... they are not given their own prose
  section and do not need their own guide." This is contradicted by the
  entire existence of `WRITING_METHOD.md` §3 SECTION 4, the live `## DESIGN`
  heading with three 120-200-word prose fields, and by DESIGN's status as one
  of the "six sections" locked in `VISION.md` and `ANCHOR.md` §4. This is
  covered by the stated precedence rule (WRITING_METHOD wins on structure), so
  it is a *resolved* contradiction, but `00_MASTER_WRITING_GUIDE.md` §4's
  "anatomy of a card" table and §5.4 are flatly wrong about the current card
  shape and nothing in `00_MASTER_WRITING_GUIDE.md` itself has been edited to
  say so, a reader of `00` alone, without also reading `WRITE.md`'s
  precedence section, would conclude DESIGN does not exist as a section at
  all.

### 4.4 Connections to other sections

- `WRITING_METHOD.md` §3 SECTION 4 "Don't": "name the partner *card* (the
  channel names the partner *gate*; the partner *card* belongs to RELATIONS)."
  This is the same internal/outward relating split as ICHING's moving lines:
  the channel's partner gate is internal relating and stays in DESIGN; the
  partner card as a card is outward relating and belongs only in RELATIONS.
  `WRITING_METHOD.md` §2 states this rule once, generally, for the whole card;
  DESIGN and ICHING are its two concrete applications.
- Card 1's live `channel` paragraph explicitly names the mechanism this way
  ("this one reaches toward the gate of contribution, and the two together
  form the channel of inspiration") without naming the partner card ("UL 8")
  by name or number, matching the rule.

---

## 5. BODY (physiology, amino acid)

### 5.1 What it is for

`VISION.md`: "The biological layer... The DNA codon, the codon ring as living
chemistry, where the code is seated in the physical body. The deepest *inward*
layer, written as a layer of the oracle, spoken poetically, never as a
biology explainer." `WRITING_METHOD.md` §3 SECTION 5: "The biological layer , 
the deepest inward point of the card... This section is new in VISION.md; it
had no prior guide." (This is the one section with no dedicated numbered guide
among `01`-`06`; it exists only in `WRITING_METHOD.md` and the deep-pass
addendum.)

### 5.2 Shape, length, voice, structure, must/must-not

`WRITING_METHOD.md` §3 SECTION 5 table:

| Field | Job | Length |
|---|---|---|
| `body.physiology` | Where the code is seated in the body, felt/poetic, not an anatomy lesson | ~150-250 words |
| `body.amino_acid` | The amino acid/codon the code answers to, and what it means to run this deep | ~120-200 words |

Do: "treat the body as the literal floor the other four systems were always
describing... let it land the card's inward journey." Don't: "explain
genetics or biochemistry as science; name the ring's siblings (that is
RELATIONS, BODY establishes the chemical seat, RELATIONS names the kin)."

The deep-pass addendum (`sections/_DEEP_PASS_ADDENDUM.md` §2.5) adds a rule
specific to BODY: "you don't reproduce [Rudd's] philosophy. You read him to
find the bodily anchor he names... and you carry his framing of the
shadow/gift movement at the body level." One real fact about the chemistry
"is enough to ground the poetry."

Confirmed against live card 1: `### Physiology` is 3 paragraphs (~250 words
by inspection) about the liver as "the body's hidden forge"; `### Amino acid`
is about Lysine, "one of the small group the body cannot make for itself,"
closing on "a creation that must be fed before it creates", matching the
poetic-not-clinical register the guide asks for.

### 5.3 Live authority / superseded / contradictions

- **LIVE:** `WRITING_METHOD.md` §3 SECTION 5, tightened by
  `sections/_DEEP_PASS_ADDENDUM.md` §4 to `physiology` 150-250 and
  `amino_acid` 120-200 (matches the base table exactly here, unlike ICHING's
  reading-length mismatch).
- No contradiction found between documents for this section specifically , 
  BODY is the newest section (`WRITING_METHOD.md` says so directly) and has
  no older, conflicting `01`-`06` counterpart to disagree with. This makes it
  the cleanest single-authority section in the whole set.
- The diversify passes (§6 below) found and fixed formulaic openings
  specifically in this section ("The body seats this code in..." on 30 of 64
  cards; "The chemistry of this code answers to..." on 57 of 64), confirming
  BODY was one of the two most formulaic sections before the diversify work
  (`sections/_DIVERSIFY_BRIEF.md` table; `sections/_DIVERSIFY_PASS_THREE.md`
  banning the stem "The body seats this code..." in any continuation after
  agents evaded the exact-phrase ban by swapping one preposition).

### 5.4 Connections to other sections

- Reads KEYS before writing, per the deep-pass addendum §1 (item 6): "The KEYS
  section for this card... read it so the body imagery sits coherent with the
  established Shadow/Gift/Siddhi voice." This is the single clearest,
  explicitly stated cross-section dependency in the whole corpus.
- Must not name ring siblings (`WRITING_METHOD.md` §3 SECTION 5 "Don't") , 
  that connection belongs only to RELATIONS's codon-ring field. BODY
  establishes the chemical seat (which ring, which amino acid); RELATIONS
  narrates the kinship built on that seat.
- Gap: nothing states whether BODY's "physiology" organ claim and DESIGN's
  "centre" (the Human Design energy-body location) are permitted or forbidden
  to overlap or reference each other, they are two different body-systems
  (DNA/biology vs. the Human Design body-graph) occupying similar territory
  on the card (both are "where in the body does this live"), and no document
  says how a writer should keep a reader from experiencing them as redundant.
  Live card 1 handles this by making DESIGN's centre a metaphysical "seat of
  identity" location and BODY's physiology a literal organ (liver), which
  avoids collision in practice, but this separation is never stated as a rule
  anywhere in the guides.

---

## 6. RELATIONS (Pair/Inverse, Programming partner, Codon ring, Tarot, Immortals, Deeper correlation)

### 6.1 What it is for

`06_CONNECTIONS_GUIDE.md` §1: "Relations is one of the card's voices... Its
register is relationship: this code does not stand alone; here is the family
it belongs to, and what it forms with its kin." `VISION.md`: "The doorway out.
How this code relates outward... The true final section." `WRITING_METHOD.md`
§3 SECTION 6: "The doorway out. Outward relating only... The card's true final
section. Tarot nests *inside* here."

### 6.2 Shape, length, voice, structure, must/must-not

`WRITING_METHOD.md` §3 SECTION 6 table (LIVE for field list/length):

| Field | Job | Length |
|---|---|---|
| `relations.paired_hexagram` | The I-Ching opposite, what the two form together | ~80-130 words |
| `relations.programming_partner` | The Gene Keys polar partner | ~80-130 words |
| `relations.codon_ring` | The ring family and siblings | ~80-130 words |
| `relations.tarot` | The ring's Tarot resonance; one element within RELATIONS | ~80-130 words |
| `relations.deeper_correlation` | Trigrams / Eight Immortals / Golden Dawn, nested optional depth | ~60-120 words per part |

Live card fields (confirmed against `oracle/cards/01.md` and `23.md`) actually
appear as: `### Pair`, `### Inverse` (card 1 only, since hexagram 1 is
self-inverse, "one of only eight in the deck that meets its own reflection"),
`### Programming partner`, `### Codon ring`, `### Tarot` (with a bulleted
sub-list: Ring Arcana, Mountain/Heaven upper-trigram Arcana, Earth/lower-
trigram Arcana), `### Immortals`, `### Deeper correlation` (Sky/zodiac,
Hebrew letter). This headed structure is not identical to WRITING_METHOD's
flat five-field JSON table, "Inverse" is its own heading in the live card but
is not a separate field in WRITING_METHOD's table (it appears only inside
`relations_data.inverse` frontmatter, and "Pair" vs. "Inverse" turn out to be
different relationships for most cards but identical for self-inverse
hexagrams like 1). Neither `WRITING_METHOD.md` nor `06_CONNECTIONS_GUIDE.md`
documents "Inverse" as its own prose subsection; it is present in the shipped
cards but undocumented in the guide set as a distinct written unit.

`06_CONNECTIONS_GUIDE.md` §2-§4 (LIVE for doctrine/craft, not superseded)
defines the three kinships precisely: **codon ring** = family (Gene Keys, 22
rings, "a family of codes bonded through a shared amino acid"), **channel** =
completion (Human Design, "a channel completes only when its partner gate is
also present", note: WRITING_METHOD's live card structure does not carry a
"channel partner *card*" field in RELATIONS the way §4 of
`06_CONNECTIONS_GUIDE.md` describes; the live cards show "Pair," "Programming
partner," and "Codon ring" but no distinct "channel partner card" heading , 
see contradiction note below), **programming partner** = polarity (Gene Keys
polar complement). §3 states the core principle: "teach the bond, hide the
machinery", never say "codon," "amino acid" by name, "stop codon," ring
index numbers, or HD mechanics (defined/undefined, type, authority) in the
prose. §3 also states "Name the card, not the number": always refer to a kin
card by its name, teaching what the bond means, never citing an index number
alone. Live card 1 confirms this fully: "This code shares its ring with one
other, UL 14, the abundance that follows fire's spark," never a bare
"[1, 14]."

**Tarot within RELATIONS** (`06_CONNECTIONS_GUIDE.md` §5): the Major Arcana
enters at the *ring* level as "a single evocative resonance... one image,
never explained or defended," explicitly "not standardized doctrine... authored,
not sourced." `WRITING_METHOD.md`'s live field additionally carries the
*trigram*-level Tarot correspondences (upper and lower trigram each keyed to
two Major Arcana cards) inside the same `### Tarot` heading, this is the
"deeper correlation" material from `CONCEPT.md` §9 folded into the main
RELATIONS Tarot paragraph rather than kept in the separately-named "Deeper
correlation" nested door. `06_CONNECTIONS_GUIDE.md` §7.3 explicitly frames the
Golden Dawn/trigram Tarot correspondences as belonging to "the deeper
correlation layer," implying they should sit in `relations.deeper_correlation`,
not in `relations.tarot`. The live cards put them in `### Tarot` instead
(with `### Deeper correlation` reserved for Sky/zodiac and Hebrew letter only)
,  a real, unflagged structural drift between the connections guide's stated
placement and the shipped placement.

**Doctrine vs. authored** (`06_CONNECTIONS_GUIDE.md` §6): ring membership,
channel pairings, and programming partners are treated as having "a right
answer" (verifiable against source material); the ring-to-Tarot assignment is
explicitly "not doctrine... authored by contemplation."

### 6.3 Live authority / superseded / contradictions

- **LIVE:** `06_CONNECTIONS_GUIDE.md` for doctrine, craft, and the "hide the
  machinery" rule; `WRITING_METHOD.md` §3 SECTION 6 for field names/lengths;
  neither document is marked superseded, and both are required by
  `oracle/WRITE.md`'s load table for this section (alongside
  `sections/relations/_BRIEF.md`, not directly read here).
- **Contradiction/drift, Tarot placement:** as detailed above, the
  connections guide's own internal logic places trigram-level Golden Dawn
  Tarot correspondences in the "deeper correlation" nested door (§7.3);
  the shipped cards place them directly inside the main `### Tarot`
  paragraph instead, alongside the ring Arcana, and reserve "Deeper
  correlation" for the Sky/zodiac + Hebrew-letter material only.
- **Contradiction/drift, "channel" as a RELATIONS element:**
  `06_CONNECTIONS_GUIDE.md` §2 and §4 describe the channel as one of the
  three kinships taught inside Relations ("Name the partner gate as one of
  the 64 cards. Name the channel."). But `WRITING_METHOD.md`'s own field
  table for RELATIONS (§3 SECTION 6) has no `relations.channel_partner`
  field, and the live cards have no `### Channel` heading inside `##
  RELATIONS` — the channel partner is instead taught entirely inside `##
  DESIGN`'s `### What completes it, the Channel of...` subsection (see §4.4
  above), which `WRITING_METHOD.md` §2 explicitly calls **internal**
  relating that must stay in DESIGN. So `06_CONNECTIONS_GUIDE.md`'s
  description of the channel as a RELATIONS-taught kinship is directly
  superseded by `WRITING_METHOD.md`'s internal/outward split, even though
  no supersession notice anywhere says so. A writer who read
  `06_CONNECTIONS_GUIDE.md` alone would try to write a channel-partner-card
  paragraph inside RELATIONS that the live schema has no field for and the
  live cards do not carry.
- The diversify passes (`_DIVERSIFY_BRIEF.md`, `_DIVERSIFY_PASS_THREE.md`,
  `_DIVERSIFY_PASS_FOUR.md`) found RELATIONS to be the second most formulaic
  section after BODY: "Across the genetic code this pairing runs..." on 45 of
  64 Programming-partner openings, "The Tarot meets this hexagram on two
  axes..." on 30 of 64 Tarot openings, its matching closing "...the whole
  motion of the card" on 36 of 64, and "Together they teach that..." on 35 of
  64 Immortals closings. All four were targeted for rewrite. **Directly
  observed in this survey:** the historical snapshot
  `oracle/manuscripts/23/relations.md` still contains all three of these
  now-banned formulas verbatim ("Across the genetic code, this pairing runs
  with UL 43..."; "The Tarot meets this hexagram on two axes..."; "Together
  they teach that what survives a stripping is held by one who keeps the old
  wisdom..."), while the live `oracle/cards/23.md` has all three corrected
  ("The DNA pairs this card with UL 43..."; "A grim spread, at first glance,
  and the glance is wrong..."; "A stripping takes only what is still gripped,
  which is why the memory riding backward survives it..."). This is
  first-hand confirmation that the manuscripts/ snapshot predates the
  diversify passes and the live cards/ file postdates them, see §8 file
  classification below.
- Seven specific "held together" phrases are recorded as deliberate,
  permanent keeps against future diversify sweeps (`_DIVERSIFY_PASS_FOUR.md`,
  "Decided keeps"), each with a named card, field, and reasoning (e.g. card 7
  Relations Inverse keeps "the gathering held together by trust" because
  Hexagram 8's own English name is Holding Together; card 8 keeps a phrase
  because it is the classical line text itself and changing it would
  misquote the source).

### 6.4 Connections to other sections

- RELATIONS is defined entirely in terms of what it must NOT repeat from
  every other section: `WRITING_METHOD.md` §2 states the strict rule once for
  the whole card ("internal relating is never repeated in RELATIONS;
  RELATIONS never re-teaches a system") and RELATIONS's own checklist
  (`06_CONNECTIONS_GUIDE.md` §9) restates it: "No machinery... nothing the
  reader must decode," and (`WRITING_METHOD.md` §3 SECTION 6 checklist item)
  "no internal relating repeated."
- RELATIONS is explicitly the section other sections point outward to but
  never explain themselves: ICHING's moving lines "become" other hexagrams
  (internal, stays in ICHING) but the *paired* hexagram as a whole card is
  RELATIONS's job; DESIGN's channel names its partner *gate* (internal, stays
  in DESIGN) but the partner *card* by name is RELATIONS's job (see §4.4);
  BODY establishes the ring/amino-acid seat but RELATIONS names the ring's
  siblings (see §5.4); KEYS's Shadow/Gift/Siddhi arc stays internal, but the
  *programming partner* code is RELATIONS's job.
- `06_CONNECTIONS_GUIDE.md` §8 references a whole-system "map" (a
  network-level view of all 64 cards and all three kinships) as a separate,
  still-unbuilt design artifact: "The map is a design artifact, specified
  separately, not governed by this writing guide." `CONCEPT.md` §8 makes the
  same point. Neither document says where that map's own writing spec, if any,
  will live, a genuine open gap, not just an unbuilt feature.

---

## 5-and-6-adjacent: the closing summary of Step D lens validation

`reading-rewrite.md` Step D is the only place in the entire corpus that
states an explicit cross-section consistency TEST (not just a rule): the
lens-validation pass, run after writing CODE, asking whether someone who
knows only I Ching, only Gene Keys, only HD, or only Tarot would each
recognize the reading as theirs, and confirming no phrase is duplicated from
KEYS or ICHING. No equivalent named test exists for consistency among ICHING,
KEYS, DESIGN, BODY, and RELATIONS themselves, those five rely entirely on
the internal/outward relating rule (§2/§4/§5/§6 above) rather than a positive
cross-check.

---

## 7. Voice rules that apply to every section (house rules)

Collected from `00_MASTER_WRITING_GUIDE.md` §7, `WRITING_METHOD.md` §0 and
§1.5, `sections/_TEMPLATE_01_CODE_N.md` §1-2, and `oracle/WRITE.md`'s
"non-negotiable rules" digest (all four documents restate the same rules
independently, which is itself notable, see gap analysis below):

- **No em dash, anywhere on a card, ever.** Stated in every single document
  surveyed. `oracle/INDEX.md` carries the one documented exception: em dashes
  inside card **headings** are "STRUCTURAL DELIMITERS the parser splits on,"
  e.g. `### The drive — Gate 24`, and must never be removed, this is the
  opposite of the ban and applies only to headings, never to prose. Confirmed
  live: every `###` subheading in cards 1 and 23 uses an em dash as the
  label/lens separator (e.g. "### The drive, Gate 1, Self-Expression"), while
  zero em dashes appear inside any paragraph of prose in either card.
- **No italics, no underscore emphasis, anywhere a reader meets the text**
  (`oracle/INDEX.md` "Two house rules"; also repeated in the diversify briefs
  as "no underscore emphasis markers"). Markdown emphasis markers
  (`**bold**`, `*italic*`) are explicitly banned from the data layer too , 
  `WRITING_METHOD.md` §5: "Markdown markers... do not belong in JSON string
  values, emphasis is the card renderer's job, not the data's." Note: the
  live Markdown cards DO use `_italic-style underscores_` for the small
  "Keywords:" line and the section-opening epigraph under RELATIONS (e.g.
  `_Keywords:_ Freshness · Inner Fire...` and `_Met by UL 2, this is..._` in
  card 1), these render as italic emphasis in Markdown. This appears to be a
  live, unexamined tension with the "no italics... in anything a reader
  meets" rule, unless the card renderer strips or restyles these specific
  fixed-label lines differently from body prose; none of the surveyed
  documents addresses this specific markdown usage.
- **No adjective triads** (`00_MASTER_WRITING_GUIDE.md` §7): "Lost, unmoored,
  wandering" becomes one precise word.
- **"It is not X, it is Y" once per card maximum** (`00_MASTER_WRITING_GUIDE.md`
  §7; `01_DESCRIPTION_SPEC.md` §3 assigns its one sanctioned use to the KEYS
  Gift-paragraph hinge specifically).
- **Vary sentence and line length hard; fragments allowed** (`00
  _MASTER_WRITING_GUIDE.md` §7; reinforced as the "no symmetry" cut in
  `WRITING_METHOD.md` §1.5 and `sections/_TEMPLATE_01_CODE_N.md` §2).
- **Ground the abstract**: name who feels it, when, doing what, not "a
  feeling of X" (`00_MASTER_WRITING_GUIDE.md` §7).
- **Trust the image; never explain a metaphor after using it**
  (`00_MASTER_WRITING_GUIDE.md` §7).
- **Plain words over spiritual vocabulary**, salt-and-pepper: "light, soul,
  fire, presence, sacred, holy, divine, awakening" are "not banned... weighted,"
  one or two per whole card at most (`sections/_TEMPLATE_01_CODE_N.md` §1;
  `00_MASTER_WRITING_GUIDE.md` §7 calls the same words "rare, and only when
  nothing plainer will carry it").
- **No source naming, ever**, no Wilhelm, Rudd, Eranos, the Practical Guide,
  or any teacher/book title named in card prose (`00_MASTER_WRITING_GUIDE.md`
  §6; restated per-section throughout `03`, `04`, `06`, and the deep-pass
  addendum's banned-openers list).
- **Read it aloud; if it clangs or the body does not shift, rewrite**
  (`00_MASTER_WRITING_GUIDE.md` §7; repeated as a checklist item in every
  numbered guide and in `oracle/WRITE.md`'s workflow §5-6).
- **The four "reads-as-human" cuts**, the newest and most operationalized
  layer (`WRITING_METHOD.md` §1.5, repeated verbatim in
  `sections/_TEMPLATE_01_CODE_N.md` §2): (1) no symmetry, cut balanced pairs,
  tidy triads, even-length paragraphs; (2) no summary sentence, cut the line
  that steps back and explains what the paragraph meant; (3) plain vocabulary
  by default, "profound, journey, embrace, navigate, essence, transformative"
  named as defaults to avoid; (4) end a beat early, no neat bow. A named
  exception: "a useful texture, not a tell... the lopsided, slightly clumsy
  human rhythm" (a doubled "and," a fragment, a rough landing) must be kept,
  not smoothed away.
- **Lived particularity over category** (`00_MASTER_WRITING_GUIDE.md` §7):
  write from a real instance, then generalize, never the reverse; distrust the
  fluent first draft.
- **No inherited templates** (`oracle/VISION.md`; DESIGN's "Gate N is the Gate
  of..." named as the concrete example): across 64 cards, any fixed opening
  frame becomes "the AI-symmetry tell." This graduated into the mechanical
  "ban the stem, not the phrase" rule (`sections/_DIVERSIFY_PASS_THREE.md`)
  after agents were found evading exact-phrase bans by swapping one word
  ("seats this code IN the chest" → "AT the chest").
- **The Stranger Test**, keywords only (`05_KEYWORDS_GUIDE.md` §3b), the one
  place a "principle stated but not operational" was explicitly hardened into
  a pass/fail mechanical test, and `oracle/WRITE.md`'s "THE SELF-CORRECTION
  RULE" names this as the template for how every other repeatedly-violated
  rule should eventually be hardened.
- **Copyright two-tier rule** (`CONCEPT.md` §11): poetic/transmission layers
  (name, keywords, invocation, descriptions) never name a source; teaching/
  structural layers (Relations, an "about the systems" page) may name
  lineages by name, with respect, because "a teaching deck that hides where
  its knowledge comes from is not protecting a copyright, it is obscuring a
  lineage." This is a genuinely different rule from the flat "never name a
  source" heard elsewhere and is easy to miss, `00_MASTER_WRITING_GUIDE.md`
  §6 states the flat version ("NEVER, name a source in the writing") without
  this two-tier nuance, and the flat version is what most of the other guides
  quote. Only `CONCEPT.md` §11 and `06_CONNECTIONS_GUIDE.md`'s framing of
  Relations as a place where "lineages are named" reflect the fuller two-tier
  picture; a writer reading only `00_MASTER_WRITING_GUIDE.md` §6 or
  `oracle/WRITE.md`'s digest would conclude no lineage may ever be named
  anywhere, which is stricter than `CONCEPT.md` actually intends.

---

## 8. What the spec system is missing, where it contradicts itself, and where it no longer matches the shipped card shape

1. **The reading spec and the shipped readings disagree, by design, right
   now.** Section 1 above is the single biggest live gap: the authoritative
   document for the CODE reading (`reading-rewrite.md`) explicitly forbids the
   shape both surveyed live cards (`01.md`, `23.md`) actually use, and the
   plan's own latest update (2026-09-02) redirects the fix into a not-yet-built
   WordForge workflow rather than a markdown pass. Every card's CODE section
   is `status: scaffold` and is known, in the spec's own words, to be wrong in
   its current form.

2. **`00_MASTER_WRITING_GUIDE.md` describes a different card shape than the
   one that shipped.** Its §4 "anatomy of a card" table lists five parts
   (card name, keywords, I-Ching section, description, invocation) with no
   DESIGN, no BODY, and no RELATIONS as prose sections; §5.4 explicitly says
   Human Design and Tarot "are not written-out sections... do not need their
   own guide." The live deck has six full sections including two full prose
   sections (DESIGN, BODY) that `00` denies exist. This is resolved by the
   stated precedence rule but `00_MASTER_WRITING_GUIDE.md`'s own text has
   never been edited to reflect it, `ANCHOR.md` §3 flags this generally
   ("Older guide set (00-06, SCHEMA.md), predates the six-section structure
   and the locked method... Light reconciliation outstanding") but that
   reconciliation still has not happened as of the files read in this survey.

3. **The 00-06 guide set's own numbering implies a document that was never
   written.** `00_MASTER_WRITING_GUIDE.md` §12 lists `06_CONNECTIONS_GUIDE.md`
   as "(To be written.)" inside CONCEPT.md's own document-set list
   (`CONCEPT.md` §12), but `06_CONNECTIONS_GUIDE.md` demonstrably exists and
   is substantial (1,946 words). This is a stale forward-reference inside
   CONCEPT.md that was never updated once `06` was actually written.

4. **KEYS has two incompatible length specs and nobody reconciles them.** See
   §3.3: `01_DESCRIPTION_SPEC.md`'s ~230-word total vs.
   `WRITING_METHOD.md`'s ~600-word total for the same five fields. Both
   documents are named in `oracle/WRITE.md`'s own load-order table as
   required reading for this section, with no note that one supersedes the
   other's numbers specifically (only the general precedence rule, which a
   writer would have to apply themselves, field by field, to notice this).

5. **RELATIONS's "channel" kinship is described in one document and absent
   from the live schema.** `06_CONNECTIONS_GUIDE.md` §2 and §4 teach the
   channel as one of RELATIONS's three kinships; `WRITING_METHOD.md`'s field
   table and the live cards have no such field, having moved it entirely
   into DESIGN as internal relating. No supersession notice anywhere flags
   this specific disagreement, unlike the CODE reading's very visible banner.

6. **The Tarot "deeper correlation" placement has drifted from doctrine.**
   `06_CONNECTIONS_GUIDE.md` §7.3 says trigram-level Golden Dawn/Tarot
   correspondences belong in the nested "deeper correlation" door; the live
   cards fold them into the main `### Tarot` paragraph instead. See §6.3.

7. **A significant, wholly undocumented file layer exists: `oracle/manuscripts/`
   and `oracle/editorial/`.** This survey found, and directly compared,
   `oracle/manuscripts/23/{_card,code,iching,keys,design,body,relations}.md`
   (a per-lens-file-per-card layout) and `oracle/editorial/23/*.md`
   ("migration-receipt" sourcing-log files, schema
   `oracle-migration-receipt/v1`). Neither directory, nor either schema name,
   is mentioned anywhere in any of the sixteen specification documents this
   survey read, including `oracle/WRITE.md`'s own "WHERE THINGS ARE WRITTEN"
   section, which describes only the legacy `oracle/sections/<lens>/NN.json`
   overlay paths (explicitly called "legacy JSON overlay paths, being
   phased out") and the single-file target `oracle/cards/NN.md`. A search of
   every surveyed document for the strings "manuscripts/" and "editorial/"
   confirms this: zero hits for "manuscripts/" and the one hit for
   "editorial/" (`oracle/PARSER_SPEC.md`, not in the required reading list)
   refers to "editorial/source notes" as a concept, not to the directory. The
   practical effect: an agent following `oracle/WRITE.md`'s documented
   load-order and output-path instructions to the letter would never find,
   write to, or reconcile against `oracle/manuscripts/` or
   `oracle/editorial/`, yet both directories exist, contain real per-card
   content for card 23, and (per the RELATIONS diversify-formula comparison
   in §6.3) demonstrably predate the live `oracle/cards/23.md` file. This
   looks like the residue of a migration tool run (the schema name says so
   directly: "oracle-migration-receipt") that has no accompanying spec
   document describing what it is, whether it is still produced, or whether
   it should ever be read again.

8. **The "UL N" vs. "Code N" naming split is live and unresolved.**
   `VISION.md` and `ANCHOR.md` §4 both say "UL N" is the fixed name
   "everywhere... never 'Code N'." But `sections/_TEMPLATE_01_CODE_N.md`
   itself is titled and structured entirely around "Code N" (its own JSON
   shape example in §6 uses `code.card_name` etc., with a footnote: "the
   rename to `code.*` is part of the global 'UL N → Code N' follow-up, not
   this template's job"). The live cards split the difference in a way no
   document actually specifies: the card's top-level title heading keeps "UL"
   (`# UL 1 — Earth's Breath`), while the first section's own heading uses
   "CODE" (`## CODE`), not "## UL 1" as `VISION.md`'s own nav-bar table says
   it should be (`VISION.md`: "The bar: `UL 1 · ICHING · KEYS · DESIGN · BODY
   · RELATIONS`"). This is a live, unflagged inconsistency in the shipped
   product's own heading scheme, not just a documentation disagreement.

9. **Frontmatter key-naming has minor unflagged drift.** `oracle/PARSER_SPEC.md`
   (not required reading, checked only to resolve a discrepancy) and the live
   card 01/23 frontmatter both use `relations_data:` as the structural key
   (with `## RELATIONS` carrying the prose). The historical
   `oracle/manuscripts/23/_card.md` snapshot instead used a bare `relations:`
   key for the same data. No spec document states which key name is
   canonical; it can only be inferred by cross-referencing the parser spec
   against the live files, neither of which was on this survey's required
   list, meaning a writer following only the required-reading list would not
   know this key had a name at all, let alone which one is correct.

10. **The distillation-sheet / one-breath-truth duplication is unresolved
    (also noted in §1.4).** `00_MASTER_WRITING_GUIDE.md` §8 step 1 wants one
    one-breath-truth per card, used everywhere. `reading-rewrite.md` Step A
    computes its own "one-breath truth" specifically for the CODE reading,
    with its own ratification gate, and never says whether it must equal or
    may diverge from the master guide's card-wide version.

11. **No document defines a positive cross-check between ICHING, KEYS,
    DESIGN, BODY, and RELATIONS** the way `reading-rewrite.md` Step D defines
    one for CODE. The whole system relies on the internal/outward relating
    split (a subtraction rule: don't repeat what belongs elsewhere) rather
    than any check that the five teaching sections actually agree with each
    other's account of the "one energy." `00_MASTER_WRITING_GUIDE.md` §5.3
    ("Finding the one energy when the lineages diverge") is the closest thing
    to this, but it is framed as an authoring procedure for finding a single
    one-breath truth, not as a post-hoc consistency check across the five
    written sections the way Step D is for CODE.

12. **Card status is tracked per-lens on the live cards (`status: {code:
    scaffold, iching: scaffold, ...}`) but the guides only ever describe a
    single card-level status.** `00_MASTER_WRITING_GUIDE.md` §10 defines
    exactly three values (`scaffold` / `in-progress` / `final`) as a property
    of "every card," singular, and `oracle/INDEX.md`'s table of the 64
    manuscripts likewise says "the editorial status of every lens" is
    recorded in frontmatter without ever specifying that status is a per-lens
    map rather than one card-wide field. The live schema (confirmed in both
    `01.md` and `23.md`) makes status a six-key object, one key per section.
    This is a reasonable, probably correct evolution, but no document
    actually specifies the six-key shape; it can only be learned by reading
    the live files directly.

13. **Italics/underscore usage in fixed-label lines vs. the "no italics
    anywhere a reader meets" rule.** See §7 above, an apparent unexamined
    tension between `oracle/INDEX.md`'s house rule and the live cards' own
    use of underscore-emphasis for the Keywords line and RELATIONS epigraph.

---

## 9. Every file read, with a one-line live/superseded/historical/unclear call

- `oracle/INDEX.md`, **LIVE.** The front door; explicitly states its own
  supersession-gate function and is internally up to date about which other
  documents are superseded.
- `oracle/CONCEPT.md`, **LIVE.** Explicitly the senior document ("when a
  guide and this document seem to disagree, this document is the intent");
  not superseded anywhere, though its own §12 document list is stale (still
  marks `06_CONNECTIONS_GUIDE.md` "to be written" after it was written).
- `oracle/00_MASTER_WRITING_GUIDE.md`, **LIVE on voice/copyright/terms/
  status/two-phase framing; SUPERSEDED on card anatomy/structure** (§4, §5.4)
  by `WRITING_METHOD.md`, per `oracle/WRITE.md`'s explicit precedence rule,
  though `00` itself carries no supersession banner saying so.
- `oracle/01_DESCRIPTION_SPEC.md`, **LIVE on the KEYS arc doctrine and
  copyright/voice; SUPERSEDED/stale on length figures and the
  repressed-reactive-as-one-paragraph structure**, silently, by
  `WRITING_METHOD.md` §3 SECTION 3.
- `oracle/02_INVOCATION_GUIDE.md`, **LIVE.** Explicitly named as still
  governing in `sections/_TEMPLATE_01_CODE_N.md`'s own supersession notice
  ("§4.4 (invocation)... still hold").
- `oracle/03_ICHING_GUIDE.md`, **LIVE on doctrine (why layer, why not
  modernize) and the classic-text sourcing discipline; its own three-layer
  naming scheme (Intro/Classic/Interpretation) is superseded in practice** by
  `WRITING_METHOD.md`'s field names (combination/reading/judgement/image),
  again with no cross-reference reconciling the two namings.
- `oracle/04_TRANSLATION_METHOD.md`, **LIVE.** Its own text states the
  translation method is the finished process, not subject to the normal
  two-phase supersession; still cited as required reading in
  `oracle/WRITE.md`'s load table.
- `oracle/05_KEYWORDS_GUIDE.md`, **LIVE.** Explicitly the "real keyword
  rulebook" per `oracle/WRITE.md`'s precedence rule; contains the most
  recently hardened rule in the whole corpus (the Stranger Test, 2026-06-09).
- `oracle/06_CONNECTIONS_GUIDE.md`, **LIVE on doctrine, craft, and the
  hide-the-machinery rule; partially superseded/drifted on specific
  placement decisions** (the channel-as-RELATIONS-kinship claim, and the
  Tarot deeper-correlation placement), see §6.3, §8 items 5-6. No
  supersession banner exists for either drift.
- `oracle/WRITING_METHOD.md`, **LIVE on structure/length/field shape for
  every section except the CODE reading's shape, which is explicitly
  SUPERSEDED** (§1.4b, §3 SECTION 1) by `todo/plans/reading-rewrite.md`, per
  its own banner.
- `oracle/WRITE.md`, **LIVE.** The enforced loader/manifest; the single most
  self-aware document in the set about the precedence problem, though its own
  "WHERE THINGS ARE WRITTEN" section is incomplete (does not mention
  `oracle/manuscripts/` or `oracle/editorial/`, which exist and hold real
  content, see §8 item 7).
- `oracle/sections/_TEMPLATE_01_CODE_N.md`, **DRAFT, partially superseded.**
  Explicitly labeled "Status: DRAFT v1, for review and rewrite together,"
  never finalized; §4.3 (the reading) is explicitly superseded; §4.1
  (card name), §4.2 (keywords), §4.4 (invocation) and its voice rules (§1-2)
  are explicitly still live per its own banner.
- `oracle/sections/_DEEP_PASS_ADDENDUM.md`, **LIVE**, for the ICHING/BODY
  deep-pass standard specifically; not superseded, but has one internal
  length-figure mismatch against `WRITING_METHOD.md`'s own table for
  `iching.reading` (see §2.3).
- `oracle/sections/_DIVERSIFY_BRIEF.md`, **HISTORICAL (completed pass one).**
  A dated, closed work order ("Measured, 2026-09-01") whose findings were
  superseded by passes three and four's stricter stem-ban method; useful now
  only as a record of what was originally wrong and why phrase-banning alone
  failed.
- `oracle/sections/_DIVERSIFY_PASS_THREE.md`, **HISTORICAL (completed pass
  two of three).** Superseded in scope by pass four's broader closings sweep,
  though its stem-ban method (test: "would this sentence work unchanged on
  another card?") is the standing test still worth applying, and is quoted
  as such by pass four itself.
- `oracle/sections/_DIVERSIFY_PASS_FOUR.md`, **LIVE as the most current
  record of decided exceptions** ("Decided keeps. Do not 'fix' these," with
  seven named, reasoned, permanent exceptions) and the most current
  statement of the "correctly repeating, never diversify" principle for
  trigram/Immortal/ring reference material; otherwise historical (a closed,
  dated work order like the other two diversify passes).
- `todo/plans/reading-rewrite.md`, **LIVE and current-front**, but
  explicitly **not yet executed**: its own status line reads "Status:
  planned, waiting for Adrian to be home. Do not start writing cards until
  the pilot gate (step 3) passes," and its most recent update (2026-09-02)
  redirects execution into WordForge rather than a markdown batch pass. This
  is the single most authoritative and simultaneously least-implemented
  document in the set.
- `oracle/VISION.md`, **LIVE on intent and the six-section structure;**
  superseded only on the single "2-3 clusters... decided/locked" claim about
  the reading, per its own cross-reference to `ANCHOR.md`'s banner (though
  the note actually lives in `ANCHOR.md`, not in VISION.md itself, VISION.md
  has no banner of its own).
- `oracle/ANCHOR.md`, **LIVE as a situational/historical record, explicitly
  dated "Last revised: 2026-05-22."** Carries its own supersession banner at
  the top (the "2-3 clusters" claim). Its Stage A-F roadmap and per-section
  status table describe a point in time well before the six sections were
  fully written out for even card 1 in Markdown form, so its file-location
  claims (e.g. "oracle/generated/01.json" as the invocation source,
  "oracle/sections/keys/01.json...64.json" as where KEYS lives) are stale
  against the now-consolidated `oracle/cards/NN.md` single-file shape
  described as current in `oracle/WRITE.md`. Best read as a dated snapshot,
  not a live pointer to where things are.
- `oracle/editorial/23/*.md` (BODY, CARD, CODE, DESIGN, ICHING, KEYS,
  RELATIONS), **HISTORICAL and UNDOCUMENTED.** Not superseded by name
  because no live spec document ever names this directory at all (see §8
  item 7); each file is a "migration receipt" reproducing a legacy
  `meta.sourcing_log`/`meta.fact_check` blob for one lens of card 23. Appears
  to be tooling output from a one-time migration, not an authored spec or an
  authored card artifact.
- `oracle/manuscripts/23/*.md` (_card, body, code, design, iching, keys,
  relations), **HISTORICAL, predates the live `oracle/cards/23.md`.**
  Directly confirmed in this survey: its RELATIONS content still contains
  three phrases the diversify passes later banned and fixed in the live
  card (see §6.3). Likely an intermediate per-lens-file snapshot from before
  the "one Markdown file per card" consolidation that `oracle/WRITE.md`
  describes as the current standing rule (2026-06-09). Not documented in any
  spec file.
- `oracle/cards/01.md`, **LIVE**, the actual current shipped artifact for
  card 1; used throughout this report as ground truth for what the six-
  section shape, frontmatter shape, and status shape actually look like
  today. Its own `## CODE` reading is, per §1.3 above, written to the
  superseded pre-rewrite shape and awaits the (paused) reading-rewrite pass.

---

## 10. One-paragraph orientation for a future writer

Read `oracle/INDEX.md` first; it is accurate about the gate and about which
documents are superseded, and its four-document read order is the fastest
correct path in. Trust `WRITING_METHOD.md` for the shape and length of every
field except the CODE reading. Trust `todo/plans/reading-rewrite.md` +
`CONCEPT.md` §4 for the CODE reading's shape, and know that no card currently
on disk actually follows it yet, by design, because Adrian chose to move that
rewrite into WordForge rather than a batch pass. Trust `00`, `05`, and `06`
for voice, copyright, keywords, and Relations craft, but do not trust `00`'s
own description of what sections exist, and do not trust `06`'s claim that
the channel lives in RELATIONS (it lives in DESIGN). Never read
`oracle/manuscripts/` or `oracle/editorial/` as current guidance; they are
undocumented historical residue, at least one full diversify-pass behind the
files in `oracle/cards/`, which is the only place a card's live prose
actually lives.
