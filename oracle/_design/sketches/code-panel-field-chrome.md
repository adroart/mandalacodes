# Code panel — Field / chrome / identity-row architecture

**Status:** LOCKED. 2026-05-24.

Job 3 of the Code panel audit. Resolves audit problems #1, #2, #8, #9, #17.

---

## The architectural decision

**Hero owns identity. Chrome stays minimal.**

The Field/hero carries the full card identity (name, correspondences,
keywords). The sticky chrome carries only the chapter wordmark plus a
six-dot progress cue. No second identity row competing with the hero.

This rejects the originally-proposed sticky identity row (`Code 1 · The
Creative · ♐ Sagittarius · XIV Temperance` beneath the chapter wordmark)
because it duplicates what the hero already says. Instead, the identity
*is* the hero, and the correspondences become tappable there.

---

## The locked layout

```
┌─────────────────────────────────────────────────┐
│                                                 │
│              [ artwork — full bleed ]           │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│                  Code 1                         │
│                                                 │
│              The Creative                       │
│                                                 │
│        ♐ Sagittarius  ·  XIV Temperance         │
│         (tappable)         (tappable)           │
│                                                 │
│        fire  ·  spark  ·  ignition              │
│                                                 │
└─────────────────────────────────────────────────┘

  · · · · · ·                                     ← six-dot progress (Code = ●)
─── CODE  ICHING  KEYS  DESIGN  BODY  RELATIONS ─── (sticky on scroll)

       (panel content — Reading, Invocation, etc.)
```

---

## Specifications

### The hero (Field)

The Field is the card-as-object. It carries everything that identifies
*this card* across the whole reading. After scroll, the hero leaves
view; the chrome takes over.

**Order, top to bottom:**

1. **Artwork.** Full bleed or near-full bleed in the hero container.
   Existing 1:1 sizing per current implementation.
2. **Code N.** Code number with the word "Code." Serif, medium-large.
   Acts as label, not heading.
3. **The card name.** Serif, larger than Code N. The dominant typographic
   element of the hero.
4. **Correspondences row.** `♐ Sagittarius · XIV Temperance` (one
   astrological, one Tarot Arcana). Both items tappable, open the
   tap-to-trace bottom sheet per the global rule. Centered, small,
   set apart from the name with breathing room.
5. **Keywords.** `fire · spark · ignition` (or whatever the card's three
   words are — shadow · gift · siddhi from gene keys, OR a curated three).
   Smaller than the correspondences row, lighter weight. The card's
   spoken essence in three beats.

**What's NOT in the hero:**
- No chapter wordmark *inside* the hero (it sits below, in chrome).
- No Acquire button (that's bottom nav per Job 2).
- No Share button (bottom nav).
- No "Next" navigation cue (bottom nav).

### The chrome

The chrome lives below the hero in normal flow, becomes sticky on scroll.

**Composition:**

1. **Six-dot progress row.** Small dots, one per section. Active dot
   filled (bronze or similar accent). Inactive dots are quiet
   (bronze-600/25 or equivalent). Sits ABOVE the wordmark, centered.
2. **Chapter wordmark.** Existing pattern: `CODE · ICHING · KEYS ·
   DESIGN · BODY · RELATIONS`. Active chapter highlighted. Edge-to-edge.

**No identity row.** This is the deliberate departure from the previous
proposal. The hero owns identity; the chrome stays minimal so it doesn't
feel weighty when sticky.

### The keywords — promoted from caption to identity

Previously the keywords rendered as a caption below the artwork,
visually paired with the image. They now sit inside the identity stack,
below the correspondences, treated as the card's three-word essence —
not as a label for the painting.

This is the resolution of audit problem #8 ("the keywords sit as a
caption to the artwork rather than as the card's keywords for the
whole code").

### The "first of six" cue

Six dots above the chapter wordmark. The active section's dot is
filled; the other five are quiet outlines or muted fills. Same six-dot
row appears across all panels, with the active dot moving as the reader
swipes between chapters.

**Why dots over numbered prefixes:** numbers add text weight to the
wordmark and would read as a numbered list ("step 1 of 6"). The dots
read as position, not procedure.

---

## What this fixes

| # | Problem | Resolution |
|---|---|---|
| 1 | Field/Code-panel split invisible but load-bearing | Hero is visually complete as the card identity; chrome marks the structural transition to panel content. |
| 2 | Proposed identity row competes with Field | Identity row removed; hero owns identity. |
| 8 | Keywords as artwork caption | Keywords promoted to identity-stack position. |
| 9 | Sticky wordmark doesn't anchor which card | The reader who scrolls back up sees the hero. The chrome doesn't need to carry card identity because the hero does, and the reader's mental anchor is the artwork above. |
| 17 | No "first of six" cue | Six-dot progress row above wordmark. |

---

## What this explicitly drops

- **The sticky identity row.** No `Code 1 · The Creative · ♐ · XIV` strip
  under the chapter wordmark. The hero carries it.
- **Keywords as artwork caption.** Promoted to identity-stack.
- **Card name inside the panel content area.** The panel content (Reading,
  Invocation) does not re-state the card name. The hero did that. The
  panel just begins.

---

## Cross-panel implications

The Field + chrome architecture defined here applies to **all six
panels**, not just Code:

- The hero stays the same across panels (artwork + Code N + name +
  correspondences + keywords). It's the card-as-object, constant.
- The chrome (chapter wordmark + six-dot progress) stays the same
  across panels, with the active dot and active chapter changing.
- Each panel's content (Reading, Hexagram, Gene Key analysis, etc.)
  sits below the chrome. The panel begins bare — no decorative header,
  no re-statement of card identity. The reader knows where they are
  from the chrome above.

This means the four pending panel audits (ICHING, KEYS, DESIGN, BODY)
inherit this architecture and only need to design their *content
typography*, not their *identity surface*.

---

## Build notes

- Existing component: `components/UniversalLanguageCard.tsx`.
- Hero region currently around lines 1456–1626 (card-as-object container
  + inline chapter strip).
- Changes needed:
  - Move title (`card.card_name`) and `Code {n}` label into the hero
    stack BELOW the artwork, not in the panel content.
  - Add correspondences row to the hero: `♐ {sign} · {arcana_roman}
    {arcana_name}` with each side tappable per the global tap-to-trace
    pattern.
  - Move keywords from artwork caption to identity stack below
    correspondences. Drop the bronze-tonal panel they currently sit in.
  - Remove duplicate title/keywords rendering from inside the Code panel
    (the UL chapter panel — see line 1647 comment about moving title +
    keywords into the panel; that move is being reversed).
  - Above the existing sticky chapter wordmark, add a six-dot progress
    row. Active dot tracks active chapter.
  - Remove any reference to a "card-identity row beneath the chapter
    wordmark" — it doesn't exist anymore.
- Tap-to-trace bottom sheets for the two correspondence items already
  follow the global pattern (see Relations audit). Each tap opens a
  sheet with: chain back to the code, one sentence of meaning, link to
  `/oracle/lineages`.

---

## Why this won

**Vs the original proposal (sticky identity row):** the identity row
would have been a second place to say what the hero already says. Two
surfaces saying the same thing means neither is the authority. The hero
is naturally the authority (it's where the artwork lives), so the
identity belongs there.

**Vs split-architecture (identity in hero, correspondences in chrome):**
splitting them would make the correspondences feel orphaned from the
card identity. They belong with the name and number, not with
navigation.

**Vs no-cue (problem #17 dropped):** the six-dot row is cheap, quiet,
and answers a real question ("how many of these are there?"). Worth
the small visual cost.
