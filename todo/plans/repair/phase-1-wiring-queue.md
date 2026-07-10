# Phase 1: the wiring sweep (execution brief for the batch runner)

_Written 2026-07-10 from a file-by-file verification of every pointer in
`todo/DEVELOPMENT-STATUS.md` Part II. One headless agent per item, one commit per
item. Ordered cheap-and-safe first. All fifteen items are pure wiring over data
that already exists on both ends; none require ops, content, or Adrian decisions._

**Pointer corrections found during verification (each item's spec below already
uses the corrected pointer):**

- The card page's visible markup is GENERATED (`components/oracle/eb/generated/EBReading.generated.tsx`, "no hand-typed markup"). Items 05 and 06 must mount through the host's `headerChartSlot` prop, never by editing the generated file.
- The live "today" tile is in `components/oracle/entry/OracleEntryPage.tsx` (lines 152-159), not `UniversalLanguageIndex.tsx`. App.tsx line 4 imports OracleEntryPage under the name UniversalLanguageIndex; the real `UniversalLanguageIndex.tsx` is the orphaned old index.
- "Founding light" renders live in `components/atlas/PieceHUD.tsx:213` and `components/PiecePage.tsx:445`. The audit's pointer (`PieceSidePanel.tsx:143`) is a component that is currently mounted nowhere (it goes live with item 13).
- The `.ul-energy-panel` CSS classes the Today/Year panels use are defined nowhere in the repo; the port from the art site dropped the styles. Item 11 includes writing them.
- The atlas already accepts `?piece=<pieceId[:edition]>` deep links (`components/AtlasPage.tsx:97` and 244-258), so the card-to-atlas bridge in item 06 is one Link, not new routing.

---

## Queue

### 01 · wire-trigram-comment

- **Title:** Fix the wrong hexagram line-order comment in trigrams.ts
- **Files:** `data/trigrams.ts`
- **Change:** Line 4 says "Each trigram is stored top-to-bottom as [top, middle, bottom]". The data is actually stored bottom-to-top: Zhen/Thunder `[true, false, false]` has its yang line at index 0, which is the BOTTOM line of ☳. Rewrite the comment to say the trigram is stored bottom-to-top as `[bottom, middle, top]`. The docstring on `getHexagramLines` (returns top-to-bottom) is already correct because it reverses each triple; leave it. Do NOT touch the separate `TRIGRAM_LINES` table in `components/oracle/entry/OracleEntryPage.tsx`, which intentionally uses a different ordering (the file header in trigrams.ts explains this).
- **Acceptance:** Read the file; the comment now matches the data (check ☳ Zhen, ☶ Gen against a hexagram chart). `npm run typecheck` passes. No runtime change.
- **Size:** S

### 02 · wire-founding-light-definition

