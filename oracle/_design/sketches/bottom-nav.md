# Bottom navigation strip

**Status:** IN DESIGN. Blocked on strategic decisions in `../PROJECT_ARCHITECTURE.md`.

## What we know

### Current state
Existing strip at the bottom of every card page:

```
┌──────────────────────────────────────────────────────┐
│  ← Code 63    [hexagram glyph]   1 / 64    Code 2 → │
│   Receiving      Earth's Breath              Field    │
└──────────────────────────────────────────────────────┘
```

Above it currently is the **Acquire / hexagram glyph / Share** band, which
audit identified as breaking the contemplative flow.

### Locked decisions
- The Acquire row in the middle of Code panel content is wrong. Removing.
- Hexagram glyph migrates from Acquire row to chrome (where it belongs as
  identifier — likely in the identity row beneath the chapter wordmark).
- Share remains as a prominent, persistent action.
- Strip stays single-row (no two-row stacks).
- Tap-targets must be mobile-friendly. No hover.

### Open decisions
- Exact language for the acquisition entry point (Anchor? The piece?
  Bring it home? The original?).
- Whether to remove the hexagram glyph entirely from this strip (it would
  live in the identity row above) or keep a small one here.
- Whether prev/next compress to just arrows + numbers, or include names.

## The strategic reframe (changes everything)

Per `../PROJECT_ARCHITECTURE.md`: the deck is a participation project,
not a shop. The Acquire entry point opens to a **participation ladder**:
chart → map → print → original. Not a single buy button.

The bottom-nav element therefore should NOT say "Buy" or even "Acquire."
It should be a doorway to the ladder.

## Candidate variants (not yet picked)

### Candidate A — explicit anchor language

```
┌──────────────────────────────────────────────────────┐
│   ←  63        ✦  Anchor this code     Share    2 → │
└──────────────────────────────────────────────────────┘
```

The action name carries the project's framing. Reader sees "Anchor" and
understands this is participation, not commerce.

### Candidate B — the piece-first language

```
┌──────────────────────────────────────────────────────┐
│   ←  63        ✦  The original        Share     2 → │
└──────────────────────────────────────────────────────┘
```

Names the artifact, not the act. Quieter. Works only if the participation
ladder is presented inside whatever opens — otherwise it overpromises
"original" when other tiers exist.

### Candidate C — share-first language

```
┌──────────────────────────────────────────────────────┐
│   ←  63        Share        ✦  Anchor           2 → │
└──────────────────────────────────────────────────────┘
```

Reverses the standard ecommerce pattern: Share gets the prominent slot;
the acquisition entry is to its right. Signals that the deck values
audience-building over direct sales.

## Pending strategic decisions before this can lock

From `../PROJECT_ARCHITECTURE.md`:

1. **Map status for V1.** If the map isn't built yet, the lighter
   participation tiers ("place yourself on the grid") can't be honestly
   surfaced. May need to launch with only the deepest tier (original
   sculpture) visible and add lighter tiers later.

2. **Chart input flow.** The chart calculator code exists but isn't
   integrated. What does "see this code in your chart" actually do today?

3. **Initial pricing ladder.** Original / print / digital / free chart —
   which tiers are live, what they cost.

Once those three are settled, this can lock.

## In the meantime

Best **placeholder-honest** design: a single dignified entry point with
language that allows the participation ladder to grow over time without
breaking what's there. Candidate A ("Anchor this code") is the strongest
candidate for this — it carries the framing without overpromising any
specific tier.

But this is not LOCKED. Decision deferred until the strategic foundation
is settled.
