# Oracle Card Writing — The Game Plan

> The durable process for writing the 64 Universal Language oracle cards.
> Written 2026-06-09 with Adrian to stop losing the plan between sessions.
> Read this first, every session, before touching any card text.
>
> Pairs with: `VISION.md` (intent), `WRITING_METHOD.md` (field-by-field
> method + voice + locked UL 1 samples), `ANCHOR.md` (current state of what's
> written vs empty). This file is the *process*: how we move, in what order.

---

## BEFORE WRITING ANY CARD TEXT → load `WRITE.md`

`oracle/WRITE.md` is the enforced loader. It carries the GATE (you may not write
until every rule file is loaded and confirmed), the PRECEDENCE rule (two doctrine
sets — WRITING_METHOD wins on structure, 00/05/06 win on voice/copyright/keywords),
the LOAD ORDER, and the per-section routing. Read WRITE.md, then this file, then
execute its Load Order. That sequence rebuilds the whole system from cold.

## The one rule that keeps getting lost

**The source is the Obsidian vault, never the repo, never my memory.**

- Source of truth for content: `~/Documents/Obsidian Vault/oracle/hexagrams/NN/`
  (per-card folder: line files `line-NN-1.md`..`line-NN-6.md`, the synthesis
  `_hexagram-NN.md`, `gene-key-NN.md`, `oracle-NN-*.md`, and the reference
  translations Legge / Wilhelm / Huang / Cleary / Deng).
- The repo's `data/ichingLines.ts` is a DEPRECATED holdover — do not write to
  it. The real targets are the `oracle/sections/` overlays (see ANCHOR §1).
- Never invent or paraphrase from general knowledge. If a line is not in the
  vault, stop and ask. Never present remembered text as if quoted from a file.

---

## The card shape (locked — see WRITING_METHOD.md §3)

Six sections, nav order `UL N · ICHING · KEYS · DESIGN · BODY · RELATIONS`.
Voice: intimate teacher, warm, speaks to "you", no em dashes, no oracle
throat-clearing, the writing IS the information. Run the §1.5 reads-as-human
cuts on every slot.

UL 1 is the LOCKED REFERENCE card — every section of card 1 is the worked
sample. Match its register and shape for all 64.

---

## The process — in order

### Phase 1 — Source pass (per card)
For the card being written, go through ALL its Obsidian voices in
`oracle/hexagrams/NN/`: the six line files, the synthesis, the gene-key file,
the oracle file, the reference translations. Align them. Confirm they are
internally consistent and correctly written before drafting card copy from
them. This is the read-and-align step — no card text is produced yet.

### Phase 2 — Template fill (per card)
Fill every section slot of the card from the aligned source, in the locked
voice, to the WRITING_METHOD.md field spec. Output is the section JSON
(`oracle/sections/.../NN.json`) for each of the six sections.

### Phase 3 — Prove on one or two
Complete ONE or TWO cards fully through Phase 2. Present to Adrian. Get explicit
approval that the output is correct. Do not scale until a card is approved.

### Phase 4 — Scale to all 64
Once the proven card is approved as correct, apply the identical process to the
remaining cards, section by section, holding the approved card as the standard.

### Phase 5 — Finish the unfinished
The scaffold → final pass (KEYS + DESIGN are drafted as scaffold for 2–64), the
empty overlays (ICHING, BODY, RELATIONS, invocations for 2–64), and wiring each
overlay into `data/synthesisData.ts`. Tracked in ANCHOR.md §5 (Stages C–E).

---

## Corrected state (2026-06-09 — ANCHOR.md was STALE)

All six sections actually exist as scaffold for all 64 cards (not empty as
ANCHOR claimed). The cards with a deeper build are **3, 22, 50** (they carry
`.deep.json` variants in iching + body).

## ACTIVE: proving the process on Card 3 (Messengers of the Infinite)

Card 3 = hexagram 3, "Difficulty at the Beginning" / Sprouting. Shadow Chaos →
Gift Innovation → Siddhi Innocence. This is Adrian's in-progress card, picked
as the Phase 3 proof.

### Card 3 — what exists vs what's missing (verified 2026-06-09)

