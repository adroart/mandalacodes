# WRITE.md — the enforced loader for all oracle card writing

> **This is the single entry point for writing or revising ANY card text.**
> Adrian points here. You (the agent) load from here. Nothing about the writing
> voice lives in this file — it is the *manifest* that guarantees every rule
> file is loaded, in the right order, with the right precedence, before a word
> is written. The rules stay in their own files; this file makes sure they all
> arrive.
>
> Why this exists: the guideline docs do NOT auto-load. Across a session an
> agent opens whichever files it happens to find, writes against a subset, and
> Adrian has to catch what was missed. This file ends that. One pointer, one
> load order, one gate.
>
> Companion file: `GAMEPLAN.md` (where the work stands / resume point). WRITE.md
> is *how to write*; GAMEPLAN.md is *where we are*. Two files, two jobs.

---

## THE GATE (read first, obey before writing)

**You may not draft, revise, or finalize any card field until you have read
every file in the Load Order below and confirmed each one back to Adrian by
name.** If you have not read them this session, STOP and read them now. Writing
card text from a subset of the notes is the exact failure this file prevents.

When you finish loading, say: "Loaded: [list every file]. Precedence: WRITING_METHOD
wins on structure; 00 + 05 + 06 win on voice/copyright/keywords/relations.
Ready to write [section] of Card [N]." Only then write.

---

## THE PRECEDENCE RULE (two doctrine sets exist — do not confuse them)

There are TWO layers of doctrine, and they do not fully agree. This is the thing
that keeps causing drift. Hold both:

1. **The SIX-SECTION method (newer, canonical on structure).**
   `WRITING_METHOD.md` + `sections/_TEMPLATE_01_CODE_N.md` + `sections/_DEEP_PASS_ADDENDUM.md`.
   These define the card as six sections (`UL N · ICHING · KEYS · DESIGN · BODY
   · RELATIONS`), the field-by-field spec, the §1.5 "reads-as-human" cuts, the
   2–3 cluster reading, the deep-pass standard. **Where these conflict with the
   older 00–06 set on STRUCTURE or FIELD SHAPE, these win** (WRITING_METHOD §0).

2. **The 00–06 guide set (older, still canonical on voice + copyright + the
   per-layer craft).** `00_MASTER_WRITING_GUIDE.md` holds the shared spine the
   newer docs do NOT repeat and explicitly inherit: the two-phase frame (§1),
   the fixed terms (§3), card coherence (§5), the copyright line (§6), the
   shared voice rules (§7), and card status (§10). `05_KEYWORDS_GUIDE.md` is the
   real keyword rulebook. `06_CONNECTIONS_GUIDE.md` governs Relations voice.
   `01`–`04` govern the older Glance+voices craft and still carry worked
   examples and the translation method. **These win on VOICE, COPYRIGHT,
   KEYWORDS, RELATIONS, and STATUS.**

Plain version: **WRITING_METHOD tells you the SHAPE of each section; 00/05/06
tell you the VOICE and the rules.** Load both. When unsure which governs a
given call: structure/field/length → WRITING_METHOD; voice/copyright/keyword/
status → 00 + 05.

---

## LOAD ORDER (read top to bottom, every writing session)

### Always — the spine (read all of these before any section)
1. `VISION.md` — what the deck is for; the six-section intent; the
   non-negotiables of the writing (human, no inherited templates).
2. `00_MASTER_WRITING_GUIDE.md` — **the voice + copyright + terms + status
   spine.** §3 terms, §5 coherence, §6 copyright, §7 voice rules, §8 workflow,
   §10 status. The most-cited rules live here.
3. `WRITING_METHOD.md` — the canonical six-section method + the §1.5
   reads-as-human cuts + the locked UL 1 worked samples.
4. `sections/_TEMPLATE_01_CODE_N.md` — Section 1 field spec, voice §1–2, the
   per-field variant method, the checklist.