- **Title:** Define "Founding light" in one sentence everywhere it appears
- **Files:** `components/atlas/PieceHUD.tsx` (lines 213-220, the live globe HUD), `components/PiecePage.tsx` (around line 445), `components/atlas/PieceSidePanel.tsx` (lines 143-152, currently unmounted but goes live with item 13)
- **Change:** Under the "The Nth light" value in each of the three Founding light blocks, add one small italic explainer sentence, the same in all three, in the voice of the existing atlas captions (compare AtlasPage's "a light is a piece claimed by its keeper"). Suggested: "A founding light marks the order in which a piece was claimed by its keeper." Match each surface's existing small-caption classes (PieceHUD uses the dark instrument style, the other two use `font-serif italic text-... text-wood-...`).
- **Acceptance:** On the dev server, open `/atlas`, tap a claimed piece (one with an ordinal), and see the sentence in the HUD. Open `/piece/UL-122` and see it there. Typecheck passes.
- **Size:** S

### 03 · wire-learn-article-cards

- **Title:** Fill in relatedCard on all 11 Learn articles so the card footer turns on
- **Files:** `content-site/src/content/articles/*.mdoc` (all 11 non-template files)
- **Change:** The schema field is `relatedCard` (`content-site/src/content.config.ts:12`, int 1-64, optional) and the footer renders in `content-site/src/pages/[...slug].astro:147` ("Explore Card N in the deck"). Each article's `cover:` frontmatter value is a Cloudinary id whose numeric prefix IS the card number (verified: all 11 prefixes are in 1-64). Add one `relatedCard: N` line to each file's frontmatter, next to the tags. Derived values: aztec-sun-stone 30, celtic-spirals 56, islamic-geometry 60, jung-and-the-mandala 2, kalachakra-wheel-of-time 5, navajo-sandpainting 45, rose-windows-gothic 46, sand-mandalas-of-tibet 29, sri-yantra-geometry 11, what-is-a-mandala 1, what-is-mandala-art 48. Sanity-check each against its cover prefix before writing.
- **Acceptance:** `cd content-site && npm run build` succeeds; the built HTML for one article (e.g. dist output for what-is-a-mandala) contains "Explore Card 1".
- **Size:** S

### 04 · wire-gateway-profile-link

- **Title:** Add a quiet fourth link from the entry gateway into the birth-chart flow
- **Files:** `components/OracleGateway.tsx` (lines 210-214)
- **Change:** The center column has three links: "Get a Reading" (internal), "View the Artwork" and "Contact the Artist" (external). After "Get a Reading", add a fourth internal link with the same `og-link` class: `<Link to="/profile" className="og-link">Your Birth Chart</Link>`. Keep the existing comment about external links where it is; the profile is internal so a `Link` is correct.
- **Acceptance:** Open `/gateway` on the dev server, click "Your Birth Chart", land on `/profile`. Typecheck passes.
- **Size:** S

### 05 · wire-save-button

- **Title:** Mount SaveToCollectionButton on the card page next to Acquire/Share
- **Files:** `components/UniversalLanguageCard.tsx` (line 205), `components/account/SaveToCollectionButton.tsx` (read-only, already complete)
- **Change:** The generated EB host renders `headerChartSlot` in a div directly under the Acquire/Share button row (EBReading.generated.tsx lines 123-127). Do not edit the generated file. In UniversalLanguageCard.tsx, change the prop at line 205 from `headerChartSlot={<YourPositionCallout gate={card.number} />}` to a fragment that renders YourPositionCallout followed by `<SaveToCollectionButton kind="card" itemRef={String(card.number)} label="Save this card" />`. Import the button from `./account/SaveToCollectionButton`. The button self-hides when accounts are unconfigured and prompts sign-in when signed out, so no gating is needed here. Give the two slot children a small flex or stacked wrapper so they do not collide visually (check both light and dark palettes).
- **Acceptance:** Open `/universal-language/1`; the "Save this card" button appears under the Acquire/Share row. Signed out, clicking it opens the sign-in prompt. Signed in, saving adds the card, then `/account/collections` lists it.
- **Size:** S

### 06 · wire-card-to-piece-links

- **Title:** Link the card page to the physical piece and its place on the atlas
- **Files:** `components/UniversalLanguageCard.tsx`
- **Change:** The card already computes its embodying piece: `const piece = ulPieceForCard(card.number)` at line 188 (returns an `Artwork` with `id`, `title`; currently only fed to BuySheet). Extend the same `headerChartSlot` fragment from item 05 (coordinate: 05 lands first): when `piece` is defined, render two quiet links styled like the slot's small-label text: "See the piece: {piece.title}" to `/piece/${piece.id}` and "On the Atlas" to `/atlas?piece=${piece.id}`. The atlas deep link is already handled on arrival (AtlasPage.tsx lines 244-258 match bare pieceId against `${param}:0`). The reverse links (globe to card, piece to card) already exist, so this closes the loop.
- **Acceptance:** Open `/universal-language/58` (or any code with a piece): both links render; "On the Atlas" lands on `/atlas?piece=UL-...` with that piece selected in the HUD; "See the piece" lands on its `/piece/...` page. A code with no piece renders neither link and no empty gap.
- **Size:** S

### 07 · wire-seeking-ground-links

- **Title:** Deep-link each "Seeking ground" list item to its own claim path and code
- **Files:** `components/atlas/SeekingGround.tsx`, `components/AtlasPage.tsx` (the `seekingPieces` memo at lines 371-381)
- **Change:** Today each item is only a select button whose effect (the HUD) lives up inside the 3D stage and reads as "nothing happened". Add `cardNumber?: number` to the `SeekingPiece` interface; in AtlasPage populate it with the existing `cardNumberFor(p.pieceId)` helper. In each list item, under the existing title/series line, render two small links (same `font-label` bronze style as the section's existing "Open its book" link): "Its page" to `/piece/${p.pieceId}` plus `/${p.editionNumber}` when the edition is a number (the piece page carries the per-piece claim and enquiry paths), and, when `cardNumber` is set, "Code N" to `/universal-language/${cardNumber}`. Keep the existing select button and the section-level claim link unchanged. Use Link, and stop click propagation so the links do not also trigger the select button.
- **Acceptance:** On `/atlas`, scroll to Seeking ground: every item shows "Its page" (and "Code N" for UL pieces); both navigate correctly.
- **Size:** S

### 08 · wire-thread-count-line

- **Title:** Kinship threads: add a "showing X of Y" line to the filters row
- **Files:** `utils/kinship.ts`, `components/atlas/AtlasFilters.tsx` (the shared `AtlasFiltersProps` interface), `components/atlas/AtlasFiltersDark.tsx`, `components/AtlasPage.tsx` (lines 459-472 and the AtlasFiltersDark call at 792-808)
- **Change:** `buildKinshipIndex` computes `rawPairs.length` then discards it, keeping only the boolean `capped` that AtlasPage logs to console (the lines 464-472 block). Add `totalPairs: number` to the `KinshipIndex` interface and return `rawPairs.length` from `buildKinshipIndex`. Add optional `threadsShown?: number` and `threadsTotal?: number` to `AtlasFiltersProps`. In AtlasFiltersDark, next to the existing kinship "threads" toggle row, render a small muted line: "showing {threadsShown} of {threadsTotal} threads" when both are set and they differ, or "{threadsShown} threads" when equal. In AtlasPage pass `threadsShown={kinshipIndex?.pairs.length}` and `threadsTotal={kinshipIndex?.totalPairs}`. Keep the console.info. The light `AtlasFilters` component shares the props type; give it the same optional rendering or ignore the props there (they are optional either way, but check it still typechecks).
- **Acceptance:** On `/atlas`, open "filter": the thread count line renders next to the threads toggle. Typecheck passes.
- **Size:** S

### 09 · wire-real-today-tile

- **Title:** Make the daily "today" tile use the real Sun-transit code
- **Files:** `components/oracle/entry/OracleEntryPage.tsx` (lines 32-37 and 152-159)
- **Change:** The live deck's `cardForToday` hashes the date string (`hashTo64`), verified NOT astronomy. The real engine exists: `todaysEnergy(now)` and `yearsEnergy(now)` in `lib/astrology/today.ts` return `{ gate, line }` with gate 1-64 equal to the card number (this is what the unmounted TodayEnergyPanel/YearEnergyPanel consume). In the adapter, replace `cardForToday` with `byNumber.get(todaysEnergy().gate)` and `cardForYear` with `byNumber.get(yearsEnergy().gate)`; import both from `../../../lib/astrology/today`. Delete `hashTo64` and its comment if nothing else in the file uses it. Note: the year gate is Gate 41 by definition of the Human Design year (see YearEnergyPanel's header comment); that is correct, not a bug.
- **Acceptance:** Open `/universal-language`; the Today tile shows the same gate number that `todaysEnergy()` returns (spot-check in the browser console by importing nothing: compare the tile's card number against the gate shown on TodayEnergyPanel after item 11 lands, or log `todaysEnergy()` in a scratch test). Reloading does not change it; it is stable within a day and NOT equal to the old hash value.
- **Size:** S

### 10 · wire-export-letters-heirs

- **Title:** Include letters and heir registrations in the exported keepsake book
- **Files:** `functions/api/atlas/steward/export.ts`
- **Change:** The book object (lines 182-208) includes chain, inscriptions, placements, sales, and consent, but drops the two richest parts. Both are one import away: heirs already sit on the authorized steward record (`record.heirs`, typed `HeirRegistration[]` in types.ts:526); letters live in mutable R2 and are read with `readLetters` (see `functions/api/atlas/steward/letters.ts`, which filters with `lettersForRecipient(letters, letterRecipientKey(pieceId, editionNumber))` from `utils/letters.ts`). Add to the book: `heirs: record.heirs ?? []` and `letters:` the recipient-filtered list (reuse the same helpers; do not regenerate anniversary/transfer letters here, just export what exists, and degrade to an empty list plus a note if the letters store is unavailable, mirroring how inscriptions degrade). Do not touch the verification section: letters and heirs are mutable records, never hashed, so state that in a one-line comment.
- **Acceptance:** Typecheck passes. With the dev functions running (wrangler pages dev) and a bound steward session, `GET /api/atlas/steward/export?pieceId=...` returns JSON containing `letters` and `heirs` keys. If no authed session is reproducible locally, code review of the diff plus typecheck is the floor, and note that in the commit body.
- **Size:** S

### 11 · wire-energy-panels

- **Title:** Mount TodayEnergyPanel and YearEnergyPanel on the profile page
- **Files:** `components/OracleProfile.tsx`, `components/oracle/TodayEnergyPanel.tsx`, `components/oracle/YearEnergyPanel.tsx`
- **Change:** Both panels are complete, self-contained Link cards; neither is imported anywhere. Mount point: `/profile` (OracleProfile), which the status doc names as the natural hub for "today's real transit". Add a section between the main content and the footer, rendered in BOTH branches (the panels need no profile): a small label in the page's existing label style ("The sky right now" or similar), then the two panels side by side (flex, wrap on mobile). CAUGHT DURING VERIFICATION: the `.ul-energy-panel__*` classes the panels use are defined nowhere in the repo. Write them: a compact horizontal card (label, 80px thumb, title, meta line) using the site's CSS variables (`--color-wood-*`, `--color-bronze-*`, `--color-paper-*`), either as a small scoped `<style>` block in OracleProfile (the SaveToCollectionButton pattern) or a tiny CSS file imported by both panel components. Keep the class names the panels already use.
- **Acceptance:** Open `/profile` (with and without a saved profile): both panels render styled, the Today panel links to the current transit's card page, the Year panel to Gate 41's. Check dark mode does not break the colors.
- **Size:** M

### 12 · wire-kinship-color-distance

- **Title:** Color kinship threads by shared trigram and show great-circle distance
- **Files:** `utils/kinship.ts`, `components/atlas/three/KinshipArcs.tsx`, `components/atlas/KinshipLayer.tsx`, `components/AtlasPage.tsx` (the `kinForSelected` memo, lines 489-516)
- **Change:** Both facts are computed then discarded. (a) Shared trigram: `isKin` finds the match and returns only a boolean. Add `sharedTrigram: string` to `KinshipPair`; in `buildKinshipIndex`, record the first matching trigram name when building each pair. (b) In the 3D arcs (`KinshipArcs.tsx`), the merged geometry uses a single `uColor` uniform (bronze). Add a per-vertex `aColor` vec3 attribute filled per pair from an 8-entry trigram palette (warm earth family only: browns, bronzes, ochres, muted golds; NEVER blue or cold gray, this is a locked visual rule), pass it through the vertex shader as a varying, and use it in place of `uColor` in the fragment shader. Keep every existing alpha/pulse/selection term. (c) In the SVG fallback (`KinshipLayer.tsx`), set each path's stroke from the same palette (export the palette from utils/kinship.ts or a small shared module so both renderers agree). (d) Distance: pairs carry `distance` in radians, used only for sorting. In AtlasPage's `kinForSelected`, append it to the kin title: `Math.round(pair.distance * 6371)` km (the `EARTH_RADIUS_KM = 6371` const already exists in the file), e.g. "Title · Heaven thread · 1,240 km". No component-shape change needed since KinEntry.title is a string.
- **Acceptance:** On `/atlas` with threads on, arcs show distinct warm hues (compare two pieces with different shared trigrams); select a piece and the Kin list in the HUD shows "N km" per entry. `?libglobe` variant and non-3D fallback still render. Typecheck passes.
- **Size:** M

### 13 · wire-globe-fallback

- **Title:** Render the simpler globe and side panel when 3D is unsupported
- **Files:** `components/AtlasPage.tsx`
- **Change:** The whole globe stage is gated `state.kind === 'ready' && use3D` (line 568); without WebGL a visitor gets no globe, no title, only Seeking ground. Everything needed is already imported and plumbed but never rendered: `Globe` (cobe, props: nodes/selectedId/onSelect/className), `KinshipLayer` (props: index/width/height/selectedId/visible; it self-syncs rotation by mirroring Globe's clock), `PieceSidePanel` (props: piece/kin/onSelectKin/holderChart), and the `globeBoxRef` + `globeSize` ResizeObserver state (lines 208-211, 443-455) which currently measures for nothing in the 3D path. Add an `{state.kind === 'ready' && !use3D && (...)}` branch: a light-chrome section with the page title, a square globe box (`ref={globeBoxRef}`, relative) containing `<Globe nodes={globeNodes} selectedId={selectedKey} onSelect={setSelectedKey} />` with `<KinshipLayer index={kinshipIndex} width={globeSize.width} height={globeSize.height} selectedId={selectedKey} visible={kinshipVisible} />` absolutely positioned over it (only when kinshipIndex is non-null), and `<PieceSidePanel piece={selectedPiece} kin={kinForSelected} onSelectKin={setSelectedKey} holderChart={holderChart} />` beside or below it (stack on mobile). Reuse the existing light `AtlasFilters` component for series/status/category/size in this branch, or at minimum the threads toggle; keep scope tight, parity of chrome is not required. Test by temporarily hardcoding `use3D = false` (do not commit the hardcode; note in the commit how it was tested).
- **Acceptance:** With `use3D` forced false on the dev server, `/atlas` shows the page title, a turning cobe globe with markers and kinship arcs, tap-to-select opens the side panel with kin and Founding light, and Seeking ground still renders below. With WebGL available, behavior is unchanged.
- **Size:** M

### 14 · wire-piece-page-parity

- **Title:** Show on the public piece page what the globe shows for the same piece
- **Files:** `components/PiecePage.tsx` (626 lines; the data loads at lines 239-290), read-only reference: `components/AtlasPage.tsx` (intention at 404-410, kin at 489-516, holder chart at 522-540)
- **Change:** A collector scanning their piece's QR sees LESS than a stranger browsing the globe. PiecePage already calls `loadAtlasState()` and holds the `PublicPiece`; all three missing facts hang off data it already has or one public fetch. (a) Shared dream: the public piece entry carries `intention?: string` (types.ts:203); render it in a quiet block ("What its keeper shares" or matching the HUD's wording) when present. (b) Kin constellation: `buildKinshipIndex(state, CITIES_BY_ID, FULL_ARCHIVE)` on the already-loaded state, look up `pairsByKey` for key `${pieceId}:${edition ?? 0}`, take the nearest 6, and render each as a Link to `/atlas?piece=<otherKey stripped of :0>` with the shared-trigram thread name (copy the naming logic from AtlasPage's kinForSelected; after item 12 lands the trigram sits on the pair itself). (c) Holder's chart element: `fetch('/api/atlas/holder-chart?pieceId=...&editionNumber=...')` exactly as AtlasPage does (public endpoint, returns `{ chart: { element } | null }`), render "Held by a chart of {element}" only when returned and the piece is placed. Match the page's existing section style (bordered blocks with label captions).
- **Acceptance:** Open `/piece/UL-122`: for a placed piece with a shared intention and Ring-3 holder, all three blocks render; for a seeking piece, none do and nothing errors. Compare against the same piece selected on `/atlas`: the facts agree.
- **Size:** M. FLAG: the audit likely underestimated this one; it is the largest single diff in the queue (three data paths plus layout in a 626-line page). Still one commit, but if the batch runner needs to shed load, defer to Phase 2 without unblocking anything else.

### 15 · wire-owner-lights

- **Title:** Light the signed-in owner's own pieces and saved cards on the globe
- **Files:** `components/AtlasPage.tsx`, `components/atlas/Globe.tsx` and/or `components/atlas/three/Markers.tsx`, read-only reference: `components/atlas/StewardEdit.tsx` (lines 92-131) and `lib/collections/context.tsx`
- **Change:** Personalization today is only the birth-place pin (`useProfile`, lines 170-174) and the "your codes" lens (`yourGates`, lines 180-191); the map never learns which pieces you steward or which cards you saved. (a) Own pieces: the bind endpoint returns them; when signed in (`useAccount().isSignedIn`), call `fetchAuthed('/api/atlas/steward/claim', { method: 'POST' })` once on load, exactly the Phase A call StewardEdit makes on mount (idempotent bind, returns the piece list); collect their keys into a Set and set a new `owned?: boolean` flag on matching GlobeNodes. (b) Saved cards: `useCollections()` exposes collections whose `items` carry `{ kind: 'card', ref }`; build a Set of saved card numbers and OR it into the `yours` computation next to `yourGates.has(num)` (so the existing "your codes" lens also lights saved cards), keeping a separate `owned` treatment for stewarded pieces. (c) Rendering: give `owned` nodes a distinct warm treatment in the marker renderers (both the cobe Globe and the three.js Markers read GlobeNode), e.g. the sage/origin family or a brighter bronze pulse; warm earth tones only.
- **Acceptance:** Signed in as a steward with a bound piece and at least one saved card: on `/atlas` the stewarded piece renders visibly distinct, and toggling "your codes" also lights pieces whose card you saved. Signed out: no extra fetches fire and the globe is unchanged.
- **Size:** M. FLAG: bigger than advertised, as the audit suspected. It spans auth wiring, a context provider, and BOTH marker renderers (cobe shader-side sizing/color and the three.js markers). Safe to defer to Phase 2; nothing else in the queue depends on it. If kept, consider splitting (a)+(c) from (b).

---

## Shared postscript (applies to every item)

- **Typecheck is the gate:** every item must pass `npm run typecheck` before its commit. CI enforces it; the Vite build alone will pass code that CI then rejects.
- **Restart the dev server after structural edits:** HMR and hard reload both serve stale code after new files, new imports, or moved components. Kill and restart the server (and kill any duplicate servers on ports 2222/2223/2224) before trusting what the browser shows for an acceptance check.
- **Never introduce the em-dash character** in any copy, comment, or code string; use a comma, period, colon, or new sentence.
- **Warm earth tones only** on any globe or world visual (items 12, 13, 15): browns and bronze, never blue or cold gray.
- **Do not edit generated files** (`components/oracle/eb/generated/*`, `components/oracle/entry/generated/*`); wire through their host props.
- Items 05 and 06 touch the same `headerChartSlot` expression in `components/UniversalLanguageCard.tsx`; run 05 before 06 (the queue order already does this) so 06 extends the fragment 05 created.
- Item 12 lands a `sharedTrigram` field that item 14 can reuse; the order already handles it, but 14 must not assume it if 14 is deferred and later run standalone.