| Section | File | State |
|---|---|---|
| UL N / Code N (opening face) | `oracle/sections/code/03.json` | **NEEDS REDISTILL.** A first draft exists (keywords approved + Stranger-Test passed), but it was written BEFORE the 5 teaching sections were finalized, so it leans I-Ching. Per master §8 the opening face is distilled LAST from the finished sections. Redistil now that KEYS/DESIGN/BODY/ICHING/RELATIONS are all final — keywords stay, reading rebalanced to carry all 4 lineages as felt experience. invocation: null (Adrian writes). |
| ICHING | `sections/iching/03.deep.json` | **FINAL 2026-06-09** (Adrian Phase 2 — Zhun ideogram in combination; cut 2 invented images, regrounded to JIAN HOU; code→hexagram; 6 moving lines reviewed + vault-verified; Gao added to line 5 only [the one place a character adds]). |
| KEYS | `sections/keys/03.json` | **FINAL 2026-06-09** (Adrian Phase 2 — read true as-is; "anal" never in card text). |
| DESIGN | `sections/design/03.json` | **FINAL 2026-06-09** (Adrian Phase 2 — wove divine-timing drive into `gate` per QW source; centre/channel kept). |
| BODY | `sections/body/03.deep.json` | **FINAL 2026-06-09** (Adrian Phase 2 — confirmed as-is. The `.deep.json` is the keeper; plain `03.json` superseded). |
| RELATIONS | `sections/relations/03.json` | **FINAL 2026-06-09** (Adrian Phase 2 — fixed WRONG upper immortal Lü Dongbin→Li Tie Guai [source]; Code N→UL N; EXPANDED Tarot to 3-axis web: ring Death + Water majors [High Priestess, Hanged Man] + Thunder majors [Tower, Judgement], linked via each card's `i_ching_trigram`. Grammar hardened in `_BRIEF.md`). |

### The templates / preference specs (READ THESE — they ARE Adrian's preference)
- `oracle/sections/_TEMPLATE_01_CODE_N.md` — Section 1 field-by-field, with
  per-field voice variants + checklist. (marked final)
- `oracle/sections/_DEEP_PASS_ADDENDUM.md` — the deep-pass standard for ICHING
  + BODY (carry philology inside teaching, no bare Mandarin, carry myth
  figures, per-line imagery from the line files).
- `oracle/WRITING_METHOD.md` — the canonical six-section method + locked UL 1
  samples.

### Vault source for Card 3
`~/Documents/Obsidian Vault/oracle/hexagrams/03/` — richest files:
`oracle-03-sprouting.md` (Eranos, 23KB), `gene-key-03.md` (23KB),
`gk-64ways-03-difficulty-at-the-beginning.md` (21KB), `_hexagram-03.md`
(index), `practical-03-initial-challenge.md`, six `line-03-N.md` files,
`qw-gate-03-innovation.md`.

## Writing system built (2026-06-09)

- `oracle/WRITE.md` — enforced loader: GATE (no writing until rule files loaded
  + confirmed), PRECEDENCE (WRITING_METHOD wins on structure; 00/05/06 win on
  voice/copyright/keywords/relations), LOAD ORDER, per-section routing,
  SELF-CORRECTION rule (harden any twice-failed rule into a mechanical test).
- `05_KEYWORDS_GUIDE.md` §3b — the **Stranger Test** + 4 auto-fails (no rare
  word, no card-image dependence, no shadow word, no instruction). First
  hardened rule.
- Card 3 keyword line, passed through the Stranger Test:
  **New Beginning · New Life · Starting Small · Finding Order · Innovation ·
  Through a Child's Eyes · Patience** (awaiting Adrian's final yes; he was
  deciding "First Sprout" vs "Starting Small" — Starting Small chosen as it
  passes §3b auto-fail #2, First Sprout leans on the card image).

## Cost-effective execution → see `BATCH_PLAN.md`

Measured 2026-06-09: Section 1 (the opening face / `code/`) is the ONE real gap
— missing for all 64 cards. The other five sections are 64/64 scaffold (3 cards
have deep iching+body: 3, 22, 50). 4 files final, 322 scaffold.

The 64 are NOT written by hand or by Opus chat. Today's Opus cost was one-time
method design. Execution = two batch jobs on Sonnet/Haiku, Adrian reviews output:
- JOB A: Section 1 for all 64 (`sections/code/NN.json`), card 3 as the locked
  reference the batch imitates.
- JOB B (optional): deep-pass iching+body for the other 61.
Full spec, model routing, review loop in `BATCH_PLAN.md`.

## Docs hardened for the workflow (2026-06-09)

Verified: all 64 vault folders exist with `_hexagram-NN.md`, Eranos, and tarot
files (every tarot file carries `i_ching_trigram`). Data is workflow-ready.
WRITE.md now has a BATCH-AGENT HARDENING block (5 rules: glob don't hardcode;
card 3 = worked reference; output sourcing_log + fact_check in meta; `.deep` is
canonical for 3/22/50; stay in your lane). All five section briefs open with an
"AGENT: load WRITE.md FIRST" header. UL homepage (Section 1) DEFERRED — built
last, distilled from everything else (Adrian, 2026-06-09).

## CARD 3 = the complete worked reference (all 5 teaching sections FINAL)
KEYS, DESIGN, BODY (.deep), ICHING (.deep), RELATIONS — all final, Adrian Phase 2.
Section 1 (opening face) deferred with the rest of the homepage work.

## Proving run DONE (2026-06-09) — workflow validated on UL 4/5/6 RELATIONS Tarot

6 agents (3 writer + 3 verifier), ~347k tokens, ~4 min. Result: docs HOLD.
- All 3 globbed correctly, imitated card 3, grouped Tarot by `i_ching_trigram`,
  majors-only, fixed Code→UL (0 remaining), emitted sourcing_log + fact_check.
- UL 4 + UL 6 verified CLEAN. UL 4 quality confirmed by Adrian-side read: strong.
- The run CAUGHT a systemic scaffold error: wrong immortals across 4/5/6 (same
  Lü Dongbin bug as card 3) — all corrected against the vault index.
- UL 5 surfaced 2 real problems, both now hardened in `relations/_BRIEF.md`:
  (a) `_per_card_reference.json` is poisoned (old errors) → rule: vault index
  `_hexagram-NN.md` ALWAYS wins on conflict. (b) `sky` + `hebrew_letter` derive
  from the ring Arcana and went stale when it was corrected; the re-derive source
  files (`tarot-codon-rings-mapping.md`, `tarot-keywords-full-reference.md`) are
  EMPTY STUBS → rule: re-derive from the Arcana's tarot file, or set null + flag,
  never guess.

OPEN DATA GAP (not a doc gap): the two stub files + per-immortal files are empty.
Sky/Hebrew-letter cannot be fully source-verified until they are filled (a
research pass). RELATIONS ships the verifiable web (Tarot/immortal/ring/pair);
esoteric correspondences flagged where unsourced.

Files the run wrote (scaffold, awaiting Adrian review):
`sections/relations/04.json`, `05.json`, `06.json`.

## Markdown cards built (2026-06-09)

- `oracle/cards/03.md` — the reference, all 5 sections FINAL (Adrian Phase 2).
- `oracle/cards/04.md` — Veils of Knowledge. Converted from JSON + official-terms
  delta applied (Repressive—Apathetic, Reactive—Nit-Picking; Gate 4 Formulization
  / Ajna / Channel of Logic). status: scaffold, awaiting Adrian Phase 2.
- `oracle/cards/05.md` — The Space Between Time. Same. (Repressive—Pessimistic,
  Reactive—Pushy; Gate 5 / Sacral / Channel of Rhythm.) FLAG: sky=Sun +
  hebrew=Resh likely stale (ring Arcana corrected to The Star), source stubs
  empty — flagged inline. status: scaffold.
- `oracle/cards/06.md` — Harmonious Mirage. Same. (Repressive—Over-Attentive,
  Reactive—Tactless; Gate 6 Friction / Emotional Solar Plexus / Channel of
  Mating.) status: scaffold.

STANDING RULE (Adrian 2026-06-09): all FUTURE cards write DIRECTLY to Markdown
from the vault source — no JSON intermediate, no conversion. Only 3/4/5/6 needed
conversion (they had existing JSON worth keeping). Recorded in WRITE.md.

## NEXT MOVE (resume here if we stop)

Card 3 is now COMPLETE across all six sections (the locked reference card).
Card 3's own invocation is still null — Adrian writes invocations himself.

Two things gate the cheap batch (JOB A in `BATCH_PLAN.md`):
1. **Wire the `sections/code/NN.json` overlay into `data/synthesisData.ts`** so
   the card UI renders Section 1 (one-time code change, parallels how keys/
   design overlays load). Until then card 3's new opening face won't show in
   the live card.
2. **Launch JOB A** — Sonnet batch, one agent per card, Section 1 for the other
   63, imitating card 3. See `BATCH_PLAN.md`.

Then optionally JOB B (deep-pass iching+body for the other 61), then Adrian's
Phase 2 review (scaffold → final).
