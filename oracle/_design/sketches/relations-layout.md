# Relations panel — layout

**Status:** Design intent LOCKED. Component + content rebuild pending.

## The locked layout

```
                          RELATIONS
              ─────────────────────────────────


                           ╔═══╗
                           ║░░░║   ⟶   ╔═══╗
                           ║░░░║         ║░░░║
                           ╚═══╝         ╚═══╝
                          THE PAIR
                                    & PROGRAMMING PARTNER

                   The Creative             The Receptive
                      Code 1                    Code 2

         The deck's first polarity. Pure originating force,
         met by pure receptive ground.

                         [tap to visit Code 2 →]


              ─────────────────────────────────

                       CHANNEL PARTNER
                    (Channel of Inspiration)

                         ╔═══╗
                         ║░░░║   Code 8
                         ║░░░║   Holding Together
                         ╚═══╝
                                 [tap to visit Code 8 →]

           Code 1 makes the creative force; Code 8 carries it
                       outward as contribution.


              ─────────────────────────────────

                       THE RING OF FIRE

                Code 1 shares this ring with one other:

                         ╔═══╗
                         ║░░░║   Code 14
                         ║░░░║   Great Possession
                         ╚═══╝
                                 [tap to visit →]

              The spark, and the same fire grown to abundance.


              ─────────────────────────────────

                     SMALL CORRESPONDENCES

         Tarot              ·   XIV · The Art       [tap]
         Western lineage    ·   Sagittarius         [tap]
                            ·   Han Xiangzi         [tap]
                            ·   Samech              [tap]
```

## Key decisions

### What's NEW vs the existing implementation
- **Small Correspondences strip moves to the BOTTOM**, not top.
- **Channel Partner is its own kin tier** (was missing entirely).
- **Pair and Programming Partner dual-labeled in one block when same card.**
  When they're different cards (most other hexagrams), they're two distinct
  blocks with Pair loud and Partner medium.
- **No Inverse plate** on self-inverse hexagrams (Codes 1, 2, 27, 28, 29, 30,
  61, 62). On other cards, sits small below the Pair.
- **No trigrams** — they live in ICHING.
- **No "About this section" expander** at the top.
- **No "Back to UL" closer.** Kin doors are the close.

### Visual weight hierarchy (loudest to quietest)
1. **The Pair** — two hexagram glyphs side by side, large, with connecting arrow.
2. **Channel Partner** — single glyph, medium size.
3. **Codon Ring** — single glyph for small rings; horizontal row of glyphs for
   4-6 sibling rings (names always visible — no hover).
4. **Small Correspondences** — text-only, indented, quiet.

### For codon rings with 4-6 siblings
```
                       THE RING OF GAIA

            ╔═══╗    ╔═══╗    ╔═══╗    ╔═══╗    ╔═══╗
            ║░░░║    ║░░░║    ║░░░║    ║░░░║    ║░░░║
            ║░░░║    ║░░░║    ║░░░║    ║░░░║    ║░░░║
            ╚═══╝    ╚═══╝    ╚═══╝    ╚═══╝    ╚═══╝
            Code 13  Code 14  Code 30  Code 38  Code 49
            Concord  Bloom    Desire   Pushing  Following
                                                  Up

              The family of fire's many faces.
```

Each glyph + name = one tappable block. Names always visible. For 6-sibling
rings on narrow phones, may wrap to two rows of three.

### Tap-to-trace pattern for correspondences
Each line in the Small Correspondences strip is a tappable row. Tap opens a
bottom sheet (slides up from bottom of screen, mobile-friendly):

```
   ┌────────────────────────────────────┐
   │                                    │
   │   Sagittarius                  [X] │
   │                                    │
   │   This code connects to            │
   │   Sagittarius through the          │
   │   Codon Ring of Fire (Gene Keys)   │
   │   → Tarot XIV Temperance (Xuan     │
   │   system) → Sagittarius (Golden    │
   │   Dawn).                           │
   │                                    │
   │   The mutable fire of the arrow    │
   │   flying outward; this code is     │
   │   the bow that releases it.        │
   │                                    │
   │   Learn more →                     │
   │                                    │
   └────────────────────────────────────┘
```

Same pattern for Temperance, Han Xiangzi, Samech. "Learn more →" links to
the master `/oracle/lineages` reference page.

## Vault accuracy fix required

The existing `oracle/sections/relations/01.json` claims **Zhongli Quan** as
the Immortal for Heaven/Qian. Correct value per vault: **Han Xiangzi**. Fix
required before any Code 1 content ships.

## Build notes

- Existing Relations rendering at `components/UniversalLanguageCard.tsx`
  lines 2402-2656. Needs significant rewrite.
- Data shape on disk (`oracle/sections/relations/01.json`) does NOT match
  what UI currently reads. Must reconcile.
- Tap-to-trace bottom sheet is a NEW component. Could reuse / extend
  existing `BuySheet` patterns.
- Master `/oracle/lineages` reference page is a separate build.
