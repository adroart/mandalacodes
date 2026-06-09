# Mandala Codes — Card UI Locked Rules

> The canonical record of every UI/design decision that has been made and
> locked. When a session asks "is this settled?" — check here. If it's not
> in this file, it's not locked.

**Last updated:** 2026-05-24

---

## Global rules (apply to the whole card)

### Typography & voice
- **No em dashes anywhere on a card.** Commas, periods, line breaks, parentheses.
- **Salt-and-pepper spiritual vocabulary.** Maximum one or two elevated words per section.
- **Intimate teacher voice.** Warm, direct, speaks to "you." Same voice across all six sections.
- **Loaded Chinese words preserved.** *Immersed* not *hidden*. *Jun zi* rendered as "the one who orders their life by the way," not "superior man."

### Mobile-first interaction
- **No hover anywhere.** Tap to interact, tap-outside or X to dismiss.
- **Bottom-sheet pattern** for any tap-to-detail interaction (mobile-friendly modal that slides up from bottom).
- **Tap-to-trace pattern** for all correspondence items (Tarot, zodiac, immortal, Hebrew letter, etc.) — tap opens a bottom sheet with (1) the chain back to the code, (2) one sentence of meaning, (3) link to the master `/oracle/lineages` reference page.

### The card structure
- **Six sections in order:** Code · ICHING · KEYS · DESIGN · BODY · RELATIONS
- **Doubled-trigram hexagrams (Codes 1, 2, 27, 28, 29, 30, 61, 62):** Upper and Lower carry the same trigram written from two angles.
- **Card naming:** "Code N" (e.g., Code 1, Code 22). Workspace-wide rename from "UL N" → "Code N" is pending follow-up.

---

## Chrome (persistent across all panels)

### The card-identity row — DROPPED (resolved by Job 3)
The previously-proposed sticky identity row (`Code 1 · The Creative · ♐ Sagittarius · XIV Temperance` beneath the chapter wordmark) has been **removed from the design**. The hero (Field) carries identity; the chrome stays minimal.

See `sketches/code-panel-field-chrome.md` for the resolved architecture. Correspondences (`♐ Sagittarius`, `XIV Temperance`) are tappable in the hero, not in chrome.

### The chapter wordmark (existing + six-dot progress)
Sticky tabs: `CODE · ICHING · KEYS · DESIGN · BODY · RELATIONS`. Above the wordmark sits a **six-dot progress row**, one dot per section, active dot filled. Same pattern across all panels — only the active dot moves.

### The bottom navigation strip
**Status: in active design.** Decisions so far:
- Pivoted from "Acquire button" to "anchor ladder" framing (see `PROJECT_ARCHITECTURE.md`).
- Will be a single thin row (no two-row stacks).
- Anchor entry point must be present (cannot be hidden) but should not feel transactional.
- Share remains as a prominent action.

Exact layout pending lock.

---

## Section 1 — Code panel (Reading + Invocation)

### Locked (Job 1 — typography)
**Variant A: Quiet prose, formal ritual.** See `sketches/code-panel-typography.md`.

- **No "The Reading" h2.** The reading prose teaches itself; no decorative header.
- **Real breath between the three reading clusters** (more than paragraph margin).
- **Horizontal hairline** separates Reading from Invocation.
- **INVOCATION label** in small caps with rule-fragments on either side. No "to be read aloud" instruction line.
- **Each invocation line gets significantly more space between lines** (read-aloud pacing, even though we no longer require read-aloud framing).
- **Closing line of invocation** ends, then a single centered `·` as small punctuation of arrival.

### In design (Job 2 — Acquire / anchor placement)
**Pivoted to anchor ladder framing.** See `PROJECT_ARCHITECTURE.md`.

The bottom nav will surface a single dignified entry point (language TBD —
likely "Anchor" or "The piece" or similar) that opens the participation
surface showing all available tiers. Final design pending strategic
decisions in `PROJECT_ARCHITECTURE.md`.

### Locked (Job 3 — Field / chrome / identity-row architecture)
**Hero owns identity; chrome stays minimal.** See `sketches/code-panel-field-chrome.md`.

