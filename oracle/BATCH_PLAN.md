# BATCH_PLAN.md — how to write the 64 cards cost-effectively

> The execution plan for filling the deck without paying Opus-interactive rates
> 64 times. Pairs with `WRITE.md` (the rules + loader) and `GAMEPLAN.md` (where
> we are). This file is the *how to run it cheaply at scale*.
>
> The principle: today's Opus chat was the one-time cost of DESIGNING the method
> and building the rails (WRITE.md, the Stranger Test, the hardened rules). That
> cost is spent and not repeated. EXECUTING the method across 64 cards is a
> batch job for a cheaper model, with Adrian reviewing output, not co-writing.

---

## The real state of the grid (measured 2026-06-09)

| Section | Files | State |
|---|---|---|
| **code (Section 1, opening face)** | **0 / 64** | **MISSING for every card. The main gap.** |
| iching | 64 / 64 | scaffold (3 have a richer `.deep.json`: cards 3, 22, 50) |
| keys | 64 / 64 | scaffold |
| design | 64 / 64 | scaffold |
| body | 64 / 64 | scaffold (3 deep: 3, 22, 50) |
| relations | 64 / 64 | scaffold |

Status across all section files: **4 final** (card 1), **322 scaffold**.

So the deck is NOT empty. Five of six sections are fully scaffolded. The work is:
1. **Fill Section 1 (code) for all 64** — the one true hole.
2. **(Optional) Deep-pass the remaining 61** iching + body to match cards 3/22/50.
3. **Phase 2 review** — Adrian's pass, scaffold → final. The real art labour.

---

## The cost model

- **Method design (today):** Opus, interactive. DONE. One-time. Not repeated.
- **Batch generation:** Haiku (mechanical fills) / Sonnet (synthesis-heavy
  sections). Per `~/.claude/CLAUDE.md` build conventions: Haiku for
  classification/sorting, Sonnet for synthesis, Opus only when asked.
- **Review:** Adrian's attention, spent ONLY on Phase 2 (approve/rework), never
  on generation. This is the deck's own two-phase intent (`00` §1).

The expensive resource is Adrian's review time and Opus tokens. The plan spends
neither on bulk generation.

---

## Model routing per section (which tier writes what)

| Section | Model | Why |
|---|---|---|
| code (Section 1) | **Sonnet** | The opening reading is the most-read text + the keyword Stranger Test needs judgment. Worth Sonnet, not Haiku. |
| iching deep | **Sonnet** | Philology synthesis from the Eranos; the deep-pass standard is demanding. |
| body deep | **Sonnet** | Same deep-pass demand, poetic. |
| keys / design / relations | already scaffolded | No regeneration needed unless Adrian wants a deep pass; those are Sonnet jobs if so. |
| keyword-only fixes | **Haiku** | Once the Stranger Test is the gate, keyword re-checks are mechanical. |

Card 3 is the **locked reference** the batch imitates. Every batch agent is
shown card 3's finished section as the worked example for that section.

---

## The two batch jobs (in order)

### JOB A — Section 1 for all 64 (the real gap)
One agent per card. Each agent:
1. Loads `WRITE.md`, confirms the gate, reads the spine + `_TEMPLATE_01_CODE_N.md`
   + `05_KEYWORDS_GUIDE.md` (incl. the §3b Stranger Test).
2. Reads the card's vault folder `hexagrams/NN/` to completion.
3. Writes `oracle/sections/code/NN.json`: card_name, keywords (Stranger-Test
   passed), reading (2–3 clusters, 200–260w), invocation field LEFT NULL
   (Adrian writes invocations himself).
4. Runs the Section-1 checklist + the four cuts BEFORE finishing.
5. Sets `status: scaffold`. Reports the vault sourcing log.

Output: 64 opening-face files. Adrian reviews, not co-writes.

### JOB B — deep-pass iching + body for the other 61 (optional, after A)
One agent per card per section (or per card, both sections). Each follows
`_DEEP_PASS_ADDENDUM.md` exactly, imitates card 3's `.deep.json`, writes
`NN.deep.json`, keeps the scaffold alongside for comparison.

Output: 61 deep iching + 61 deep body. Adrian compares deep vs scaffold, keeps
the better per card.

---

## How Adrian reviews without re-writing

- Batch writes all files as `scaffold`. The deck stays fully usable throughout
  (status is internal, never reader-facing — `00` §10).
- Adrian reviews in passes (e.g. 8 cards at a time), flipping `scaffold → final`
  on the ones that land, sending back the ones that miss with one note each.
- A miss that recurs across cards → harden the rule into a test (the
  Self-Correction rule in `WRITE.md`), so the next batch inherits the fix.

---

## What blocks the batch right now

Nothing structural. The rails are built (WRITE.md, hardened keyword rule, card 3
nearly complete). Before JOB A runs, two things:
1. **Finish card 3's Section 1** so the batch has its worked reference. (In
   progress — keyword set chosen, awaiting Adrian's final yes.)
2. **Confirm the overlay loader reads `sections/code/NN.json`** — the card UI
   currently loads keys/design/etc; the new `code/` overlay must be wired into
   `data/synthesisData.ts` the same way (one-time code change, not per-card).

---

## Resume

If stopped: read `WRITE.md`, then `GAMEPLAN.md`, then this file. JOB A is the
next executable unit once card 3's Section 1 is locked and the `code/` overlay
is wired.
