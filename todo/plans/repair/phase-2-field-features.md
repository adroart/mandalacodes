# Phase 2 execution brief: finishing The Field, plus two refactors

_Written 2026-07-10 against the code on `main` (working tree at parity). Every file
pointer below was verified by reading the file. Each lettered section is a
self-contained mini-brief: hand it alone to a fresh agent workspace and it has
everything it needs. All nine items are independent of each other and can run in
parallel, each on its own branch off `main`._

Repo: `/Users/adrianrasmussen/conductor/workspaces/mandalacodes/seattle` (worktree of the
mandalacodes repo). PRs target `main`; merge to main auto-deploys to mandalacodes.com in
about two minutes.

**Corrections to the audit, found while verifying (read these before trusting Part I
of `todo/DEVELOPMENT-STATUS.md` on these items):**

1. **The hexagram ring is NOT purely decorative.** `Globe3D.tsx` already implements
   `pickRing` (glyph hit-testing) and `AtlasPage.tsx` already implements `handleRingTap`
   (line 359) wired through the `onRingTap` prop. It works today, but only while the
   Mandala View is engaged (`pickRing` returns false when `rig.mandala < 0.6`). Item B
   below is scoped to what actually remains.
2. **The "three copy-pasted city pickers" are really two city pickers plus one piece
   picker.** `AdminPieceContent.tsx` line 65 is a `PiecePicker` (searches `FULL_ARCHIVE`,
   not cities); its own comment says it "mirrors CityAutocomplete's pattern". Item H
   below is scoped accordingly.
3. **StewardEdit lives at `components/atlas/StewardEdit.tsx`**, not
   `components/StewardEdit.tsx`.
4. **The clustering design notes in `todo/plans/piece-page-buildout.md` were written for
   the old `GlobeGL` (react-globe.gl) renderer.** The default globe is now the hand-built
   `Globe3D` with a custom point-sprite shader (`components/atlas/three/Markers.tsx`).
   The intended UX in that plan still stands (Adrian chose it explicitly on 2026-06-14);
   the implementation notes do not.
5. **`outreachStatus` already has four values** including `declined`
   (`types.ts:505`: `'no-contact' | 'invited' | 'claimed' | 'declined'`). Item F must
   reconcile the placeholder manual states with this existing enum, not invent a
   parallel one.

---

## A. City clustering on the globe (one marker per city, numbered, with a city list)

**Goal.** Today every piece in a city renders at the city's exact lat/lng
(`components/AtlasPage.tsx`, the `globeNodes` memo at line 316: each visible piece
pushes one `GlobeNode` at `c.lat`/`c.lng` from `CITIES_BY_ID`). Twenty pieces in one
town stack into one unreadable dot and only the pick-nearest one is ever selectable.
Build the design Adrian already chose (`todo/plans/piece-page-buildout.md`, section
"Also queued: globe marker clustering"): one marker per city, sized and brightened by
piece count, showing the count number when count > 1; clicking a multi-piece city opens
a city-list panel where each piece is clickable through to its normal piece HUD, with a
back affordance returning to the list. Single-piece cities behave exactly as today. The
visitor's birth-place marker (`BIRTH_KEY` in AtlasPage) is its own point, never
clustered.

**Files.**
- `components/AtlasPage.tsx` (globeNodes memo line 316; selection state, `PieceHUD`
  mounting around line 840)
- `components/atlas/Globe.tsx` (the `GlobeNode` interface, line 29)
- `components/atlas/three/Globe3D.tsx` (the `pick` callback, line 265: screen-space
  nearest-node projection, no raycaster)
- `components/atlas/three/Markers.tsx` (point-sprite shader, CAPACITY 256, size set per
  node in `sizeFor`)
- `components/atlas/PieceHUD.tsx` (the selected-piece card; the city list is a new
  sibling or new state of this)
- `todo/plans/piece-page-buildout.md` (the intended design, read it in full)

