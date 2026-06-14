# Piece-page build-out — handoff brief

**Goal (Adrian's words):** "Build out" the piece's book page — option 3: a **richer page** AND an **admin editor** so Adrian can write each piece's page himself without touching code.

## Where things stand (context this came from)
- The Atlas globe was just rebuilt on `react-globe.gl` with an immersive HUD. That work is committed on branch `atlas-globe-hud` (not merged, not pushed). The piece-page build is a SEPARATE effort — start it on its own branch off `main`.
- From the globe's HUD, "Open this piece's book →" links to `/piece/:pieceId` (and `/piece/:pieceId/:edition`), rendered by `components/PiecePage.tsx`. "Read Code N →" links to the oracle card reading `/universal-language/:n`.

## The actual gap
The piece page **renders fine but has no real content.** Every one of the 64 Universal Language pieces in `data/mockData.ts` (`FULL_ARCHIVE`) has a placeholder description: `"Number 32 in the Universal Language series."` There is no per-piece story, no extra photos (`images: []` everywhere), no provenance writing. And there is **no way for Adrian to write that content without editing the data file by hand.**

## What to build (option 3 = both)

### A. Richer piece page (`components/PiecePage.tsx`)
Currently shows: artwork image, title, Founding Lights ordinal, inline metadata (series/edition/year), hexagram (UL pieces), a 3-beat public history spine (created / placed / claimed), and a claim CTA. Make it richer — candidates to discuss with Adrian:
- A real per-piece **story** section (the missing content), with room for a longer narrative
- A **photo gallery** (the `images[]` array is unused — wire it up)
- **Materials / dimensions** shown more prominently
- The piece's **kin** (related pieces) with links, mirroring the globe HUD
- A **back-to-the-globe** link that re-selects this piece on /atlas
- Possibly an "owned by / in the care of" moment for claimed pieces

### B. Admin editor (the unlock)
A private screen (alongside the existing `/admin/atlas` admin area — see `components/AdminAtlas.tsx`) where Adrian picks a piece and edits its **story, extra photos, materials, provenance** — saved to live records, no code edits. This is the real ask; it makes all 64 + every future series editable.

**Key design question to resolve first:** where does the editable content live? Today artwork content is in `data/mockData.ts` (code, static) and placement/atlas state comes live from `/api/atlas` (the atlas ledger, D1-backed). The editor needs a writable store. Options to weigh:
- Extend the atlas ledger / D1 to hold per-piece editorial content (story, images), served via an API the piece page reads
- A separate content store
- Decide whether `mockData.ts` stays the source for static fields (title, dimensions) while the editor owns the narrative + gallery

This is intertwined: the richer page's fields should match what the editor can write, so design them together.

## Constraints (mandalacodes brand)
- Palette: paper / wood / stone / bronze; bronze `#c4aa7c` accents, sage `#9caa87`
- Fonts: Cormorant Garamond (serif), Cinzel (titles), Lato (labels)
- NO em dashes; minimal, mystical-but-not-prescriptive; middle-dot (·) separators
- Admin is Clerk-gated (stewards/admin) — see how `AdminAtlas.tsx` and `/atlas/claim` use Clerk
- Adrian has an oracle-card writing system already (see workspace memory `project_mandala_oracle_writing_system`) — the piece stories may want a similar drafting flow

## First moves for the new session
1. Read `components/PiecePage.tsx` (the page), `components/AdminAtlas.tsx` (admin pattern), `lib/atlas/state.ts` + `functions/api/atlas/*` (how live records work), `data/mockData.ts` (current content), `types.ts` (Artwork shape).
2. Resolve the "where does editable content live" question with Adrian before building.
3. Branch off `main`. Don't build on `atlas-globe-hud`.
