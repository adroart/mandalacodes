# Interconnection follow-ups

Write-up of the four-pillar interconnection review (branch
`claude/interconnection-architecture-review-z9vmtw`, June 2026): what shipped,
and what remains so the deck, the readings, the Hologenetic Profile, and the
Atlas keep growing together rather than apart.

## What shipped on the branch

Two commits:

1. **Interconnect the four pillars** — card ↔ atlas bridges ("On the Atlas"
   seat on cards, "Read Code N" on the atlas side panel, shareable
   `/atlas?piece=` deep links via the shared loader in `lib/atlas/state.ts`);
   the `YourPositionCallout` profile bridge finally rendered on card pages;
   the RELATIONS overlay (all 64 files) wired into every seat of the
   Relations panel including the inverse hexagram; internal navigation moved
   off the legacy `/oracle/universal-language` redirects (which were dropping
   the ritual-entrance state); Gateway dead links fixed; "no moving lines —
   stable" message on casts; card-number ↔ artwork lookups deduped into
   `utils/universalLanguage.ts`.
2. **Follow-ups** — single shared hexagram renderer
   (`components/oracle/HexagramGlyph.tsx`); birth place as a sage marker on
   the Atlas globe with its own side panel + nearest-pieces list and a
   reciprocal link from `/profile`; the multi-piece steward picker on
   `/atlas/edit`.

## Historical preview checklist — revalidate routes before use

This June 2026 checklist is historical. Recheck that each route and feature
remains active before using it; `/atlas/edit` and any retired-boundary behavior
may have changed. Source inspection confirms local implementations for several
paths, but not current preview, production, or live-ledger behavior. Owner
click-through and ledger identity checks remain outstanding where applicable:

- A card page (`/universal-language/1`): Relations panel seats (pair teaching,
  inverse, Immortal, Hebrew letter), the "On the Atlas" seat, and the profile
  callout when a saved profile matches the gate.
- The deck index tiles — back-face hexagrams now use the shared glyph
  geometry (lines sit slightly tighter than before).
- `/atlas?piece=UL-122` preselects the piece; the side panel links back to the
  code; with a saved profile, the sage birth-place marker is clickable and
  `/profile` links to it.
- `/atlas/edit` with a multi-piece steward account: picker switches pieces,
  saves land on the right one.
- A coin cast with no moving lines shows the "hexagram is stable" line.
- Confirm real ledger `pieceId`s match `FULL_ARCHIVE` ids — the card→atlas
  seat and the kinship index both resolve through that join; seed data
  matches, the live ledger should too.

## Content (Adrian's voice, not delegable)

- The 384 changing-line texts are already authored in each card manuscript;
  the remaining work is Adrian’s voice pass via `/cast-content` (see the main
  TODO). Do not use the deleted `data/ichingLines.ts` as an authority.
- RELATIONS prose is authored in the canonical `oracle/cards/NN.md`
  manuscripts; the old `oracle/sections/relations/` JSON is historical and is
  not the runtime authority. Check current editorial status in the card
  frontmatter or generated `oracle/CARD-PROGRESS.md` before describing how many
  still need Adrian’s personal pass.
- Consider a per-hexagram transition reading only after locating the current
  cast surface and deciding the content shape; the former CoinCast reference is
  absent from this checkout.

## Interconnection follow-ups

The following June-review items are already present in this checkout; they are
not remaining build work:

- **Card collections and Atlas placement:** `components/UniversalLanguageCard.tsx`
  uses `SaveToCollectionButton`; `components/account/CollectionsManager.tsx`
  joins saved cards to placements via `loadAtlasState` / `findPlacementForCard`,
  shows city/status, and links to the selected Atlas piece. The Atlas join is
  locally implemented; live behavior is not proven by source inspection.
- **Profile key/sphere ordering:** `data/profileKeys.js` is the shared source
  imported by `data/profilePositions.ts`,
  `lib/oracle/recommendation.ts`, and
  `functions/api/profile/put.js`. Surface-specific labels and descriptions
  intentionally remain local; do not consolidate them without a product
  decision.
- **City picker:** `components/shared/TypeaheadPicker.tsx` is used by the
  `CityAutocomplete` wrapper in `components/AdminAtlas.tsx` and directly by
  `components/atlas/StewardEdit.tsx`.
- **Kinship arc cap:** `components/atlas/AtlasFilters.tsx` displays the
  visible/total thread count when the limit applies.
- **Gateway → profile:** `components/OracleGateway.tsx` already links to
  `/profile` as “Your Birth Chart.”

The remaining renderer follow-up needs a fresh, bounded audit before work is
assigned. Several major surfaces already use
`components/oracle/HexagramGlyph.tsx`, including the card and atlas code index;
the Gateway retains its orbital custom drawing. Do not describe CoinCast as a
current component without locating it in this checkout. Preserve distinct
animated or ornamental design where shared geometry would change the
experience, and visually review any proposed consolidation on the real
surfaces. Check the old `data/trigrams.ts` comment discrepancy against current
code before reopening it.

## Bigger pieces already tracked elsewhere

- Chart→art lookbook into the site — TODO "Oracle MCP, search &
  personalization".
- Whole-deck content review before launch — `oracle/TODO.md`.