**Implementation sketch.**
- Keep `globeNodes` as the per-piece list (the kinship index, HUD, leader line, and
  yours-lens all key off per-piece nodes). Derive a second memo, `cityClusters`:
  group visible nodes by `cityId` into `{ cityId, lat, lng, count, memberKeys[],
  anyYours, statusMix }`. Pass clusters to `Globe3D` as the rendered layer; keep the
  per-piece nodes available for selection math once a city is opened.
- Marker visual: scale `aSize` and brightness with count in `Markers.tsx`. The count
  numeral cannot live in the point sprite shader cheaply; render numbers as a projected
  HTML overlay, reusing the exact projection pattern of the leader-line effect in
  `Globe3D.tsx` (lines 223 to 250: `latLngToVec3`, apply the two rig rotations, project
  through `rig.camera`, place a DOM element). One absolutely positioned div per
  multi-piece city, hidden when the point rotates to the back hemisphere (`v.z` check,
  same as `pick`).
- Click flow: `pick` returns a cluster; count 1 resolves straight to the single
  `memberKey` (today's behavior, no visual change). Count > 1 enters a new selection
  state, `selectedCity`, which shows the city-list panel (city label, count, each
  member with title, series, status, claim ordinal) in the HUD slot. Choosing a member
  sets `selectedKey` as today; a back control returns to the city list; release clears
  both.
- Deep links: keep `?piece=` working unchanged (selecting a piece from a shared URL
  should open the piece HUD directly, skipping the list). Consider `?city=` optional,
  not required.
- Edge cases: the birth-place node bypasses clustering entirely; the mandala-view ring
  threads (`placedByCard`) and kinship arcs are keyed to lat/lng, not node ids, so they
  are unaffected; the yours-lens recede logic in `Markers.tsx` needs a cluster-level
  answer (recede a cluster only if no member matches).

**Acceptance checks.**
- Two seeded pieces in one city render one marker with "2" on it; clicking it lists
  both; each opens its piece HUD; back returns to the list; Esc and release clear all.
- A single-piece city is pixel-identical to today (no numeral, direct HUD).
- Birth-place marker never merges into a city cluster even when coordinates match.
- `?piece=UL-122` deep link still opens that piece directly.
- Rotation, ignition opening, filters, kinship arcs, and the mandala view all still work.
- `npm run typecheck` passes.

**Needs Adrian: YES, UX sign-off on the marker design BEFORE merge.** Build behind a
branch and show him a live dev-server link. Concrete questions he must answer:
1. Does the count numeral sit on the marker itself or float beside it, and in which
   font (the map's label font is Lato caps; the numeral could also be the serif)?
2. How should a cluster grow: size only, brightness only, or both, and is there a cap
   (does a 20-piece city dwarf the globe)?
3. In the city list, what identifies each piece: title plus series ordinal, or title
   plus status ("kept" / "ember"), or title plus claim ordinal ("the 7th light")?
4. When a cluster contains a mix of placed and unawakened pieces, is the marker bronze
   (lit) or does the mix show (for example a dimmer ring segment)?

**Size: L** (the largest item in this phase; roughly 1 to 2 agent-days plus the
sign-off loop).

---

## B. Tappable hexagram ring, outside the mandala view too

**Goal.** The 64-glyph ring (`components/atlas/three/HexagramRing.tsx`) is already
tappable, but only while the Mandala View is engaged. Make every glyph clickable in the
resting view as well, opening that code's pieces, and give the ring a touch affordance
so visitors can discover it.

**What already exists (verified).** `Globe3D.tsx` has `pickRing` (line 300): it
projects all 64 glyph anchor points (`radius 1.52`, King Wen angle `(n-1)/64 * 2pi`)
into screen space and picks the nearest within 22px. It is gated by
`if (!onRingTap || rig.mandala < 0.6) return false;`. `AtlasPage.tsx` line 359 has
`handleRingTap`: a lit code selects its placed piece, an unlit code navigates to
`/universal-language/{n}`. There is NO raycasting anywhere on this globe; both marker
picking (`pick`, line 265) and ring picking are manual screen-space projection. Reuse
that pattern; do not introduce a THREE.Raycaster.

**Files.**
- `components/atlas/three/Globe3D.tsx` (`pickRing` gate, line 302; `onPointerUp`
  ordering, line 363: markers are tried before the ring, keep that priority)
- `components/atlas/three/HexagramRing.tsx` (glyph alpha: placed 0.62, unplaced 0.12;
  a hover or post-tap highlight needs a per-glyph attribute or uniform)
- `components/AtlasPage.tsx` (`handleRingTap` line 359; the mandala caption at line 618
  already says "touch a code to visit it": mirror that hint for the resting view)

**Implementation sketch.**
- Relax the gate: allow `pickRing` whenever `onRingTap` exists, keeping the marker pick
  first in `onPointerUp` so a city light near a glyph still wins. Keep the 22px radius;
  in the resting view the ring is edge-on, so verify mis-taps against markers are rare
  (the marker-first ordering handles most of it).
- Discoverability: in the resting view the glyphs sit at alpha 0.12 and read as
  atmosphere. Options, cheapest first: brighten the whole ring slightly on pointer-over
  of the ring band (one uniform); or add a one-line caption near the ring hint text.
  Do not redesign the ring.
- Consider pointing unlit codes at the atlas code view from item C once it exists, but
  do not couple the two branches: `/universal-language/{n}` is a fine target today.

**Acceptance checks.**
- In the resting (non-mandala) view, tapping a glyph on the front of the ring selects
  its placed piece (lit code) or navigates to the card (unlit code).
- Tapping a glyph does not steal taps from a nearby city marker.
- Mandala-view behavior is unchanged.
- Touch devices: a drag still rotates; only a sub-6px press registers as a tap
  (`CLICK_SLOP_PX` already enforces this, verify it holds).
- `npm run typecheck` passes.

**Needs Adrian: nothing.** (If a visual affordance beyond a caption is added, show him
a link, but the interaction itself needs no sign-off.)

**Size: S** (half a day; the machinery exists, this is a gate change plus affordance).

---

## C. Flat "all 64 codes" index on the atlas, with honest per-code piece states

**Goal.** Below (or beside) the globe, a flat scannable index of all 64 codes, each
tappable to a view of that code's pieces with honest states, in the register of:
"Earth's Breath, 1 of 3, Bali kept, Berlin seeking."

**Where the data already lives (verified).**
- `lib/atlas/state.ts` is the query layer: `loadAtlasState()` (cached public atlas
  fetch with local-seed fallback), `findPlacementForCard(cardNumber)` and the
  `useCardPlacement(cardNumber)` hook, plus `findPublicPiece`. The card page already
  uses these for its "On the Atlas" seat.
- Piece to code: `utils/universalLanguage.ts` `ulCardNumber(coverImage)` over
  `FULL_ARCHIVE` (see `cardNumberFor` in `components/AtlasPage.tsx` line 88).
- Card names: `CARD_BY_NUMBER` from `data/oracleData`.
- Per-piece state: `PublicAtlasState.pieces[]` in `types.ts` carries
  `status: 'seeking' | 'placed' | 'unawakened'`, `cityId`, `claimOrdinal`,
  `editionNumber`. City labels via `CITIES_BY_ID` / `formatPlaceLabel` from
  `data/cities`.
- So for every code N: name from `CARD_BY_NUMBER`, its editions from `FULL_ARCHIVE`
  joined to atlas pieces, each with status and city. Everything needed for "1 of 3,
  Bali kept, Berlin seeking" exists; nothing new server-side.

**Files.**
- New: `components/atlas/CodesIndex.tsx` (the 8x8 or flowing 64-glyph index) and
  `components/atlas/CodePiecesPanel.tsx` (the per-code view), or one component with
  two states.
- `components/AtlasPage.tsx` (mount point: the below-the-fold body, after
  `SeekingGround`, around line 903).
- Read for register and vocabulary: `components/atlas/SeekingGround.tsx`,
  `components/atlas/PieceSidePanel.tsx` (how "Seeking ground" and "founding light" are
  phrased).

**Implementation sketch.**
- Index row per code: glyph (reuse the shared glyph module `components/oracle/
  HexagramGlyph.tsx`), number, card name, and a state summary ("2 of 3 placed", "all
  seeking", "1 ember"). Lit codes visually distinct from unlit, mirroring the ring's
  bright/dim split.
- Tap a code: expand in place (accordion) or open a panel listing that code's pieces:
  edition, city ("Bali, kept"), seeking entries ("Berlin, seeking"), unawakened
  ("sold, not yet claimed" in whatever word the site uses: "ember" per Markers.tsx
  comments). Each placed piece links to `/atlas?piece={key}` (re-selects on the globe)
  and to `/piece/{pieceId}`; seeking pieces link to their acquire path.
- State language must be honest: derive strictly from the atlas state, never pretend a
  count. Codes with no pieces at all say so plainly ("not yet embodied" or similar).
- Keep it a light DOM section, no 3D. URL: a `#codes` anchor or `?code=N` param so a
  specific code view is shareable.

**Acceptance checks.**
- All 64 rows render with correct names and glyphs; counts match the atlas state
  exactly (spot-check against the globe and Seeking ground for three codes).
- Tapping a code shows every edition with the right status and city; links land on the
  globe selection and the piece page.
- Works when the atlas API is down (local-seed fallback still renders the index).
- Reads correctly on mobile widths.
- `npm run typecheck` passes.

**Needs Adrian: light.** No gate to build, but the state vocabulary ("kept",
"seeking", "ember") is voice; flag the chosen words in the PR for a quick yes/no.

**Size: M** (about a day).

---

## D. The yearly "shall I keep carrying these words?" ask

**Goal.** A steward who shared an intention onto the map (the dream layer) is asked
once a year whether the piece should keep carrying those words publicly. This is the
missing reconfirmation loop of The Field lens 2. Mechanism: a new letter kind plus a
"years since shared" derive-on-read check that mirrors the existing anniversary logic
exactly.

**The anniversary logic to mirror (verified, read these first).**
- `utils/letters.ts`: `wholeYearsSince(claimIso, nowIso)` (line 350, pure calendar
  math) and `anniversaryYearDue(claimIso, existingAnniversaryLetters, nowIso)`
  (line 371: idempotent, counts prior letters of that kind, yields at most one year
  per call, catches up one letter per visit after a gap). Letter bodies are pure
  template functions seeded by FNV-1a (`seedIndex`) so retries never re-roll prose.
- `functions/api/atlas/steward/letters.ts` GET (line 94): derive-on-read, no cron.
  Inside one `mutateLetters` pass it checks what is due, appends, and threads new
  letters out for the courtesy email (`sendLetterEmail`, subject via
  `letterEmailSubject(letter.kind)` in `functions/api/atlas/_email.ts`).
- Letters are mutable R2, never chain events; bodies reference public facts only.

**The shared-words data (verified).** `SharedIntention` in `types.ts` (around line
460): `{ id, pieceId, editionNumber, inscriptionId, text, sharedAt, status: 'live' |
'rehomed' | 'withdrawn', tended }`. Read via `readSharedIntentions(env)` and mutate via
`mutateSharedIntentions` in `functions/api/atlas/_helpers.ts` (lines 178, 307).
`utils/intentions.ts` owns the pure logic. Sharing happens in
`functions/api/atlas/steward/share-intention.ts`, surfaced in the book at
`components/atlas/LegacyBook.tsx` (share call at line 330).

**Files.**
- `types.ts` line 432: extend `LetterKind` with the new kind (suggest
  `'words-anniversary'`).
- `utils/letters.ts`: add `composeWordsAnniversaryBody(ctx)` (templates asking, in the
  piece's voice, whether it should keep carrying the words; quote nothing private, the
  shared text itself is already public so a short excerpt is allowed) and
  `wordsAnniversaryYearDue(sharedAt, existingWordsLetters, nowIso)`, a thin twin of
  `anniversaryYearDue`.
- `functions/api/atlas/steward/letters.ts` GET: inside the existing `mutateLetters`
  closure, when the piece has a `status: 'live'` shared intention, check
  `wordsAnniversaryYearDue(intention.sharedAt, priorWordsLetters, now)` and append.
  Needs one extra read, `readSharedIntentions(env)`, before the mutator.
- `functions/api/atlas/_email.ts`: a subject line for the new kind.
- `components/atlas/LegacyBook.tsx`: wherever letters render, the new kind should show
  its at-hand answers: "keep carrying them" (dismiss, letter counts as answered by
  `readAt`) and "return them to the book" (calls the existing withdraw path for the
  shared intention). Do not build a new endpoint for "keep"; reading the letter is
  consent to continue. Withdrawal reuses the existing share-intention withdraw
  mechanics (see `utils/intentions.ts` line 228 area).
- Tests: `utils/letters` has a unit suite pattern (the file header says the suite pins
  prose and rules); add the twin cases: due at exactly one year, not due before, gap
  catch-up one per call, idempotent after write, only for `status: 'live'` entries.

**Acceptance checks.**
- A live shared intention with `sharedAt` over a year old generates exactly one
  words-anniversary letter on the steward's next book open; a second GET generates
  none.
- Rehomed and withdrawn intentions never generate the ask.
- The letter renders in the book with the two actions; "return to the book" actually
  ends the public sharing (verify the globe no longer shows the intention).
- Courtesy email fires with the new subject (or is cleanly skipped when unset).
- Unit tests for the due-logic pass; `npm run typecheck` passes.

**Needs Adrian: voice pass on the letter templates before merge** (the prose is the
piece speaking; agent drafts, he approves or rewrites in the PR). The mechanism itself
needs nothing.

**Size: S to M** (half to one day; the pattern is a faithful twin).

---

## E. "My collected cards on the map" in collections

**Goal.** `components/account/CollectionsManager.tsx` lists saved cards generically
(name, number, link to the card). It never says which of your saved cards are embodied
by a physical piece resting somewhere in the world. Add that join: per collection item,
show where its piece rests, and give the collection a "see them on the map" path.

**The join (verified, both ends exist).**
- Collection items: `lib/collections/context.tsx`, `CollectionItem { kind, ref }`;
  v1 only writes `kind: 'card'` with `ref` = card number as string
  (`CollectionsManager.tsx` line 8 does `Number(item.ref)` already).
- Atlas side: `lib/atlas/state.ts` exports `useCardPlacement(cardNumber)` /
  `findPlacementForCard(cardNumber)`, built exactly for this (the card page's "On the
  Atlas" seat uses it). It resolves a card number to its placed piece and city through
  the shared number: code N = card N = piece's card number.
- Deep link to the globe: `/atlas?piece={pieceId}` or `{pieceId}:{edition}` (AtlasPage
  applies `?piece=` on load, line 247).

**Files.**
- `components/account/CollectionsManager.tsx` (the item list, lines 118 to 140).
- `lib/atlas/state.ts` (read-only reuse; add a batch helper only if per-item hook use
  is awkward: 64 items max, so a single `loadAtlasState()` in the component and a
  synchronous map over items is the simple shape).
- Read for phrasing: the card page's atlas seat (grep `useCardPlacement` consumers).

**Implementation sketch.**
- Load the atlas state once in `CollectionsManagerInner`. For each card item, resolve
  its placement: placed (city label, "rests in Bali"), seeking, unawakened, or no
  physical piece. Render as a quiet second line or dot-separated suffix on the existing
  item row, plus an "on the atlas" link to `/atlas?piece=…` when placed.
- Optional header affordance per collection: "n of m of these live on the map". Do not
  embed a globe in the account page; the map view IS the atlas page, reached by link.
  (If a visual map is wanted later it is a separate ask; keep this shippable.)
- Handle the fallback: if the atlas fetch fails, the collections page must render
  exactly as today (join lines simply absent).

**Acceptance checks.**
- A saved card whose piece is placed shows its city and an atlas link that lands with
  that piece selected on the globe.
- Saved cards with seeking or no pieces read honestly and do not link to the globe.
- Collections page unchanged when signed out / no collections / atlas unreachable.
- `npm run typecheck` passes.

**Needs Adrian: nothing.**

**Size: S** (half a day).

---

## F. Admin outreach-status edit control plus endpoint

**Goal.** The admin roster (`components/AdminAtlas.tsx`, the stewards table; the
read-only status cell is line 1233, `{s.outreachStatus}`) shows each steward's
outreach status but cannot change it. Only the claim flow flips it today
(`functions/api/atlas/steward/claim.ts` flips to `'claimed'`; issuance and transfer set
`'invited'`, see `functions/api/atlas/_helpers.ts:355` and `_transfer.ts:92`). Add a
small edit control and an admin endpoint.

**GATE: this item is blocked on Adrian defining what the manual states mean.** Build
the spec below with three placeholder manual states he can rename: `contacted`,
`declined`, `paused`. Before merge he must answer: (1) final names and meanings, (2)
whether `contacted` replaces or coexists with the existing `invited`, (3) whether a
manual state may ever overwrite `claimed` (recommended: never; `claimed` stays
machine-owned, set only by the bind flow).

**Existing enum (verified, `types.ts:505`):**
`outreachStatus: 'no-contact' | 'invited' | 'claimed' | 'declined'`. Note `declined`
already exists; `paused` and `contacted` would be additions. Extending the union
touches only the type and the writers listed above (grep `outreachStatus` to confirm no
switch statements exhaust it).

**Files.**
- `types.ts:505` (extend the union with the agreed states).
- New endpoint: `functions/api/atlas/stewards/outreach.ts` (POST), following the
  sibling `functions/api/atlas/stewards/index.ts` and `issue.ts` exactly:
  `requireAdmin` from `../../_lib/auth`, body whitelisting in the style of
  `steward/letters.ts` POST, and the write through `mutateStewards(env, …)` from
  `functions/api/atlas/_helpers.ts:279` (there are deliberately no bare write helpers;
  the mutator is concurrency-safe). Identify the record by `pieceId` +
  `editionNumber`; reject transitions writing `claimed` (machine-owned) with a 400.
- `components/AdminAtlas.tsx`: turn the status cell (line 1233) into a small select or
  inline menu; on change, POST via the existing `useAdminFetch`, optimistic update with
  reload-on-error (the component already has `loadStewards`).

**Acceptance checks.**
- Changing a status in the roster persists (reload shows it) and is rejected without
  admin auth (401/403 path already redirects to /admin/login).
- Attempting to set `claimed` manually is rejected server-side.
- The claim flow still flips to `claimed` regardless of any manual state.
- Unknown body fields rejected; `npm run typecheck` passes.

**Needs Adrian: YES, the policy call above, before merge (build can proceed with the
placeholders behind the PR).**

**Size: S** (half a day once the states are named).

---

## G. Refactor: one shared source for the 11-sphere sequence and the profile-key list

**Goal.** The 11-position sequence and the profile-key list are duplicated and invite
drift. Verified duplications:
- Sphere sequence, twice: `data/profilePositions.ts` (`PROFILE_POSITIONS`, 11 entries
  with key/sequence/label plus layout fields; `POSITION_KEYS` derived at line 173) and
  `lib/oracle/recommendation.ts` (`SPHERES`, line 18: the same 11 keys in the same
  order with label/role/sequence).
- Profile-key list, twice more: `functions/api/profile/put.js` (the `keys` array,
  line 28, used for validation) and the `ProfileKey` union in `lib/astrology/types.ts`
  line 15 (type-level; it cannot validate at runtime, which is why put.js re-lists it).

**The constraint that shapes the fix:** `functions/api/profile/put.js` is plain JS (it
imports only `../_lib/auth.js` / `../_lib/db.js`); it cannot import a `.ts` module. So
the single source must be a plain-JS constants file with JSDoc types.

**Files.**
- New: `data/profileKeys.js` (or `lib/astrology/profileKeys.js`, keep it beside its
  consumers' imports): `export const PROFILE_KEYS = ['lifesWork', 'evolution',
  'radiance', 'purpose', 'attraction', 'iq', 'eq', 'sq', 'core', 'culture', 'pearl'];`
  plus, if labels/sequence membership are shared, a `PROFILE_SPHERES` array of
  `{ key, label, sequence }`. JSDoc `@type` annotations so TS consumers get types via
  `as const`-style JSDoc or a small `.d.ts` sibling.
- `functions/api/profile/put.js`: replace the inline `keys` array with the import
  (Pages Functions bundle cross-repo imports fine; `steward/letters.ts` already imports
  from `utils/` and `data/` four levels up).
- `lib/oracle/recommendation.ts`: rebuild `SPHERES` from the shared list plus its own
  role prose. NOTE: the role text in `SPHERES` differs from the `role` text in
  `PROFILE_POSITIONS` on purpose (different surfaces, different voice, and the
  recommendation labels differ: "Core" there vs "Vocation" in profilePositions for the
  legacy `core` key). Share the ordered keys and sequence membership; keep per-surface
  labels/prose local unless they are character-identical. Do not flatten voice
  differences in a refactor.
- `data/profilePositions.ts`: derive order (and optionally sequence) from the shared
  list; keep layout fields (`x`, `y`, `labelSide`, `body`, `role`) local. Add a
  compile-time exhaustiveness check (`satisfies Record<ProfileKey, …>` or a length
  assert) so the TS side breaks loudly if the JS list changes.
- `lib/astrology/types.ts`: consider deriving `ProfileKey` from the constant
  (`typeof PROFILE_KEYS[number]`) via the `.d.ts`, or leave the union and add a static
  assert that they match. Either is fine; pick the one with the smallest diff.

**Acceptance checks.**
- `git grep -n "'lifesWork'"` shows the ordered 11-key list defined exactly once.
- `npm run typecheck` passes; run the existing profile math and oracle test suites
  (`tests/oracle-entry-codes.spec.ts` and `scripts/verify-profile-math.ts` touch these
  keys).
- Exercise `/api/profile/put` locally (wrangler / functions dev) once: a valid body
  saves, a body missing one sphere is rejected. This proves the JS import bundles.
- The profile page, recommendation endpoint, and lookbook render unchanged.

**Needs Adrian: nothing.**

**Size: S to M** (half to one day; most of the effort is verification, not code).

---

## H. Refactor: one shared typeahead picker (two city pickers plus a piece picker)

**Goal.** The same blur-to-close typeahead combobox is hand-rolled three times:
- `components/AdminAtlas.tsx` line 104: `CityAutocomplete` (admin theme, searches
  `CITIES`, shows `city, country` with id badge).
- `components/atlas/StewardEdit.tsx` line 481 (state from line 77, list from line 319):
  the steward book's "Where it rests" picker. Different in three real ways: it searches
  `ATLAS_PLACES` (cities plus country-only centroids), it carries proper ARIA
  (`role=combobox`/`listbox`/`option`, click-outside handling), and it is styled for
  the light book page with 44px touch targets.
- `components/AdminPieceContent.tsx` line 65: `PiecePicker`. NOT a city picker (the
  audit overstated this); it searches `FULL_ARCHIVE` piece options but is a
  line-for-line structural copy of `CityAutocomplete` (its comment admits it).

**Implementation sketch.** Extract one generic component, suggest
`components/shared/TypeaheadPicker.tsx`:
- Props: `items: T[]`, `filter(item, query)`, `renderItem(item)`, `itemKey`,
  `onPick(item)`, `placeholder`, `maxResults`, `variant: 'admin' | 'book'` (or a
  className pass-through), controlled `value` display.
- Bake in the StewardEdit version's accessibility (combobox ARIA, click-outside,
  keyboard: at minimum Escape closes; arrow-key selection is a welcome bonus, not
  required) so the refactor levels everything UP to the best copy, not down.
- Reimplement all three call sites on it. City-specific matching (`cityMatches`,
  country-only label formatting in StewardEdit lines 46 to 61) stays at the call site
  as the `filter`/`renderItem` args. The admin id badge stays in AdminAtlas's
  `renderItem`.
- Behavior parity to preserve, per site: AdminAtlas clears `onChange('')` while typing
  (the form treats a mid-edit query as no selection); StewardEdit saves immediately on
  pick (`handleCityPick` posts the update) and shows the current city as placeholder;
  PiecePicker shows label after pick.

**Acceptance checks.**
- All three surfaces work exactly as before: admin seed-event city select, admin
  piece-content piece select, steward "Where it rests" (including country-only
  entries and the immediate save plus "Saved." flash).
- Keyboard and screen-reader semantics on the steward picker are not degraded (ARIA
  roles still present).
- **Visual QA in BOTH light and dark contexts** (the admin pages are light paper
  theme; check the steward book page and any dark-context usage; take before/after
  screenshots for the PR).
- `npm run typecheck` passes.

**Needs Adrian: light.** No design gate, but attach the before/after screenshots (he
should eyeball the steward book one).

**Size: M** (about a day, dominated by parity testing).

---

## I. Small: at-the-control nudges in the steward book

**Goal.** (`todo/DEVELOPMENT-STATUS.md` Part II section A item 5.) The book's top
welcome is state-aware and letters auto-open, but after the steward scrolls down and
ACTS (places the piece, or writes an inscription), nothing at that spot points to the
natural next step. Add one quiet line at the control, shown on success.

**Files (verified).**
- `components/atlas/StewardEdit.tsx`: placing happens via `handleCityPick` ->
  `submitUpdate` (line 166; success sets entries and calls `flashSaved`). The "Saved."
  flash region is at line 612. The visibility toggle is the section right below the
  city picker (line 537).
- `components/atlas/LegacyBook.tsx`: inscribing posts to `/api/atlas/steward/inscribe`
  at line 287; sharing an intention posts `/api/atlas/steward/share-intention` at
  line 330.

**Implementation sketch.**
- After a successful city save when `!piece.isPublic`: next to the Saved flash (or
  directly under the visibility toggle), one italic serif line: "It has a place. When
  you are ready, let it shine on the atlas." with the toggle right there. (The welcome
  already uses this sentence up top; at-the-control repetition is the point. Reuse the
  string, do not fork the copy.)
- After a successful city save when already public: point down the page: "Its pages
  continue below," anchored to the book section.
- After a successful inscription (LegacyBook, at the add-entry form): if the entry was
  kind `intention` and not yet shared, one line offering the share control ("These
  words could ride on the map."); otherwise a quiet pointer to the next book feature
  (letters or heirs or export, whichever section follows).
- Nudges are transient or dismissible, never stacked, never modal, and never shown
  before the action has actually succeeded. Match the existing register: font-serif
  italic, stone-600, no buttons beyond the control they point at.

**Acceptance checks.**
- Place a piece while private: the shine nudge appears beside the control; toggling
  visibility clears it.
- Write an intention inscription: the share nudge appears at the form; sharing (or
  dismissing) clears it. Story/dedication kinds do not offer the share nudge.
- No nudge on load, on error, or duplicated after repeat saves.
- `npm run typecheck` passes.

**Needs Adrian: light.** Copy is voice-adjacent; reuse existing sentences where noted
and flag any new sentence in the PR for a yes/no.

**Size: S** (a few hours).

---

## Shared postscript (applies to every item above)

- **Run `npm run typecheck` before every push.** CI enforces it and the build alone
  will pass code that CI then rejects.
- **Restart the dev server after structural edits** (new files, moved exports, route
  changes). Vite's HMR and even a hard reload can serve stale modules; kill duplicate
  servers on ports 2222/2223/2224 before judging any visual result.
- UI items (A, B, C, E, H, I) ship with a clickable live dev-server link in the PR,
  server left running; a screenshot is backup only.
- Never introduce the em-dash character in copy or code. Warm earth tones only on
  globe/world visuals: browns and bronze, never blue or cold gray.
- Brand register: paper/wood/stone/bronze palette, bronze #c4aa7c and sage #9caa87
  accents; Cormorant Garamond serif, Cinzel titles, Lato labels; middle-dot
  separators.
- All nine items are mutually independent: any order, full parallelism, separate
  branches off `main`.
