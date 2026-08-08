# Mandala Codes — Design Index

> Read this first. This is the navigation hub for all design work on the deck.
> The design files in this folder are separate from the locked card content
> (which lives in `oracle/sections/` and `oracle/generated/`). This folder is
> for design decisions, audits, sketches, and strategic architecture.

**Last updated:** 2026-05-24
**Status:** active design phase — Code 1 content locked through ICHING; UI design in progress

---

## How to use this folder

If you're a fresh session, a future Adrian, or an agent:
1. **Read this file first.** It tells you what's been decided and where to find it.
2. **Open the document for your specific question** (using the navigation table below).
3. **When you write or update a design document, update this index in the same turn.**

The folder structure:

```
_design/
├── _INDEX.md                    ← you are here
├── ORACLE-CONTEXT-BUNDLE.md     ← portable Claude Design context bundle
├── PROJECT_ARCHITECTURE.md      ← the participation ladder & anchor strategy
├── GRAPHICS_BRIEF.md            ← vector graphics needed, for Adrian to create
├── CARD_UI_LOCKED.md            ← what's been decided across all panels
├── audits/                      ← per-panel UI audits + design intent
└── sketches/                    ← per-panel ASCII wireframes, locked variants
```

---

## What we're working on right now

**Active:**
- ✅ Section 1 (Code) — content locked, saved to live data
- ✅ Section 2 (ICHING) — content locked, saved to live data
- ✅ Code panel architecture — Jobs 1 + 3 locked; Job 2 resolved at v1 (Share + View original)
- ✅ Relations panel design — locked (rebuild pending post-launch)
- 🔄 ICHING, KEYS, DESIGN, BODY panel content typography audits — pending (architecture inherited from Job 3)
- ⬜ Bottom nav v1 + Job 3 hero/chrome — locked in design, **NOT yet built** in `UniversalLanguageCard.tsx`
- ⬜ Sections 3-6 content (KEYS, DESIGN, BODY, RELATIONS) — unblocked now that architecture is locked

**The shape of "ship":** Adrian's constraint is layout-locked + all 64 cards
written correctly. With Job 3 locked, layout is now mostly settled; the four
remaining panel audits decide only *content typography* within the locked
architecture. The bottleneck shifts from design to writing (invocations,
KEYS/DESIGN Phase 2, ICHING/BODY deep pass, Code readings for UL 2–64).

**Anchor-ladder UI deferred:** v1 ships with Share + View-original in the
bottom nav. The full participation-tier UI (chart anchor, map placement,
print/original ladder) is post-launch work. When it happens, the next
session must check out `claude/atlas-port`, find the chart calculator, and
read `oracle/MARKETING_POSITIONING.md` §IV before designing — see
`PROJECT_ARCHITECTURE.md § "What Adrian has confirmed exists"`.

---

## Navigation by question

### "What's been decided across all the panels?"
→ [`CARD_UI_LOCKED.md`](CARD_UI_LOCKED.md)

The canonical summary of every locked design rule across all panels and the
whole card chrome. Read this to know what is "settled" and what is still open.

### "What context should I import into Claude Design?"
→ [`ORACLE-CONTEXT-BUNDLE.md`](ORACLE-CONTEXT-BUNDLE.md)

A portable, byte-exact bundle of the Oracle concept, vision, project plan,
writing method, and three complete sample card manuscripts.

### "What's the participation ladder / anchor strategy?"
→ [`PROJECT_ARCHITECTURE.md`](PROJECT_ARCHITECTURE.md)

The strategy doc for how readers participate in the deck — from the lightest
tier (chart placement on the map) to the deepest (acquiring an original
sculpture). This is the strategic foundation for any commerce or
participation UI.

### "What vector graphics need to be made?"
→ [`GRAPHICS_BRIEF.md`](GRAPHICS_BRIEF.md)

Tier 1-4 list of vectors Adrian needs to create as a vector artist:
trigram element marks, Tarot Arcana glyphs, replacement dragonfly,
codon ring sigils, HD center shapes, etc. Each entry has placement,
size, and description.

### "What did the Relations panel audit conclude?"
→ [`audits/01-relations.md`](audits/01-relations.md)

20 problems, recommendations, locked design intent: small correspondences
strip moves to bottom, kin doors are the hero, tap-to-trace pattern for
correspondences, no hover (mobile-friendly), the chrome identity row
beneath the chapter wordmark.

### "What did the Code panel audit conclude?"
→ [`audits/02-code-panel.md`](audits/02-code-panel.md)

20 problems, recommendations clustered into 3 jobs:
- Job 1: Reading + Invocation typography (locked Variant A)
- Job 2: Acquire row placement (v1: Share + View original in bottom nav; full anchor ladder deferred post-launch)
- Job 3: Field + chrome + identity-row architecture (locked — hero owns identity, chrome stays minimal; see `sketches/code-panel-field-chrome.md`)

