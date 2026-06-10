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

## Verify on the next preview deploy *(you-required, quick)*

The remote environment has no browser, so these shipped on build + node-level
checks only. Click through once:

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

- The 384 changing-line texts (`data/ichingLines.ts` is all placeholders;
  CoinCast already renders them when present) — via `/cast-content`.
- The 63 RELATIONS scaffolds (`oracle/sections/relations/`, only UL 1 is
  `final`) are now LIVE on cards. Readable prose, but the Phase 2 personal
  pass now has a visible surface.
- The per-becoming reading in CoinCast (`components/oracle/CoinCast.tsx`,
  "the present begins to give way…") is one generic sentence for all 64
  becomings; synthesis content could make it per-hexagram.

## Remaining interconnection development *(agent-runnable)*

- **Collections ↔ card pages.** `CollectionsProvider` is mounted app-wide but
  no card-page UI saves a card to a collection. Add a save affordance near
  Acquire/Share (signed-in only), and a "which of my collected cards are
  placed on the atlas" view in `/account/collections`.
- **Sphere metadata dedup.** `data/profilePositions.ts` (11 positions, UI
  fields) and `lib/oracle/recommendation.ts` `SPHERES` (same 11, simpler)
  define the same sequence twice; extract one shared base. Same for the
  11-key `ProfileKey` list repeated in `lib/astrology/profile.ts` and
  `functions/api/profile/put.js`'s validator.
- **City picker dedup.** `AdminAtlas.tsx`'s `CityAutocomplete` and
  `StewardEdit.tsx`'s combobox duplicate query/filter/render logic — extract
  a shared component.
- **Kinship arc cap.** When pairs exceed `MAX_KINSHIP_ARCS` (200) only a
  console.info fires; surface "showing X of Y kinship arcs" in the filters
  row.
- **Gateway → profile.** The QR-arrival screen never mentions the profile;
  a fourth quiet link ("Map your birth chart") would close that loop for
  plaque scanners.
- **Remaining renderer unification (needs visual QA).** OracleGateway's
  orbital hexagrams and CoinCast's animated `Hexagram` still own their
  geometry; `data/trigrams.ts` stores lines bottom-to-top while its comment
  claims top-to-bottom — fix the comment or migrate callers to the shared
  glyph module.

## Bigger pieces already tracked elsewhere

- Chart→art lookbook into the site — TODO "Oracle MCP, search &
  personalization".
- Sign-in to production Clerk — TODO Phase 1b.
- Whole-deck content review before launch — `oracle/TODO.md`.
