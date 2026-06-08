# Audit 01 — Relations panel

**Status:** Design intent locked. Component + content rebuild pending.

## The original 20 problems

(Captured from the audit session, condensed.)

### Conceptual
1. The panel is doing three jobs at once: doorway out, teaching layer, esoteric correspondence table.
2. The reader doesn't know what Relations is *for* when they land here.
3. The "doorway out" promise is buried under correspondence tables.
4. "Pair" and "Programming Partner" are the same card for Code 1 — shown twice, two different ways.
5. The Inverse plate is wrong for Code 1 (and the 7 other self-inverse hexagrams) — promises content that won't come.
6. The "kin row stack" treats every kin as equally weighted, but they aren't.

### Content architecture
7. The "unity line" at the top duplicates the pair teaching (third time the pair-with-Code-2 is communicated within 400px).
8. The Tarot is in the wrong place — grouped with "The Kin" but a Tarot Arcana is not a navigable kin card.
9. The 2×2 correspondence grid puts unequal-weight items in equal-weight cells (Trigrams = core; Hebrew Letter = outside lineage).
10. "The Immortal" and "Hebrew Letter" don't belong on a card whose four lineages are I-Ching / Gene Keys / Human Design / Tarot.
11. "The Living Field" as the panel title is decoration, not navigation.
12. The Codon Ring teaching paragraph repeats teaching that belongs in BODY.
13. There is no clear hierarchy between "kin you can visit" and "correspondences you can study."

### Layout
14. The page is a vertical list of seven loosely-stacked blocks with no rhythm.
15. The pair plate (visual hero) is upstaged by the "About this section" expander.
16. The correspondence grid uses 2×2 on desktop but stacks on mobile as 4 separate rows of "To be written" — reads as broken.
17. CardLink rows in the kin stack don't feel like doors — look like list rows.
18. "Back to UL" as the section-closer is wrong. Relations is the doorway *out*.

### Strategic
19. The data shape on disk doesn't match what the UI actually reads. The relations JSON has 10 teaching paragraphs; the UI reads from 4 different other data sources.
20. The whole panel is built on a "fixed-seat correspondence card" (TCG stat block) metaphor that produces uniform cells — clashing with the intimate-teacher voice the rest of the card holds.

## Vault accuracy error found

The current `oracle/sections/relations/01.json` claims **Zhongli Quan** as
the Immortal for Heaven/Qian. The vault's master files
(`trigram-heaven-qian.md`, `_hexagram-01.md`, `eight-immortals-master-reference.md`)
say **Han Xiangzi**. Fix required before any Code 1 content ships.

## Locked design intent

See `../CARD_UI_LOCKED.md § Section 6 — RELATIONS panel`.

Summary:
- Kin doors are the hero; correspondences are the quiet footer.
- Four kin tiers in descending visual weight: Pair → Programming Partner (when different) → Channel Partner → Codon Ring.
- Small Correspondences strip at the **bottom** (Tarot, zodiac, immortal, Hebrew letter — all tappable for trace).
- Inverse plate omitted on self-inverse hexagrams.
- No trigrams (they live in ICHING).
- No "About this section" expander.
- No "Back to UL" closer.
- Mobile-friendly: tap-to-trace bottom sheets, no hover anywhere.
- For 4-6 sibling codon rings: horizontal row of glyphs, numbers + names always visible.

## Layout sketches

See `../sketches/relations-layout.md` for the locked layout variant.

## Build status

Pending. The component + data shape + content all need to be rebuilt
together once the rest of the card UI is locked (Code panel jobs 2 + 3,
ICHING audit, etc.). Bundling the rebuild prevents wasted work.