### "What about ICHING / KEYS / DESIGN / BODY panels?"
→ Audits pending. See `audits/03` through `audits/06` when they exist.

### "What does the bottom navigation look like?"
→ [`sketches/bottom-nav.md`](sketches/bottom-nav.md) — pending, in active design

### "What does the Code panel reading + invocation look like?"
→ [`sketches/code-panel-typography.md`](sketches/code-panel-typography.md) — Variant A locked

### "How do the hero (Field) and chrome (chapter wordmark) work together?"
→ [`sketches/code-panel-field-chrome.md`](sketches/code-panel-field-chrome.md) — Job 3 locked. Applies cross-panel.

### "What does the Relations panel look like?"
→ [`sketches/relations-layout.md`](sketches/relations-layout.md) — locked

---

## The locked content (separate from design)

These live outside `_design/` because they're the deck's actual content:

- **`oracle/generated/01.json`** — Code 1 Section 1 (Code) locked text. App reads this.
- **`oracle/sections/iching/01.json`** — Code 1 Section 2 (ICHING) locked text. App reads this.

When more sections lock, they'll be saved here too:
- `oracle/sections/keys/01.json` (existing, may need re-pass under new voice rules)
- `oracle/sections/design/01.json` (existing, may need re-pass)
- `oracle/sections/body/01.json` (scaffold, needs work)
- `oracle/sections/relations/01.json` (existing, NEEDS REBUILD per audit)

---

## The locked voice rules (cross-deck)

These bind every card and every section:

1. No em dashes anywhere. Global.
2. Salt-and-pepper spiritual vocabulary (one or two elevated words per section).
3. Reading does not quote the Judgement or Image.
4. Three paragraph clusters with empty lines between for any 200+ word reading.
5. Sentence-level traces: every variant marked [V] vault or [S] synthesis.
6. Loaded Chinese words preserved (*Immersed* not *hidden*, *jun zi* rendered as "the one who orders their life by the way", etc.).
7. Each card's combination and lines write from its own vault material — no template forced across all 64.
8. Doubled-trigram hexagrams (Codes 1, 2, 27, 28, 29, 30, 61, 62): Upper and Lower carry the same trigram written from two angles.
9. Each moving line opens with its loaded source-image (italicized).
10. The dragon (or any per-card unifying image) stays in the moving lines unless the vault explicitly places it elsewhere.

---

## How a fresh session should pick up this work

If a new conversation starts and the user says "let's keep going":

1. Read this file (you're here).
2. Read `CARD_UI_LOCKED.md` to know what's settled.
3. Read the most recent audit (probably `audits/02-code-panel.md`) to know where we left off.
4. Ask the user: "Last decision was [X]. Want to keep going from there, or switch tracks?"

Don't start fresh. Don't ask the user to re-explain what's been locked. Pick up
from the documents.

---

## For Adrian — copy-paste session opener

When you start a new Claude Code session to continue this work, paste this:

> I'm picking up Mandala Codes oracle design work from a previous session.
> Read `mandalacodes/oracle/_design/_INDEX.md` first, then
> `CARD_UI_LOCKED.md`, then `PROJECT_ARCHITECTURE.md`.
>
> Before designing anything new on the anchor / participation flow, do
> the reconciliation task in PROJECT_ARCHITECTURE.md: check out the
> `claude/atlas-port` branch, find the chart calculator, read
> `oracle/MARKETING_POSITIONING.md` §IV. Report back what actually
> exists.
>
> Then tell me what's blocked, what's open, and where we should start.

The new session will read the design folder, know exactly what was decided,
familiarize itself with what's already built, and pick up at the live edge
of the work without designing redundant infrastructure.

---

## What's where on disk (cheat sheet)

**Design decisions and context:**
- This folder (`oracle/_design/`)

**Locked card content (the app reads this):**
- `oracle/generated/01.json` — Code 1 Section 1 (Code reading + invocation)
- `oracle/sections/iching/01.json` — Code 1 Section 2 (full ICHING)

**Older legacy content (may need rebuild):**
- `oracle/sections/keys/01.json` — Phase 1 KEYS draft
- `oracle/sections/design/01.json` — Phase 1 DESIGN draft
- `oracle/sections/body/01.json` — scaffold only
- `oracle/sections/relations/01.json` — needs full rebuild per audit, has
  vault error (wrong Immortal)

**Agent-facing templates (for batch content generation later):**
- `oracle/sections/*/​_BRIEF.md` files
- `oracle/sections/_DEEP_PASS_ADDENDUM.md`
- `oracle/WRITING_METHOD.md`, `VISION.md`, `ANCHOR.md`, `TODO.md`