5. `sections/_DEEP_PASS_ADDENDUM.md` — the deep-pass standard for ICHING + BODY
   (carry philology inside the teaching, no bare Mandarin, carry the myth
   figures, per-line imagery from the line files).

### Then — the section you are writing (load its specific rulebook)
| Writing this section | Load these (in addition to the spine) |
|---|---|
| **UL N / opening face** | `sections/_TEMPLATE_01_CODE_N.md` (already in spine), `05_KEYWORDS_GUIDE.md` (keywords), `02_INVOCATION_GUIDE.md` (invocation, if writing it) |
| **ICHING** | `03_ICHING_GUIDE.md`, `04_TRANSLATION_METHOD.md`, `sections/iching/_BRIEF.md`, `sections/_DEEP_PASS_ADDENDUM.md` |
| **KEYS (Gene Keys)** | `01_DESCRIPTION_SPEC.md`, `sections/keys/_BRIEF.md`, `sections/keys/_TRIM_BRIEF.md`, `sections/keys/_DIVERSIFY_BRIEF.md` |
| **DESIGN (Human Design)** | `sections/design/_BRIEF.md`, `sections/design/_BRIDGE_REWRITE_BRIEF.md`, `sections/design/_DIVERSIFY_BRIEF.md` |
| **BODY** | `sections/body/_BRIEF.md`, `sections/_DEEP_PASS_ADDENDUM.md` |
| **RELATIONS** | `06_CONNECTIONS_GUIDE.md`, `sections/relations/_BRIEF.md` |
| **Keywords** (any time) | `05_KEYWORDS_GUIDE.md` |

### Then — the source for the specific card
Read the vault folder `~/Documents/Obsidian Vault/oracle/hexagrams/NN/` to
completion per `_DEEP_PASS_ADDENDUM.md` §1. The vault is the ONLY source. Never
invent, never write from memory, never present remembered text as quoted.
Richest files: `oracle-NN-<slug>.md` (Eranos philology), `gene-key-NN.md`,
`gk-64ways-NN-<slug>.md`, `_hexagram-NN.md` (index/facts), `practical-NN-<slug>.md`,
the six `line-NN-N.md`.

---

## THE NON-NEGOTIABLE RULES (the short list — full versions in the files above)

These are quoted here as a fast check, NOT as a replacement for reading the
files. If any of these is unclear, the source file governs.

**Voice (00 §7):**
- No em dashes anywhere on a card. No `--`.
- No adjective triads. One precise word.
- "It is not X, it is Y" — once per card maximum.
- Vary sentence/line length hard. Fragments allowed.
- Ground the abstract: who feels it, when, doing what — not "a feeling of X".
- Trust the image; do not explain a metaphor after using it.
- Plain words over spiritual vocabulary (light/energy/divine/sacred are
  salt-and-pepper: one or two per card, never sprinkled).
- Read it aloud; if it clangs or your body does not shift, rewrite.

**Reads-as-human, the four cuts (WRITING_METHOD §1.5 / TEMPLATE §2):**
1. No symmetry — cut balanced pairs, tidy triads, even-length paragraphs.
2. No summary sentence — cut the line that steps back and explains the paragraph.
3. Plain vocabulary by default — profound/journey/embrace/navigate/essence/
   transformative are defaults to avoid.
4. End a beat early — no neat bow, no resolving flourish.
- Keep the lopsided human texture (a doubled "and", a fragment, a rough landing).
  Do not smooth it into elegance.

**Lived particularity (00 §7):** write from a real instance, then generalize —
never the reverse. Distrust the fluent first draft; if a passage came easily
and sounds finished, find the one concrete unexpected detail or cut it.

**Copyright (00 §6):** KEEP the system names + architectures. CUT borrowed prose
and unverifiable mappings. NEVER name a source (no Wilhelm/Rudd/Eranos/Practical
in card prose). Observation, not definition.

