# Rewrite the 64 opening readings — synthesis of the whole code, with lift

Status: planned, waiting for Adrian to be home. Do not start writing cards until the pilot gate (step 3) passes.

## What this is

The opening reading on every card page (the three paragraphs under "The Reading") must be rewritten for all 64 cards. Diagnosis from the 2026-07-05 session:

- **They read as downers.** The shape that generated them (WRITING_METHOD.md §1.4b: lit face → shadow face → the ask, "end a beat early, no neat bow") has no upward return. Two of three paragraphs carry weight by design; the ending never lifts. Roughly half also open dark, violating the "lit face" rule for movement 1.
- **They are not syntheses.** Forensic audit of 10 cards: 24 of 30 paragraphs are pure Gene Keys; paragraph 2 is the Gene Keys Shadow restated in 8 of 10 cards; Tarot appears in zero readings; Human Design carries one paragraph in thirty. The CODE reading is functionally a compressed rerun of the KEYS section below it.
- **Why it happened (structural, not writer error):**
  1. CONCEPT.md (the doc that says the reading "draws the threads of all the systems together without naming them") was never in WRITE.md's enforced load order. The batch writers never saw the rule.
  2. WRITING_METHOD.md + sections/_TEMPLATE_01_CODE_N.md silently narrowed the reading into a Gene Keys-shaped arc.
  3. CODE is the only section with **no sourcing_log entry** — no accountability step forcing it to draw from all four lineages.
  4. GAMEPLAN.md line ~93 caught the drift on card 3 the same day ("redistil… reading rebalanced to carry all 4 lineages") but the note was never generalized before the other 63 were written.
  5. All 64 cards are still `status: scaffold`; the Phase 2 human review never ran.

## Adrian's design intent (his words, 2026-07-05)

> "We're trying to pull the energy from the card number, not any one tradition. It's where all the traditions meet and what they all point to. Using all the traditions as lenses talking about one thing."

The reading is the CODE itself — the one energy — spoken plainly. The traditions are lenses on it, never ingredients shown in it. No system named, no system's prose recompressed.

## The three traps (from the critical pass — the method below exists to defeat them)

1. **Quota-writing.** "Show material from all four" produces four essays stapled together. Synthesis happens BEFORE prose (in the distillation sheet), never in it.
2. **Vague center.** The lazy meeting-point of four traditions is mush ("this card is about transformation" — banned by master guide §5.3). The center is an editorial judgment per card; Adrian ratifies each one.
3. **Tone survives synthesis.** Fixing sources without fixing the shape yields 64 better-sourced downers. The arc must descend AND return.

## The method — per card

All source material still exists, together, in the Obsidian vault: `~/Documents/Obsidian Vault/oracle/hexagrams/NN/` (Eranos philology, Gene Keys chapter + reference sheet, Wilhelm, Practical Guide, Quantum Way gate file, tarot files, line files). The vault is the anti-invention floor; nothing is invented.

**Step A — Distillation sheet (one per card, before any prose).** A short working artifact holding:
- The one-breath truth: ONE sentence naming what all four lenses are looking at. Specific, not vague. When lineages genuinely diverge, pick a lead lineage and log why (master guide §5.3 procedure).
- Four lens lines: one image or angle per tradition (I Ching natural image, Gene Keys arc, HD body-feel, Tarot gesture) that CONFIRMS the center — these are checks, not ingredients.
- Tone note: where the lift lands in this card.

**Step B — Adrian ratifies the sheet.** Fast pass: approve or strike the one-breath truth. This is the only step needing him per card, and it is the whole ballgame.

**Step C — Write the reading FROM the center sentence alone.** Amended shape, four beats in three paragraphs (~200–260 words):
1. The force, lit — what it feels like awake in a person. Always lit, even on dark codes.
2. The other face — the same force in its low season. Felt, not diagnosed, never the Gene Keys Shadow text recompressed.
3. The turn AND the ask together — the reading ends risen. The "no neat bow" rule is amended: end plain and a beat early, but end UP. "Descent and a return" (01_DESCRIPTION_SPEC arc) becomes the reading's law too.

**Step D — Lens validation (after writing, per card).** Four questions: would someone who knows only the I Ching recognize this reading as hexagram N? Only Gene Keys? Only HD? Only Tarot? All four must say yes; none may say "this is mine." Plus: no phrase duplicated from the card's own KEYS/ICHING sections; voice rules (no em dashes, no source naming, no borrowed prose) hold.

**Step E — Sourcing log.** CODE gets its own `sourcing_log` entry like every other section: which vault files the center and each image trace to. This is the accountability step whose absence caused the drift.

## Sequence

1. **Spec amendment first.** Update WRITING_METHOD.md §1.4b + sections/_TEMPLATE_01_CODE_N.md §4.3 with the amended shape and the lens-validation test; add CONCEPT.md to WRITE.md's load order; require the CODE sourcing_log entry. One spec must win — resolve the precedence contradiction explicitly.
2. **Pilot: 5 cards.** One bright code (1 or 14), one dark code (47), one where lineages diverge, one body-led (52), one Adrian picks. Full method A–E on each.
3. **Gate: Adrian reads the 5 on the live page** (not in markdown). If the felt experience is right — pulled up, whole-code, not any one tradition — lock the spec. If not, iterate here; do NOT proceed.
4. **Batch the remaining 59** in ratify-then-write waves (sheets in batches of ~10 for Adrian's ratification, prose follows each ratified batch). Never all 59 blind in one day — that was the June failure mode.
5. **Ship with a sweep**: re-run the tone sweep (first/last paragraph of all 64) and the lens validation before merge.

## Related but separate (do not fold into this rewrite)

- **Display wiring fix (agent-runnable, independent, can go first):** the card page's Gene Keys sections render OLD synthesis JSON instead of the markdown KEYS sections (`UniversalLanguageCard.tsx` ~line 164 fallback chain prefers `synthesis.gene_keys.*`). The old JSON names Richard Rudd and uses his coined phrases — live copyright violations per master guide §6. Wire `mapKeys()` output into display and the leaks die with it.
- The existing "whole-deck review" and "deep-pass rewrite" todos (oracle/TODO.md) overlap Phase 2 generally; this plan covers only the opening reading.

## Session artifacts (2026-07-05)

- Tone sweep scripts (first/last paragraph of all 64 CODE sections) were run in-session; trivially re-creatable: split each `oracle/cards/NN.md` on `## CODE`, take paragraphs.
- Forensic audit and doc-archaeology findings summarized above were produced by agent sweeps; the key citations are CONCEPT.md §4 (~line 156), WRITING_METHOD.md §1.4b + §3 SECTION 1, sections/_TEMPLATE_01_CODE_N.md §4.3, GAMEPLAN.md card-3 note, WRITE.md precedence rule.
