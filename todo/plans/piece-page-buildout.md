# Piece-page build-out — handoff brief

> **Status (2026-07-02):** the "where does editable content live" question
> below is resolved and built — a new D1 table `atlas_piece_content` (see
> `todo/handoff/adrian-website/004_piece_content.sql`), a public read endpoint
> (`GET /api/atlas/piece-content`) that `PiecePage.tsx` merges over
> `FULL_ARCHIVE`, and an admin-gated editor at `/admin/piece-content`
> (`components/AdminPieceContent.tsx`) writing through
> `POST /api/atlas/admin/piece-content`. See the "Piece-page content"
> decision record in `todo/handoff/GO-LIVE-RUNBOOK.md` for the rationale.
> Writing the 64 stories themselves remains with Adrian — the editor is
> ready whenever he wants to use it. The globe marker-clustering sibling task
> below remains open.

**Goal (Adrian's words):** "Build out" the piece's book page — option 3: a **richer page** AND an **admin editor** so Adrian can write each piece's page himself without touching code.

## Where things stand (context this came from)
- The Atlas globe was just rebuilt on `react-globe.gl` with an immersive HUD. That work is committed on branch `atlas-globe-hud` (not merged, not pushed). The piece-page build is a SEPARATE effort — start it on its own branch off `main`.
- From the globe's HUD, "Open this piece's book →" links to `/piece/:pieceId` (and `/piece/:pieceId/:edition`), rendered by `components/PiecePage.tsx`. "Read Code N →" links to the oracle card reading `/universal-language/:n`.

## The actual gap
The piece page **renders fine but has no real content.** Every one of the 64 Universal Language pieces in `data/mockData.ts` (`FULL_ARCHIVE`) has a placeholder description: `"Number 32 in the Universal Language series."` There is no per-piece story, no extra photos (`images: []` everywhere), no provenance writing. And there is **no way for Adrian to write that content without editing the data file by hand.**

## Also queued: globe marker clustering (sibling task, same session)

**The gap (Adrian, 2026-06-14):** "If there are 20 in Santa Cruz how does this work? I sell worldwide but many may be in one area." Today every piece in a city is plotted at that city's EXACT lat/lng (`AtlasPage.tsx` globeNodes loop, `c.lat`/`c.lng` from `CITIES_BY_ID`), so N pieces in one city stack invisibly on one point — only one is reachable from the globe, the rest are not.

**Adrian chose options 1 + 3 combined:** one marker per city, sized/brightened by how many pieces rest there AND showing the count number on it. Clicking a multi-piece city zooms in and the HUD lists all pieces there, each clickable to open its piece. A single-piece city behaves as today (click → that piece's HUD).

**Why this is a sibling of the piece-page work:** both revolve around the same piece records and the same detail panel (`PieceHUD.tsx`). The cluster's "city list" is a new HUD state that should be designed alongside the piece detail, not bolted on twice.

**Build notes:**
- Keep `globeNodes` as the per-piece list (HUD + kin logic depend on it). Add a derived CLUSTER layer: group nodes by cityId, one cluster node carrying `{ cityId, lat, lng, count, memberKeys[], series? }`.
- The globe (`GlobeGL.tsx`) renders clusters, not raw pieces. Marker visual: size + glow scale with count; render the count number for count > 1 (the markers are custom sprites — add a count label, or a `htmlElementsData` layer for the numbers).
- Click flow: cluster with count 1 → `onSelect(memberKey)` (current behavior). Cluster with count > 1 → new "city list" HUD state showing the members; selecting one opens its piece HUD; a back affordance returns to the city list.
- Edge: the birth-origin marker is its own single point, never clustered.

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
- Admin is auth-gated (stewards/admin) — see how `AdminAtlas.tsx` and `/atlas/claim` use the session auth
- Adrian has an oracle-card writing system already (see workspace memory `project_mandala_oracle_writing_system`) — the piece stories may want a similar drafting flow

## First moves for the new session
1. Read `components/PiecePage.tsx` (the page), `components/AdminAtlas.tsx` (admin pattern), `lib/atlas/state.ts` + `functions/api/atlas/*` (how live records work), `data/mockData.ts` (current content), `types.ts` (Artwork shape).
2. Resolve the "where does editable content live" question with Adrian before building.
3. Branch off `main`. Don't build on `atlas-globe-hud`.