**Keywords (05):** 5–7, plain, no decoding, no jargon, no system vocabulary.
One test only: does it hold the **energy** of the card. Keywords name the
energy/gift, **never the shadow** (Adrian's rule, 2026-06-09: a shadow-word like
"Crooked Beginning" or "Chaos" is not a keyword). Triangulate the code from
varied angles; not 5–7 synonyms. Provenance does not matter; no per-system quota.

**Terms (00 §3) — per-section word check (run before finalizing any section):**
"Code" = the unified cross-lineage energy. "Hexagram" = I-Ching only. "Gate" =
literal HD gate only. "Shadow/Gift/Siddhi" = Gene Keys only. "Arcana" = Tarot
only. Avoid "key" as a general word.
- **Inside the ICHING section, the thing is a "hexagram," never a "code."**
  ("The situation this hexagram names…", not "this code names".) Grep each
  section's prose for the wrong term before marking final: ICHING must not say
  "code"; DESIGN says "gate/centre/channel" only as the bridge rule allows;
  KEYS owns "Shadow/Gift/Siddhi". "Code" belongs to Section 1 (the synthesis
  face) and RELATIONS kin-links ("UL N"), not inside a single lineage's section.
  (Adrian's rule, 2026-06-09 — caught "this code names" in card 3 ICHING.)

**No inherited templates (VISION):** never open every entry with a fixed frame
("Gate N is the Gate of…", "This is the code of…"). Across 64 cards a fixed
opening becomes the AI-symmetry tell.

**Status (00 §10):** `scaffold` = AI Phase 1. `final` = Adrian personally wrote/
reworked it. Status is internal, never reader-facing. Set it on every file.

---

## THE SELF-CORRECTION RULE (harden repeated failures into tests)

When a rule is violated more than once in a session — you wrote something, Adrian
corrected it, you wrote a near-identical miss again — the rule is stated but not
*operational*. Do not just fix the instance. **Harden the rule into a mechanical
pass/fail test in its source file**, with concrete auto-fail examples drawn from
what just failed, so the next session (or a fresh chat) inherits the testable
version, not the principle that already proved too soft to hold.

First instance of this: the keyword "plain language" rule kept slipping until it
became the **Stranger Test** in `05_KEYWORDS_GUIDE.md` §3b (2026-06-09). That is
the pattern. Any rule that fails twice gets the same treatment: a check you run
BEFORE showing Adrian, not a principle you hope to remember.

This is what makes the writing system get smarter over time instead of repeating
the same corrections every card.

---

## BATCH-AGENT HARDENING (read if you are a workflow agent writing one card)

A single agent writing one card/section alone, with no human beside it, must not
drift. These five rules close the gaps that multiply by 64. Obey all five.

1. **GLOB the vault files, never hardcode a slug.** Filenames vary per card
   (`oracle-03-sprouting.md`, `oracle-22-adorning.md`). To read a card's source,
   glob the PATTERN, not a guessed name:
   - Eranos: `hexagrams/NN/oracle-NN-*.md`
   - Gene Key full: `hexagrams/NN/gene-key-NN.md` (no slug); short ref:
     `hexagrams/NN/gene-key-NN-*.md`
   - 64-Ways: `hexagrams/NN/gk-64ways-NN-*.md`
   - Practical: `hexagrams/NN/practical-NN-*.md`
   - HD gate: `hexagrams/NN/qw-gate-NN-*.md`
   - Tarot: `hexagrams/NN/tarot-*.md` (group by their `i_ching_trigram:` field)
   - Index (always exact): `hexagrams/NN/_hexagram-NN.md`
   - Lines (always exact): `hexagrams/NN/line-NN-1.md` … `line-NN-6.md`
   If a glob returns nothing, STOP and report — do not invent from the name.

2. **CARD 3 IS THE WORKED REFERENCE for every section.** Before writing section
   X for card N, read `sections/X/03.json` (for body/iching read `03.deep.json`)
   and match its shape, depth, field set, and voice. Card 3 is final and
   Adrian-approved. Imitate it; do not invent a new structure.

3. **OUTPUT A VERIFICATION BLOCK in every file's `meta`.** Two parts, so Adrian's
   pass can trust what passed:
   - `sourcing_log`: every concrete image/figure/number → the exact vault file
     it came from. If you cannot cite it, it is invented — cut it.
   - `fact_check`: for RELATIONS, confirm paired hexagram, programming partner,
     ring siblings, BOTH immortals (upper+lower trigram), Tarot Arcana, Hebrew
     letter each match `_hexagram-NN.md`. State "verified against _hexagram-NN.md".
   A card with no verification block is NOT done.

4. **CANONICAL FILE per card/section (the `.deep` rule).** Cards 3, 22, 50 have
   both `NN.json` and `NN.deep.json` for iching+body — the `.deep` is canonical,
   the plain one is superseded. All other cards have one file. When writing, if a
   `.deep.json` exists for that card/section, write THERE. Never split content
   across both.

5. **STAY IN YOUR SECTION'S LANE (no cross-bleed).** Internal relating (moving
   lines, Shadow→Gift→Siddhi, gate-in-channel) stays in its own section. Outward
   relating (pair, partner, ring, Tarot) lives ONLY in RELATIONS. Do not re-teach
   another section's system. (VISION internal-vs-outward rule.)

