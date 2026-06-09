# Audit 02 — Code panel

**Status:** Jobs 1 and 3 locked. Job 2 resolved at v1 (Share + View original); full anchor-ladder UI deferred post-launch.

The Code panel is two parts: the **Field** (hero with artwork + title + keywords, sitting above the chapter wordmark) and the **Code panel itself** (just below the chapter wordmark, holding The Reading + Invocation).

## The 20 problems

(Captured from the audit session.)

### Conceptual / architectural
1. The split between Field and Code panel is invisible to the reader but structurally load-bearing.
2. The proposed identity row competes with what already exists in the Field.
3. The Reading on the Code panel is missing the bareness it was written for — sits under a decorative "The Reading" h2.
4. The Invocation is treated identically to the Reading — looks like one continuous block.
5. The invocation has no instructions for how to use it (originally had a placeholder paragraph; not used).

### Hierarchy / layout
6. The Acquire / glyph / Share row sits between the artwork-with-keywords block and the Reading. Commerce in the middle of the contemplative flow.
7. The Acquire row has three competing items in one strip (Acquire / hexagram glyph / Share).
8. The keywords sit as a caption to the artwork rather than as the card's keywords for the whole code.
9. The chapter wordmark sticks but doesn't anchor which card the reader is on.
10. The "Next: I Ching →" button at the bottom is the only navigation cue at panel end.

### Content rendering
11. The reading's three paragraph clusters render with `\n\n` splits as paragraphs — but visual rhythm between paragraphs is same as within. The deliberate breathing is partially lost.
12. The invocation's lines use the same leading as the reading prose — too compressed.
13. The invocation has no typographic emphasis on the closing line.
14. The artwork is forced to 1:1 aspect ratio.
15. No dignified fallback for cards without an invocation yet (63 of 64 currently).

### Identity / cross-panel
16. The hexagram glyph in the "spelled number" center-axis of the Acquire row is small and decorative.
17. There is no visual cue that this is the *first* of six sections.
18. The Field is doing two jobs (present card + facilitate commerce) that should be separated.

### Small stuff
19. The Reading h2 and Invocation h2 are styled identically.
20. The bottom buffer below the invocation feels rushed before the "Next" button.

## Recommendations per problem

| # | Recommendation |
|---|---|
| 1 | 🟥 Fix as part of Job 3 (architecture) |
| 2 | 🟥 Fix as part of Job 3 |
| 3 | 🟥 Fix — drop the h2 entirely. Quick win. |
| 4 | 🟥 Fix — Job 1 |
| 5 | 🟥 Fix — small framing line above invocation (or, per Adrian: no instruction at all since invocation doesn't have to be read aloud) |
| 6 | 🟥 Fix — Job 2 (relocate Acquire) |
| 7 | 🟨 Fix as part of Job 2 |
| 8 | 🟨 Worth doing — lift keyword visual weight |
| 9 | 🟨 Fix as part of Job 3 (identity row solves this) |
| 10 | 🟩 Let go — chapter wordmark provides navigation |
| 11 | 🟨 Fix — increase gap between clusters specifically |
| 12 | 🟥 Fix — Job 1 (more leading on invocation) |
| 13 | 🟨 Fix — small typographic mark for invocation close |
| 14 | 🟩 Let go for now — review per-piece if cropping issues arise |
| 15 | 🟨 Worth doing — dignified empty state for 63 cards |
| 16 | 🟨 Fix as part of Job 2 (hexagram glyph migrates to chrome) |
| 17 | 🟨 Worth doing — small progress dot pattern in chapter area |
| 18 | 🟥 Fix as part of Job 2 |
| 19 | 🟥 Fix as part of Jobs 1 + 3 |
| 20 | 🟩 Let go — fixing Job 1 likely fixes the feel naturally |

## The three jobs

### Job 1 — Reading + Invocation typography (LOCKED)

Fixes problems #3, #4, #5, #12, #13, #19, plus #11.

**Locked: Variant A.** See `../sketches/code-panel-typography.md`.

- No "The Reading" h2.
- Real breath between reading clusters.
- Horizontal hairline separates Reading from Invocation.
- INVOCATION label in small caps with rule-fragments. **No "to be read aloud" instruction** (per Adrian: invocation does not have to be read aloud).
- More leading on invocation lines.
- Single centered `·` after closing line.

### Job 2 — Acquire / anchor placement (IN DESIGN)

Fixes problems #6, #7, #16, #18.

**Pivoted.** Originally framed as "where do we put the Acquire button." Strategic
reframe by Adrian: the deck has a participation ladder (chart → map → print
→ original sculpture), with acquisition as the deepest tier. Acquire is not
one button; it's a doorway to a ladder.

**Current direction:**
- A single dignified entry point in the bottom nav (language TBD — "Anchor" /
  "The piece" / similar). Tap opens the participation surface.
- Removes commerce intrusion from the contemplative reading flow.
- Hexagram glyph migrates to chrome (where it belongs as identifier).
- Share remains in bottom nav as a prominent action.

**Blocking:** strategic decisions in `../PROJECT_ARCHITECTURE.md` (map status,
chart input flow, pricing ladder).

### Job 3 — Field / chrome / identity-row architecture (LOCKED)

Fixes problems #1, #2, #8, #9, #17.

**Locked: Hero owns identity, chrome stays minimal.** See `../sketches/code-panel-field-chrome.md`.

- Hero stack: artwork → `Code N` → card name → correspondences (`♐ Sagittarius · XIV Temperance`, both tappable) → keywords (`fire · spark · ignition`).
- Chrome: six-dot progress row above the sticky chapter wordmark. **No** second identity row beneath it (originally proposed, dropped per problem #2).
- Card name and keywords do not repeat inside panel content. The panel begins bare.
- Architecture is cross-panel: applies to all six sections. The four pending panel audits only need to design content typography, not identity surface.

## Layout sketches

See:
- `../sketches/code-panel-typography.md` — Job 1 locked
- `../sketches/bottom-nav.md` — Job 2 (v1: Share + View original)
- `../sketches/code-panel-field-chrome.md` — Job 3 locked

## Build status

Pending. Bundled with Relations rebuild and other panel audits.
