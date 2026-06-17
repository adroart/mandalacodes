# Technical / Design Handoff — everything that is NOT writing card content

> Written 2026-06-09. Adrian is working the CONTENT track (writing/editing card
> text in `oracle/cards/NN.md`). This doc captures all the non-content work —
> design, wiring, batch — so a separate session can pick it up without touching
> the content thread. Read `GAMEPLAN.md` for overall state, `WRITE.md` for the
> writing system, `BATCH_PLAN.md` for the batch.

---

## Where the content stands (context only — Adrian owns this track)

- **Card 3** (`oracle/cards/03.md`): the ONE complete card. 5 teaching sections
  final, Markdown, the reference. Section 1 (opening face) deferred.
- **Cards 4/5/6**: RELATIONS Tarot expanded (JSON, scaffold); other sections raw
  scaffold. NOT yet Markdown.
- **Other 60 cards**: original scaffold JSON, none final, not Markdown.
- **Opening face (Section 1 / `code`)**: deferred for ALL cards by Adrian's call
  — it distils LAST from the five finished teaching sections.

---

## TASK 1 — The cast-panel visual design (IN PROGRESS, cosmetic, blocks nothing)

**File:** `components/oracle/CoinCast.tsx` (the I-Ching coin-cast result panel).
**Live at:** http://localhost:2222/universal-language/3 → cast to see it.

**The layout is CORRECT and locked** (Adrian confirmed via screenshot):
- Top row: `NOW` label · hexagram title · number, spanning across.
- Two hexagram glyphs side by side with a drawn arrow between them.
- Bottom row: `BECOMING` label · becoming title · number.
- Below the panel (SEPARATE elements, keep separate): full-width moving-line
  readings, then a standalone doorway card (becoming art + "Read UL N").

**What's WRONG / still needed (Adrian's words):** "more cluttered… I need real
structure. Grid work, lines. It looks like crap." The repeated failure has been
**decorating** (pills, dividers, corner-ticks, number tokens) instead of
building **real structure** — an underlying layout GRID with rulelines, columns,
an instrument-panel feel. Adrian explicitly said: do NOT just snap-to-grid, "set
it up properly" — i.e. use the **impeccable** skill the right way.

**To do it right:**
1. The impeccable skill needs context files that DON'T exist yet: author
   `PRODUCT.md` + `DESIGN.md` (or run `$impeccable teach` / `document`). The real
   design tokens are in `src/index.css`:
   - Fonts: `font-serif`/`font-display` = Cormorant Garamond (titles ≥20px only),
     `font-sans` = Lora (body <20px), `font-label` = Karla (uppercase eyebrows).
   - Palette: paper / wood / stone / bronze; warm-gold `#b0966b`; bronze accent
     `#c4aa7c` / `#d4b88a`. Defined in `src/index.css` `@theme` block.
   - Italic Cormorant <20px is FORBIDDEN (legibility). No em dashes anywhere.
2. Then use impeccable (`craft`/`layout`/`polish`) to build a real grid +
   rulelines version, not more ornament.
3. **Strip the current decoration first** — the corner-ticks, the number pills,
   the hairline dividers were the "clutter" Adrian rejected. Start from structure.

**Iteration constraint (important):** this sandbox BLOCKS all browser tooling —
Chromium won't launch (Mach-port sandbox denial), MCP playwright can't reach
localhost, Node can't run Vite's `import.meta.glob`. So an agent here CANNOT see
the rendered result; Adrian is the only renderer (he screenshots). A standalone
HTML mockup Adrian can open directly is the way to iterate without the sandbox
browser. A non-sandboxed session may not have this limit.

---

## TASK 2 — Markdown wiring (DONE, verify-only)

`data/cardMarkdown.ts` (660+ lines) parses `oracle/cards/NN.md` → the section
objects; `data/synthesisData.ts` wired to prefer Markdown, fall back to JSON
(dual-path, so un-migrated cards still render). Card 3 renders from Markdown.
Moving-line text now reads from Markdown via a synchronous cache
(`getMarkdownLineText`) primed by `getParsedCard` → CoinCast uses it. Build
passes. **Status: working.** Only re-verify if something regresses.

Parser exports: `parseCardMarkdown`, `mapKeys/mapDesign/mapIching/mapBody`,
`getParsedCard`, `hasCardMarkdown`, `getMarkdownLineText`. Format reference:
`oracle/cards/03.md`. Full spec: `oracle/PARSER_SPEC.md`.

---

## TASK 3 — Build the other 63 cards (the big one, batch)

Per `BATCH_PLAN.md`, run the workflow to write each card's 5 teaching sections
as Markdown (`oracle/cards/NN.md`) to card-3 standard, using the hardened briefs.
The RELATIONS proving run (cards 4/5/6) already validated the docs hold.

**Key decisions already made:**
- Output is **Markdown per card** (`oracle/cards/NN.md`), NOT JSON. (The batch
  must write the `03.md` format — frontmatter + `## SECTION` / `### sub` prose.)
- Cards 4/5/6: do NOT regenerate — they have good RELATIONS; just apply the
  official-terms DELTA (Repressive/Reactive names in KEYS, gate/centre/channel
  in DESIGN headings) when migrating to Markdown. Patch, don't rewrite.
- Each card writes a `meta.sourcing_log` + `fact_check`; a verifier agent checks
  facts vs `_hexagram-NN.md`.
- The hardened briefs (`oracle/sections/*/_BRIEF.md` + `WRITE.md`) carry: glob
  don't hardcode paths, card 3 = worked reference, vault index wins over
  `_per_card_reference.json`, sky/hebrew_letter derive-or-flag-null, Tarot
  3-axis web, official-terms-in-headings, name-a-character-only-where-it-adds.
- After batch writes scaffold Markdown, ADRIAN does the Phase-2 voice pass per
  card (scaffold → final) — that's the content track, not this handoff.

---

## TASK 4 — Port lock (DONE)

`vite.config.ts` now has `strictPort: true` on port 2222 — the dev server locks
to 2222 and fails loudly instead of silently hopping. If it ever says "2222 in
use," a zombie holds it: `lsof -ti :2222 | xargs kill -9` (may need a
non-sandboxed terminal — the sandbox blocked killing PID 71932 earlier).

---

## Nothing here is committed yet

All work is uncommitted on `main`. In-flight: `CoinCast.tsx`, `synthesisData.ts`,
`vite.config.ts`, the 5 `_BRIEF.md` + `WRITE.md`/`GAMEPLAN.md`/`BATCH_PLAN.md`/
`PARSER_SPEC.md`, `cardMarkdown.ts`, `oracle/cards/03.md`, the `03` section JSONs,
RELATIONS `04/05/06.json`, `sections/code/03.json`. Commit when a checkpoint is
reached (Adrian's call).