---

## THE WORKFLOW FOR ONE SECTION (what to actually do)

1. **Load** per the Load Order above. Confirm back. (The gate.)
2. **Read the card's vault folder** to completion.
3. **Find the one-breath truth** of the code (00 §8 step 1) if not already set.
4. **Draft** the section's fields to its template/brief, in the locked voice.
5. **Self-audit** against the four cuts + the section checklist BEFORE showing
   Adrian. Catch the AI tells yourself; do not make Adrian the filter.
6. **Present to Adrian** with per-field variants where the template calls for
   them. Note every vault file each concrete image came from (the sourcing log).
7. **On approval**, write the section JSON to its overlay path, set status,
   update `GAMEPLAN.md` with the new state.

---

## MARKDOWN IS THE OUTPUT FORMAT (standing rule, Adrian 2026-06-09)

All cards are written DIRECTLY to `oracle/cards/NN.md` (one file per card, all
six sections — the `03.md` format). Do NOT write per-section JSON for new work.
The app reads the Markdown directly (`data/cardMarkdown.ts`). `03.md` is the
format + quality reference. The old `oracle/sections/*/NN.json` files are legacy;
existing ones are read as fallback until their card is converted to Markdown.

When a card already has good JSON section work (e.g. cards 4/5/6 RELATIONS from
the proving run), CONVERT it to Markdown preserving every word — do not
regenerate. Apply only the needed DELTA (e.g. the official-terms layer) during
conversion.

## WHERE THINGS ARE WRITTEN (legacy JSON overlay paths — being phased out)

- UL N / opening face → `oracle/sections/code/NN.json` (new home; mirrors the
  other five sections). NOTE: legacy `oracle/generated/01.json` is the OLD
  whole-card shape and is superseded — do not add to it.
- ICHING → `oracle/sections/iching/NN.json` (deep pass: `NN.deep.json`)
- KEYS → `oracle/sections/keys/NN.json`
- DESIGN → `oracle/sections/design/NN.json`
- BODY → `oracle/sections/body/NN.json` (deep pass: `NN.deep.json`)
- RELATIONS → `oracle/sections/relations/NN.json`

Markdown markers (`**bold**`, `*italic*`) do NOT belong in JSON string values —
emphasis is the renderer's job. (WRITING_METHOD §5.)

---

## RESET-PROOF

If this is a fresh chat or post-context-reset session: read this whole file,
then `GAMEPLAN.md`, then execute the Load Order. That sequence reconstructs the
entire writing system from cold with nothing lost. This file is the durable
home; it does not move.