- Hero stack: artwork → `Code N` → card name → correspondences (`♐ Sagittarius · XIV Temperance`, both tappable) → keywords (`fire · spark · ignition`).
- Chrome: six-dot progress row above the existing sticky chapter wordmark. No second identity row.
- Card name and keywords do **not** repeat inside panel content. The panel begins bare.
- Architecture applies to all six panels — only panel content changes between sections.

---

## Section 2 — ICHING panel

### Content locked
Reading + Judgement + Image + 6 moving lines for Code 1. Saved to
`oracle/sections/iching/01.json`.

### UI design status
**Audit pending.** See `audits/03-iching-panel.md` (does not exist yet).
Until the audit is done and design intent is locked, the panel uses the
existing rendering.

---

## Section 3 — KEYS panel

### Content
Existing Phase 1 draft on disk. May need re-pass under the new voice rules
(loaded-word discipline, em-dash audit, salt-and-pepper rule). To be
evaluated when we get to KEYS content work.

### UI design status
Audit pending.

---

## Section 4 — DESIGN panel

### Content
Existing Phase 1 draft on disk. Same status as KEYS.

### UI design status
Audit pending. Note: standard Human Design center shapes (G Center = diamond,
Throat = inverted triangle, etc.) should be incorporated when DESIGN audit
happens. See `GRAPHICS_BRIEF.md` G5.

---

## Section 5 — BODY panel

### Content
Scaffold on disk. Needs deep-pass under the deep-pass addendum + new voice
rules.

### UI design status
Audit pending.

---

## Section 6 — RELATIONS panel

### Locked design intent (audit complete)
See `audits/01-relations.md` and `sketches/relations-layout.md`.

- **What Relations IS:** the doorway out. The reader's next move is to
  leave this card.
- **Hierarchy of kinship — four tiers of visual weight:**
  1. The Pair (I-Ching) — loud, hero of panel
  2. Programming Partner (Gene Keys) — when different from Pair, second
     block; when same as Pair, dual-labeled in one block
  3. Channel Partner (Human Design) — medium weight
  4. Codon Ring siblings (Gene Keys family) — medium-quiet, 1-6 members
- **Small Correspondences strip** (Tarot Arcana, zodiac, immortal,
  Hebrew letter) at the *bottom* of the panel (not the top). Each item
  tappable, opens a bottom sheet with trace chain + one-sentence note.
- **No "About this section" expander.**
- **No "Back to UL" closer.** The kin doors are the panel's close; the
  reader's next action is to tap one.
- **No trigrams in Relations.** They live in ICHING.
- **Inverse plate omitted entirely on self-inverse hexagrams** (the
  eight cards). On others, sits small below the Pair.
- **For codon rings with 4-6 siblings:** horizontal row of small glyphs
  with numbers and names always visible (no hover required).

### Content status
The existing `oracle/sections/relations/01.json` is OUT OF DATE relative
to the new design. Also contains a vault error (wrong Immortal — says
Zhongli Quan; should be Han Xiangzi). NEEDS REBUILD after the design
is fully locked and any required vault corrections are made.

---

## What is NOT yet locked

- **The bottom nav final layout** — resolved at v1: Share + View original
  (links to adrianrasmussen.com). Anchor-ladder UI deferred until the
  PROJECT_ARCHITECTURE reconciliation is done.
- **ICHING, KEYS, DESIGN, BODY panel content typography** — audits pending.
  Architecture (Field + chrome) is locked via Job 3; each panel only
  needs to design its *content* surface.
- **The Relations panel rebuild** — design locked, content + component
  rebuild pending.

---

## Cross-references

- `PROJECT_ARCHITECTURE.md` — the participation ladder driving anchor design
- `GRAPHICS_BRIEF.md` — vector graphics needed across the deck
- `audits/01-relations.md` — full Relations audit
- `audits/02-code-panel.md` — full Code panel audit
- `sketches/code-panel-typography.md` — Job 1 locked variant
- `sketches/code-panel-field-chrome.md` — Job 3 locked architecture
- `sketches/relations-layout.md` — Relations layout, locked
- `sketches/bottom-nav.md` — bottom nav design (Share + View original v1)
